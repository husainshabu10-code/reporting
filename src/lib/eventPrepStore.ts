"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSeedState } from "@/lib/eventPrepSeed";
import type {
  Area,
  AreaAccess,
  AreaRequest,
  DailyReport,
  EventPrepState,
  EventSettings,
  FormField,
  GlobalOption,
  LiveTask,
  NotificationLog,
  Profile,
  TaskFile,
  TaskTemplate,
  TaskUpdate,
  VerificationLog,
  ZoneType
} from "@/lib/eventPrepTypes";

const STORAGE_KEY = "ashara-event-prep-phase-1";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function isEventPrepSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function eventPrepSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return client;
}

export async function sendMagicLink(email: string) {
  const db = eventPrepSupabase();
  if (!db) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter an email address first.");
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  const { error } = await db.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: origin }
  });
  if (error) throw error;
}

export async function loadEventPrepState() {
  if (isEventPrepSupabaseConfigured()) {
    try {
      const db = eventPrepSupabase();
      if (db) {
        return await loadFromSupabase(db);
      }
    } catch (error) {
      console.warn("Supabase load failed, using local fallback.", error);
    }
  }

  if (typeof window === "undefined") return createSeedState();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seeded = createSeedState();
    saveLocal(seeded);
    return seeded;
  }

  try {
    return mergeWithSeed(JSON.parse(stored) as Partial<EventPrepState>);
  } catch {
    const seeded = createSeedState();
    saveLocal(seeded);
    return seeded;
  }
}

export async function saveEventPrepState(state: EventPrepState, profile?: Profile) {
  saveLocal(state);
  if (!isEventPrepSupabaseConfigured()) return;
  const db = eventPrepSupabase();
  if (!db) return;
  if (!profile) return;
  await saveToSupabase(db, state, profile);
}

export async function uploadTaskEvidence(file: File, liveTaskId: string) {
  const db = eventPrepSupabase();
  if (!db) return { storagePath: "" };
  const storagePath = `${liveTaskId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await db.storage.from("task-evidence").upload(storagePath, file, { upsert: false });
  if (error) throw error;
  return { storagePath };
}

async function loadFromSupabase(db: SupabaseClient): Promise<EventPrepState> {
  const profiles = await selectTable<Profile>(db, "profiles");
  const { data: userData } = await db.auth.getUser();
  const activeProfile = profiles.find((profile) => profile.email.toLowerCase() === (userData.user?.email || "").toLowerCase()) || profiles[0];
  const isAdmin = Boolean(activeProfile && ["super_admin", "admin"].includes(activeProfile.role));
  const [
    zoneTypes,
    areas,
    areaAccess,
    taskTemplates,
      liveTasks,
    dailyReports,
    taskUpdates,
    taskFiles,
    verificationLogs,
    requests,
    notificationLogs,
    globalOptions,
    formFields,
    settings
  ] = await Promise.all([
    selectTable<ZoneType>(db, "zone_types"),
    selectTable<Area>(db, "areas"),
    selectTable<AreaAccess>(db, "area_access"),
    selectTable<TaskTemplate>(db, "task_templates"),
    selectTable<LiveTask>(db, "live_tasks"),
    selectTable<DailyReport>(db, "daily_reports"),
    selectTable<TaskUpdate>(db, "task_updates"),
    selectTable<TaskFile>(db, "task_files"),
    selectTable<VerificationLog>(db, "verification_logs"),
    selectTable<AreaRequest>(db, "requests"),
    isAdmin ? selectTable<NotificationLog>(db, "notification_logs") : Promise.resolve([]),
    selectTable<GlobalOption>(db, "global_options"),
    selectTable<FormField>(db, "form_fields"),
    selectSettings(db)
  ]);

  return mergeWithSeed({
    settings,
    profiles,
    zoneTypes,
    areas,
    areaAccess,
    taskTemplates,
    liveTasks,
    dailyReports,
    taskUpdates,
    taskFiles,
    verificationLogs,
    requests,
    notificationLogs,
    globalOptions,
    formFields
  }, false);
}

async function selectTable<T>(db: SupabaseClient, table: string) {
  const { data, error } = await db.from(table).select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return ((data || []) as Array<Record<string, unknown>>).map((row) => fromDbRow<T>(row, table)).filter(Boolean) as T[];
}

async function selectSettings(db: SupabaseClient): Promise<EventSettings | undefined> {
  const { data, error } = await db.from("event_settings").select("*").eq("id", "default").maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return {
    eventStartDate: String(data.event_start_date || ""),
    preparationStartDate: String(data.preparation_start_date || "")
  };
}

async function saveToSupabase(db: SupabaseClient, state: EventPrepState, profile?: Profile) {
  const isAdmin = Boolean(profile && ["super_admin", "admin"].includes(profile.role));
  if (!isAdmin && profile) {
    const allowedAreaIds = new Set(state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => access.areaId));
    const allowedTaskIds = new Set(state.liveTasks.filter((task) => allowedAreaIds.has(task.areaId)).map((task) => task.id));
    await upsertRows(db, "daily_reports", state.dailyReports.filter((report) => allowedAreaIds.has(report.areaId)).map(reportToDb));
    await upsertRows(db, "task_updates", state.taskUpdates.filter((update) => allowedTaskIds.has(update.liveTaskId) && (update.updatedBy === profile.id || profile.role === "verifier")).map(updateToDb));
    await upsertRows(db, "task_files", state.taskFiles.filter((file) => allowedTaskIds.has(file.liveTaskId)).map(fileToDb));
    await upsertRows(db, "verification_logs", state.verificationLogs.filter((log) => log.verifierId === profile.id).map(verificationLogToDb));
    await upsertRows(db, "requests", state.requests.filter((request) => request.requestedBy === profile.id).map(requestToDb));
    return;
  }

  const { error: settingsError } = await db.from("event_settings").upsert({
    id: "default",
    event_start_date: state.settings.eventStartDate,
    preparation_start_date: state.settings.preparationStartDate,
    updated_at: new Date().toISOString()
  });
  if (settingsError) throw settingsError;
  await deleteMissingRows(db, "areas", state.areas.map((area) => area.id));
  await upsertRows(db, "profiles", state.profiles.map(profileToDb));
  await upsertRows(db, "zone_types", state.zoneTypes.map(zoneTypeToDb));
  await upsertRows(db, "areas", state.areas.map(areaToDb));
  await upsertRows(db, "area_access", state.areaAccess.map(areaAccessToDb));
  await upsertRows(db, "task_templates", state.taskTemplates.map(templateToDb));
  await upsertRows(db, "live_tasks", state.liveTasks.map(liveTaskToDb));
  await upsertRows(db, "daily_reports", state.dailyReports.map(reportToDb));
  await upsertRows(db, "task_updates", state.taskUpdates.map(updateToDb));
  await upsertRows(db, "task_files", state.taskFiles.map(fileToDb));
  await upsertRows(db, "verification_logs", state.verificationLogs.map(verificationLogToDb));
  await upsertRows(db, "requests", state.requests.map(requestToDb));
  await upsertRows(db, "notification_logs", state.notificationLogs.map(notificationToDb));
  await upsertRows(db, "global_options", state.globalOptions.map(globalOptionToDb));
  await upsertRows(db, "form_fields", state.formFields.map(formFieldToDb));
}

async function upsertRows(db: SupabaseClient, table: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

async function deleteMissingRows(db: SupabaseClient, table: string, idsToKeep: string[]) {
  const { data, error } = await db.from(table).select("id");
  if (error) throw error;
  const keep = new Set(idsToKeep);
  const staleIds = ((data || []) as Array<{ id: string }>).map((row) => row.id).filter((id) => !keep.has(id));
  for (const staleId of staleIds) {
    const { error: deleteError } = await db.from(table).delete().eq("id", staleId);
    if (deleteError) throw deleteError;
  }
}

function saveLocal(state: EventPrepState) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeWithSeed(partial: Partial<EventPrepState>, includeDemoData = true): EventPrepState {
  const seed = createSeedState();
  return {
    ...seed,
    ...partial,
    settings: { ...seed.settings, ...(partial.settings || {}) },
    profiles: partial.profiles?.length ? partial.profiles : includeDemoData ? seed.profiles : [],
    zoneTypes: partial.zoneTypes?.length ? partial.zoneTypes : seed.zoneTypes,
    areas: partial.areas?.length ? partial.areas : includeDemoData ? seed.areas : [],
    areaAccess: partial.areaAccess?.length ? partial.areaAccess : includeDemoData ? seed.areaAccess : [],
    taskTemplates: partial.taskTemplates?.length ? partial.taskTemplates : includeDemoData ? seed.taskTemplates : [],
    liveTasks: partial.liveTasks?.length ? partial.liveTasks : includeDemoData ? seed.liveTasks : [],
    dailyReports: partial.dailyReports || [],
    taskUpdates: partial.taskUpdates || [],
    taskFiles: partial.taskFiles || [],
    verificationLogs: partial.verificationLogs || [],
    requests: partial.requests || [],
    notificationLogs: partial.notificationLogs || [],
    globalOptions: partial.globalOptions?.length ? partial.globalOptions : seed.globalOptions,
    formFields: partial.formFields?.length ? partial.formFields : seed.formFields
  };
}

function fromDbRow<T>(row: Record<string, unknown>, table: string) {
  if (row.data && typeof row.data === "object" && "id" in row.data) return row.data as T;
  switch (table) {
    case "profiles":
      return {
        id: String(row.id || ""),
        email: String(row.email || ""),
        fullName: String(row.full_name || ""),
        role: row.role,
        status: row.status,
        createdBy: row.created_by ? String(row.created_by) : undefined
      } as T;
    case "zone_types":
      return { id: String(row.id || ""), name: row.name, displayOrder: Number(row.display_order || 0) } as T;
    case "areas":
      return {
        id: String(row.id || ""),
        zoneTypeId: String(row.zone_type_id || ""),
        name: String(row.name || ""),
        code: String(row.code || ""),
        active: Boolean(row.active ?? true),
        dailyDeadline: String(row.daily_deadline || "20:00").slice(0, 5),
        reminderTime: String(row.reminder_time || "18:30").slice(0, 5),
        escalationTime: String(row.escalation_time || "21:00").slice(0, 5)
      } as T;
    case "area_access":
      return { id: String(row.id || ""), profileId: String(row.profile_id || ""), areaId: String(row.area_id || ""), role: row.role } as T;
    case "task_templates":
      return {
        id: String(row.id || ""),
        day: Number(row.prep_day || 1),
        priorityLevel: row.priority_level || "Medium",
        mainObjective: String(row.main_objective || ""),
        workstream: String(row.workstream || ""),
        taskDetails: String(row.task_details || ""),
        responsibleTeam: String(row.responsible_team || ""),
        followUpQuestions: String(row.follow_up_questions || ""),
        requiredEquipment: String(row.required_equipment || ""),
        expectedOutput: String(row.expected_output || ""),
        testingRequired: String(row.testing_required || ""),
        hiddenReference: row.hidden_reference && typeof row.hidden_reference === "object" ? row.hidden_reference : {},
        importedAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "live_tasks":
      return {
        id: String(row.id || ""),
        templateId: String(row.template_id || ""),
        areaId: String(row.area_id || ""),
        taskType: row.task_type,
        prepDay: Number(row.prep_day || 1),
        startDate: String(row.start_date || ""),
        dueDate: String(row.due_date || ""),
        actualCompletionDate: row.actual_completion_date ? String(row.actual_completion_date) : undefined,
        priority: row.priority || "Medium",
        requiredQuantity: row.required_quantity == null ? undefined : Number(row.required_quantity),
        unit: row.unit ? String(row.unit) : undefined,
        assignedProfileIds: Array.isArray(row.assigned_profile_ids) ? row.assigned_profile_ids.map(String) : [],
        assignedVerifierIds: Array.isArray(row.assigned_verifier_ids) ? row.assigned_verifier_ids.map(String) : [],
        verificationRequired: Boolean(row.verification_required ?? true),
        verificationRule: row.verification_rule || "one_verifier",
        evidenceNote: row.evidence_note ? String(row.evidence_note) : undefined,
        active: Boolean(row.active ?? true),
        notApplicable: Boolean(row.not_applicable ?? false),
        delayReason: row.delay_reason ? String(row.delay_reason) : undefined,
        revisedDueDate: row.revised_due_date ? String(row.revised_due_date) : undefined
      } as T;
    case "daily_reports":
      return {
        id: String(row.id || ""),
        areaId: String(row.area_id || ""),
        reportDate: String(row.report_date || ""),
        prepDay: Number(row.prep_day || 1),
        status: row.status || "Not Started",
        generalRemark: String(row.general_remark || ""),
        submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
        submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
        updatedAt: String(row.updated_at || new Date().toISOString())
      } as T;
    case "task_updates":
      return {
        id: String(row.id || ""),
        liveTaskId: String(row.live_task_id || ""),
        dailyReportId: String(row.daily_report_id || ""),
        updatedBy: String(row.updated_by || ""),
        status: row.status || "Pending",
        verificationStatus: row.verification_status || "Not Submitted",
        remarks: String(row.remarks || ""),
        completedQuantity: row.completed_quantity == null ? undefined : Number(row.completed_quantity),
        userRoleStanding: String(row.user_role_standing || ""),
        escalationPoints: Array.isArray(row.escalation_points) ? row.escalation_points : [],
        supportingPersonnel: Array.isArray(row.supporting_personnel) ? row.supporting_personnel : [],
        correctionComment: row.correction_comment ? String(row.correction_comment) : undefined,
        updatedAt: String(row.updated_at || new Date().toISOString())
      } as T;
    case "task_files":
      return {
        id: String(row.id || ""),
        liveTaskId: String(row.live_task_id || ""),
        taskUpdateId: String(row.task_update_id || ""),
        fileName: String(row.file_name || ""),
        fileType: String(row.file_type || ""),
        fileSize: Number(row.file_size || 0),
        storagePath: row.storage_path ? String(row.storage_path) : undefined,
        reviewLocked: Boolean(row.review_locked),
        uploadedAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "verification_logs":
      return {
        id: String(row.id || ""),
        liveTaskId: String(row.live_task_id || ""),
        taskUpdateId: String(row.task_update_id || ""),
        verifierId: String(row.verifier_id || ""),
        action: row.action,
        comment: String(row.comment || ""),
        createdAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "requests":
      return {
        id: String(row.id || ""),
        requestType: row.request_type,
        areaId: String(row.area_id || ""),
        relatedLiveTaskId: row.related_live_task_id ? String(row.related_live_task_id) : undefined,
        title: String(row.title || ""),
        details: String(row.details || ""),
        quantityRequested: row.quantity_requested == null ? undefined : Number(row.quantity_requested),
        priority: row.priority || "Medium",
        requiredByDate: String(row.required_by_date || ""),
        attachmentName: row.attachment_name ? String(row.attachment_name) : undefined,
        requestedBy: String(row.requested_by || ""),
        status: row.status || "Under Review",
        decisionRemarks: row.decision_remarks ? String(row.decision_remarks) : undefined,
        createdAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "notification_logs":
      return {
        id: String(row.id || ""),
        type: String(row.type || ""),
        recipientEmail: String(row.recipient_email || ""),
        subject: String(row.subject || ""),
        status: row.status || "queued",
        createdAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "global_options":
      return { id: String(row.id || ""), group: String(row.option_group || ""), value: String(row.value || ""), active: Boolean(row.active ?? true) } as T;
    case "form_fields":
      return {
        id: String(row.id || ""),
        taskType: row.task_type,
        fieldKey: String(row.field_key || ""),
        label: String(row.label || ""),
        required: Boolean(row.required),
        visible: Boolean(row.visible ?? true),
        displayOrder: Number(row.display_order || 0)
      } as T;
    default:
      return row as T;
  }
}

function profileToDb(item: Profile) {
  return {
    id: item.id,
    email: item.email,
    full_name: item.fullName,
    role: item.role,
    status: item.status,
    created_by: item.createdBy || null,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function zoneTypeToDb(item: ZoneType) {
  return { id: item.id, name: item.name, display_order: item.displayOrder, data: item, updated_at: new Date().toISOString() };
}

function areaToDb(item: Area) {
  return {
    id: item.id,
    zone_type_id: item.zoneTypeId,
    name: item.name,
    code: item.code,
    active: item.active,
    daily_deadline: item.dailyDeadline,
    reminder_time: item.reminderTime,
    escalation_time: item.escalationTime,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function areaAccessToDb(item: AreaAccess) {
  return { id: item.id, profile_id: item.profileId, area_id: item.areaId, role: item.role, data: item, updated_at: new Date().toISOString() };
}

function templateToDb(item: TaskTemplate) {
  return {
    id: item.id,
    prep_day: item.day,
    priority_level: item.priorityLevel,
    workstream: item.workstream,
    task_details: item.taskDetails,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function liveTaskToDb(item: LiveTask) {
  return {
    id: item.id,
    template_id: item.templateId,
    area_id: item.areaId,
    task_type: item.taskType,
    prep_day: item.prepDay,
    start_date: item.startDate || null,
    due_date: item.dueDate || null,
    actual_completion_date: item.actualCompletionDate || null,
    priority: item.priority,
    required_quantity: item.requiredQuantity ?? null,
    unit: item.unit || null,
    assigned_profile_ids: item.assignedProfileIds,
    assigned_verifier_ids: item.assignedVerifierIds,
    verification_required: item.verificationRequired,
    verification_rule: item.verificationRule,
    evidence_note: item.evidenceNote || null,
    active: item.active,
    not_applicable: item.notApplicable,
    delay_reason: item.delayReason || null,
    revised_due_date: item.revisedDueDate || null,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function reportToDb(item: DailyReport) {
  return {
    id: item.id,
    area_id: item.areaId,
    report_date: item.reportDate,
    prep_day: item.prepDay,
    status: item.status,
    submitted_by: item.submittedBy || null,
    submitted_at: item.submittedAt || null,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function updateToDb(item: TaskUpdate) {
  return {
    id: item.id,
    live_task_id: item.liveTaskId,
    daily_report_id: item.dailyReportId,
    updated_by: item.updatedBy,
    status: item.status,
    verification_status: item.verificationStatus,
    remarks: item.remarks,
    completed_quantity: item.completedQuantity ?? null,
    user_role_standing: item.userRoleStanding,
    escalation_points: item.escalationPoints,
    supporting_personnel: item.supportingPersonnel,
    correction_comment: item.correctionComment || null,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function fileToDb(item: TaskFile) {
  return {
    id: item.id,
    live_task_id: item.liveTaskId,
    task_update_id: item.taskUpdateId,
    file_name: item.fileName,
    file_type: item.fileType,
    file_size: item.fileSize,
    storage_path: item.storagePath || null,
    review_locked: item.reviewLocked,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function verificationLogToDb(item: VerificationLog) {
  return {
    id: item.id,
    live_task_id: item.liveTaskId,
    task_update_id: item.taskUpdateId,
    verifier_id: item.verifierId,
    action: item.action,
    comment: item.comment,
    data: item,
    created_at: item.createdAt
  };
}

function requestToDb(item: AreaRequest) {
  return {
    id: item.id,
    request_type: item.requestType,
    area_id: item.areaId,
    related_live_task_id: item.relatedLiveTaskId || null,
    title: item.title,
    details: item.details,
    quantity_requested: item.quantityRequested ?? null,
    priority: item.priority,
    required_by_date: item.requiredByDate || null,
    attachment_name: item.attachmentName || null,
    requested_by: item.requestedBy,
    status: item.status,
    decision_remarks: item.decisionRemarks || null,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function notificationToDb(item: NotificationLog) {
  return {
    id: item.id,
    type: item.type,
    recipient_email: item.recipientEmail,
    subject: item.subject,
    status: item.status,
    data: item,
    created_at: item.createdAt
  };
}

function globalOptionToDb(item: GlobalOption) {
  return { id: item.id, option_group: item.group, value: item.value, active: item.active, data: item, updated_at: new Date().toISOString() };
}

function formFieldToDb(item: FormField) {
  return {
    id: item.id,
    task_type: item.taskType,
    field_key: item.fieldKey,
    label: item.label,
    required: item.required,
    visible: item.visible,
    display_order: item.displayOrder,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/(^-|-$)/g, "") || "evidence";
}

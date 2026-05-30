"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { createSeedState } from "@/lib/eventPrepSeed";
import type {
  Area,
  AreaAccess,
  AreaRequest,
  ActivityLog,
  DailyReport,
  EventPrepState,
  EventSettings,
  FormField,
  GlobalOption,
  InAppNotification,
  LiveTask,
  Profile,
  ReportExport,
  Reminder,
  RequestReview,
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

export async function signInWithPassword(loginId: string, password: string) {
  const db = eventPrepSupabase();
  if (!db) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  const email = loginId.trim().toLowerCase();
  if (!email || !password) throw new Error("Enter your login ID and password.");
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOutEventPrep() {
  const db = eventPrepSupabase();
  if (!db) return;
  await db.auth.signOut();
}

export async function createCredentialUser(payload: {
  fullName: string;
  email: string;
  role: Profile["role"];
  areaId: string;
  workstreams?: string[];
  password?: string;
}) {
  return credentialRequest<{ profile: Profile; temporaryPassword: string }>({ action: "createUser", ...payload });
}

export async function approveCredentialUser(profileId: string) {
  return credentialRequest<{ profile: Profile }>({ action: "approveUser", profileId });
}

export async function resetCredentialPassword(profileId: string) {
  return credentialRequest<{ profile: Profile; temporaryPassword: string }>({ action: "resetPassword", profileId });
}

export async function changeCurrentPassword(password: string) {
  return credentialRequest<{ profile: Profile }>({ action: "changePassword", password });
}

export async function updateCredentialAccess(payload: {
  profileId: string;
  role: Profile["role"];
  status: Profile["status"];
  areaIds: string[];
  accessScopes?: AreaAccess[];
  viewerAccess?: Profile["viewerAccess"];
}) {
  return credentialRequest<{ profile: Profile; areaAccess: AreaAccess[] }>({ action: "updateAccess", ...payload });
}

async function credentialRequest<T>(body: Record<string, unknown>): Promise<T> {
  const db = eventPrepSupabase();
  if (!db) throw new Error("Supabase is not configured.");
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You must be signed in.");
  const response = await fetch("/api/event-prep/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(json.error || "Credential request failed."));
  return json as T;
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
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Supabase session is missing. Sign out and sign in again.");
  const response = await fetch("/api/event-prep/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ state })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(json.error || "Supabase sync failed."));
}

export async function uploadTaskEvidence(file: File, liveTaskId: string) {
  const db = eventPrepSupabase();
  if (!db) return { storagePath: "" };
  const storagePath = `${liveTaskId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await db.storage.from("task-evidence").upload(storagePath, file, { upsert: false });
  if (error) throw error;
  return { storagePath };
}

export function subscribeToEventPrepChanges(onChange: () => void) {
  const db = eventPrepSupabase();
  if (!db) return () => undefined;
  let timer: number | null = null;
  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 500);
  };
  const channel = db.channel("ashara-event-prep-sync") as RealtimeChannel;
  [
    "event_settings",
    "profiles",
    "zone_types",
    "areas",
    "area_access",
    "task_templates",
    "live_tasks",
    "daily_reports",
    "task_updates",
    "task_files",
    "verification_logs",
    "requests",
    "request_reviews",
    "reminders",
    "in_app_notifications",
    "activity_logs",
    "report_exports",
    "global_options",
    "form_fields"
  ].forEach((table) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
  });
  channel.subscribe();
  return () => {
    if (timer) window.clearTimeout(timer);
    db.removeChannel(channel);
  };
}

async function loadFromSupabase(db: SupabaseClient): Promise<EventPrepState> {
  const profiles = await selectTable<Profile>(db, "profiles");
  const { data: userData } = await db.auth.getUser();
  const activeProfile = profiles.find((profile) => profile.id === userData.user?.id || profile.email.toLowerCase() === (userData.user?.email || "").toLowerCase()) || profiles[0];
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
    requestReviews,
    reminders,
    notifications,
    activityLogs,
    reportExports,
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
    selectTable<RequestReview>(db, "request_reviews"),
    selectTable<Reminder>(db, "reminders"),
    selectTable<InAppNotification>(db, "in_app_notifications"),
    isAdmin ? selectTable<ActivityLog>(db, "activity_logs") : Promise.resolve([]),
    isAdmin ? selectTable<ReportExport>(db, "report_exports") : Promise.resolve([]),
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
    requestReviews,
    reminders,
    notifications,
    activityLogs,
    reportExports,
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
    const allowedTaskIds = scopedTaskIdsForProfile(state, profile, profile.role === "verifier" ? "verify" : "update");
    const reviewRequestIds = new Set(state.requestReviews.filter((review) => review.reviewerId === profile.id).map((review) => review.requestId));
    await upsertRows(db, "daily_reports", state.dailyReports.filter((report) => allowedAreaIds.has(report.areaId)).map(reportToDb));
    await upsertRows(db, "task_updates", state.taskUpdates.filter((update) => allowedTaskIds.has(update.liveTaskId) && (update.updatedBy === profile.id || profile.role === "verifier")).map(updateToDb));
    await upsertRows(db, "task_files", state.taskFiles.filter((file) => allowedTaskIds.has(file.liveTaskId)).map(fileToDb));
    await upsertRows(db, "verification_logs", state.verificationLogs.filter((log) => log.verifierId === profile.id).map(verificationLogToDb));
    await upsertRows(db, "requests", state.requests.filter((request) => request.requestedBy === profile.id || reviewRequestIds.has(request.id)).map(requestToDb));
    await upsertRows(db, "request_reviews", state.requestReviews.filter((review) => review.reviewerId === profile.id).map(requestReviewToDb));
    await upsertRows(db, "in_app_notifications", state.notifications.filter((notification) => notification.userId === profile.id).map(notificationToDb));
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
  await deleteMissingRows(db, "live_tasks", state.liveTasks.map((task) => task.id));
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
  await upsertRows(db, "request_reviews", state.requestReviews.map(requestReviewToDb));
  await upsertRows(db, "reminders", state.reminders.map(reminderToDb));
  await upsertRows(db, "in_app_notifications", state.notifications.map(notificationToDb));
  await upsertRows(db, "activity_logs", state.activityLogs.map(activityLogToDb));
  await upsertRows(db, "report_exports", state.reportExports.map(reportExportToDb));
  await upsertRows(db, "global_options", state.globalOptions.map(globalOptionToDb));
  await upsertRows(db, "form_fields", state.formFields.map(formFieldToDb));
}

function scopedTaskIdsForProfile(state: EventPrepState, profile: Profile, intent: "view" | "update" | "verify" = "view") {
  if (["super_admin", "admin"].includes(profile.role)) return new Set(state.liveTasks.map((task) => task.id));
  return new Set(state.liveTasks.filter((task) => hasTaskScopeAccess(state, profile, task, intent)).map((task) => task.id));
}

function hasTaskScopeAccess(state: EventPrepState, profile: Profile, task: LiveTask, intent: "view" | "update" | "verify" = "view") {
  if (["super_admin", "admin"].includes(profile.role)) return true;
  if (intent === "verify" && task.assignedVerifierIds.includes(profile.id)) return true;
  if (intent !== "verify" && task.assignedProfileIds.includes(profile.id)) return true;

  const workstream = taskWorkstream(state, task);
  return state.areaAccess.some((access) => {
    if (access.profileId !== profile.id || access.areaId !== task.areaId || access.role !== profile.role) return false;
    if (access.role === "area_admin") return matchesAccessWorkstream(access, workstream, "workstreams") && (intent !== "verify" || Boolean(access.data?.canVerify)) && (intent !== "update" || access.data?.canUpdateTasks !== false);
    if (access.role === "report_user") return intent !== "verify" && matchesAccessWorkstream(access, workstream, "workstreams") && access.data?.canViewTasks !== false && (intent !== "update" || access.data?.canUpdateTasks !== false);
    if (access.role === "verifier") return matchesAccessWorkstream(access, workstream, "verificationWorkstreams", "workstreams") && (intent !== "verify" || access.data?.canVerify !== false);
    if (access.role === "viewer") return intent === "view" && matchesAccessWorkstream(access, workstream, "workstreams") && access.data?.canViewTasks !== false;
    return false;
  });
}

function taskWorkstream(state: EventPrepState, task: LiveTask) {
  const template = state.taskTemplates.find((item) => item.id === task.templateId);
  return task.workstream || template?.workstream || "General";
}

function matchesAccessWorkstream(access: AreaAccess, workstream: string, primaryKey: "workstreams" | "verificationWorkstreams", fallbackKey?: "workstreams") {
  const normalizedWorkstream = normalizeScopeValue(workstream || "General");
  const primary = access.data?.[primaryKey];
  const fallback = fallbackKey ? access.data?.[fallbackKey] : undefined;
  const list = Array.isArray(primary) ? primary : Array.isArray(fallback) ? fallback : undefined;
  if (!Array.isArray(list)) return true;
  return list.some((item) => normalizeScopeValue(item) === normalizedWorkstream);
}

function normalizeScopeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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
    profiles: (partial.profiles?.length ? partial.profiles : includeDemoData ? seed.profiles : []).map((profile) => ({ ...profile, mustChangePassword: Boolean(profile.mustChangePassword) })),
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
    requestReviews: partial.requestReviews || [],
    reminders: partial.reminders?.length ? partial.reminders : seed.reminders,
    notifications: partial.notifications || [],
    activityLogs: partial.activityLogs || [],
    reportExports: partial.reportExports || [],
    globalOptions: partial.globalOptions?.length ? partial.globalOptions : seed.globalOptions,
    formFields: partial.formFields?.length ? partial.formFields : seed.formFields
  };
}

function fromDbRow<T>(row: Record<string, unknown>, table: string) {
  if (row.data && typeof row.data === "object" && "id" in row.data && !["profiles", "in_app_notifications"].includes(table)) return row.data as T;
  switch (table) {
    case "profiles":
      return {
        id: String(row.id || ""),
        email: String(row.email || ""),
        fullName: String(row.full_name || ""),
        role: row.role,
        status: row.status,
        mustChangePassword: Boolean(row.must_change_password ?? false),
        createdBy: row.created_by ? String(row.created_by) : undefined,
        viewerAccess: row.data && typeof row.data === "object" && "viewerAccess" in row.data ? (row.data as Partial<Profile>).viewerAccess : undefined
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
    case "area_access": {
      const accessData = row.data && typeof row.data === "object" ? row.data as Partial<AreaAccess> : {};
      return {
        id: String(row.id || ""),
        profileId: String(row.profile_id || ""),
        areaId: String(row.area_id || ""),
        role: row.role,
        data: accessData.data || {}
      } as T;
    }
    case "task_templates": {
      const templateData = row.data && typeof row.data === "object" ? row.data as Partial<TaskTemplate> : {};
      return {
        id: String(row.id || ""),
        source: templateData.source,
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
    }
    case "live_tasks": {
      const liveTaskData = row.data && typeof row.data === "object" ? row.data as Partial<LiveTask> : {};
      return {
        id: String(row.id || ""),
        templateId: String(row.template_id || ""),
        areaId: String(row.area_id || ""),
        taskDetails: liveTaskData.taskDetails,
        mainObjective: liveTaskData.mainObjective,
        workstream: liveTaskData.workstream,
        responsibleTeam: liveTaskData.responsibleTeam,
        followUpQuestions: liveTaskData.followUpQuestions,
        requiredEquipment: liveTaskData.requiredEquipment,
        expectedOutput: liveTaskData.expectedOutput,
        testingRequired: liveTaskData.testingRequired,
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
    }
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
    case "task_updates": {
      const updateData = row.data && typeof row.data === "object" ? row.data as Partial<TaskUpdate> : {};
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
        customFields: updateData.customFields || {},
        correctionComment: row.correction_comment ? String(row.correction_comment) : undefined,
        updatedAt: String(row.updated_at || new Date().toISOString())
      } as T;
    }
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
    case "in_app_notifications":
      return {
        id: String(row.id || ""),
        userId: String(row.user_id || ""),
        areaId: row.area_id ? String(row.area_id) : undefined,
        title: String(row.title || ""),
        message: String(row.message || ""),
        type: row.type,
        isRead: Boolean(row.is_read),
        createdAt: String(row.created_at || new Date().toISOString()),
        relatedTaskId: row.related_task_id ? String(row.related_task_id) : undefined,
        relatedRequestId: row.related_request_id ? String(row.related_request_id) : undefined,
        relatedDailyReportId: row.related_daily_report_id ? String(row.related_daily_report_id) : undefined
      } as T;
    case "request_reviews":
      return {
        id: String(row.id || ""),
        requestId: String(row.request_id || ""),
        reviewerId: String(row.reviewer_id || ""),
        comment: String(row.comment || ""),
        recommendation: String(row.recommendation || ""),
        completed: Boolean(row.completed),
        createdAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "reminders":
      return {
        id: String(row.id || ""),
        areaId: row.area_id ? String(row.area_id) : undefined,
        reminderType: String(row.reminder_type || ""),
        deadlineTime: String(row.deadline_time || "").slice(0, 5),
        reminderTime: String(row.reminder_time || "").slice(0, 5),
        escalationTime: String(row.escalation_time || "").slice(0, 5),
        recipients: Array.isArray(row.recipients) ? row.recipients.map(String) : [],
        active: Boolean(row.active ?? true)
      } as T;
    case "activity_logs":
      return {
        id: String(row.id || ""),
        category: String(row.category || ""),
        actorId: row.actor_id ? String(row.actor_id) : undefined,
        action: String(row.action || ""),
        entityType: String(row.entity_type || ""),
        entityId: row.entity_id ? String(row.entity_id) : undefined,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
        createdAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "report_exports":
      return {
        id: String(row.id || ""),
        exportType: String(row.export_type || ""),
        requestedBy: String(row.requested_by || ""),
        areaId: row.area_id ? String(row.area_id) : undefined,
        storagePath: row.storage_path ? String(row.storage_path) : undefined,
        status: (row.status || "generated") as ReportExport["status"],
        createdAt: String(row.created_at || new Date().toISOString())
      } as T;
    case "global_options":
      return { id: String(row.id || ""), group: String(row.option_group || ""), value: String(row.value || ""), active: Boolean(row.active ?? true) } as T;
    case "form_fields": {
      const fieldData = row.data && typeof row.data === "object" ? row.data as Partial<FormField> : {};
      return {
        id: String(row.id || ""),
        taskType: row.task_type,
        fieldKey: String(row.field_key || ""),
        label: String(row.label || ""),
        questionType: fieldData.questionType || "Short answer",
        options: Array.isArray(fieldData.options) ? fieldData.options.map(String) : [],
        globalOptionGroup: fieldData.globalOptionGroup,
        allowOther: Boolean(fieldData.allowOther),
        required: Boolean(row.required),
        visible: Boolean(row.visible ?? true),
        displayOrder: Number(row.display_order || 0)
      } as T;
    }
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
    must_change_password: item.mustChangePassword,
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
    main_objective: item.mainObjective,
    workstream: item.workstream,
    task_details: item.taskDetails,
    responsible_team: item.responsibleTeam,
    follow_up_questions: item.followUpQuestions,
    required_equipment: item.requiredEquipment,
    expected_output: item.expectedOutput,
    testing_required: item.testingRequired,
    hidden_reference: item.hiddenReference || {},
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
    general_remark: item.generalRemark,
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

function requestReviewToDb(item: RequestReview) {
  return {
    id: item.id,
    request_id: item.requestId,
    reviewer_id: item.reviewerId,
    comment: item.comment,
    recommendation: item.recommendation,
    completed: item.completed,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function reminderToDb(item: Reminder) {
  return {
    id: item.id,
    area_id: item.areaId || null,
    reminder_type: item.reminderType,
    deadline_time: item.deadlineTime || null,
    reminder_time: item.reminderTime || null,
    escalation_time: item.escalationTime || null,
    recipients: item.recipients,
    active: item.active,
    data: item,
    updated_at: new Date().toISOString()
  };
}

function notificationToDb(item: InAppNotification) {
  return {
    id: item.id,
    user_id: item.userId,
    area_id: item.areaId || null,
    title: item.title,
    message: item.message,
    type: item.type,
    is_read: item.isRead,
    related_task_id: item.relatedTaskId || null,
    related_request_id: item.relatedRequestId || null,
    related_daily_report_id: item.relatedDailyReportId || null,
    data: item,
    created_at: item.createdAt
  };
}

function activityLogToDb(item: ActivityLog) {
  return {
    id: item.id,
    category: item.category,
    actor_id: item.actorId || null,
    action: item.action,
    entity_type: item.entityType,
    entity_id: item.entityId || null,
    metadata: item.metadata,
    data: item,
    created_at: item.createdAt
  };
}

function reportExportToDb(item: ReportExport) {
  return {
    id: item.id,
    export_type: item.exportType,
    requested_by: item.requestedBy,
    area_id: item.areaId || null,
    storage_path: item.storagePath || null,
    status: item.status,
    data: item,
    created_at: item.createdAt,
    updated_at: new Date().toISOString()
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

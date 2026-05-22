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
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: origin }
  });
  if (error) throw error;
}

export async function loadEventPrepState() {
  if (isEventPrepSupabaseConfigured()) {
    try {
      const db = eventPrepSupabase();
      if (db) {
        const loaded = await loadFromSupabase(db);
        if (loaded.taskTemplates.length || loaded.liveTasks.length || loaded.areas.length) return loaded;
        const seeded = createSeedState();
        await saveEventPrepState(seeded);
        return seeded;
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

export async function saveEventPrepState(state: EventPrepState) {
  saveLocal(state);
  if (!isEventPrepSupabaseConfigured()) return;
  const db = eventPrepSupabase();
  if (!db) return;
  await saveToSupabase(db, state);
}

export async function uploadTaskEvidence(file: File, liveTaskId: string) {
  const db = eventPrepSupabase();
  if (!db) return { storagePath: "", publicUrl: "" };
  const storagePath = `${liveTaskId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await db.storage.from("task-evidence").upload(storagePath, file, { upsert: false });
  if (error) throw error;
  const { data } = db.storage.from("task-evidence").getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}

async function loadFromSupabase(db: SupabaseClient): Promise<EventPrepState> {
  const [
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
    formFields,
    settings
  ] = await Promise.all([
    selectTable<Profile>(db, "profiles"),
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
    selectTable<NotificationLog>(db, "notification_logs"),
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
  });
}

async function selectTable<T>(db: SupabaseClient, table: string) {
  const { data, error } = await db.from(table).select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return ((data || []) as Array<Record<string, unknown>>).map((row) => fromDbRow<T>(row));
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

async function saveToSupabase(db: SupabaseClient, state: EventPrepState) {
  await Promise.all([
    upsertRows(db, "profiles", state.profiles.map(profileToDb)),
    upsertRows(db, "zone_types", state.zoneTypes.map(zoneTypeToDb)),
    upsertRows(db, "areas", state.areas.map(areaToDb)),
    upsertRows(db, "area_access", state.areaAccess.map(areaAccessToDb)),
    upsertRows(db, "task_templates", state.taskTemplates.map(templateToDb)),
    upsertRows(db, "live_tasks", state.liveTasks.map(liveTaskToDb)),
    upsertRows(db, "daily_reports", state.dailyReports.map(reportToDb)),
    upsertRows(db, "task_updates", state.taskUpdates.map(updateToDb)),
    upsertRows(db, "task_files", state.taskFiles.map(fileToDb)),
    upsertRows(db, "verification_logs", state.verificationLogs.map(verificationLogToDb)),
    upsertRows(db, "requests", state.requests.map(requestToDb)),
    upsertRows(db, "notification_logs", state.notificationLogs.map(notificationToDb)),
    upsertRows(db, "global_options", state.globalOptions.map(globalOptionToDb)),
    upsertRows(db, "form_fields", state.formFields.map(formFieldToDb)),
    db.from("event_settings").upsert({
      id: "default",
      event_start_date: state.settings.eventStartDate,
      preparation_start_date: state.settings.preparationStartDate,
      updated_at: new Date().toISOString()
    })
  ]);
}

async function upsertRows(db: SupabaseClient, table: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

function saveLocal(state: EventPrepState) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeWithSeed(partial: Partial<EventPrepState>): EventPrepState {
  const seed = createSeedState();
  return {
    ...seed,
    ...partial,
    settings: { ...seed.settings, ...(partial.settings || {}) },
    profiles: partial.profiles?.length ? partial.profiles : seed.profiles,
    zoneTypes: partial.zoneTypes?.length ? partial.zoneTypes : seed.zoneTypes,
    areas: partial.areas?.length ? partial.areas : seed.areas,
    areaAccess: partial.areaAccess || seed.areaAccess,
    taskTemplates: partial.taskTemplates || seed.taskTemplates,
    liveTasks: partial.liveTasks || seed.liveTasks,
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

function fromDbRow<T>(row: Record<string, unknown>) {
  if (row.data && typeof row.data === "object") return row.data as T;
  return row as T;
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
    due_date: item.dueDate || null,
    priority: item.priority,
    verification_status_seed: item.verificationRequired ? "Not Submitted" : "Verified Completed",
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
    priority: item.priority,
    requested_by: item.requestedBy,
    status: item.status,
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

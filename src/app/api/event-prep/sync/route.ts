import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type {
  ActivityLog,
  Area,
  AreaAccess,
  AreaRequest,
  DailyReport,
  EventPrepState,
  FormField,
  GlobalOption,
  InAppNotification,
  LiveTask,
  Profile,
  Reminder,
  ReportExport,
  RequestReview,
  TaskFile,
  TaskTemplate,
  TaskUpdate,
  VerificationLog,
  ZoneType
} from "@/lib/eventPrepTypes";

export const dynamic = "force-dynamic";

type ServerDb = ReturnType<typeof serverSupabase>;

export async function POST(request: Request) {
  try {
    const db = serverSupabase();
    const actor = await getActorProfile(db, request);
    const body = await request.json() as { state?: EventPrepState };
    if (!body.state) throw new Error("Missing dashboard state to sync.");
    await saveState(db, body.state, actor);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase sync failed.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}

async function saveState(db: ServerDb, state: EventPrepState, actor: Profile) {
  const isAdmin = ["super_admin", "admin"].includes(actor.role);

  if (!isAdmin) {
    const authoritativeScope = await loadAuthoritativeSyncScope(db, actor);
    const scopeState: EventPrepState = {
      ...state,
      areaAccess: authoritativeScope.areaAccess,
      liveTasks: authoritativeScope.liveTasks,
      taskTemplates: authoritativeScope.taskTemplates,
      requestReviews: authoritativeScope.requestReviews
    };
    const reportAreaIds = new Set(authoritativeScope.areaAccess.filter((access) => canSubmitReportsInScope(access, actor)).map((access) => access.areaId));
    const requestAreaIds = new Set(authoritativeScope.areaAccess.filter((access) => canRaiseRequestsInScope(access, actor)).map((access) => access.areaId));
    const allowedTaskIds = scopedTaskIdsForProfile(scopeState, actor, actor.role === "verifier" ? "verify" : "update");
    const reviewRequestIds = new Set(authoritativeScope.requestReviews.filter((review) => review.reviewerId === actor.id).map((review) => review.requestId));
    const writableNotifications = state.notifications.filter((notification) => notification.userId === actor.id);

    await upsertRows(db, "daily_reports", state.dailyReports.filter((report) => reportAreaIds.has(report.areaId)).map(reportToDb));
    await upsertRows(db, "task_updates", state.taskUpdates.filter((update) => allowedTaskIds.has(update.liveTaskId) && (update.updatedBy === actor.id || actor.role === "verifier")).map(updateToDb));
    await upsertRows(db, "task_files", state.taskFiles.filter((file) => allowedTaskIds.has(file.liveTaskId)).map(fileToDb));
    await upsertRows(db, "verification_logs", state.verificationLogs.filter((log) => log.verifierId === actor.id && allowedTaskIds.has(log.liveTaskId)).map(verificationLogToDb));
    await upsertRows(db, "requests", state.requests.filter((request) => (request.requestedBy === actor.id && requestAreaIds.has(request.areaId)) || reviewRequestIds.has(request.id)).map(requestToDb));
    await upsertRows(db, "request_reviews", state.requestReviews.filter((review) => review.reviewerId === actor.id && reviewRequestIds.has(review.requestId)).map(requestReviewToDb));
    await upsertRows(db, "in_app_notifications", writableNotifications.map(notificationToDb));
    return;
  }

  const { error: settingsError } = await db.from("event_settings").upsert({
    id: "default",
    event_start_date: state.settings.eventStartDate,
    preparation_start_date: state.settings.preparationStartDate,
    updated_at: new Date().toISOString()
  });
  if (settingsError) throw new Error(`event_settings: ${settingsError.message}`);

  await upsertRows(db, "requests", state.requests.map(requestToDb));
  await deleteMissingRows(db, "areas", state.areas.map((area) => area.id));
  await deleteMissingRows(db, "area_access", state.areaAccess.map((access) => access.id));
  await deleteMissingRows(db, "live_tasks", state.liveTasks.map((task) => task.id));
  await deleteMissingRows(db, "task_updates", state.taskUpdates.map((update) => update.id));
  await deleteMissingRows(db, "task_files", state.taskFiles.map((file) => file.id));
  await deleteMissingRows(db, "verification_logs", state.verificationLogs.map((log) => log.id));
  await deleteMissingRows(db, "in_app_notifications", state.notifications.map((notification) => notification.id));
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

async function loadAuthoritativeSyncScope(db: ServerDb, actor: Profile) {
  const [areaAccessResult, liveTasksResult, taskTemplatesResult, requestReviewsResult] = await Promise.all([
    db.from("area_access").select("*").eq("profile_id", actor.id),
    db.from("live_tasks").select("*"),
    db.from("task_templates").select("*"),
    db.from("request_reviews").select("*").eq("reviewer_id", actor.id)
  ]);
  if (areaAccessResult.error) throw new Error(`area_access: ${areaAccessResult.error.message}`);
  if (liveTasksResult.error) throw new Error(`live_tasks: ${liveTasksResult.error.message}`);
  if (taskTemplatesResult.error) throw new Error(`task_templates: ${taskTemplatesResult.error.message}`);
  if (requestReviewsResult.error) throw new Error(`request_reviews: ${requestReviewsResult.error.message}`);
  return {
    areaAccess: ((areaAccessResult.data || []) as Array<Record<string, unknown>>).map(areaAccessFromRow),
    liveTasks: ((liveTasksResult.data || []) as Array<Record<string, unknown>>).map(liveTaskFromRow),
    taskTemplates: ((taskTemplatesResult.data || []) as Array<Record<string, unknown>>).map(taskTemplateFromRow),
    requestReviews: ((requestReviewsResult.data || []) as Array<Record<string, unknown>>).map(requestReviewFromRow)
  };
}

function canSubmitReportsInScope(access: AreaAccess, actor: Profile) {
  if (access.profileId !== actor.id) return false;
  return (access.role === "report_user" || access.role === "area_admin") && access.data?.canSubmitReports !== false;
}

function canRaiseRequestsInScope(access: AreaAccess, actor: Profile) {
  if (access.profileId !== actor.id) return false;
  return (access.role === "report_user" || access.role === "area_admin") && access.data?.canRaiseRequests !== false;
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

async function getActorProfile(db: ServerDb, request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing signed-in Supabase session.");
  const authDb = authSupabase();
  const { data, error } = await authDb.auth.getUser(token);
  if (error || !data.user) throw new Error(`Invalid session. ${error?.message || "Please sign out and sign in again."}`);
  const profile = await getProfile(db, data.user.id, data.user.email || "");
  if (!profile) throw new Error("No dashboard profile exists for this login.");
  if (profile.status === "pending_approval") throw new Error("Your profile is pending approval.");
  if (profile.status === "disabled") throw new Error("Your profile is disabled.");
  return profile;
}

async function getProfile(db: ServerDb, id: string, email?: string) {
  let { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data && email) {
    const fallback = await db.from("profiles").select("*").eq("email", email.toLowerCase()).maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (error) throw new Error(error.message);
  }
  return data ? profileFromRow(data as Record<string, unknown>) : null;
}

async function upsertRows(db: ServerDb, table: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function deleteMissingRows(db: ServerDb, table: string, idsToKeep: string[]) {
  const { data, error } = await db.from(table).select("id");
  if (error) throw new Error(`${table}: ${error.message}`);
  const keep = new Set(idsToKeep);
  const staleIds = ((data || []) as Array<{ id: string }>).map((row) => row.id).filter((id) => !keep.has(id));
  for (const staleId of staleIds) {
    const { error: deleteError } = await db.from(table).delete().eq("id", staleId);
    if (deleteError) throw new Error(`${table}: ${deleteError.message}`);
  }
}

function profileFromRow(row: Record<string, unknown>): Profile {
  if (row.data && typeof row.data === "object" && "id" in row.data) {
    const profile = row.data as Profile;
    return { ...profile, status: row.status as Profile["status"], mustChangePassword: Boolean(row.must_change_password ?? profile.mustChangePassword) };
  }
  return {
    id: String(row.id || ""),
    email: String(row.email || ""),
    fullName: String(row.full_name || ""),
    role: row.role as Profile["role"],
    status: row.status as Profile["status"],
    mustChangePassword: Boolean(row.must_change_password),
    createdBy: row.created_by ? String(row.created_by) : undefined
  };
}

function profileToDb(item: Profile) {
  return { id: item.id, email: item.email, full_name: item.fullName, role: item.role, status: item.status, must_change_password: item.mustChangePassword, created_by: item.createdBy || null, data: item, updated_at: new Date().toISOString() };
}

function areaAccessFromRow(row: Record<string, unknown>): AreaAccess {
  const data = row.data && typeof row.data === "object" ? row.data as Partial<AreaAccess> : {};
  return {
    id: String(row.id || data.id || ""),
    profileId: String(row.profile_id || data.profileId || ""),
    areaId: String(row.area_id || data.areaId || ""),
    role: (row.role || data.role) as Profile["role"],
    data: data.data
  };
}

function taskTemplateFromRow(row: Record<string, unknown>): TaskTemplate {
  const data = row.data && typeof row.data === "object" ? row.data as Partial<TaskTemplate> : {};
  return {
    id: String(row.id || data.id || ""),
    source: data.source,
    day: Number(row.prep_day ?? data.day ?? 1),
    priorityLevel: (row.priority_level || data.priorityLevel || "Medium") as TaskTemplate["priorityLevel"],
    mainObjective: String(row.main_objective || data.mainObjective || ""),
    workstream: String(row.workstream || data.workstream || "General"),
    taskDetails: String(row.task_details || data.taskDetails || ""),
    responsibleTeam: String(row.responsible_team || data.responsibleTeam || ""),
    followUpQuestions: String(row.follow_up_questions || data.followUpQuestions || ""),
    requiredEquipment: String(row.required_equipment || data.requiredEquipment || ""),
    expectedOutput: String(row.expected_output || data.expectedOutput || ""),
    testingRequired: String(row.testing_required || data.testingRequired || ""),
    hiddenReference: data.hiddenReference || (row.hidden_reference as TaskTemplate["hiddenReference"]) || {},
    importedAt: String(data.importedAt || row.created_at || row.updated_at || new Date().toISOString())
  };
}

function liveTaskFromRow(row: Record<string, unknown>): LiveTask {
  const data = row.data && typeof row.data === "object" ? row.data as Partial<LiveTask> : {};
  return {
    id: String(row.id || data.id || ""),
    templateId: String(row.template_id || data.templateId || ""),
    areaId: String(row.area_id || data.areaId || ""),
    taskDetails: data.taskDetails,
    mainObjective: data.mainObjective,
    workstream: data.workstream,
    responsibleTeam: data.responsibleTeam,
    followUpQuestions: data.followUpQuestions,
    requiredEquipment: data.requiredEquipment,
    expectedOutput: data.expectedOutput,
    testingRequired: data.testingRequired,
    taskType: (row.task_type || data.taskType || "Simple Task") as LiveTask["taskType"],
    prepDay: Number(row.prep_day ?? data.prepDay ?? 1),
    startDate: String(row.start_date || data.startDate || ""),
    dueDate: String(row.due_date || data.dueDate || ""),
    actualCompletionDate: data.actualCompletionDate || (row.actual_completion_date ? String(row.actual_completion_date) : undefined),
    priority: (row.priority || data.priority || "Medium") as LiveTask["priority"],
    requiredQuantity: row.required_quantity === null || row.required_quantity === undefined ? data.requiredQuantity : Number(row.required_quantity),
    unit: String(row.unit || data.unit || ""),
    assignedProfileIds: Array.isArray(row.assigned_profile_ids) ? row.assigned_profile_ids.map(String) : data.assignedProfileIds || [],
    assignedVerifierIds: Array.isArray(row.assigned_verifier_ids) ? row.assigned_verifier_ids.map(String) : data.assignedVerifierIds || [],
    verificationRequired: Boolean(row.verification_required ?? data.verificationRequired),
    verificationRule: (row.verification_rule || data.verificationRule || "one_verifier") as LiveTask["verificationRule"],
    evidenceNote: data.evidenceNote || (row.evidence_note ? String(row.evidence_note) : undefined),
    active: Boolean(row.active ?? data.active ?? true),
    notApplicable: Boolean(row.not_applicable ?? data.notApplicable),
    delayReason: data.delayReason || (row.delay_reason ? String(row.delay_reason) : undefined),
    revisedDueDate: data.revisedDueDate || (row.revised_due_date ? String(row.revised_due_date) : undefined)
  };
}

function requestReviewFromRow(row: Record<string, unknown>): RequestReview {
  const data = row.data && typeof row.data === "object" ? row.data as Partial<RequestReview> : {};
  return {
    id: String(row.id || data.id || ""),
    requestId: String(row.request_id || data.requestId || ""),
    reviewerId: String(row.reviewer_id || data.reviewerId || ""),
    comment: String(row.comment || data.comment || ""),
    recommendation: String(row.recommendation || data.recommendation || ""),
    completed: Boolean(row.completed ?? data.completed),
    createdAt: String(row.created_at || data.createdAt || row.updated_at || new Date().toISOString())
  };
}

function zoneTypeToDb(item: ZoneType) {
  return { id: item.id, name: item.name, display_order: item.displayOrder, data: item, updated_at: new Date().toISOString() };
}

function areaToDb(item: Area) {
  return { id: item.id, zone_type_id: item.zoneTypeId, name: item.name, code: item.code, active: item.active, daily_deadline: item.dailyDeadline, reminder_time: item.reminderTime, escalation_time: item.escalationTime, data: item, updated_at: new Date().toISOString() };
}

function areaAccessToDb(item: AreaAccess) {
  return { id: item.id, profile_id: item.profileId, area_id: item.areaId, role: item.role, data: item, updated_at: new Date().toISOString() };
}

function templateToDb(item: TaskTemplate) {
  return { id: item.id, prep_day: item.day, priority_level: item.priorityLevel, main_objective: item.mainObjective, workstream: item.workstream, task_details: item.taskDetails, responsible_team: item.responsibleTeam, follow_up_questions: item.followUpQuestions, required_equipment: item.requiredEquipment, expected_output: item.expectedOutput, testing_required: item.testingRequired, hidden_reference: item.hiddenReference || {}, data: item, updated_at: new Date().toISOString() };
}

function liveTaskToDb(item: LiveTask) {
  return { id: item.id, template_id: item.templateId, area_id: item.areaId, task_type: item.taskType, prep_day: item.prepDay, start_date: item.startDate || null, due_date: item.dueDate || null, actual_completion_date: item.actualCompletionDate || null, priority: item.priority, required_quantity: item.requiredQuantity ?? null, unit: item.unit || null, assigned_profile_ids: item.assignedProfileIds, assigned_verifier_ids: item.assignedVerifierIds, verification_required: item.verificationRequired, verification_rule: item.verificationRule, evidence_note: item.evidenceNote || null, active: item.active, not_applicable: item.notApplicable, delay_reason: item.delayReason || null, revised_due_date: item.revisedDueDate || null, data: item, updated_at: new Date().toISOString() };
}

function reportToDb(item: DailyReport) {
  return { id: item.id, area_id: item.areaId, report_date: item.reportDate, prep_day: item.prepDay, status: item.status, general_remark: item.generalRemark, submitted_by: item.submittedBy || null, submitted_at: item.submittedAt || null, data: item, updated_at: new Date().toISOString() };
}

function updateToDb(item: TaskUpdate) {
  return { id: item.id, live_task_id: item.liveTaskId, daily_report_id: item.dailyReportId, updated_by: item.updatedBy, status: item.status, verification_status: item.verificationStatus, remarks: item.remarks, completed_quantity: item.completedQuantity ?? null, user_role_standing: item.userRoleStanding, escalation_points: item.escalationPoints, supporting_personnel: item.supportingPersonnel, correction_comment: item.correctionComment || null, data: item, updated_at: new Date().toISOString() };
}

function fileToDb(item: TaskFile) {
  return { id: item.id, live_task_id: item.liveTaskId, task_update_id: item.taskUpdateId, file_name: item.fileName, file_type: item.fileType, file_size: item.fileSize, storage_path: item.storagePath || null, review_locked: item.reviewLocked, data: item, updated_at: new Date().toISOString() };
}

function verificationLogToDb(item: VerificationLog) {
  return { id: item.id, live_task_id: item.liveTaskId, task_update_id: item.taskUpdateId, verifier_id: item.verifierId, action: item.action, comment: item.comment, data: item, created_at: item.createdAt };
}

function requestToDb(item: AreaRequest) {
  return { id: item.id, request_type: item.requestType, area_id: item.areaId, related_live_task_id: item.relatedLiveTaskId || null, title: item.title, details: item.details, quantity_requested: item.quantityRequested ?? null, priority: item.priority, required_by_date: item.requiredByDate || null, attachment_name: item.attachmentName || null, requested_by: item.requestedBy, status: item.status, decision_remarks: item.decisionRemarks || null, data: item, updated_at: new Date().toISOString() };
}

function requestReviewToDb(item: RequestReview) {
  return { id: item.id, request_id: item.requestId, reviewer_id: item.reviewerId, comment: item.comment, recommendation: item.recommendation, completed: item.completed, data: item, updated_at: new Date().toISOString() };
}

function reminderToDb(item: Reminder) {
  return { id: item.id, area_id: item.areaId || null, reminder_type: item.reminderType, deadline_time: item.deadlineTime || null, reminder_time: item.reminderTime || null, escalation_time: item.escalationTime || null, recipients: item.recipients, active: item.active, data: item, updated_at: new Date().toISOString() };
}

function notificationToDb(item: InAppNotification) {
  return { id: item.id, user_id: item.userId, area_id: item.areaId || null, title: item.title, message: item.message, type: item.type, is_read: item.isRead, related_task_id: item.relatedTaskId || null, related_request_id: item.relatedRequestId || null, related_daily_report_id: item.relatedDailyReportId || null, data: item, created_at: item.createdAt };
}

function activityLogToDb(item: ActivityLog) {
  return { id: item.id, category: item.category, actor_id: item.actorId || null, action: item.action, entity_type: item.entityType, entity_id: item.entityId || null, metadata: item.metadata, data: item, created_at: item.createdAt };
}

function reportExportToDb(item: ReportExport) {
  return { id: item.id, export_type: item.exportType, requested_by: item.requestedBy, area_id: item.areaId || null, storage_path: item.storagePath || null, status: item.status, data: item, created_at: item.createdAt, updated_at: new Date().toISOString() };
}

function globalOptionToDb(item: GlobalOption) {
  return { id: item.id, option_group: item.group, value: item.value, active: item.active, data: item, updated_at: new Date().toISOString() };
}

function formFieldToDb(item: FormField) {
  return { id: item.id, task_type: item.taskType, field_key: item.fieldKey, label: item.label, required: item.required, visible: item.visible, display_order: item.displayOrder, data: item, updated_at: new Date().toISOString() };
}

function serverSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server Supabase URL or service role key is missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function authSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Public Supabase auth environment variables are missing on the server.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

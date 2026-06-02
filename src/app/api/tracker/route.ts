import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TrackerTask } from "@/lib/asharaTrackerData";
import type { Profile } from "@/lib/eventPrepTypes";
import type { SharedChartConfig, SharedTrackerActivity, SharedTrackerContact, SharedTrackerEquipment, SharedTrackerState } from "@/lib/sharedTrackerStore";

export const dynamic = "force-dynamic";

const CHART_CONFIG_ID = "global-dashboard-config";

type PayloadRow<T> = {
  id: string;
  data: T;
};
type TrackerDbClient = ReturnType<typeof serverSupabase>;

type TrackerAction =
  | { action: "seed"; state: SharedTrackerState<SharedTrackerContact, SharedTrackerActivity> }
  | { action: "upsertTasks"; tasks: TrackerTask[] }
  | { action: "replaceTasks"; tasks: TrackerTask[] }
  | { action: "deleteTask"; taskId: string }
  | { action: "deleteContact"; contactId: string }
  | { action: "upsertEquipment"; equipment: SharedTrackerEquipment[] }
  | { action: "deleteEquipment"; equipmentId: string }
  | { action: "upsertCities"; cities: string[] }
  | { action: "upsertContacts"; contacts: SharedTrackerContact[] }
  | { action: "upsertActivity"; activity: SharedTrackerActivity[] }
  | { action: "saveChartConfig"; chartConfig: SharedChartConfig };

export async function GET(request: Request) {
  try {
    const db = serverSupabase();
    await requireTrackerAdmin(db, request);
    const state = await loadState(db);
    return NextResponse.json(state, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = serverSupabase();
    await requireTrackerAdmin(db, request);
    const body = await request.json() as TrackerAction;
    switch (body.action) {
      case "seed":
        await Promise.all([
          upsertTasks(db, body.state.tasks),
          upsertCities(db, body.state.cities),
          upsertContacts(db, body.state.contacts),
          upsertActivity(db, body.state.activity),
          saveChartConfig(db, body.state.chartConfig),
          upsertEquipment(db, body.state.equipment)
        ]);
        break;
      case "upsertTasks":
        await upsertTasks(db, body.tasks);
        break;
      case "replaceTasks":
        await replaceTasks(db, body.tasks);
        break;
      case "deleteTask":
        await deleteTask(db, body.taskId);
        break;
      case "deleteContact":
        await deleteContact(db, body.contactId);
        break;
      case "upsertEquipment":
        await upsertEquipment(db, body.equipment);
        break;
      case "deleteEquipment":
        await deleteEquipment(db, body.equipmentId);
        break;
      case "upsertCities":
        await upsertCities(db, body.cities);
        break;
      case "upsertContacts":
        await upsertContacts(db, body.contacts);
        break;
      case "upsertActivity":
        await upsertActivity(db, body.activity);
        break;
      case "saveChartConfig":
        await saveChartConfig(db, body.chartConfig);
        break;
      default:
        return NextResponse.json({ error: "Unsupported tracker action." }, { status: 400, headers: noStoreHeaders() });
    }
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

function serverSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server Supabase URL or service role key is missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function authSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw secureError("Supabase auth environment variables are missing.", 500);
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireTrackerAdmin(db: TrackerDbClient, request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw secureError("Missing signed-in Supabase session.", 401);
  const { data, error } = await authSupabase().auth.getUser(token);
  if (error || !data.user) throw secureError("Invalid session.", 401);
  const profile = await getProfile(db, data.user.id, data.user.email || "");
  if (!profile || profile.status !== "active") throw secureError("Tracker access denied.", 403);
  if (!["super_admin", "admin"].includes(profile.role)) throw secureError("Tracker access is admin-only.", 403);
}

async function getProfile(db: TrackerDbClient, id: string, email?: string) {
  let { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error, "Unable to load profile."));
  if (!data && email) {
    const fallback = await db.from("profiles").select("*").eq("email", email.toLowerCase()).maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (error) throw new Error(formatSupabaseError(error, "Unable to load profile."));
  }
  return data ? profileFromRow(data as Record<string, unknown>) : null;
}

function profileFromRow(row: Record<string, unknown>): Profile {
  if (row.data && typeof row.data === "object" && "id" in row.data) {
    const profile = row.data as Profile;
    return {
      ...profile,
      status: row.status as Profile["status"],
      mustChangePassword: Boolean(row.must_change_password ?? profile.mustChangePassword)
    };
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

async function loadState(db: TrackerDbClient): Promise<SharedTrackerState<SharedTrackerContact, SharedTrackerActivity>> {
  const [tasks, cities, contacts, activity, chartConfig, equipment] = await Promise.all([
    loadPayloadTable<TrackerTask>(db, "ashara_tasks", "city", true),
    loadPayloadTable<{ name: string }>(db, "ashara_cities", "name", true),
    loadPayloadTable<SharedTrackerContact>(db, "ashara_contacts", "city", true),
    loadPayloadTable<SharedTrackerActivity>(db, "ashara_activity", "occurred_at", false, 500),
    loadSinglePayload<SharedChartConfig>(db, "ashara_chart_configs", CHART_CONFIG_ID),
    loadPayloadTable<SharedTrackerEquipment>(db, "ashara_equipment", "updated_at", false)
  ]);
  return {
    tasks,
    cities: cities.map((city) => city.name).filter(Boolean),
    contacts,
    activity,
    chartConfig: chartConfig || { hiddenChartIds: {}, chartOrder: {}, customCharts: {} },
    equipment
  };
}

async function upsertTasks(db: TrackerDbClient, tasks: TrackerTask[]) {
  if (!tasks.length) return;
  const { error } = await db.from("ashara_tasks").upsert(
    tasks.map((task) => ({
      id: task.id,
      city: task.city,
      workstream: task.workstream,
      area: task.zoneArea,
      task_name: task.taskName,
      data: task,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save tasks."));
}

async function replaceTasks(db: TrackerDbClient, tasks: TrackerTask[]) {
  const { error } = await db.from("ashara_tasks").delete().neq("id", "__never__");
  if (error) throw new Error(formatSupabaseError(error, "Unable to replace tasks."));
  await upsertTasks(db, tasks);
}

async function deleteTask(db: TrackerDbClient, taskId: string) {
  const { error } = await db.from("ashara_tasks").delete().eq("id", taskId);
  if (error) throw new Error(formatSupabaseError(error, "Unable to delete task."));
}

async function deleteContact(db: TrackerDbClient, contactId: string) {
  const { error } = await db.from("ashara_contacts").delete().eq("id", contactId);
  if (error) throw new Error(formatSupabaseError(error, "Unable to delete contact."));
}

async function upsertEquipment(db: TrackerDbClient, equipment: SharedTrackerEquipment[]) {
  if (!equipment.length) return;
  const { error } = await db.from("ashara_equipment").upsert(
    equipment.map((item) => ({
      id: String(item.id || `equipment-${Date.now()}`),
      workstream: String(item.workstream || ""),
      category: String(item.category || ""),
      equipment_name: String(item.name || item.equipmentName || ""),
      data: item,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save equipment."));
}

async function deleteEquipment(db: TrackerDbClient, equipmentId: string) {
  const { error } = await db.from("ashara_equipment").delete().eq("id", equipmentId);
  if (error) throw new Error(formatSupabaseError(error, "Unable to delete equipment."));
}

async function upsertCities(db: TrackerDbClient, cities: string[]) {
  if (!cities.length) return;
  const { error } = await db.from("ashara_cities").upsert(
    cities.map((name, index) => ({
      id: slugId(name),
      name,
      data: { name, displayOrder: index },
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save cities."));
}

async function upsertContacts(db: TrackerDbClient, contacts: SharedTrackerContact[]) {
  if (!contacts.length) return;
  const { error } = await db.from("ashara_contacts").upsert(
    contacts.map((contact) => ({
      id: contact.id,
      city: contact.city || "",
      name: contact.name || "",
      data: contact,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save contacts."));
}

async function upsertActivity(db: TrackerDbClient, activity: SharedTrackerActivity[]) {
  if (!activity.length) return;
  const { error } = await db.from("ashara_activity").upsert(
    activity.map((entry) => ({
      id: entry.id,
      occurred_at: entry.at || new Date().toISOString(),
      action: entry.action || "",
      item: entry.item || "",
      user_name: entry.user || "Unknown user",
      data: entry,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save activity."));
}

async function saveChartConfig(db: TrackerDbClient, chartConfig: SharedChartConfig) {
  const { error } = await db.from("ashara_chart_configs").upsert(
    { id: CHART_CONFIG_ID, data: chartConfig, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save chart settings."));
}

async function loadPayloadTable<T>(db: TrackerDbClient, table: string, orderColumn: string, ascending: boolean, limit?: number) {
  let query = db.from(table).select("id,data").order(orderColumn, { ascending });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error, `Unable to load ${table}.`));
  return ((data || []) as Array<PayloadRow<T>>).map((row) => row.data).filter(Boolean);
}

async function loadSinglePayload<T>(db: TrackerDbClient, table: string, id: string) {
  const { data, error } = await db.from(table).select("id,data").eq("id", id).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error, `Unable to load ${table}.`));
  return (data as PayloadRow<T> | null)?.data || null;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Tracker database request failed.";
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
}

function secureError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

function slugId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

function formatSupabaseError(error: { message?: string; details?: string; hint?: string; code?: string }, fallback: string) {
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ") || fallback;
}

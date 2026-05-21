import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { TrackerTask } from "@/lib/asharaTrackerData";

export type SharedChartConfig = {
  hiddenChartIds: Record<string, string[]>;
  chartOrder: Record<string, string[]>;
  customCharts: Record<string, unknown[]>;
};

export type SharedTrackerContact = {
  id: string;
  city?: string;
  name?: string;
};

export type SharedTrackerActivity = {
  id: string;
  at?: string;
  action?: string;
  item?: string;
  user?: string;
};

export type SharedTrackerState<Contact extends SharedTrackerContact, ActivityEntry extends SharedTrackerActivity> = {
  tasks: TrackerTask[];
  cities: string[];
  contacts: Contact[];
  activity: ActivityEntry[];
  chartConfig: SharedChartConfig;
  equipment: Array<Record<string, unknown>>;
};

type PayloadRow<T> = {
  id: string;
  data: T;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CHART_CONFIG_ID = "global-dashboard-config";
let client: SupabaseClient | null = null;

export function isSharedDatabaseConfigured() {
  return typeof window !== "undefined" || Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function supabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_KEY as string, {
      realtime: { params: { eventsPerSecond: 5 } }
    });
  }
  return client;
}

export function currentSharedUser() {
  return process.env.NEXT_PUBLIC_TRACKER_USER_NAME || "Unknown user";
}

export async function loadSharedTrackerState<Contact extends SharedTrackerContact, ActivityEntry extends SharedTrackerActivity>(): Promise<SharedTrackerState<Contact, ActivityEntry> | null> {
  if (typeof window !== "undefined") {
    try {
      return await trackerApiRequest<SharedTrackerState<Contact, ActivityEntry>>();
    } catch {
      // Fall through to direct Supabase client if public realtime variables are available.
    }
  }
  const db = supabase();
  if (!db) return null;
  const [tasks, cities, contacts, activity, chartConfig, equipment] = await Promise.all([
    loadPayloadTable<TrackerTask>(db, "ashara_tasks", "city", true),
    loadPayloadTable<{ name: string }>(db, "ashara_cities", "name", true),
    loadPayloadTable<Contact>(db, "ashara_contacts", "city", true),
    loadPayloadTable<ActivityEntry>(db, "ashara_activity", "occurred_at", false, 500),
    loadSinglePayload<SharedChartConfig>(db, "ashara_chart_configs", CHART_CONFIG_ID),
    loadPayloadTable<Record<string, unknown>>(db, "ashara_equipment", "updated_at", false)
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

export async function seedSharedTrackerState<Contact extends SharedTrackerContact, ActivityEntry extends SharedTrackerActivity>(state: SharedTrackerState<Contact, ActivityEntry>) {
  if (await trackerApiMutation({ action: "seed", state })) return;
  await Promise.all([
    upsertSharedTasks(state.tasks),
    upsertSharedCities(state.cities),
    upsertSharedContacts(state.contacts),
    upsertSharedActivity(state.activity),
    saveSharedChartConfig(state.chartConfig)
  ]);
}

export async function upsertSharedTask(task: TrackerTask) {
  await upsertSharedTasks([task]);
}

export async function upsertSharedTasks(tasks: TrackerTask[]) {
  if (!tasks.length) return;
  if (await trackerApiMutation({ action: "upsertTasks", tasks })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
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
  if (error) throw error;
}

export async function replaceSharedTasks(tasks: TrackerTask[]) {
  if (await trackerApiMutation({ action: "replaceTasks", tasks })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
  const { error: deleteError } = await db.from("ashara_tasks").delete().neq("id", "__never__");
  if (deleteError) throw deleteError;
  await upsertSharedTasks(tasks);
}

export async function deleteSharedTask(taskId: string) {
  if (await trackerApiMutation({ action: "deleteTask", taskId })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
  const { error } = await db.from("ashara_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function deleteSharedContact(contactId: string) {
  if (await trackerApiMutation({ action: "deleteContact", contactId })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
  const { error } = await db.from("ashara_contacts").delete().eq("id", contactId);
  if (error) throw error;
}

export async function upsertSharedCities(cities: string[]) {
  if (!cities.length) return;
  if (await trackerApiMutation({ action: "upsertCities", cities })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
  const { error } = await db.from("ashara_cities").upsert(
    cities.map((name, index) => ({
      id: slugId(name),
      name,
      data: { name, displayOrder: index },
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function upsertSharedContact<Contact extends SharedTrackerContact>(contact: Contact) {
  await upsertSharedContacts([contact]);
}

export async function upsertSharedContacts<Contact extends SharedTrackerContact>(contacts: Contact[]) {
  if (!contacts.length) return;
  if (await trackerApiMutation({ action: "upsertContacts", contacts })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
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
  if (error) throw error;
}

export async function upsertSharedActivity<ActivityEntry extends SharedTrackerActivity>(activity: ActivityEntry[]) {
  if (!activity.length) return;
  if (await trackerApiMutation({ action: "upsertActivity", activity })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
  const { error } = await db.from("ashara_activity").upsert(
    activity.map((entry) => ({
      id: entry.id,
      occurred_at: entry.at || new Date().toISOString(),
      action: entry.action || "",
      item: entry.item || "",
      user_name: entry.user || currentSharedUser(),
      data: entry,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function saveSharedChartConfig(config: SharedChartConfig) {
  if (await trackerApiMutation({ action: "saveChartConfig", chartConfig: config })) return;
  const db = supabase();
  if (!db) throw new Error("Shared database is not configured.");
  const { error } = await db.from("ashara_chart_configs").upsert(
    { id: CHART_CONFIG_ID, data: config, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw new Error(formatSupabaseError(error, "Unable to save chart settings."));
}

export function subscribeToSharedTrackerChanges(onChange: () => void) {
  const db = supabase();
  if (!db) return () => undefined;
  let timer: number | null = null;
  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 400);
  };
  const channel = db.channel("ashara-tracker-shared-sync") as RealtimeChannel;
  ["ashara_tasks", "ashara_cities", "ashara_contacts", "ashara_activity", "ashara_chart_configs", "ashara_equipment"].forEach((table) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
  });
  channel.subscribe();
  return () => {
    if (timer) window.clearTimeout(timer);
    db.removeChannel(channel);
  };
}

async function loadPayloadTable<T>(db: SupabaseClient, table: string, orderColumn: string, ascending: boolean, limit?: number) {
  let query = db.from(table).select("id,data").order(orderColumn, { ascending });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error, `Unable to load ${table}.`));
  return ((data || []) as Array<PayloadRow<T>>).map((row) => row.data).filter(Boolean);
}

async function loadSinglePayload<T>(db: SupabaseClient, table: string, id: string) {
  const { data, error } = await db.from(table).select("id,data").eq("id", id).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error, `Unable to load ${table}.`));
  return (data as PayloadRow<T> | null)?.data || null;
}

async function trackerApiRequest<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/tracker", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((data as { error?: string }).error || "Tracker API request failed."));
  return data as T;
}

async function trackerApiMutation(body: unknown) {
  if (typeof window === "undefined") return false;
  try {
    await trackerApiRequest<{ ok: boolean }>(body);
    return true;
  } catch (error) {
    if (supabase()) return false;
    throw error;
  }
}

function slugId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

function formatSupabaseError(error: { message?: string; details?: string; hint?: string; code?: string }, fallback: string) {
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ") || fallback;
}

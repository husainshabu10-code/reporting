import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AreaRequest, InAppNotification } from "@/lib/eventPrepTypes";

export const dynamic = "force-dynamic";

type AccessRequestBody = {
  name?: string;
  loginId?: string;
  post?: string;
  phone?: string;
  areaIds?: string[];
  notes?: string;
};

export async function GET() {
  try {
    const db = serverSupabase();
    const [{ data: areas, error: areaError }, { data: zones, error: zoneError }] = await Promise.all([
      db.from("areas").select("id,name,zone_type_id,active").eq("active", true).order("name"),
      db.from("zone_types").select("id,name")
    ]);
    if (areaError) throw areaError;
    if (zoneError) throw zoneError;
    const zoneNameById = new Map((zones || []).map((zone) => [String(zone.id), String(zone.name)]));
    return NextResponse.json({
      areas: (areas || []).map((area) => ({
        id: String(area.id),
        name: String(area.name),
        zoneName: zoneNameById.get(String(area.zone_type_id)) || "Area"
      }))
    }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load access request options.";
    return NextResponse.json({ error: message, areas: [] }, { status: 400, headers: noStoreHeaders() });
  }
}

export async function POST(request: Request) {
  try {
    const db = serverSupabase();
    const body = await request.json() as AccessRequestBody;
    const name = clean(body.name);
    const loginId = clean(body.loginId).toLowerCase();
    const post = clean(body.post);
    const phone = clean(body.phone);
    const notes = clean(body.notes);
    const areaIds = Array.from(new Set((body.areaIds || []).map(clean).filter(Boolean)));
    if (!name) throw new Error("Name is required.");
    if (!loginId) throw new Error("Login ID / Email is required.");
    if (!post) throw new Error("Post is required.");
    if (!phone) throw new Error("Phone number is required.");
    if (!areaIds.length) throw new Error("Select at least one area.");

    const { data: areas, error: areaError } = await db.from("areas").select("id,name").in("id", areaIds);
    if (areaError) throw areaError;
    const areaNameById = new Map((areas || []).map((area) => [String(area.id), String(area.name)]));
    const createdAt = new Date().toISOString();
    const existingProfile = await db.from("profiles").select("id").eq("email", loginId).maybeSingle();
    if (existingProfile.error) throw existingProfile.error;
    const requestedBy = existingProfile.data?.id ? String(existingProfile.data.id) : `access-profile-${slug(loginId || name)}`;
    if (!existingProfile.data) {
      const { error: profileError } = await db.from("profiles").insert({
        id: requestedBy,
        email: loginId,
        full_name: name,
        role: "report_user",
        status: "pending_approval",
        must_change_password: true,
        created_by: "public-access-request",
        data: {
          id: requestedBy,
          email: loginId,
          fullName: name,
          role: "report_user",
          status: "pending_approval",
          mustChangePassword: true,
          createdBy: "public-access-request",
          accessRequest: { post, phone, notes, areaIds }
        },
        updated_at: createdAt
      });
      if (profileError) throw profileError;
    }
    const details = [
      `Name: ${name}`,
      `Post: ${post}`,
      `Login ID / Email: ${loginId}`,
      `Phone: ${phone}`,
      `Areas requested: ${areaIds.map((areaId) => areaNameById.get(areaId) || areaId).join(", ")}`,
      `Notes: ${notes || "-"}`
    ].join("\n");
    const rows: AreaRequest[] = areaIds.map((areaId) => ({
      id: `access-${Date.now()}-${slug(areaId)}-${Math.random().toString(36).slice(2, 7)}`,
      requestType: "Access Request",
      areaId,
      title: `Access request - ${name}`,
      details,
      priority: "Medium",
      requiredByDate: createdAt.slice(0, 10),
      requestedBy,
      status: "Under Review",
      createdAt
    }));
    const { error: insertError } = await db.from("requests").insert(rows.map(requestToDb));
    if (insertError) throw insertError;

    const { data: admins } = await db.from("profiles").select("id").in("role", ["super_admin", "admin"]).eq("status", "active");
    const notifications: InAppNotification[] = (admins || []).flatMap((admin) =>
      rows.map((row) => ({
        id: `notification-${row.id}-${admin.id}`,
        userId: String(admin.id),
        areaId: row.areaId,
        title: "New access request",
        message: `${name} requested access for ${areaNameById.get(row.areaId) || "an area"}.`,
        type: "Access request approved/rejected",
        isRead: false,
        createdAt,
        relatedRequestId: row.id
      }))
    );
    if (notifications.length) {
      await db.from("in_app_notifications").insert(notifications.map(notificationToDb));
    }

    return NextResponse.json({ ok: true, count: rows.length }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit access request.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
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

function serverSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server Supabase URL or service role key is missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function clean(value?: string) {
  return String(value || "").trim();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "request";
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

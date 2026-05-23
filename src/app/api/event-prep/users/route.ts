import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/eventPrepTypes";

export const dynamic = "force-dynamic";

type ActionBody =
  | { action: "createUser"; fullName: string; email: string; role: UserRole; areaId: string; password?: string }
  | { action: "approveUser"; profileId: string }
  | { action: "resetPassword"; profileId: string }
  | { action: "changePassword"; password: string };

type ServerDb = ReturnType<typeof serverSupabase>;

export async function POST(request: Request) {
  try {
    const db = serverSupabase();
    const actor = await getActorProfile(db, request);
    const body = (await request.json()) as ActionBody;

    switch (body.action) {
      case "createUser":
        return NextResponse.json(await createUser(db, actor, body), { headers: noStoreHeaders() });
      case "approveUser":
        return NextResponse.json(await approveUser(db, actor, body.profileId), { headers: noStoreHeaders() });
      case "resetPassword":
        return NextResponse.json(await resetPassword(db, actor, body.profileId), { headers: noStoreHeaders() });
      case "changePassword":
        return NextResponse.json(await changePassword(db, actor, body.password), { headers: noStoreHeaders() });
      default:
        return NextResponse.json({ error: "Unsupported credential action." }, { status: 400, headers: noStoreHeaders() });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credential action failed.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}

async function createUser(db: ServerDb, actor: Profile & { authUserId?: string }, body: Extract<ActionBody, { action: "createUser" }>) {
  const isAdmin = ["super_admin", "admin"].includes(actor.role);
  const isAreaAdmin = actor.role === "area_admin";
  if (!isAdmin && !isAreaAdmin) throw new Error("Only Admin or Area Admin can create user credentials.");
  if (!body.fullName?.trim() || !body.email?.trim() || !body.areaId) throw new Error("Full name, login ID, and area are required.");
  if (isAreaAdmin && body.role !== "report_user") throw new Error("Area Admin can create Report User credentials only.");
  if (isAreaAdmin && !(await canManageArea(db, actor.id, body.areaId))) throw new Error("Area Admin can only create users for assigned areas.");

  const email = body.email.trim().toLowerCase();
  const temporaryPassword = body.password?.trim() || generateTemporaryPassword();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: body.fullName.trim() }
  });
  if (error || !data.user) throw new Error(error?.message || "Unable to create Supabase auth user.");

  const role = isAreaAdmin ? "report_user" : body.role;
  const profile: Profile = {
    id: data.user.id,
    email,
    fullName: body.fullName.trim(),
    role,
    status: isAreaAdmin ? "pending_approval" : "active",
    mustChangePassword: true,
    createdBy: actor.id
  };
  await upsertProfile(db, profile);
  await upsertAreaAccess(db, profile.id, body.areaId, role);
  await createInAppNotification(db, profile.id, body.areaId, "Access request approved/rejected", "Credentials created", "Your login credentials have been created. Change your temporary password after first login.");
  return { profile, temporaryPassword };
}

async function approveUser(db: ServerDb, actor: Profile & { authUserId?: string }, profileId: string) {
  const target = await getProfile(db, profileId);
  if (!target) throw new Error("Profile not found.");
  const isAdmin = ["super_admin", "admin"].includes(actor.role);
  const isVerifier = actor.role === "verifier";
  if (!isAdmin && !isVerifier) throw new Error("Only Admin or assigned Verifier can approve users.");
  if (isVerifier && !(await hasSharedManagedArea(db, actor.id, target.id))) throw new Error("Verifier can approve users only in assigned areas.");
  const profile = { ...target, status: "active" as const };
  await upsertProfile(db, profile);
  await createInAppNotification(db, profile.id, undefined, "Access request approved/rejected", "Access approved", "Your dashboard access is active. Use your existing temporary password and change it after login.");
  return { profile };
}

async function resetPassword(db: ServerDb, actor: Profile & { authUserId?: string }, profileId: string) {
  if (!["super_admin", "admin"].includes(actor.role)) throw new Error("Only Admin can reset passwords.");
  const target = await getProfile(db, profileId);
  if (!target) throw new Error("Profile not found.");
  const temporaryPassword = generateTemporaryPassword();
  const authUserId = await resolveAuthUserId(db, target);
  const { error } = await db.auth.admin.updateUserById(authUserId, { password: temporaryPassword });
  if (error) throw new Error(error.message);
  const profile = { ...target, mustChangePassword: true };
  await upsertProfile(db, profile);
  await createInAppNotification(db, profile.id, undefined, "Access request approved/rejected", "Password reset", "An admin generated a new temporary password for your account.");
  return { profile, temporaryPassword };
}

async function changePassword(db: ServerDb, actor: Profile & { authUserId?: string }, password: string) {
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");
  const { error } = await db.auth.admin.updateUserById(actor.authUserId || actor.id, { password });
  if (error) throw new Error(error.message);
  const profile = { ...actor, mustChangePassword: false };
  await upsertProfile(db, profile);
  return { profile };
}

async function getActorProfile(db: ServerDb, request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing signed-in session.");
  const authDb = authSupabase();
  const { data, error } = await authDb.auth.getUser(token);
  if (error || !data.user) throw new Error(`Invalid session. ${error?.message || "Please sign out and sign in again."}`);
  const profile = await getProfile(db, data.user.id, data.user.email || "");
  if (!profile) throw new Error("No active dashboard profile exists for this login.");
  if (profile.status === "pending_approval") throw new Error("Your profile is pending approval.");
  if (profile.status === "disabled") throw new Error("Your profile is disabled.");
  return { ...profile, authUserId: data.user.id };
}

async function getProfile(db: ServerDb, id: string, email?: string) {
  let query = db.from("profiles").select("*").eq("id", id).maybeSingle();
  let { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data && email) {
    const fallback = await db.from("profiles").select("*").eq("email", email.toLowerCase()).maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (error) throw new Error(error.message);
  }
  return data ? profileFromRow(data as Record<string, unknown>) : null;
}

async function canManageArea(db: ServerDb, profileId: string, areaId: string) {
  const { data, error } = await db
    .from("area_access")
    .select("id")
    .eq("profile_id", profileId)
    .eq("area_id", areaId)
    .in("role", ["area_admin", "verifier"])
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function hasSharedManagedArea(db: ServerDb, verifierId: string, targetProfileId: string) {
  const { data: verifierAccess, error: verifierError } = await db.from("area_access").select("area_id").eq("profile_id", verifierId).eq("role", "verifier");
  if (verifierError) throw new Error(verifierError.message);
  const areaIds = (verifierAccess || []).map((row) => row.area_id);
  if (!areaIds.length) return false;
  const { data, error } = await db.from("area_access").select("id").eq("profile_id", targetProfileId).in("area_id", areaIds).limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function upsertProfile(db: ServerDb, profile: Profile) {
  const { error } = await db.from("profiles").upsert({
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    role: profile.role,
    status: profile.status,
    must_change_password: profile.mustChangePassword,
    created_by: profile.createdBy || null,
    data: profile,
    updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function upsertAreaAccess(db: ServerDb, profileId: string, areaId: string, role: UserRole) {
  const id = `access-${profileId}-${areaId}-${role}`;
  const { error } = await db.from("area_access").upsert({
    id,
    profile_id: profileId,
    area_id: areaId,
    role,
    data: { id, profileId, areaId, role },
    updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function resolveAuthUserId(db: ServerDb, profile: Profile) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profile.id)) return profile.id;
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const match = data.users.find((user) => user.email?.toLowerCase() === profile.email.toLowerCase());
  if (!match) throw new Error("No Supabase Auth user exists for this profile login ID.");
  return match.id;
}

async function createInAppNotification(db: ServerDb, userId: string, areaId: string | undefined, type: string, title: string, message: string) {
  const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await db.from("in_app_notifications").insert({
    id,
    user_id: userId,
    area_id: areaId || null,
    type,
    title,
    message,
    is_read: false,
    data: { id, userId, areaId, type, title, message, isRead: false, createdAt: new Date().toISOString() }
  });
  if (error) throw new Error(error.message);
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
    role: row.role as UserRole,
    status: row.status as Profile["status"],
    mustChangePassword: Boolean(row.must_change_password),
    createdBy: row.created_by ? String(row.created_by) : undefined
  };
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

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let value = "Am#";
  for (let index = 0; index < 11; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

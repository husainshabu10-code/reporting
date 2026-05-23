"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  KeyRound,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import {
  PRIORITY_OPTIONS,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  TASK_TYPES,
  TEAM_TYPES,
  UNIT_OPTIONS,
  USER_TASK_STATUSES,
  ZONE_TYPES,
  type ActivityLog,
  type AreaRequest,
  type DashboardMetrics,
  type DailyReport,
  type EscalationPoint,
  type EventPrepState,
  type FormField,
  type GlobalOption,
  type InAppNotification,
  type LiveTask,
  type Profile,
  type Reminder,
  type RequestReview,
  type RequestStatus,
  type SupportingPerson,
  type TaskFile,
  type TaskTemplate,
  type TaskTypeName,
  type TaskUpdate,
  type UserRole,
  type VerificationLog,
  type VerificationStatus
} from "@/lib/eventPrepTypes";
import {
  eventPrepSupabase,
  approveCredentialUser,
  changeCurrentPassword,
  createCredentialUser,
  isEventPrepSupabaseConfigured,
  loadEventPrepState,
  resetCredentialPassword,
  saveEventPrepState,
  signInWithPassword,
  signOutEventPrep,
  uploadTaskEvidence
} from "@/lib/eventPrepStore";

type AdminTab =
  | "Dashboard"
  | "Daily Reports"
  | "Master Tasks"
  | "Zones / Areas"
  | "Verification"
  | "Requests"
  | "Users & Access"
  | "Forms"
  | "Global Fields"
  | "Reports"
  | "Activity Log";
type UserTab = "Daily Report" | "My Area" | "Requests" | "Profile / Access";
type AnyTab = AdminTab | UserTab;
type TaskView = "today" | "pending" | "issue" | "correction" | "all";
type ToastTone = "success" | "info" | "warning" | "error";
type ToastMessage = { id: string; title: string; message?: string; tone: ToastTone };
type ShowToast = (title: string, message?: string, tone?: ToastTone) => void;

const ADMIN_TABS: AdminTab[] = [
  "Dashboard",
  "Daily Reports",
  "Master Tasks",
  "Zones / Areas",
  "Verification",
  "Requests",
  "Users & Access",
  "Forms",
  "Global Fields",
  "Reports",
  "Activity Log"
];
const USER_TABS: UserTab[] = ["Daily Report", "My Area", "Requests", "Profile / Access"];
const AREA_ADMIN_TABS: AnyTab[] = ["My Area", "Users & Access", "Requests", "Profile / Access"];
const VERIFIER_TABS: AnyTab[] = ["Verification", "Requests", "Users & Access", "Profile / Access"];
const VIEWER_TABS: AnyTab[] = ["Dashboard", "Profile / Access"];

export default function EventPrepDashboard() {
  const [state, setState] = useState<EventPrepState | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState("profile-super-admin");
  const [activeTab, setActiveTab] = useState<AnyTab>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Loading");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionUserId, setSessionUserId] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const db = eventPrepSupabase();
      let authenticatedEmail = "";
      let authenticatedUserId = "";
      if (db) {
        const { data } = await db.auth.getUser();
        authenticatedEmail = data.user?.email || "";
        authenticatedUserId = data.user?.id || "";
        if (cancelled) return;
        setSessionEmail(authenticatedEmail);
        setSessionUserId(authenticatedUserId);
        setAuthChecked(true);
        if (!authenticatedEmail) {
          setSyncStatus("Waiting for password login");
          return;
        }
      } else {
        setAuthChecked(true);
      }

      const loaded = await loadEventPrepState();
      if (cancelled) return;
      setState(loaded);
      setSyncStatus(isEventPrepSupabaseConfigured() ? "Supabase ready" : "Local fallback");
      if (authenticatedEmail) {
        const match = loaded.profiles.find((profile) => (profile.id === authenticatedUserId || profile.email.toLowerCase() === authenticatedEmail.toLowerCase()) && profile.status === "active");
        if (match) setCurrentProfileId(match.id);
      }
    };
    boot().catch((error) => {
      if (cancelled) return;
      setAuthChecked(true);
      setSyncStatus(readError(error, "Unable to load dashboard."));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const activeProfile = getCurrentProfile(state, currentProfileId, sessionEmail, sessionUserId);
      if (isEventPrepSupabaseConfigured() && !activeProfile) return;
      saveEventPrepState(state, activeProfile)
        .then(() => setSyncStatus(isEventPrepSupabaseConfigured() ? "Saved to Supabase" : "Saved locally"))
        .catch((error) => setSyncStatus(readError(error, "Save failed")));
    }, 450);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [currentProfileId, sessionEmail, sessionUserId, state]);

  const handlePasswordLogin = async () => {
    try {
      setAuthMessage("Signing in...");
      await signInWithPassword(loginId, password);
      window.location.reload();
    } catch (error) {
      setAuthMessage(readError(error, "Could not sign in."));
    }
  };
  const handleSignOut = async () => {
    await signOutEventPrep();
    window.location.reload();
  };
  const showToast: ShowToast = (title, message, tone = "success") => {
    const toast: ToastMessage = { id: id("toast"), title, message, tone };
    setToasts((current) => [toast, ...current].slice(0, 4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 3600);
  };
  const dismissToast = (toastId: string) => setToasts((current) => current.filter((item) => item.id !== toastId));

  const currentProfile = state ? getCurrentProfile(state, currentProfileId, sessionEmail, sessionUserId) : undefined;
  const isAdmin = Boolean(currentProfile && ["super_admin", "admin"].includes(currentProfile.role));
  const isAreaAdmin = currentProfile?.role === "area_admin";
  const isVerifier = currentProfile?.role === "verifier";
  const isViewer = currentProfile?.role === "viewer";
  const tabs: AnyTab[] = isAdmin ? ADMIN_TABS : isAreaAdmin ? AREA_ADMIN_TABS : isVerifier ? VERIFIER_TABS : isViewer ? VIEWER_TABS : USER_TABS;

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab((isAdmin || isViewer ? "Dashboard" : isVerifier ? "Verification" : isAreaAdmin ? "My Area" : "Daily Report") as AnyTab);
  }, [activeTab, isAdmin, isAreaAdmin, isVerifier, isViewer, tabs]);

  if (isEventPrepSupabaseConfigured() && authChecked && !sessionEmail) {
    return <LoginScreen loginId={loginId} password={password} authMessage={authMessage} setLoginId={setLoginId} setPassword={setPassword} signIn={handlePasswordLogin} />;
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-soft">
            <p className="text-sm font-bold text-[var(--color-primary)]">Loading ASHARA MUBARAKAH IT Event Preparation Dashboard...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!currentProfile) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-soft">
            <p className="text-sm font-bold text-[var(--color-primary)]">You are not authorized to access this dashboard.</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Ask an admin to create and activate a profile for {sessionEmail || "your login ID"}.</p>
            {isEventPrepSupabaseConfigured() ? <button className="btn-secondary mt-4" onClick={handleSignOut}>Sign out</button> : null}
          </div>
        </div>
      </main>
    );
  }

  if (isEventPrepSupabaseConfigured() && currentProfile.status !== "active") {
    return <AccessBlockedScreen profile={currentProfile} signOut={handleSignOut} />;
  }

  if (isEventPrepSupabaseConfigured() && currentProfile.mustChangePassword) {
    return <PasswordChangeScreen profile={currentProfile} onChanged={(profile) => setState((current) => (current ? { ...current, profiles: current.profiles.map((item) => (item.id === profile.id ? profile : item)) } : current))} signOut={handleSignOut} />;
  }

  const updateState = (updater: (current: EventPrepState) => EventPrepState) => setState((current) => (current ? updater(current) : current));

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--color-border)] bg-white p-4 transition-transform lg:sticky lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">ASHARA MUBARAKAH</p>
              <h1 className="mt-1 text-xl font-black leading-tight text-[var(--color-primary)]">IT Event Preparation</h1>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Phase 2 reporting dashboard</p>
            </div>
            <button className="icon-btn lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            {!isEventPrepSupabaseConfigured() ? (
              <>
                <label className="field-label">Demo profile</label>
                <select className="field mt-2" value={currentProfileId} onChange={(event) => setCurrentProfileId(event.target.value)}>
                  {state.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.fullName} - {roleLabel(profile.role)}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <p className="field-label">Signed in as</p>
                <p className="mt-2 text-sm font-bold text-[var(--color-primary)]">{currentProfile.email}</p>
              </>
            )}
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{syncStatus}</p>
          </div>

          <nav className="mt-5 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition ${activeTab === tab ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-primary)] hover:bg-[var(--color-accent-light)]"}`}
                onClick={() => {
                  setActiveTab(tab);
                  setSidebarOpen(false);
                }}
              >
                {tabIcon(tab)}
                {tab}
              </button>
            ))}
          </nav>

          {!isEventPrepSupabaseConfigured() ? null : <div className="mt-5 rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Password session</p>
            <button className="btn-secondary mt-2 w-full justify-center" onClick={handleSignOut}>
              <LogOut size={16} /> Sign out
            </button>
          </div>}
        </aside>

        {sidebarOpen ? <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" /> : null}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[rgba(250,247,239,0.92)] px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button className="icon-btn lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
                  <Menu size={18} />
                </button>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{roleLabel(currentProfile.role)}</p>
                  <h2 className="text-lg font-black text-[var(--color-primary)]">{activeTab}</h2>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge>{unreadNotificationsFor(state, currentProfile).length + buildUserAlerts(state, currentProfile).length} alert(s)</Badge>
                <Badge>{currentProfile.status.replace("_", " ")}</Badge>
                <Badge>{isEventPrepSupabaseConfigured() ? "Supabase configured" : "Local mode"}</Badge>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <NotificationCenter state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} />
            {activeTab === "Dashboard" ? <DashboardTab state={state} currentProfile={currentProfile} /> : null}
            {activeTab === "Daily Reports" ? <DailyReportsTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Master Tasks" ? <MasterTasksTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Zones / Areas" ? <ZonesAreasTab state={state} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Verification" ? <VerificationTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Requests" ? <RequestsTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Users & Access" ? <UsersAccessTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Daily Report" ? <DailyReportTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "My Area" ? <MyAreaTab state={state} currentProfile={currentProfile} /> : null}
            {activeTab === "Profile / Access" ? <ProfileTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {["Forms", "Global Fields", "Reports", "Activity Log"].includes(activeTab) ? <FoundationTab state={state} tab={activeTab} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
          </div>
        </section>
      </div>
      <ToastStack toasts={toasts} dismissToast={dismissToast} />
    </main>
  );
}

function DashboardTab({ state }: { state: EventPrepState; currentProfile: Profile }) {
  const metrics = useMemo(() => buildMetrics(state), [state]);
  const zoneRows = state.zoneTypes.map((zone) => {
    const areaIds = state.areas.filter((area) => area.zoneTypeId === zone.id).map((area) => area.id);
    const tasks = state.liveTasks.filter((task) => areaIds.includes(task.areaId) && task.active && !task.notApplicable);
    const latest = latestUpdateMap(state.taskUpdates);
    const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return { label: zone.name, total: tasks.length, verified, percent: percent(verified, tasks.length) };
  });
  const attention = buildAttention(state);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Overall Verified Completion" value={`${metrics.overallVerifiedPercent}%`} helper={`${metrics.verifiedTasks}/${metrics.totalLiveTasks} verified`} tone="good" />
        <MetricCard title="Daily Reports Submitted" value={String(metrics.submittedReports)} helper={`${metrics.missingOrPartialReports} missing or partial`} />
        <MetricCard title="Needs Verification" value={String(metrics.needsVerification)} helper="Completed by users, awaiting review" tone="warning" />
        <MetricCard title="Issue Found Tasks" value={String(metrics.issueFound)} helper="User flagged task issues" tone="critical" />
        <MetricCard title="Countdown to Event" value={`${metrics.daysToEvent}d`} helper={state.settings.eventStartDate} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Zone Type Progress" action={<Badge>Verified completed only</Badge>}>
          <div className="space-y-4">
            {zoneRows.map((row) => (
              <ProgressRow key={row.label} label={row.label} value={row.percent} helper={`${row.verified}/${row.total} tasks`} />
            ))}
          </div>
        </Panel>
        <Panel title="Attention Required">
          <div className="grid gap-2 sm:grid-cols-2">
            {attention.map((item) => (
              <div key={item.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-xl font-black text-[var(--color-primary)]">{item.count}</p>
                <p className="text-xs font-bold text-[var(--color-text-muted)]">{item.label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Area-Wise Progress">
          <div className="space-y-3">
            {state.areas.map((area) => {
              const tasks = state.liveTasks.filter((task) => task.areaId === area.id && task.active && !task.notApplicable);
              const latest = latestUpdateMap(state.taskUpdates);
              const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
              return <ProgressRow key={area.id} label={area.name} value={percent(verified, tasks.length)} helper={zoneName(state, area.zoneTypeId)} />;
            })}
          </div>
        </Panel>
        <Panel title="Workstream Progress">
          <div className="space-y-3">
            {unique(state.taskTemplates.map((template) => template.workstream)).map((workstream) => {
              const templateIds = state.taskTemplates.filter((template) => template.workstream === workstream).map((template) => template.id);
              const tasks = state.liveTasks.filter((task) => templateIds.includes(task.templateId) && task.active && !task.notApplicable);
              const latest = latestUpdateMap(state.taskUpdates);
              const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
              return <ProgressRow key={workstream} label={workstream} value={percent(verified, tasks.length)} helper={`${tasks.length} live tasks`} />;
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LoginScreen({
  loginId,
  password,
  authMessage,
  setLoginId,
  setPassword,
  signIn
}: {
  loginId: string;
  password: string;
  authMessage: string;
  setLoginId: (value: string) => void;
  setPassword: (value: string) => void;
  signIn: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <section className="w-full rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">ASHARA MUBARAKAH</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--color-primary)]">IT Event Preparation</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Sign in with the login ID and password created by an admin.</p>
          <label className="mt-4 block">
            <span className="field-label">Login ID / Email</span>
            <input className="field mt-2" type="email" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="mt-3 block">
            <span className="field-label">Password</span>
            <input className="field mt-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") signIn();
            }} />
          </label>
          <button className="btn-primary mt-3 w-full" onClick={signIn}>
            <KeyRound size={17} /> Sign In
          </button>
          {authMessage ? <p className="mt-3 text-sm font-bold text-[var(--color-primary)]">{authMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}

function AccessBlockedScreen({ profile, signOut }: { profile: Profile; signOut: () => void }) {
  const message = profile.status === "pending_approval" ? "Your profile is pending approval. Ask an Admin or assigned Verifier to approve access." : "Your profile is disabled. Contact an Admin.";
  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-soft">
          <p className="text-sm font-bold text-[var(--color-primary)]">Access not active</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{message}</p>
          <button className="btn-secondary mt-4" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </main>
  );
}

function PasswordChangeScreen({ profile, onChanged, signOut }: { profile: Profile; onChanged: (profile: Profile) => void; signOut: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const submit = async () => {
    try {
      if (password !== confirm) throw new Error("Passwords do not match.");
      setMessage("Updating password...");
      const result = await changeCurrentPassword(password);
      onChanged(result.profile);
      setMessage("Password changed. Loading dashboard...");
    } catch (error) {
      setMessage(readError(error, "Unable to change password."));
    }
  };
  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <section className="w-full rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">PASSWORD REQUIRED</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--color-primary)]">Change Temporary Password</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{profile.fullName}, set a new password before using the dashboard.</p>
          <Input label="New password" value={password} onChange={setPassword} type="password" />
          <div className="mt-3">
            <Input label="Confirm password" value={confirm} onChange={setConfirm} type="password" />
          </div>
          <button className="btn-primary mt-4 w-full" onClick={submit}>Change Password</button>
          <button className="btn-secondary mt-2 w-full justify-center" onClick={signOut}>Sign out</button>
          {message ? <p className="mt-3 text-sm font-bold text-[var(--color-primary)]">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}

function DailyReportsTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const today = todayIso();
  const rows = state.areas.map((area) => {
    const report = state.dailyReports.find((item) => item.areaId === area.id && item.reportDate === today);
    return { area, report };
  });
  return (
    <div className="space-y-4">
      <Panel title="Daily Reports" action={<Badge>{today}</Badge>}>
        <ResponsiveTable
          headers={["Area", "Zone Type", "Status", "Remark", "Submitted"]}
          rows={rows.map(({ area, report }) => [
            area.name,
            zoneName(state, area.zoneTypeId),
            <StatusBadge key="status" value={report?.status || "Not Started"} />,
            report?.generalRemark || "No report yet",
            report?.submittedAt ? new Date(report.submittedAt).toLocaleString() : "-"
          ])}
        />
      </Panel>
      {["super_admin", "admin"].includes(currentProfile.role) ? <RemindersConfig state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
    </div>
  );
}

function NotificationCenter({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const stored = unreadNotificationsFor(state, currentProfile);
  const generated = buildUserAlerts(state, currentProfile);
  const count = stored.length + generated.length;
  if (!count) return null;
  const markRead = (notificationId: string) => {
    updateState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => (notification.id === notificationId ? { ...notification, isRead: true } : notification))
    }));
    showToast("Notification marked read", "This alert is now cleared from your unread list.");
  };
  return (
    <Panel title="Alerts & Notifications" action={<Badge>{count} item(s)</Badge>}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {generated.map((notification) => (
          <div key={notification.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[var(--color-accent)]" />
              <p className="text-xs font-black uppercase text-[var(--color-primary)]">{notification.type}</p>
            </div>
            <p className="mt-2 font-black text-[var(--color-primary)]">{notification.title}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{notification.message}</p>
          </div>
        ))}
        {stored.map((notification) => (
          <div key={notification.id} className="rounded-lg border border-[var(--color-border)] bg-white p-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[var(--color-accent)]" />
              <p className="text-xs font-black uppercase text-[var(--color-primary)]">{notification.type}</p>
            </div>
            <p className="mt-2 font-black text-[var(--color-primary)]">{notification.title}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{notification.message}</p>
            <button className="btn-compact mt-3" onClick={() => markRead(notification.id)}>Mark Read</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RemindersConfig({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const [reminderType, setReminderType] = useState("Daily report submission");
  const [areaId, setAreaId] = useState("");
  const reminderTypes = activeOptions(state, "Reminder types", [
    "Daily report submission",
    "Partially updated daily reports",
    "Overdue tasks",
    "Tasks due today",
    "Pending verification",
    "Rejected / Needs Correction tasks",
    "Requests needing review",
    "Access requests pending approval"
  ]);
  const addReminder = () => {
    const reminder: Reminder = {
      id: id("reminder"),
      areaId: areaId || undefined,
      reminderType,
      deadlineTime: "20:00",
      reminderTime: "18:30",
      escalationTime: "21:00",
      recipients: ["Admin"],
      active: true
    };
    updateState((current) => withActivity({ ...current, reminders: [reminder, ...current.reminders] }, currentProfile, "Reminder activity", `Added ${reminder.reminderType} reminder`, "reminder", reminder.id, { active: true }));
    showToast("Reminder created", `${reminder.reminderType} is now tracked in-app.`);
  };
  const updateReminder = (reminderId: string, patch: Partial<Reminder>) => {
    updateState((current) => withActivity({
      ...current,
      reminders: current.reminders.map((reminder) => (reminder.id === reminderId ? { ...reminder, ...patch } : reminder))
    }, currentProfile, "Reminder activity", "Updated reminder rule", "reminder", reminderId, { changed: true }));
  };
  return (
    <Panel title="Configurable In-App Reminders" action={<Badge>No email delivery</Badge>}>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Select label="Reminder type" value={reminderType} onChange={setReminderType} options={reminderTypes} />
        <Select label="Area / Zone" value={areaId} onChange={setAreaId} options={[{ label: "All areas", value: "" }, ...state.areas.map((area) => ({ label: area.name, value: area.id }))]} />
        <button className="btn-primary" onClick={addReminder}>Add Reminder</button>
      </div>
      <div className="mt-4">
        <ResponsiveTable
          headers={["Type", "Area", "Deadline", "Reminder", "Escalation", "Recipients", "Active"]}
          rows={state.reminders.map((reminder) => [
            <select key="type" className="field" value={reminder.reminderType} onChange={(event) => updateReminder(reminder.id, { reminderType: event.target.value })}>
              {reminderTypes.map((type) => <option key={type}>{type}</option>)}
            </select>,
            <select key="area" className="field" value={reminder.areaId || ""} onChange={(event) => updateReminder(reminder.id, { areaId: event.target.value || undefined })}>
              <option value="">All areas</option>
              {state.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>,
            <input key="deadline" className="field" type="time" value={reminder.deadlineTime} onChange={(event) => updateReminder(reminder.id, { deadlineTime: event.target.value })} />,
            <input key="reminder" className="field" type="time" value={reminder.reminderTime} onChange={(event) => updateReminder(reminder.id, { reminderTime: event.target.value })} />,
            <input key="escalation" className="field" type="time" value={reminder.escalationTime} onChange={(event) => updateReminder(reminder.id, { escalationTime: event.target.value })} />,
            <input key="recipients" className="field min-w-48" value={reminder.recipients.join(", ")} onChange={(event) => updateReminder(reminder.id, { recipients: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />,
            <input key="active" type="checkbox" checked={reminder.active} onChange={(event) => updateReminder(reminder.id, { active: event.target.checked })} />
          ])}
        />
      </div>
    </Panel>
  );
}

function MasterTasksTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const [importMessage, setImportMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dayFilter, setDayFilter] = useState("All");
  const [workstreamFilter, setWorkstreamFilter] = useState("All");
  const [applyAreaId, setApplyAreaId] = useState(state.areas[0]?.id || "");
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]>("Simple Task");
  const [requiredQuantity, setRequiredQuantity] = useState("1");
  const [unit, setUnit] = useState("Item");
  const unitOptions = activeOptions(state, "Units", UNIT_OPTIONS);
  const priorityOptions = activeOptions(state, "Priority options", PRIORITY_OPTIONS);

  const filteredTemplates = state.taskTemplates.filter((template) => {
    const matchesDay = dayFilter === "All" || String(template.day) === dayFilter;
    const matchesWorkstream = workstreamFilter === "All" || template.workstream === workstreamFilter;
    return matchesDay && matchesWorkstream;
  });

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const templates = await parsePreparationPlan(file);
      updateState((current) => ({
        ...current,
        taskTemplates: mergeTemplates(current.taskTemplates, templates)
      }));
      setImportMessage(`${templates.length} task templates imported into the reusable master template list.`);
      showToast("Import completed", `${templates.length} template(s) added to Master Tasks.`);
    } catch (error) {
      setImportMessage(readError(error, "Import failed."));
      showToast("Import failed", readError(error, "Please check the file and try again."), "error");
    } finally {
      event.target.value = "";
    }
  };

  const applyTemplates = () => {
    if (!applyAreaId || !selectedIds.length) {
      showToast("Nothing selected", "Choose at least one template and an area first.", "warning");
      return;
    }
    const templatesToApply = selectedIds.filter((templateId) => !state.liveTasks.some((task) => task.templateId === templateId && task.areaId === applyAreaId));
    updateState((current) => {
      const newTasks = templatesToApply
        .filter((templateId) => !current.liveTasks.some((task) => task.templateId === templateId && task.areaId === applyAreaId))
        .map((templateId) => {
          const template = current.taskTemplates.find((item) => item.id === templateId);
          return createLiveTask(template, applyAreaId, taskType, Number(requiredQuantity || 0), unit, current, current.settings.preparationStartDate);
        })
        .filter(Boolean) as LiveTask[];
      return withActivity({ ...current, liveTasks: [...newTasks, ...current.liveTasks] }, currentProfile, "Template changes", `Applied ${newTasks.length} template(s) to ${areaName(current, applyAreaId)}`, "live_task", applyAreaId, { count: newTasks.length });
    });
    showToast(
      templatesToApply.length ? "Templates applied" : "No new live tasks",
      templatesToApply.length ? `${templatesToApply.length} live task(s) created for ${areaName(state, applyAreaId)}.` : "Those templates were already applied to this area.",
      templatesToApply.length ? "success" : "info"
    );
  };

  const updateLiveTask = (taskId: string, patch: Partial<LiveTask>) => {
    updateState((current) => ({
      ...current,
      liveTasks: current.liveTasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task))
    }));
  };

  return (
    <div className="space-y-4">
      <Panel title="Excel Import Into Task Templates" action={<Badge>Day Plan sheet preferred</Badge>}>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label className="field-label">Upload preparation plan</label>
            <input className="field mt-2" type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} />
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Imports useful Day Plan columns into reusable templates. Dependencies and risk are kept only as hidden reference.</p>
          </div>
          <button className="btn-secondary" onClick={() => {
            setSelectedIds(filteredTemplates.map((template) => template.id));
            showToast("Templates selected", `${filteredTemplates.length} filtered template(s) selected.`, "info");
          }}>
            Select Filtered
          </button>
        </div>
        {importMessage ? <p className="mt-3 rounded-lg bg-[var(--color-accent-light)] p-3 text-sm font-bold text-[var(--color-primary)]">{importMessage}</p> : null}
      </Panel>

      <Panel title="Apply Templates To Area" action={<Badge>{selectedIds.length} selected</Badge>}>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select label="Day" value={dayFilter} onChange={setDayFilter} options={["All", ...unique(state.taskTemplates.map((template) => String(template.day)))]} />
          <Select label="Workstream" value={workstreamFilter} onChange={setWorkstreamFilter} options={["All", ...unique(state.taskTemplates.map((template) => template.workstream))]} />
          <Select label="Area" value={applyAreaId} onChange={setApplyAreaId} options={state.areas.map((area) => ({ label: area.name, value: area.id }))} />
          <Select label="Task Type" value={taskType} onChange={(value) => setTaskType(value as typeof taskType)} options={[...TASK_TYPES]} />
          <Input label="Required Qty" value={requiredQuantity} onChange={setRequiredQuantity} type="number" />
          <Select label="Unit" value={unit} onChange={setUnit} options={unitOptions} />
        </div>
        <button className="btn-primary mt-3" onClick={applyTemplates}>
          <Plus size={17} /> Apply Selected Templates
        </button>
      </Panel>

      <Panel title="Task Templates">
        <div className="grid gap-3">
          {filteredTemplates.map((template) => (
            <label key={template.id} className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-white p-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(template.id)}
                onChange={(event) => setSelectedIds((current) => (event.target.checked ? [...current, template.id] : current.filter((id) => id !== template.id)))}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Day {template.day}</Badge>
                  <StatusBadge value={template.priorityLevel} />
                  <p className="font-black text-[var(--color-primary)]">{template.taskDetails}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{template.workstream} | {template.responsibleTeam}</p>
              </div>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Live Tasks Area Configuration" action={<Badge>{state.liveTasks.length} live tasks</Badge>}>
        <ResponsiveTable
          headers={["Area", "Task", "Type", "Qty", "Unit", "Start", "Due", "Priority", "Verifier", "Rule", "Active"]}
          rows={state.liveTasks.map((task) => {
            const template = state.taskTemplates.find((item) => item.id === task.templateId);
            const areaVerifierOptions = state.areaAccess
              .filter((access) => access.areaId === task.areaId && access.role === "verifier")
              .map((access) => state.profiles.find((profile) => profile.id === access.profileId))
              .filter(Boolean) as Profile[];
            return [
              areaName(state, task.areaId),
              template?.taskDetails || "Task",
              <select key="type" className="field" value={task.taskType} onChange={(event) => updateLiveTask(task.id, { taskType: event.target.value as LiveTask["taskType"] })}>
                {TASK_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>,
              <input key="qty" className="field w-24" type="number" value={task.requiredQuantity || ""} onChange={(event) => updateLiveTask(task.id, { requiredQuantity: Number(event.target.value || 0) })} />,
              <input key="unit" className="field w-28" value={task.unit || ""} onChange={(event) => updateLiveTask(task.id, { unit: event.target.value })} />,
              <input key="start" className="field" type="date" value={task.startDate} onChange={(event) => updateLiveTask(task.id, { startDate: event.target.value })} />,
              <input key="due" className="field" type="date" value={task.dueDate} onChange={(event) => updateLiveTask(task.id, { dueDate: event.target.value })} />,
              <select key="priority" className="field" value={task.priority} onChange={(event) => updateLiveTask(task.id, { priority: event.target.value as LiveTask["priority"] })}>
                {priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
              </select>,
              <div key="verifiers" className="grid gap-2">
                {areaVerifierOptions.length ? areaVerifierOptions.map((profile) => (
                  <label key={profile.id} className="flex items-center gap-2 text-xs font-bold text-[var(--color-primary)]">
                    <input
                      type="checkbox"
                      checked={task.assignedVerifierIds.includes(profile.id)}
                      onChange={(event) => {
                        const next = event.target.checked ? [...task.assignedVerifierIds, profile.id] : task.assignedVerifierIds.filter((idValue) => idValue !== profile.id);
                        updateLiveTask(task.id, { assignedVerifierIds: next });
                      }}
                    />
                    {profile.fullName}
                  </label>
                )) : <span className="text-xs text-[var(--color-text-muted)]">No verifier assigned to area</span>}
              </div>,
              <select key="rule" className="field" value={task.verificationRule} onChange={(event) => updateLiveTask(task.id, { verificationRule: event.target.value as LiveTask["verificationRule"] })}>
                <option value="one_verifier">One verifier enough</option>
                <option value="all_verifiers">All verifiers required</option>
                <option value="sequential">Sequential</option>
              </select>,
              <input key="active" type="checkbox" checked={task.active} onChange={(event) => updateLiveTask(task.id, { active: event.target.checked })} />
            ];
          })}
        />
      </Panel>
    </div>
  );
}

function ZonesAreasTab({ state, updateState, showToast }: { state: EventPrepState; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const [name, setName] = useState("");
  const [zoneTypeId, setZoneTypeId] = useState(state.zoneTypes[0]?.id || "");
  const addArea = () => {
    if (!name.trim()) {
      showToast("Area name required", "Enter an area name before adding it.", "warning");
      return;
    }
    const createdName = name.trim();
    updateState((current) => ({
      ...current,
      areas: [
        ...current.areas,
        {
          id: id("area"),
          zoneTypeId,
          name: createdName,
          code: slug(createdName).toUpperCase(),
          active: true,
          dailyDeadline: "20:00",
          reminderTime: "18:30",
          escalationTime: "21:00"
        }
      ]
    }));
    setName("");
    showToast("Area added", `${createdName} is ready for access and live tasks.`);
  };
  const updateArea = (areaId: string, patch: Partial<EventPrepState["areas"][number]>) => {
    updateState((current) => ({ ...current, areas: current.areas.map((area) => (area.id === areaId ? { ...area, ...patch } : area)) }));
  };
  const deleteArea = (areaId: string) => {
    if (!window.confirm("Delete this area and its Phase 1 live tasks, reports, requests, and access records?")) return;
    updateState((current) => {
      const liveTaskIds = current.liveTasks.filter((task) => task.areaId === areaId).map((task) => task.id);
      const reportIds = current.dailyReports.filter((report) => report.areaId === areaId).map((report) => report.id);
      const updateIds = current.taskUpdates.filter((update) => liveTaskIds.includes(update.liveTaskId) || reportIds.includes(update.dailyReportId)).map((update) => update.id);
      return {
        ...current,
        areas: current.areas.filter((area) => area.id !== areaId),
        areaAccess: current.areaAccess.filter((access) => access.areaId !== areaId),
        liveTasks: current.liveTasks.filter((task) => task.areaId !== areaId),
        dailyReports: current.dailyReports.filter((report) => report.areaId !== areaId),
        taskUpdates: current.taskUpdates.filter((update) => !updateIds.includes(update.id)),
        taskFiles: current.taskFiles.filter((file) => !liveTaskIds.includes(file.liveTaskId) && !updateIds.includes(file.taskUpdateId)),
        verificationLogs: current.verificationLogs.filter((log) => !liveTaskIds.includes(log.liveTaskId) && !updateIds.includes(log.taskUpdateId)),
        requests: current.requests.filter((request) => request.areaId !== areaId)
      };
    });
    showToast("Area deleted", "Related Phase 1 records were removed from the dashboard.", "info");
  };

  return (
    <div className="space-y-4">
      <Panel title="Event Dates">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Preparation start date / Day 1"
            value={state.settings.preparationStartDate}
            type="date"
            onChange={(value) => updateState((current) => ({ ...current, settings: { ...current.settings, preparationStartDate: value } }))}
          />
          <Input
            label="Event start date"
            value={state.settings.eventStartDate}
            type="date"
            onChange={(value) => updateState((current) => ({ ...current, settings: { ...current.settings, eventStartDate: value } }))}
          />
        </div>
      </Panel>
      <Panel title="Create Area / Zone">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Select label="Zone Type" value={zoneTypeId} onChange={setZoneTypeId} options={state.zoneTypes.map((zone) => ({ label: zone.name, value: zone.id }))} />
          <Input label="Area name" value={name} onChange={setName} placeholder="Relay Zone 2 - Area Name" />
          <button className="btn-primary" onClick={addArea}>
            <Plus size={17} /> Add Area
          </button>
        </div>
      </Panel>
      <Panel title="Zones / Areas">
        <ResponsiveTable
          headers={["Zone Type", "Area", "Code", "Deadline", "Reminder", "Escalation", "Active", "Action"]}
          rows={state.areas.map((area) => [
            <select key="zone" className="field" value={area.zoneTypeId} onChange={(event) => updateArea(area.id, { zoneTypeId: event.target.value })}>
              {state.zoneTypes.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </select>,
            <input key="name" className="field" value={area.name} onChange={(event) => updateArea(area.id, { name: event.target.value, code: slug(event.target.value).toUpperCase() })} />,
            area.code,
            <input key="deadline" className="field" type="time" value={area.dailyDeadline} onChange={(event) => updateArea(area.id, { dailyDeadline: event.target.value })} />,
            <input key="reminder" className="field" type="time" value={area.reminderTime} onChange={(event) => updateArea(area.id, { reminderTime: event.target.value })} />,
            <input key="escalation" className="field" type="time" value={area.escalationTime} onChange={(event) => updateArea(area.id, { escalationTime: event.target.value })} />,
            <input key="active" type="checkbox" checked={area.active} onChange={(event) => updateArea(area.id, { active: event.target.checked })} />,
            <button key="delete" className="btn-compact" onClick={() => deleteArea(area.id)}>Delete</button>
          ])}
        />
      </Panel>
    </div>
  );
}

function DailyReportTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const allowedAreas = getAllowedAreas(state, currentProfile);
  const [areaId, setAreaId] = useState(allowedAreas[0]?.id || "");
  const [taskView, setTaskView] = useState<TaskView>("today");
  const [generalRemark, setGeneralRemark] = useState("");
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const currentDay = prepDayForDate(state.settings.preparationStartDate, todayIso());
  const report = getOrCreateReport(state, areaId, currentDay);
  const latest = latestUpdateMap(state.taskUpdates);
  const area = state.areas.find((item) => item.id === areaId);
  const zone = area ? zoneName(state, area.zoneTypeId) : "";
  const tasks = state.liveTasks
    .filter((task) => task.areaId === areaId && task.active && !task.notApplicable)
    .filter((task) => task.assignedProfileIds.includes(currentProfile.id) || currentProfile.role !== "report_user");
  const corrections = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Rejected / Needs Correction");
  const visibleTasks = tasks.filter((task) => {
    const update = latest.get(task.id);
    if (taskView === "today") return task.prepDay === currentDay;
    if (taskView === "pending") return !update || ["Pending", "In Progress"].includes(update.status);
    if (taskView === "issue") return update?.status === "Issue Found";
    if (taskView === "correction") return update?.verificationStatus === "Rejected / Needs Correction";
    return true;
  });

  useEffect(() => {
    setAreaId((current) => current || allowedAreas[0]?.id || "");
  }, [allowedAreas]);

  useEffect(() => {
    setGeneralRemark(report.generalRemark);
  }, [report.id, report.generalRemark]);

  if (!allowedAreas.length) {
    return <EmptyState title="You are not authorized to access this area." body="Ask an admin to assign area access before submitting reports." />;
  }

  const saveDraft = () => {
    updateState((current) => withActivity(upsertReport(current, { ...report, generalRemark, status: "Draft Saved", updatedAt: new Date().toISOString() }), currentProfile, "Daily reports", `Saved draft for ${area?.name || areaId}`, "daily_report", report.id, { status: "Draft Saved" }));
    showToast("Draft saved", "This report is saved, but it is not submitted yet.", "info");
  };

  const submitReport = () => {
    const todayTasks = tasks.filter((task) => task.prepDay === currentDay);
    const missing = todayTasks.filter((task) => !state.taskUpdates.some((update) => update.liveTaskId === task.id && update.dailyReportId === report.id)).map((task) => task.id);
    setMissingIds(missing);
    const nextStatus = missing.length ? "Partially Updated" : isLate(area?.dailyDeadline || "20:00") ? "Late Submitted" : "Submitted";
    updateState((current) =>
      withActivity(upsertReport(current, {
        ...report,
        generalRemark,
        status: nextStatus,
        submittedBy: currentProfile.id,
        submittedAt: missing.length ? report.submittedAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }), currentProfile, "Daily reports", `Submitted report for ${area?.name || areaId}`, "daily_report", report.id, { status: nextStatus, missingTasks: missing.length })
    );
    showToast(
      missing.length ? "Report partially updated" : nextStatus,
      missing.length ? `${missing.length} task(s) still need an update before final submission.` : "Daily report submitted successfully.",
      missing.length ? "warning" : "success"
    );
  };

  return (
    <div className="space-y-4">
      <Panel title="Daily Report" action={<Badge>Prep Day {currentDay}</Badge>}>
        <div className="grid gap-3 lg:grid-cols-4">
          <Select label="Zone Type" value={zone} onChange={() => undefined} options={ZONE_TYPES.map((name) => String(name))} disabled />
          <Select label="Area / Zone" value={areaId} onChange={setAreaId} options={allowedAreas.map((item) => ({ label: item.name, value: item.id }))} />
          <Input label="Current date" value={todayIso()} onChange={() => undefined} disabled />
          <Select label="Task view" value={taskView} onChange={(value) => setTaskView(value as TaskView)} options={[{ label: "Today's assigned tasks", value: "today" }, { label: "All Pending Tasks", value: "pending" }, { label: "Issue Found Tasks", value: "issue" }, { label: "Needs Correction Tasks", value: "correction" }, { label: "All Tasks", value: "all" }]} />
        </div>
        <label className="mt-3 block">
          <span className="field-label">General area-level daily remark</span>
          <textarea className="field mt-2 min-h-24" value={generalRemark} onChange={(event) => setGeneralRemark(event.target.value)} placeholder="Today cabling team visited the site. ISP vendor confirmation is pending." />
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button className="btn-secondary flex-1" onClick={saveDraft}>Save Draft</button>
          <button className="btn-primary flex-1" onClick={submitReport}>Submit Daily Report</button>
        </div>
      </Panel>

      {corrections.length ? (
        <Panel title="Needs Correction" action={<Badge>{corrections.length} task(s)</Badge>}>
          <TaskCardList state={state} tasks={corrections} report={report} currentProfile={currentProfile} updateState={updateState} missingIds={missingIds} showToast={showToast} />
        </Panel>
      ) : null}

      <Panel title="Task Cards" action={<Badge>{visibleTasks.length} shown</Badge>}>
        <TaskCardList state={state} tasks={visibleTasks} report={report} currentProfile={currentProfile} updateState={updateState} missingIds={missingIds} showToast={showToast} />
      </Panel>
    </div>
  );
}

function TaskCardList({
  state,
  tasks,
  report,
  currentProfile,
  updateState,
  missingIds,
  showToast
}: {
  state: EventPrepState;
  tasks: LiveTask[];
  report: DailyReport;
  currentProfile: Profile;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
  missingIds: string[];
  showToast: ShowToast;
}) {
  if (!tasks.length) return <EmptyState title="No tasks in this view" body="Change the task view filter or ask admin to apply task templates to this area." />;
  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} state={state} task={task} report={report} currentProfile={currentProfile} updateState={updateState} missing={missingIds.includes(task.id)} showToast={showToast} />
      ))}
    </div>
  );
}

function TaskCard({
  state,
  task,
  report,
  currentProfile,
  updateState,
  missing,
  showToast
}: {
  state: EventPrepState;
  task: LiveTask;
  report: DailyReport;
  currentProfile: Profile;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
  missing: boolean;
  showToast: ShowToast;
}) {
  const template = state.taskTemplates.find((item) => item.id === task.templateId);
  const existing = state.taskUpdates.find((update) => update.liveTaskId === task.id && update.dailyReportId === report.id);
  const latest = latestUpdateMap(state.taskUpdates).get(task.id);
  const [draft, setDraft] = useState<TaskUpdate>(() => existing || createTaskUpdate(task, report, currentProfile.id, latest));
  const remaining = Math.max(0, (task.requiredQuantity || 0) - (draft.completedQuantity || 0));
  const showStatus = isFormFieldVisible(state, task.taskType, "status");
  const showRole = isFormFieldVisible(state, task.taskType, "user_role_standing");
  const showQuantity = task.taskType === "Quantity-Based Task" && isFormFieldVisible(state, task.taskType, "completed_quantity");
  const showRemarks = isFormFieldVisible(state, task.taskType, "remarks");
  const showEscalations = isFormFieldVisible(state, task.taskType, "escalation_points");
  const showSupport = isFormFieldVisible(state, task.taskType, "supporting_personnel");
  const showUpload = isFormFieldVisible(state, task.taskType, "file_upload");
  const teamTypeOptions = activeOptions(state, "Team Types", TEAM_TYPES);

  useEffect(() => {
    setDraft(existing || createTaskUpdate(task, report, currentProfile.id, latest));
  }, [existing?.id, report.id, task.id]);

  const saveTask = () => {
    const nextVerification: VerificationStatus = draft.status === "Completed" ? (task.verificationRequired ? "Needs Verification" : "Verified Completed") : draft.verificationStatus === "Rejected / Needs Correction" ? "Needs Verification" : draft.verificationStatus;
    const completedQuantity = task.taskType === "Quantity-Based Task" ? Math.max(0, Math.min(Number(draft.completedQuantity || 0), Number(task.requiredQuantity || draft.completedQuantity || 0))) : draft.completedQuantity;
    const next = { ...draft, completedQuantity, verificationStatus: nextVerification, updatedAt: new Date().toISOString() };
    updateState((current) => {
      const without = current.taskUpdates.filter((update) => update.id !== next.id);
      const nextReport = current.dailyReports.some((item) => item.id === report.id) ? current.dailyReports : [report, ...current.dailyReports];
      const verifierNotifications = next.verificationStatus === "Needs Verification"
        ? task.assignedVerifierIds.map((verifierId) => createInAppNotification(verifierId, "Task needs verification", "Task needs verification", template?.taskDetails || "A task is ready for verification.", { areaId: task.areaId, relatedTaskId: task.id, relatedDailyReportId: report.id }))
        : [];
      return withActivity({ ...current, dailyReports: nextReport, taskUpdates: [next, ...without], notifications: [...verifierNotifications, ...current.notifications] }, currentProfile, "Task updates", `Updated task: ${template?.taskDetails || task.id}`, "task_update", next.id, { status: next.status });
    });
    showToast(
      nextVerification === "Needs Verification" ? "Task sent for verification" : "Task update saved",
      nextVerification === "Needs Verification" ? "A verifier can now review this task." : "Your task changes were saved.",
      nextVerification === "Needs Verification" ? "info" : "success"
    );
  };

  const requestNotApplicable = () => {
    const title = `Not applicable request: ${template?.taskDetails || "Task"}`;
    updateState((current) => {
      const request = {
        id: id("request"),
        requestType: "Not Applicable / Task Removal Request" as const,
        areaId: task.areaId,
        relatedLiveTaskId: task.id,
        title,
        details: "User requested this task to be marked as not applicable for the area.",
        priority: task.priority,
        requiredByDate: todayIso(),
        requestedBy: currentProfile.id,
        status: "Under Review" as const,
        createdAt: new Date().toISOString()
      };
      return withActivity({
        ...current,
        requests: [request, ...current.requests],
        notifications: [...notifyAdmins(current, "Request status changed", title, "A not applicable request needs review.", { areaId: task.areaId, relatedTaskId: task.id, relatedRequestId: request.id }), ...current.notifications]
      }, currentProfile, "Requests", title, "request", request.id, { status: request.status });
    });
    showToast("Request created", "Admin can now review the not applicable request.", "info");
  };

  const addFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const newFiles: TaskFile[] = [];
    const savedDraft = { ...draft, updatedAt: new Date().toISOString() };
    for (const file of files) {
      const uploaded = await uploadTaskEvidence(file, task.id);
      newFiles.push({
        id: id("file"),
        liveTaskId: task.id,
        taskUpdateId: savedDraft.id,
        fileName: file.name,
        fileType: file.type || "unknown",
        fileSize: file.size,
        storagePath: uploaded.storagePath,
        reviewLocked: ["Needs Verification", "Partially Verified", "Verified Completed"].includes(draft.verificationStatus),
        uploadedAt: new Date().toISOString()
      });
    }
    updateState((current) => {
      const nextReports = current.dailyReports.some((item) => item.id === report.id) ? current.dailyReports : [report, ...current.dailyReports];
      const nextUpdates = [savedDraft, ...current.taskUpdates.filter((update) => update.id !== savedDraft.id)];
      return { ...current, dailyReports: nextReports, taskUpdates: nextUpdates, taskFiles: [...newFiles, ...current.taskFiles] };
    });
    event.target.value = "";
    showToast("Upload added", `${newFiles.length} file(s) attached to this task.`);
  };

  const files = state.taskFiles.filter((file) => file.liveTaskId === task.id);

  return (
    <article className={`rounded-lg border bg-white p-4 shadow-sm ${missing ? "border-[var(--color-important)]" : "border-[var(--color-border)]"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Day {task.prepDay}</Badge>
            <StatusBadge value={task.taskType} />
            <StatusBadge value={draft.verificationStatus} />
          </div>
          <h3 className="mt-2 text-base font-black text-[var(--color-primary)]">{template?.taskDetails || "Task"}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{template?.workstream} | {template?.expectedOutput}</p>
          {draft.correctionComment ? <p className="mt-2 rounded-lg bg-[#7A1F2B]/10 p-2 text-sm font-bold text-[var(--color-important)]">Correction: {draft.correctionComment}</p> : null}
        </div>
        <div className="text-sm text-[var(--color-text-muted)]">
          <p>Due: <strong>{task.dueDate}</strong></p>
          <p>Priority: <strong>{task.priority}</strong></p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {showStatus ? <Select label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as TaskUpdate["status"] })} options={[...USER_TASK_STATUSES]} /> : null}
        {showRole ? <Input label="User role / standing" value={draft.userRoleStanding} onChange={(value) => setDraft({ ...draft, userRoleStanding: value })} placeholder="Local IT SPOC" /> : null}
        {showQuantity ? <Input label={`Completed / installed quantity (${task.unit || "unit"})`} value={String(draft.completedQuantity || "")} onChange={(value) => setDraft({ ...draft, completedQuantity: Number(value || 0) })} type="number" /> : null}
      </div>

      {showQuantity ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Required" value={`${task.requiredQuantity || 0} ${task.unit || ""}`} />
          <MiniStat label="Completed" value={String(draft.completedQuantity || 0)} />
          <MiniStat label="Remaining" value={String(remaining)} />
        </div>
      ) : null}

      {showRemarks ? (
        <label className="mt-3 block">
          <span className="field-label">Remarks</span>
          <textarea className="field mt-2 min-h-20" value={draft.remarks} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} />
        </label>
      ) : null}

      {showEscalations ? <PeopleEditor
        title="Escalation Points"
        rows={draft.escalationPoints}
        addLabel="Add escalation point"
        onChange={(rows) => setDraft({ ...draft, escalationPoints: rows })}
        kind="escalation"
      /> : null}
      {showSupport ? <PeopleEditor
        title="Supporting Personnel"
        rows={draft.supportingPersonnel}
        addLabel="Add supporting person"
        onChange={(rows) => setDraft({ ...draft, supportingPersonnel: rows })}
        kind="support"
        teamTypeOptions={teamTypeOptions}
      /> : null}

      {showUpload ? <div className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <label className="field-label">Upload evidence</label>
        <input className="field mt-2" type="file" multiple onChange={addFile} />
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{task.evidenceNote || "Uploads are optional in Phase 1. Files lock when review starts."}</p>
        {files.length ? <p className="mt-2 text-xs font-bold text-[var(--color-primary)]">{files.map((file) => file.fileName).join(", ")}</p> : null}
      </div> : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary" onClick={requestNotApplicable}>Request Not Applicable</button>
        <button className="btn-primary" onClick={saveTask}>Save Task Update</button>
      </div>
    </article>
  );
}

function VerificationTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const latest = latestUpdateMap(state.taskUpdates);
  const assignedAreaIds = getAllowedAreas(state, currentProfile).map((area) => area.id);
  const queue = state.liveTasks.filter((task) => {
    const update = latest.get(task.id);
    if (!update || !["Needs Verification", "Partially Verified"].includes(update.verificationStatus)) return false;
    if (["admin", "super_admin"].includes(currentProfile.role)) return true;
    return task.assignedVerifierIds.includes(currentProfile.id) && assignedAreaIds.includes(task.areaId);
  });

  const act = (task: LiveTask, action: VerificationLog["action"]) => {
    const update = latest.get(task.id);
    if (!update) return;
    if (!canActOnVerification(task, update, currentProfile, state.verificationLogs)) {
      window.alert("This verification is waiting for another assigned verifier.");
      showToast("Verification blocked", "This task is waiting for another assigned verifier.", "warning");
      return;
    }
    const comment = window.prompt(action === "verified" ? "Verification comment" : "Correction comment") || "";
    updateState((current) => {
      const log: VerificationLog = { id: id("verification"), liveTaskId: task.id, taskUpdateId: update.id, verifierId: currentProfile.id, action, comment, createdAt: new Date().toISOString() };
      const nextStatus: VerificationStatus = action === "verified" ? nextVerificationStatus(task, update, currentProfile, [...current.verificationLogs, log]) : "Rejected / Needs Correction";
      const updatedTaskUpdate = {
        ...update,
        verificationStatus: nextStatus,
        correctionComment: action === "rejected" ? comment : update.correctionComment,
        updatedAt: new Date().toISOString()
      };
      return withActivity({
        ...current,
        taskUpdates: [updatedTaskUpdate, ...current.taskUpdates.filter((item) => item.id !== update.id)],
        verificationLogs: [log, ...current.verificationLogs],
        taskFiles: current.taskFiles.map((file) => (file.liveTaskId === task.id ? { ...file, reviewLocked: true } : file)),
        notifications: action === "rejected" ? [createInAppNotification(update.updatedBy, "Task needs correction", "Task needs correction", comment || "A verifier requested correction.", { areaId: task.areaId, relatedTaskId: task.id, relatedDailyReportId: update.dailyReportId }), ...current.notifications] : current.notifications
      }, currentProfile, "Verification actions", `${action === "verified" ? "Verified" : "Rejected"} task`, "verification_log", log.id, { status: nextStatus });
    });
    showToast(action === "verified" ? "Task verified" : "Correction requested", action === "verified" ? "Progress will count this task once verification is complete." : "The report user will see your correction comment.", action === "verified" ? "success" : "warning");
  };

  return (
    <Panel title="Verification Queue" action={<Badge>{queue.length} assigned</Badge>}>
      <div className="grid gap-3">
        {queue.map((task) => {
          const template = state.taskTemplates.find((item) => item.id === task.templateId);
          const update = latest.get(task.id);
          const canAct = update ? canActOnVerification(task, update, currentProfile, state.verificationLogs) : false;
          return (
            <article key={task.id} className="rounded-lg border border-[var(--color-border)] bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{areaName(state, task.areaId)}</Badge>
                    <StatusBadge value={update?.verificationStatus || "Needs Verification"} />
                    <Badge>{verificationRuleLabel(task.verificationRule)}</Badge>
                    {!canAct ? <StatusBadge value="Waiting for verifier turn" /> : null}
                  </div>
                  <h3 className="mt-2 font-black text-[var(--color-primary)]">{template?.taskDetails}</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{update?.remarks || "No remarks"}</p>
                  {task.taskType === "Quantity-Based Task" ? <p className="mt-1 text-sm font-bold">Quantity: {update?.completedQuantity || 0}/{task.requiredQuantity || 0}</p> : null}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Verifiers: {task.assignedVerifierIds.map((profileId) => state.profiles.find((profile) => profile.id === profileId)?.fullName || profileId).join(", ") || "None"}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="btn-primary" disabled={!canAct} onClick={() => act(task, "verified")}>Verify</button>
                  <button className="btn-secondary" disabled={!canAct} onClick={() => act(task, "rejected")}>Reject / Needs Correction</button>
                </div>
              </div>
            </article>
          );
        })}
        {!queue.length ? <EmptyState title="No verification requests assigned" body="Completed user tasks that require your verification will appear here." /> : null}
      </div>
    </Panel>
  );
}

function RequestsTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const isAdmin = ["super_admin", "admin"].includes(currentProfile.role);
  const areas = getAllowedAreas(state, currentProfile);
  const [areaId, setAreaId] = useState(areas[0]?.id || state.areas[0]?.id || "");
  const [requestType, setRequestType] = useState<(typeof REQUEST_TYPES)[number]>("Extra Equipment Request");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [reviewerByRequest, setReviewerByRequest] = useState<Record<string, string>>({});
  const assignedReviewRequestIds = new Set(state.requestReviews.filter((review) => review.reviewerId === currentProfile.id && !review.completed).map((review) => review.requestId));
  const visibleRequests = isAdmin
    ? state.requests
    : currentProfile.role === "verifier"
      ? state.requests.filter((request) => assignedReviewRequestIds.has(request.id))
      : state.requests.filter((request) => areas.some((area) => area.id === request.areaId) || request.requestedBy === currentProfile.id);
  const verifierOptions = state.profiles.filter((profile) => profile.role === "verifier" && profile.status === "active");

  const createRequest = () => {
    if (!title.trim() || !areaId) {
      showToast("Request needs a title", "Add a request title and area before submitting.", "warning");
      return;
    }
    const request: AreaRequest = {
      id: id("request"),
      requestType,
      areaId,
      title,
      details,
      priority: "Medium",
      requiredByDate: todayIso(),
      requestedBy: currentProfile.id,
      status: "Under Review",
      createdAt: new Date().toISOString()
    };
    updateState((current) => withActivity({
      ...current,
      requests: [request, ...current.requests],
      notifications: [...notifyAdmins(current, "Request status changed", `New request: ${title}`, "A request was created and needs review.", { areaId, relatedRequestId: request.id }), ...current.notifications]
    }, currentProfile, "Requests", `Created request: ${title}`, "request", request.id, { status: request.status }));
    setTitle("");
    setDetails("");
    showToast("Request submitted", "Admin can now review this request.", "success");
  };

  const changeStatus = (request: AreaRequest, status: RequestStatus) => {
    updateState((current) => withActivity({
      ...current,
      requests: current.requests.map((item) => (item.id === request.id ? { ...item, status } : item)),
      notifications: [createInAppNotification(request.requestedBy, "Request status changed", `Request ${status}`, request.title, { areaId: request.areaId, relatedRequestId: request.id }), ...current.notifications],
      liveTasks:
        status === "Approved" && request.requestType === "Not Applicable / Task Removal Request" && request.relatedLiveTaskId
          ? current.liveTasks.map((task) => (task.id === request.relatedLiveTaskId ? { ...task, notApplicable: true, active: false } : task))
          : current.liveTasks
    }, currentProfile, "Requests", `Changed request status to ${status}`, "request", request.id, { status }));
    showToast("Request updated", `${request.title} is now ${status}.`, status === "Rejected" ? "warning" : "success");
  };

  const sendForVerification = (request: AreaRequest) => {
    const reviewerId = reviewerByRequest[request.id];
    if (!reviewerId) {
      showToast("Choose a verifier", "Select a verifier before sending the request.", "warning");
      return;
    }
    updateState((current) => {
      const review: RequestReview = {
        id: id("request-review"),
        requestId: request.id,
        reviewerId,
        comment: "",
        recommendation: "",
        completed: false,
        createdAt: new Date().toISOString()
      };
      return withActivity({
        ...current,
        requests: current.requests.map((item) => (item.id === request.id ? { ...item, status: "Sent for Verification" } : item)),
        requestReviews: [review, ...current.requestReviews],
        notifications: [createInAppNotification(reviewerId, "Request status changed", `Review request: ${request.title}`, "Admin sent this request to you for verification.", { areaId: request.areaId, relatedRequestId: request.id }), ...current.notifications]
      }, currentProfile, "Requests", "Sent request for verifier review", "request", request.id, { reviewerAssigned: true });
    });
    showToast("Sent for verification", "The assigned verifier will see it in their queue.", "info");
  };

  const completeReview = (request: AreaRequest) => {
    const review = state.requestReviews.find((item) => item.requestId === request.id && item.reviewerId === currentProfile.id && !item.completed);
    if (!review) return;
    const recommendation = window.prompt("Recommendation for admin", review.recommendation || "Approve / Reject / Need more info") || review.recommendation;
    const comment = window.prompt("Review comment", review.comment) || review.comment;
    updateState((current) => withActivity({
      ...current,
      requestReviews: current.requestReviews.map((item) => (item.id === review.id ? { ...item, recommendation, comment, completed: true } : item)),
      requests: current.requests.map((item) => (item.id === request.id ? { ...item, status: "Under Review", decisionRemarks: comment || item.decisionRemarks } : item))
    }, currentProfile, "Requests", "Completed verifier request review", "request_review", review.id, { completed: true }));
    showToast("Review completed", "Admin can now take the final request action.", "success");
  };

  return (
    <div className="space-y-4">
      <Panel title="Raise Request">
        <div className="grid gap-3 lg:grid-cols-4">
          <Select label="Request Type" value={requestType} onChange={(value) => setRequestType(value as typeof requestType)} options={[...REQUEST_TYPES]} />
          <Select label="Area" value={areaId} onChange={setAreaId} options={(isAdmin ? state.areas : areas).map((area) => ({ label: area.name, value: area.id }))} />
          <Input label="Request title" value={title} onChange={setTitle} />
          <Select label="Priority" value="Medium" onChange={() => undefined} options={[...PRIORITY_OPTIONS]} disabled />
        </div>
        <textarea className="field mt-3 min-h-20" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Request details" />
        <button className="btn-primary mt-3" onClick={createRequest}>Submit Request</button>
      </Panel>
      <Panel title="Requests">
        <ResponsiveTable
          headers={["Type", "Area", "Title", "Status", "Review", "Action"]}
          rows={visibleRequests.map((request) => [
            request.requestType,
            areaName(state, request.areaId),
            request.title,
            <StatusBadge key="status" value={request.status} />,
            state.requestReviews.filter((review) => review.requestId === request.id).map((review) => {
              const reviewer = state.profiles.find((profile) => profile.id === review.reviewerId)?.fullName || "Verifier";
              return `${reviewer}: ${review.completed ? review.recommendation || "Completed" : "Pending"}`;
            }).join("; ") || "-",
            isAdmin ? (
              <div key="action" className="grid gap-2">
                <select className="field" value={request.status} onChange={(event) => changeStatus(request, event.target.value as RequestStatus)}>
                  {REQUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select className="field" value={reviewerByRequest[request.id] || ""} onChange={(event) => setReviewerByRequest((current) => ({ ...current, [request.id]: event.target.value }))}>
                    <option value="">Send to verifier</option>
                    {verifierOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}
                  </select>
                  <button className="btn-compact" onClick={() => sendForVerification(request)}>Send</button>
                </div>
              </div>
            ) : assignedReviewRequestIds.has(request.id) ? <button key="complete" className="btn-compact" onClick={() => completeReview(request)}>Complete Review</button> : "-"
          ])}
        />
      </Panel>
    </div>
  );
}

function UsersAccessTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const isAdmin = ["super_admin", "admin"].includes(currentProfile.role);
  const isAreaAdmin = currentProfile.role === "area_admin";
  const isVerifier = currentProfile.role === "verifier";
  const managedAreas = isAdmin ? state.areas : getAllowedAreas(state, currentProfile);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("report_user");
  const [areaId, setAreaId] = useState(managedAreas[0]?.id || "");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const shownProfiles = isAdmin
    ? state.profiles
    : state.profiles.filter((profile) => {
      const access = state.areaAccess.filter((item) => item.profileId === profile.id);
      return access.some((item) => managedAreas.some((area) => area.id === item.areaId)) || profile.createdBy === currentProfile.id;
    });
  const canAddUsers = isAdmin || isAreaAdmin;
  const addUser = async () => {
    if (!email.trim() || !name.trim()) {
      showToast("User details required", "Enter the full name and login ID before creating credentials.", "warning");
      return;
    }
    const assignedRole = isAreaAdmin ? "report_user" : role;
    try {
      setAccessMessage("Creating user credentials...");
      const result = isEventPrepSupabaseConfigured()
        ? await createCredentialUser({ fullName: name, email, role: assignedRole, areaId, password: customPassword || undefined })
        : {
          profile: {
            id: id("profile"),
            email: email.trim().toLowerCase(),
            fullName: name.trim(),
            role: assignedRole,
            status: isAreaAdmin ? "pending_approval" as const : "active" as const,
            mustChangePassword: true,
            createdBy: currentProfile.id
          },
          temporaryPassword: customPassword || generateTemporaryPassword()
        };
      const profile = result.profile;
      updateState((current) => ({
        ...withActivity(current, currentProfile, "Access changes", `Created ${roleLabel(profile.role)} credentials`, "profile", profile.id, { pendingApproval: profile.status === "pending_approval" }),
        profiles: [profile, ...current.profiles.filter((item) => item.id !== profile.id)],
        areaAccess: areaId ? [{ id: `access-${profile.id}-${areaId}-${profile.role}`, profileId: profile.id, areaId, role: profile.role }, ...current.areaAccess.filter((access) => !(access.profileId === profile.id && access.areaId === areaId && access.role === profile.role))] : current.areaAccess,
        notifications: [createInAppNotification(profile.id, "Access request approved/rejected", "User created / pending approval", "Your credentials were created. Use the temporary password and change it on first login.", { areaId }), ...current.notifications]
      }));
      setTemporaryPassword(result.temporaryPassword);
      setAccessMessage(profile.status === "pending_approval" ? "User created / pending approval." : "User credentials created.");
      showToast(profile.status === "pending_approval" ? "User pending approval" : "Credentials created", "Temporary password is shown once in this panel.", profile.status === "pending_approval" ? "info" : "success");
      setEmail("");
      setName("");
      setCustomPassword("");
    } catch (error) {
      setAccessMessage(readError(error, "Unable to create user credentials."));
      showToast("Could not create credentials", readError(error, "Please check the details and try again."), "error");
    }
  };
  const canApprove = (profile: Profile) => {
    if (isAdmin) return true;
    if (!isVerifier) return false;
    const profileAreaIds = state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => access.areaId);
    return profileAreaIds.some((profileAreaId) => managedAreas.some((area) => area.id === profileAreaId));
  };
  const approve = async (profile: Profile) => {
    try {
      setAccessMessage("Approving user...");
      const result = isEventPrepSupabaseConfigured() ? await approveCredentialUser(profile.id) : { profile: { ...profile, status: "active" as const } };
      updateState((current) => withActivity({
        ...current,
        profiles: current.profiles.map((item) => (item.id === profile.id ? result.profile : item)),
        notifications: [createInAppNotification(profile.id, "Access request approved/rejected", "Access approved", "Your dashboard access is active.", {}), ...current.notifications]
      }, currentProfile, "Access changes", `Approved access for ${profile.fullName}`, "profile", profile.id, { approved: true }));
      setAccessMessage("User approved.");
      showToast("User approved", `${profile.fullName} can now sign in.`, "success");
    } catch (error) {
      setAccessMessage(readError(error, "Unable to approve user."));
      showToast("Approval failed", readError(error, "Please try again."), "error");
    }
  };
  const resetPassword = async (profile: Profile) => {
    try {
      setAccessMessage("Resetting password...");
      const result = isEventPrepSupabaseConfigured() ? await resetCredentialPassword(profile.id) : { profile: { ...profile, mustChangePassword: false }, temporaryPassword: generateTemporaryPassword() };
      updateState((current) => withActivity({
        ...current,
        profiles: current.profiles.map((item) => (item.id === profile.id ? result.profile : item)),
        notifications: [createInAppNotification(profile.id, "Access request approved/rejected", "Password reset", "Super Admin reset your password.", {}), ...current.notifications]
      }, currentProfile, "Access changes", `Reset password for ${profile.fullName}`, "profile", profile.id, { passwordReset: true }));
      setTemporaryPassword(result.temporaryPassword);
      setAccessMessage("Password reset. The new password is shown below once.");
      showToast("Password reset", "The new temporary password is shown once in this panel.", "success");
    } catch (error) {
      setAccessMessage(readError(error, "Unable to reset password."));
      showToast("Password reset failed", readError(error, "Please try again."), "error");
    }
  };

  return (
    <div className="space-y-4">
      {canAddUsers ? <Panel title={isAreaAdmin ? "Create Report User Credentials" : "Create User Credentials"}>
        <div className="grid gap-3 lg:grid-cols-5">
          <Input label="Full name" value={name} onChange={setName} />
          <Input label="Login ID / Email" value={email} onChange={setEmail} type="email" />
          <Select label="Role" value={isAreaAdmin ? "report_user" : role} onChange={(value) => setRole(value as UserRole)} disabled={isAreaAdmin} options={["super_admin", "admin", "area_admin", "verifier", "report_user", "viewer"].map((value) => ({ label: roleLabel(value as UserRole), value }))} />
          <Select label="Area access" value={areaId} onChange={setAreaId} options={managedAreas.map((area) => ({ label: area.name, value: area.id }))} />
          <Input label="Temporary password (optional)" value={customPassword} onChange={setCustomPassword} type="text" />
          <button className="btn-primary self-end" onClick={addUser}>Create Credentials</button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">No email is sent. Share the temporary password manually and only with the correct user.</p>
        {temporaryPassword ? <p className="mt-3 rounded-lg bg-[var(--color-accent-light)] p-3 text-sm font-black text-[var(--color-primary)]">Temporary password shown once: {temporaryPassword}</p> : null}
        {accessMessage ? <p className="mt-3 text-sm font-bold text-[var(--color-primary)]">{accessMessage}</p> : null}
      </Panel> : null}
      <Panel title="Users & Access">
        <ResponsiveTable
          headers={["Name", "Login ID", "Role", "Status", "Areas", "Action"]}
          rows={shownProfiles.map((profile) => [
            profile.fullName,
            profile.email,
            roleLabel(profile.role),
            <StatusBadge key="status" value={profile.status.replace("_", " ")} />,
            state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => areaName(state, access.areaId)).join(", ") || "All / not restricted",
            <div key="actions" className="flex flex-col gap-2">
              {profile.status === "pending_approval" && canApprove(profile) ? <button className="btn-compact" onClick={() => approve(profile)}>Approve</button> : null}
              {currentProfile.role === "super_admin" ? <button className="btn-compact" onClick={() => resetPassword(profile)}>Reset Password</button> : null}
              {profile.status !== "pending_approval" && currentProfile.role !== "super_admin" ? "-" : null}
            </div>
          ])}
        />
      </Panel>
    </div>
  );
}

function MyAreaTab({ state, currentProfile }: { state: EventPrepState; currentProfile: Profile }) {
  const areas = getAllowedAreas(state, currentProfile);
  return (
    <Panel title="My Area Access">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => (
          <div key={area.id} className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <Badge>{zoneName(state, area.zoneTypeId)}</Badge>
            <h3 className="mt-2 font-black text-[var(--color-primary)]">{area.name}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Daily deadline {area.dailyDeadline}. Reminder {area.reminderTime}.</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ProfileTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const submit = async () => {
    try {
      if (password !== confirm) throw new Error("Passwords do not match.");
      setMessage("Changing password...");
      const result = isEventPrepSupabaseConfigured() ? await changeCurrentPassword(password) : { profile: { ...currentProfile, mustChangePassword: false } };
      updateState((current) => ({
        ...current,
        profiles: current.profiles.map((profile) => (profile.id === currentProfile.id ? result.profile : profile))
      }));
      setPassword("");
      setConfirm("");
      setMessage("Password changed.");
      showToast("Password changed", "Your new password is active now.", "success");
    } catch (error) {
      setMessage(readError(error, "Unable to change password."));
      showToast("Password change failed", readError(error, "Please check both fields and try again."), "error");
    }
  };
  return (
    <div className="space-y-4">
      <Panel title="Profile / Access">
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniStat label="Name" value={currentProfile.fullName} />
          <MiniStat label="Login ID" value={currentProfile.email} />
          <MiniStat label="Role" value={roleLabel(currentProfile.role)} />
          <MiniStat label="Status" value={currentProfile.status.replace("_", " ")} />
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Authorized areas: {getAllowedAreas(state, currentProfile).map((area) => area.name).join(", ") || "All areas for admin roles"}</p>
      </Panel>
      <Panel title="Change My Password">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Input label="New password" value={password} onChange={setPassword} type="password" />
          <Input label="Confirm password" value={confirm} onChange={setConfirm} type="password" />
          <button className="btn-primary" onClick={submit}>Change Password</button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">After credentials are created, only you or the Super Admin can change this password.</p>
        {message ? <p className="mt-3 text-sm font-bold text-[var(--color-primary)]">{message}</p> : null}
      </Panel>
    </div>
  );
}

function FoundationTab({
  state,
  tab,
  currentProfile,
  updateState,
  showToast
}: {
  state: EventPrepState;
  tab: AnyTab;
  currentProfile: Profile;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
  showToast: ShowToast;
}) {
  if (tab === "Forms") return <FormBuilderTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} />;
  if (tab === "Global Fields") return <GlobalFieldsTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} />;
  if (tab === "Reports") return <EmptyState title="Reports foundation ready" body="PDF and Excel exports are reserved for Phase 3. The schema already includes report_exports." />;
  return <ActivityLogTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} />;
}

function FormBuilderTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const [taskType, setTaskType] = useState<TaskTypeName>("Simple Task");
  const [label, setLabel] = useState("");
  const addField = () => {
    if (!label.trim()) {
      showToast("Field label required", "Add a label before creating the form field.", "warning");
      return;
    }
    const fieldLabel = label.trim();
    updateState((current) => {
      const fieldsForType = current.formFields.filter((field) => field.taskType === taskType);
      const field: FormField = {
        id: id("field"),
        taskType,
        fieldKey: slug(fieldLabel),
        label: fieldLabel,
        required: false,
        visible: true,
        displayOrder: fieldsForType.length + 1
      };
      return withActivity({ ...current, formFields: [...current.formFields, field] }, currentProfile, "Form/global field changes", `Added form field ${field.label}`, "form_field", field.id, { visible: true });
    });
    setLabel("");
    showToast("Form field added", `${fieldLabel} was added to ${taskType}.`);
  };
  const updateField = (fieldId: string, patch: Partial<FormField>) => {
    updateState((current) => withActivity({
      ...current,
      formFields: current.formFields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    }, currentProfile, "Form/global field changes", "Updated form field", "form_field", fieldId, { changed: true }));
  };
  return (
    <div className="space-y-4">
      <Panel title="Add Form Field">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Select label="Task Type" value={taskType} onChange={(value) => setTaskType(value as TaskTypeName)} options={[...TASK_TYPES]} />
          <Input label="Field label" value={label} onChange={setLabel} placeholder="Testing result" />
          <button className="btn-primary" onClick={addField}>Add Field</button>
        </div>
      </Panel>
      <Panel title="Task Type Form Builder">
        <ResponsiveTable
          headers={["Task Type", "Field", "Order", "Visible", "Required"]}
          rows={state.formFields
            .slice()
            .sort((a, b) => a.taskType.localeCompare(b.taskType) || a.displayOrder - b.displayOrder)
            .map((field) => [
              field.taskType,
              <input key="label" className="field" value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} />,
              <input key="order" className="field w-20" type="number" value={field.displayOrder} onChange={(event) => updateField(field.id, { displayOrder: Number(event.target.value || 0) })} />,
              <input key="visible" type="checkbox" checked={field.visible} onChange={(event) => updateField(field.id, { visible: event.target.checked })} />,
              <input key="required" type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
            ])}
        />
      </Panel>
    </div>
  );
}

function GlobalFieldsTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const groups = unique(state.globalOptions.map((option) => option.group));
  const [group, setGroup] = useState(groups[0] || "Workstreams");
  const [value, setValue] = useState("");
  const addOption = () => {
    if (!group.trim() || !value.trim()) {
      showToast("Option details required", "Add both the group and value before saving.", "warning");
      return;
    }
    const optionValue = value.trim();
    updateState((current) => {
      const option: GlobalOption = { id: id("option"), group: group.trim(), value: optionValue, active: true };
      return withActivity({ ...current, globalOptions: [...current.globalOptions, option] }, currentProfile, "Form/global field changes", `Added global option ${option.value}`, "global_option", option.id, { active: true });
    });
    setValue("");
    showToast("Global option added", `${optionValue} is now available in ${group.trim()}.`);
  };
  const updateOption = (optionId: string, patch: Partial<GlobalOption>) => {
    updateState((current) => withActivity({
      ...current,
      globalOptions: current.globalOptions.map((option) => (option.id === optionId ? { ...option, ...patch } : option))
    }, currentProfile, "Form/global field changes", "Updated global option", "global_option", optionId, { changed: true }));
  };
  return (
    <div className="space-y-4">
      <Panel title="Add Global Option">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Input label="Group" value={group} onChange={setGroup} placeholder="Team Types" />
          <Input label="Value" value={value} onChange={setValue} placeholder="Fiber Team" />
          <button className="btn-primary" onClick={addOption}>Add Option</button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Editable options are used by Phase 2 forms and task setup where applicable.</p>
      </Panel>
      <Panel title="Global Fields / Options">
        <ResponsiveTable
          headers={["Group", "Value", "Active"]}
          rows={state.globalOptions
            .slice()
            .sort((a, b) => a.group.localeCompare(b.group) || a.value.localeCompare(b.value))
            .map((option) => [
              option.group,
              <input key="value" className="field" value={option.value} onChange={(event) => updateOption(option.id, { value: event.target.value })} />,
              <input key="active" type="checkbox" checked={option.active} onChange={(event) => updateOption(option.id, { active: event.target.checked })} />
            ])}
        />
      </Panel>
    </div>
  );
}

function ActivityLogTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const activityOptions = state.globalOptions.filter((option) => option.group === "Activity Log Categories");
  const updateOption = (optionId: string, active: boolean) => {
    updateState((current) => ({
      ...current,
      globalOptions: current.globalOptions.map((option) => (option.id === optionId ? { ...option, active } : option))
    }));
    showToast("Activity setting updated", `Logging is now ${active ? "on" : "off"} for this category.`, "info");
  };
  return (
    <div className="space-y-4">
      <Panel title="Activity Log Settings">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activityOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm font-bold text-[var(--color-primary)]">
              <input type="checkbox" checked={option.active} onChange={(event) => updateOption(option.id, event.target.checked)} />
              {option.value}
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Activity Log">
        <ResponsiveTable
          headers={["Time", "Category", "Actor", "Action", "Entity"]}
          rows={state.activityLogs.map((log) => [
            new Date(log.createdAt).toLocaleString(),
            log.category,
            state.profiles.find((profile) => profile.id === log.actorId)?.fullName || "System",
            log.action,
            `${log.entityType}${log.entityId ? ` / ${log.entityId}` : ""}`
          ])}
        />
      </Panel>
      <Panel title="In-App Notifications">
        <ResponsiveTable headers={["User", "Type", "Title", "Read"]} rows={state.notifications.map((notification) => [state.profiles.find((profile) => profile.id === notification.userId)?.fullName || "User", notification.type, notification.title, notification.isRead ? "Yes" : "No"])} />
      </Panel>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToastStack({ toasts, dismissToast }: { toasts: ToastMessage[]; dismissToast: (toastId: string) => void }) {
  if (!toasts.length) return null;
  const toneClass: Record<ToastTone, string> = {
    success: "border-[var(--color-primary)] bg-white",
    info: "border-[var(--color-accent)] bg-white",
    warning: "border-[#C9A227] bg-[#FFF8E1]",
    error: "border-[var(--color-important)] bg-white"
  };
  const dotClass: Record<ToastTone, string> = {
    success: "bg-[var(--color-primary)]",
    info: "bg-[var(--color-accent)]",
    warning: "bg-[#C9A227]",
    error: "bg-[var(--color-important)]"
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] grid w-[calc(100%-2rem)] max-w-sm gap-2 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card pointer-events-auto rounded-lg border-l-4 p-4 shadow-soft ${toneClass[toast.tone]}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${dotClass[toast.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[var(--color-primary)]">{toast.title}</p>
              {toast.message ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{toast.message}</p> : null}
            </div>
            <button className="mini-icon-btn h-8 min-h-8 w-8" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ title, value, helper, tone }: { title: string; value: string; helper: string; tone?: "good" | "warning" | "critical" }) {
  const color = tone === "critical" ? "text-[var(--color-important)]" : tone === "warning" ? "text-[#8A6F18]" : "text-[var(--color-primary)]";
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{title}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helper}</p>
    </div>
  );
}

function ProgressRow({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-bold text-[var(--color-primary)]">{label}</p>
        <p className="text-[var(--color-text-muted)]">{value}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[var(--color-accent-light)]">
        <div className="h-2 rounded-full bg-[var(--color-primary)]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helper}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 font-black text-[var(--color-primary)]">{value}</p>
    </div>
  );
}

function ResponsiveTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-black uppercase text-[var(--color-primary)]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-[var(--color-border)] px-3 py-3 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No records yet.</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="field mt-2" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const item = typeof option === "string" ? { label: option, value: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field mt-2" value={value} type={type} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="badge-gold">{children}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const cls = lower.includes("verified completed") || lower.includes("approved") || lower === "critical"
    ? "bg-[var(--color-primary)] text-white"
    : lower.includes("issue") || lower.includes("rejected") || lower.includes("late")
      ? "bg-[var(--color-important)] text-white"
      : lower.includes("needs") || lower.includes("progress") || lower.includes("partial")
        ? "bg-[var(--color-accent)] text-[var(--color-primary)]"
        : "bg-[var(--color-accent-light)] text-[var(--color-primary)]";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${cls}`}>{value}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
      <p className="font-black text-[var(--color-primary)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{body}</p>
    </div>
  );
}

function PeopleEditor<T extends EscalationPoint | SupportingPerson>({
  title,
  rows,
  onChange,
  addLabel,
  kind,
  teamTypeOptions = TEAM_TYPES
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  addLabel: string;
  kind: "escalation" | "support";
  teamTypeOptions?: readonly string[];
}) {
  const add = () =>
    onChange([
      ...rows,
      kind === "escalation"
        ? { id: id("escalation"), name: "", contactNumber: "", emailOrWhatsapp: "", roleStanding: "", teamOrganization: "", reason: "" }
        : { id: id("support"), name: "", contactNumber: "", roleStanding: "", teamTypes: [], responsibility: "" }
    ] as T[]);
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">{title}</p>
        <button className="btn-compact" onClick={add} type="button">{addLabel}</button>
      </div>
      <div className="mt-2 grid gap-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-2 rounded-lg bg-[var(--color-bg)] p-2 md:grid-cols-4">
            <input className="field" placeholder="Name" value={row.name} onChange={(event) => updatePeopleRow(rows, index, "name", event.target.value, onChange)} />
            <input className="field" placeholder="Contact number" value={row.contactNumber} onChange={(event) => updatePeopleRow(rows, index, "contactNumber", event.target.value, onChange)} />
            <input className="field" placeholder="Role / Standing" value={row.roleStanding} onChange={(event) => updatePeopleRow(rows, index, "roleStanding", event.target.value, onChange)} />
            {kind === "escalation" && "reason" in row ? (
              <input className="field" placeholder="Reason" value={row.reason} onChange={(event) => updatePeopleRow(rows, index, "reason", event.target.value, onChange)} />
            ) : (
              <input className="field" placeholder="Responsibility" value={"responsibility" in row ? row.responsibility : ""} onChange={(event) => updatePeopleRow(rows, index, "responsibility", event.target.value, onChange)} />
            )}
            {kind === "support" && "teamTypes" in row ? (
              <div className="md:col-span-4">
                <p className="mb-2 text-xs font-bold uppercase text-[var(--color-text-muted)]">Team Type</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {teamTypeOptions.map((teamType) => (
                    <label key={teamType} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-xs font-bold text-[var(--color-primary)]">
                      <input
                        type="checkbox"
                        checked={row.teamTypes.includes(teamType)}
                        onChange={(event) => {
                          const next = event.target.checked ? [...row.teamTypes, teamType] : row.teamTypes.filter((value) => value !== teamType);
                          updatePeopleRow(rows, index, "teamTypes", next, onChange);
                        }}
                      />
                      {teamType}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function updatePeopleRow<T extends EscalationPoint | SupportingPerson>(rows: T[], index: number, key: string, value: unknown, onChange: (rows: T[]) => void) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)) as T[]);
}

function tabIcon(tab: AnyTab) {
  const props = { size: 18 };
  if (tab.includes("Dashboard")) return <BarChart3 {...props} />;
  if (tab.includes("Report")) return <FileText {...props} />;
  if (tab.includes("Task")) return <FileSpreadsheet {...props} />;
  if (tab.includes("Zone")) return <Filter {...props} />;
  if (tab.includes("Verification")) return <ShieldCheck {...props} />;
  if (tab.includes("Request")) return <ClipboardCheck {...props} />;
  if (tab.includes("User") || tab.includes("Access")) return <Users {...props} />;
  if (tab.includes("Activity")) return <CalendarClock {...props} />;
  return <CheckCircle2 {...props} />;
}

function activeOptions(state: EventPrepState, group: string, fallback: readonly string[]) {
  const options = state.globalOptions.filter((option) => option.group === group && option.active).map((option) => option.value);
  return options.length ? options : [...fallback];
}

function isFormFieldVisible(state: EventPrepState, taskType: TaskTypeName, fieldKey: string) {
  const field = state.formFields.find((item) => item.taskType === taskType && item.fieldKey === fieldKey);
  return field ? field.visible : true;
}

function canActOnVerification(task: LiveTask, update: TaskUpdate, profile: Profile, logs: VerificationLog[]) {
  if (["super_admin", "admin"].includes(profile.role)) return true;
  if (!task.assignedVerifierIds.includes(profile.id)) return false;
  const verifiedIds = logs
    .filter((log) => log.taskUpdateId === update.id && log.action === "verified")
    .map((log) => log.verifierId);
  if (verifiedIds.includes(profile.id)) return false;
  if (task.verificationRule !== "sequential") return true;
  const nextVerifier = task.assignedVerifierIds.find((verifierId) => !verifiedIds.includes(verifierId));
  return nextVerifier === profile.id;
}

function nextVerificationStatus(task: LiveTask, update: TaskUpdate, profile: Profile, logs: VerificationLog[]): VerificationStatus {
  if (["super_admin", "admin"].includes(profile.role) || !task.verificationRequired || task.verificationRule === "one_verifier") return "Verified Completed";
  const verifiedIds = new Set(logs.filter((log) => log.taskUpdateId === update.id && log.action === "verified").map((log) => log.verifierId));
  return task.assignedVerifierIds.every((verifierId) => verifiedIds.has(verifierId)) ? "Verified Completed" : "Partially Verified";
}

function verificationRuleLabel(rule: LiveTask["verificationRule"]) {
  if (rule === "all_verifiers") return "All verifiers required";
  if (rule === "sequential") return "Sequential verification";
  return "One verifier enough";
}

function withActivity(
  state: EventPrepState,
  actor: Profile,
  category: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: ActivityLog["metadata"] = {}
) {
  const setting = state.globalOptions.find((option) => option.group === "Activity Log Categories" && option.value === category);
  if (setting && !setting.active) return state;
  const log: ActivityLog = {
    id: id("activity"),
    category,
    actorId: actor.id,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: new Date().toISOString()
  };
  return { ...state, activityLogs: [log, ...state.activityLogs].slice(0, 500) };
}

function unreadNotificationsFor(state: EventPrepState, profile: Profile) {
  return state.notifications.filter((notification) => notification.userId === profile.id && !notification.isRead);
}

function buildUserAlerts(state: EventPrepState, profile: Profile): InAppNotification[] {
  const latest = latestUpdateMap(state.taskUpdates);
  const today = todayIso();
  const allowedAreas = getAllowedAreas(state, profile);
  const allowedAreaIds = allowedAreas.map((area) => area.id);
  const notifications: InAppNotification[] = [];
  const push = (type: InAppNotification["type"], title: string, message: string, extra: Partial<InAppNotification> = {}) => {
    notifications.push({
      id: `generated-${type}-${slug(title)}-${extra.relatedTaskId || extra.relatedRequestId || extra.relatedDailyReportId || ""}`,
      userId: profile.id,
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      ...extra
    });
  };

  if (["super_admin", "admin"].includes(profile.role)) {
    buildAttention(state).forEach((item) => {
      if (item.count > 0) push(item.type, item.label, `${item.count} item(s) need attention.`);
    });
    return notifications;
  }

  if (profile.role === "verifier") {
    const queueCount = state.liveTasks.filter((task) => {
      const update = latest.get(task.id);
      return update && ["Needs Verification", "Partially Verified"].includes(update.verificationStatus) && task.assignedVerifierIds.includes(profile.id) && allowedAreaIds.includes(task.areaId);
    }).length;
    if (queueCount) push("Task needs verification", "Verification Queue", `${queueCount} task(s) are waiting for your verification.`);
  }

  if (profile.role === "report_user" || profile.role === "area_admin") {
    allowedAreas.forEach((area) => {
      const report = state.dailyReports.find((item) => item.areaId === area.id && item.reportDate === today);
      if (!report) push("Daily report reminder", "Today's report pending", `${area.name} has no submitted report for today.`, { areaId: area.id });
      if (report?.status === "Draft Saved") push("Partially updated report", "Draft saved but not submitted", `${area.name} has a draft report waiting for submission.`, { areaId: area.id, relatedDailyReportId: report.id });
    });
  }

  const assignedTasks = state.liveTasks.filter((task) => allowedAreaIds.includes(task.areaId) && (profile.role !== "report_user" || task.assignedProfileIds.includes(profile.id)));
  assignedTasks.forEach((task) => {
    const update = latest.get(task.id);
    const template = state.taskTemplates.find((item) => item.id === task.templateId);
    if (update?.verificationStatus === "Rejected / Needs Correction") push("Task needs correction", "Task needs correction", template?.taskDetails || "A task needs correction.", { areaId: task.areaId, relatedTaskId: task.id });
    if (task.dueDate < today && update?.verificationStatus !== "Verified Completed") push("Overdue task", "Overdue assigned task", template?.taskDetails || "An assigned task is overdue.", { areaId: task.areaId, relatedTaskId: task.id });
  });

  state.requests
    .filter((request) => request.requestedBy === profile.id && request.status === "Need More Info")
    .forEach((request) => push("Request status changed", "Request needs more info", request.title, { areaId: request.areaId, relatedRequestId: request.id }));

  return notifications;
}

function createInAppNotification(
  userId: string,
  type: InAppNotification["type"],
  title: string,
  message: string,
  extra: Partial<Pick<InAppNotification, "areaId" | "relatedTaskId" | "relatedRequestId" | "relatedDailyReportId">>
): InAppNotification {
  return {
    id: id("notification"),
    userId,
    type,
    title,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function notifyAdmins(
  state: EventPrepState,
  type: InAppNotification["type"],
  title: string,
  message: string,
  extra: Partial<Pick<InAppNotification, "areaId" | "relatedTaskId" | "relatedRequestId" | "relatedDailyReportId">>
) {
  return state.profiles
    .filter((profile) => ["super_admin", "admin"].includes(profile.role) && profile.status === "active")
    .map((profile) => createInAppNotification(profile.id, type, title, message, extra));
}

function buildMetrics(state: EventPrepState): DashboardMetrics {
  const tasks = state.liveTasks.filter((task) => task.active && !task.notApplicable);
  const latest = latestUpdateMap(state.taskUpdates);
  const todayReports = state.dailyReports.filter((report) => report.reportDate === todayIso());
  const verifiedTasks = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
  const submittedReports = todayReports.filter((report) => ["Submitted", "Late Submitted", "Closed"].includes(report.status)).length;
  const partialReports = todayReports.filter((report) => ["Draft Saved", "Partially Updated"].includes(report.status)).length;
  const missingReports = state.areas.filter((area) => area.active).length - todayReports.filter((report) => ["Submitted", "Late Submitted", "Closed", "Draft Saved", "Partially Updated"].includes(report.status)).length;
  return {
    overallVerifiedPercent: percent(verifiedTasks, tasks.length),
    totalLiveTasks: tasks.length,
    verifiedTasks,
    submittedReports,
    missingOrPartialReports: Math.max(0, missingReports) + partialReports,
    needsVerification: tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Needs Verification").length,
    issueFound: tasks.filter((task) => latest.get(task.id)?.status === "Issue Found").length,
    pendingRequests: state.requests.filter((request) => ["Under Review", "Sent for Verification", "Need More Info"].includes(request.status)).length,
    daysToEvent: Math.max(0, Math.ceil((new Date(`${state.settings.eventStartDate}T00:00:00`).getTime() - Date.now()) / 86400000))
  };
}

function buildAttention(state: EventPrepState) {
  const latest = latestUpdateMap(state.taskUpdates);
  const tasks = state.liveTasks.filter((task) => task.active && !task.notApplicable);
  const todayReports = state.dailyReports.filter((report) => report.reportDate === todayIso());
  const missingReports = state.areas.filter((area) => area.active).length - todayReports.filter((report) => ["Submitted", "Late Submitted", "Closed", "Draft Saved", "Partially Updated"].includes(report.status)).length;
  return [
    { label: "Missing Daily Reports", count: Math.max(0, missingReports), type: "Missing report" as const },
    { label: "Partially Updated Reports", count: todayReports.filter((report) => ["Draft Saved", "Partially Updated"].includes(report.status)).length, type: "Partially updated report" as const },
    { label: "Late Submitted Reports", count: todayReports.filter((report) => report.status === "Late Submitted").length, type: "Partially updated report" as const },
    { label: "Escalated Reports", count: todayReports.filter((report) => report.status === "Escalated").length, type: "Missing report" as const },
    { label: "Issue Found Tasks", count: tasks.filter((task) => latest.get(task.id)?.status === "Issue Found").length, type: "Overdue task" as const },
    { label: "Tasks Needing Verification", count: tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Needs Verification").length, type: "Task needs verification" as const },
    { label: "Rejected / Needs Correction", count: tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Rejected / Needs Correction").length, type: "Task needs correction" as const },
    { label: "Pending Requests", count: state.requests.filter((request) => request.status === "Under Review").length, type: "Request status changed" as const },
    { label: "Overdue Tasks", count: tasks.filter((task) => task.dueDate < todayIso() && latest.get(task.id)?.verificationStatus !== "Verified Completed").length, type: "Overdue task" as const }
  ];
}

function latestUpdateMap(updates: TaskUpdate[]) {
  const map = new Map<string, TaskUpdate>();
  updates
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .forEach((update) => {
      if (!map.has(update.liveTaskId)) map.set(update.liveTaskId, update);
    });
  return map;
}

function getAllowedAreas(state: EventPrepState, profile: Profile) {
  if (["super_admin", "admin"].includes(profile.role)) return state.areas;
  const accessAreaIds = state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => access.areaId);
  return state.areas.filter((area) => accessAreaIds.includes(area.id));
}

function getCurrentProfile(state: EventPrepState, currentProfileId: string, sessionEmail: string, sessionUserId = "") {
  if (isEventPrepSupabaseConfigured()) {
    return state.profiles.find((profile) => profile.id === sessionUserId || profile.email.toLowerCase() === sessionEmail.toLowerCase());
  }
  return state.profiles.find((profile) => profile.id === currentProfileId) || state.profiles[0];
}

function getOrCreateReport(state: EventPrepState, areaId: string, prepDay: number): DailyReport {
  return (
    state.dailyReports.find((report) => report.areaId === areaId && report.reportDate === todayIso()) || {
      id: `report-${areaId}-${todayIso()}`,
      areaId,
      reportDate: todayIso(),
      prepDay,
      status: "Not Started",
      generalRemark: "",
      updatedAt: new Date().toISOString()
    }
  );
}

function upsertReport(state: EventPrepState, report: DailyReport): EventPrepState {
  return { ...state, dailyReports: [report, ...state.dailyReports.filter((item) => item.id !== report.id)] };
}

function createTaskUpdate(task: LiveTask, report: DailyReport, profileId: string, latest?: TaskUpdate): TaskUpdate {
  return {
    id: id("update"),
    liveTaskId: task.id,
    dailyReportId: report.id,
    updatedBy: profileId,
    status: latest?.status || "Pending",
    verificationStatus: latest?.verificationStatus === "Rejected / Needs Correction" ? "Rejected / Needs Correction" : "Not Submitted",
    remarks: latest?.remarks || "",
    completedQuantity: latest?.completedQuantity || 0,
    userRoleStanding: latest?.userRoleStanding || "",
    escalationPoints: latest?.escalationPoints || [],
    supportingPersonnel: latest?.supportingPersonnel || [],
    correctionComment: latest?.correctionComment,
    updatedAt: new Date().toISOString()
  };
}

async function parsePreparationPlan(file: File): Promise<TaskTemplate[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return rowsToTemplates(parseCsv(await file.text()));
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "day plan") || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rowsToTemplates(rows);
}

function rowsToTemplates(rows: Array<Record<string, unknown>>): TaskTemplate[] {
  return rows
    .map((row) => {
      const get = (key: string) => String(row[key] ?? row[toCamel(key)] ?? row[key.toLowerCase()] ?? "").trim();
      const taskDetails = get("Task Details");
      if (!taskDetails) return null;
      const priority = normalizePriority(get("Priority Level"));
      return {
        id: `template-${slug(`${get("Day")}-${get("Workstream")}-${taskDetails}`)}`,
        day: Math.min(20, Math.max(1, Number(get("Day").replace(/[^0-9]/g, "")) || 1)),
        priorityLevel: priority,
        mainObjective: get("Main Objective"),
        workstream: get("Workstream") || "General",
        taskDetails,
        responsibleTeam: get("Responsible Team"),
        followUpQuestions: get("Local Team Follow-up Questions"),
        requiredEquipment: get("Required Equipment"),
        expectedOutput: get("Expected Output"),
        testingRequired: get("Testing Required"),
        hiddenReference: { dependencies: get("Dependencies"), riskIfDelayed: get("Risk if Delayed") },
        importedAt: new Date().toISOString()
      } satisfies TaskTemplate;
    })
    .filter(Boolean) as TaskTemplate[];
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0] || []);
  return lines.slice(1).map((line) => Object.fromEntries(splitCsvLine(line).map((cell, index) => [headers[index], cell])));
}

function splitCsvLine(line: string | string[]) {
  if (Array.isArray(line)) return line;
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function createLiveTask(template: TaskTemplate | undefined, areaId: string, taskType: LiveTask["taskType"], requiredQuantity: number, unit: string, state: EventPrepState, preparationStartDate: string): LiveTask | null {
  if (!template) return null;
  const areaAccess = state.areaAccess.filter((access) => access.areaId === areaId);
  const verifierIds = areaAccess.filter((access) => access.role === "verifier").map((access) => access.profileId);
  const reportUserIds = areaAccess.filter((access) => access.role === "report_user").map((access) => access.profileId);
  return {
    id: `live-${areaId}-${template.id}`,
    templateId: template.id,
    areaId,
    taskType,
    prepDay: template.day,
    startDate: addDays(preparationStartDate, template.day - 1),
    dueDate: addDays(preparationStartDate, template.day - 1),
    priority: template.priorityLevel,
    requiredQuantity: taskType === "Quantity-Based Task" ? requiredQuantity : undefined,
    unit: taskType === "Quantity-Based Task" ? unit : undefined,
    assignedProfileIds: reportUserIds,
    assignedVerifierIds: verifierIds,
    verificationRequired: true,
    verificationRule: "one_verifier",
    evidenceNote: "",
    active: true,
    notApplicable: false
  };
}

function mergeTemplates(existing: TaskTemplate[], imported: TaskTemplate[]) {
  const byId = new Map(existing.map((template) => [template.id, template]));
  imported.forEach((template) => byId.set(template.id, template));
  return Array.from(byId.values()).sort((a, b) => a.day - b.day || a.workstream.localeCompare(b.workstream));
}

function areaName(state: EventPrepState, areaId: string) {
  return state.areas.find((area) => area.id === areaId)?.name || "Unknown area";
}

function zoneName(state: EventPrepState, zoneTypeId: string) {
  return state.zoneTypes.find((zone) => zone.id === zoneTypeId)?.name || "Unknown zone";
}

function prepDayForDate(preparationStartDate: string, date: string) {
  const start = new Date(`${preparationStartDate}T00:00:00`).getTime();
  const current = new Date(`${date}T00:00:00`).getTime();
  return Math.min(20, Math.max(1, Math.floor((current - start) / 86400000) + 1));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isLate(deadline: string) {
  const [hours, minutes] = deadline.split(":").map(Number);
  const now = new Date();
  return now.getHours() > hours || (now.getHours() === hours && now.getMinutes() > minutes);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function normalizePriority(value: string) {
  const found = PRIORITY_OPTIONS.find((priority) => priority.toLowerCase() === value.toLowerCase());
  return found || "Medium";
}

function roleLabel(role: UserRole) {
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let value = "Am#";
  for (let index = 0; index < 11; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function toCamel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase()).replace(/[^a-z0-9]/g, "");
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

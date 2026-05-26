"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  KeyRound,
  LogOut,
  Menu,
  Plus,
  Presentation,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
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
  VERIFICATION_STATUSES,
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
  type ReportExport,
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
  subscribeToEventPrepChanges,
  updateCredentialAccess,
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
type TaskView = "all" | "today" | "pending" | "issue" | "correction" | "overdue";
type DashboardChartKind = "Progress bars" | "Compact bars" | "Donut chart" | "Score cards";
type AttentionChartKind = "Score cards" | "Compact list";
type DashboardChartSettings = {
  zoneType: DashboardChartKind;
  area: DashboardChartKind;
  day: DashboardChartKind;
  workstream: DashboardChartKind;
  attention: AttentionChartKind;
};
type PublicAreaOption = { id: string; name: string; zoneName: string };
type ToastTone = "success" | "info" | "warning" | "error";
type ToastMessage = { id: string; title: string; message?: string; tone: ToastTone };
type ShowToast = (title: string, message?: string, tone?: ToastTone) => void;

const DEFAULT_DASHBOARD_CHARTS: DashboardChartSettings = {
  zoneType: "Progress bars",
  area: "Progress bars",
  day: "Compact bars",
  workstream: "Progress bars",
  attention: "Score cards"
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [dashboardCharts, setDashboardCharts] = useState<DashboardChartSettings>(DEFAULT_DASHBOARD_CHARTS);
  const [syncStatus, setSyncStatus] = useState("Loading");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionUserId, setSessionUserId] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const skipNextSaveRef = useRef(false);

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
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveTimerRef.current = window.setTimeout(() => {
      const activeProfile = getCurrentProfile(state, currentProfileId, sessionEmail, sessionUserId);
      if (isEventPrepSupabaseConfigured() && !activeProfile) return;
      saveEventPrepState(state, activeProfile)
        .then(() => setSyncStatus(isEventPrepSupabaseConfigured() ? "Saved to Supabase" : "Saved locally"))
        .catch((error) => {
          console.warn("Supabase sync failed.", error);
          setSyncStatus(readError(error, "Supabase sync failed"));
        });
    }, 450);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [currentProfileId, sessionEmail, sessionUserId, state]);

  useEffect(() => {
    if (!isEventPrepSupabaseConfigured() || !authChecked || !sessionEmail) return;
    return subscribeToEventPrepChanges(() => {
      loadEventPrepState()
        .then((loaded) => {
          skipNextSaveRef.current = true;
          setState(loaded);
          setSyncStatus("Synced from Supabase");
        })
        .catch((error) => setSyncStatus(readError(error, "Realtime sync failed")));
    });
  }, [authChecked, sessionEmail]);

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
  const tabs: AnyTab[] = isAdmin ? ADMIN_TABS : isAreaAdmin ? AREA_ADMIN_TABS : isVerifier ? VERIFIER_TABS : isViewer ? viewerTabsFor(state || undefined, currentProfile) : USER_TABS;

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0] || (isVerifier ? "Verification" : isAreaAdmin ? "My Area" : "Daily Report"));
  }, [activeTab, isAreaAdmin, isVerifier, tabs]);

  if (isEventPrepSupabaseConfigured() && authChecked && !sessionEmail) {
    return <LoginScreen loginId={loginId} password={password} authMessage={authMessage} setLoginId={setLoginId} setPassword={setPassword} signIn={handlePasswordLogin} />;
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
        <DashboardSkeleton />
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
  const openWorkspace = (tab: AnyTab, title: string, message: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    showToast(title, message, "info");
  };
  const toggleMenu = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed((current) => !current);
      return;
    }
    setSidebarOpen(true);
  };
  const exportCsv = () => {
    exportLiveTasksCsv(state);
    showToast("CSV exported", "Live task summary downloaded from the dashboard.", "success");
  };

  if (presentationMode && activeTab === "Dashboard") {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
        <div className="mx-auto max-w-[96rem]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase text-[var(--color-accent)]">Presentation Mode</p>
              <h1 className="text-xl font-black text-[var(--color-primary)]">IT / Event Preparation Dashboard</h1>
            </div>
            <button className="btn-primary" onClick={() => setPresentationMode(false)}>Exit Presentation</button>
          </div>
          <DashboardTab state={state} currentProfile={currentProfile} presentationMode />
        </div>
        <ToastStack toasts={toasts} dismissToast={dismissToast} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex min-h-screen">
        <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-white/10 bg-[var(--color-primary)] text-white shadow-2xl transition-[transform,width] duration-300 lg:translate-x-0 ${sidebarCollapsed ? "lg:w-20" : "lg:w-80"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-start justify-between gap-3 px-5 py-6">
            <div className={sidebarCollapsed ? "lg:hidden" : ""}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/85">ASHARA MUBARAKAH</p>
              <h1 className="mt-2 text-2xl font-black leading-tight text-white">IT / Event Preparation</h1>
            </div>
            <div className={`hidden h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent)] text-[var(--color-primary)] lg:flex ${sidebarCollapsed ? "" : "lg:hidden"}`}>
              <BarChart3 size={19} />
            </div>
            <button className="mini-icon-btn border-white/20 bg-white/10 text-white hover:bg-white/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          <div className={`mx-5 rounded-lg border border-white/10 bg-white/10 p-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            {!isEventPrepSupabaseConfigured() ? (
              <>
                <label className="text-xs font-black uppercase text-white/70">Demo profile</label>
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
                <p className="text-xs font-black uppercase text-white/70">Signed in as</p>
                <p className="mt-2 text-sm font-bold text-white">{currentProfile.email}</p>
              </>
            )}
            <p className="mt-2 text-xs text-white/70">{syncStatus}</p>
          </div>

          <nav className="mt-5 flex-1 space-y-2 px-4">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`sidebar-nav-item group flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-sm font-black ${activeTab === tab ? "is-active bg-[var(--color-accent)] text-[var(--color-primary)] shadow-lg shadow-black/10" : "text-white/90 hover:bg-white/10 hover:text-white"} ${sidebarCollapsed ? "lg:justify-center lg:px-2" : ""}`}
                onClick={() => {
                  setActiveTab(tab);
                  setSidebarOpen(false);
                }}
                title={tab}
              >
                <span className="flex-none">{tabIcon(tab)}</span>
                <span className={sidebarCollapsed ? "lg:hidden" : ""}>{tab}</span>
              </button>
            ))}
          </nav>

          {!isEventPrepSupabaseConfigured() ? null : <div className={`m-5 rounded-lg border border-white/10 bg-white/10 p-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <p className="text-xs font-bold uppercase text-white/70">Password session</p>
            <button className="btn-secondary mt-2 w-full justify-center" onClick={handleSignOut}>
              <LogOut size={16} /> Sign out
            </button>
          </div>}

          <div className={`border-t border-white/10 px-5 py-4 text-xs font-bold leading-relaxed text-white/75 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            Area-wise readiness, requests, reports, and timeline tracking.
          </div>
        </aside>

        {sidebarOpen ? <button className="motion-overlay fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" /> : null}

        <section className={`min-w-0 flex-1 transition-[margin] duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-80"}`}>
          <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[rgba(250,247,239,0.96)] px-4 py-4 backdrop-blur">
            <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button className="icon-btn" onClick={toggleMenu} aria-label={sidebarCollapsed ? "Expand navigation" : "Open or collapse navigation"} title="Menu">
                  <Menu size={18} />
                </button>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--color-accent)]">{activeTab}</p>
                  <h2 className="text-2xl font-black leading-tight text-[var(--color-primary)]">IT / Event Preparation Dashboard</h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeTab === "Dashboard" ? <button className="top-action-btn" onClick={() => setChartSettingsOpen(true)}><Settings2 size={16} /> Chart Settings</button> : null}
                {activeTab === "Dashboard" ? <button className="top-action-btn" onClick={() => setPresentationMode(true)}><Presentation size={16} /> Presentation</button> : null}
                {isAdmin ? <button className="top-action-btn" onClick={() => openWorkspace("Zones / Areas", "Area setup opened", "Create or update event areas from this tab.")}><Plus size={16} /> Add Area</button> : null}
                {isAdmin ? <button className="top-action-btn top-action-primary" onClick={() => openWorkspace("Master Tasks", "Task setup opened", "Add a custom live task or use a reference suggestion.")}><Plus size={16} /> Add Task</button> : null}
                {isAdmin ? <button className="top-action-btn" onClick={exportCsv}><Download size={16} /> Export CSV</button> : null}
                {isAdmin ? <button className="top-action-btn" onClick={() => openWorkspace("Master Tasks", "Import panel opened", "Use the upload control to import Excel or CSV reference suggestions.")}><Upload size={16} /> Import CSV</button> : null}
                <Badge>{unreadNotificationsFor(state, currentProfile).length + buildUserAlerts(state, currentProfile).length} alert(s)</Badge>
              </div>
            </div>
          </header>

          <div className="animate-fade-in w-full p-3 sm:p-4 lg:p-5 2xl:p-6">
            <NotificationCenter state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} />
            {activeTab === "Dashboard" ? <DashboardTab state={state} currentProfile={currentProfile} chartSettings={dashboardCharts} /> : null}
            {activeTab === "Daily Reports" ? <DailyReportsTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Master Tasks" ? <MasterTasksTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Zones / Areas" ? <ZonesAreasTab state={state} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Verification" ? <VerificationTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Requests" ? <RequestsTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Users & Access" ? <UsersAccessTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Daily Report" ? <DailyReportTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "My Area" ? <MyAreaTab state={state} currentProfile={currentProfile} /> : null}
            {activeTab === "Profile / Access" ? <ProfileTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {activeTab === "Reports" ? <ReportsTab state={state} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
            {["Forms", "Global Fields", "Activity Log"].includes(activeTab) ? <FoundationTab state={state} tab={activeTab} currentProfile={currentProfile} updateState={updateState} showToast={showToast} /> : null}
          </div>
        </section>
      </div>
      {chartSettingsOpen ? (
        <ChartSettingsModal
          settings={dashboardCharts}
          onChange={setDashboardCharts}
          onClose={() => setChartSettingsOpen(false)}
          showToast={showToast}
        />
      ) : null}
      <ToastStack toasts={toasts} dismissToast={dismissToast} />
    </main>
  );
}

function DashboardTab({ state, currentProfile, presentationMode = false, chartSettings = DEFAULT_DASHBOARD_CHARTS }: { state: EventPrepState; currentProfile: Profile; presentationMode?: boolean; chartSettings?: DashboardChartSettings }) {
  const allowedAreaIds = dashboardAllowedAreaIds(state, currentProfile);
  const metrics = useMemo(() => buildMetricsForAreas(state, allowedAreaIds), [state, allowedAreaIds.join("|")]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [workstreamFilter, setWorkstreamFilter] = useState("All");
  const [dayFilter, setDayFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const latest = latestUpdateMap(state.taskUpdates);
  const allowedAreas = state.areas.filter((area) => allowedAreaIds.includes(area.id));
  const workstreamOptions = unique(state.liveTasks.filter((task) => allowedAreaIds.includes(task.areaId)).map((task) => taskDetails(state, task).workstream).filter(Boolean));
  const filteredAreas = allowedAreas.filter((area) => zoneFilter === "All" || area.zoneTypeId === zoneFilter);
  const dayOptions = unique(state.liveTasks.filter((task) => allowedAreaIds.includes(task.areaId)).map((task) => String(task.prepDay))).sort((a, b) => Number(a) - Number(b));
  const scopedTasks = state.liveTasks.filter((task) => {
    const area = state.areas.find((item) => item.id === task.areaId);
    const details = taskDetails(state, task);
    const update = latest.get(task.id);
    if (!allowedAreaIds.includes(task.areaId)) return false;
    if (!task.active || task.notApplicable) return false;
    if (zoneFilter !== "All" && area?.zoneTypeId !== zoneFilter) return false;
    if (areaFilter !== "All" && task.areaId !== areaFilter) return false;
    if (workstreamFilter !== "All" && details.workstream !== workstreamFilter) return false;
    if (dayFilter !== "All" && String(task.prepDay) !== dayFilter) return false;
    if (statusFilter !== "All" && (update?.status || "Pending") !== statusFilter) return false;
    if (verificationFilter !== "All" && (update?.verificationStatus || "Not Submitted") !== verificationFilter) return false;
    if (priorityFilter !== "All" && task.priority !== priorityFilter) return false;
    return true;
  });
  const scopedVerified = scopedTasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
  const zoneRows = state.zoneTypes.map((zone) => {
    const areaIds = allowedAreas.filter((area) => area.zoneTypeId === zone.id).map((area) => area.id);
    const tasks = scopedTasks.filter((task) => areaIds.includes(task.areaId));
    const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return { label: zone.name, total: tasks.length, verified, percent: percent(verified, tasks.length) };
  });
  const attention = buildAttention(state).filter((item) => presentationMode ? !["Pending Requests", "Rejected / Needs Correction Tasks"].includes(item.label) : true);
  const dayRows = dayOptions.map((day) => {
    const tasks = scopedTasks.filter((task) => String(task.prepDay) === day);
    const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return { label: `Day ${day}`, value: percent(verified, tasks.length), helper: `${verified}/${tasks.length} verified` };
  }).filter((row) => row.helper !== "0/0 verified");
  const areaProgressRows = allowedAreas.map((area) => {
    if (zoneFilter !== "All" && area.zoneTypeId !== zoneFilter) return null;
    if (areaFilter !== "All" && area.id !== areaFilter) return null;
    const tasks = scopedTasks.filter((task) => task.areaId === area.id);
    const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return { label: area.name, value: percent(verified, tasks.length), helper: zoneName(state, area.zoneTypeId) };
  }).filter((row): row is { label: string; value: number; helper: string } => Boolean(row));
  const workstreamRows = unique(scopedTasks.map((task) => taskDetails(state, task).workstream).filter(Boolean)).map((workstream) => {
    const tasks = scopedTasks.filter((task) => taskDetails(state, task).workstream === workstream);
    const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return { label: workstream, value: percent(verified, tasks.length), helper: `${tasks.length} live tasks` };
  });

  return (
    <div className="space-y-5">
      {!presentationMode ? <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button className="btn-primary w-full sm:w-auto" onClick={() => setFiltersOpen((current) => !current)}>
            <Filter size={17} /> Filter
          </button>
          <p className="text-sm text-[var(--color-text-muted)]">
            {filtersOpen ? "Choose the dashboard scope below." : "Open filters from the button and choose only what you need"}
          </p>
        </div>
        {filtersOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Select label="Zone Type" value={zoneFilter} onChange={(value) => {
              setZoneFilter(value);
              setAreaFilter("All");
            }} options={["All", ...state.zoneTypes.filter((zone) => allowedAreas.some((area) => area.zoneTypeId === zone.id)).map((zone) => ({ label: zone.name, value: zone.id }))]} />
            <Select label="Area" value={areaFilter} onChange={setAreaFilter} options={["All", ...filteredAreas.map((area) => ({ label: area.name, value: area.id }))]} />
            <Select label="Day" value={dayFilter} onChange={setDayFilter} options={["All", ...dayOptions]} />
            <Select label="Workstream" value={workstreamFilter} onChange={setWorkstreamFilter} options={["All", ...workstreamOptions]} />
            <Select label="Task Status" value={statusFilter} onChange={setStatusFilter} options={["All", ...USER_TASK_STATUSES]} />
            <Select label="Verification" value={verificationFilter} onChange={setVerificationFilter} options={["All", ...VERIFICATION_STATUSES]} />
            <Select label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["All", ...PRIORITY_OPTIONS]} />
          </div>
        ) : null}
      </section> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Overall Verified Completion" value={`${percent(scopedVerified, scopedTasks.length)}%`} helper={`${scopedVerified}/${scopedTasks.length} verified in scope`} tone="good" />
        <MetricCard title="Daily Reports Submitted" value={String(metrics.submittedReports)} helper={presentationMode ? "Submitted reports" : `${metrics.missingOrPartialReports} missing or partial`} />
        <MetricCard title="Needs Verification" value={String(metrics.needsVerification)} helper={presentationMode ? "Awaiting review" : "Completed by users, awaiting review"} tone="warning" />
        <MetricCard title="Issue Found Tasks" value={String(metrics.issueFound)} helper={presentationMode ? "Attention count" : "User flagged task issues"} tone="critical" />
        <MetricCard title="Countdown to Event" value={`${metrics.daysToEvent}d`} helper={state.settings.eventStartDate} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Zone Type Progress" action={<Badge>Verified completed only</Badge>}>
          <DashboardChartVisual rows={zoneRows.map((row) => ({ label: row.label, value: row.percent, helper: `${row.verified}/${row.total} tasks` }))} type={chartSettings.zoneType} />
        </Panel>
        <Panel title="Attention Required">
          <DashboardAttentionVisual rows={attention} type={chartSettings.attention} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Area-Wise Progress">
          <DashboardChartVisual rows={areaProgressRows} type={chartSettings.area} />
        </Panel>
        <Panel title="Day-Wise Progress">
          <DashboardChartVisual rows={dayRows} type={chartSettings.day} />
        </Panel>
        <Panel title="Workstream Progress">
          <DashboardChartVisual rows={workstreamRows} type={chartSettings.workstream} />
        </Panel>
      </div>
    </div>
  );
}

function DashboardChartVisual({ rows, type }: { rows: Array<{ label: string; value: number; helper: string }>; type: DashboardChartKind }) {
  const visibleRows = rows.filter((row) => row.label);
  if (!visibleRows.length) return <EmptyState title="No chart data" body="Adjust filters or add live tasks to populate this chart." />;
  if (type === "Donut chart") {
    const colors = ["#0B4F3A", "#2E7D5B", "#C9A227", "#F3E7C3", "#7A1F2B"];
    return <DonutChart rows={visibleRows.map((row, index) => ({ label: row.label, value: row.value, color: colors[index % colors.length] }))} />;
  }
  if (type === "Score cards") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleRows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-xl font-black text-[var(--color-primary)]">{row.value}%</p>
            <p className="mt-1 text-sm font-black text-[var(--color-primary)]">{row.label}</p>
            <p className="mt-1 text-xs font-bold text-[var(--color-text-muted)]">{row.helper}</p>
          </div>
        ))}
      </div>
    );
  }
  if (type === "Compact bars") return <DashboardBarChart rows={visibleRows} compact />;
  return <div className="space-y-3">{visibleRows.map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} helper={row.helper} />)}</div>;
}

function DashboardAttentionVisual({ rows, type }: { rows: ReturnType<typeof buildAttention>; type: AttentionChartKind }) {
  if (!rows.length) return <EmptyState title="No attention items" body="Nothing needs attention in this view." />;
  if (type === "Compact list") {
    return (
      <div className="report-attention-list">
        {rows.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((item) => (
        <div key={item.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-xl font-black text-[var(--color-primary)]">{item.count}</p>
          <p className="text-xs font-bold text-[var(--color-text-muted)]">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function ChartSettingsModal({ settings, onChange, onClose, showToast }: { settings: DashboardChartSettings; onChange: (settings: DashboardChartSettings) => void; onClose: () => void; showToast: ShowToast }) {
  const chartTypes: DashboardChartKind[] = ["Progress bars", "Compact bars", "Donut chart", "Score cards"];
  const update = <K extends keyof DashboardChartSettings>(key: K, value: DashboardChartSettings[K]) => onChange({ ...settings, [key]: value });
  const apply = () => {
    showToast("Chart settings applied", "Dashboard charts now use your selected visual types.", "success");
    onClose();
  };
  return (
    <div className="settings-modal-overlay" onMouseDown={onClose}>
      <section className="settings-modal motion-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Dashboard chart settings">
        <header className="settings-modal-header">
          <div>
            <p className="text-xs font-black uppercase text-[var(--color-accent)]">Dashboard</p>
            <h2>Chart Settings</h2>
            <p>Choose how each dashboard chart should look. The data and calculations stay the same.</p>
          </div>
          <button className="mini-icon-btn" onClick={onClose} aria-label="Close chart settings"><X size={18} /></button>
        </header>
        <div className="settings-modal-body">
          <Select label="Zone Type Progress" value={settings.zoneType} onChange={(value) => update("zoneType", value as DashboardChartKind)} options={chartTypes} />
          <Select label="Area-Wise Progress" value={settings.area} onChange={(value) => update("area", value as DashboardChartKind)} options={chartTypes} />
          <Select label="Day-Wise Progress" value={settings.day} onChange={(value) => update("day", value as DashboardChartKind)} options={chartTypes} />
          <Select label="Workstream Progress" value={settings.workstream} onChange={(value) => update("workstream", value as DashboardChartKind)} options={chartTypes} />
          <Select label="Attention Required" value={settings.attention} onChange={(value) => update("attention", value as AttentionChartKind)} options={["Score cards", "Compact list"]} />
        </div>
        <footer className="settings-modal-footer">
          <button className="btn-secondary" onClick={() => onChange(DEFAULT_DASHBOARD_CHARTS)}>Reset</button>
          <button className="btn-primary" onClick={apply}>Apply Settings</button>
        </footer>
      </section>
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestPost, setRequestPost] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestAreas, setRequestAreas] = useState<string[]>([]);
  const [areaOptions, setAreaOptions] = useState<PublicAreaOption[]>([]);
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    fetch("/api/event-prep/access-request")
      .then((response) => response.json())
      .then((json) => setAreaOptions(Array.isArray(json.areas) ? json.areas : []))
      .catch(() => setAreaOptions([]));
  }, []);

  const toggleAreaRequest = (areaId: string, checked: boolean) => {
    setRequestAreas((current) => checked ? unique([...current, areaId]) : current.filter((idValue) => idValue !== areaId));
  };
  const submitAccessRequest = async () => {
    try {
      setRequestMessage("Submitting access request...");
      const response = await fetch("/api/event-prep/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: requestName,
          loginId,
          post: requestPost,
          phone: requestPhone,
          areaIds: requestAreas,
          notes: requestNotes
        })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(json.error || "Could not submit access request."));
      setRequestMessage("Access request submitted. An admin can review it inside Requests.");
      setRequestName("");
      setRequestPost("");
      setRequestPhone("");
      setRequestNotes("");
      setRequestAreas([]);
    } catch (error) {
      setRequestMessage(readError(error, "Unable to submit access request."));
    }
  };

  return (
    <main className="login-page text-[var(--color-text)]">
      <div className="login-shell">
        <section className="login-card">
          <p className="login-eyebrow">ASHARA MUBARAKAH</p>
          <h1>IT Event Preparation</h1>
          <p className="login-helper">Sign in with your Login ID and password.</p>
          <label className="mt-5 block">
            <span className="field-label">Login ID / Email</span>
            <input className="field mt-2 bg-white/70" type="email" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="mt-3 block">
            <span className="field-label">Password</span>
            <span className="login-password-field mt-2">
              <input value={password} type={passwordVisible ? "text" : "password"} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" onKeyDown={(event) => {
                if (event.key === "Enter") signIn();
              }} />
              <button type="button" onClick={() => setPasswordVisible((current) => !current)} aria-label={passwordVisible ? "Hide password" : "Show password"}>
                <Eye size={15} />
              </button>
            </span>
          </label>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-[var(--color-primary)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Remember me
            </label>
            <button className="login-link" type="button" onClick={() => setRequestMessage("Ask the Super Admin to reset your password from Users & Access.")}>Forgot password?</button>
          </div>
          <button className="btn-primary mt-4 w-full justify-center" onClick={signIn}>
            <KeyRound size={17} /> Sign In
          </button>
          <button className="login-access-toggle" type="button" onClick={() => setRequestOpen((current) => !current)}>
            {requestOpen ? "Hide access request" : "Need access? Request from admin"}
          </button>
          {authMessage ? <p className="mt-3 text-sm font-bold text-[var(--color-primary)]">{authMessage}</p> : null}
          {requestMessage ? <p className="mt-3 rounded-lg bg-white/55 p-2 text-xs font-bold text-[var(--color-primary)]">{requestMessage}</p> : null}
          {requestOpen ? (
            <div className="login-access-panel">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Name" value={requestName} onChange={setRequestName} />
                <Input label="Post" value={requestPost} onChange={setRequestPost} placeholder="Area Coordinator" />
                <Input label="Phone number" value={requestPhone} onChange={setRequestPhone} />
                <Input label="Notes" value={requestNotes} onChange={setRequestNotes} placeholder="Why access is needed" />
              </div>
              <div className="mt-3">
                <p className="field-label">Area access requested</p>
                <div className="login-area-grid mt-2">
                  {areaOptions.map((area) => (
                    <label key={area.id}>
                      <input type="checkbox" checked={requestAreas.includes(area.id)} onChange={(event) => toggleAreaRequest(area.id, event.target.checked)} />
                      <span>{area.name}<small>{area.zoneName}</small></span>
                    </label>
                  ))}
                  {!areaOptions.length ? <p className="text-xs font-bold text-[var(--color-text-muted)]">Area list is unavailable. Check Supabase server settings.</p> : null}
                </div>
              </div>
              <button className="btn-secondary mt-3 w-full justify-center" type="button" onClick={submitAccessRequest}>Submit Access Request</button>
            </div>
          ) : null}
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
  const [applyAreaId, setApplyAreaId] = useState(state.areas[0]?.id || "");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customWorkstream, setCustomWorkstream] = useState("General");
  const [customResponsibleTeam, setCustomResponsibleTeam] = useState("");
  const [customExpectedOutput, setCustomExpectedOutput] = useState("");
  const [customRequiredEquipment, setCustomRequiredEquipment] = useState("");
  const [customPrepDay, setCustomPrepDay] = useState("1");
  const [customStartDate, setCustomStartDate] = useState(state.settings.preparationStartDate);
  const [customDueDate, setCustomDueDate] = useState(state.settings.preparationStartDate);
  const [customPriority, setCustomPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>("Medium");
  const [customTaskType, setCustomTaskType] = useState<(typeof TASK_TYPES)[number]>("Simple Task");
  const [customQuantity, setCustomQuantity] = useState("1");
  const [customUnit, setCustomUnit] = useState("Item");
  const unitOptions = activeOptions(state, "Units", UNIT_OPTIONS);
  const priorityOptions = activeOptions(state, "Priority options", PRIORITY_OPTIONS);
  const referenceTemplates = state.taskTemplates.filter((template) => template.source !== "custom");
  const selectedTask = state.liveTasks.find((task) => task.id === selectedTaskId);
  const selectedSuggestion = referenceTemplates.find((template) => template.id === selectedSuggestionId);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const templates = await parsePreparationPlan(file);
      updateState((current) => ({
        ...current,
        taskTemplates: mergeTemplates(current.taskTemplates, templates)
      }));
      setImportMessage(`${templates.length} reference suggestion(s) imported. Use them from the custom task form.`);
      showToast("Import completed", `${templates.length} reference suggestion(s) added to Master Tasks.`);
    } catch (error) {
      setImportMessage(readError(error, "Import failed."));
      showToast("Import failed", readError(error, "Please check the file and try again."), "error");
    } finally {
      event.target.value = "";
    }
  };

  const applySuggestion = (templateId: string) => {
    setSelectedSuggestionId(templateId);
    const suggestion = referenceTemplates.find((template) => template.id === templateId);
    if (!suggestion) return;
    setCustomTitle(suggestion.taskDetails);
    setCustomWorkstream(suggestion.workstream || "General");
    setCustomResponsibleTeam(suggestion.responsibleTeam || "");
    setCustomExpectedOutput(suggestion.expectedOutput || "");
    setCustomRequiredEquipment(suggestion.requiredEquipment || "");
    setCustomPrepDay(String(suggestion.day || 1));
    setCustomStartDate(addDays(state.settings.preparationStartDate, (suggestion.day || 1) - 1));
    setCustomDueDate(addDays(state.settings.preparationStartDate, (suggestion.day || 1) - 1));
    setCustomPriority(suggestion.priorityLevel);
    showToast("Suggestion applied", "The reference suggestion filled the custom task fields. You can edit anything before adding it.", "info");
  };

  const addCustomTask = () => {
    if (!applyAreaId || !customTitle.trim()) {
      showToast("Task title required", "Choose an area and enter a custom task title.", "warning");
      return;
    }
    const prepDay = Math.min(20, Math.max(1, Number(customPrepDay || 1)));
    const template = createCustomTaskTemplate({
      title: customTitle,
      workstream: customWorkstream,
      responsibleTeam: customResponsibleTeam,
      expectedOutput: customExpectedOutput,
      requiredEquipment: customRequiredEquipment,
      prepDay,
      priority: customPriority,
      reference: selectedSuggestion
    });
    updateState((current) => {
      const liveTask = createLiveTask(template, applyAreaId, customTaskType, Number(customQuantity || 0), customUnit, current, current.settings.preparationStartDate);
      if (!liveTask) return current;
      const nextTask = { ...liveTask, startDate: customStartDate || liveTask.startDate, dueDate: customDueDate || liveTask.dueDate };
      return withActivity({
        ...current,
        taskTemplates: [template, ...current.taskTemplates],
        liveTasks: [nextTask, ...current.liveTasks]
      }, currentProfile, "Template changes", `Added custom task ${template.taskDetails}`, "live_task", nextTask.id, { custom: true });
    });
    setCustomTitle("");
    setCustomExpectedOutput("");
    setCustomRequiredEquipment("");
    setSelectedSuggestionId("");
    showToast("Custom task added", `${template.taskDetails} was added to ${areaName(state, applyAreaId)}.`);
  };

  return (
    <div className="space-y-4">
      <Panel title="Excel Import Into Reference Suggestions" action={<Badge>Day Plan sheet preferred</Badge>}>
        <div className="grid gap-3">
          <div>
            <label className="field-label">Upload preparation plan</label>
            <input className="field mt-2" type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} />
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Imported Day Plan rows are kept as optional suggestions while creating custom live tasks. They do not become live tasks by themselves.</p>
          </div>
        </div>
        {importMessage ? <p className="mt-3 rounded-lg bg-[var(--color-accent-light)] p-3 text-sm font-bold text-[var(--color-primary)]">{importMessage}</p> : null}
      </Panel>

      <Panel title="Add Custom Live Task" action={<Badge>No template required</Badge>}>
        <div className="grid gap-3 lg:grid-cols-4">
          <Select label="Area" value={applyAreaId} onChange={setApplyAreaId} options={state.areas.map((area) => ({ label: area.name, value: area.id }))} />
          <Select
            label="Use reference suggestion"
            value={selectedSuggestionId}
            onChange={applySuggestion}
            options={[
              { label: "Start blank custom task", value: "" },
              ...referenceTemplates.map((template) => ({
                label: template.taskDetails.length > 90 ? `${template.taskDetails.slice(0, 90)}...` : template.taskDetails,
                value: template.id
              }))
            ]}
          />
          <Input label="Task title" value={customTitle} onChange={setCustomTitle} placeholder="Install backup router" />
          <Input label="Workstream" value={customWorkstream} onChange={setCustomWorkstream} placeholder="Network" />
          <Select label="Task Type" value={customTaskType} onChange={(value) => setCustomTaskType(value as typeof customTaskType)} options={[...TASK_TYPES]} />
          <Input label="Prep Day" value={customPrepDay} onChange={setCustomPrepDay} type="number" />
          <Input label="Start date" value={customStartDate} onChange={setCustomStartDate} type="date" />
          <Input label="Due date" value={customDueDate} onChange={setCustomDueDate} type="date" />
          <Select label="Priority" value={customPriority} onChange={(value) => setCustomPriority(value as typeof customPriority)} options={priorityOptions} />
          {customTaskType === "Quantity-Based Task" ? <Input label="Required quantity" value={customQuantity} onChange={setCustomQuantity} type="number" /> : null}
          {customTaskType === "Quantity-Based Task" ? <Select label="Unit" value={customUnit} onChange={setCustomUnit} options={unitOptions} /> : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input label="Responsible team" value={customResponsibleTeam} onChange={setCustomResponsibleTeam} placeholder="Local IT Team" />
          <Input label="Expected output" value={customExpectedOutput} onChange={setCustomExpectedOutput} placeholder="Task completion criteria" />
          <Input label="Required equipment" value={customRequiredEquipment} onChange={setCustomRequiredEquipment} placeholder="Routers, cables, tools" />
        </div>
        {selectedSuggestion ? (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-accent-light)]/60 p-3 text-sm">
            <p className="font-black text-[var(--color-primary)]">Reference suggestion preview</p>
            <p className="mt-1 text-[var(--color-text)]">{selectedSuggestion.taskDetails}</p>
            <p className="mt-1 text-xs font-bold text-[var(--color-text-muted)]">{selectedSuggestion.workstream || "General"} | {selectedSuggestion.responsibleTeam || "No team specified"}</p>
          </div>
        ) : null}
        <button className="btn-primary mt-3" onClick={addCustomTask}>
          <Plus size={17} /> Add Custom Task
        </button>
      </Panel>

      <Panel title="Live Tasks Area Configuration" action={<Badge>{state.liveTasks.length} live tasks</Badge>}>
        <LiveTasksConfigTable
          state={state}
          openTask={setSelectedTaskId}
        />
      </Panel>
      {selectedTask ? <LiveTaskEditorModal state={state} task={selectedTask} updateState={updateState} close={() => setSelectedTaskId("")} showToast={showToast} /> : null}
    </div>
  );
}

function LiveTasksConfigTable({
  state,
  openTask
}: {
  state: EventPrepState;
  openTask: (taskId: string) => void;
}) {
  const latestUpdates = latestUpdateMap(state.taskUpdates);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All");
  const [workstreamFilter, setWorkstreamFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const workstreamOptions = unique(state.liveTasks.map((task) => taskDetails(state, task).workstream || "General"));
  const visibleTasks = state.liveTasks.filter((task) => {
    const details = taskDetails(state, task);
    const update = latestUpdates.get(task.id);
    const taskStatus = update?.status || "Pending";
    const verificationStatus = update?.verificationStatus || "Not Submitted";
    const taskSearch = [details.taskDetails, details.workstream, areaName(state, task.areaId), task.priority, taskStatus, verificationStatus].join(" ").toLowerCase();
    return (
      (!search.trim() || taskSearch.includes(search.trim().toLowerCase())) &&
      (areaFilter === "All" || task.areaId === areaFilter) &&
      (workstreamFilter === "All" || (details.workstream || "General") === workstreamFilter) &&
      (statusFilter === "All" || taskStatus === statusFilter || verificationStatus === statusFilter) &&
      (priorityFilter === "All" || task.priority === priorityFilter)
    );
  });
  const grouped = state.areas
    .map((area) => {
      const tasks = visibleTasks.filter((task) => task.areaId === area.id);
      const workstreams = unique(tasks.map((task) => taskDetails(state, task).workstream || "General"));
      return { area, tasks, workstreams };
    })
    .filter((group) => group.tasks.length);

  const toggleGroup = (groupKey: string) => setCollapsedGroups((current) => (current.includes(groupKey) ? current.filter((item) => item !== groupKey) : [...current, groupKey]));

  return (
    <div className="space-y-4">
      <div className="task-filter-bar">
        <label className="task-search">
          <span className="field-label">Search tasks</span>
          <input className="field mt-2" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by task name, workstream, area..." />
        </label>
        <Select label="Area" value={areaFilter} onChange={setAreaFilter} options={["All", ...state.areas.map((area) => ({ label: area.name, value: area.id }))]} />
        <Select label="Workstream" value={workstreamFilter} onChange={setWorkstreamFilter} options={["All", ...workstreamOptions]} />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={["All", ...unique([...USER_TASK_STATUSES, ...VERIFICATION_STATUSES])]} />
        <Select label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["All", ...activeOptions(state, "Priority options", PRIORITY_OPTIONS)]} />
      </div>
      {!grouped.length ? <EmptyState title="No live tasks found" body="Adjust filters or add a custom live task to an area." /> : null}
      {grouped.map(({ area, workstreams }) => (
        <section key={area.id} className="task-group-card motion-card animate-fade-in">
          <div className="task-group-main-header">
            <div>
              <p className="text-xs font-black uppercase text-[var(--color-accent)]">Area</p>
              <h3 className="text-lg font-black text-[var(--color-primary)]">{area.name}</h3>
            </div>
            <Badge>{visibleTasks.filter((task) => task.areaId === area.id).length} task(s)</Badge>
          </div>
          {workstreams.map((workstream) => {
            const groupKey = `${area.id}-${workstream}`;
            const tasks = visibleTasks.filter((task) => task.areaId === area.id && (taskDetails(state, task).workstream || "General") === workstream);
            const completedCount = tasks.filter((task) => latestUpdates.get(task.id)?.verificationStatus === "Verified Completed").length;
            const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
            const collapsed = collapsedGroups.includes(groupKey);
            return (
              <div key={groupKey} className="task-workstream-block">
                <button className="task-workstream-header" onClick={() => toggleGroup(groupKey)} aria-expanded={!collapsed}>
                  <div className="min-w-0">
                    <p className="font-black text-[var(--color-primary)]">Workstream: {workstream}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--color-text-muted)]">{completedCount}/{tasks.length} verified completed</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden w-28 sm:block">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-accent-light)]">
                        <div className="progress-fill h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <Badge>{progress}%</Badge>
                    <span className={`task-collapse-icon ${collapsed ? "is-collapsed" : ""}`} aria-hidden="true">
                      <ChevronDown size={17} />
                    </span>
                  </div>
                </button>
                <div className={`task-collapse-panel ${collapsed ? "is-collapsed" : ""}`}>
                  <div className="task-collapse-inner">
                    <div className="task-summary-list">
                      <div className="task-summary-head">
                        <span>Task</span>
                        <span>Status</span>
                        <span>Priority</span>
                        <span>Due</span>
                        <span>Progress</span>
                      </div>
                      {tasks.map((task) => (
                        <TaskSummaryRow key={task.id} state={state} task={task} update={latestUpdates.get(task.id)} openTask={openTask} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function TaskSummaryRow({ state, task, update, openTask }: { state: EventPrepState; task: LiveTask; update?: TaskUpdate; openTask: (taskId: string) => void }) {
  const details = taskDetails(state, task);
  const status = update?.verificationStatus === "Verified Completed" ? "Verified Completed" : update?.status || "Pending";
  const progress = task.taskType === "Quantity-Based Task" && task.requiredQuantity
    ? Math.min(100, Math.round(((update?.completedQuantity || 0) / task.requiredQuantity) * 100))
    : update?.verificationStatus === "Verified Completed"
      ? 100
      : update?.status === "Completed"
        ? 75
        : update?.status === "In Progress"
          ? 45
          : 0;
  const isOverdue = Boolean(task.dueDate && task.dueDate < todayIso() && update?.verificationStatus !== "Verified Completed");

  return (
    <button className={`task-summary-row ${isOverdue ? "is-overdue" : ""}`} onClick={() => openTask(task.id)} title="Open task detail drawer">
      <span className="task-summary-title-cell">
        <span className="task-summary-title">{details.taskDetails}</span>
        <span className="task-summary-meta">{areaName(state, task.areaId)} | {details.workstream || "General"} | {task.taskType}</span>
      </span>
      <span><StatusBadge value={status} /></span>
      <span><StatusBadge value={task.priority} /></span>
      <span className="task-summary-muted">{task.dueDate || "No due date"}</span>
      <span className="task-summary-progress">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-accent-light)]">
          <span className="progress-fill block h-full rounded-full bg-[var(--color-secondary)]" style={{ width: `${progress}%` }} />
        </span>
        <strong>{progress}%</strong>
      </span>
    </button>
  );
}

function LiveTaskEditorModal({
  state,
  task,
  updateState,
  close,
  showToast
}: {
  state: EventPrepState;
  task: LiveTask;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
  close: () => void;
  showToast: ShowToast;
}) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<LiveTask>(task);
  const details = taskDetails(state, draft);
  const priorityOptions = activeOptions(state, "Priority options", PRIORITY_OPTIONS);
  const unitOptions = activeOptions(state, "Units", UNIT_OPTIONS);
  const areaUsers = state.areaAccess
    .filter((access) => access.areaId === draft.areaId && access.role === "report_user")
    .map((access) => state.profiles.find((profile) => profile.id === access.profileId))
    .filter(Boolean) as Profile[];
  const areaVerifiers = state.areaAccess
    .filter((access) => access.areaId === draft.areaId && access.role === "verifier")
    .map((access) => state.profiles.find((profile) => profile.id === access.profileId))
    .filter(Boolean) as Profile[];

  useEffect(() => {
    setDraft(task);
  }, [task.id]);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const updateDraft = (patch: Partial<LiveTask>) => setDraft((current) => ({ ...current, ...patch }));
  const saveTask = () => {
    updateState((current) => ({
      ...current,
      liveTasks: current.liveTasks.map((item) => (item.id === task.id ? draft : item))
    }));
    showToast("Task details saved", "The live task details are updated.");
    close();
  };
  const toggleProfile = (field: "assignedProfileIds" | "assignedVerifierIds", profileId: string, checked: boolean) => {
    const current = draft[field];
    updateDraft({ [field]: checked ? unique([...current, profileId]) : current.filter((idValue) => idValue !== profileId) } as Partial<LiveTask>);
  };

  const drawer = (
    <div className="task-drawer-overlay" onMouseDown={close}>
      <section className="task-drawer motion-drawer" onMouseDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Task detail edit">
        <header className="task-drawer-header">
          <div>
            <p className="text-xs font-black uppercase text-[var(--color-accent)]">Task Detail / Edit</p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-primary)]">{details.taskDetails}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{areaName(state, draft.areaId)} / Day {draft.prepDay} / {draft.taskType}</p>
          </div>
          <button className="mini-icon-btn" onClick={close} aria-label="Close task drawer"><X size={18} /></button>
        </header>

        <div className="task-drawer-body">
          <section className="drawer-form-section">
            <div className="drawer-section-heading">
              <h3>Task Description</h3>
              <p>Core imported/custom task details.</p>
            </div>
              <div className="grid gap-3">
              <Input label="Task title" value={details.taskDetails} onChange={(value) => updateDraft({ taskDetails: value })} />
              <Input label="Main objective" value={details.mainObjective} onChange={(value) => updateDraft({ mainObjective: value })} />
                <div className="grid gap-3 md:grid-cols-2">
                <Input label="Workstream" value={details.workstream} onChange={(value) => updateDraft({ workstream: value })} />
                <Input label="Responsible team" value={details.responsibleTeam} onChange={(value) => updateDraft({ responsibleTeam: value })} />
                <Input label="Required equipment" value={details.requiredEquipment} onChange={(value) => updateDraft({ requiredEquipment: value })} />
                <Input label="Testing required" value={details.testingRequired} onChange={(value) => updateDraft({ testingRequired: value })} />
                </div>
                <label className="block">
                  <span className="field-label">Expected output</span>
                <textarea className="field mt-2 min-h-20" value={details.expectedOutput} onChange={(event) => updateDraft({ expectedOutput: event.target.value })} />
                </label>
                <label className="block">
                  <span className="field-label">Local follow-up questions</span>
                <textarea className="field mt-2 min-h-20" value={details.followUpQuestions} onChange={(event) => updateDraft({ followUpQuestions: event.target.value })} />
                </label>
              </div>
          </section>

          <section className="drawer-form-section">
            <div className="drawer-section-heading">
              <h3>Assignments</h3>
              <p>Assigned report users and verifiers.</p>
            </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="field-label">Report users</p>
                  <div className="mt-2 grid gap-2">
                    {areaUsers.map((profile) => (
                      <label key={profile.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm font-bold text-[var(--color-primary)]">
                      <input type="checkbox" checked={draft.assignedProfileIds.includes(profile.id)} onChange={(event) => toggleProfile("assignedProfileIds", profile.id, event.target.checked)} />
                        {profile.fullName}
                      </label>
                    ))}
                    {!areaUsers.length ? <p className="text-sm text-[var(--color-text-muted)]">No report users assigned to this area yet.</p> : null}
                  </div>
                </div>
                <div>
                  <p className="field-label">Verifiers</p>
                  <div className="mt-2 grid gap-2">
                    {areaVerifiers.map((profile) => (
                      <label key={profile.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm font-bold text-[var(--color-primary)]">
                      <input type="checkbox" checked={draft.assignedVerifierIds.includes(profile.id)} onChange={(event) => toggleProfile("assignedVerifierIds", profile.id, event.target.checked)} />
                        {profile.fullName}
                      </label>
                    ))}
                    {!areaVerifiers.length ? <p className="text-sm text-[var(--color-text-muted)]">No verifiers assigned to this area yet.</p> : null}
                  </div>
                </div>
              </div>
          </section>

          <section className="drawer-form-section">
            <div className="drawer-section-heading">
              <h3>Live Settings</h3>
              <p>Area, dates, quantity, and verification rules.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Area" value={draft.areaId} onChange={(value) => updateDraft({ areaId: value })} options={state.areas.map((area) => ({ label: area.name, value: area.id }))} />
              <Select label="Task type" value={draft.taskType} onChange={(value) => updateDraft({ taskType: value as LiveTask["taskType"] })} options={[...TASK_TYPES]} />
              <Input label="Prep day" value={String(draft.prepDay)} onChange={(value) => {
                  const prepDay = Math.min(20, Math.max(1, Number(value || 1)));
                updateDraft({ prepDay });
                }} type="number" />
              <Input label="Start date" value={draft.startDate} onChange={(value) => updateDraft({ startDate: value })} type="date" />
              <Input label="Due date" value={draft.dueDate} onChange={(value) => updateDraft({ dueDate: value })} type="date" />
              <Select label="Priority" value={draft.priority} onChange={(value) => {
                updateDraft({ priority: value as LiveTask["priority"] });
                }} options={priorityOptions} />
              {draft.taskType === "Quantity-Based Task" ? (
                <>
                  <Input label="Required quantity" value={String(draft.requiredQuantity || "")} onChange={(value) => updateDraft({ requiredQuantity: Number(value || 0) })} type="number" />
                  <Select label="Unit" value={draft.unit || "Item"} onChange={(value) => updateDraft({ unit: value })} options={unitOptions} />
                </>
              ) : null}
              <Input label="Evidence note" value={draft.evidenceNote || ""} onChange={(value) => updateDraft({ evidenceNote: value })} />
              <Select label="Verification rule" value={draft.verificationRule} onChange={(value) => updateDraft({ verificationRule: value as LiveTask["verificationRule"] })} options={[{ label: "One verifier enough", value: "one_verifier" }, { label: "All verifiers required", value: "all_verifiers" }, { label: "Sequential", value: "sequential" }]} />
              <label className="drawer-toggle-field">
                <input type="checkbox" checked={draft.verificationRequired} onChange={(event) => updateDraft({ verificationRequired: event.target.checked })} />
                  Verification required
                </label>
              <label className="drawer-toggle-field">
                <input type="checkbox" checked={draft.active} onChange={(event) => updateDraft({ active: event.target.checked })} />
                  Active
                </label>
              </div>
          </section>
        </div>

        <footer className="task-drawer-footer">
          <button className="btn-secondary" onClick={close}>Cancel</button>
          <button className="btn-primary" onClick={saveTask}>Save Changes</button>
        </footer>
      </section>
    </div>
  );

  if (!mounted) return null;
  return createPortal(drawer, document.body);
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
  const [taskView, setTaskView] = useState<TaskView>("all");
  const [dayFilter, setDayFilter] = useState("All");
  const [workstreamFilter, setWorkstreamFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
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
    const details = taskDetails(state, task);
    const update = latest.get(task.id);
    if (taskView === "today") return task.prepDay === currentDay;
    if (taskView === "pending") return !update || ["Pending", "In Progress"].includes(update.status);
    if (taskView === "issue") return update?.status === "Issue Found";
    if (taskView === "correction") return update?.verificationStatus === "Rejected / Needs Correction";
    if (taskView === "overdue") return new Date(`${task.dueDate}T00:00:00`) < new Date(`${todayIso()}T00:00:00`) && update?.verificationStatus !== "Verified Completed";
    const matchesDay = dayFilter === "All" || String(task.prepDay) === dayFilter;
    const matchesWorkstream = workstreamFilter === "All" || details.workstream === workstreamFilter;
    const matchesStatus = statusFilter === "All" || (update?.status || "Pending") === statusFilter;
    const matchesVerification = verificationFilter === "All" || (update?.verificationStatus || "Not Submitted") === verificationFilter;
    const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
    return matchesDay && matchesWorkstream && matchesStatus && matchesVerification && matchesPriority;
  });
  const workstreamOptions = unique(tasks.map((task) => taskDetails(state, task).workstream));

  useEffect(() => {
    setAreaId((current: string) => current || allowedAreas[0]?.id || "");
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
          <Select label="Task view" value={taskView} onChange={(value) => setTaskView(value as TaskView)} options={[{ label: "All Tasks", value: "all" }, { label: "Today's assigned tasks", value: "today" }, { label: "All Pending Tasks", value: "pending" }, { label: "Issue Found Tasks", value: "issue" }, { label: "Needs Correction Tasks", value: "correction" }, { label: "Overdue Tasks", value: "overdue" }]} />
        </div>
        {taskView === "all" ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            <Select label="Day" value={dayFilter} onChange={setDayFilter} options={["All", ...unique(tasks.map((task) => String(task.prepDay)))]} />
            <Select label="Workstream" value={workstreamFilter} onChange={setWorkstreamFilter} options={["All", ...workstreamOptions]} />
            <Select label="Task Status" value={statusFilter} onChange={setStatusFilter} options={["All", ...USER_TASK_STATUSES]} />
            <Select label="Verification" value={verificationFilter} onChange={setVerificationFilter} options={["All", ...VERIFICATION_STATUSES]} />
            <Select label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["All", ...PRIORITY_OPTIONS]} />
          </div>
        ) : null}
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
  if (!tasks.length) return <EmptyState title="No tasks in this view" body="Change the task view filter or ask admin to add live tasks to this area." />;
  const area = state.areas.find((item) => item.id === report.areaId);
  const groupedTasks = tasks.reduce<Array<{ workstream: string; tasks: LiveTask[] }>>((groups, task) => {
    const details = taskDetails(state, task);
    const workstream = details.workstream || "General";
    const existingGroup = groups.find((group) => group.workstream === workstream);
    if (existingGroup) {
      existingGroup.tasks.push(task);
      return groups;
    }
    return [...groups, { workstream, tasks: [task] }];
  }, []);

  return (
    <div className="reference-task-section">
      <div className="reference-area-heading">Area: {area?.name || "Selected Area"}</div>
      {groupedTasks.map((group) => (
        <section key={group.workstream} className="reference-workstream-group">
          <div className="reference-workstream-heading">Workstream: {group.workstream}</div>
          <div className="grid gap-3">
            {group.tasks.map((task) => (
              <TaskCard key={task.id} state={state} task={task} report={report} currentProfile={currentProfile} updateState={updateState} missing={missingIds.includes(task.id)} showToast={showToast} />
            ))}
          </div>
        </section>
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
  const details = taskDetails(state, task);
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
  const previousUserUpdates = state.taskUpdates.filter((update) => update.updatedBy === currentProfile.id && update.id !== draft.id);
  const escalationSuggestions = uniquePeopleRows(previousUserUpdates.flatMap((update) => update.escalationPoints));
  const supportSuggestions = uniquePeopleRows(previousUserUpdates.flatMap((update) => update.supportingPersonnel));
  const ownerLabel = draft.userRoleStanding || details.responsibleTeam || "Assigned team";

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
        ? task.assignedVerifierIds.map((verifierId) => createInAppNotification(verifierId, "Task needs verification", "Task needs verification", details.taskDetails || "A task is ready for verification.", { areaId: task.areaId, relatedTaskId: task.id, relatedDailyReportId: report.id }))
        : [];
      return withActivity({ ...current, dailyReports: nextReport, taskUpdates: [next, ...without], notifications: [...verifierNotifications, ...current.notifications] }, currentProfile, "Task updates", `Updated task: ${details.taskDetails}`, "task_update", next.id, { status: next.status });
    });
    showToast(
      nextVerification === "Needs Verification" ? "Task sent for verification" : "Task update saved",
      nextVerification === "Needs Verification" ? "A verifier can now review this task." : "Your task changes were saved.",
      nextVerification === "Needs Verification" ? "info" : "success"
    );
  };

  const requestNotApplicable = () => {
    const title = `Not applicable request: ${details.taskDetails}`;
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
    <article className={`reference-task-card ${missing ? "reference-task-card-missing" : ""}`}>
      <div className="reference-task-scroll">
        <div className="reference-task-grid reference-task-header-row">
          <span>Task</span>
          <span>Status</span>
          <span>Verification</span>
          <span>Priority</span>
          <span>Task Type</span>
          <span>Ownership</span>
        </div>
        <div className="reference-task-grid reference-task-data-row">
          <div className="reference-task-cell">
            <p className="reference-task-title">{details.taskDetails}</p>
            <p className="reference-task-meta">Day {task.prepDay} | Due {task.dueDate || "Not set"} | {details.expectedOutput || "Expected output not specified"}</p>
            {draft.correctionComment ? <p className="mt-2 rounded-lg bg-[#7A1F2B]/10 p-2 text-xs font-black text-[var(--color-important)]">Correction: {draft.correctionComment}</p> : null}
          </div>
          <div className="reference-task-cell"><StatusBadge value={draft.status} /></div>
          <div className="reference-task-cell"><StatusBadge value={draft.verificationStatus} /></div>
          <div className="reference-task-cell"><StatusBadge value={task.priority} /></div>
          <div className="reference-task-cell"><StatusBadge value={task.taskType} /></div>
          <div className="reference-task-cell"><span className="reference-soft-pill">{ownerLabel}</span></div>
        </div>
      </div>

      <div className="reference-task-body">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Workstream" value={details.workstream || "General"} />
          <MiniStat label="Responsible" value={details.responsibleTeam || "Not assigned"} />
          <MiniStat label="Expected Output" value={details.expectedOutput || "Not specified"} />
          <MiniStat label="Equipment" value={details.requiredEquipment || "Not specified"} />
        </div>

        <details className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <summary className="cursor-pointer text-sm font-black text-[var(--color-primary)]">View task details</summary>
          <div className="mt-3 grid gap-3 text-sm text-[var(--color-text-muted)] md:grid-cols-2">
            <p><strong className="text-[var(--color-primary)]">Objective:</strong> {details.mainObjective || "Not specified"}</p>
            <p><strong className="text-[var(--color-primary)]">Testing:</strong> {details.testingRequired || "Not specified"}</p>
            <p><strong className="text-[var(--color-primary)]">Follow-up:</strong> {details.followUpQuestions || "None"}</p>
            <p><strong className="text-[var(--color-primary)]">Evidence:</strong> {task.evidenceNote || "Optional in Phase 1"}</p>
          </div>
        </details>

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
          suggestions={escalationSuggestions}
        /> : null}
        {showSupport ? <PeopleEditor
          title="Supporting Personnel"
          rows={draft.supportingPersonnel}
          addLabel="Add supporting person"
          onChange={(rows) => setDraft({ ...draft, supportingPersonnel: rows })}
          kind="support"
          teamTypeOptions={teamTypeOptions}
          suggestions={supportSuggestions}
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
          const details = taskDetails(state, task);
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
                  <h3 className="mt-2 font-black text-[var(--color-primary)]">{details.taskDetails}</h3>
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
  const [savingAccessId, setSavingAccessId] = useState("");
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
  const saveUserAccess = async (profile: Profile, nextRole: UserRole, nextStatus: Profile["status"], nextAreaIds: string[], viewerAccess?: Profile["viewerAccess"]) => {
    if (profile.id === currentProfile.id) {
      showToast("Own access protected", "Edit another Super Admin if you need to change your own access.", "warning");
      return;
    }
    try {
      setSavingAccessId(profile.id);
      setAccessMessage("Saving access...");
      const uniqueAreaIds = Array.from(new Set(nextAreaIds));
      const result = isEventPrepSupabaseConfigured()
        ? await updateCredentialAccess({ profileId: profile.id, role: nextRole, status: nextStatus, areaIds: uniqueAreaIds, viewerAccess: nextRole === "viewer" ? viewerAccess : undefined })
        : {
          profile: { ...profile, role: nextRole, status: nextStatus, viewerAccess: nextRole === "viewer" ? viewerAccess : undefined },
          areaAccess: ["super_admin", "admin"].includes(nextRole) ? [] : uniqueAreaIds.map((nextAreaId) => ({ id: `access-${profile.id}-${nextAreaId}-${nextRole}`, profileId: profile.id, areaId: nextAreaId, role: nextRole }))
        };
      updateState((current) => {
        return withActivity({
          ...current,
          profiles: current.profiles.map((item) => (item.id === profile.id ? result.profile : item)),
          areaAccess: [...current.areaAccess.filter((access) => access.profileId !== profile.id), ...result.areaAccess]
        }, currentProfile, "Access changes", `Updated access for ${profile.fullName}`, "profile", profile.id, { role: nextRole, status: nextStatus });
      });
      setAccessMessage("Access saved to Supabase.");
      showToast("Access updated", `${profile.fullName}'s role and area access were updated.`);
    } catch (error) {
      setAccessMessage(readError(error, "Unable to save access."));
      showToast("Access update failed", readError(error, "Please try again."), "error");
    } finally {
      setSavingAccessId("");
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
      {currentProfile.role === "super_admin" ? (
        <Panel title="Manage Active User Access" action={<Badge>Super Admin only</Badge>}>
          <div className="grid gap-3">
            {state.profiles.filter((profile) => profile.status === "active" && profile.id !== currentProfile.id).map((profile) => (
              <AccessEditor
                key={profile.id}
                profile={profile}
                areas={state.areas}
                zoneTypes={state.zoneTypes}
                currentAreaIds={state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => access.areaId)}
                onSave={saveUserAccess}
                saving={savingAccessId === profile.id}
              />
            ))}
            {!state.profiles.some((profile) => profile.status === "active" && profile.id !== currentProfile.id) ? <EmptyState title="No active users to edit" body="Create or approve users first, then their access controls will appear here." /> : null}
          </div>
        </Panel>
      ) : null}
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

function AccessEditor({
  profile,
  areas,
  zoneTypes,
  currentAreaIds,
  onSave,
  saving = false
}: {
  profile: Profile;
  areas: EventPrepState["areas"];
  zoneTypes: EventPrepState["zoneTypes"];
  currentAreaIds: string[];
  onSave: (profile: Profile, nextRole: UserRole, nextStatus: Profile["status"], nextAreaIds: string[], viewerAccess?: Profile["viewerAccess"]) => void | Promise<void>;
  saving?: boolean;
}) {
  const [role, setRole] = useState<UserRole>(profile.role);
  const [status, setStatus] = useState<Profile["status"]>(profile.status);
  const [areaIds, setAreaIds] = useState<string[]>(currentAreaIds);
  const currentViewerAccess = viewerAccessFor(profile, { areas, zoneTypes } as EventPrepState);
  const [viewerDashboard, setViewerDashboard] = useState(currentViewerAccess.canSeeDashboard);
  const [viewerZoneIds, setViewerZoneIds] = useState<string[]>(currentViewerAccess.zoneTypeIds);
  const [viewerReportTypes, setViewerReportTypes] = useState<string[]>(currentViewerAccess.reportTypes);
  const [viewerPdf, setViewerPdf] = useState(currentViewerAccess.canExportPdf);
  const [viewerExcel, setViewerExcel] = useState(currentViewerAccess.canExportExcel);
  useEffect(() => {
    setRole(profile.role);
    setStatus(profile.status);
    setAreaIds(currentAreaIds);
    const access = viewerAccessFor(profile, { areas, zoneTypes } as EventPrepState);
    setViewerDashboard(access.canSeeDashboard);
    setViewerZoneIds(access.zoneTypeIds);
    setViewerReportTypes(access.reportTypes);
    setViewerPdf(access.canExportPdf);
    setViewerExcel(access.canExportExcel);
  }, [profile.id, profile.role, profile.status, currentAreaIds.join("|"), areas.length, zoneTypes.length]);
  const allAreasRole = ["super_admin", "admin"].includes(role);
  const nextViewerAccess: Profile["viewerAccess"] = {
    canSeeDashboard: viewerDashboard,
    zoneTypeIds: viewerZoneIds,
    areaIds,
    reportTypes: viewerReportTypes,
    canExportPdf: viewerPdf,
    canExportExcel: viewerExcel
  };
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-black text-[var(--color-primary)]">{profile.fullName}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{profile.email}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[12rem_12rem_auto] md:items-end">
          <Select label="Role" value={role} onChange={(value) => setRole(value as UserRole)} options={["super_admin", "admin", "area_admin", "verifier", "report_user", "viewer"].map((value) => ({ label: roleLabel(value as UserRole), value }))} />
          <Select label="Status" value={status} onChange={(value) => setStatus(value as Profile["status"])} options={[{ label: "Active", value: "active" }, { label: "Pending Approval", value: "pending_approval" }, { label: "Disabled", value: "disabled" }]} />
          <button className="btn-primary" disabled={saving} onClick={() => onSave(profile, role, status, areaIds, role === "viewer" ? nextViewerAccess : undefined)}>
            {saving ? <Spinner /> : null}
            {saving ? "Saving..." : "Save Access"}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <p className="field-label">Area access</p>
        {allAreasRole ? (
          <p className="mt-2 rounded-lg bg-white p-3 text-sm font-bold text-[var(--color-primary)]">This role can access all areas.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <label key={area.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white p-2 text-sm font-bold text-[var(--color-primary)]">
                <input
                  type="checkbox"
                  checked={areaIds.includes(area.id)}
                  onChange={(event) => setAreaIds((current) => event.target.checked ? [...current, area.id] : current.filter((idValue) => idValue !== area.id))}
                />
                {area.name}
              </label>
            ))}
          </div>
        )}
      </div>
      {role === "viewer" ? (
        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-black text-[var(--color-primary)]">
            <Eye size={16} />
            Viewer permissions
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">
              <input type="checkbox" checked={viewerDashboard} onChange={(event) => setViewerDashboard(event.target.checked)} />
              Can see dashboard
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">
              <input type="checkbox" checked={viewerPdf} onChange={(event) => setViewerPdf(event.target.checked)} />
              Can export PDF
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">
              <input type="checkbox" checked={viewerExcel} onChange={(event) => setViewerExcel(event.target.checked)} />
              Can export Excel
            </label>
          </div>
          <div className="mt-3">
            <p className="field-label">Visible zone types</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {zoneTypes.map((zone) => (
                <label key={zone.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm font-bold text-[var(--color-primary)]">
                  <input
                    type="checkbox"
                    checked={viewerZoneIds.includes(zone.id)}
                    onChange={(event) => setViewerZoneIds((current) => event.target.checked ? [...current, zone.id] : current.filter((idValue) => idValue !== zone.id))}
                  />
                  {zone.name}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="field-label">Allowed report types</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {["Daily Area Report PDF", "Overall Progress Report PDF"].map((reportType) => (
                <label key={reportType} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm font-bold text-[var(--color-primary)]">
                  <input
                    type="checkbox"
                    checked={viewerReportTypes.includes(reportType)}
                    onChange={(event) => setViewerReportTypes((current) => event.target.checked ? [...current, reportType] : current.filter((value) => value !== reportType))}
                  />
                  {reportType}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </article>
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

function ReportsTab({ state, currentProfile, updateState, showToast }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void; showToast: ShowToast }) {
  const isAdmin = ["super_admin", "admin"].includes(currentProfile.role);
  const viewerAccess = viewerAccessFor(currentProfile, state);
  const allowedAreas = dashboardAllowedAreas(state, currentProfile);
  const [reportType, setReportType] = useState("Overall Progress Report");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [areaId, setAreaId] = useState("All");
  const [workstreamFilter, setWorkstreamFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [reportDate, setReportDate] = useState(todayIso());
  const canPdf = isAdmin || viewerAccess.canExportPdf;
  const canExcel = isAdmin || viewerAccess.canExportExcel;
  const canDaily = isAdmin || viewerAccess.reportTypes.includes("Daily Area Report PDF");
  const canOverall = isAdmin || viewerAccess.reportTypes.includes("Overall Progress Report PDF");
  const exportHistory = isAdmin ? state.reportExports : state.reportExports.filter((reportExport) => reportExport.requestedBy === currentProfile.id);
  const reportTypes = useMemo(() => {
    const options = [
      "Overall Progress Report",
      "Area-wise Daily Report",
      "Workstream Report",
      "Task Status Report",
      "Verification Report",
      "Requests Report",
      "Issues / Attention Required Report",
      "Printable Project Status Report"
    ];
    return isAdmin ? options : options.filter((type) => type === "Area-wise Daily Report" ? canDaily : canOverall);
  }, [isAdmin, canDaily, canOverall]);
  useEffect(() => {
    if (reportTypes.length && !reportTypes.includes(reportType)) setReportType(reportTypes[0]);
  }, [reportType, reportTypes]);
  const visibleAreaOptions = allowedAreas.filter((area) => zoneFilter === "All" || area.zoneTypeId === zoneFilter);
  const workstreamOptions = unique(state.liveTasks.filter((task) => allowedAreas.some((area) => area.id === task.areaId)).map((task) => taskDetails(state, task).workstream || "General"));
  const previewData = buildReportPreviewData(state, {
    allowedAreaIds: allowedAreas.map((area) => area.id),
    zoneTypeId: zoneFilter,
    areaId,
    workstream: workstreamFilter,
    status: statusFilter,
    priority: priorityFilter,
    verificationStatus: verificationFilter,
    requestStatus: requestStatusFilter,
    dueFrom,
    dueTo,
    reportDate
  });

  const recordExport = (exportType: string, selectedAreaId?: string) => {
    const createdAt = new Date().toISOString();
    const reportExport: ReportExport = {
      id: id("export"),
      exportType,
      requestedBy: currentProfile.id,
      areaId: selectedAreaId,
      status: "generated",
      createdAt
    };
    updateState((current) => withActivity({
      ...current,
      reportExports: [reportExport, ...current.reportExports]
    }, currentProfile, "Daily reports", `Generated ${exportType}`, "report_export", reportExport.id, { exportType }));
  };

  const printReport = () => {
    if (!canPdf || (!canOverall && reportType !== "Area-wise Daily Report") || (reportType === "Area-wise Daily Report" && !canDaily)) {
      showToast("Export not allowed", "Your access does not allow this PDF report.", "warning");
      return;
    }
    recordExport(`${reportType} PDF`, areaId === "All" ? undefined : areaId);
    showToast("Print dialog opening", "Choose Save as PDF in the browser print dialog.", "info");
    window.setTimeout(() => window.print(), 120);
  };

  const exportExcel = async () => {
    if (!canExcel) {
      showToast("Excel export blocked", "This account does not have Excel export permission.", "warning");
      return;
    }
    try {
      await exportAdminWorkbook(state, allowedAreas.map((area) => area.id), isAdmin);
      recordExport(isAdmin ? "Admin Excel Export" : "Viewer Excel Export");
      showToast("Excel exported", "The workbook download has started.", "success");
    } catch (error) {
      showToast("Excel export failed", readError(error, "Could not generate workbook."), "error");
    }
  };

  return (
    <div className="reports-workspace">
      <aside className="reports-control-panel no-print">
        <div>
          <p className="text-xs font-black uppercase text-[var(--color-accent)]">Reports Module</p>
          <h2 className="mt-1 text-xl font-black text-[var(--color-primary)]">Generate Report</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Preview uses current website data and prints as the final report.</p>
        </div>
        <div className="grid gap-3">
          <Select label="Report Type" value={reportType} onChange={setReportType} options={reportTypes} />
          <Select label="Zone Type" value={zoneFilter} onChange={(value) => {
            setZoneFilter(value);
            setAreaId("All");
          }} options={["All", ...state.zoneTypes.map((zone) => ({ label: zone.name, value: zone.id }))]} />
          <Select label="Area" value={areaId} onChange={setAreaId} options={["All", ...visibleAreaOptions.map((area) => ({ label: area.name, value: area.id }))]} />
          <Select label="Workstream" value={workstreamFilter} onChange={setWorkstreamFilter} options={["All", ...workstreamOptions]} />
          <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={["All", ...USER_TASK_STATUSES]} />
          <Select label="Verification Status" value={verificationFilter} onChange={setVerificationFilter} options={["All", ...VERIFICATION_STATUSES]} />
          <Select label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["All", ...activeOptions(state, "Priority options", PRIORITY_OPTIONS)]} />
          <Select label="Request Status" value={requestStatusFilter} onChange={setRequestStatusFilter} options={["All", ...REQUEST_STATUSES]} />
          <Input label="Report date" value={reportDate} onChange={setReportDate} type="date" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Due from" value={dueFrom} onChange={setDueFrom} type="date" />
            <Input label="Due to" value={dueTo} onChange={setDueTo} type="date" />
          </div>
        </div>
        <div className="grid gap-2">
          <button className="btn-primary" disabled={!canPdf} onClick={printReport}><FileDown size={16} /> Export PDF / Print</button>
          <button className="btn-secondary" disabled={!canPdf} onClick={printReport}><Download size={16} /> Print Preview</button>
          <button className="btn-secondary" disabled={!canExcel} onClick={exportExcel}><FileSpreadsheet size={16} /> Export Data CSV / Excel</button>
          <button className="btn-secondary" disabled={!canExcel} onClick={() => exportLiveTasksCsv({ ...state, liveTasks: previewData.tasks })}><Download size={16} /> Export Task CSV</button>
        </div>
        <div className="hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-accent-light)]/60 p-3 text-xs font-bold text-[var(--color-primary)]">
          Browser print is the PDF engine. Choose “Save as PDF” from the print dialog.
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-accent-light)]/60 p-3 text-xs font-bold text-[var(--color-primary)]">
          Browser print is the PDF engine. Choose "Save as PDF" from the print dialog.
        </div>
      </aside>

      <section className="reports-preview-column">
        <ReportPreview state={state} data={previewData} reportType={reportType} reportDate={reportDate} currentProfile={currentProfile} />
        <div className="no-print mt-4">
          <Panel title="Export History" action={<Badge>{exportHistory.length} export(s)</Badge>}>
            <ResponsiveTable
              headers={["Type", "Requested By", "Area", "Status", "Created"]}
              rows={exportHistory.map((reportExport) => [
                reportExport.exportType,
                state.profiles.find((profile) => profile.id === reportExport.requestedBy)?.fullName || "User",
                reportExport.areaId ? areaName(state, reportExport.areaId) : "Overall",
                <StatusBadge key="status" value={reportExport.status} />,
                new Date(reportExport.createdAt).toLocaleString()
              ])}
            />
          </Panel>
        </div>
      </section>
    </div>
  );
}

type ReportPreviewData = ReturnType<typeof buildReportPreviewData>;

function ReportPreview({ state, data, reportType, reportDate, currentProfile }: { state: EventPrepState; data: ReportPreviewData; reportType: string; reportDate: string; currentProfile: Profile }) {
  const isDaily = reportType === "Area-wise Daily Report";
  const isProject = reportType === "Printable Project Status Report";
  const isRequests = reportType === "Requests Report";
  const isAttention = reportType === "Issues / Attention Required Report";
  const isVerification = reportType === "Verification Report";
  const title = isProject ? "Ashara Mubarakah IT Preparation Project Status" : "Ashara Mubarakah IT Preparation Report";

  return (
    <article className="report-preview-shell">
      <ReportHeader title={title} reportType={reportType} generatedBy={currentProfile.fullName} filters={data.filterLabel} daysToEvent={data.metrics.daysToEvent} />
      {data.tasks.length || data.requests.length || data.dailyReports.length ? (
        <>
          <ReportKpiCards data={data} />
          {isDaily ? <AreaDailyReportPreview state={state} data={data} reportDate={reportDate} /> : null}
          {isProject ? <ProjectStatusReportPreview state={state} data={data} /> : null}
          {!isDaily && !isProject ? (
            <>
              <ReportChartGrid data={data} />
              {isRequests ? <RequestsReportPreview state={state} data={data} /> : null}
              {isAttention ? <AttentionReportPreview state={state} data={data} /> : null}
              {isVerification ? <VerificationReportPreview state={state} data={data} /> : null}
              {!isRequests && !isAttention && !isVerification ? <ProgressReportPreview state={state} data={data} /> : null}
            </>
          ) : null}
          <ReportSummaryNotes data={data} />
        </>
      ) : <EmptyState title="No data available for the selected filters" body="Adjust report filters or add event preparation data first." />}
    </article>
  );
}

function ReportHeader({ title, reportType, generatedBy, filters, daysToEvent }: { title: string; reportType: string; generatedBy: string; filters: string; daysToEvent: number }) {
  return (
    <header className="report-template-header">
      <div>
        <p className="report-brand">Ashara Mubarakah</p>
        <h1>{title}</h1>
        <p>{reportType} | Generated {new Date().toLocaleString()} | Prepared by {generatedBy}</p>
        <p className="mt-1">{filters}</p>
      </div>
      <div className="report-countdown">
        <span>{daysToEvent}</span>
        <small>days to event</small>
      </div>
    </header>
  );
}

function ReportKpiCards({ data }: { data: ReportPreviewData }) {
  const cards = [
    ["Overall Progress", `${data.metrics.overallVerifiedPercent}%`, "Verified completed"],
    ["Total Tasks", String(data.tasks.length), "Filtered task count"],
    ["Verified Tasks", String(data.verifiedTasks.length), "Counts as complete"],
    ["In Progress", String(data.inProgressTasks.length), "Currently active"],
    ["Pending", String(data.pendingTasks.length), "Not complete"],
    ["Issues", String(data.issueTasks.length), "Needs attention"],
    ["Overdue", String(data.overdueTasks.length), "Past due date"],
    ["Requests Pending", String(data.pendingRequests.length), "Open requests"],
    ["Reports Submitted", String(data.metrics.submittedReports), "Selected report date"],
    ["Missing / Partial", String(data.metrics.missingOrPartialReports), "Daily report attention"]
  ];
  return (
    <section className="report-kpi-grid">
      {cards.map(([label, value, helper]) => (
        <div key={label} className="report-kpi-card">
          <p>{label}</p>
          <strong>{value}</strong>
          <span>{helper}</span>
        </div>
      ))}
    </section>
  );
}

function ReportChartGrid({ data }: { data: ReportPreviewData }) {
  return (
    <section className="report-chart-grid">
      <div className="report-card">
        <h2>Task Status Distribution</h2>
        <DonutChart rows={data.statusRows} />
      </div>
      <div className="report-card">
        <h2>Area-wise Progress</h2>
        <BarList rows={data.areaRows.slice(0, 10).map((row) => ({ label: row.area, value: row.progress, helper: `${row.verified}/${row.total} verified` }))} />
      </div>
      <div className="report-card">
        <h2>Workstream Progress</h2>
        <BarList rows={data.workstreamRows.slice(0, 10).map((row) => ({ label: row.workstream, value: row.progress, helper: `${row.verified}/${row.total} verified` }))} />
      </div>
      <div className="report-card report-attention-card">
        <h2>Attention Required</h2>
        <AttentionList rows={data.attentionRows} />
      </div>
      <div className="report-card">
        <h2>Daily Report Trend</h2>
        <LineTrendChart rows={data.dailyReportTrendRows} />
      </div>
    </section>
  );
}

function ProgressReportPreview({ data }: { state: EventPrepState; data: ReportPreviewData }) {
  return (
    <section className="report-card report-page-break">
      <h2>Area Progress Summary</h2>
      <PrintableTable
        headers={["Area", "Zone Type", "Total Tasks", "Verified", "In Progress", "Pending", "Issues", "Progress"]}
        rows={data.areaRows.map((row) => [row.area, row.zone, row.total, row.verified, row.inProgress, row.pending, row.issues, `${row.progress}%`])}
      />
    </section>
  );
}

function AreaDailyReportPreview({ state, data, reportDate }: { state: EventPrepState; data: ReportPreviewData; reportDate: string }) {
  const area = data.areas[0] || data.areas.find(Boolean);
  const report = area ? state.dailyReports.find((item) => item.areaId === area.id && item.reportDate === reportDate) : undefined;
  const submittedBy = state.profiles.find((profile) => profile.id === report?.submittedBy)?.fullName || "-";
  const dayTasks = area ? data.tasks.filter((task) => task.areaId === area.id && task.prepDay === prepDayForDate(state.settings.preparationStartDate, reportDate)) : data.tasks;
  const updatedTaskIds = new Set(data.updates.map((update) => update.liveTaskId));
  const issueUpdates = data.updates.filter((update) => update.status === "Issue Found" || update.escalationPoints.length);
  return (
    <>
      <section className="report-card">
        <h2>Daily Area Summary</h2>
        <div className="report-info-grid">
          <MiniReportFact label="Area" value={area?.name || "All selected areas"} />
          <MiniReportFact label="Zone Type" value={area ? zoneName(state, area.zoneTypeId) : "Multiple"} />
          <MiniReportFact label="Report Date" value={reportDate} />
          <MiniReportFact label="Submitted Status" value={report?.status || "Not Started"} />
          <MiniReportFact label="Submitted By" value={submittedBy} />
          <MiniReportFact label="Submitted Time" value={report?.submittedAt ? new Date(report.submittedAt).toLocaleString() : "-"} />
        </div>
        <div className="mt-4 rounded-lg bg-[var(--color-bg)] p-3">
          <p className="field-label">General Daily Remark</p>
          <p className="mt-1 text-sm text-[var(--color-text)]">{report?.generalRemark || "No general remark available for the selected report date."}</p>
        </div>
      </section>
      <section className="report-card report-page-break">
        <h2>Task Updates</h2>
        <PrintableTable
          headers={["Task", "Workstream", "Priority", "Status", "Progress", "Due Date", "Remarks", "Supporting / POC"]}
          rows={dayTasks.map((task) => {
            const details = taskDetails(state, task);
            const update = data.latest.get(task.id);
            return [
              details.taskDetails,
              details.workstream,
              task.priority,
              update?.status || "Pending",
              `${taskProgressPercent(task, update)}%`,
              task.dueDate || "-",
              update?.remarks || "-",
              update?.supportingPersonnel.map((person) => person.name || person.roleStanding).filter(Boolean).join(", ") || details.responsibleTeam || "-"
            ];
          })}
        />
      </section>
      <section className="report-card">
        <h2>Issues / Escalations</h2>
        <PrintableTable
          headers={["Task", "Status", "Escalation / Remark", "Verification"]}
          rows={issueUpdates.map((update) => {
            const task = state.liveTasks.find((item) => item.id === update.liveTaskId);
            const escalation = update.escalationPoints.map((point) => `${point.name || "Escalation"}: ${point.reason}`).join("; ");
            return [task ? taskDetails(state, task).taskDetails : "Task", update.status, escalation || update.remarks || "-", update.verificationStatus];
          })}
        />
      </section>
      <section className="report-card">
        <h2>Evidence / Attachments</h2>
        <PrintableTable
          headers={["Task", "Files"]}
          rows={dayTasks.filter((task) => updatedTaskIds.has(task.id)).map((task) => [taskDetails(state, task).taskDetails, state.taskFiles.filter((file) => file.liveTaskId === task.id).map((file) => file.fileName).join(", ") || "No evidence uploaded"])}
        />
      </section>
    </>
  );
}

function ProjectStatusReportPreview({ state, data }: { state: EventPrepState; data: ReportPreviewData }) {
  const completed = data.verifiedTasks.slice(0, 8);
  const upcoming = data.tasks.filter((task) => task.dueDate >= todayIso() && data.latest.get(task.id)?.verificationStatus !== "Verified Completed").slice(0, 8);
  return (
    <>
      <section className="report-card">
        <h2>Project Description</h2>
        <p className="report-body-text">This report gives an overview of IT preparation progress across CMZ, Central Office, and Relay Zones using the current dashboard data.</p>
      </section>
      <ReportChartGrid data={data} />
      <section className="report-card report-page-break">
        <h2>Work Completed</h2>
        <PrintableTable headers={["Task", "Area", "Target Date", "Status"]} rows={completed.map((task) => [taskDetails(state, task).taskDetails, areaName(state, task.areaId), task.dueDate || "-", "Verified Completed"])} />
      </section>
      <section className="report-card">
        <h2>Work Planned / Upcoming</h2>
        <PrintableTable headers={["Task", "Area", "Target Date", "Status", "Progress"]} rows={upcoming.map((task) => [taskDetails(state, task).taskDetails, areaName(state, task.areaId), task.dueDate || "-", data.latest.get(task.id)?.status || "Pending", `${taskProgressPercent(task, data.latest.get(task.id))}%`])} />
      </section>
      <section className="report-card">
        <h2>Risks / Issues</h2>
        <PrintableTable headers={["Issue / Task", "Area", "Impact / Remarks", "Owner / POC", "Due", "Status"]} rows={data.riskTasks.map((task) => {
          const update = data.latest.get(task.id);
          const details = taskDetails(state, task);
          return [details.taskDetails, areaName(state, task.areaId), update?.remarks || task.delayReason || "Requires attention", details.responsibleTeam || "-", task.dueDate || "-", update?.status || "Pending"];
        })} />
      </section>
    </>
  );
}

function RequestsReportPreview({ state, data }: { state: EventPrepState; data: ReportPreviewData }) {
  return (
    <section className="report-card report-page-break">
      <h2>Requests Summary</h2>
      <PrintableTable headers={["Request", "Type", "Area", "Priority", "Required By", "Status", "Decision"]} rows={data.requests.map((request) => [request.title, request.requestType, areaName(state, request.areaId), request.priority, request.requiredByDate, request.status, request.decisionRemarks || "-"])} />
    </section>
  );
}

function VerificationReportPreview({ state, data }: { state: EventPrepState; data: ReportPreviewData }) {
  return (
    <section className="report-card report-page-break">
      <h2>Verification Queue</h2>
      <PrintableTable headers={["Task", "Area", "Verification", "Verifiers", "Last Remark"]} rows={data.tasks.filter((task) => ["Needs Verification", "Partially Verified", "Rejected / Needs Correction", "Verified Completed"].includes(data.latest.get(task.id)?.verificationStatus || "")).map((task) => {
        const update = data.latest.get(task.id);
        return [taskDetails(state, task).taskDetails, areaName(state, task.areaId), update?.verificationStatus || "Not Submitted", task.assignedVerifierIds.map((idValue) => state.profiles.find((profile) => profile.id === idValue)?.fullName || idValue).join(", ") || "-", update?.correctionComment || update?.remarks || "-"];
      })} />
    </section>
  );
}

function AttentionReportPreview({ state, data }: { state: EventPrepState; data: ReportPreviewData }) {
  return (
    <section className="report-card report-page-break">
      <h2>Issue / Attention Details</h2>
      <PrintableTable headers={["Task / Item", "Area", "Reason", "Due Date", "Status"]} rows={data.riskTasks.map((task) => {
        const update = data.latest.get(task.id);
        return [taskDetails(state, task).taskDetails, areaName(state, task.areaId), update?.correctionComment || update?.remarks || task.delayReason || "Overdue or issue found", task.dueDate || "-", update?.verificationStatus || update?.status || "Pending"];
      })} />
    </section>
  );
}

function ReportSummaryNotes({ data }: { data: ReportPreviewData }) {
  const weakestArea = data.areaRows.slice().sort((a, b) => a.progress - b.progress)[0];
  return (
    <section className="report-card">
      <h2>Summary Notes</h2>
      <p className="report-body-text">
        Overall IT preparation is currently {data.metrics.overallVerifiedPercent}% verified complete across the selected scope.
        {weakestArea ? ` ${weakestArea.area} requires attention at ${weakestArea.progress}% verified completion.` : ""}
        {data.issueTasks.length ? ` ${data.issueTasks.length} issue task(s) are currently marked for follow-up.` : " No issue-found tasks are visible in the selected filters."}
      </p>
    </section>
  );
}

function DonutChart({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let offset = 25;
  const segments = rows.map((row) => {
    const dash = total ? (row.value / total) * 100 : 0;
    const segment = <circle key={row.label} cx="60" cy="60" r="42" fill="none" stroke={row.color} strokeWidth="16" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} pathLength="100" />;
    offset -= dash;
    return segment;
  });
  return (
    <div className="report-donut-wrap">
      <svg viewBox="0 0 120 120" className="report-donut" role="img" aria-label="Status distribution donut chart">
        <circle cx="60" cy="60" r="42" fill="none" stroke="#F3E7C3" strokeWidth="16" />
        {segments}
        <text x="60" y="57" textAnchor="middle" className="report-donut-number">{total}</text>
        <text x="60" y="73" textAnchor="middle" className="report-donut-label">tasks</text>
      </svg>
      <div className="report-chart-legend">
        {rows.map((row) => <span key={row.label}><i style={{ background: row.color }} />{row.label}: {row.value}</span>)}
      </div>
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number; helper?: string }> }) {
  if (!rows.length) return <p className="text-sm text-[var(--color-text-muted)]">No chart data available.</p>;
  return (
    <div className="report-bar-list">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between gap-3">
            <p>{row.label}</p>
            <strong>{row.value}%</strong>
          </div>
          <div className="report-bar-track"><span style={{ width: `${row.value}%` }} /></div>
          {row.helper ? <small>{row.helper}</small> : null}
        </div>
      ))}
    </div>
  );
}

function LineTrendChart({ rows }: { rows: Array<{ label: string; submitted: number; attention: number }> }) {
  if (!rows.length) return <p className="text-sm text-[var(--color-text-muted)]">No daily report trend data available.</p>;
  const maxValue = Math.max(1, ...rows.map((row) => Math.max(row.submitted, row.attention)));
  const pointsFor = (key: "submitted" | "attention") => rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    const y = 88 - (row[key] / maxValue) * 70;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="report-line-chart">
      <svg viewBox="0 0 100 100" role="img" aria-label="Daily report submission trend">
        <line x1="0" y1="88" x2="100" y2="88" />
        <line x1="0" y1="18" x2="0" y2="88" />
        <polyline points={pointsFor("attention")} className="attention-line" />
        <polyline points={pointsFor("submitted")} className="submitted-line" />
        {rows.map((row, index) => {
          const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
          const y = 88 - (row.submitted / maxValue) * 70;
          return <circle key={row.label} cx={x} cy={y} r="2.2" />;
        })}
      </svg>
      <div className="report-chart-legend">
        <span><i style={{ background: "#0B4F3A" }} />Submitted</span>
        <span><i style={{ background: "#7A1F2B" }} />Missing / partial / late</span>
      </div>
      <div className="report-trend-labels">
        <span>{rows[0]?.label}</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function AttentionList({ rows }: { rows: Array<{ label: string; count: number }> }) {
  return (
    <div className="report-attention-list">
      {rows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.count}</strong></div>)}
    </div>
  );
}

function PrintableTable({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="print-table-wrap">
      <table className="print-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>No data available for the selected filters.</td></tr>}</tbody>
      </table>
    </div>
  );
}

function MiniReportFact({ label, value }: { label: string; value: string }) {
  return <div className="mini-report-fact"><p>{label}</p><strong>{value}</strong></div>;
}

function buildReportPreviewData(state: EventPrepState, filters: {
  allowedAreaIds: string[];
  zoneTypeId: string;
  areaId: string;
  workstream: string;
  status: string;
  priority: string;
  verificationStatus: string;
  requestStatus: string;
  dueFrom: string;
  dueTo: string;
  reportDate: string;
}) {
  const latest = latestUpdateMap(state.taskUpdates);
  const areas = state.areas.filter((area) =>
    filters.allowedAreaIds.includes(area.id) &&
    (filters.zoneTypeId === "All" || area.zoneTypeId === filters.zoneTypeId) &&
    (filters.areaId === "All" || area.id === filters.areaId)
  );
  const areaIds = areas.map((area) => area.id);
  const tasks = state.liveTasks.filter((task) => {
    const details = taskDetails(state, task);
    const update = latest.get(task.id);
    return (
      areaIds.includes(task.areaId) &&
      task.active &&
      !task.notApplicable &&
      (filters.workstream === "All" || (details.workstream || "General") === filters.workstream) &&
      (filters.priority === "All" || task.priority === filters.priority) &&
      (filters.status === "All" || (update?.status || "Pending") === filters.status) &&
      (filters.verificationStatus === "All" || (update?.verificationStatus || "Not Submitted") === filters.verificationStatus) &&
      (!filters.dueFrom || task.dueDate >= filters.dueFrom) &&
      (!filters.dueTo || task.dueDate <= filters.dueTo)
    );
  });
  const taskIds = new Set(tasks.map((task) => task.id));
  const reportDate = filters.reportDate || todayIso();
  const dailyReports = state.dailyReports.filter((report) => areaIds.includes(report.areaId) && (!reportDate || report.reportDate === reportDate));
  const reportIds = new Set(dailyReports.map((report) => report.id));
  const updates = state.taskUpdates.filter((update) => taskIds.has(update.liveTaskId) && (!reportIds.size || reportIds.has(update.dailyReportId)));
  const requests = state.requests.filter((request) => areaIds.includes(request.areaId) && (filters.requestStatus === "All" || request.status === filters.requestStatus));
  const verifiedTasks = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed");
  const inProgressTasks = tasks.filter((task) => latest.get(task.id)?.status === "In Progress");
  const pendingTasks = tasks.filter((task) => !latest.get(task.id) || latest.get(task.id)?.status === "Pending");
  const issueTasks = tasks.filter((task) => latest.get(task.id)?.status === "Issue Found");
  const needsVerificationTasks = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Needs Verification");
  const rejectedTasks = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Rejected / Needs Correction");
  const overdueTasks = tasks.filter((task) => task.dueDate < todayIso() && latest.get(task.id)?.verificationStatus !== "Verified Completed");
  const riskTasks = uniqueBy([...issueTasks, ...rejectedTasks, ...overdueTasks], (task) => task.id);
  const pendingRequests = requests.filter((request) => ["Under Review", "Sent for Verification", "Need More Info"].includes(request.status));
  const submittedReports = dailyReports.filter((report) => ["Submitted", "Late Submitted", "Closed"].includes(report.status)).length;
  const missingReports = Math.max(0, areas.filter((area) => area.active).length - dailyReports.filter((report) => ["Submitted", "Late Submitted", "Closed", "Draft Saved", "Partially Updated"].includes(report.status)).length);
  const partialReports = dailyReports.filter((report) => ["Draft Saved", "Partially Updated"].includes(report.status)).length;
  const metrics: DashboardMetrics = {
    overallVerifiedPercent: percent(verifiedTasks.length, tasks.length),
    totalLiveTasks: tasks.length,
    verifiedTasks: verifiedTasks.length,
    submittedReports,
    missingOrPartialReports: missingReports + partialReports,
    needsVerification: needsVerificationTasks.length,
    issueFound: issueTasks.length,
    pendingRequests: pendingRequests.length,
    daysToEvent: Math.max(0, Math.ceil((new Date(`${state.settings.eventStartDate}T00:00:00`).getTime() - Date.now()) / 86400000))
  };
  const areaRows = areas.map((area) => {
    const areaTasks = tasks.filter((task) => task.areaId === area.id);
    const verified = areaTasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    const inProgress = areaTasks.filter((task) => latest.get(task.id)?.status === "In Progress").length;
    const issues = areaTasks.filter((task) => latest.get(task.id)?.status === "Issue Found").length;
    return {
      area: area.name,
      zone: zoneName(state, area.zoneTypeId),
      total: areaTasks.length,
      verified,
      inProgress,
      pending: areaTasks.filter((task) => !latest.get(task.id) || latest.get(task.id)?.status === "Pending").length,
      issues,
      progress: percent(verified, areaTasks.length)
    };
  }).filter((row) => row.total || filters.areaId !== "All");
  const workstreamRows = unique(tasks.map((task) => taskDetails(state, task).workstream || "General")).map((workstream) => {
    const workstreamTasks = tasks.filter((task) => (taskDetails(state, task).workstream || "General") === workstream);
    const verified = workstreamTasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return { workstream, total: workstreamTasks.length, verified, progress: percent(verified, workstreamTasks.length) };
  });
  const statusRows = [
    { label: "Pending", value: pendingTasks.length, color: "#F3E7C3" },
    { label: "In Progress", value: inProgressTasks.length, color: "#2E7D5B" },
    { label: "Issue Found", value: issueTasks.length, color: "#7A1F2B" },
    { label: "Needs Verification", value: needsVerificationTasks.length, color: "#C9A227" },
    { label: "Verified Completed", value: verifiedTasks.length, color: "#0B4F3A" },
    { label: "Needs Correction", value: rejectedTasks.length, color: "#9F3642" }
  ].filter((row) => row.value > 0);
  const attentionRows = [
    { label: "Missing Daily Reports", count: missingReports },
    { label: "Partially Updated Reports", count: partialReports },
    { label: "Late Submitted Reports", count: dailyReports.filter((report) => report.status === "Late Submitted").length },
    { label: "Issue Found Tasks", count: issueTasks.length },
    { label: "Overdue Tasks", count: overdueTasks.length },
    { label: "Pending Verification", count: needsVerificationTasks.length },
    { label: "Rejected / Needs Correction", count: rejectedTasks.length },
    { label: "Pending Requests", count: pendingRequests.length }
  ];
  const dailyReportTrendRows = unique(dailyReports.map((report) => report.reportDate)).sort().slice(-10).map((date) => {
    const reportsForDate = dailyReports.filter((report) => report.reportDate === date);
    return {
      label: date.slice(5),
      submitted: reportsForDate.filter((report) => ["Submitted", "Closed"].includes(report.status)).length,
      attention: reportsForDate.filter((report) => ["Draft Saved", "Partially Updated", "Late Submitted", "Escalated", "Not Started"].includes(report.status)).length
    };
  });
  const filterLabel = [
    filters.zoneTypeId === "All" ? "All Zone Types" : zoneName(state, filters.zoneTypeId),
    filters.areaId === "All" ? "All Areas" : areaName(state, filters.areaId),
    filters.workstream === "All" ? "All Workstreams" : filters.workstream,
    `Report date ${reportDate}`
  ].join(" / ");
  return {
    areas,
    tasks,
    requests,
    dailyReports,
    updates,
    latest,
    metrics,
    areaRows,
    workstreamRows,
    statusRows,
    attentionRows,
    dailyReportTrendRows,
    verifiedTasks,
    inProgressTasks,
    pendingTasks,
    issueTasks,
    overdueTasks,
    riskTasks,
    pendingRequests,
    filterLabel
  };
}

function taskProgressPercent(task: LiveTask, update?: TaskUpdate) {
  if (update?.verificationStatus === "Verified Completed") return 100;
  if (task.taskType === "Quantity-Based Task" && task.requiredQuantity) return Math.min(100, Math.round(((update?.completedQuantity || 0) / task.requiredQuantity) * 100));
  if (update?.status === "Completed") return 75;
  if (update?.status === "In Progress") return 45;
  if (update?.status === "Issue Found") return 25;
  return 0;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    <section className="dashboard-panel motion-card animate-fade-in p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="panel-grip" aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </span>
          <h2 className="section-title">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={`skeleton-line ${className}`} aria-hidden="true" />;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto grid min-h-[82vh] max-w-[96rem] gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="hidden rounded-lg bg-[var(--color-primary)] p-5 shadow-soft lg:block">
        <SkeletonLine className="h-3 w-32 bg-white/20" />
        <SkeletonLine className="mt-4 h-7 w-52 bg-white/25" />
        <div className="mt-10 grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => <SkeletonLine key={index} className="h-11 bg-white/15" />)}
        </div>
      </aside>
      <section className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-soft">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="mt-3 h-8 w-80 max-w-full" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-[var(--color-border)] p-4">
                <SkeletonLine className="h-3 w-24" />
                <SkeletonLine className="mt-3 h-8 w-20" />
                <SkeletonLine className="mt-3 h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <SkeletonLine className="h-5 w-48" />
              <SkeletonLine className="mt-5 h-3 w-full" />
              <SkeletonLine className="mt-3 h-3 w-11/12" />
              <SkeletonLine className="mt-3 h-3 w-4/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ToastStack({ toasts, dismissToast }: { toasts: ToastMessage[]; dismissToast: (toastId: string) => void }) {
  if (!toasts.length) return null;
  const toneClass: Record<ToastTone, string> = {
    success: "border-[var(--color-primary)] bg-white",
    info: "border-[var(--color-accent)] bg-white",
    warning: "border-[var(--color-accent)] bg-[var(--color-accent-light)]",
    error: "border-[var(--color-important)] bg-white"
  };
  const dotClass: Record<ToastTone, string> = {
    success: "bg-[var(--color-primary)]",
    info: "bg-[var(--color-accent)]",
    warning: "bg-[var(--color-accent)]",
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
  const color = tone === "critical" ? "text-[var(--color-important)]" : tone === "warning" ? "text-[var(--color-accent)]" : "text-[var(--color-primary)]";
  return (
    <div className="motion-card animate-fade-in rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
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
        <div className="progress-fill h-2 rounded-full bg-[var(--color-secondary)]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helper}</p>
    </div>
  );
}

function DashboardBarChart({ rows, compact = false }: { rows: Array<{ label: string; value: number; helper: string }>; compact?: boolean }) {
  if (!rows.length) return <EmptyState title="No chart data" body="Adjust filters or add live tasks to populate this chart." />;
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {rows.map((row) => (
        <div key={row.label} className="grid gap-2 sm:grid-cols-[11rem_1fr_5rem] sm:items-center">
          <p className="truncate text-sm font-bold text-[var(--color-text-muted)]">{row.label}</p>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--color-accent-light)]">
            <div className="progress-fill h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${row.value}%` }} />
          </div>
          <p className="text-sm font-black text-[var(--color-primary)]">{row.value}%</p>
          {!compact ? <p className="text-xs text-[var(--color-text-muted)] sm:col-start-2">{row.helper}</p> : null}
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 break-words font-black text-[var(--color-primary)]">{value}</p>
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
            <tr key={rowIndex} className="table-row-motion">
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
  const cls = lower.includes("needs correction")
    ? "bg-[rgba(122,31,43,0.10)] text-[var(--color-important)]"
    : lower.includes("verified completed") || lower === "completed" || lower.includes("approved")
    ? "bg-[var(--color-primary)] text-white"
    : lower.includes("issue") || lower.includes("rejected") || lower.includes("late") || lower.includes("overdue") || lower === "critical"
      ? "bg-[var(--color-important)] text-white"
      : lower.includes("needs verification") || lower.includes("partially verified")
        ? "bg-[var(--color-accent)] text-[var(--color-primary)]"
        : lower.includes("progress")
          ? "bg-[rgba(46,125,91,0.12)] text-[var(--color-secondary)]"
          : "bg-[var(--color-accent-light)] text-[var(--color-text)]";
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
  teamTypeOptions = TEAM_TYPES,
  suggestions = []
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  addLabel: string;
  kind: "escalation" | "support";
  teamTypeOptions?: readonly string[];
  suggestions?: T[];
}) {
  const add = () =>
    onChange([
      ...rows,
      kind === "escalation"
        ? { id: id("escalation"), name: "", contactNumber: "", emailOrWhatsapp: "", roleStanding: "", teamOrganization: "", reason: "" }
        : { id: id("support"), name: "", contactNumber: "", roleStanding: "", teamTypes: [], responsibility: "" }
    ] as T[]);
  const remove = (rowId: string) => onChange(rows.filter((row) => row.id !== rowId));
  const useSuggestion = (index: number, suggestionId: string) => {
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) return;
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...suggestion, id: row.id } : row)) as T[]);
  };
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">{title}</p>
        <button className="btn-compact" onClick={add} type="button">{addLabel}</button>
      </div>
      {suggestions.length ? (
        <details className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <summary className="cursor-pointer text-xs font-black uppercase text-[var(--color-primary)]">Previous details / recommendations</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {suggestions.slice(0, 6).map((suggestion) => (
              <div key={suggestion.id} className="rounded-lg border border-[var(--color-border)] bg-white p-2 text-xs">
                <p className="font-black text-[var(--color-primary)]">{suggestion.name || "Unnamed contact"}</p>
                <p className="mt-1 text-[var(--color-text-muted)]">{peopleSummary(suggestion)}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <div className="mt-2 grid gap-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-2 rounded-lg bg-[var(--color-bg)] p-2 md:grid-cols-4">
            <div className="flex items-center gap-2 md:col-span-4">
              {suggestions.length ? (
                <select className="field min-h-10 flex-1" value="" onChange={(event) => useSuggestion(index, event.target.value)} aria-label={`Use previous ${kind} details`}>
                  <option value="">Use previous details...</option>
                  {suggestions.map((suggestion) => (
                    <option key={suggestion.id} value={suggestion.id}>
                      {(suggestion.name || "Unnamed contact")} - {suggestion.contactNumber || suggestion.roleStanding || "saved details"}
                    </option>
                  ))}
                </select>
              ) : <p className="flex-1 text-xs font-bold text-[var(--color-text-muted)]">Add details manually. Saved recommendations will appear after previous submissions.</p>}
              <button className="mini-icon-btn text-[var(--color-important)]" onClick={() => remove(row.id)} type="button" aria-label={`Delete ${kind} row`}>
                <Trash2 size={14} />
              </button>
            </div>
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
        {!rows.length ? <p className="rounded-lg bg-[var(--color-bg)] p-3 text-sm text-[var(--color-text-muted)]">No {title.toLowerCase()} added yet. Use the add button above to add one or more entries.</p> : null}
      </div>
    </div>
  );
}

function updatePeopleRow<T extends EscalationPoint | SupportingPerson>(rows: T[], index: number, key: string, value: unknown, onChange: (rows: T[]) => void) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)) as T[]);
}

function uniquePeopleRows<T extends EscalationPoint | SupportingPerson>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!hasPeopleData(row)) return false;
    const key = [row.name, row.contactNumber, row.roleStanding, "teamOrganization" in row ? row.teamOrganization : "", "teamTypes" in row ? row.teamTypes.join("|") : ""].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasPeopleData(row: EscalationPoint | SupportingPerson) {
  return Boolean(row.name.trim() || row.contactNumber.trim() || row.roleStanding.trim());
}

function peopleSummary(row: EscalationPoint | SupportingPerson) {
  const parts = [
    row.contactNumber,
    row.roleStanding,
    "teamOrganization" in row ? row.teamOrganization : row.teamTypes.join(", "),
    "reason" in row ? row.reason : row.responsibility
  ].filter(Boolean);
  return parts.join(" / ") || "Saved contact details";
}

function exportLiveTasksCsv(state: EventPrepState) {
  const latest = latestUpdateMap(state.taskUpdates);
  const rows = state.liveTasks.map((task) => {
    const details = taskDetails(state, task);
    const update = latest.get(task.id);
    return [
      areaName(state, task.areaId),
      zoneName(state, state.areas.find((area) => area.id === task.areaId)?.zoneTypeId || ""),
      `Day ${task.prepDay}`,
      details.workstream,
      details.taskDetails,
      task.taskType,
      task.priority,
      task.requiredQuantity || "",
      task.unit || "",
      update?.status || "Pending",
      update?.verificationStatus || "Not Submitted",
      task.dueDate
    ];
  });
  const csv = [
    ["Area", "Zone Type", "Prep Day", "Workstream", "Task", "Task Type", "Priority", "Required Quantity", "Unit", "Task Status", "Verification Status", "Due Date"],
    ...rows
  ].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ashara-live-tasks-${todayIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function openPrintableReport(title: string, bodyHtml: string) {
  const popup = window.open("", "_blank", "width=1100,height=800");
  if (!popup) throw new Error("Popup blocked. Allow popups to open the printable report.");
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    :root{--green:#0B4F3A;--gold:#C9A227;--light:#F3E7C3;--border:#E8DDC5;--text:#1F2933;--muted:#6B7280}
    body{margin:0;background:#FAF7EF;color:var(--text);font-family:Arial,Helvetica,sans-serif}
    main{max-width:1100px;margin:0 auto;padding:28px}
    h1,h2,h3{color:var(--green);margin:0 0 12px}
    .brand{color:var(--gold);font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:12px}
    .card{background:white;border:1px solid var(--border);border-radius:8px;padding:16px;margin:14px 0}
    table{width:100%;border-collapse:collapse;background:white}
    th{background:var(--light);color:var(--green);text-align:left;text-transform:uppercase;font-size:12px}
    th,td{border:1px solid var(--border);padding:9px;vertical-align:top}
    .badge{display:inline-block;border-radius:999px;background:var(--light);padding:4px 9px;color:var(--green);font-weight:800;font-size:12px}
    .metric{display:inline-block;margin:0 10px 10px 0;border:1px solid var(--border);border-radius:8px;background:white;padding:10px 14px}
    .metric strong{display:block;color:var(--green);font-size:22px}
    @media print{button{display:none}body{background:white}main{padding:0}.card{break-inside:avoid}}
  </style></head><body><main>${bodyHtml}</main><script>window.focus();setTimeout(()=>window.print(),300);</script></body></html>`);
  popup.document.close();
}

function dailyAreaReportHtml(state: EventPrepState, areaId: string, reportDate: string) {
  const area = state.areas.find((item) => item.id === areaId);
  const report = state.dailyReports.find((item) => item.areaId === areaId && item.reportDate === reportDate);
  const reportIds = new Set(state.dailyReports.filter((item) => item.areaId === areaId && item.reportDate === reportDate).map((item) => item.id));
  const taskIds = new Set(state.liveTasks.filter((task) => task.areaId === areaId).map((task) => task.id));
  const updates = state.taskUpdates.filter((update) => taskIds.has(update.liveTaskId) && reportIds.has(update.dailyReportId));
  const rows = updates.map((update) => {
    const task = state.liveTasks.find((item) => item.id === update.liveTaskId);
    const details = task ? taskDetails(state, task) : undefined;
    const files = state.taskFiles.filter((file) => file.taskUpdateId === update.id).map((file) => file.fileName).join(", ") || "None";
    return `<tr><td>${escapeHtml(details?.taskDetails || "Task")}</td><td>${escapeHtml(update.status)}</td><td>${escapeHtml(update.remarks || "-")}</td><td>${task?.taskType === "Quantity-Based Task" ? `${update.completedQuantity || 0}/${task.requiredQuantity || 0} ${escapeHtml(task.unit || "")}` : "-"}</td><td>${escapeHtml(files)}</td><td>${escapeHtml(update.verificationStatus)}</td></tr>`;
  }).join("");
  return `
    <p class="brand">Ashara Mubarakah</p>
    <h1>Daily Area Report</h1>
    <div class="card">
      <span class="badge">${escapeHtml(zoneName(state, area?.zoneTypeId || ""))}</span>
      <h2>${escapeHtml(area?.name || "Area")}</h2>
      <p>Report date: <strong>${escapeHtml(reportDate)}</strong></p>
      <p>Status: <strong>${escapeHtml(report?.status || "Not Started")}</strong></p>
      <p>Submitted by: <strong>${escapeHtml(state.profiles.find((profile) => profile.id === report?.submittedBy)?.fullName || "-")}</strong></p>
      <p>Submission time: <strong>${escapeHtml(report?.submittedAt ? new Date(report.submittedAt).toLocaleString() : "-")}</strong></p>
      <p>General remark: ${escapeHtml(report?.generalRemark || "-")}</p>
    </div>
    <div class="card">
      <h2>Tasks Updated That Day</h2>
      <table><thead><tr><th>Task</th><th>Status</th><th>Remarks</th><th>Quantity</th><th>Evidence</th><th>Verification</th></tr></thead><tbody>${rows || `<tr><td colspan="6">No task updates found for this date.</td></tr>`}</tbody></table>
    </div>`;
}

function overallProgressReportHtml(state: EventPrepState, allowedAreaIds: string[]) {
  const metrics = buildMetricsForAreas(state, allowedAreaIds);
  const latest = latestUpdateMap(state.taskUpdates);
  const areaRows = state.areas.filter((area) => allowedAreaIds.includes(area.id)).map((area) => {
    const tasks = state.liveTasks.filter((task) => task.areaId === area.id && task.active && !task.notApplicable);
    const verified = tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Verified Completed").length;
    return `<tr><td>${escapeHtml(area.name)}</td><td>${escapeHtml(zoneName(state, area.zoneTypeId))}</td><td>${percent(verified, tasks.length)}%</td><td>${verified}/${tasks.length}</td></tr>`;
  }).join("");
  const attentionRows = buildAttention(state).map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.count}</td></tr>`).join("");
  return `
    <p class="brand">Ashara Mubarakah</p>
    <h1>Overall Progress Report</h1>
    <div class="card">
      <span class="metric"><strong>${metrics.overallVerifiedPercent}%</strong>Overall verified completion</span>
      <span class="metric"><strong>${metrics.needsVerification}</strong>Pending verification</span>
      <span class="metric"><strong>${metrics.issueFound}</strong>Issue found tasks</span>
      <span class="metric"><strong>${metrics.pendingRequests}</strong>Pending requests</span>
    </div>
    <div class="card"><h2>Area-Wise Progress</h2><table><thead><tr><th>Area</th><th>Zone Type</th><th>Verified %</th><th>Verified Tasks</th></tr></thead><tbody>${areaRows}</tbody></table></div>
    <div class="card"><h2>Attention Required</h2><table><thead><tr><th>Item</th><th>Count</th></tr></thead><tbody>${attentionRows}</tbody></table></div>`;
}

async function exportAdminWorkbook(state: EventPrepState, allowedAreaIds: string[], includeUsers: boolean) {
  const XLSX = await import("xlsx");
  const latest = latestUpdateMap(state.taskUpdates);
  const workbook = XLSX.utils.book_new();
  const scopedTasks = state.liveTasks.filter((task) => allowedAreaIds.includes(task.areaId));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scopedTasks.map((task) => {
    const details = taskDetails(state, task);
    const update = latest.get(task.id);
    return {
      Area: areaName(state, task.areaId),
      "Zone Type": zoneName(state, state.areas.find((area) => area.id === task.areaId)?.zoneTypeId || ""),
      Day: task.prepDay,
      Workstream: details.workstream,
      Task: details.taskDetails,
      Type: task.taskType,
      Priority: task.priority,
      Status: update?.status || "Pending",
      Verification: update?.verificationStatus || "Not Submitted",
      "Required Quantity": task.requiredQuantity || "",
      Unit: task.unit || "",
      Due: task.dueDate
    };
  })), "Master Tasks");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.taskUpdates.filter((update) => scopedTasks.some((task) => task.id === update.liveTaskId))), "Task Update History");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.requests.filter((request) => allowedAreaIds.includes(request.areaId))), "Requests");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.verificationLogs.filter((log) => scopedTasks.some((task) => task.id === log.liveTaskId))), "Verification Logs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.areas.filter((area) => allowedAreaIds.includes(area.id))), "Areas");
  if (includeUsers) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.profiles.map((profile) => ({ Name: profile.fullName, Login: profile.email, Role: profile.role, Status: profile.status }))), "Users Access");
  XLSX.writeFile(workbook, `ashara-event-prep-export-${todayIso()}.xlsx`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
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
    const details = taskDetails(state, task);
    if (update?.verificationStatus === "Rejected / Needs Correction") push("Task needs correction", "Task needs correction", details.taskDetails || "A task needs correction.", { areaId: task.areaId, relatedTaskId: task.id });
    if (task.dueDate < today && update?.verificationStatus !== "Verified Completed") push("Overdue task", "Overdue assigned task", details.taskDetails || "An assigned task is overdue.", { areaId: task.areaId, relatedTaskId: task.id });
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

function buildMetricsForAreas(state: EventPrepState, allowedAreaIds: string[]): DashboardMetrics {
  const scopedState = {
    ...state,
    areas: state.areas.filter((area) => allowedAreaIds.includes(area.id)),
    liveTasks: state.liveTasks.filter((task) => allowedAreaIds.includes(task.areaId)),
    dailyReports: state.dailyReports.filter((report) => allowedAreaIds.includes(report.areaId)),
    requests: state.requests.filter((request) => allowedAreaIds.includes(request.areaId))
  };
  return buildMetrics(scopedState);
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

function taskDetails(state: EventPrepState, task: LiveTask) {
  const template = state.taskTemplates.find((item) => item.id === task.templateId);
  return {
    taskDetails: task.taskDetails || template?.taskDetails || "Task",
    mainObjective: task.mainObjective || template?.mainObjective || "",
    workstream: task.workstream || template?.workstream || "General",
    responsibleTeam: task.responsibleTeam || template?.responsibleTeam || "",
    followUpQuestions: task.followUpQuestions || template?.followUpQuestions || "",
    requiredEquipment: task.requiredEquipment || template?.requiredEquipment || "",
    expectedOutput: task.expectedOutput || template?.expectedOutput || "",
    testingRequired: task.testingRequired || template?.testingRequired || ""
  };
}

function getAllowedAreas(state: EventPrepState, profile: Profile): EventPrepState["areas"] {
  if (["super_admin", "admin"].includes(profile.role)) return state.areas;
  if (profile.role === "viewer") return dashboardAllowedAreas(state, profile);
  const accessAreaIds = state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => access.areaId);
  return state.areas.filter((area) => accessAreaIds.includes(area.id));
}

function viewerAccessFor(profile: Profile, state: Pick<EventPrepState, "areas" | "zoneTypes">) {
  const allZoneIds = state.zoneTypes.map((zone) => zone.id);
  const allAreaIds = state.areas.map((area) => area.id);
  if (profile.role !== "viewer") {
    return {
      canSeeDashboard: true,
      zoneTypeIds: allZoneIds,
      areaIds: allAreaIds,
      reportTypes: ["Daily Area Report PDF", "Overall Progress Report PDF"],
      canExportPdf: true,
      canExportExcel: ["super_admin", "admin"].includes(profile.role)
    };
  }
  if (profile.viewerAccess) return profile.viewerAccess;
  return {
    canSeeDashboard: true,
    zoneTypeIds: allZoneIds,
    areaIds: allAreaIds,
    reportTypes: ["Daily Area Report PDF", "Overall Progress Report PDF"],
    canExportPdf: false,
    canExportExcel: false
  };
}

function dashboardAllowedAreas(state: EventPrepState, profile: Profile): EventPrepState["areas"] {
  if (["super_admin", "admin"].includes(profile.role)) return state.areas;
  if (profile.role !== "viewer") return getAllowedAreas(state, profile);
  const access = viewerAccessFor(profile, state);
  return state.areas.filter((area) => access.areaIds.includes(area.id) && access.zoneTypeIds.includes(area.zoneTypeId));
}

function dashboardAllowedAreaIds(state: EventPrepState, profile: Profile): string[] {
  return dashboardAllowedAreas(state, profile).map((area) => area.id);
}

function viewerTabsFor(state?: EventPrepState, profile?: Profile): AnyTab[] {
  if (!state || !profile) return VIEWER_TABS;
  const access = viewerAccessFor(profile, state);
  const tabs: AnyTab[] = [];
  if (access.canSeeDashboard) tabs.push("Dashboard");
  if (access.canExportPdf || access.canExportExcel || access.reportTypes.length) tabs.push("Reports");
  tabs.push("Profile / Access");
  return tabs;
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
        source: "imported",
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

function createCustomTaskTemplate({
  title,
  workstream,
  responsibleTeam,
  expectedOutput,
  requiredEquipment,
  prepDay,
  priority,
  reference
}: {
  title: string;
  workstream: string;
  responsibleTeam: string;
  expectedOutput: string;
  requiredEquipment: string;
  prepDay: number;
  priority: TaskTemplate["priorityLevel"];
  reference?: TaskTemplate;
}): TaskTemplate {
  return {
    id: `template-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "custom",
    day: prepDay,
    priorityLevel: priority,
    mainObjective: reference?.mainObjective || "",
    workstream: workstream.trim() || "General",
    taskDetails: title.trim(),
    responsibleTeam: responsibleTeam.trim(),
    followUpQuestions: reference?.followUpQuestions || "",
    requiredEquipment: requiredEquipment.trim(),
    expectedOutput: expectedOutput.trim(),
    testingRequired: reference?.testingRequired || "",
    hiddenReference: reference?.hiddenReference || {},
    importedAt: new Date().toISOString()
  };
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
    taskDetails: template.taskDetails,
    mainObjective: template.mainObjective,
    workstream: template.workstream,
    responsibleTeam: template.responsibleTeam,
    followUpQuestions: template.followUpQuestions,
    requiredEquipment: template.requiredEquipment,
    expectedOutput: template.expectedOutput,
    testingRequired: template.testingRequired,
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

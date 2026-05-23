"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Mail,
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
  isEventPrepSupabaseConfigured,
  loadEventPrepState,
  saveEventPrepState,
  sendMagicLink,
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
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const db = eventPrepSupabase();
      let authenticatedEmail = "";
      if (db) {
        const { data } = await db.auth.getUser();
        authenticatedEmail = data.user?.email || "";
        if (cancelled) return;
        setSessionEmail(authenticatedEmail);
        setAuthChecked(true);
        if (!authenticatedEmail) {
          setSyncStatus("Waiting for magic-link login");
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
        const match = loaded.profiles.find((profile) => profile.email.toLowerCase() === authenticatedEmail.toLowerCase() && profile.status === "active");
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
      const activeProfile = getCurrentProfile(state, currentProfileId, sessionEmail);
      if (isEventPrepSupabaseConfigured() && !activeProfile) return;
      saveEventPrepState(state, activeProfile)
        .then(() => setSyncStatus(isEventPrepSupabaseConfigured() ? "Saved to Supabase" : "Saved locally"))
        .catch((error) => setSyncStatus(readError(error, "Save failed")));
    }, 450);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [currentProfileId, sessionEmail, state]);

  const handleMagicLink = async () => {
    try {
      setAuthMessage("Sending magic link...");
      await sendMagicLink(authEmail);
      setAuthMessage("Magic link sent. Check your email.");
    } catch (error) {
      setAuthMessage(readError(error, "Could not send magic link."));
    }
  };

  const currentProfile = state ? getCurrentProfile(state, currentProfileId, sessionEmail) : undefined;
  const isAdmin = Boolean(currentProfile && ["super_admin", "admin"].includes(currentProfile.role));
  const isAreaAdmin = currentProfile?.role === "area_admin";
  const isVerifier = currentProfile?.role === "verifier";
  const isViewer = currentProfile?.role === "viewer";
  const tabs: AnyTab[] = isAdmin ? ADMIN_TABS : isAreaAdmin ? AREA_ADMIN_TABS : isVerifier ? VERIFIER_TABS : isViewer ? VIEWER_TABS : USER_TABS;

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab((isAdmin || isViewer ? "Dashboard" : isVerifier ? "Verification" : isAreaAdmin ? "My Area" : "Daily Report") as AnyTab);
  }, [activeTab, isAdmin, isAreaAdmin, isVerifier, isViewer, tabs]);

  if (isEventPrepSupabaseConfigured() && authChecked && !sessionEmail) {
    return <LoginScreen authEmail={authEmail} authMessage={authMessage} setAuthEmail={setAuthEmail} sendLink={handleMagicLink} />;
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
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Ask an admin to create and activate a profile for {sessionEmail || "your email"}.</p>
          </div>
        </div>
      </main>
    );
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
            <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Magic-link login</p>
            <div className="mt-2 flex gap-2">
              <input className="field min-w-0" type="email" placeholder="email@example.com" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
              <button className="icon-btn shrink-0" onClick={handleMagicLink} title="Send magic link">
                <Mail size={18} />
              </button>
            </div>
            {authMessage ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{authMessage}</p> : null}
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
                <Badge>{currentProfile.status.replace("_", " ")}</Badge>
                <Badge>{isEventPrepSupabaseConfigured() ? "Supabase configured" : "Local mode"}</Badge>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            {activeTab === "Dashboard" ? <DashboardTab state={state} currentProfile={currentProfile} /> : null}
            {activeTab === "Daily Reports" ? <DailyReportsTab state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
            {activeTab === "Master Tasks" ? <MasterTasksTab state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
            {activeTab === "Zones / Areas" ? <ZonesAreasTab state={state} updateState={updateState} /> : null}
            {activeTab === "Verification" ? <VerificationTab state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
            {activeTab === "Requests" ? <RequestsTab state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
            {activeTab === "Users & Access" ? <UsersAccessTab state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
            {activeTab === "Daily Report" ? <DailyReportTab state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
            {activeTab === "My Area" ? <MyAreaTab state={state} currentProfile={currentProfile} /> : null}
            {activeTab === "Profile / Access" ? <ProfileTab state={state} currentProfile={currentProfile} /> : null}
            {["Forms", "Global Fields", "Reports", "Activity Log"].includes(activeTab) ? <FoundationTab state={state} tab={activeTab} currentProfile={currentProfile} updateState={updateState} /> : null}
          </div>
        </section>
      </div>
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
  authEmail,
  authMessage,
  setAuthEmail,
  sendLink
}: {
  authEmail: string;
  authMessage: string;
  setAuthEmail: (value: string) => void;
  sendLink: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <section className="w-full rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">ASHARA MUBARAKAH</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--color-primary)]">IT Event Preparation</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Sign in with your authorized email address.</p>
          <label className="mt-4 block">
            <span className="field-label">Email magic link</span>
            <input className="field mt-2" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <button className="btn-primary mt-3 w-full" onClick={sendLink}>Send Magic Link</button>
          {authMessage ? <p className="mt-3 text-sm font-bold text-[var(--color-primary)]">{authMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}

function DailyReportsTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
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
      {["super_admin", "admin"].includes(currentProfile.role) ? <RemindersConfig state={state} currentProfile={currentProfile} updateState={updateState} /> : null}
    </div>
  );
}

function RemindersConfig({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
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
  };
  const updateReminder = (reminderId: string, patch: Partial<Reminder>) => {
    updateState((current) => withActivity({
      ...current,
      reminders: current.reminders.map((reminder) => (reminder.id === reminderId ? { ...reminder, ...patch } : reminder))
    }, currentProfile, "Reminder activity", "Updated reminder rule", "reminder", reminderId, { changed: true }));
  };
  return (
    <Panel title="Configurable Email Reminders" action={<Badge>Phase 2 config only</Badge>}>
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

function MasterTasksTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
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
        taskTemplates: mergeTemplates(current.taskTemplates, templates),
        notificationLogs: [
          createNotification("template_import", "admin@example.com", `${templates.length} task templates imported`),
          ...current.notificationLogs
        ]
      }));
      setImportMessage(`${templates.length} task templates imported into the reusable master template list.`);
    } catch (error) {
      setImportMessage(readError(error, "Import failed."));
    } finally {
      event.target.value = "";
    }
  };

  const applyTemplates = () => {
    if (!applyAreaId || !selectedIds.length) return;
    updateState((current) => {
      const newTasks = selectedIds
        .filter((templateId) => !current.liveTasks.some((task) => task.templateId === templateId && task.areaId === applyAreaId))
        .map((templateId) => {
          const template = current.taskTemplates.find((item) => item.id === templateId);
          return createLiveTask(template, applyAreaId, taskType, Number(requiredQuantity || 0), unit, current, current.settings.preparationStartDate);
        })
        .filter(Boolean) as LiveTask[];
      return withActivity({ ...current, liveTasks: [...newTasks, ...current.liveTasks] }, currentProfile, "Template changes", `Applied ${newTasks.length} template(s) to ${areaName(current, applyAreaId)}`, "live_task", applyAreaId, { count: newTasks.length });
    });
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
          <button className="btn-secondary" onClick={() => setSelectedIds(filteredTemplates.map((template) => template.id))}>
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

function ZonesAreasTab({ state, updateState }: { state: EventPrepState; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
  const [name, setName] = useState("");
  const [zoneTypeId, setZoneTypeId] = useState(state.zoneTypes[0]?.id || "");
  const addArea = () => {
    if (!name.trim()) return;
    updateState((current) => ({
      ...current,
      areas: [
        ...current.areas,
        {
          id: id("area"),
          zoneTypeId,
          name: name.trim(),
          code: slug(name).toUpperCase(),
          active: true,
          dailyDeadline: "20:00",
          reminderTime: "18:30",
          escalationTime: "21:00"
        }
      ]
    }));
    setName("");
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

function DailyReportTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
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
          <TaskCardList state={state} tasks={corrections} report={report} currentProfile={currentProfile} updateState={updateState} missingIds={missingIds} />
        </Panel>
      ) : null}

      <Panel title="Task Cards" action={<Badge>{visibleTasks.length} shown</Badge>}>
        <TaskCardList state={state} tasks={visibleTasks} report={report} currentProfile={currentProfile} updateState={updateState} missingIds={missingIds} />
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
  missingIds
}: {
  state: EventPrepState;
  tasks: LiveTask[];
  report: DailyReport;
  currentProfile: Profile;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
  missingIds: string[];
}) {
  if (!tasks.length) return <EmptyState title="No tasks in this view" body="Change the task view filter or ask admin to apply task templates to this area." />;
  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} state={state} task={task} report={report} currentProfile={currentProfile} updateState={updateState} missing={missingIds.includes(task.id)} />
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
  missing
}: {
  state: EventPrepState;
  task: LiveTask;
  report: DailyReport;
  currentProfile: Profile;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
  missing: boolean;
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
      return withActivity({ ...current, dailyReports: nextReport, taskUpdates: [next, ...without] }, currentProfile, "Task updates", `Updated task: ${template?.taskDetails || task.id}`, "task_update", next.id, { status: next.status });
    });
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
        notificationLogs: [createNotification("not_applicable_request", "admin@example.com", title), ...current.notificationLogs]
      }, currentProfile, "Requests", title, "request", request.id, { status: request.status });
    });
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

function VerificationTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
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
        taskFiles: current.taskFiles.map((file) => (file.liveTaskId === task.id ? { ...file, reviewLocked: true } : file))
      }, currentProfile, "Verification actions", `${action === "verified" ? "Verified" : "Rejected"} task`, "verification_log", log.id, { status: nextStatus });
    });
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

function RequestsTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
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
    if (!title.trim() || !areaId) return;
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
      notificationLogs: [createNotification("request_created", "admin@example.com", `New request: ${title}`), ...current.notificationLogs]
    }, currentProfile, "Requests", `Created request: ${title}`, "request", request.id, { status: request.status }));
    setTitle("");
    setDetails("");
  };

  const changeStatus = (request: AreaRequest, status: RequestStatus) => {
    updateState((current) => withActivity({
      ...current,
      requests: current.requests.map((item) => (item.id === request.id ? { ...item, status } : item)),
      liveTasks:
        status === "Approved" && request.requestType === "Not Applicable / Task Removal Request" && request.relatedLiveTaskId
          ? current.liveTasks.map((task) => (task.id === request.relatedLiveTaskId ? { ...task, notApplicable: true, active: false } : task))
          : current.liveTasks
    }, currentProfile, "Requests", `Changed request status to ${status}`, "request", request.id, { status }));
  };

  const sendForVerification = (request: AreaRequest) => {
    const reviewerId = reviewerByRequest[request.id];
    if (!reviewerId) return;
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
        notificationLogs: [createNotification("request_review", state.profiles.find((profile) => profile.id === reviewerId)?.email || "verifier@example.com", `Request sent for verification: ${request.title}`), ...current.notificationLogs]
      }, currentProfile, "Requests", "Sent request for verifier review", "request", request.id, { reviewerAssigned: true });
    });
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

function UsersAccessTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
  const isAdmin = ["super_admin", "admin"].includes(currentProfile.role);
  const isAreaAdmin = currentProfile.role === "area_admin";
  const isVerifier = currentProfile.role === "verifier";
  const managedAreas = isAdmin ? state.areas : getAllowedAreas(state, currentProfile);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("report_user");
  const [areaId, setAreaId] = useState(managedAreas[0]?.id || "");
  const shownProfiles = isAdmin
    ? state.profiles
    : state.profiles.filter((profile) => {
      const access = state.areaAccess.filter((item) => item.profileId === profile.id);
      return access.some((item) => managedAreas.some((area) => area.id === item.areaId)) || profile.createdBy === currentProfile.id;
    });
  const canAddUsers = isAdmin || isAreaAdmin;
  const addUser = () => {
    if (!email.trim() || !name.trim()) return;
    const assignedRole = isAreaAdmin ? "report_user" : role;
    const profile: Profile = {
      id: id("profile"),
      email: email.trim().toLowerCase(),
      fullName: name.trim(),
      role: assignedRole,
      status: assignedRole === "report_user" ? "pending_approval" : "active",
      createdBy: currentProfile.id
    };
    updateState((current) => ({
      ...withActivity(current, currentProfile, "Access changes", `Created ${roleLabel(assignedRole)} profile`, "profile", profile.id, { pendingApproval: profile.status === "pending_approval" }),
      profiles: [profile, ...current.profiles],
      areaAccess: areaId ? [{ id: id("access"), profileId: profile.id, areaId, role: assignedRole }, ...current.areaAccess] : current.areaAccess,
      notificationLogs: [createNotification("access_invite_pending", profile.email, "Your access is pending approval"), ...current.notificationLogs]
    }));
    setEmail("");
    setName("");
  };
  const canApprove = (profile: Profile) => {
    if (isAdmin) return true;
    if (!isVerifier) return false;
    const profileAreaIds = state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => access.areaId);
    return profileAreaIds.some((profileAreaId) => managedAreas.some((area) => area.id === profileAreaId));
  };
  const approve = (profile: Profile) => updateState((current) => withActivity({
    ...current,
    profiles: current.profiles.map((item) => (item.id === profile.id ? { ...item, status: "active" } : item)),
    notificationLogs: [createNotification("access_approved", profile.email, "Your dashboard access is approved"), ...current.notificationLogs]
  }, currentProfile, "Access changes", `Approved access for ${profile.fullName}`, "profile", profile.id, { approved: true }));

  return (
    <div className="space-y-4">
      {canAddUsers ? <Panel title={isAreaAdmin ? "Add Report User For My Area" : "Add User / Access"}>
        <div className="grid gap-3 lg:grid-cols-5">
          <Input label="Full name" value={name} onChange={setName} />
          <Input label="Email" value={email} onChange={setEmail} type="email" />
          <Select label="Role" value={isAreaAdmin ? "report_user" : role} onChange={(value) => setRole(value as UserRole)} disabled={isAreaAdmin} options={["super_admin", "admin", "area_admin", "verifier", "report_user", "viewer"].map((value) => ({ label: roleLabel(value as UserRole), value }))} />
          <Select label="Area access" value={areaId} onChange={setAreaId} options={managedAreas.map((area) => ({ label: area.name, value: area.id }))} />
          <button className="btn-primary self-end" onClick={addUser}>Add User</button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Report users are created as Pending Approval. Admins or assigned verifiers activate them before login works.</p>
      </Panel> : null}
      <Panel title="Users & Access">
        <ResponsiveTable
          headers={["Name", "Email", "Role", "Status", "Areas", "Action"]}
          rows={shownProfiles.map((profile) => [
            profile.fullName,
            profile.email,
            roleLabel(profile.role),
            <StatusBadge key="status" value={profile.status.replace("_", " ")} />,
            state.areaAccess.filter((access) => access.profileId === profile.id).map((access) => areaName(state, access.areaId)).join(", ") || "All / not restricted",
            profile.status === "pending_approval" && canApprove(profile) ? <button key="approve" className="btn-compact" onClick={() => approve(profile)}>Approve</button> : "-"
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

function ProfileTab({ state, currentProfile }: { state: EventPrepState; currentProfile: Profile }) {
  return (
    <Panel title="Profile / Access">
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniStat label="Name" value={currentProfile.fullName} />
        <MiniStat label="Email" value={currentProfile.email} />
        <MiniStat label="Role" value={roleLabel(currentProfile.role)} />
        <MiniStat label="Status" value={currentProfile.status.replace("_", " ")} />
      </div>
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">Authorized areas: {getAllowedAreas(state, currentProfile).map((area) => area.name).join(", ") || "All areas for admin roles"}</p>
    </Panel>
  );
}

function FoundationTab({
  state,
  tab,
  currentProfile,
  updateState
}: {
  state: EventPrepState;
  tab: AnyTab;
  currentProfile: Profile;
  updateState: (updater: (current: EventPrepState) => EventPrepState) => void;
}) {
  if (tab === "Forms") return <FormBuilderTab state={state} currentProfile={currentProfile} updateState={updateState} />;
  if (tab === "Global Fields") return <GlobalFieldsTab state={state} currentProfile={currentProfile} updateState={updateState} />;
  if (tab === "Reports") return <EmptyState title="Reports foundation ready" body="PDF and Excel exports are reserved for Phase 3. The schema already includes report_exports." />;
  return <ActivityLogTab state={state} currentProfile={currentProfile} updateState={updateState} />;
}

function FormBuilderTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
  const [taskType, setTaskType] = useState<TaskTypeName>("Simple Task");
  const [label, setLabel] = useState("");
  const addField = () => {
    if (!label.trim()) return;
    updateState((current) => {
      const fieldsForType = current.formFields.filter((field) => field.taskType === taskType);
      const field: FormField = {
        id: id("field"),
        taskType,
        fieldKey: slug(label),
        label: label.trim(),
        required: false,
        visible: true,
        displayOrder: fieldsForType.length + 1
      };
      return withActivity({ ...current, formFields: [...current.formFields, field] }, currentProfile, "Form/global field changes", `Added form field ${field.label}`, "form_field", field.id, { visible: true });
    });
    setLabel("");
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

function GlobalFieldsTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
  const groups = unique(state.globalOptions.map((option) => option.group));
  const [group, setGroup] = useState(groups[0] || "Workstreams");
  const [value, setValue] = useState("");
  const addOption = () => {
    if (!group.trim() || !value.trim()) return;
    updateState((current) => {
      const option: GlobalOption = { id: id("option"), group: group.trim(), value: value.trim(), active: true };
      return withActivity({ ...current, globalOptions: [...current.globalOptions, option] }, currentProfile, "Form/global field changes", `Added global option ${option.value}`, "global_option", option.id, { active: true });
    });
    setValue("");
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

function ActivityLogTab({ state, currentProfile, updateState }: { state: EventPrepState; currentProfile: Profile; updateState: (updater: (current: EventPrepState) => EventPrepState) => void }) {
  const activityOptions = state.globalOptions.filter((option) => option.group === "Activity Log Categories");
  const updateOption = (optionId: string, active: boolean) => {
    updateState((current) => ({
      ...current,
      globalOptions: current.globalOptions.map((option) => (option.id === optionId ? { ...option, active } : option))
    }));
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
      <Panel title="Email Notification Queue">
        <ResponsiveTable headers={["Type", "Recipient", "Subject", "Status"]} rows={state.notificationLogs.map((log) => [log.type, log.recipientEmail, log.subject, log.status])} />
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
    { label: "Missing Daily Reports", count: Math.max(0, missingReports) },
    { label: "Partially Updated Reports", count: todayReports.filter((report) => ["Draft Saved", "Partially Updated"].includes(report.status)).length },
    { label: "Issue Found Tasks", count: tasks.filter((task) => latest.get(task.id)?.status === "Issue Found").length },
    { label: "Tasks Needing Verification", count: tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Needs Verification").length },
    { label: "Rejected / Needs Correction", count: tasks.filter((task) => latest.get(task.id)?.verificationStatus === "Rejected / Needs Correction").length },
    { label: "Pending Requests", count: state.requests.filter((request) => request.status === "Under Review").length },
    { label: "Overdue Tasks", count: tasks.filter((task) => task.dueDate < todayIso() && latest.get(task.id)?.verificationStatus !== "Verified Completed").length }
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

function getCurrentProfile(state: EventPrepState, currentProfileId: string, sessionEmail: string) {
  if (isEventPrepSupabaseConfigured()) {
    return state.profiles.find((profile) => profile.email.toLowerCase() === sessionEmail.toLowerCase() && profile.status === "active");
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

function createNotification(type: string, recipientEmail: string, subject: string) {
  return { id: id("notification"), type, recipientEmail, subject, status: "queued" as const, createdAt: new Date().toISOString() };
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

function toCamel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase()).replace(/[^a-z0-9]/g, "");
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

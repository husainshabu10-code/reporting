"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileQuestion,
  Filter,
  ListChecks,
  Plus,
  RefreshCcw,
  Search,
  Upload,
  X
} from "lucide-react";
import {
  BUDGET_STATUSES,
  CSV_HEADERS,
  DOCUMENT_STATUSES,
  EVENT_CRITICALITIES,
  generateDefaultTasksForCities,
  generateDefaultTasksForCity,
  INITIAL_CITIES,
  OWNERSHIP_TYPES,
  PRIORITIES,
  RISK_LEVELS,
  STATUSES,
  STATUS_MEANINGS,
  STATUS_PROGRESS,
  WORKSTREAMS,
  ZONES,
  createBlankTask,
  inferArea,
  makeTaskId,
  taskDisplayName
} from "@/lib/asharaTrackerData";
import type { TrackerTask } from "@/lib/asharaTrackerData";

type ViewId =
  | "Dashboard"
  | "All Tasks"
  | "City-wise Progress"
  | "Blocked / Delayed Items"
  | "Waaz Critical Tasks"
  | "Vendor Pending Items"
  | "Local Team Pending Items"
  | "Document Pending Items"
  | "Final Readiness View";

type Filters = {
  city: string;
  workstream: string;
  status: string;
  priority: string;
  eventCriticality: string;
  riskLevel: string;
  ownershipType: string;
  documentStatus: string;
};

const STORAGE_TASKS_KEY = "ashara-it-readiness-tasks";
const STORAGE_CITIES_KEY = "ashara-it-readiness-cities";
const CLOSED_STATUSES = new Set(["Completed", "Tested", "Not Required"]);
const VIEW_TABS: ViewId[] = [
  "Dashboard",
  "All Tasks",
  "City-wise Progress",
  "Blocked / Delayed Items",
  "Waaz Critical Tasks",
  "Vendor Pending Items",
  "Local Team Pending Items",
  "Document Pending Items",
  "Final Readiness View"
];

const EMPTY_FILTERS: Filters = {
  city: "All",
  workstream: "All",
  status: "All",
  priority: "All",
  eventCriticality: "All",
  riskLevel: "All",
  ownershipType: "All",
  documentStatus: "All"
};

export default function DashboardApp() {
  const [tasks, setTasks] = useState<TrackerTask[]>(() => generateDefaultTasksForCities(INITIAL_CITIES));
  const [cities, setCities] = useState<string[]>(INITIAL_CITIES);
  const [activeView, setActiveView] = useState<ViewId>("Dashboard");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);
  const [cityDraft, setCityDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem(STORAGE_TASKS_KEY);
      const savedCities = window.localStorage.getItem(STORAGE_CITIES_KEY);
      if (savedTasks) setTasks(JSON.parse(savedTasks) as TrackerTask[]);
      if (savedCities) setCities(JSON.parse(savedCities) as string[]);
    } catch {
      setTasks(generateDefaultTasksForCities(INITIAL_CITIES));
      setCities(INITIAL_CITIES);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
    window.localStorage.setItem(STORAGE_CITIES_KEY, JSON.stringify(cities));
  }, [cities, hydrated, tasks]);

  const presetTasks = useMemo(() => applyViewPreset(tasks, activeView), [activeView, tasks]);
  const visibleTasks = useMemo(() => applyFiltersAndSearch(presetTasks, filters, search), [filters, presetTasks, search]);
  const dashboardTasks = activeView === "Dashboard" ? tasks : visibleTasks;
  const metrics = useMemo(() => getMetrics(dashboardTasks), [dashboardTasks]);
  const cityStats = useMemo(() => getCityStats(tasks, cities), [cities, tasks]);
  const statusRows = useMemo(() => distribution(tasks, "status"), [tasks]);
  const workstreamRows = useMemo(() => getWorkstreamCompletion(tasks), [tasks]);

  const upsertTask = (task: TrackerTask) => {
    const savedTask = { ...task, updatedAt: new Date().toISOString() };
    setTasks((current) => {
      const exists = current.some((item) => item.id === savedTask.id);
      return exists ? current.map((item) => (item.id === savedTask.id ? savedTask : item)) : [savedTask, ...current];
    });
    setSelectedTask(savedTask);
  };

  const deleteTask = (taskId: string) => {
    const confirmed = window.confirm("Delete this task from the tracker?");
    if (!confirmed) return;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setSelectedTask(null);
  };

  const addTask = () => setSelectedTask(createBlankTask(cities[0] ?? "City 1"));

  const addCity = (generateTasks: boolean) => {
    const city = cityDraft.trim();
    if (!city) return;
    if (cities.some((item) => item.toLowerCase() === city.toLowerCase())) {
      window.alert("This city already exists.");
      return;
    }
    setCities((current) => [...current, city]);
    if (generateTasks) setTasks((current) => [...current, ...generateDefaultTasksForCity(city)]);
    setCityDraft("");
  };

  const resetDemoData = () => {
    const confirmed = window.confirm("Reset all tracker data to the default City 1, City 2, and City 3 demo setup?");
    if (!confirmed) return;
    setCities(INITIAL_CITIES);
    setTasks(generateDefaultTasksForCities(INITIAL_CITIES));
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setSelectedTask(null);
  };

  const exportTasks = (rows: TrackerTask[], label: string) => downloadCsv(rows, `ashara-it-readiness-${label}.csv`);

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const imported = rows.map(rowToTask).filter(Boolean) as TrackerTask[];
    if (!imported.length) {
      window.alert("No valid task rows found in this CSV.");
      return;
    }

    setTasks((current) => {
      const byId = new Map(current.map((task) => [task.id, task]));
      imported.forEach((task) => byId.set(task.id, task));
      return Array.from(byId.values());
    });
    setCities((current) => Array.from(new Set([...current, ...imported.map((task) => task.city).filter(Boolean)])));
    event.target.value = "";
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#1f2937]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Internal Operations Dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Ashara IT Readiness Master Tracker</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={addTask}>
                <Plus size={16} /> Add Task
              </button>
              <button className="btn-secondary" onClick={() => exportTasks(visibleTasks, "visible-tasks")}>
                <Download size={16} /> Export Visible CSV
              </button>
              <button className="btn-secondary" onClick={() => exportTasks(tasks, "full-task-list")}>
                <Download size={16} /> Export Full CSV
              </button>
              <button className="btn-secondary" onClick={() => importInputRef.current?.click()}>
                <Upload size={16} /> Import CSV
              </button>
              <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
              <button className="btn-secondary" onClick={resetDemoData}>
                <RefreshCcw size={16} /> Reset Demo Data
              </button>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {VIEW_TABS.map((view) => (
              <button
                key={view}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                  activeView === view ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                onClick={() => setActiveView(view)}
              >
                {view}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <CityManager cityDraft={cityDraft} setCityDraft={setCityDraft} onAddCity={addCity} />

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <button className="flex w-full items-center justify-between text-left lg:hidden" onClick={() => setFiltersOpen((value) => !value)}>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Filter size={16} /> Filters and Search
            </span>
            <ChevronDown className={`transition ${filtersOpen ? "rotate-180" : ""}`} size={18} />
          </button>
          <div className={`${filtersOpen ? "block" : "hidden"} mt-4 lg:mt-0 lg:block`}>
            <FiltersPanel
              filters={filters}
              setFilters={setFilters}
              search={search}
              setSearch={setSearch}
              cities={cities}
              onClear={() => {
                setFilters(EMPTY_FILTERS);
                setSearch("");
              }}
            />
          </div>
        </section>

        <SummaryCards metrics={metrics} />

        {activeView === "Dashboard" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]">
            <section className="space-y-5">
              <CityReadinessCards cityStats={cityStats} />
              <ChartsPanel statusRows={statusRows} workstreamRows={workstreamRows} cityStats={cityStats} />
            </section>
            <StatusMeanings />
          </div>
        )}

        {activeView === "City-wise Progress" && (
          <section className="space-y-5">
            <CityReadinessCards cityStats={cityStats} />
            <ChartsPanel statusRows={statusRows} workstreamRows={workstreamRows} cityStats={cityStats} />
          </section>
        )}

        {activeView !== "Dashboard" && (
          <TaskTable tasks={visibleTasks} totalCount={presetTasks.length} onOpenTask={setSelectedTask} />
        )}

        {activeView === "Dashboard" && (
          <TaskTable tasks={visibleTasks.slice(0, 24)} totalCount={visibleTasks.length} onOpenTask={setSelectedTask} title="Priority Task Snapshot" />
        )}
      </div>

      {selectedTask && (
        <TaskEditor
          task={selectedTask}
          cities={cities}
          onSave={upsertTask}
          onClose={() => setSelectedTask(null)}
          onDelete={deleteTask}
        />
      )}
    </main>
  );
}

function CityManager({
  cityDraft,
  setCityDraft,
  onAddCity
}: {
  cityDraft: string;
  setCityDraft: (value: string) => void;
  onAddCity: (generateTasks: boolean) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Add New City</span>
          <input className="field" value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} placeholder="Enter city name" />
        </label>
        <button className="btn-secondary justify-center" onClick={() => onAddCity(false)}>
          <Plus size={16} /> Add City Only
        </button>
        <button className="btn-primary justify-center" onClick={() => onAddCity(true)}>
          <ListChecks size={16} /> Add City + Default Tasks
        </button>
      </div>
    </section>
  );
}

function FiltersPanel({
  filters,
  setFilters,
  search,
  setSearch,
  cities,
  onClear
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  search: string;
  setSearch: (search: string) => void;
  cities: string[];
  onClear: () => void;
}) {
  const update = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 md:col-span-2 xl:col-span-2">
          <span className="text-xs font-semibold uppercase text-slate-500">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="field pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search task, city, owner, vendor, remarks"
            />
          </span>
        </label>
        <SelectField label="City" value={filters.city} options={cities} onChange={(value) => update("city", value)} includeAll />
        <SelectField label="Workstream" value={filters.workstream} options={WORKSTREAMS.map((item) => item.name)} onChange={(value) => update("workstream", value)} includeAll />
        <SelectField label="Status" value={filters.status} options={STATUSES} onChange={(value) => update("status", value)} includeAll />
        <SelectField label="Priority" value={filters.priority} options={PRIORITIES} onChange={(value) => update("priority", value)} includeAll />
        <SelectField label="Event Criticality" value={filters.eventCriticality} options={EVENT_CRITICALITIES} onChange={(value) => update("eventCriticality", value)} includeAll />
        <SelectField label="Risk Level" value={filters.riskLevel} options={RISK_LEVELS} onChange={(value) => update("riskLevel", value)} includeAll />
        <SelectField label="Ownership Type" value={filters.ownershipType} options={OWNERSHIP_TYPES} onChange={(value) => update("ownershipType", value)} includeAll />
        <SelectField label="Document Status" value={filters.documentStatus} options={DOCUMENT_STATUSES} onChange={(value) => update("documentStatus", value)} includeAll />
      </div>
      <div className="flex justify-end">
        <button className="btn-secondary" onClick={onClear}>
          <X size={16} /> Clear Filters
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ metrics }: { metrics: ReturnType<typeof getMetrics> }) {
  const cards = [
    { label: "Total Tasks", value: metrics.total, icon: ListChecks, tone: "slate" },
    { label: "Completed Tasks", value: metrics.completed, icon: CheckCircle2, tone: "green" },
    { label: "In Progress Tasks", value: metrics.inProgress, icon: CalendarClock, tone: "blue" },
    { label: "Blocked Tasks", value: metrics.blocked, icon: CircleAlert, tone: "red" },
    { label: "Waaz Critical Pending", value: metrics.waazPending, icon: AlertTriangle, tone: "amber" },
    { label: "Missing Documents", value: metrics.missingDocuments, icon: FileQuestion, tone: "amber" },
    { label: "Average Readiness", value: `${metrics.averageReadiness}%`, icon: CheckCircle2, tone: "green" }
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
              </div>
              <span className={`rounded-md p-2 ${toneClasses(card.tone)}`}>
                <Icon size={18} />
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function CityReadinessCards({ cityStats }: { cityStats: CityStat[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">City Readiness</h2>
        <p className="text-sm text-slate-500">{cityStats.length} cities</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cityStats.map((city) => (
          <article key={city.city} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{city.city}</h3>
                <p className="mt-1 text-sm text-slate-500">{city.completed} completed / {city.total} total</p>
              </div>
              <StatusIndicator label={city.health} />
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">Overall completion</span>
                <span className="font-semibold text-slate-900">{city.completion}%</span>
              </div>
              <ProgressBar value={city.completion} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <MetricPill label="Blocked" value={city.blocked} tone={city.blocked ? "red" : "slate"} />
              <MetricPill label="High Risk" value={city.highRisk} tone={city.highRisk ? "amber" : "slate"} />
              <MetricPill label="Docs Missing" value={city.missingDocuments} tone={city.missingDocuments ? "amber" : "slate"} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChartsPanel({
  statusRows,
  workstreamRows,
  cityStats
}: {
  statusRows: Array<{ name: string; value: number; percent: number }>;
  workstreamRows: Array<{ name: string; value: number; percent: number }>;
  cityStats: CityStat[];
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <SimpleBarChart title="Status Distribution" rows={statusRows} />
      <SimpleBarChart title="Workstream Completion" rows={workstreamRows.slice(0, 10)} />
      <SimpleBarChart title="City Readiness" rows={cityStats.map((city) => ({ name: city.city, value: city.completion, percent: city.completion }))} suffix="%" />
    </section>
  );
}

function StatusMeanings() {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <h2 className="text-base font-semibold text-slate-950">Status Meanings</h2>
      <div className="mt-4 space-y-3">
        {STATUS_MEANINGS.map((item) => (
          <div key={item.status} className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <StatusBadge status={item.status} />
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.meaning}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function TaskTable({
  tasks,
  totalCount,
  onOpenTask,
  title = "Task Table"
}: {
  tasks: TrackerTask[];
  totalCount: number;
  onOpenTask: (task: TrackerTask) => void;
  title?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{tasks.length} visible of {totalCount} matching tasks</p>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["City", "Workstream", "Task Name", "Area", "Owner", "Priority", "Event Criticality", "Status", "Progress %", "Risk", "Due Date", "Document Status", "Latest Update"].map((heading) => (
                <th key={heading} className="border-b border-slate-200 px-3 py-3 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${dueRowClass(task)}`} onClick={() => onOpenTask(task)}>
                <td className="px-3 py-3 font-medium text-slate-900">{task.city}</td>
                <td className="px-3 py-3 text-slate-600">{task.workstream}</td>
                <td className="max-w-[320px] px-3 py-3 text-slate-900">{taskDisplayName(task)}</td>
                <td className="px-3 py-3 text-slate-600">{task.zoneArea}</td>
                <td className="px-3 py-3 text-slate-600">{task.taskOwner || "-"}</td>
                <td className="px-3 py-3"><PriorityBadge priority={task.priority} /></td>
                <td className="px-3 py-3 text-slate-600">{task.eventCriticality}</td>
                <td className="px-3 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-3 py-3">
                  <div className="min-w-28">
                    <ProgressBar value={task.progress} compact />
                    <span className="mt-1 block text-xs text-slate-500">{task.progress}%</span>
                  </div>
                </td>
                <td className="px-3 py-3"><RiskBadge risk={task.riskLevel} /></td>
                <td className="px-3 py-3 text-slate-600">{task.dueDate || "-"}</td>
                <td className="px-3 py-3"><DocumentBadge status={task.documentStatus} /></td>
                <td className="max-w-[260px] px-3 py-3 text-slate-600">{task.remarksLatestUpdate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {tasks.map((task) => (
          <button key={task.id} className={`w-full rounded-lg border border-slate-200 p-4 text-left shadow-sm ${dueRowClass(task)}`} onClick={() => onOpenTask(task)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{taskDisplayName(task)}</p>
                <p className="mt-1 text-sm text-slate-500">{task.workstream}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
              <span>Owner: {task.taskOwner || "-"}</span>
              <span>Due: {task.dueDate || "-"}</span>
              <span>Risk: {task.riskLevel}</span>
              <span>Docs: {task.documentStatus}</span>
            </div>
            <div className="mt-3"><ProgressBar value={task.progress} /></div>
          </button>
        ))}
      </div>

      {tasks.length === 0 && <div className="p-12 text-center text-sm text-slate-500">No tasks match the selected view or filters.</div>}
    </section>
  );
}

function TaskEditor({
  task,
  cities,
  onSave,
  onClose,
  onDelete
}: {
  task: TrackerTask;
  cities: string[];
  onSave: (task: TrackerTask) => void;
  onClose: () => void;
  onDelete: (taskId: string) => void;
}) {
  const [draft, setDraft] = useState<TrackerTask>(task);

  useEffect(() => setDraft(task), [task]);

  const updateField = <K extends keyof TrackerTask>(key: K, value: TrackerTask[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "taskName" || key === "workstream") {
        next.zoneArea = inferArea(String(key === "taskName" ? value : next.taskName), String(key === "workstream" ? value : next.workstream));
      }
      if (key === "status" && !current.progressManuallyEdited) {
        next.progress = STATUS_PROGRESS[value as TrackerTask["status"]];
      }
      if (key === "progress") {
        next.progressManuallyEdited = true;
      }
      return next;
    });
  };

  const save = () => {
    const taskId = draft.id || makeTaskId(draft.city, draft.workstream, draft.taskName);
    onSave({ ...draft, id: taskId });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 lg:flex lg:justify-end">
      <aside className="flex h-full w-full flex-col bg-white shadow-2xl lg:w-[560px]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Task Detail / Edit</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{taskDisplayName(draft)}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close task editor">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <label className="space-y-1">
            <span className="field-label">Task Name</span>
            <input className="field" value={draft.taskName} onChange={(event) => updateField("taskName", event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="City" value={draft.city} options={cities} onChange={(value) => updateField("city", value)} />
            <SelectField label="Workstream" value={draft.workstream} options={WORKSTREAMS.map((item) => item.name)} onChange={(value) => updateField("workstream", value)} />
            <SelectField label="Area" value={draft.zoneArea} options={ZONES} onChange={(value) => updateField("zoneArea", value as TrackerTask["zoneArea"])} />
            <SelectField label="Ownership Type" value={draft.ownershipType} options={OWNERSHIP_TYPES} onChange={(value) => updateField("ownershipType", value as TrackerTask["ownershipType"])} />
            <label className="space-y-1">
              <span className="field-label">Task Owner</span>
              <input className="field" value={draft.taskOwner} onChange={(event) => updateField("taskOwner", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Supporting Person</span>
              <input className="field" value={draft.supportingPerson} onChange={(event) => updateField("supportingPerson", event.target.value)} />
            </label>
            <SelectField label="Priority" value={draft.priority} options={PRIORITIES} onChange={(value) => updateField("priority", value as TrackerTask["priority"])} />
            <SelectField label="Event Criticality" value={draft.eventCriticality} options={EVENT_CRITICALITIES} onChange={(value) => updateField("eventCriticality", value as TrackerTask["eventCriticality"])} />
            <SelectField label="Status" value={draft.status} options={STATUSES} onChange={(value) => updateField("status", value as TrackerTask["status"])} />
            <label className="space-y-1">
              <span className="field-label">Progress %</span>
              <input className="field" type="number" min={0} max={100} value={draft.progress} onChange={(event) => updateField("progress", clamp(Number(event.target.value), 0, 100))} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Due Date</span>
              <input className="field" type="date" value={draft.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Target Readiness Date</span>
              <input className="field" type="date" value={draft.targetReadinessDate} onChange={(event) => updateField("targetReadinessDate", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Dependency</span>
              <input className="field" value={draft.dependency} onChange={(event) => updateField("dependency", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Vendor Name</span>
              <input className="field" value={draft.vendorName} onChange={(event) => updateField("vendorName", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Vendor Contact</span>
              <input className="field" value={draft.vendorContact} onChange={(event) => updateField("vendorContact", event.target.value)} />
            </label>
            <SelectField label="Budget Status" value={draft.budgetStatus} options={BUDGET_STATUSES} onChange={(value) => updateField("budgetStatus", value as TrackerTask["budgetStatus"])} />
            <SelectField label="Document Status" value={draft.documentStatus} options={DOCUMENT_STATUSES} onChange={(value) => updateField("documentStatus", value as TrackerTask["documentStatus"])} />
            <SelectField label="Risk Level" value={draft.riskLevel} options={RISK_LEVELS} onChange={(value) => updateField("riskLevel", value as TrackerTask["riskLevel"])} />
            <label className="space-y-1">
              <span className="field-label">Last Update Date</span>
              <input className="field" type="date" value={draft.lastUpdateDate} onChange={(event) => updateField("lastUpdateDate", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="field-label">Next Follow-up Date</span>
              <input className="field" type="date" value={draft.nextFollowUpDate} onChange={(event) => updateField("nextFollowUpDate", event.target.value)} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="field-label">Blocker Reason</span>
            <textarea className="field min-h-20" value={draft.blockerReason} onChange={(event) => updateField("blockerReason", event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="field-label">Remarks / Latest Update</span>
            <textarea className="field min-h-24" value={draft.remarksLatestUpdate} onChange={(event) => updateField("remarksLatestUpdate", event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="field-label">Document Link / Attachment Reference</span>
            <input className="field" value={draft.documentLinkAttachmentReference} onChange={(event) => updateField("documentLinkAttachmentReference", event.target.value)} placeholder="Drive link, OneDrive link, Asana reference, or file name" />
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-between">
          <button className="btn-secondary justify-center text-red-700 hover:bg-red-50" onClick={() => onDelete(draft.id)}>Delete</button>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1 justify-center sm:flex-none" onClick={onClose}>Cancel</button>
            <button className="btn-primary flex-1 justify-center sm:flex-none" onClick={save}>Save Changes</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  includeAll = false
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {includeAll && <option value="All">All</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SimpleBarChart({ title, rows, suffix = "" }: { title: string; rows: Array<{ name: string; value: number; percent: number }>; suffix?: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.name} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-600">{row.name}</span>
              <span className="font-semibold text-slate-900">{row.value}{suffix}</span>
            </div>
            <ProgressBar value={row.percent} />
          </div>
        ))}
      </div>
    </article>
  );
}

function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-full bg-slate-100 ${compact ? "h-2" : "h-2.5"}`}>
      <div className="h-full rounded-full bg-[#2f6f9f]" style={{ width: `${clamp(value, 0, 100)}%` }} />
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-md p-2 ${toneClasses(tone)}`}>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function StatusIndicator({ label }: { label: CityStat["health"] }) {
  const className =
    label === "Good"
      ? "bg-green-50 text-green-700 ring-green-200"
      : label === "Critical"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{label}</span>;
}

function StatusBadge({ status }: { status: TrackerTask["status"] }) {
  const className =
    status === "Completed" || status === "Tested" || status === "Not Required"
      ? "bg-green-50 text-green-700 ring-green-200"
      : status === "Blocked"
        ? "bg-red-50 text-red-700 ring-red-200"
        : status === "Ready for Testing"
          ? "bg-blue-50 text-blue-700 ring-blue-200"
          : status === "In Progress" || status === "Under Review"
            ? "bg-amber-50 text-amber-700 ring-amber-200"
            : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: TrackerTask["priority"] }) {
  const className = priority === "Critical" ? "bg-red-50 text-red-700" : priority === "High" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{priority}</span>;
}

function RiskBadge({ risk }: { risk: TrackerTask["riskLevel"] }) {
  const className = risk === "High" ? "bg-red-50 text-red-700" : risk === "Medium" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{risk}</span>;
}

function DocumentBadge({ status }: { status: TrackerTask["documentStatus"] }) {
  const className = status === "Final Attached" ? "bg-green-50 text-green-700" : status === "Draft Attached" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

type CityStat = {
  city: string;
  total: number;
  completed: number;
  blocked: number;
  highRisk: number;
  missingDocuments: number;
  completion: number;
  health: "Good" | "Attention Needed" | "Critical";
};

function getMetrics(rows: TrackerTask[]) {
  const total = rows.length;
  const completed = rows.filter((task) => task.status === "Completed").length;
  const inProgress = rows.filter((task) => ["In Progress", "Under Review", "Ready for Testing"].includes(task.status)).length;
  const blocked = rows.filter((task) => task.status === "Blocked").length;
  const waazPending = rows.filter((task) => task.eventCriticality === "Waaz Critical" && !["Completed", "Tested"].includes(task.status)).length;
  const missingDocuments = rows.filter((task) => ["Not Attached", "Needs Revision"].includes(task.documentStatus)).length;
  const averageReadiness = total ? Math.round(rows.reduce((sum, task) => sum + Number(task.progress || 0), 0) / total) : 0;
  return { total, completed, inProgress, blocked, waazPending, missingDocuments, averageReadiness };
}

function getCityStats(tasks: TrackerTask[], cities: string[]): CityStat[] {
  return cities.map((city) => {
    const rows = tasks.filter((task) => task.city === city);
    const total = rows.length;
    const completion = total ? Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / total) : 0;
    const blocked = rows.filter((task) => task.status === "Blocked").length;
    const highRisk = rows.filter((task) => task.riskLevel === "High").length;
    const missingDocuments = rows.filter((task) => ["Not Attached", "Needs Revision"].includes(task.documentStatus)).length;
    const health = blocked > 0 || highRisk > 5 || completion < 35 ? "Critical" : completion < 75 || highRisk > 0 ? "Attention Needed" : "Good";
    return {
      city,
      total,
      completed: rows.filter((task) => task.status === "Completed").length,
      blocked,
      highRisk,
      missingDocuments,
      completion,
      health
    };
  });
}

function distribution<T extends keyof TrackerTask>(tasks: TrackerTask[], key: T) {
  const total = Math.max(tasks.length, 1);
  const counts = tasks.reduce<Record<string, number>>((acc, task) => {
    const value = String(task[key] || "Blank");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value, percent: Math.round((value / total) * 100) }));
}

function getWorkstreamCompletion(tasks: TrackerTask[]) {
  return WORKSTREAMS.map((workstream) => {
    const rows = tasks.filter((task) => task.workstream === workstream.name);
    const value = rows.length ? Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / rows.length) : 0;
    return { name: workstream.name, value, percent: value };
  });
}

function applyViewPreset(tasks: TrackerTask[], activeView: ViewId) {
  const today = todayStart();
  if (activeView === "Blocked / Delayed Items") return tasks.filter((task) => task.status === "Blocked" || (isOverdue(task, today) && !isClosed(task)));
  if (activeView === "Waaz Critical Tasks") return tasks.filter((task) => task.eventCriticality === "Waaz Critical" && !["Completed", "Tested"].includes(task.status));
  if (activeView === "Vendor Pending Items") return tasks.filter((task) => task.ownershipType === "Vendor" && task.status !== "Completed");
  if (activeView === "Local Team Pending Items") return tasks.filter((task) => task.ownershipType === "Local City IT" && task.status !== "Completed");
  if (activeView === "Document Pending Items") return tasks.filter((task) => ["Not Attached", "Needs Revision"].includes(task.documentStatus));
  if (activeView === "Final Readiness View") return tasks.filter((task) => !isClosed(task));
  return tasks;
}

function applyFiltersAndSearch(tasks: TrackerTask[], filters: Filters, search: string) {
  const normalized = search.trim().toLowerCase();
  return tasks.filter((task) => {
    const filterMatch =
      (filters.city === "All" || task.city === filters.city) &&
      (filters.workstream === "All" || task.workstream === filters.workstream) &&
      (filters.status === "All" || task.status === filters.status) &&
      (filters.priority === "All" || task.priority === filters.priority) &&
      (filters.eventCriticality === "All" || task.eventCriticality === filters.eventCriticality) &&
      (filters.riskLevel === "All" || task.riskLevel === filters.riskLevel) &&
      (filters.ownershipType === "All" || task.ownershipType === filters.ownershipType) &&
      (filters.documentStatus === "All" || task.documentStatus === filters.documentStatus);
    if (!filterMatch) return false;
    if (!normalized) return true;
    return [task.taskName, task.city, task.taskOwner, task.vendorName, task.remarksLatestUpdate, task.workstream, task.zoneArea]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });
}

function downloadCsv(rows: TrackerTask[], filename: string) {
  const header = CSV_HEADERS.map((item) => escapeCsv(item.label)).join(",");
  const body = rows.map((row) => CSV_HEADERS.map((item) => escapeCsv(String(row[item.key] ?? ""))).join(",")).join("\n");
  const blob = new Blob([[header, body].filter(Boolean).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  rows.push(row);
  const [headerRow, ...dataRows] = rows.filter((item) => item.some((cell) => cell.trim()));
  if (!headerRow) return [];
  return dataRows.map((dataRow) =>
    Object.fromEntries(headerRow.map((heading, index) => [heading.trim(), dataRow[index]?.trim() ?? ""]))
  );
}

function rowToTask(row: Record<string, string>): TrackerTask | null {
  const get = (label: string) => row[label] ?? row[toCamelKey(label)] ?? "";
  const city = get("City") || "Imported City";
  const workstream = get("Workstream") || WORKSTREAMS[0].name;
  const taskName = get("Task Name") || "Imported readiness task";
  const now = new Date().toISOString();
  const status = optionOrDefault(get("Status"), STATUSES, "Not Started");
  const progressValue = get("Progress %");
  const progressRaw = Number(progressValue);
  const hasProgressValue = progressValue.trim() !== "" && Number.isFinite(progressRaw);
  return {
    id: get("Task ID") || makeTaskId(city, workstream, taskName),
    city,
    zoneArea: optionOrDefault(get("Zone / Area"), ZONES, inferArea(taskName, workstream)),
    workstream,
    taskName,
    ownershipType: optionOrDefault(get("Ownership Type"), OWNERSHIP_TYPES, "Joint"),
    taskOwner: get("Task Owner"),
    supportingPerson: get("Supporting Person"),
    priority: optionOrDefault(get("Priority"), PRIORITIES, "Medium"),
    eventCriticality: optionOrDefault(get("Event Criticality"), EVENT_CRITICALITIES, "Operations Critical"),
    status,
    progress: hasProgressValue ? clamp(progressRaw, 0, 100) : STATUS_PROGRESS[status],
    dueDate: get("Due Date"),
    targetReadinessDate: get("Target Readiness Date"),
    dependency: get("Dependency"),
    vendorName: get("Vendor Name"),
    vendorContact: get("Vendor Contact"),
    budgetStatus: optionOrDefault(get("Budget Status"), BUDGET_STATUSES, "Not Required"),
    documentStatus: optionOrDefault(get("Document Status"), DOCUMENT_STATUSES, "Not Attached"),
    riskLevel: optionOrDefault(get("Risk Level"), RISK_LEVELS, "Medium"),
    blockerReason: get("Blocker Reason"),
    lastUpdateDate: get("Last Update Date"),
    nextFollowUpDate: get("Next Follow-up Date"),
    remarksLatestUpdate: get("Remarks / Latest Update"),
    documentLinkAttachmentReference: get("Document Link / Attachment Reference"),
    progressManuallyEdited: hasProgressValue,
    createdAt: get("Created At") || now,
    updatedAt: now
  };
}

function optionOrDefault<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCamelKey(label: string) {
  const clean = label.replace(/%/g, "").replace(/\//g, " ");
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/[^a-z0-9]/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value || 0)));
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isClosed(task: TrackerTask) {
  return CLOSED_STATUSES.has(task.status);
}

function isOverdue(task: TrackerTask, today = todayStart()) {
  if (!task.dueDate) return false;
  return new Date(`${task.dueDate}T00:00:00`) < today && !isClosed(task);
}

function isDueSoon(task: TrackerTask) {
  if (!task.dueDate || isClosed(task)) return false;
  const diff = new Date(`${task.dueDate}T00:00:00`).getTime() - todayStart().getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
}

function dueRowClass(task: TrackerTask) {
  if (isOverdue(task)) return "bg-red-50/70";
  if (isDueSoon(task)) return "bg-amber-50/70";
  return "";
}

function toneClasses(tone: string) {
  if (tone === "green") return "bg-green-50 text-green-700";
  if (tone === "blue") return "bg-blue-50 text-blue-700";
  if (tone === "red") return "bg-red-50 text-red-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

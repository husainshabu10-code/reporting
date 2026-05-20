"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GripVertical,
  Layers3,
  Maximize2,
  Menu,
  Minus,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Upload,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BUDGET_STATUSES,
  DOCUMENT_STATUSES,
  EVENT_CRITICALITIES,
  INITIAL_CITIES,
  OWNERSHIP_TYPES,
  PRIORITIES,
  PROGRESS_VALUES,
  RISK_LEVELS,
  STATUSES,
  STATUS_PROGRESS,
  TASK_WEIGHTS,
  WORKSTREAMS,
  ZONES,
  createBlankTask,
  generateDefaultTasksForCities,
  generateDefaultTasksForCity,
  inferArea,
  makeTaskId,
  taskDisplayName,
  toSentenceCase
} from "@/lib/asharaTrackerData";
import type { AttachmentReference, TrackerTask, VendorEntry } from "@/lib/asharaTrackerData";

type TabId = "Dashboard" | "Compare" | "Master List" | "Contacts" | "Area" | "Activity" | "Report" | "Timeline";
type ReportFormat = "Charts only" | "Tables only" | "Both charts and tables";
type ExcelReportFormat = "Table only" | "Table with chart summaries";
type SortKey = "city" | "workstream" | "taskName" | "zoneArea" | "taskOwner" | "status" | "progress" | "dueDate" | "riskLevel" | "taskWeight";
type TableField = "city" | "workstream" | "taskName" | "zoneArea" | "taskOwner" | "vendors" | "status" | "progress" | "riskLevel" | "dueDate" | "documentStatus" | "taskWeight";

type Filters = {
  city: string;
  workstream: string;
  status: string;
  area: string;
  vendor: string;
  poc: string;
  progress: string;
  priority: string;
  riskLevel: string;
  taskWeight: string;
  documentStatus: string;
  dueFrom: string;
  dueTo: string;
  search: string;
};

type Contact = {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  role: string;
  workstreamHandled: string;
  customResponsibility: string;
  notes: string;
};

type ActivityEntry = {
  id: string;
  at: string;
  user: string;
  action: string;
  item: string;
  details: string;
};

type ChartRow = {
  label: string;
  value: number;
  percent: number;
  status?: "good" | "warning" | "critical" | "muted";
};

type ChartDataset = {
  id: string;
  title: string;
  rows: ChartRow[];
  sourceRows: Array<Record<string, string | number>>;
  defaultKind: ChartKind;
  suffix?: string;
  sourceColumns?: string[];
};
type ChartKind = "Bar" | "Line" | "Pie" | "Donut" | "Progress";
type CustomMetric = "Count" | "Progress" | "Completed tasks";
type CustomField = "city" | "zoneArea" | "workstream" | "status" | "progress" | "taskWeight" | "priority" | "riskLevel" | "taskOwner" | "eventCriticality";
type CustomChartDefinition = {
  id: string;
  title: string;
  chartKind: ChartKind;
  groupBy: CustomField;
  subgroupBy: CustomField | "none";
  metric: CustomMetric;
  sourceColumns: string[];
  filters: Filters;
};

const STORAGE_TASKS_KEY = "ashara-it-readiness-tasks";
const STORAGE_CITIES_KEY = "ashara-it-readiness-cities";
const STORAGE_CONTACTS_KEY = "ashara-it-readiness-contacts";
const STORAGE_ACTIVITY_KEY = "ashara-it-readiness-activity";
const STORAGE_DATA_VERSION_KEY = "ashara-it-readiness-data-version";
const CURRENT_DATA_VERSION = "csv-full-task-list-83-2026-05-20";
const CURRENT_USER = "Admin";
const ATTACHMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];
const CLOSED_STATUSES = new Set(["Completed", "Tested", "Not Required"]);
const MOTION_MS = 180;
const TABS: Array<{ id: TabId; icon: LucideIcon }> = [
  { id: "Dashboard", icon: BarChart3 },
  { id: "Compare", icon: Layers3 },
  { id: "Master List", icon: FileSpreadsheet },
  { id: "Contacts", icon: Users },
  { id: "Area", icon: Filter },
  { id: "Activity", icon: Activity },
  { id: "Report", icon: FileText },
  { id: "Timeline", icon: CalendarClock }
];

const EMPTY_FILTERS: Filters = {
  city: "All",
  workstream: "All",
  status: "All",
  area: "All",
  vendor: "All",
  poc: "All",
  progress: "All",
  priority: "All",
  riskLevel: "All",
  taskWeight: "All",
  documentStatus: "All",
  dueFrom: "",
  dueTo: "",
  search: ""
};

const CUSTOM_FIELDS: Array<{ key: CustomField; label: string }> = [
  { key: "city", label: "City" },
  { key: "zoneArea", label: "Area" },
  { key: "workstream", label: "Workstream" },
  { key: "status", label: "Status" },
  { key: "progress", label: "Progress" },
  { key: "taskWeight", label: "Task weight" },
  { key: "priority", label: "Priority" },
  { key: "riskLevel", label: "Risk" },
  { key: "taskOwner", label: "Task Owner / POC" },
  { key: "eventCriticality", label: "Event Criticality" }
];
const CUSTOM_METRICS: CustomMetric[] = ["Count", "Progress", "Completed tasks"];
const DEFAULT_CUSTOM_COLUMNS = ["City", "Area", "Workstream", "Task Name", "Status", "Progress %", "Task Weight"];
const AREA_WEIGHTAGE_GROUPS = {
  CMZ: {
    points: 50,
    areas: ["Masjid", "CMZ", "Checkpoints", "Public Wi-Fi Area", "CCTV / Security", "Construction"]
  },
  "Central Office": {
    points: 35,
    areas: ["Central Offices", "SHZ OFFICES"]
  },
  General: {
    points: 15,
    areas: ["Relay Area", "General"]
  }
};
const AREA_WEIGHTAGE_TOTAL = 100;

export default function DashboardApp() {
  const [tasks, setTasks] = useState<TrackerTask[]>(() => normalizeTasks(generateDefaultTasksForCities(INITIAL_CITIES)));
  const [cities, setCities] = useState<string[]>(INITIAL_CITIES);
  const [contacts, setContacts] = useState<Contact[]>(() => createDefaultContacts(INITIAL_CITIES));
  const [activity, setActivity] = useState<ActivityEntry[]>(() => [
    createActivity("Dashboard created", "ASHARA MUBARAKAH tracker", "Initial local tracker data generated.")
  ]);
  const [activeTab, setActiveTab] = useState<TabId>("Dashboard");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [reportFilters, setReportFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cityDraft, setCityDraft] = useState("");
  const [highlightMissing, setHighlightMissing] = useState(true);
  const [chartData, setChartData] = useState<ChartDataset | null>(null);
  const [chartSettingsTab, setChartSettingsTab] = useState<TabId | null>(null);
  const [hiddenChartIds, setHiddenChartIds] = useState<Record<string, string[]>>({});
  const [chartOrder, setChartOrder] = useState<Record<string, string[]>>({});
  const [customCharts, setCustomCharts] = useState<Record<string, CustomChartDefinition[]>>({});
  const [addChartTab, setAddChartTab] = useState<TabId | null>(null);
  const [compareCities, setCompareCities] = useState<string[]>(INITIAL_CITIES.slice(0, 3));
  const [areaCity, setAreaCity] = useState(INITIAL_CITIES[0]);
  const [masterGroup, setMasterGroup] = useState<SortKey | "none">("city");
  const [masterSubgroup, setMasterSubgroup] = useState<SortKey | "none">("workstream");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortAsc, setSortAsc] = useState(true);
  const [contactDraft, setContactDraft] = useState<Contact>(() => blankContact(INITIAL_CITIES[0]));
  const [reportFormat, setReportFormat] = useState<ReportFormat>("Both charts and tables");
  const [excelReportFormat, setExcelReportFormat] = useState<ExcelReportFormat>("Table only");
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem(STORAGE_TASKS_KEY);
      const savedCities = window.localStorage.getItem(STORAGE_CITIES_KEY);
      const savedContacts = window.localStorage.getItem(STORAGE_CONTACTS_KEY);
      const savedActivity = window.localStorage.getItem(STORAGE_ACTIVITY_KEY);
      const savedVersion = window.localStorage.getItem(STORAGE_DATA_VERSION_KEY);
      const parsedCities = savedCities ? JSON.parse(savedCities) as string[] : INITIAL_CITIES;
      const parsedActivity = savedActivity ? JSON.parse(savedActivity) as ActivityEntry[] : activity;
      if (savedVersion !== CURRENT_DATA_VERSION) {
        setCities(parsedCities);
        setTasks(normalizeTasks(generateDefaultTasksForCities(parsedCities)));
        setActivity([createActivity("Task data replaced", "CSV task list", "Existing task data replaced with the imported full task list for every city."), ...parsedActivity].slice(0, 250));
      } else if (savedTasks) {
        setTasks(normalizeTasks(JSON.parse(savedTasks) as TrackerTask[]));
        setCities(parsedCities);
        setActivity(parsedActivity);
      }
      if (savedContacts) setContacts(JSON.parse(savedContacts) as Contact[]);
    } catch {
      setTasks(normalizeTasks(generateDefaultTasksForCities(INITIAL_CITIES)));
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 1024);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
    window.localStorage.setItem(STORAGE_CITIES_KEY, JSON.stringify(cities));
    window.localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(contacts));
    window.localStorage.setItem(STORAGE_ACTIVITY_KEY, JSON.stringify(activity));
    window.localStorage.setItem(STORAGE_DATA_VERSION_KEY, CURRENT_DATA_VERSION);
  }, [activity, cities, contacts, hydrated, tasks]);

  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [filters, tasks]);
  const reportTasks = useMemo(() => applyFilters(tasks, reportFilters), [reportFilters, tasks]);
  const cityStats = useMemo(() => getCityStats(tasks, cities), [cities, tasks]);
  const filteredCityStats = useMemo(() => getCityStats(filteredTasks, cities), [cities, filteredTasks]);
  const dashboardCharts = useMemo(() => buildDashboardCharts(filteredTasks, filteredCityStats), [filteredCityStats, filteredTasks]);
  const compareCharts = useMemo(() => buildCompareCharts(tasks, compareCities), [compareCities, tasks]);
  const masterCharts = useMemo(() => buildTaskCharts(filteredTasks, "master"), [filteredTasks]);
  const areaRows = useMemo(() => getAreaRows(tasks.filter((task) => task.city === areaCity)), [areaCity, tasks]);
  const areaCharts = useMemo(() => buildAreaCharts(areaRows, tasks.filter((task) => task.city === areaCity)), [areaRows, areaCity, tasks]);
  const reportCharts = useMemo(() => buildDashboardCharts(reportTasks, getCityStats(reportTasks, cities)), [cities, reportTasks]);
  const sortedMasterTasks = useMemo(() => sortTasks(filteredTasks, sortKey, sortAsc), [filteredTasks, sortAsc, sortKey]);
  const chartRowsByTab = useMemo(
    () => ({
      Dashboard: filteredTasks,
      Compare: tasks.filter((task) => compareCities.includes(task.city)),
      "Master List": filteredTasks,
      Area: tasks.filter((task) => task.city === areaCity),
      Report: reportTasks
    }),
    [areaCity, compareCities, filteredTasks, reportTasks, tasks]
  );
  const customChartsByTab = useMemo(
    () => Object.fromEntries(Object.entries(customCharts).map(([tab, definitions]) => [tab, definitions.map((definition) => buildCustomChart(definition, chartRowsByTab[tab as keyof typeof chartRowsByTab] || []))])) as Partial<Record<TabId, ChartDataset[]>>,
    [chartRowsByTab, customCharts]
  );
  const pageCharts = useMemo(
    () => ({
      Dashboard: [...dashboardCharts, ...(customChartsByTab.Dashboard || [])],
      Compare: [...compareCharts, ...(customChartsByTab.Compare || [])],
      "Master List": [...masterCharts, ...(customChartsByTab["Master List"] || [])],
      Area: [...areaCharts, ...(customChartsByTab.Area || [])],
      Report: [...reportCharts, ...(customChartsByTab.Report || [])]
    }),
    [areaCharts, compareCharts, customChartsByTab, dashboardCharts, masterCharts, reportCharts]
  );
  const chartsForActiveTab = chartsForTab(activeTab, pageCharts);
  const visibleChartsFor = (tab: TabId, charts: ChartDataset[]) => orderCharts(charts.filter((chart) => !(hiddenChartIds[tab] || []).includes(chart.id)), chartOrder[tab] || []);

  const hideChart = (tab: TabId, chartId: string) => {
    if (!window.confirm("Delete this chart card from the current page view? You can add it again from Add Chart.")) return;
    setHiddenChartIds((current) => ({ ...current, [tab]: unique([...(current[tab] || []), chartId]) }));
  };

  const restoreChart = (tab: TabId, chartId: string) => {
    setHiddenChartIds((current) => ({ ...current, [tab]: (current[tab] || []).filter((id) => id !== chartId) }));
  };

  const reorderChart = (tab: TabId, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const availableIds = chartsForTab(tab, pageCharts).map((chart) => chart.id);
    setChartOrder((current) => ({ ...current, [tab]: moveChartId(sourceId, targetId, current[tab] || availableIds, availableIds) }));
  };

  const addCustomChart = (tab: TabId, definition: CustomChartDefinition) => {
    setCustomCharts((current) => ({ ...current, [tab]: [...(current[tab] || []), definition] }));
    setAddChartTab(null);
    logActivity("Chart created", definition.title, `${tab} custom chart added.`);
  };

  const logActivity = (action: string, item: string, details: string) => {
    setActivity((current) => [createActivity(action, item, details), ...current].slice(0, 250));
  };

  const upsertTask = (task: TrackerTask) => {
    const normalized = normalizeTask({ ...task, taskName: toSentenceCase(task.taskName), updatedAt: new Date().toISOString() });
    const existing = tasks.find((item) => item.id === normalized.id);
    setTasks((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists ? current.map((item) => (item.id === normalized.id ? normalized : item)) : [normalized, ...current];
    });
    setSelectedTask(normalized);
    if (!existing) {
      logActivity("Task created", normalized.taskName, `${normalized.city} / ${normalized.workstream}`);
      return;
    }
    if (existing.status !== normalized.status) logActivity("Status changed", normalized.taskName, `${existing.status} to ${normalized.status}`);
    if (existing.progress !== normalized.progress) logActivity("Progress changed", normalized.taskName, `${existing.progress}% to ${normalized.progress}%`);
    if (vendorSummary(existing) !== vendorSummary(normalized)) logActivity("Vendor added or updated", normalized.taskName, vendorSummary(normalized));
    if (existing.attachments.length !== normalized.attachments.length) logActivity("Attachment uploaded", normalized.taskName, `${normalized.attachments.length} attachment(s) recorded`);
    logActivity("Task updated", normalized.taskName, `${normalized.city} / ${normalized.zoneArea}`);
  };

  const deleteTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!window.confirm("Delete this task from the tracker?")) return;
    setTasks((current) => current.filter((item) => item.id !== taskId));
    setSelectedTask(null);
    if (task) logActivity("Task deleted", task.taskName, `${task.city} / ${task.workstream}`);
  };

  const addCity = (generateTasks: boolean) => {
    const city = cityDraft.trim();
    if (!city) return;
    if (cities.some((item) => item.toLowerCase() === city.toLowerCase())) {
      window.alert("This city already exists.");
      return;
    }
    setCities((current) => [...current, city]);
    setContacts((current) => [...current, blankContact(city)]);
    if (generateTasks) setTasks((current) => [...current, ...normalizeTasks(generateDefaultTasksForCity(city))]);
    logActivity("City added", city, generateTasks ? "Default tasks generated." : "City shell created.");
    setCityDraft("");
  };

  const resetDemoData = () => {
    if (!window.confirm("Reset all local data to the default ASHARA MUBARAKAH dashboard setup?")) return;
    setCities(INITIAL_CITIES);
    setTasks(normalizeTasks(generateDefaultTasksForCities(INITIAL_CITIES)));
    setContacts(createDefaultContacts(INITIAL_CITIES));
    setActivity([createActivity("Demo data reset", "ASHARA MUBARAKAH tracker", "Default tasks and contacts restored.")]);
    setFilters(EMPTY_FILTERS);
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseCsv(text).map(rowToTask).filter(Boolean) as TrackerTask[];
    if (!imported.length) {
      window.alert("No valid task rows found in this CSV.");
      return;
    }
    setTasks((current) => {
      const byId = new Map(current.map((task) => [task.id, task]));
      normalizeTasks(imported).forEach((task) => byId.set(task.id, task));
      return Array.from(byId.values());
    });
    setCities((current) => Array.from(new Set([...current, ...imported.map((task) => task.city)])));
    logActivity("Tasks imported", file.name, `${imported.length} row(s) imported or updated.`);
    event.target.value = "";
  };

  const saveContact = () => {
    const saved = { ...contactDraft, id: contactDraft.id || `contact-${Date.now()}` };
    setContacts((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
    });
    logActivity("Contact added or updated", saved.name || "Unnamed contact", `${saved.city} / ${saved.workstreamHandled}`);
    setContactDraft(blankContact(saved.city));
  };

  const exportTaskCsv = (rows: TrackerTask[], label: string) => {
    downloadCsv(tasksToRows(rows), `ashara-it-${label}.csv`);
    logActivity("Report exported", label, `${rows.length} task row(s) exported as CSV.`);
  };

  const exportExcelReport = (rows: TrackerTask[]) => {
    downloadExcelReport(rows, reportCharts, excelReportFormat, "ashara-it-report.xls");
    logActivity("Report exported", "Excel report", `${rows.length} task row(s), ${excelReportFormat}.`);
  };

  const exportPdf = (rows: TrackerTask[]) => {
    openPdfReport(rows, reportCharts, reportFormat);
    logActivity("Report exported", "PDF report", `${rows.length} task row(s), ${reportFormat}.`);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      {sidebarOpen && <button className="blur-overlay fixed inset-0 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar overlay" />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,86vw)] flex-col border-r border-[var(--color-border)] bg-[var(--color-primary)] text-white shadow-2xl transition-transform duration-300 ease-out lg:w-72 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex min-h-24 items-start justify-between gap-3 border-b border-white/15 p-5">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-accent-light)]">ASHARA MUBARAKAH</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-white">IT / Event Preparation</h1>
          </div>
          <button className="rounded-md p-2 text-white hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`flex w-full min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id ? "bg-[var(--color-accent)] text-[var(--color-primary)] shadow-sm" : "text-white/90 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
              >
                <Icon size={17} /> {tab.id}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/15 p-4 text-xs leading-5 text-white/75">
          City-wise readiness, contacts, reports, and timeline tracking.
        </div>
      </aside>

      <section className={`min-h-screen transition-[padding] duration-300 ease-out ${sidebarOpen ? "lg:pl-72" : ""}`}>
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button className="icon-btn" onClick={() => setSidebarOpen((value) => !value)} aria-label={sidebarOpen ? "Close sidebar menu" : "Open sidebar menu"}>
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-[var(--color-accent)]">{activeTab}</p>
                <h2 className="truncate text-lg font-semibold text-[var(--color-primary)] sm:text-2xl">IT / Event Preparation Dashboard</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {chartsForActiveTab.length > 0 && (
                <button className="btn-secondary justify-center max-[380px]:col-span-2" onClick={() => setChartSettingsTab(activeTab)}><BarChart3 size={16} /> Chart Settings</button>
              )}
              {chartsForActiveTab.length > 0 && (
                <button className="btn-secondary justify-center max-[380px]:col-span-2" onClick={() => setAddChartTab(activeTab)}><Plus size={16} /> Add Chart</button>
              )}
              <button className="btn-primary justify-center" onClick={() => setSelectedTask(createBlankTask(cities[0] ?? "Nairobi"))}><Plus size={16} /> Add Task</button>
              <button className="btn-secondary justify-center" onClick={() => exportTaskCsv(filteredTasks, "visible-tasks")}><Download size={16} /> Export CSV</button>
              <button className="btn-secondary justify-center" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Import CSV</button>
              <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
              <button className="btn-secondary justify-center" onClick={resetDemoData}><RefreshCcw size={16} /> Reset Demo</button>
            </div>
            <div className="lg:hidden">
              <label className="space-y-1 block">
                <span className="field-label">Current tab</span>
                <select className="field" value={activeTab} onChange={(event) => setActiveTab(event.target.value as TabId)}>
                  {TABS.map((tab) => <option key={tab.id} value={tab.id}>{tab.id}</option>)}
                </select>
              </label>
            </div>
          </div>
        </header>

      <div className="mx-auto max-w-[1800px] space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-5 lg:px-8">
        <CityManager cityDraft={cityDraft} setCityDraft={setCityDraft} onAddCity={addCity} />

        {activeTab === "Dashboard" && (
          <DashboardPage
            filters={filters}
            setFilters={setFilters}
            sourceTasks={tasks}
            charts={visibleChartsFor("Dashboard", pageCharts.Dashboard || [])}
            onShowData={setChartData}
            onDeleteChart={(chartId) => hideChart("Dashboard", chartId)}
            onReorderChart={(sourceId, targetId) => reorderChart("Dashboard", sourceId, targetId)}
          />
        )}

        {activeTab === "Compare" && (
          <ComparePage
            cities={cities}
            selectedCities={compareCities}
            setSelectedCities={setCompareCities}
            charts={visibleChartsFor("Compare", pageCharts.Compare || [])}
            tasks={tasks.filter((task) => compareCities.includes(task.city))}
            onShowData={setChartData}
            onDeleteChart={(chartId) => hideChart("Compare", chartId)}
            onReorderChart={(sourceId, targetId) => reorderChart("Compare", sourceId, targetId)}
          />
        )}

        {activeTab === "Master List" && (
          <MasterListPage
            filters={filters}
            setFilters={setFilters}
            sourceTasks={tasks}
            tasks={sortedMasterTasks}
            charts={visibleChartsFor("Master List", pageCharts["Master List"] || [])}
            groupBy={masterGroup}
            setGroupBy={setMasterGroup}
            subgroupBy={masterSubgroup}
            setSubgroupBy={setMasterSubgroup}
            sortKey={sortKey}
            setSortKey={setSortKey}
            sortAsc={sortAsc}
            setSortAsc={setSortAsc}
            highlightMissing={highlightMissing}
            setHighlightMissing={setHighlightMissing}
            onShowData={setChartData}
            onDeleteChart={(chartId) => hideChart("Master List", chartId)}
            onReorderChart={(sourceId, targetId) => reorderChart("Master List", sourceId, targetId)}
            onOpenTask={setSelectedTask}
          />
        )}

        {activeTab === "Contacts" && (
          <ContactsPage contacts={contacts} cities={cities} setContactDraft={setContactDraft} contactDraft={contactDraft} saveContact={saveContact} />
        )}

        {activeTab === "Area" && (
          <AreaPage cities={cities} selectedCity={areaCity} setSelectedCity={setAreaCity} areaRows={areaRows} charts={visibleChartsFor("Area", pageCharts.Area || [])} onShowData={setChartData} onDeleteChart={(chartId) => hideChart("Area", chartId)} onReorderChart={(sourceId, targetId) => reorderChart("Area", sourceId, targetId)} />
        )}

        {activeTab === "Activity" && <ActivityPage activity={activity} />}

        {activeTab === "Report" && (
          <ReportPage
            filters={reportFilters}
            setFilters={setReportFilters}
            sourceTasks={tasks}
            reportTasks={reportTasks}
            charts={visibleChartsFor("Report", pageCharts.Report || [])}
            reportFormat={reportFormat}
            setReportFormat={setReportFormat}
            excelReportFormat={excelReportFormat}
            setExcelReportFormat={setExcelReportFormat}
            onShowData={setChartData}
            onDeleteChart={(chartId) => hideChart("Report", chartId)}
            onReorderChart={(sourceId, targetId) => reorderChart("Report", sourceId, targetId)}
            onExportPdf={exportPdf}
            onExportExcel={() => exportExcelReport(reportTasks)}
          />
        )}

        {activeTab === "Timeline" && <TimelinePage cityStats={cityStats} tasks={tasks} onOpenTask={setSelectedTask} />}
      </div>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-1 px-4 py-4 text-sm text-[var(--color-text-muted)] sm:px-6 lg:px-8">
          <span className="font-semibold text-[var(--color-primary)]">ASHARA MUBARAKAH IT / Event Preparation Dashboard</span>
          <span>City-wise readiness, area progress, contacts, reports, and activity in one tracker.</span>
        </div>
      </footer>
      </section>

      {selectedTask && (
        <TaskEditor task={selectedTask} cities={cities} onSave={upsertTask} onClose={() => setSelectedTask(null)} onDelete={deleteTask} />
      )}
      {chartData && <DataModal dataset={chartData} onClose={() => setChartData(null)} />}
      {chartSettingsTab && (
        <ChartSettingsModal
          tab={chartSettingsTab}
          charts={chartsForTab(chartSettingsTab, pageCharts)}
          hiddenIds={hiddenChartIds[chartSettingsTab] || []}
          onChange={(nextHidden) => setHiddenChartIds((current) => ({ ...current, [chartSettingsTab]: nextHidden }))}
          onClose={() => setChartSettingsTab(null)}
        />
      )}
      {addChartTab && (
        <AddChartModal
          tab={addChartTab}
          charts={chartsForTab(addChartTab, pageCharts)}
          hiddenIds={hiddenChartIds[addChartTab] || []}
          sourceTasks={chartRowsByTab[addChartTab as keyof typeof chartRowsByTab] || []}
          onRestore={(chartId) => restoreChart(addChartTab, chartId)}
          onAddCustom={(definition) => addCustomChart(addChartTab, definition)}
          onClose={() => setAddChartTab(null)}
        />
      )}
    </main>
  );
}

function DashboardPage({
  filters,
  setFilters,
  sourceTasks,
  charts,
  onShowData,
  onDeleteChart,
  onReorderChart
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  sourceTasks: TrackerTask[];
  charts: ChartDataset[];
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
  onReorderChart: (sourceId: string, targetId: string) => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <FiltersPanel filters={filters} setFilters={setFilters} sourceTasks={sourceTasks} />
      </Panel>
      <ChartGrid charts={charts} onShowData={onShowData} onDeleteChart={onDeleteChart} onReorderChart={onReorderChart} />
    </section>
  );
}

function ComparePage({
  cities,
  selectedCities,
  setSelectedCities,
  charts,
  tasks,
  onShowData,
  onDeleteChart,
  onReorderChart
}: {
  cities: string[];
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  charts: ChartDataset[];
  tasks: TrackerTask[];
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
  onReorderChart: (sourceId: string, targetId: string) => void;
}) {
  const toggleCity = (city: string) => {
    setSelectedCities(selectedCities.includes(city) ? selectedCities.filter((item) => item !== city) : [...selectedCities, city]);
  };
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="section-title">Choose cities to compare</h2>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {cities.map((city) => (
              <button key={city} className={`tab-choice flex-none ${selectedCities.includes(city) ? "tab-choice-active" : ""}`} onClick={() => toggleCity(city)}>
                {city}
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <ChartGrid charts={charts} onShowData={onShowData} onDeleteChart={onDeleteChart} onReorderChart={onReorderChart} />
      <TaskTable tasks={tasks.slice(0, 40)} onOpenTask={() => undefined} highlightMissing={false} />
    </section>
  );
}

function MasterListPage({
  filters,
  setFilters,
  sourceTasks,
  tasks,
  charts,
  groupBy,
  setGroupBy,
  subgroupBy,
  setSubgroupBy,
  sortKey,
  setSortKey,
  sortAsc,
  setSortAsc,
  highlightMissing,
  setHighlightMissing,
  onShowData,
  onDeleteChart,
  onReorderChart,
  onOpenTask
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  sourceTasks: TrackerTask[];
  tasks: TrackerTask[];
  charts: ChartDataset[];
  groupBy: SortKey | "none";
  setGroupBy: (value: SortKey | "none") => void;
  subgroupBy: SortKey | "none";
  setSubgroupBy: (value: SortKey | "none") => void;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  sortAsc: boolean;
  setSortAsc: (value: boolean) => void;
  highlightMissing: boolean;
  setHighlightMissing: (value: boolean) => void;
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
  onReorderChart: (sourceId: string, targetId: string) => void;
  onOpenTask: (task: TrackerTask) => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <FiltersPanel filters={filters} setFilters={setFilters} sourceTasks={sourceTasks} />
      </Panel>
      <ChartGrid charts={charts} onShowData={onShowData} onDeleteChart={onDeleteChart} onReorderChart={onReorderChart} />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SelectField label="Group by" value={groupBy} options={["none", ...MASTER_FIELDS]} onChange={(value) => setGroupBy(value as SortKey | "none")} />
          <SelectField label="Subgroup by" value={subgroupBy} options={["none", ...MASTER_FIELDS]} onChange={(value) => setSubgroupBy(value as SortKey | "none")} />
          <SelectField label="Sort by" value={sortKey} options={MASTER_FIELDS} onChange={(value) => setSortKey(value as SortKey)} />
          <SelectField label="Direction" value={sortAsc ? "Ascending" : "Descending"} options={["Ascending", "Descending"]} onChange={(value) => setSortAsc(value === "Ascending")} />
          <div className="flex items-end"><Toggle checked={highlightMissing} onChange={setHighlightMissing} label="Missing highlight" /></div>
        </div>
      </Panel>
      <GroupedTaskTable tasks={tasks} groupBy={groupBy} subgroupBy={subgroupBy} onOpenTask={onOpenTask} highlightMissing={highlightMissing} />
    </section>
  );
}

function ContactsPage({
  contacts,
  cities,
  contactDraft,
  setContactDraft,
  saveContact
}: {
  contacts: Contact[];
  cities: string[];
  contactDraft: Contact;
  setContactDraft: (contact: Contact) => void;
  saveContact: () => void;
}) {
  const grouped = groupByValue(contacts, "city");
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <h2 className="section-title">Contact details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InputField label="Name" value={contactDraft.name} onChange={(value) => setContactDraft({ ...contactDraft, name: value })} />
          <SelectField label="City" value={contactDraft.city} options={cities} onChange={(value) => setContactDraft({ ...contactDraft, city: value })} />
          <InputField label="Phone" value={contactDraft.phone} onChange={(value) => setContactDraft({ ...contactDraft, phone: value })} />
          <InputField label="Email" value={contactDraft.email} onChange={(value) => setContactDraft({ ...contactDraft, email: value })} />
          <InputField label="Role" value={contactDraft.role} onChange={(value) => setContactDraft({ ...contactDraft, role: value })} />
          <SelectField label="Workstream handled" value={contactDraft.workstreamHandled} options={[...WORKSTREAMS.map((item) => item.name), "Custom"]} onChange={(value) => setContactDraft({ ...contactDraft, workstreamHandled: value })} />
          <InputField label="Custom responsibility" value={contactDraft.customResponsibility} onChange={(value) => setContactDraft({ ...contactDraft, customResponsibility: value })} />
          <InputField label="Notes" value={contactDraft.notes} onChange={(value) => setContactDraft({ ...contactDraft, notes: value })} />
        </div>
        <div className="mt-4 grid sm:flex sm:justify-end"><button className="btn-primary justify-center" onClick={saveContact}><Plus size={16} /> Save Contact</button></div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(grouped).map(([city, rows]) => (
          <Panel key={city}>
            <h3 className="section-title">{city}</h3>
            <div className="mt-3 space-y-3">
              {rows.map((contact) => (
                <button key={contact.id} className="motion-card w-full rounded-lg border border-[var(--color-border)] p-3 text-left transition hover:bg-[var(--color-bg)]" onClick={() => setContactDraft(contact)}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-primary)]">{contact.name || "Unnamed POC"}</p>
                      <p className="break-words text-sm text-[var(--color-text-muted)]">{contact.role || "Role pending"} / {contact.workstreamHandled}</p>
                    </div>
                    <span className="badge-gold w-fit max-w-full break-all">{contact.phone || "Phone pending"}</span>
                  </div>
                  <p className="mt-2 break-words text-sm text-[var(--color-text-muted)]">{contact.email || "Email pending"} {contact.notes ? `- ${contact.notes}` : ""}</p>
                </button>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function AreaPage({
  cities,
  selectedCity,
  setSelectedCity,
  areaRows,
  charts,
  onShowData,
  onDeleteChart,
  onReorderChart
}: {
  cities: string[];
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  areaRows: ReturnType<typeof getAreaRows>;
  charts: ChartDataset[];
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
  onReorderChart: (sourceId: string, targetId: string) => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel><SelectField label="Select city" value={selectedCity} options={cities} onChange={setSelectedCity} /></Panel>
      <ChartGrid charts={charts} onShowData={onShowData} onDeleteChart={onDeleteChart} onReorderChart={onReorderChart} />
      <Panel>
        <Table rows={areaRows.map((row) => ({
          Area: row.area,
          Tasks: row.tasks,
          Workstreams: row.workstreams,
          Status: row.health,
          "Progress %": row.progress,
          "Due Soon": row.dueSoon,
          Overdue: row.overdue
        }))} />
      </Panel>
    </section>
  );
}

function ActivityPage({ activity }: { activity: ActivityEntry[] }) {
  return (
    <section className="animate-fade-in space-y-4">
      {activity.map((item) => (
        <article key={item.id} className="motion-card rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-[var(--color-primary)]">{item.action}</p>
              <p className="text-sm text-[var(--color-text)]">{item.item}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.details}</p>
            </div>
            <div className="text-sm text-[var(--color-text-muted)] sm:text-right">
              <p>{new Date(item.at).toLocaleString()}</p>
              <p>{item.user}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ReportPage({
  filters,
  setFilters,
  sourceTasks,
  reportTasks,
  charts,
  reportFormat,
  setReportFormat,
  excelReportFormat,
  setExcelReportFormat,
  onShowData,
  onDeleteChart,
  onReorderChart,
  onExportPdf,
  onExportExcel
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  sourceTasks: TrackerTask[];
  reportTasks: TrackerTask[];
  charts: ChartDataset[];
  reportFormat: ReportFormat;
  setReportFormat: (format: ReportFormat) => void;
  excelReportFormat: ExcelReportFormat;
  setExcelReportFormat: (format: ExcelReportFormat) => void;
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
  onReorderChart: (sourceId: string, targetId: string) => void;
  onExportPdf: (rows: TrackerTask[]) => void;
  onExportExcel: () => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <FiltersPanel filters={filters} setFilters={setFilters} sourceTasks={sourceTasks} />
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <SelectField label="Report format" value={reportFormat} options={["Charts only", "Tables only", "Both charts and tables"]} onChange={(value) => setReportFormat(value as ReportFormat)} />
          <SelectField label="Excel export" value={excelReportFormat} options={["Table only", "Table with chart summaries"]} onChange={(value) => setExcelReportFormat(value as ExcelReportFormat)} />
          <button className="btn-primary justify-center" onClick={() => onExportPdf(reportTasks)}><FileText size={16} /> Export PDF</button>
          <button className="btn-secondary justify-center" onClick={onExportExcel}><FileSpreadsheet size={16} /> Export Excel</button>
        </div>
      </Panel>
      {reportFormat !== "Tables only" && <ChartGrid charts={charts} onShowData={onShowData} onDeleteChart={onDeleteChart} onReorderChart={onReorderChart} />}
      {reportFormat !== "Charts only" && <TaskTable tasks={reportTasks} onOpenTask={() => undefined} highlightMissing={false} />}
    </section>
  );
}

function TimelinePage({ cityStats, tasks, onOpenTask }: { cityStats: ReturnType<typeof getCityStats>; tasks: TrackerTask[]; onOpenTask: (task: TrackerTask) => void }) {
  const upcoming = tasks
    .filter((task) => task.dueDate && !isClosed(task))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 40);
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <h2 className="section-title">City progress timeline</h2>
        <div className="mt-4 space-y-4">
          {[...cityStats].sort((a, b) => b.completion - a.completion).map((city, index) => (
            <div key={city.city} className="grid gap-3 md:grid-cols-[11rem_1fr_8rem] md:items-center">
              <div>
                <p className="font-semibold text-[var(--color-primary)]">{index + 1}. {city.city}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{city.health}</p>
              </div>
              <ProgressBar value={city.completion} />
              <span className="text-sm font-semibold text-[var(--color-primary)]">{city.completion}% ready</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2 className="section-title">Upcoming and delayed items</h2>
        <div className="mt-4 space-y-3">
          {upcoming.map((task) => (
            <button key={task.id} className={`motion-card w-full rounded-lg border border-[var(--color-border)] p-3 text-left transition hover:bg-[var(--color-bg)] ${isOverdue(task) ? "bg-[#7A1F2B]/10" : ""}`} onClick={() => onOpenTask(task)}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-text)]">{task.taskName}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{task.city} / {task.zoneArea} / {task.workstream}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                  <span className="badge-gold">{task.dueDate}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function CityManager({ cityDraft, setCityDraft, onAddCity }: { cityDraft: string; setCityDraft: (value: string) => void; onAddCity: (generateTasks: boolean) => void }) {
  return (
    <Panel>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <InputField label="Add new city" value={cityDraft} onChange={setCityDraft} placeholder="Enter city name" />
        <button className="btn-secondary justify-center" onClick={() => onAddCity(false)}><Plus size={16} /> Add City Only</button>
        <button className="btn-primary justify-center" onClick={() => onAddCity(true)}><Plus size={16} /> Add City + Default Tasks</button>
      </div>
    </Panel>
  );
}

function FiltersPanel({ filters, setFilters, sourceTasks }: { filters: Filters; setFilters: (filters: Filters) => void; sourceTasks: TrackerTask[] }) {
  const [open, setOpen] = useState(false);
  const scoped = filters.city === "All" ? sourceTasks : sourceTasks.filter((task) => task.city === filters.city);
  const update = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value });
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== "search" && value && value !== "All").length + (filters.search ? 1 : 0);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-primary" onClick={() => setOpen((value) => !value)}>
          <Filter size={16} /> Filter {activeCount ? `(${activeCount})` : ""}
        </button>
        <p className="text-sm text-[var(--color-text-muted)]">Open filters from the button and choose only what you need.</p>
      </div>

      <div className={`blur-overlay fixed inset-0 z-20 cursor-default transition-opacity duration-200 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setOpen(false)} aria-label="Close filter panel" />
      <div className={`fixed inset-x-3 top-24 z-30 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-2xl transition-all duration-200 ease-out sm:absolute sm:left-0 sm:right-auto sm:top-12 sm:w-[min(72rem,calc(100vw-2rem))] sm:p-4 ${open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">Filters</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Selections apply immediately to this page.</p>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close filters"><X size={16} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <label className="space-y-1 md:col-span-2">
                <span className="field-label">Search</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-accent)]" size={16} />
                  <input className="field pl-9" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Search task, city, owner, vendor, notes" />
                </span>
              </label>
              <SelectField label="City" value={filters.city} options={unique(sourceTasks.map((task) => task.city))} includeAll onChange={(value) => update("city", value)} />
              <SelectField label="Workstream" value={filters.workstream} options={unique(scoped.map((task) => task.workstream))} includeAll onChange={(value) => update("workstream", value)} />
              <SelectField label="Status" value={filters.status} options={STATUSES} includeAll onChange={(value) => update("status", value)} />
              <SelectField label="Area" value={filters.area} options={ZONES} includeAll onChange={(value) => update("area", value)} />
              <SelectField label="Vendor" value={filters.vendor} options={unique(scoped.flatMap((task) => task.vendors.map((vendor) => vendor.name).filter(Boolean)))} includeAll onChange={(value) => update("vendor", value)} />
              <SelectField label="POC / Owner" value={filters.poc} options={unique(scoped.flatMap((task) => [task.taskOwner, task.supportingPerson]).filter(Boolean))} includeAll onChange={(value) => update("poc", value)} />
              <SelectField label="Progress" value={filters.progress} options={PROGRESS_VALUES.map(String)} includeAll onChange={(value) => update("progress", value)} />
              <SelectField label="Priority" value={filters.priority} options={PRIORITIES} includeAll onChange={(value) => update("priority", value)} />
              <SelectField label="Risk" value={filters.riskLevel} options={RISK_LEVELS} includeAll onChange={(value) => update("riskLevel", value)} />
              <SelectField label="Task weight" value={filters.taskWeight} options={TASK_WEIGHTS} includeAll onChange={(value) => update("taskWeight", value)} />
              <SelectField label="Document" value={filters.documentStatus} options={DOCUMENT_STATUSES} includeAll onChange={(value) => update("documentStatus", value)} />
              <InputField label="Due from" type="date" value={filters.dueFrom} onChange={(value) => update("dueFrom", value)} />
              <InputField label="Due to" type="date" value={filters.dueTo} onChange={(value) => update("dueTo", value)} />
            </div>
            <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
              <button className="btn-secondary justify-center" onClick={() => setFilters(EMPTY_FILTERS)}><X size={16} /> Clear Filters</button>
              <button className="btn-primary justify-center" onClick={() => setOpen(false)}>Apply</button>
            </div>
          </div>
    </div>
  );
}

function ChartGrid({
  charts,
  onShowData,
  onDeleteChart,
  onReorderChart
}: {
  charts: ChartDataset[];
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
  onReorderChart: (sourceId: string, targetId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const startDrag = (event: DragEvent<HTMLButtonElement>, chartId: string) => {
    setDraggingId(chartId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chartId);
  };
  const dropOnChart = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetId) onReorderChart(sourceId, targetId);
    setDraggingId(null);
  };

  return (
    <section className="chart-masonry min-w-0">
      {charts.map((chart) => (
        <ChartCard
          key={chart.id}
          dataset={chart}
          isDragging={draggingId === chart.id}
          onDragStart={(event) => startDrag(event, chart.id)}
          onDragEnd={() => setDraggingId(null)}
          onDropChart={(event) => dropOnChart(event, chart.id)}
          onShowData={onShowData}
          onDeleteChart={onDeleteChart}
        />
      ))}
    </section>
  );
}

function ChartCard({
  dataset,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropChart,
  onShowData,
  onDeleteChart
}: {
  dataset: ChartDataset;
  isDragging: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDropChart: (event: DragEvent<HTMLElement>) => void;
  onShowData: (dataset: ChartDataset) => void;
  onDeleteChart: (chartId: string) => void;
}) {
  const [chartKind, setChartKind] = useState<ChartKind>(dataset.defaultKind);
  const [collapsed, setCollapsed] = useState(false);
  const [bodyMounted, setBodyMounted] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [menuOpen]);

  const resetChart = () => {
    setChartKind(dataset.defaultKind);
    setShowLegend(true);
    setMenuOpen(false);
    setBodyMounted(true);
    setCollapsed(false);
  };

  const toggleCollapsed = () => {
    if (collapsed) {
      setBodyMounted(true);
      window.requestAnimationFrame(() => setCollapsed(false));
      return;
    }
    setCollapsed(true);
  };

  return (
    <article
      className={`chart-card group motion-card min-w-0 overflow-visible rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-soft ${isDragging ? "chart-card-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropChart}
    >
      <div className="relative min-w-0 p-3 pr-28 sm:p-4 sm:pr-36 lg:pr-64">
        <div className="flex min-w-0 items-center gap-2">
          <button className="drag-handle hidden flex-none sm:inline-flex" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label={`Move ${dataset.title}`} title="Drag to reorder chart">
            <GripVertical size={16} />
          </button>
          <h2 className="section-title break-words">{dataset.title}</h2>
        </div>
        <div className="chart-hover-toolbar absolute right-3 top-3 flex flex-none items-start gap-1 sm:right-4 sm:top-4">
          <span className="hidden rounded-full bg-[var(--color-bg)] px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)] xl:inline-flex">Refreshed now</span>
          <button className="mini-icon-btn" onClick={resetChart} aria-label="Refresh chart" title="Refresh"><RefreshCcw size={15} /></button>
          <button className="mini-icon-btn" onClick={() => setFullscreen(true)} aria-label="Expand chart" title="Expand"><Maximize2 size={15} /></button>
          <button className="mini-icon-btn" onClick={() => onShowData(dataset)} aria-label="Filter source data" title="View data"><Filter size={15} /></button>
          <button className="mini-icon-btn" onClick={resetChart} aria-label="Chart settings" title="Reset settings"><Settings size={15} /></button>
          <div ref={menuRef} className="relative">
            <button className="mini-icon-btn" onClick={() => setMenuOpen((value) => !value)} aria-label="More chart options" aria-expanded={menuOpen} title="More options">
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-2xl animate-fade-in">
                <button className="export-menu-item" onClick={() => setShowLegend((value) => !value)}>{showLegend ? "Hide legend" : "Show legend"}</button>
                <div className="border-t border-[var(--color-border)] py-1">
                  <p className="px-2 py-1 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Export</p>
                  <button className="export-menu-item" onClick={() => { downloadChartVisual(dataset, chartKind, "png"); setMenuOpen(false); }}>Export as PNG</button>
                  <button className="export-menu-item" onClick={() => { downloadChartVisual(dataset, chartKind, "pdf"); setMenuOpen(false); }}>Export as PDF</button>
                </div>
                <button className="export-menu-item text-[var(--color-important)]" onClick={() => { setMenuOpen(false); onDeleteChart(dataset.id); }}>Delete card</button>
              </div>
            )}
          </div>
          <button className="mini-icon-btn" onClick={toggleCollapsed} aria-label={collapsed ? `Expand ${dataset.title}` : `Collapse ${dataset.title}`} aria-expanded={!collapsed} title={collapsed ? "Expand" : "Collapse"}>
            <ChevronDown className={`transition-transform duration-300 ${collapsed ? "-rotate-90" : "rotate-0"}`} size={17} />
          </button>
        </div>
      </div>
      {bodyMounted && (
        <div
          className={`grid overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "grid-rows-[0fr] px-3 pb-0 opacity-0 sm:px-4" : "grid-rows-[1fr] px-3 pb-3 opacity-100 sm:px-4 sm:pb-4"}`}
          onTransitionEnd={(event) => {
            if (event.currentTarget === event.target && collapsed) setBodyMounted(false);
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <select className="chart-select" value={chartKind} onChange={(event) => setChartKind(event.target.value as ChartKind)}>
                <option value="Bar">Bar chart</option>
                <option value="Line">Line chart</option>
                <option value="Pie">Pie chart</option>
                <option value="Donut">Donut chart</option>
                <option value="Progress">Progress bars</option>
              </select>
              <button className="btn-compact justify-center" onClick={() => onShowData(dataset)}>View data</button>
              <button className="btn-compact justify-center" onClick={resetChart}>Reset</button>
            </div>
            <ChartVisual dataset={dataset} chartKind={chartKind} showLegend={showLegend} />
          </div>
        </div>
      )}
      {fullscreen && (
        <div className="motion-overlay blur-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="motion-modal max-h-[92vh] w-full max-w-6xl overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title">{dataset.title}</h2>
              <button className="icon-btn" onClick={() => setFullscreen(false)} aria-label="Close expanded chart"><X size={18} /></button>
            </div>
            <ChartVisual dataset={dataset} chartKind={chartKind} showLegend={showLegend} />
          </div>
        </div>
      )}
    </article>
  );
}

function ChartVisual({ dataset, chartKind, showLegend = true }: { dataset: ChartDataset; chartKind: ChartKind; showLegend?: boolean }) {
  if (dataset.rows.length === 0) return <p className="mt-4 text-sm text-[var(--color-text-muted)]">No chart data available.</p>;
  if (chartKind === "Pie" || chartKind === "Donut") return <PieLikeChart dataset={dataset} chartKind={chartKind} showLegend={showLegend} />;
  if (chartKind === "Line") return <LineChartVisual dataset={dataset} showLegend={showLegend} />;

  return (
    <div className="mt-4 space-y-3">
      {dataset.rows.map((row) => (
        <div key={row.label} className="space-y-1" title={`${row.label}: ${row.value}${dataset.suffix || ""} (${row.percent}%)`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-[var(--color-text-muted)]">{row.label}</span>
          </div>
          <ProgressBar value={row.percent} tone={row.status} />
        </div>
      ))}
    </div>
  );
}

function LineChartVisual({ dataset, showLegend }: { dataset: ChartDataset; showLegend: boolean }) {
  const width = 560;
  const height = 220;
  const padding = 28;
  const maxValue = Math.max(1, ...dataset.rows.map((row) => row.value));
  const points = dataset.rows.map((row, index) => {
    const x = dataset.rows.length === 1 ? width / 2 : padding + (index / (dataset.rows.length - 1)) * (width - padding * 2);
    const y = height - padding - (row.value / maxValue) * (height - padding * 2);
    return { x, y, row };
  });

  return (
    <div className="mt-4 min-w-0">
      <svg className="h-auto w-full max-w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={dataset.title}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-border)" strokeWidth="2" />
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--color-secondary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.row.label}-${index}`} cx={point.x} cy={point.y} r="5" fill={chartColor(point.row, index)}>
            <title>{`${point.row.label}: ${point.row.value}${dataset.suffix || ""} (${point.row.percent}%)`}</title>
          </circle>
        ))}
      </svg>
      {showLegend && <ChartLegend rows={dataset.rows} />}
    </div>
  );
}

function PieLikeChart({ dataset, chartKind, showLegend }: { dataset: ChartDataset; chartKind: "Pie" | "Donut"; showLegend: boolean }) {
  const rows = dataset.rows.filter((row) => row.value > 0 || row.percent > 0);
  const gradient = conicGradient(rows.length ? rows : dataset.rows);

  return (
    <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(9rem,180px)_1fr] md:items-center">
      <div className="mx-auto flex aspect-square w-36 items-center justify-center rounded-full border border-[var(--color-border)] shadow-inner sm:w-44" style={{ background: gradient }}>
        {chartKind === "Donut" && (
          <div className="aspect-square w-20 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] sm:w-24" aria-hidden="true" />
        )}
      </div>
      {showLegend && <div className="min-w-0 space-y-2">
        {dataset.rows.map((row, index) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" title={`${row.label}: ${row.value}${dataset.suffix || ""} (${row.percent}%)`}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 flex-none rounded-full" style={{ background: chartColor(row, index) }} />
              <span className="truncate text-[var(--color-text-muted)]">{row.label}</span>
            </span>
          </div>
        ))}
      </div>}
    </div>
  );
}

function ChartLegend({ rows }: { rows: ChartRow[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.map((row, index) => (
        <span key={row.label} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]" title={`${row.label}: ${row.value} (${row.percent}%)`}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColor(row, index) }} />
          {row.label}
        </span>
      ))}
    </div>
  );
}

function GroupedTaskTable({ tasks, groupBy, subgroupBy, onOpenTask, highlightMissing }: { tasks: TrackerTask[]; groupBy: SortKey | "none"; subgroupBy: SortKey | "none"; onOpenTask: (task: TrackerTask) => void; highlightMissing: boolean }) {
  if (groupBy === "none") return <TaskTable tasks={tasks} onOpenTask={onOpenTask} highlightMissing={highlightMissing} />;
  const groups = groupTasks(tasks, groupBy);
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([group, groupTasksRows]) => (
        <Panel key={group}>
          <h2 className="section-title">{labelForField(groupBy)}: {group || "Blank"}</h2>
          {subgroupBy === "none" ? (
            <div className="mt-4"><TaskTable tasks={groupTasksRows} onOpenTask={onOpenTask} highlightMissing={highlightMissing} compact /></div>
          ) : (
            <div className="mt-4 space-y-4">
              {Object.entries(groupTasks(groupTasksRows, subgroupBy)).map(([subgroup, rows]) => (
                <div key={subgroup}>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--color-primary)]">{labelForField(subgroupBy)}: {subgroup || "Blank"}</h3>
                  <TaskTable tasks={rows} onOpenTask={onOpenTask} highlightMissing={highlightMissing} compact />
                </div>
              ))}
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

function TaskTable({ tasks, onOpenTask, highlightMissing, compact = false }: { tasks: TrackerTask[]; onOpenTask: (task: TrackerTask) => void; highlightMissing: boolean; compact?: boolean }) {
  const cellClass = (task: TrackerTask, field: TableField) => `cell-box ${highlightMissing && isMissingTableField(task, field) ? "missing-cell-box" : ""}`;
  const headings = ["City", "Workstream", "Task", "Area", "Owner", "Vendors", "Status", "Progress", "Risk", "Due", "Docs", "Task weight"];

  return (
    <section className={`${compact ? "" : "motion-card rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-soft"}`}>
      {!compact && (
        <div className="flex flex-col gap-2 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Task list</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{tasks.length} matching tasks</p>
          </div>
        </div>
      )}
      <div className="hidden overflow-x-auto lg:block">
        <table className="task-table w-full min-w-[1480px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[8rem]" />
            <col className="w-[15rem]" />
            <col className="w-[21rem]" />
            <col className="w-[9rem]" />
            <col className="w-[10rem]" />
            <col className="w-[12rem]" />
            <col className="w-[9.5rem]" />
            <col className="w-[9rem]" />
            <col className="w-[7rem]" />
            <col className="w-[8rem]" />
            <col className="w-[9rem]" />
            <col className="w-[8.5rem]" />
          </colgroup>
          <thead className="bg-[var(--color-accent-light)] text-xs uppercase text-[var(--color-primary)]">
            <tr>{headings.map((heading) => <th key={heading} className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className={`cursor-pointer border-b border-[var(--color-border)] transition hover:bg-[var(--color-bg)] ${dueRowClass(task)}`} onClick={() => onOpenTask(task)}>
                <td className="px-3 py-3 font-medium text-[var(--color-primary)]"><div className={cellClass(task, "city")}>{task.city || "-"}</div></td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]"><div className={cellClass(task, "workstream")}>{task.workstream || "-"}</div></td>
                <td className="px-3 py-3 text-[var(--color-text)]"><div className={cellClass(task, "taskName")}>{taskDisplayName(task) || "-"}</div></td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]"><div className={cellClass(task, "zoneArea")}>{task.zoneArea || "-"}</div></td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]"><div className={cellClass(task, "taskOwner")}>{task.taskOwner || "-"}</div></td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]"><div className={cellClass(task, "vendors")}>{vendorSummary(task) || "-"}</div></td>
                <td className="px-3 py-3"><div className={cellClass(task, "status")}><StatusBadge status={task.status} /></div></td>
                <td className="px-3 py-3"><div className={`${cellClass(task, "progress")} min-w-28`}><ProgressBar value={task.progress} compact /><span className="text-xs text-[var(--color-text-muted)]">{task.progress}%</span></div></td>
                <td className="px-3 py-3"><div className={cellClass(task, "riskLevel")}><RiskBadge risk={task.riskLevel} /></div></td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]"><div className={cellClass(task, "dueDate")}>{task.dueDate || "-"}</div></td>
                <td className="px-3 py-3"><div className={cellClass(task, "documentStatus")}><DocumentBadge status={task.documentStatus} /></div></td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]"><div className={cellClass(task, "taskWeight")}>{task.taskWeight || "-"}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-2 sm:p-3 lg:hidden">
        {tasks.map((task) => (
          <button key={task.id} className={`motion-card w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left shadow-sm sm:p-4 ${dueRowClass(task)}`} onClick={() => onOpenTask(task)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className={`${cellClass(task, "taskName")} break-words font-semibold text-[var(--color-text)]`}>{taskDisplayName(task) || "-"}</p>
                <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
                  <span className={cellClass(task, "city")}>City: {task.city || "-"}</span>
                  <span className={cellClass(task, "zoneArea")}>Area: {task.zoneArea || "-"}</span>
                  <span className={`${cellClass(task, "workstream")} sm:col-span-2`}>Workstream: {task.workstream || "-"}</span>
                </div>
              </div>
              <div className={`${cellClass(task, "status")} w-fit`}><StatusBadge status={task.status} /></div>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
              <span className={`${cellClass(task, "taskOwner")} break-words`}>Owner: {task.taskOwner || "-"}</span>
              <span className={`${cellClass(task, "vendors")} break-words`}>Vendors: {vendorSummary(task) || "-"}</span>
              <span className={`${cellClass(task, "dueDate")} break-words`}>Due: {task.dueDate || "-"}</span>
              <span className={cellClass(task, "riskLevel")}>Risk: {task.riskLevel || "-"}</span>
              <span className={cellClass(task, "documentStatus")}>Docs: {task.documentStatus || "-"}</span>
              <span className={cellClass(task, "taskWeight")}>Task weight: {task.taskWeight || "-"}</span>
            </div>
            <div className={`mt-3 ${cellClass(task, "progress")}`}><ProgressBar value={task.progress} /><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{task.progress}%</span></div>
          </button>
        ))}
      </div>
      {tasks.length === 0 && <div className="p-12 text-center text-sm text-[var(--color-text-muted)]">No tasks match the selected filters.</div>}
    </section>
  );
}

function useAnimatedClose(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    window.setTimeout(onClose, MOTION_MS);
  };
  return { closing, close };
}

function TaskEditor({ task, cities, onSave, onClose, onDelete }: { task: TrackerTask; cities: string[]; onSave: (task: TrackerTask) => void; onClose: () => void; onDelete: (taskId: string) => void }) {
  const [draft, setDraft] = useState<TrackerTask>(() => normalizeTask(task));
  const [attachmentError, setAttachmentError] = useState("");
  const { closing, close } = useAnimatedClose(onClose);
  useEffect(() => setDraft(normalizeTask(task)), [task]);

  const updateField = <K extends keyof TrackerTask>(key: K, value: TrackerTask[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "taskName") next.taskName = toSentenceCase(String(value));
      if (key === "taskName" || key === "workstream") next.zoneArea = inferArea(String(key === "taskName" ? value : next.taskName), String(key === "workstream" ? value : next.workstream));
      if (key === "status" && !current.progressManuallyEdited) next.progress = value ? STATUS_PROGRESS[value as (typeof STATUSES)[number]] : 0;
      if (key === "progress") next.progressManuallyEdited = true;
      return next;
    });
  };

  const updateVendor = (index: number, key: keyof VendorEntry, value: string) => {
    const vendors = draft.vendors.map((vendor, vendorIndex) => (vendorIndex === index ? { ...vendor, [key]: value } : vendor));
    setDraft({ ...draft, vendors, vendorName: vendors[0]?.name || "", vendorContact: vendors[0]?.contact || "" });
  };

  const addVendor = () => setDraft({ ...draft, vendors: [...draft.vendors, { name: "", contact: "" }] });
  const removeVendor = (index: number) => {
    const vendors = draft.vendors.filter((_, vendorIndex) => vendorIndex !== index);
    setDraft({ ...draft, vendors, vendorName: vendors[0]?.name || "", vendorContact: vendors[0]?.contact || "" });
  };

  const addAttachments = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const invalid = files.find((file) => !ATTACHMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
    if (invalid) {
      setAttachmentError("Only PDF, Word, PowerPoint, and Excel files are allowed.");
      event.target.value = "";
      return;
    }
    const nextFiles: AttachmentReference[] = files.map((file) => ({ name: file.name, type: file.name.split(".").pop()?.toUpperCase() || "FILE", addedAt: new Date().toISOString() }));
    setDraft({ ...draft, attachments: [...draft.attachments, ...nextFiles], documentStatus: "Draft Attached" });
    setAttachmentError("");
    event.target.value = "";
  };

  return (
    <div className={`motion-overlay blur-overlay fixed inset-0 z-50 lg:flex lg:justify-end ${closing ? "motion-overlay-exit" : ""}`}>
      <aside className={`motion-drawer flex h-full w-full flex-col bg-[var(--color-card)] shadow-2xl lg:w-[620px] ${closing ? "motion-drawer-exit" : ""}`}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-3 sm:p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--color-accent)]">Task detail / edit</p>
            <h2 className="mt-1 break-words text-base font-semibold text-[var(--color-primary)] sm:text-lg">{taskDisplayName(draft)}</h2>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close task editor"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {missingFields(draft).length > 0 && <div className="rounded-lg border border-[var(--color-important)] bg-[#7A1F2B]/10 p-3 text-sm text-[var(--color-important)]">Missing required fields: {missingFields(draft).join(", ")}</div>}
          <InputField label="Task name" value={draft.taskName} onChange={(value) => updateField("taskName", value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="City" value={draft.city} options={cities} onChange={(value) => updateField("city", value)} />
            <SelectField label="Workstream" value={draft.workstream} options={WORKSTREAMS.map((item) => item.name)} onChange={(value) => updateField("workstream", value)} />
            <SelectField label="Area" value={draft.zoneArea} options={ZONES} onChange={(value) => updateField("zoneArea", value as TrackerTask["zoneArea"])} />
            <SelectField label="Ownership Type" value={draft.ownershipType} options={OWNERSHIP_TYPES} onChange={(value) => updateField("ownershipType", value as TrackerTask["ownershipType"])} />
            <InputField label="Task Owner / POC" value={draft.taskOwner} onChange={(value) => updateField("taskOwner", value)} />
            <InputField label="Supporting Person" value={draft.supportingPerson} onChange={(value) => updateField("supportingPerson", value)} />
            <SelectField label="Priority" value={draft.priority} options={PRIORITIES} onChange={(value) => updateField("priority", value as TrackerTask["priority"])} />
            <SelectField label="Event Criticality" value={draft.eventCriticality} options={EVENT_CRITICALITIES} onChange={(value) => updateField("eventCriticality", value as TrackerTask["eventCriticality"])} />
            <SelectField label="Status" value={draft.status} options={STATUSES} onChange={(value) => updateField("status", value as TrackerTask["status"])} />
            <SelectField label="Progress %" value={String(draft.progress)} options={PROGRESS_VALUES.map(String)} onChange={(value) => updateField("progress", Number(value))} />
            <InputField label="Due Date" type="date" value={draft.dueDate} onChange={(value) => updateField("dueDate", value)} />
            <InputField label="Target Readiness Date" type="date" value={draft.targetReadinessDate} onChange={(value) => updateField("targetReadinessDate", value)} />
            <InputField label="Dependency" value={draft.dependency} onChange={(value) => updateField("dependency", value)} />
            <SelectField label="Budget Status" value={draft.budgetStatus} options={BUDGET_STATUSES} onChange={(value) => updateField("budgetStatus", value as TrackerTask["budgetStatus"])} />
            <SelectField label="Document Status" value={draft.documentStatus} options={DOCUMENT_STATUSES} onChange={(value) => updateField("documentStatus", value as TrackerTask["documentStatus"])} />
            <SelectField label="Risk Level" value={draft.riskLevel} options={RISK_LEVELS} onChange={(value) => updateField("riskLevel", value as TrackerTask["riskLevel"])} />
            <SelectField label="Task weight" value={draft.taskWeight} options={TASK_WEIGHTS} onChange={(value) => updateField("taskWeight", value as TrackerTask["taskWeight"])} />
            <InputField label="Last Update Date" type="date" value={draft.lastUpdateDate} onChange={(value) => updateField("lastUpdateDate", value)} />
            <InputField label="Next Follow-up Date" type="date" value={draft.nextFollowUpDate} onChange={(value) => updateField("nextFollowUpDate", value)} />
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="mb-3 flex items-center justify-between"><span className="field-label">Vendors</span><button className="icon-btn" onClick={addVendor} aria-label="Add vendor"><Plus size={16} /></button></div>
            {draft.vendors.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No vendor added.</p>
            ) : (
              <div className="space-y-2">
                {draft.vendors.map((vendor, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input className="field" value={vendor.name} onChange={(event) => updateVendor(index, "name", event.target.value)} placeholder="Vendor name" />
                    <input className="field" value={vendor.contact} onChange={(event) => updateVendor(index, "contact", event.target.value)} placeholder="Vendor contact" />
                    <button className="icon-btn justify-self-start text-[var(--color-important)] hover:bg-[#7A1F2B]/10" onClick={() => removeVendor(index)} aria-label={`Remove vendor ${index + 1}`}>
                      <Minus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <TextAreaField label="Blocker Reason" value={draft.blockerReason} onChange={(value) => updateField("blockerReason", value)} />
          <TextAreaField label="Remarks / Latest Update" value={draft.remarksLatestUpdate} onChange={(value) => updateField("remarksLatestUpdate", value)} />
          <InputField label="Document Link / Attachment Reference" value={draft.documentLinkAttachmentReference} onChange={(value) => updateField("documentLinkAttachmentReference", value)} />
          <label className="space-y-1 block">
            <span className="field-label">Upload attachment reference</span>
            <input className="field" type="file" multiple accept={ATTACHMENT_EXTENSIONS.join(",")} onChange={addAttachments} />
          </label>
          {attachmentError && <p className="text-sm text-[var(--color-important)]">{attachmentError}</p>}
          <div className="flex flex-wrap gap-2">
            {draft.attachments.map((file) => <span key={`${file.name}-${file.addedAt}`} className="badge-gold">{file.name}</span>)}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] p-3 sm:flex-row sm:justify-between sm:p-4">
          <button className="btn-secondary justify-center text-[var(--color-important)] hover:bg-[#7A1F2B]/10" onClick={() => onDelete(draft.id)}>Delete</button>
          <div className="grid gap-2 sm:flex"><button className="btn-secondary justify-center sm:flex-none" onClick={close}>Cancel</button><button className="btn-primary justify-center sm:flex-none" onClick={() => onSave({ ...draft, id: draft.id || makeTaskId(draft.city, draft.workstream, draft.taskName) })}>Save Changes</button></div>
        </div>
      </aside>
    </div>
  );
}

function DataModal({ dataset, onClose }: { dataset: ChartDataset; onClose: () => void }) {
  const summaryRows = dataset.rows.map((row) => ({ Label: row.label, Value: row.value, Percent: `${row.percent}%`, Status: row.status || "" }));
  const sourceRows = dataset.sourceRows;
  const { closing, close } = useAnimatedClose(onClose);

  return (
    <div className={`motion-overlay blur-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${closing ? "motion-overlay-exit" : ""}`}>
      <div className={`motion-modal max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl ${closing ? "motion-modal-exit" : ""}`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-3 sm:p-4">
          <h2 className="section-title min-w-0 break-words">{dataset.title} data</h2>
          <button className="icon-btn" onClick={close}><X size={18} /></button>
        </div>
        <div className="max-h-[76vh] overflow-auto p-3 sm:p-4">
          <div className="mb-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <button className="btn-compact" onClick={() => downloadCsv(sourceRows.length ? sourceRows : summaryRows, `${slug(dataset.title)}-source.csv`)}>CSV</button>
            <button className="btn-compact" onClick={() => downloadExcel(sourceRows.length ? sourceRows : summaryRows, `${slug(dataset.title)}-source.xls`)}>Excel</button>
            <button className="btn-compact" onClick={() => openTablePdf(dataset.title, sourceRows.length ? sourceRows : summaryRows)}>PDF</button>
          </div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-primary)]">Chart summary</h3>
          <Table rows={summaryRows} />
          {sourceRows.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-[var(--color-primary)]">Filtered source tasks</h3>
              <Table rows={sourceRows} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartSettingsModal({
  tab,
  charts,
  hiddenIds,
  onChange,
  onClose
}: {
  tab: TabId;
  charts: ChartDataset[];
  hiddenIds: string[];
  onChange: (hiddenIds: string[]) => void;
  onClose: () => void;
}) {
  const toggleChart = (chartId: string) => {
    onChange(hiddenIds.includes(chartId) ? hiddenIds.filter((id) => id !== chartId) : [...hiddenIds, chartId]);
  };
  const { closing, close } = useAnimatedClose(onClose);

  return (
    <div className={`motion-overlay blur-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${closing ? "motion-overlay-exit" : ""}`}>
      <div className={`motion-modal max-h-[92vh] w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl ${closing ? "motion-modal-exit" : ""}`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-3 sm:p-4">
          <div>
            <h2 className="section-title">Chart settings</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{tab}</p>
          </div>
          <button className="icon-btn" onClick={close}><X size={18} /></button>
        </div>
        <div className="max-h-[74vh] space-y-3 overflow-auto p-3 sm:p-4">
          {charts.map((chart) => (
            <label key={chart.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm font-semibold text-[var(--color-primary)]">
              <span className="min-w-0 break-words">{chart.title}</span>
              <input type="checkbox" checked={!hiddenIds.includes(chart.id)} onChange={() => toggleChart(chart.id)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddChartModal({
  tab,
  charts,
  hiddenIds,
  sourceTasks,
  onRestore,
  onAddCustom,
  onClose
}: {
  tab: TabId;
  charts: ChartDataset[];
  hiddenIds: string[];
  sourceTasks: TrackerTask[];
  onRestore: (chartId: string) => void;
  onAddCustom: (definition: CustomChartDefinition) => void;
  onClose: () => void;
}) {
  const { closing, close } = useAnimatedClose(onClose);
  const [mode, setMode] = useState<"Recommended Charts" | "All Charts" | "Custom Chart">("Recommended Charts");
  const [draft, setDraft] = useState<CustomChartDefinition>(() => ({
    id: `custom-chart-${Date.now()}`,
    title: "Custom task chart",
    chartKind: "Bar",
    groupBy: "city",
    subgroupBy: "none",
    metric: "Count",
    sourceColumns: DEFAULT_CUSTOM_COLUMNS,
    filters: EMPTY_FILTERS
  }));
  const recommended = charts.filter((chart) => ["city-wise-progress", "overall-progress", "completed-vs-total", "status-distribution", "workstream-wise-progress", "area-wise-progress"].some((id) => chart.id.includes(id)));
  const recommendedCharts = recommended.length ? recommended : charts.slice(0, 6);
  const visibleSource = useMemo(() => applyFilters(sourceTasks, draft.filters), [draft.filters, sourceTasks]);
  const preview = useMemo(() => buildCustomChart(draft, sourceTasks), [draft, sourceTasks]);
  const isValid = preview.rows.length > 0 && preview.sourceRows.length > 0 && Boolean(draft.title.trim());
  const addExisting = (chartId: string) => {
    onRestore(chartId);
    close();
  };
  const toggleColumn = (column: string) => {
    const next = draft.sourceColumns.includes(column) ? draft.sourceColumns.filter((item) => item !== column) : [...draft.sourceColumns, column];
    setDraft({ ...draft, sourceColumns: next.length ? next : DEFAULT_CUSTOM_COLUMNS });
  };
  const updateFilter = (key: keyof Filters, value: string) => setDraft({ ...draft, filters: { ...draft.filters, [key]: value } });

  return (
    <div className={`motion-overlay blur-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${closing ? "motion-overlay-exit" : ""}`}>
      <div className={`motion-modal max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl ${closing ? "motion-modal-exit" : ""}`}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-3 sm:p-4">
          <div>
            <h2 className="section-title">Add chart</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{tab} / real task data only</p>
          </div>
          <button className="icon-btn" onClick={close}><X size={18} /></button>
        </div>
        <div className="max-h-[78vh] overflow-auto p-3 sm:p-4">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {(["Recommended Charts", "All Charts", "Custom Chart"] as const).map((item) => (
              <button key={item} className={`tab-choice flex-none ${mode === item ? "tab-choice-active" : ""}`} onClick={() => setMode(item)}>{item}</button>
            ))}
          </div>

          {mode !== "Custom Chart" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(mode === "Recommended Charts" ? recommendedCharts : charts).map((chart) => {
                const deleted = hiddenIds.includes(chart.id);
                return (
                  <article key={chart.id} className="motion-card rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-primary)]">{chart.title}</p>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{chart.rows.length} grouped value(s)</p>
                      </div>
                      <BarChart3 className="text-[var(--color-accent)]" size={20} />
                    </div>
                    <div className="mt-3 h-14 space-y-1">
                      {chart.rows.slice(0, 3).map((row) => <ProgressBar key={row.label} value={row.percent} compact tone={row.status} />)}
                    </div>
                    <button className="btn-compact mt-3 w-full" disabled={!deleted} onClick={() => addExisting(chart.id)}>{deleted ? "Add" : "Already visible"}</button>
                  </article>
                );
              })}
            </div>
          )}

          {mode === "Custom Chart" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
              <Panel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField label="Chart title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
                  <SelectField label="Chart type" value={draft.chartKind} options={["Bar", "Line", "Pie", "Donut", "Progress"]} onChange={(value) => setDraft({ ...draft, chartKind: value as ChartKind })} />
                  <SelectField label="Main data field / group by" value={draft.groupBy} options={CUSTOM_FIELDS.map((field) => field.key)} onChange={(value) => setDraft({ ...draft, groupBy: value as CustomField })} />
                  <SelectField label="Optional subgroup" value={draft.subgroupBy} options={["none", ...CUSTOM_FIELDS.map((field) => field.key)]} onChange={(value) => setDraft({ ...draft, subgroupBy: value as CustomField | "none" })} />
                  <SelectField label="Value / metric" value={draft.metric} options={CUSTOM_METRICS} onChange={(value) => setDraft({ ...draft, metric: value as CustomMetric })} />
                  <SelectField label="City filter" value={draft.filters.city} options={unique(sourceTasks.map((task) => task.city))} includeAll onChange={(value) => updateFilter("city", value)} />
                  <SelectField label="Workstream filter" value={draft.filters.workstream} options={unique(sourceTasks.map((task) => task.workstream))} includeAll onChange={(value) => updateFilter("workstream", value)} />
                  <SelectField label="Status filter" value={draft.filters.status} options={STATUSES} includeAll onChange={(value) => updateFilter("status", value)} />
                  <SelectField label="Area filter" value={draft.filters.area} options={ZONES} includeAll onChange={(value) => updateFilter("area", value)} />
                  <SelectField label="Task weight filter" value={draft.filters.taskWeight} options={TASK_WEIGHTS} includeAll onChange={(value) => updateFilter("taskWeight", value)} />
                </div>
                <div className="mt-4">
                  <p className="field-label mb-2">Source table fields</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.keys(tasksToRows(sourceTasks.slice(0, 1))[0] || tasksToRows(generateDefaultTasksForCities(INITIAL_CITIES).slice(0, 1))[0]).map((column) => (
                      <label key={column} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm font-semibold text-[var(--color-primary)]">
                        <input type="checkbox" checked={draft.sourceColumns.includes(column)} onChange={() => toggleColumn(column)} />
                        {column}
                      </label>
                    ))}
                  </div>
                </div>
                {!isValid && <p className="mt-3 rounded-lg border border-[var(--color-important)] bg-[#7A1F2B]/10 p-3 text-sm text-[var(--color-important)]">Choose a title and fields that produce at least one chart row from the current task data.</p>}
                <div className="mt-4 flex justify-end">
                  <button className="btn-primary" disabled={!isValid} onClick={() => onAddCustom({ ...draft, id: `custom-chart-${Date.now()}` })}><Plus size={16} /> Add Custom Chart</button>
                </div>
              </Panel>
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="section-title">Live preview</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">{visibleSource.length} filtered task row(s)</p>
                  </div>
                </div>
                <ChartVisual dataset={preview} chartKind={draft.chartKind} showLegend />
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="motion-card min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-soft sm:p-4">{children}</section>;
}

function SelectField({ label, value, options, onChange, includeAll = false }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; includeAll?: boolean }) {
  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {value === "" && <option value="">Select...</option>}
        {includeAll && <option value="All">All</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function InputField({ label, value, onChange, placeholder = "", type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <input className="field" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 block">
      <span className="field-label">{label}</span>
      <textarea className="field min-h-24" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Table({ rows }: { rows: Array<Record<string, string | number>> }) {
  if (!rows.length) return <p className="p-8 text-center text-sm text-[var(--color-text-muted)]">No data available.</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="bg-[var(--color-accent-light)] text-xs uppercase text-[var(--color-primary)]">
          <tr>{keys.map((key) => <th key={key} className="border-b border-[var(--color-border)] px-3 py-2">{key}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr key={index} className="border-b border-[var(--color-border)]">{keys.map((key) => <td key={key} className="px-3 py-2 text-[var(--color-text-muted)]">{row[key]}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value, compact = false, tone }: { value: number; compact?: boolean; tone?: ChartRow["status"] }) {
  const color = tone === "critical" ? "bg-[var(--color-important)]" : tone === "warning" ? "bg-[var(--color-accent)]" : tone === "muted" ? "bg-[#9CA3AF]" : "bg-[var(--color-secondary)]";
  return <div className={`overflow-hidden rounded-full bg-[var(--color-accent-light)] ${compact ? "h-2" : "h-2.5"}`}><div className={`h-full rounded-full ${color}`} style={{ width: `${clamp(value, 0, 100)}%` }} /></div>;
}

function chartSvg(dataset: ChartDataset, chartKind: ChartKind) {
  const rows = dataset.rows;
  const width = 900;
  const chartRows = rows.length ? rows : [{ label: "No data", value: 1, percent: 100, status: "muted" as const }];
  const height = chartKind === "Bar" || chartKind === "Progress" ? Math.max(520, 130 + chartRows.length * 36) : 520;
  const bars = chartRows.map((row, index) => {
    const y = 86 + index * 34;
    const barWidth = Math.max(4, row.percent * 5.8);
    return `<text x="40" y="${y + 14}" font-size="14" fill="#6B7280">${escapeHtml(row.label)}</text><rect x="270" y="${y}" width="${barWidth}" height="18" rx="9" fill="${cssColor(chartColor(row, index))}"><title>${escapeHtml(`${row.label}: ${row.value}${dataset.suffix || ""} (${row.percent}%)`)}</title></rect>`;
  }).join("");
  const legend = chartRows.map((row, index) => `<circle cx="${40 + (index % 4) * 190}" cy="${height - 44 + Math.floor(index / 4) * 22}" r="6" fill="${cssColor(chartColor(row, index))}"/><text x="${52 + (index % 4) * 190}" y="${height - 39 + Math.floor(index / 4) * 22}" font-size="12" fill="#6B7280">${escapeHtml(row.label)}</text>`).join("");
  const pie = `${pieSlicesSvg(chartRows, 450, 250, 130)}${chartKind === "Donut" ? '<circle cx="450" cy="250" r="72" fill="#FFFFFF" stroke="#E8DDC5"/>' : ""}${legend}`;
  const linePoints = chartRows.map((row, index) => `${80 + (index / Math.max(1, chartRows.length - 1)) * 740},${410 - row.percent * 3}`).join(" ");
  const line = `<polyline points="${linePoints}" fill="none" stroke="#2E7D5B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${chartRows.map((row, index) => `<circle cx="${80 + (index / Math.max(1, chartRows.length - 1)) * 740}" cy="${410 - row.percent * 3}" r="7" fill="${cssColor(chartColor(row, index))}"/>`).join("")}${legend}`;
  const body = chartKind === "Pie" || chartKind === "Donut" ? pie : chartKind === "Line" ? line : bars;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#FAF7EF"/><rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="16" fill="#FFFFFF" stroke="#E8DDC5"/><text x="40" y="58" font-family="Arial" font-size="24" font-weight="700" fill="#0B4F3A">${escapeHtml(dataset.title)}</text>${body}</svg>`;
}

function downloadChartVisual(dataset: ChartDataset, chartKind: ChartKind, format: "png" | "pdf") {
  const svg = chartSvg(dataset, chartKind);
  if (format === "pdf") {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(dataset.title)}</title><style>@page{size:A4 portrait;margin:18mm}body{background:#FAF7EF;font-family:Arial,sans-serif}svg{max-width:100%;height:auto}</style></head><body>${svg}<script>window.print()</script></body></html>`);
    win.document.close();
    return;
  }
  const image = new Image();
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    const svgHeight = Number(svg.match(/height="(\d+)"/)?.[1] || 520);
    canvas.width = 900;
    canvas.height = svgHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(svgUrl);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${slug(dataset.title)}.png`;
    link.click();
  };
  image.src = svgUrl;
}

function StatusBadge({ status }: { status: TrackerTask["status"] }) {
  const className = status === "Completed" || status === "Tested" || status === "Not Required"
    ? "bg-[var(--color-primary)] text-white"
    : status === "Blocked"
      ? "bg-[var(--color-important)] text-white"
      : status === "In Progress" || status === "Under Review" || status === "Ready for Testing"
        ? "bg-[var(--color-accent)] text-[var(--color-primary)]"
        : status === "Not Started"
          ? "bg-[#F4F1EA] text-[var(--color-text-muted)]"
          : "bg-[var(--color-accent-light)] text-[var(--color-text)]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status || "-"}</span>;
}

function RiskBadge({ risk }: { risk: TrackerTask["riskLevel"] }) {
  const className = risk === "High" ? "bg-[var(--color-important)] text-white" : risk === "Medium" ? "bg-[var(--color-accent)] text-[var(--color-primary)]" : "bg-[var(--color-primary)] text-white";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{risk || "-"}</span>;
}

function DocumentBadge({ status }: { status: TrackerTask["documentStatus"] }) {
  const className = status === "Final Attached" ? "bg-[var(--color-primary)] text-white" : status === "Draft Attached" ? "bg-[var(--color-secondary)] text-white" : "bg-[var(--color-accent-light)] text-[var(--color-text)]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status || "-"}</span>;
}

const MASTER_FIELDS: SortKey[] = ["city", "workstream", "taskName", "zoneArea", "taskOwner", "status", "progress", "dueDate", "riskLevel", "taskWeight"];

function normalizeTasks(rows: TrackerTask[]) {
  return rows.map(normalizeTask);
}

function normalizeTask(task: TrackerTask): TrackerTask {
  const vendors = (task.vendors?.length ? task.vendors : [{ name: task.vendorName || "", contact: task.vendorContact || "" }])
    .map((vendor) => ({ name: vendor.name || "", contact: vendor.contact || "" }))
    .filter((vendor) => vendor.name.trim() || vendor.contact.trim());
  const roundedProgress = nearestProgress(task.progress);
  return {
    ...task,
    taskName: toSentenceCase(stripRepeatedTaskWords(task.taskName, task)),
    progress: roundedProgress,
    taskWeight: task.taskWeight || "",
    vendors,
    vendorName: vendors[0]?.name || "",
    vendorContact: vendors[0]?.contact || "",
    attachments: task.attachments || []
  };
}

function stripRepeatedTaskWords(name: string, task: Pick<TrackerTask, "city" | "workstream" | "zoneArea" | "status" | "taskOwner">) {
  let value = name;
  [task.city, task.workstream, task.zoneArea, task.status, task.taskOwner].filter(Boolean).forEach((part) => {
    value = value.replace(new RegExp(escapeRegExp(part), "gi"), "").replace(/\s+-\s+/g, " ");
  });
  return value.replace(/\s+/g, " ").trim();
}

function nearestProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / 10) * 10));
}

function applyFilters(rows: TrackerTask[], filters: Filters) {
  const search = filters.search.trim().toLowerCase();
  return rows.filter((task) => {
    const vendorMatch = filters.vendor === "All" || task.vendors.some((vendor) => vendor.name === filters.vendor);
    const pocMatch = filters.poc === "All" || task.taskOwner === filters.poc || task.supportingPerson === filters.poc;
    const dateMatch = (!filters.dueFrom || task.dueDate >= filters.dueFrom) && (!filters.dueTo || task.dueDate <= filters.dueTo);
    const searchMatch = !search || [task.taskName, task.city, task.workstream, task.zoneArea, task.taskOwner, task.supportingPerson, vendorSummary(task), task.remarksLatestUpdate].join(" ").toLowerCase().includes(search);
    return (
      (filters.city === "All" || task.city === filters.city) &&
      (filters.workstream === "All" || task.workstream === filters.workstream) &&
      (filters.status === "All" || task.status === filters.status) &&
      (filters.area === "All" || task.zoneArea === filters.area) &&
      (filters.progress === "All" || task.progress === Number(filters.progress)) &&
      (filters.priority === "All" || task.priority === filters.priority) &&
      (filters.riskLevel === "All" || task.riskLevel === filters.riskLevel) &&
      (filters.taskWeight === "All" || task.taskWeight === filters.taskWeight) &&
      (filters.documentStatus === "All" || task.documentStatus === filters.documentStatus) &&
      vendorMatch &&
      pocMatch &&
      dateMatch &&
      searchMatch
    );
  });
}

function getCityStats(rows: TrackerTask[], cities: string[]) {
  return cities.map((city) => {
    const cityRows = rows.filter((task) => task.city === city);
    const total = cityRows.length || 1;
    const completion = progressScore(cityRows);
    const delayed = cityRows.filter((task) => task.status === "Blocked" || isOverdue(task)).length;
    return {
      city,
      total: cityRows.length,
      completed: cityRows.filter(isClosed).length,
      delayed,
      completion,
      health: delayed > 0 || completion < 40 ? "Critical" : completion < 75 ? "Attention Needed" : "Good"
    };
  });
}

function buildDashboardCharts(rows: TrackerTask[], cityStats: ReturnType<typeof getCityStats>): ChartDataset[] {
  const total = Math.max(rows.length, 1);
  const completed = rows.filter(isClosed).length;
  const pending = rows.filter((task) => !isClosed(task) && task.status !== "Blocked").length;
  const delayed = rows.filter((task) => task.status === "Blocked" || isOverdue(task)).length;
  const progress = progressScore(rows);
  return compactCharts([
    makeChart("overall-progress", "Overall progress", [{ label: "Progress", value: progress, percent: progress, status: progress >= 80 ? "good" : progress >= 40 ? "warning" : "critical" }], rows, "Progress", "%"),
    makeChart("completed-vs-total", "Completed tasks vs total tasks", [{ label: "Completed", value: completed, percent: Math.round((completed / total) * 100), status: "good" }, { label: "Remaining", value: Math.max(0, rows.length - completed), percent: Math.round(((rows.length - completed) / total) * 100), status: "warning" }], rows, "Donut"),
    makeChart("city-wise-progress", "City-wise progress", cityStats.map((city) => ({ label: city.city, value: city.completion, percent: city.completion, status: city.health === "Critical" ? "critical" : city.health === "Good" ? "good" : "warning" })), rows, "Bar", "%"),
    ...buildTaskCharts(rows, "dashboard"),
    makeChart("task-completion", "Task completion", [{ label: "Completed", value: completed, percent: Math.round((completed / total) * 100), status: "good" }, { label: "Pending", value: pending, percent: Math.round((pending / total) * 100), status: "warning" }, { label: "Delayed", value: delayed, percent: Math.round((delayed / total) * 100), status: "critical" }], rows, "Donut")
  ]);
}

function buildCompareCharts(rows: TrackerTask[], cities: string[]): ChartDataset[] {
  const selected = rows.filter((task) => cities.includes(task.city));
  const stats = getCityStats(selected, cities);
  return compactCharts([
    makeChart("compare-overall-progress", "Overall progress by city", stats.map((city) => ({ label: city.city, value: city.completion, percent: city.completion, status: city.health === "Critical" ? "critical" : city.health === "Good" ? "good" : "warning" })), selected, "Bar", "%"),
    makeChart("compare-task-completion", "Task completion by city", stats.map((city) => ({ label: city.city, value: city.completed, percent: city.total ? Math.round((city.completed / city.total) * 100) : 0, status: "good" })), selected, "Bar"),
    makeChart("compare-delayed-items", "Delayed items by city", stats.map((city) => ({ label: city.city, value: city.delayed, percent: city.total ? Math.round((city.delayed / city.total) * 100) : 0, status: city.delayed ? "critical" : "good" })), selected, "Bar"),
    makeChart("compare-status-distribution", "Status distribution", distribution(selected, "status"), selected, "Donut"),
    makeChart("compare-workstream-progress", "Workstream-wise progress", WORKSTREAMS.map((workstream) => progressRow(workstream.name, selected.filter((task) => task.workstream === workstream.name))), selected, "Bar", "%")
  ]);
}

function getAreaRows(rows: TrackerTask[]) {
  return ZONES.map((area) => {
    const areaTasks = rows.filter((task) => task.zoneArea === area);
    const progress = taskWeightProgress(areaTasks);
    const overdue = areaTasks.filter(isOverdue).length;
    return {
      area,
      tasks: areaTasks.length,
      workstreams: new Set(areaTasks.map((task) => task.workstream)).size,
      progress,
      dueSoon: areaTasks.filter(isDueSoon).length,
      overdue,
      health: overdue > 0 || progress < 40 ? "Critical" : progress < 75 ? "Attention Needed" : "Good"
    };
  });
}

function buildAreaCharts(rows: ReturnType<typeof getAreaRows>, sourceTasks: TrackerTask[]): ChartDataset[] {
  return compactCharts([
    makeChart("area-wise-progress", "Area-wise progress", rows.map((row) => ({ label: row.area, value: row.progress, percent: row.progress, status: row.health === "Critical" ? "critical" : row.health === "Good" ? "good" : "warning" })), sourceTasks, "Bar", "%"),
    makeChart("area-wise-tasks", "Area-wise tasks", rows.map((row) => ({ label: row.area, value: row.tasks, percent: Math.min(100, row.tasks * 8), status: "muted" })), sourceTasks, "Bar"),
    makeChart("area-workstream-coverage", "Area-wise workstream coverage", rows.map((row) => ({ label: row.area, value: row.workstreams, percent: Math.min(100, row.workstreams * 8), status: row.workstreams ? "good" : "muted" })), sourceTasks, "Bar")
  ]);
}

function buildTaskCharts(rows: TrackerTask[], prefix: string): ChartDataset[] {
  return compactCharts([
    makeChart(`${prefix}-status-distribution`, "Status distribution", distribution(rows, "status"), rows, "Donut"),
    makeChart(`${prefix}-workstream-wise-tasks`, "Workstream-wise tasks", distribution(rows, "workstream"), rows, "Bar"),
    makeChart(`${prefix}-workstream-wise-progress`, "Workstream-wise progress", WORKSTREAMS.map((workstream) => progressRow(workstream.name, rows.filter((task) => task.workstream === workstream.name))), rows, "Bar", "%"),
    makeChart(`${prefix}-area-wise-progress`, "Area-wise progress", ZONES.map((area) => areaProgressRow(area, rows.filter((task) => task.zoneArea === area))), rows, "Bar", "%"),
    makeChart(`${prefix}-priority-distribution`, "Priority distribution", distribution(rows, "priority"), rows, "Donut"),
    makeChart(`${prefix}-risk-distribution`, "Risk distribution", distribution(rows, "riskLevel"), rows, "Donut"),
    makeChart(`${prefix}-document-status`, "Document status distribution", distribution(rows, "documentStatus"), rows, "Donut")
  ]);
}

function distribution<T extends keyof TrackerTask>(rows: TrackerTask[], key: T): ChartRow[] {
  const total = Math.max(rows.length, 1);
  const counts = rows.reduce<Record<string, number>>((acc, task) => {
    const value = String(task[key] || "Blank");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([label, value]) => ({ label, value, percent: Math.round((value / total) * 100), status: chartStatus(label) }));
}

function makeChart(id: string, title: string, rows: ChartRow[], sourceTasks: TrackerTask[], defaultKind: ChartKind, suffix?: string): ChartDataset {
  return {
    id,
    title,
    rows,
    sourceRows: tasksToRows(sourceTasks),
    defaultKind,
    suffix
  };
}

function buildCustomChart(definition: CustomChartDefinition, sourceTasks: TrackerTask[]): ChartDataset {
  const filtered = applyFilters(sourceTasks, definition.filters);
  const groups = groupTasksByCustomField(filtered, definition.groupBy, definition.subgroupBy);
  const rows = Object.entries(groups).map(([label, groupRows]) => metricRow(label, groupRows, definition.metric, filtered.length));
  const suffix = definition.metric.includes("progress") ? "%" : undefined;
  return {
    id: definition.id,
    title: definition.title || "Custom task chart",
    rows,
    sourceRows: selectSourceColumns(filtered, definition.sourceColumns),
    sourceColumns: definition.sourceColumns,
    defaultKind: definition.chartKind,
    suffix
  };
}

function groupTasksByCustomField(rows: TrackerTask[], groupBy: CustomField, subgroupBy: CustomField | "none") {
  return rows.reduce<Record<string, TrackerTask[]>>((acc, task) => {
    const primary = customFieldValue(task, groupBy);
    const secondary = subgroupBy === "none" ? "" : ` / ${customFieldValue(task, subgroupBy)}`;
    const label = `${primary}${secondary}` || "Blank";
    acc[label] = acc[label] || [];
    acc[label].push(task);
    return acc;
  }, {});
}

function metricRow(label: string, rows: TrackerTask[], metric: CustomMetric, totalRows: number): ChartRow {
  const total = Math.max(totalRows, 1);
  if (metric === "Progress") return progressRow(label, rows);
  if (metric === "Completed tasks") {
    const completed = rows.filter(isClosed).length;
    return { label, value: completed, percent: Math.round((completed / Math.max(rows.length, 1)) * 100), status: completed === rows.length && rows.length ? "good" : completed ? "warning" : "muted" };
  }
  return { label, value: rows.length, percent: Math.round((rows.length / total) * 100), status: chartStatus(label) };
}

function customFieldValue(task: TrackerTask, field: CustomField) {
  if (field === "zoneArea") return task.zoneArea || "Blank";
  if (field === "taskWeight") return task.taskWeight || "Blank";
  if (field === "eventCriticality") return task.eventCriticality || "Blank";
  return String(task[field] || "Blank");
}

function selectSourceColumns(tasks: TrackerTask[], columns: string[]) {
  return tasksToRows(tasks).map((row) => {
    const selected: Record<string, string | number> = {};
    columns.forEach((column) => {
      selected[column] = row[column] ?? "";
    });
    return selected;
  });
}

function compactCharts(charts: ChartDataset[]) {
  return charts.filter((chart) => chart.sourceRows.length > 0 && chart.rows.length > 0);
}

function chartsForTab(tab: TabId, charts: Partial<Record<TabId, ChartDataset[]>>) {
  return charts[tab] || [];
}

function orderCharts(charts: ChartDataset[], order: string[]) {
  if (!order.length) return charts;
  const byId = new Map(charts.map((chart) => [chart.id, chart]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as ChartDataset[];
  const unseen = charts.filter((chart) => !order.includes(chart.id));
  return [...ordered, ...unseen];
}

function moveChartId(sourceId: string, targetId: string, currentOrder: string[], availableIds: string[]) {
  const merged = [...currentOrder, ...availableIds.filter((id) => !currentOrder.includes(id))].filter((id) => availableIds.includes(id));
  const sourceIndex = merged.indexOf(sourceId);
  const targetIndex = merged.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return merged;
  const next = [...merged];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function progressRow(label: string, rows: TrackerTask[]): ChartRow {
  const value = progressScore(rows);
  return { label, value, percent: value, status: value >= 80 ? "good" : value >= 40 ? "warning" : "critical" };
}

function areaProgressRow(label: string, rows: TrackerTask[]): ChartRow {
  const value = taskWeightProgress(rows);
  return { label, value, percent: value, status: value >= 80 ? "good" : value >= 40 ? "warning" : "critical" };
}

function averageProgress(rows: TrackerTask[]) {
  return rows.length ? Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / rows.length) : 0;
}

function progressScore(rows: TrackerTask[]) {
  return areaWeightageProgress(rows);
}

function taskWeightProgress(rows: TrackerTask[]) {
  const taskWeightRows = rows
    .map((task) => ({ progress: task.progress, weight: taskWeightValue(task.taskWeight) }))
    .filter((item) => item.weight > 0);
  const totalWeight = taskWeightRows.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return averageProgress(rows);
  return Math.round(taskWeightRows.reduce((sum, item) => sum + item.progress * item.weight, 0) / totalWeight);
}

function areaWeightageProgress(rows: TrackerTask[]) {
  return Math.round(areaWeightageRows(rows).reduce((sum, row) => sum + row.value, 0));
}

function areaWeightageRows(rows: TrackerTask[]): ChartRow[] {
  return Object.entries(AREA_WEIGHTAGE_GROUPS).map(([group, config]) => {
    const groupRows = rows.filter((task) => config.areas.includes(task.zoneArea));
    const groupProgress = taskWeightProgress(groupRows);
    const contribution = Math.round((groupProgress * config.points) / AREA_WEIGHTAGE_TOTAL);
    return {
      label: `${group} (${config.points} pts)`,
      value: contribution,
      percent: contribution,
      status: contribution >= config.points * 0.8 ? "good" : contribution >= config.points * 0.4 ? "warning" : "critical"
    };
  });
}

function taskWeightValue(weight: TrackerTask["taskWeight"]) {
  if (weight === "Very high") return 4;
  if (weight === "High") return 3;
  if (weight === "Medium") return 2;
  if (weight === "Low") return 1;
  return 0;
}

function missingFields(task: TrackerTask) {
  const checks: Array<[string, boolean]> = [
    ["Task name", Boolean(task.taskName)],
    ["City", Boolean(task.city)],
    ["Area", Boolean(task.zoneArea)],
    ["Ownership Type", Boolean(task.ownershipType)],
    ["Task Owner / POC", Boolean(task.taskOwner)],
    ["Supporting Person", Boolean(task.supportingPerson)],
    ["Priority", Boolean(task.priority)],
    ["Event Criticality", Boolean(task.eventCriticality)],
    ["Status", Boolean(task.status)],
    ["Progress %", task.progress !== null && task.progress !== undefined && PROGRESS_VALUES.some((value) => value === nearestProgress(task.progress))],
    ["Due Date", Boolean(task.dueDate)],
    ["Budget Status", Boolean(task.budgetStatus)],
    ["Task weight", Boolean(task.taskWeight)]
  ];
  return checks.filter(([, ok]) => !ok).map(([label]) => label);
}

function isMissingTableField(task: TrackerTask, field: TableField) {
  switch (field) {
    case "city":
      return isMissingValue(task.city);
    case "workstream":
      return isMissingValue(task.workstream);
    case "taskName":
      return isMissingValue(task.taskName);
    case "zoneArea":
      return isMissingValue(task.zoneArea);
    case "taskOwner":
      return isMissingValue(task.taskOwner);
    case "vendors":
      return !task.vendors?.some((vendor) => !isMissingValue(vendor.name) || !isMissingValue(vendor.contact));
    case "status":
      return isMissingValue(task.status);
    case "progress":
      return task.progress === null || task.progress === undefined || Number.isNaN(Number(task.progress)) || !PROGRESS_VALUES.some((value) => value === nearestProgress(task.progress));
    case "riskLevel":
      return isMissingValue(task.riskLevel);
    case "dueDate":
      return isMissingValue(task.dueDate);
    case "documentStatus":
      return task.documentStatus === "Not Attached" || isMissingValue(task.documentStatus) || (!task.documentLinkAttachmentReference && !task.attachments.length);
    case "taskWeight":
      return isMissingValue(task.taskWeight);
    default:
      return false;
  }
}

function isMissingValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return !value.trim() || value.trim() === "-";
  return false;
}

function sortTasks(rows: TrackerTask[], key: SortKey, asc: boolean) {
  return [...rows].sort((a, b) => {
    const left = String(a[key] ?? "");
    const right = String(b[key] ?? "");
    const result = key === "progress" ? Number(a.progress) - Number(b.progress) : left.localeCompare(right);
    return asc ? result : -result;
  });
}

function groupTasks(rows: TrackerTask[], key: SortKey) {
  return rows.reduce<Record<string, TrackerTask[]>>((acc, task) => {
    const value = String(task[key] || "Blank");
    acc[value] = acc[value] || [];
    acc[value].push(task);
    return acc;
  }, {});
}

function groupByValue<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const value = String(row[key] || "Blank");
    acc[value] = acc[value] || [];
    acc[value].push(row);
    return acc;
  }, {});
}

function createDefaultContacts(cities: string[]): Contact[] {
  return cities.map((city) => ({ ...blankContact(city), id: `contact-${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: `${city} IT POC`, role: "City IT SPOC", workstreamHandled: "City IT Coordination & Governance", notes: "Replace with actual POC details." }));
}

function blankContact(city: string): Contact {
  return { id: `contact-${Date.now()}`, name: "", city, phone: "", email: "", role: "", workstreamHandled: WORKSTREAMS[0].name, customResponsibility: "", notes: "" };
}

function createActivity(action: string, item: string, details: string): ActivityEntry {
  return { id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`, at: new Date().toISOString(), user: CURRENT_USER, action, item, details };
}

function tasksToRows(rows: TrackerTask[]): Array<Record<string, string | number>> {
  return rows.map((task) => ({
    City: task.city,
    Area: task.zoneArea,
    Workstream: task.workstream,
    "Task Name": task.taskName,
    "Ownership Type": task.ownershipType,
    "Task Owner": task.taskOwner,
    "Supporting Person": task.supportingPerson,
    Priority: task.priority,
    "Event Criticality": task.eventCriticality,
    Status: task.status,
    "Progress %": task.progress,
    "Due Date": task.dueDate,
    "Target Readiness Date": task.targetReadinessDate,
    Dependency: task.dependency,
    Vendors: vendorSummary(task),
    "Budget Status": task.budgetStatus,
    "Document Status": task.documentStatus,
    "Risk Level": task.riskLevel,
    "Task Weight": task.taskWeight,
    "Blocker Reason": task.blockerReason,
    "Last Update Date": task.lastUpdateDate,
    "Next Follow-up Date": task.nextFollowUpDate,
    Remarks: task.remarksLatestUpdate,
    "Document Link / Attachment Reference": task.documentLinkAttachmentReference,
    Attachments: task.attachments.map((file) => file.name).join("; ")
  }));
}

function rowToTask(row: Record<string, string>): TrackerTask | null {
  const get = (label: string) => row[label] ?? row[toCamelKey(label)] ?? "";
  const city = get("City") || "Imported City";
  const workstream = get("Workstream") || WORKSTREAMS[0].name;
  const taskName = toSentenceCase(get("Task Name") || "Imported readiness task");
  const now = new Date().toISOString();
  const status = optionOrDefault(get("Status"), STATUSES, "Not Started");
  const progress = nearestProgress(Number(get("Progress %") || STATUS_PROGRESS[status]));
  const vendors = get("Vendors").split(";").map((name) => ({ name: name.trim(), contact: "" })).filter((vendor) => vendor.name);
  const fallbackVendor = { name: get("Vendor Name"), contact: get("Vendor Contact") };
  const importedVendors = vendors.length ? vendors : (fallbackVendor.name || fallbackVendor.contact ? [fallbackVendor] : []);
  return normalizeTask({
    id: get("Task ID") || makeTaskId(city, workstream, taskName),
    city,
    zoneArea: optionOrDefault(get("Zone / Area") || get("Area"), ZONES, inferArea(taskName, workstream)),
    workstream,
    taskName,
    ownershipType: optionOrDefault(get("Ownership Type"), OWNERSHIP_TYPES, "Joint"),
    taskOwner: get("Task Owner"),
    supportingPerson: get("Supporting Person"),
    priority: optionOrDefault(get("Priority"), PRIORITIES, "Medium"),
    eventCriticality: optionOrDefault(get("Event Criticality"), EVENT_CRITICALITIES, "Operations Critical"),
    status,
    progress,
    dueDate: get("Due Date"),
    targetReadinessDate: get("Target Readiness Date"),
    dependency: get("Dependency"),
    vendorName: importedVendors[0]?.name || "",
    vendorContact: importedVendors[0]?.contact || "",
    vendors: importedVendors,
    budgetStatus: optionOrDefault(get("Budget Status"), BUDGET_STATUSES, "Not Required"),
    documentStatus: optionOrDefault(get("Document Status"), DOCUMENT_STATUSES, "Not Attached"),
    riskLevel: optionOrDefault(get("Risk Level"), RISK_LEVELS, "Medium"),
    taskWeight: optionOrDefault(get("Task Weight"), TASK_WEIGHTS, ""),
    blockerReason: get("Blocker Reason"),
    lastUpdateDate: get("Last Update Date"),
    nextFollowUpDate: get("Next Follow-up Date"),
    remarksLatestUpdate: get("Remarks") || get("Remarks / Latest Update"),
    documentLinkAttachmentReference: get("Document Link / Attachment Reference"),
    attachments: [],
    progressManuallyEdited: true,
    createdAt: get("Created At") || now,
    updatedAt: now
  });
}

function downloadCsv(rows: Array<Record<string, string | number>>, filename: string) {
  const keys = Object.keys(rows[0] || {});
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => escapeCsv(String(row[key] ?? ""))).join(","))].join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8");
}

function downloadExcel(rows: Array<Record<string, string | number>>, filename: string) {
  const keys = Object.keys(rows[0] || {});
  const html = `<table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  downloadBlob(html, filename, "application/vnd.ms-excel");
}

function downloadExcelReport(rows: TrackerTask[], charts: ChartDataset[], format: ExcelReportFormat, filename: string) {
  const tableRows = tasksToRows(rows);
  const keys = Object.keys(tableRows[0] || {});
  const chartTables = format === "Table with chart summaries"
    ? charts.map((chart) => {
      const chartRows: Array<Record<string, string | number>> = chart.rows.map((row) => ({ Label: row.label, Value: row.value, Percent: `${row.percent}%`, Status: row.status || "" }));
      const chartKeys = Object.keys(chartRows[0] || {});
      return `<h2>${escapeHtml(chart.title)}</h2><table><thead><tr>${chartKeys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${chartRows.map((row) => `<tr>${chartKeys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }).join("")
    : "";
  const taskTable = `<h2>Task table</h2><table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const html = `<html><head><meta charset="utf-8" /><style>body{font-family:Arial,sans-serif;color:#1F2933}h1,h2{color:#0B4F3A}table{border-collapse:collapse;margin-bottom:18px}th{background:#F3E7C3;color:#0B4F3A}td,th{border:1px solid #E8DDC5;padding:6px;vertical-align:top}</style></head><body><h1>ASHARA MUBARAKAH IT / Event Preparation Report</h1>${chartTables}${taskTable}</body></html>`;
  downloadBlob(html, filename, "application/vnd.ms-excel");
}

function openPdfReport(rows: TrackerTask[], charts: ChartDataset[], format: ReportFormat) {
  const tableRows = tasksToRows(rows).slice(0, 200);
  const chartHtml = charts.map((chart) => `<section class="card">${chartSvg(chart, chart.defaultKind)}</section>`).join("");
  const keys = Object.keys(tableRows[0] || {});
  const tableHtml = `<section class="card"><h2>Task table</h2><table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>ASHARA MUBARAKAH IT Report</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial,sans-serif;background:#FAF7EF;color:#1F2933}h1,h2{color:#0B4F3A}.card{background:#fff;border:1px solid #E8DDC5;border-radius:8px;padding:14px;margin:0 0 14px}.bar{position:relative;margin:10px 0;padding-bottom:8px;border-bottom:1px solid #E8DDC5}.bar span{display:inline-block;width:70%}.bar strong{float:right;color:#0B4F3A}.bar i{display:block;height:7px;background:#2E7D5B;border-radius:99px;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#F3E7C3;color:#0B4F3A}td,th{border:1px solid #E8DDC5;padding:5px;vertical-align:top}</style></head><body><h1>ASHARA MUBARAKAH IT / Event Preparation Report</h1><p>${new Date().toLocaleString()}</p>${format !== "Tables only" ? chartHtml : ""}${format !== "Charts only" ? tableHtml : ""}<script>window.print()</script></body></html>`);
  win.document.close();
}

function openTablePdf(title: string, rows: Array<Record<string, string | number>>) {
  const keys = Object.keys(rows[0] || {});
  const tableHtml = `<table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial,sans-serif;background:#FAF7EF;color:#1F2933}h1{color:#0B4F3A}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#F3E7C3;color:#0B4F3A}td,th{border:1px solid #E8DDC5;padding:5px;vertical-align:top}</style></head><body><h1>${escapeHtml(title)}</h1>${tableHtml}<script>window.print()</script></body></html>`);
  win.document.close();
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
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else current += char;
  }
  row.push(current);
  rows.push(row);
  const [headerRow, ...dataRows] = rows.filter((item) => item.some((cell) => cell.trim()));
  if (!headerRow) return [];
  return dataRows.map((dataRow) => Object.fromEntries(headerRow.map((heading, index) => [heading.trim(), dataRow[index]?.trim() ?? ""])));
}

function isClosed(task: TrackerTask) {
  return CLOSED_STATUSES.has(task.status);
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isOverdue(task: TrackerTask) {
  return Boolean(task.dueDate) && new Date(`${task.dueDate}T00:00:00`) < todayStart() && !isClosed(task);
}

function isDueSoon(task: TrackerTask) {
  if (!task.dueDate || isClosed(task)) return false;
  const diff = new Date(`${task.dueDate}T00:00:00`).getTime() - todayStart().getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
}

function dueRowClass(task: TrackerTask) {
  if (isOverdue(task)) return "bg-[#7A1F2B]/10";
  if (isDueSoon(task)) return "bg-[var(--color-accent-light)]";
  return "";
}

function vendorSummary(task: TrackerTask) {
  return task.vendors.map((vendor) => [vendor.name, vendor.contact].filter(Boolean).join(" / ")).filter(Boolean).join("; ");
}

function toneClass(tone: string) {
  if (tone === "good") return "bg-[var(--color-primary)] text-white";
  if (tone === "warning") return "bg-[var(--color-accent)] text-[var(--color-primary)]";
  if (tone === "critical") return "bg-[var(--color-important)] text-white";
  return "bg-[#F4F1EA] text-[var(--color-text-muted)]";
}

function chartColor(row: ChartRow, index: number) {
  if (row.status === "good") return "var(--color-secondary)";
  if (row.status === "warning") return "var(--color-accent)";
  if (row.status === "critical") return "var(--color-important)";
  if (row.status === "muted") return "#9CA3AF";
  const palette = ["var(--color-primary)", "var(--color-secondary)", "var(--color-accent)", "var(--color-important)", "#9CA3AF"];
  return palette[index % palette.length];
}

function pieSlicesSvg(rows: ChartRow[], cx: number, cy: number, radius: number) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value || row.percent), 0);
  if (!rows.length || total <= 0) return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#9CA3AF"/>`;
  if (rows.length === 1) return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${cssColor(chartColor(rows[0], 0))}"><title>${escapeHtml(`${rows[0].label}: ${rows[0].value} (${rows[0].percent}%)`)}</title></circle>`;
  let startAngle = -90;
  return rows.map((row, index) => {
    const sliceValue = Math.max(0, row.value || row.percent);
    const endAngle = startAngle + (sliceValue / total) * 360;
    const path = describePieSlice(cx, cy, radius, startAngle, endAngle);
    startAngle = endAngle;
    return `<path d="${path}" fill="${cssColor(chartColor(row, index))}"><title>${escapeHtml(`${row.label}: ${row.value} (${row.percent}%)`)}</title></path>`;
  }).join("");
}

function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarPoint(cx, cy, radius, endAngle);
  const end = polarPoint(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function cssColor(value: string) {
  const colors: Record<string, string> = {
    "var(--color-primary)": "#0B4F3A",
    "var(--color-secondary)": "#2E7D5B",
    "var(--color-accent)": "#C9A227",
    "var(--color-important)": "#7A1F2B"
  };
  return colors[value] || value;
}

function conicGradient(rows: ChartRow[]) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value || row.percent), 0);
  if (!rows.length || total <= 0) return "conic-gradient(#9CA3AF 0deg 360deg)";
  let cursor = 0;
  const stops = rows.map((row, index) => {
    const amount = Math.max(0, row.value || row.percent);
    const start = cursor;
    const end = cursor + (amount / total) * 360;
    cursor = end;
    return `${chartColor(row, index)} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function chartStatus(label: string): ChartRow["status"] {
  const value = label.toLowerCase();
  if (value.includes("completed") || value.includes("tested") || value.includes("healthy")) return "good";
  if (value.includes("blocked") || value.includes("critical") || value.includes("overdue")) return "critical";
  if (value.includes("not started")) return "muted";
  return "warning";
}

function labelForField(field: SortKey | "none") {
  return field === "none" ? "None" : field.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function optionOrDefault<T extends string, F extends string>(value: string, options: readonly T[], fallback: F): T | F {
  return options.includes(value as T) ? (value as T) : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value || 0)));
}

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "chart";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toCamelKey(label: string) {
  return label.replace(/%/g, "").replace(/\//g, " ").toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase()).replace(/[^a-z0-9]/g, "");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

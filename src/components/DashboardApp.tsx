"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers3,
  Package,
  Plus,
  RefreshCcw,
  Search,
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
  STATUS_MEANINGS,
  STATUS_PROGRESS,
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

type TabId = "Dashboard" | "Compare" | "Master List" | "Contacts" | "Equipments" | "Area" | "Activity" | "Report" | "Timeline";
type ReportFormat = "Charts only" | "Tables only" | "Both charts and tables";
type SortKey = "city" | "workstream" | "taskName" | "zoneArea" | "taskOwner" | "status" | "progress" | "dueDate" | "riskLevel";

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

type Equipment = {
  id: string;
  city: string;
  equipmentName: string;
  workstream: string;
  relatedTask: string;
  averagePriceInr: number;
  image: string;
  vendor: string;
  quantity: number;
  category: string;
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
  title: string;
  rows: ChartRow[];
  suffix?: string;
};
type ChartKind = "Bar" | "Pie" | "Donut";

const STORAGE_TASKS_KEY = "ashara-it-readiness-tasks";
const STORAGE_CITIES_KEY = "ashara-it-readiness-cities";
const STORAGE_CONTACTS_KEY = "ashara-it-readiness-contacts";
const STORAGE_EQUIPMENT_KEY = "ashara-it-readiness-equipment";
const STORAGE_ACTIVITY_KEY = "ashara-it-readiness-activity";
const CURRENT_USER = "Admin";
const ATTACHMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];
const CLOSED_STATUSES = new Set(["Completed", "Tested", "Not Required"]);
const TABS: Array<{ id: TabId; icon: LucideIcon }> = [
  { id: "Dashboard", icon: BarChart3 },
  { id: "Compare", icon: Layers3 },
  { id: "Master List", icon: FileSpreadsheet },
  { id: "Contacts", icon: Users },
  { id: "Equipments", icon: Package },
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
  documentStatus: "All",
  dueFrom: "",
  dueTo: "",
  search: ""
};

export default function DashboardApp() {
  const [tasks, setTasks] = useState<TrackerTask[]>(() => normalizeTasks(generateDefaultTasksForCities(INITIAL_CITIES)));
  const [cities, setCities] = useState<string[]>(INITIAL_CITIES);
  const [contacts, setContacts] = useState<Contact[]>(() => createDefaultContacts(INITIAL_CITIES));
  const [equipment, setEquipment] = useState<Equipment[]>(() => createDefaultEquipment(INITIAL_CITIES));
  const [activity, setActivity] = useState<ActivityEntry[]>(() => [
    createActivity("Dashboard created", "Ashara tracker", "Initial local tracker data generated.")
  ]);
  const [activeTab, setActiveTab] = useState<TabId>("Dashboard");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [reportFilters, setReportFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);
  const [cityDraft, setCityDraft] = useState("");
  const [highlightMissing, setHighlightMissing] = useState(true);
  const [chartData, setChartData] = useState<ChartDataset | null>(null);
  const [compareCities, setCompareCities] = useState<string[]>(INITIAL_CITIES.slice(0, 3));
  const [areaCity, setAreaCity] = useState(INITIAL_CITIES[0]);
  const [masterGroup, setMasterGroup] = useState<SortKey | "none">("city");
  const [masterSubgroup, setMasterSubgroup] = useState<SortKey | "none">("workstream");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortAsc, setSortAsc] = useState(true);
  const [contactDraft, setContactDraft] = useState<Contact>(() => blankContact(INITIAL_CITIES[0]));
  const [equipmentFilters, setEquipmentFilters] = useState({ city: "All", workstream: "All", task: "All", vendor: "All", category: "All", maxPrice: "" });
  const [reportFormat, setReportFormat] = useState<ReportFormat>("Both charts and tables");
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem(STORAGE_TASKS_KEY);
      const savedCities = window.localStorage.getItem(STORAGE_CITIES_KEY);
      const savedContacts = window.localStorage.getItem(STORAGE_CONTACTS_KEY);
      const savedEquipment = window.localStorage.getItem(STORAGE_EQUIPMENT_KEY);
      const savedActivity = window.localStorage.getItem(STORAGE_ACTIVITY_KEY);
      if (savedTasks) setTasks(normalizeTasks(JSON.parse(savedTasks) as TrackerTask[]));
      if (savedCities) setCities(JSON.parse(savedCities) as string[]);
      if (savedContacts) setContacts(JSON.parse(savedContacts) as Contact[]);
      if (savedEquipment) setEquipment(JSON.parse(savedEquipment) as Equipment[]);
      if (savedActivity) setActivity(JSON.parse(savedActivity) as ActivityEntry[]);
    } catch {
      setTasks(normalizeTasks(generateDefaultTasksForCities(INITIAL_CITIES)));
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
    window.localStorage.setItem(STORAGE_CITIES_KEY, JSON.stringify(cities));
    window.localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(contacts));
    window.localStorage.setItem(STORAGE_EQUIPMENT_KEY, JSON.stringify(equipment));
    window.localStorage.setItem(STORAGE_ACTIVITY_KEY, JSON.stringify(activity));
  }, [activity, cities, contacts, equipment, hydrated, tasks]);

  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [filters, tasks]);
  const reportTasks = useMemo(() => applyFilters(tasks, reportFilters), [reportFilters, tasks]);
  const metrics = useMemo(() => getMetrics(filteredTasks), [filteredTasks]);
  const cityStats = useMemo(() => getCityStats(tasks, cities), [cities, tasks]);
  const dashboardCharts = useMemo(() => buildDashboardCharts(filteredTasks, cityStats), [cityStats, filteredTasks]);
  const compareCharts = useMemo(() => buildCompareCharts(tasks, compareCities), [compareCities, tasks]);
  const areaRows = useMemo(() => getAreaRows(tasks.filter((task) => task.city === areaCity)), [areaCity, tasks]);
  const areaCharts = useMemo(() => buildAreaCharts(areaRows), [areaRows]);
  const reportCharts = useMemo(() => buildDashboardCharts(reportTasks, getCityStats(reportTasks, cities)), [cities, reportTasks]);
  const sortedMasterTasks = useMemo(() => sortTasks(filteredTasks, sortKey, sortAsc), [filteredTasks, sortAsc, sortKey]);
  const visibleEquipment = useMemo(() => filterEquipment(equipment, equipmentFilters), [equipment, equipmentFilters]);

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
    if (!window.confirm("Reset all local data to the default Asharah dashboard setup?")) return;
    setCities(INITIAL_CITIES);
    setTasks(normalizeTasks(generateDefaultTasksForCities(INITIAL_CITIES)));
    setContacts(createDefaultContacts(INITIAL_CITIES));
    setEquipment(createDefaultEquipment(INITIAL_CITIES));
    setActivity([createActivity("Demo data reset", "Ashara tracker", "Default tasks, contacts, and equipment restored.")]);
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

  const exportExcel = (rows: TrackerTask[], label: string) => {
    downloadExcel(tasksToRows(rows), `ashara-it-${label}.xls`);
    logActivity("Report exported", label, `${rows.length} task row(s) exported as Excel.`);
  };

  const exportPdf = (rows: TrackerTask[]) => {
    openPdfReport(rows, reportCharts, reportFormat);
    logActivity("Report exported", "PDF report", `${rows.length} task row(s), ${reportFormat}.`);
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-primary)] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-accent-light)]">Asharah Mubarak operations</p>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">IT / Event Preparation Dashboard</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setSelectedTask(createBlankTask(cities[0] ?? "Nairobi"))}><Plus size={16} /> Add Task</button>
              <button className="btn-secondary" onClick={() => exportTaskCsv(filteredTasks, "visible-tasks")}><Download size={16} /> Export CSV</button>
              <button className="btn-secondary" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Import CSV</button>
              <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
              <button className="btn-secondary" onClick={resetDemoData}><RefreshCcw size={16} /> Reset Demo</button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto rounded-lg bg-white/10 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id ? "bg-[var(--color-accent)] text-[var(--color-primary)] shadow-sm" : "text-white hover:bg-white/15"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={15} /> {tab.id}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <CityManager cityDraft={cityDraft} setCityDraft={setCityDraft} onAddCity={addCity} />

        {activeTab === "Dashboard" && (
          <DashboardPage
            filters={filters}
            setFilters={setFilters}
            sourceTasks={tasks}
            filteredTasks={filteredTasks}
            metrics={metrics}
            charts={dashboardCharts}
            highlightMissing={highlightMissing}
            setHighlightMissing={setHighlightMissing}
            onShowData={setChartData}
            onOpenTask={setSelectedTask}
          />
        )}

        {activeTab === "Compare" && (
          <ComparePage
            cities={cities}
            selectedCities={compareCities}
            setSelectedCities={setCompareCities}
            charts={compareCharts}
            tasks={tasks.filter((task) => compareCities.includes(task.city))}
            onShowData={setChartData}
          />
        )}

        {activeTab === "Master List" && (
          <MasterListPage
            filters={filters}
            setFilters={setFilters}
            sourceTasks={tasks}
            tasks={sortedMasterTasks}
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
            onOpenTask={setSelectedTask}
          />
        )}

        {activeTab === "Contacts" && (
          <ContactsPage contacts={contacts} cities={cities} setContactDraft={setContactDraft} contactDraft={contactDraft} saveContact={saveContact} />
        )}

        {activeTab === "Equipments" && (
          <EquipmentPage equipment={visibleEquipment} allEquipment={equipment} filters={equipmentFilters} setFilters={setEquipmentFilters} tasks={tasks} />
        )}

        {activeTab === "Area" && (
          <AreaPage cities={cities} selectedCity={areaCity} setSelectedCity={setAreaCity} areaRows={areaRows} charts={areaCharts} onShowData={setChartData} />
        )}

        {activeTab === "Activity" && <ActivityPage activity={activity} />}

        {activeTab === "Report" && (
          <ReportPage
            filters={reportFilters}
            setFilters={setReportFilters}
            sourceTasks={tasks}
            reportTasks={reportTasks}
            charts={reportCharts}
            reportFormat={reportFormat}
            setReportFormat={setReportFormat}
            onShowData={setChartData}
            onExportPdf={exportPdf}
            onExportExcel={() => exportExcel(reportTasks, "report")}
          />
        )}

        {activeTab === "Timeline" && <TimelinePage cityStats={cityStats} tasks={tasks} onOpenTask={setSelectedTask} />}
      </div>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-1 px-4 py-4 text-sm text-[var(--color-text-muted)] sm:px-6 lg:px-8">
          <span className="font-semibold text-[var(--color-primary)]">Asharah Mubarak IT / Event Preparation Dashboard</span>
          <span>City-wise readiness, area progress, contacts, equipment, reports, and activity in one tracker.</span>
        </div>
      </footer>

      {selectedTask && (
        <TaskEditor task={selectedTask} cities={cities} onSave={upsertTask} onClose={() => setSelectedTask(null)} onDelete={deleteTask} />
      )}
      {chartData && <DataModal dataset={chartData} onClose={() => setChartData(null)} />}
    </main>
  );
}

function DashboardPage({
  filters,
  setFilters,
  sourceTasks,
  filteredTasks,
  metrics,
  charts,
  highlightMissing,
  setHighlightMissing,
  onShowData,
  onOpenTask
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  sourceTasks: TrackerTask[];
  filteredTasks: TrackerTask[];
  metrics: ReturnType<typeof getMetrics>;
  charts: ChartDataset[];
  highlightMissing: boolean;
  setHighlightMissing: (value: boolean) => void;
  onShowData: (dataset: ChartDataset) => void;
  onOpenTask: (task: TrackerTask) => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <FiltersPanel filters={filters} setFilters={setFilters} sourceTasks={sourceTasks} />
      </Panel>
      <SummaryCards metrics={metrics} />
      <ChartGrid charts={charts} onShowData={onShowData} />
      <StatusMeanings />
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Priority task snapshot</h2>
        <Toggle checked={highlightMissing} onChange={setHighlightMissing} label="Highlight missing required fields" />
      </div>
      <TaskTable tasks={filteredTasks.slice(0, 32)} onOpenTask={onOpenTask} highlightMissing={highlightMissing} />
    </section>
  );
}

function ComparePage({
  cities,
  selectedCities,
  setSelectedCities,
  charts,
  tasks,
  onShowData
}: {
  cities: string[];
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  charts: ChartDataset[];
  tasks: TrackerTask[];
  onShowData: (dataset: ChartDataset) => void;
}) {
  const toggleCity = (city: string) => {
    setSelectedCities(selectedCities.includes(city) ? selectedCities.filter((item) => item !== city) : [...selectedCities, city]);
  };
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <div className="flex flex-col gap-3">
          <h2 className="section-title">Choose cities to compare</h2>
          <div className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <button key={city} className={`tab-choice ${selectedCities.includes(city) ? "tab-choice-active" : ""}`} onClick={() => toggleCity(city)}>
                {city}
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <ChartGrid charts={charts} onShowData={onShowData} />
      <TaskTable tasks={tasks.slice(0, 40)} onOpenTask={() => undefined} highlightMissing={false} />
    </section>
  );
}

function MasterListPage({
  filters,
  setFilters,
  sourceTasks,
  tasks,
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
  onOpenTask
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  sourceTasks: TrackerTask[];
  tasks: TrackerTask[];
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
  onOpenTask: (task: TrackerTask) => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <FiltersPanel filters={filters} setFilters={setFilters} sourceTasks={sourceTasks} />
      </Panel>
      <Panel>
        <div className="grid gap-3 md:grid-cols-5">
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
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InputField label="Name" value={contactDraft.name} onChange={(value) => setContactDraft({ ...contactDraft, name: value })} />
          <SelectField label="City" value={contactDraft.city} options={cities} onChange={(value) => setContactDraft({ ...contactDraft, city: value })} />
          <InputField label="Phone" value={contactDraft.phone} onChange={(value) => setContactDraft({ ...contactDraft, phone: value })} />
          <InputField label="Email" value={contactDraft.email} onChange={(value) => setContactDraft({ ...contactDraft, email: value })} />
          <InputField label="Role" value={contactDraft.role} onChange={(value) => setContactDraft({ ...contactDraft, role: value })} />
          <SelectField label="Workstream handled" value={contactDraft.workstreamHandled} options={[...WORKSTREAMS.map((item) => item.name), "Custom"]} onChange={(value) => setContactDraft({ ...contactDraft, workstreamHandled: value })} />
          <InputField label="Custom responsibility" value={contactDraft.customResponsibility} onChange={(value) => setContactDraft({ ...contactDraft, customResponsibility: value })} />
          <InputField label="Notes" value={contactDraft.notes} onChange={(value) => setContactDraft({ ...contactDraft, notes: value })} />
        </div>
        <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={saveContact}><Plus size={16} /> Save Contact</button></div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(grouped).map(([city, rows]) => (
          <Panel key={city}>
            <h3 className="section-title">{city}</h3>
            <div className="mt-3 space-y-3">
              {rows.map((contact) => (
                <button key={contact.id} className="w-full rounded-lg border border-[var(--color-border)] p-3 text-left transition hover:bg-[var(--color-bg)]" onClick={() => setContactDraft(contact)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-primary)]">{contact.name || "Unnamed POC"}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{contact.role || "Role pending"} / {contact.workstreamHandled}</p>
                    </div>
                    <span className="badge-gold">{contact.phone || "Phone pending"}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">{contact.email || "Email pending"} {contact.notes ? `- ${contact.notes}` : ""}</p>
                </button>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function EquipmentPage({
  equipment,
  allEquipment,
  filters,
  setFilters,
  tasks
}: {
  equipment: Equipment[];
  allEquipment: Equipment[];
  filters: { city: string; workstream: string; task: string; vendor: string; category: string; maxPrice: string };
  setFilters: (filters: { city: string; workstream: string; task: string; vendor: string; category: string; maxPrice: string }) => void;
  tasks: TrackerTask[];
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SelectField label="City" value={filters.city} options={unique(allEquipment.map((item) => item.city))} includeAll onChange={(value) => setFilters({ ...filters, city: value })} />
          <SelectField label="Workstream" value={filters.workstream} options={WORKSTREAMS.map((item) => item.name)} includeAll onChange={(value) => setFilters({ ...filters, workstream: value })} />
          <SelectField label="Task" value={filters.task} options={unique(tasks.map((item) => item.taskName))} includeAll onChange={(value) => setFilters({ ...filters, task: value })} />
          <SelectField label="Vendor" value={filters.vendor} options={unique(allEquipment.map((item) => item.vendor).filter(Boolean))} includeAll onChange={(value) => setFilters({ ...filters, vendor: value })} />
          <SelectField label="Category" value={filters.category} options={unique(allEquipment.map((item) => item.category))} includeAll onChange={(value) => setFilters({ ...filters, category: value })} />
          <InputField label="Max INR price" value={filters.maxPrice} onChange={(value) => setFilters({ ...filters, maxPrice: value })} />
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {equipment.map((item) => (
          <article key={item.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft transition hover:-translate-y-0.5">
            <img className="h-36 w-full rounded-md border border-[var(--color-border)] object-cover" src={item.image} alt={item.equipmentName} />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[var(--color-primary)]">{item.equipmentName}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{item.city} / {item.category}</p>
              </div>
              <span className="badge-gold">{formatInr(item.averagePriceInr)}</span>
            </div>
            <div className="mt-3 space-y-1 text-sm text-[var(--color-text-muted)]">
              <p>Workstream: {item.workstream}</p>
              <p>Related task: {item.relatedTask}</p>
              <p>Vendor: {item.vendor || "Pending"} / Qty: {item.quantity || "-"}</p>
              <p>{item.notes}</p>
            </div>
          </article>
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
  onShowData
}: {
  cities: string[];
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  areaRows: ReturnType<typeof getAreaRows>;
  charts: ChartDataset[];
  onShowData: (dataset: ChartDataset) => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel><SelectField label="Select city" value={selectedCity} options={cities} onChange={setSelectedCity} /></Panel>
      <ChartGrid charts={charts} onShowData={onShowData} />
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
        <article key={item.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft">
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
  onShowData,
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
  onShowData: (dataset: ChartDataset) => void;
  onExportPdf: (rows: TrackerTask[]) => void;
  onExportExcel: () => void;
}) {
  return (
    <section className="animate-fade-in space-y-5">
      <Panel>
        <FiltersPanel filters={filters} setFilters={setFilters} sourceTasks={sourceTasks} />
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <SelectField label="Report format" value={reportFormat} options={["Charts only", "Tables only", "Both charts and tables"]} onChange={(value) => setReportFormat(value as ReportFormat)} />
          <button className="btn-primary justify-center" onClick={() => onExportPdf(reportTasks)}><FileText size={16} /> Export PDF</button>
          <button className="btn-secondary justify-center" onClick={onExportExcel}><FileSpreadsheet size={16} /> Export Excel</button>
        </div>
      </Panel>
      {reportFormat !== "Tables only" && <ChartGrid charts={charts} onShowData={onShowData} />}
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
            <button key={task.id} className={`w-full rounded-lg border border-[var(--color-border)] p-3 text-left transition hover:bg-[var(--color-bg)] ${isOverdue(task) ? "bg-[#7A1F2B]/10" : ""}`} onClick={() => onOpenTask(task)}>
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
  const scoped = filters.city === "All" ? sourceTasks : sourceTasks.filter((task) => task.city === filters.city);
  const update = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
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
        <SelectField label="Document" value={filters.documentStatus} options={DOCUMENT_STATUSES} includeAll onChange={(value) => update("documentStatus", value)} />
        <InputField label="Due from" type="date" value={filters.dueFrom} onChange={(value) => update("dueFrom", value)} />
        <InputField label="Due to" type="date" value={filters.dueTo} onChange={(value) => update("dueTo", value)} />
      </div>
      <div className="flex justify-end"><button className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}><X size={16} /> Clear Filters</button></div>
    </div>
  );
}

function SummaryCards({ metrics }: { metrics: ReturnType<typeof getMetrics> }) {
  const cards = [
    { label: "Total Tasks", value: metrics.total, icon: BarChart3, tone: "muted" },
    { label: "Completed", value: metrics.completed, icon: CheckCircle2, tone: "good" },
    { label: "In Progress", value: metrics.inProgress, icon: CalendarClock, tone: "warning" },
    { label: "Delayed / Blocked", value: metrics.delayed, icon: AlertTriangle, tone: "critical" },
    { label: "Missing Required", value: metrics.missingRequired, icon: FileText, tone: "critical" },
    { label: "Average Progress", value: `${metrics.averageReadiness}%`, icon: CheckCircle2, tone: "good" }
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-primary)]">{card.value}</p>
              </div>
              <span className={`rounded-md p-2 ${toneClass(card.tone)}`}><Icon size={18} /></span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ChartGrid({ charts, onShowData }: { charts: ChartDataset[]; onShowData: (dataset: ChartDataset) => void }) {
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      {charts.map((chart) => <ChartCard key={chart.title} dataset={chart} onShowData={onShowData} />)}
    </section>
  );
}

function ChartCard({ dataset, onShowData }: { dataset: ChartDataset; onShowData: (dataset: ChartDataset) => void }) {
  const [chartKind, setChartKind] = useState<ChartKind>("Bar");

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="section-title">{dataset.title}</h2>
        <div className="flex flex-wrap gap-2">
          {(["Bar", "Pie", "Donut"] as ChartKind[]).map((kind) => (
            <button key={kind} className={`chart-toggle ${chartKind === kind ? "chart-toggle-active" : ""}`} onClick={() => setChartKind(kind)}>
              {kind}
            </button>
          ))}
          <button className="btn-compact" onClick={() => onShowData(dataset)}>Data</button>
        </div>
      </div>
      <ChartVisual dataset={dataset} chartKind={chartKind} />
    </article>
  );
}

function ChartVisual({ dataset, chartKind }: { dataset: ChartDataset; chartKind: ChartKind }) {
  if (dataset.rows.length === 0) return <p className="mt-4 text-sm text-[var(--color-text-muted)]">No chart data available.</p>;
  if (chartKind === "Pie" || chartKind === "Donut") return <PieLikeChart dataset={dataset} chartKind={chartKind} />;

  return (
    <div className="mt-4 space-y-3">
      {dataset.rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-[var(--color-text-muted)]">{row.label}</span>
            <span className="font-semibold text-[var(--color-primary)]">{row.value}{dataset.suffix}</span>
          </div>
          <ProgressBar value={row.percent} tone={row.status} />
        </div>
      ))}
    </div>
  );
}

function PieLikeChart({ dataset, chartKind }: { dataset: ChartDataset; chartKind: "Pie" | "Donut" }) {
  const rows = dataset.rows.filter((row) => row.value > 0 || row.percent > 0);
  const gradient = conicGradient(rows.length ? rows : dataset.rows);
  const total = dataset.rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-[var(--color-border)] shadow-inner" style={{ background: gradient }}>
        {chartKind === "Donut" && (
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-center">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Total</span>
            <span className="text-xl font-semibold text-[var(--color-primary)]">{total}</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {dataset.rows.map((row, index) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 flex-none rounded-full" style={{ background: chartColor(row, index) }} />
              <span className="truncate text-[var(--color-text-muted)]">{row.label}</span>
            </span>
            <span className="font-semibold text-[var(--color-primary)]">{row.value}{dataset.suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusMeanings() {
  return (
    <Panel>
      <h2 className="section-title">Status meanings</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {STATUS_MEANINGS.map((item) => (
          <div key={item.status} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <StatusBadge status={item.status} />
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{item.meaning}</p>
          </div>
        ))}
      </div>
    </Panel>
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
  return (
    <section className={`${compact ? "" : "rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-soft"}`}>
      {!compact && (
        <div className="flex flex-col gap-2 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Task list</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{tasks.length} matching tasks</p>
          </div>
        </div>
      )}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
          <thead className="bg-[var(--color-accent-light)] text-xs uppercase text-[var(--color-primary)]">
            <tr>{["City", "Workstream", "Task", "Area", "Owner", "Vendors", "Status", "Progress", "Risk", "Due", "Docs", "Missing"].map((heading) => <th key={heading} className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const missing = missingFields(task);
              return (
                <tr key={task.id} className={`cursor-pointer border-b border-[var(--color-border)] transition hover:bg-[var(--color-bg)] ${dueRowClass(task)} ${highlightMissing && missing.length ? "border-l-4 border-l-[var(--color-important)]" : ""}`} onClick={() => onOpenTask(task)}>
                  <td className="px-3 py-3 font-medium text-[var(--color-primary)]">{task.city}</td>
                  <td className="px-3 py-3 text-[var(--color-text-muted)]">{task.workstream}</td>
                  <td className="max-w-[320px] px-3 py-3 text-[var(--color-text)]">{taskDisplayName(task)}</td>
                  <td className="px-3 py-3 text-[var(--color-text-muted)]">{task.zoneArea}</td>
                  <td className="px-3 py-3 text-[var(--color-text-muted)]">{task.taskOwner}</td>
                  <td className="px-3 py-3 text-[var(--color-text-muted)]">{vendorSummary(task) || "-"}</td>
                  <td className="px-3 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-3 py-3"><div className="min-w-28"><ProgressBar value={task.progress} compact /><span className="text-xs text-[var(--color-text-muted)]">{task.progress}%</span></div></td>
                  <td className="px-3 py-3"><RiskBadge risk={task.riskLevel} /></td>
                  <td className="px-3 py-3 text-[var(--color-text-muted)]">{task.dueDate}</td>
                  <td className="px-3 py-3"><DocumentBadge status={task.documentStatus} /></td>
                  <td className="px-3 py-3 text-[var(--color-important)]">{missing.length || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 lg:hidden">
        {tasks.map((task) => (
          <button key={task.id} className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left shadow-sm ${dueRowClass(task)} ${highlightMissing && missingFields(task).length ? "border-l-4 border-l-[var(--color-important)]" : ""}`} onClick={() => onOpenTask(task)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--color-text)]">{taskDisplayName(task)}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{task.city} / {task.zoneArea}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--color-text-muted)]">
              <span>Owner: {task.taskOwner || "Missing"}</span>
              <span>Due: {task.dueDate || "Missing"}</span>
              <span>Risk: {task.riskLevel}</span>
              <span>Missing: {missingFields(task).length}</span>
            </div>
            <div className="mt-3"><ProgressBar value={task.progress} /></div>
          </button>
        ))}
      </div>
      {tasks.length === 0 && <div className="p-12 text-center text-sm text-[var(--color-text-muted)]">No tasks match the selected filters.</div>}
    </section>
  );
}

function TaskEditor({ task, cities, onSave, onClose, onDelete }: { task: TrackerTask; cities: string[]; onSave: (task: TrackerTask) => void; onClose: () => void; onDelete: (taskId: string) => void }) {
  const [draft, setDraft] = useState<TrackerTask>(() => normalizeTask(task));
  const [attachmentError, setAttachmentError] = useState("");
  useEffect(() => setDraft(normalizeTask(task)), [task]);

  const updateField = <K extends keyof TrackerTask>(key: K, value: TrackerTask[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "taskName") next.taskName = toSentenceCase(String(value));
      if (key === "taskName" || key === "workstream") next.zoneArea = inferArea(String(key === "taskName" ? value : next.taskName), String(key === "workstream" ? value : next.workstream));
      if (key === "status" && !current.progressManuallyEdited) next.progress = STATUS_PROGRESS[value as TrackerTask["status"]];
      if (key === "progress") next.progressManuallyEdited = true;
      return next;
    });
  };

  const updateVendor = (index: number, key: keyof VendorEntry, value: string) => {
    const vendors = draft.vendors.map((vendor, vendorIndex) => (vendorIndex === index ? { ...vendor, [key]: value } : vendor));
    setDraft({ ...draft, vendors, vendorName: vendors[0]?.name || "", vendorContact: vendors[0]?.contact || "" });
  };

  const addVendor = () => setDraft({ ...draft, vendors: [...draft.vendors, { name: "", contact: "" }] });

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
    <div className="fixed inset-0 z-50 bg-[#0B4F3A]/35 lg:flex lg:justify-end">
      <aside className="flex h-full w-full flex-col bg-[var(--color-card)] shadow-2xl lg:w-[620px]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-accent)]">Task detail / edit</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-primary)]">{taskDisplayName(draft)}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close task editor"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
            <InputField label="Last Update Date" type="date" value={draft.lastUpdateDate} onChange={(value) => updateField("lastUpdateDate", value)} />
            <InputField label="Next Follow-up Date" type="date" value={draft.nextFollowUpDate} onChange={(value) => updateField("nextFollowUpDate", value)} />
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="mb-3 flex items-center justify-between"><span className="field-label">Vendors</span><button className="icon-btn" onClick={addVendor} aria-label="Add vendor"><Plus size={16} /></button></div>
            <div className="space-y-2">
              {draft.vendors.map((vendor, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  <input className="field" value={vendor.name} onChange={(event) => updateVendor(index, "name", event.target.value)} placeholder="Vendor name" />
                  <input className="field" value={vendor.contact} onChange={(event) => updateVendor(index, "contact", event.target.value)} placeholder="Vendor contact" />
                </div>
              ))}
            </div>
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
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] p-4 sm:flex-row sm:justify-between">
          <button className="btn-secondary justify-center text-[var(--color-important)] hover:bg-[#7A1F2B]/10" onClick={() => onDelete(draft.id)}>Delete</button>
          <div className="flex gap-2"><button className="btn-secondary flex-1 justify-center sm:flex-none" onClick={onClose}>Cancel</button><button className="btn-primary flex-1 justify-center sm:flex-none" onClick={() => onSave({ ...draft, id: draft.id || makeTaskId(draft.city, draft.workstream, draft.taskName) })}>Save Changes</button></div>
        </div>
      </aside>
    </div>
  );
}

function DataModal({ dataset, onClose }: { dataset: ChartDataset; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B4F3A]/35 p-4">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="section-title">{dataset.title} data</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          <Table rows={dataset.rows.map((row) => ({ Label: row.label, Value: row.value, Percent: `${row.percent}%`, Status: row.status || "" }))} />
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft">{children}</section>;
}

function SelectField({ label, value, options, onChange, includeAll = false }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; includeAll?: boolean }) {
  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
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
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
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
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function RiskBadge({ risk }: { risk: TrackerTask["riskLevel"] }) {
  const className = risk === "High" ? "bg-[var(--color-important)] text-white" : risk === "Medium" ? "bg-[var(--color-accent)] text-[var(--color-primary)]" : "bg-[var(--color-primary)] text-white";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{risk}</span>;
}

function DocumentBadge({ status }: { status: TrackerTask["documentStatus"] }) {
  const className = status === "Final Attached" ? "bg-[var(--color-primary)] text-white" : status === "Draft Attached" ? "bg-[var(--color-secondary)] text-white" : "bg-[var(--color-accent-light)] text-[var(--color-text)]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

const MASTER_FIELDS: SortKey[] = ["city", "workstream", "taskName", "zoneArea", "taskOwner", "status", "progress", "dueDate", "riskLevel"];

function normalizeTasks(rows: TrackerTask[]) {
  return rows.map(normalizeTask);
}

function normalizeTask(task: TrackerTask): TrackerTask {
  const vendors = task.vendors?.length ? task.vendors : [{ name: task.vendorName || "", contact: task.vendorContact || "" }];
  const roundedProgress = nearestProgress(task.progress);
  return {
    ...task,
    taskName: toSentenceCase(stripRepeatedTaskWords(task.taskName, task)),
    progress: roundedProgress,
    vendors,
    vendorName: vendors[0]?.name || task.vendorName || "",
    vendorContact: vendors[0]?.contact || task.vendorContact || "",
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
      (filters.documentStatus === "All" || task.documentStatus === filters.documentStatus) &&
      vendorMatch &&
      pocMatch &&
      dateMatch &&
      searchMatch
    );
  });
}

function getMetrics(rows: TrackerTask[]) {
  const total = rows.length || 1;
  return {
    total: rows.length,
    completed: rows.filter(isClosed).length,
    inProgress: rows.filter((task) => ["In Progress", "Under Review", "Ready for Testing"].includes(task.status)).length,
    delayed: rows.filter((task) => task.status === "Blocked" || isOverdue(task)).length,
    missingRequired: rows.filter((task) => missingFields(task).length > 0).length,
    averageReadiness: Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / total)
  };
}

function getCityStats(rows: TrackerTask[], cities: string[]) {
  return cities.map((city) => {
    const cityRows = rows.filter((task) => task.city === city);
    const total = cityRows.length || 1;
    const completion = Math.round(cityRows.reduce((sum, task) => sum + task.progress, 0) / total);
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
  return [
    { title: "Overall progress", suffix: "%", rows: [{ label: "Average readiness", value: Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / total), percent: Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / total), status: "good" }] },
    { title: "City-wise progress", suffix: "%", rows: cityStats.map((city) => ({ label: city.city, value: city.completion, percent: city.completion, status: city.health === "Critical" ? "critical" : city.health === "Good" ? "good" : "warning" })) },
    { title: "Workstream-wise progress", suffix: "%", rows: WORKSTREAMS.map((workstream) => averageRow(workstream.name, rows.filter((task) => task.workstream === workstream.name))) },
    { title: "Status distribution", rows: distribution(rows, "status") },
    { title: "Task completion", rows: [{ label: "Completed", value: completed, percent: Math.round((completed / total) * 100), status: "good" }, { label: "Pending", value: pending, percent: Math.round((pending / total) * 100), status: "warning" }, { label: "Delayed", value: delayed, percent: Math.round((delayed / total) * 100), status: "critical" }] },
    { title: "Due date health", rows: dueHealthRows(rows) }
  ];
}

function buildCompareCharts(rows: TrackerTask[], cities: string[]): ChartDataset[] {
  const selected = rows.filter((task) => cities.includes(task.city));
  const stats = getCityStats(selected, cities);
  return [
    { title: "Overall progress by city", suffix: "%", rows: stats.map((city) => ({ label: city.city, value: city.completion, percent: city.completion, status: city.health === "Critical" ? "critical" : city.health === "Good" ? "good" : "warning" })) },
    { title: "Task completion by city", rows: stats.map((city) => ({ label: city.city, value: city.completed, percent: city.total ? Math.round((city.completed / city.total) * 100) : 0, status: "good" })) },
    { title: "Delayed items by city", rows: stats.map((city) => ({ label: city.city, value: city.delayed, percent: city.total ? Math.round((city.delayed / city.total) * 100) : 0, status: city.delayed ? "critical" : "good" })) },
    { title: "Status distribution", rows: distribution(selected, "status") },
    { title: "Due date performance", rows: dueHealthRows(selected) },
    { title: "Workstream progress", suffix: "%", rows: WORKSTREAMS.map((workstream) => averageRow(workstream.name, selected.filter((task) => task.workstream === workstream.name))) }
  ];
}

function getAreaRows(rows: TrackerTask[]) {
  return ZONES.map((area) => {
    const areaTasks = rows.filter((task) => task.zoneArea === area);
    const progress = areaTasks.length ? Math.round(areaTasks.reduce((sum, task) => sum + task.progress, 0) / areaTasks.length) : 0;
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

function buildAreaCharts(rows: ReturnType<typeof getAreaRows>): ChartDataset[] {
  return [
    { title: "Area-wise progress", suffix: "%", rows: rows.map((row) => ({ label: row.area, value: row.progress, percent: row.progress, status: row.health === "Critical" ? "critical" : row.health === "Good" ? "good" : "warning" })) },
    { title: "Area tasks", rows: rows.map((row) => ({ label: row.area, value: row.tasks, percent: Math.min(100, row.tasks * 8), status: "muted" })) },
    { title: "Area due date health", rows: rows.map((row) => ({ label: row.area, value: row.overdue + row.dueSoon, percent: Math.min(100, (row.overdue + row.dueSoon) * 15), status: row.overdue ? "critical" : row.dueSoon ? "warning" : "good" })) }
  ];
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

function averageRow(label: string, rows: TrackerTask[]): ChartRow {
  const value = rows.length ? Math.round(rows.reduce((sum, task) => sum + task.progress, 0) / rows.length) : 0;
  return { label, value, percent: value, status: value >= 80 ? "good" : value >= 40 ? "warning" : "critical" };
}

function dueHealthRows(rows: TrackerTask[]): ChartRow[] {
  const total = Math.max(rows.length, 1);
  const overdue = rows.filter(isOverdue).length;
  const soon = rows.filter(isDueSoon).length;
  const healthy = rows.filter((task) => !isOverdue(task) && !isDueSoon(task)).length;
  return [
    { label: "Healthy", value: healthy, percent: Math.round((healthy / total) * 100), status: "good" },
    { label: "Due within 3 days", value: soon, percent: Math.round((soon / total) * 100), status: "warning" },
    { label: "Overdue", value: overdue, percent: Math.round((overdue / total) * 100), status: "critical" }
  ];
}

function missingFields(task: TrackerTask) {
  const checks: Array<[string, boolean]> = [
    ["City", Boolean(task.city)],
    ["Area", Boolean(task.zoneArea)],
    ["Workstream", Boolean(task.workstream)],
    ["Task name", Boolean(task.taskName)],
    ["Ownership type", Boolean(task.ownershipType)],
    ["Task owner", Boolean(task.taskOwner)],
    ["Supporting person", Boolean(task.supportingPerson)],
    ["Priority", Boolean(task.priority)],
    ["Event criticality", Boolean(task.eventCriticality)],
    ["Status", Boolean(task.status)],
    ["Due date", Boolean(task.dueDate)],
    ["Target readiness date", Boolean(task.targetReadinessDate)],
    ["Dependency", Boolean(task.dependency)],
    ["Vendor", task.vendors.some((vendor) => vendor.name && vendor.contact)],
    ["Budget status", Boolean(task.budgetStatus)],
    ["Document status", Boolean(task.documentStatus)],
    ["Risk level", Boolean(task.riskLevel)],
    ["Last update date", Boolean(task.lastUpdateDate)],
    ["Next follow-up date", Boolean(task.nextFollowUpDate)],
    ["Remarks", Boolean(task.remarksLatestUpdate)],
    ["Document link or attachment", Boolean(task.documentLinkAttachmentReference || task.attachments.length)]
  ];
  if (task.status === "Blocked") checks.push(["Blocker reason", Boolean(task.blockerReason)]);
  return checks.filter(([, ok]) => !ok).map(([label]) => label);
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

function filterEquipment(rows: Equipment[], filters: { city: string; workstream: string; task: string; vendor: string; category: string; maxPrice: string }) {
  return rows.filter((item) =>
    (filters.city === "All" || item.city === filters.city) &&
    (filters.workstream === "All" || item.workstream === filters.workstream) &&
    (filters.task === "All" || item.relatedTask === filters.task) &&
    (filters.vendor === "All" || item.vendor === filters.vendor) &&
    (filters.category === "All" || item.category === filters.category) &&
    (!filters.maxPrice || item.averagePriceInr <= Number(filters.maxPrice))
  );
}

function createDefaultContacts(cities: string[]): Contact[] {
  return cities.map((city) => ({ ...blankContact(city), id: `contact-${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: `${city} IT POC`, role: "City IT SPOC", workstreamHandled: "City IT Coordination & Governance", notes: "Replace with actual POC details." }));
}

function blankContact(city: string): Contact {
  return { id: `contact-${Date.now()}`, name: "", city, phone: "", email: "", role: "", workstreamHandled: WORKSTREAMS[0].name, customResponsibility: "", notes: "" };
}

function createDefaultEquipment(cities: string[]): Equipment[] {
  const templates = [
    ["Wi-Fi access point", "Wi-Fi & Access Points", "Wi-Fi coverage plan prepared", 8500, "Networking", "AP for public and internal SSIDs"],
    ["Barcode scanner", "Scanning, E-Pass & Checkpoint IT", "Scanner/device quantity finalized", 4200, "Scanning", "Checkpoint scanning device"],
    ["UPS 1 KVA", "Power Backup & UPS", "UPS requirement finalized", 11500, "Power", "Critical IT backup power"],
    ["Network switch", "Network Design, VLANs & Firewall", "VLAN plan finalized", 14500, "Networking", "Managed switch for VLAN segmentation"]
  ];
  return cities.flatMap((city) =>
    templates.map(([name, workstream, task, price, category, notes]) => ({
      id: `equipment-${city}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      city,
      equipmentName: String(name),
      workstream: String(workstream),
      relatedTask: String(task),
      averagePriceInr: Number(price),
      image: equipmentImage(String(name), String(category)),
      vendor: "",
      quantity: 0,
      category: String(category),
      notes: String(notes)
    }))
  );
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
    vendorName: vendors[0]?.name || get("Vendor Name"),
    vendorContact: get("Vendor Contact"),
    vendors: vendors.length ? vendors : [{ name: get("Vendor Name"), contact: get("Vendor Contact") }],
    budgetStatus: optionOrDefault(get("Budget Status"), BUDGET_STATUSES, "Not Required"),
    documentStatus: optionOrDefault(get("Document Status"), DOCUMENT_STATUSES, "Not Attached"),
    riskLevel: optionOrDefault(get("Risk Level"), RISK_LEVELS, "Medium"),
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

function openPdfReport(rows: TrackerTask[], charts: ChartDataset[], format: ReportFormat) {
  const tableRows = tasksToRows(rows).slice(0, 200);
  const chartHtml = charts.map((chart) => `<section class="card"><h2>${escapeHtml(chart.title)}</h2>${chart.rows.map((row) => `<div class="bar"><span>${escapeHtml(row.label)}</span><strong>${row.value}${chart.suffix || ""}</strong><i style="width:${row.percent}%"></i></div>`).join("")}</section>`).join("");
  const keys = Object.keys(tableRows[0] || {});
  const tableHtml = `<section class="card"><h2>Task table</h2><table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>Asharah IT Report</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial,sans-serif;background:#FAF7EF;color:#1F2933}h1,h2{color:#0B4F3A}.card{background:#fff;border:1px solid #E8DDC5;border-radius:8px;padding:14px;margin:0 0 14px}.bar{position:relative;margin:10px 0;padding-bottom:8px;border-bottom:1px solid #E8DDC5}.bar span{display:inline-block;width:70%}.bar strong{float:right;color:#0B4F3A}.bar i{display:block;height:7px;background:#2E7D5B;border-radius:99px;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#F3E7C3;color:#0B4F3A}td,th{border:1px solid #E8DDC5;padding:5px;vertical-align:top}</style></head><body><h1>Asharah Mubarak IT / Event Preparation Report</h1><p>${new Date().toLocaleString()}</p>${format !== "Tables only" ? chartHtml : ""}${format !== "Charts only" ? tableHtml : ""}<script>window.print()</script></body></html>`);
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

function optionOrDefault<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value || 0)));
}

function formatInr(value: number) {
  return `INR ${value.toLocaleString("en-IN")}`;
}

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
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

function equipmentImage(name: string, category: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#FAF7EF"/><rect x="48" y="48" width="544" height="264" rx="18" fill="#FFFFFF" stroke="#E8DDC5" stroke-width="4"/><circle cx="142" cy="132" r="42" fill="#0B4F3A"/><path d="M240 128h250M240 178h180M240 228h220" stroke="#C9A227" stroke-width="18" stroke-linecap="round"/><text x="142" y="262" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#0B4F3A">${escapeHtml(category)}</text><text x="320" y="92" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="#1F2933">${escapeHtml(name)}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

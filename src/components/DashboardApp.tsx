"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Download,
  FileDown,
  FileSpreadsheet,
  Home,
  IndianRupee,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  Table2,
  TrendingUp,
  WalletCards,
  X
} from "lucide-react";
import data from "@/data/dashboard-data.json";
import {
  aggregateTimeline,
  formatINR,
  groupRequests,
  palette,
  rowsForExport,
  sortRows
} from "@/lib/dashboard";
import type { RequestRow } from "@/lib/dashboard";

const pages = [
  { id: "Dashboard", icon: Home },
  { id: "IT Requests", icon: BarChart3 },
  { id: "Budget", icon: WalletCards },
  { id: "Departments", icon: Building2 },
  { id: "Trends", icon: TrendingUp }
];

type SortDirection = "asc" | "desc";
type TimelineMode = "monthly" | "quarterly" | "yearly";
type ExportScope = "all" | "filtered";
type RequestTermScope = "type" | "category" | "status";
type PanelVariant = "compact" | "standard" | "wide" | "full";
type ChartTemplate = "horizontal-bar" | "vertical-bar" | "donut" | "pie" | "line" | "area" | "stacked-bar" | "grouped-bar";
type ChartTemplateOption = { value: ChartTemplate; label: string };
type ChartResize = { widthScale: number; heightScale: number };

const allRequests = data.requests as RequestRow[];
const allDepartments = Array.from(new Set(allRequests.map((row) => row.department))).sort();
const months = Array.from(new Set(allRequests.map((row) => row.month).filter(Boolean) as string[])).sort();
const defaultCompareDepartments = groupRequests(allRequests, "department")
  .sort((a, b) => b.requests - a.requests)
  .slice(0, 5)
  .map((row) => row.name);
const requestTermGroups: Array<{ title: string; scope: RequestTermScope; terms: string[] }> = [
  { title: "Request Type", scope: "type", terms: Array.from(new Set(allRequests.map((row) => row.type))).sort() },
  { title: "Request Category", scope: "category", terms: Array.from(new Set(allRequests.map((row) => row.category))).sort() },
  { title: "Request Status", scope: "status", terms: Array.from(new Set(allRequests.map((row) => row.status))).sort() }
];
const horizontalBarOptions: ChartTemplateOption[] = [
  { value: "horizontal-bar", label: "Default: Horizontal Bar" },
  { value: "vertical-bar", label: "Vertical Bar" },
  { value: "donut", label: "Donut" },
  { value: "pie", label: "Pie" }
];
const spendBarOptions: ChartTemplateOption[] = [
  { value: "horizontal-bar", label: "Default: Horizontal Bar" },
  { value: "vertical-bar", label: "Vertical Bar" },
  { value: "donut", label: "Donut" },
  { value: "pie", label: "Pie" }
];
const donutOptions: ChartTemplateOption[] = [
  { value: "donut", label: "Default: Donut" },
  { value: "pie", label: "Pie" },
  { value: "horizontal-bar", label: "Horizontal Bar" },
  { value: "vertical-bar", label: "Vertical Bar" }
];
const lineOptions: ChartTemplateOption[] = [
  { value: "line", label: "Default: Line" },
  { value: "area", label: "Area" },
  { value: "vertical-bar", label: "Vertical Bar" }
];
const areaOptions: ChartTemplateOption[] = [
  { value: "area", label: "Default: Area" },
  { value: "line", label: "Line" },
  { value: "vertical-bar", label: "Vertical Bar" }
];
const compareOptions: ChartTemplateOption[] = [
  { value: "stacked-bar", label: "Default: Stacked Bar" },
  { value: "grouped-bar", label: "Grouped Bar" }
];
const ChartResizeContext = createContext<ChartResize>({ widthScale: 1, heightScale: 1 });

export default function DashboardApp() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(allDepartments);
  const [requestSort, setRequestSort] = useState<SortDirection>("desc");
  const [spendSort, setSpendSort] = useState<SortDirection>("desc");
  const [selectedRequestTerms, setSelectedRequestTerms] = useState<string[]>([]);
  const [compareDepartments, setCompareDepartments] = useState<string[]>(defaultCompareDepartments);
  const [search, setSearch] = useState("");
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("monthly");
  const [fromMonth, setFromMonth] = useState(months[0] || "");
  const [toMonth, setToMonth] = useState(months[months.length - 1] || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tableModes, setTableModes] = useState<Record<string, boolean>>({});
  const [compareModes, setCompareModes] = useState<Record<string, boolean>>({});
  const [chartTemplates, setChartTemplates] = useState<Record<string, ChartTemplate>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 260);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    setFiltersOpen(false);
  }, [activePage]);

  const filteredRequests = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const selectedTypes = selectedRequestTerms.filter((term) => term.startsWith("type:")).map((term) => term.slice("type:".length));
    const selectedCategories = selectedRequestTerms.filter((term) => term.startsWith("category:")).map((term) => term.slice("category:".length));
    const selectedStatuses = selectedRequestTerms.filter((term) => term.startsWith("status:")).map((term) => term.slice("status:".length));
    return allRequests.filter((row) => {
      const departmentMatch = selectedDepartments.includes(row.department);
      const searchMatch = !normalized || [row.id, row.department, row.type, row.category, row.status, row.description].join(" ").toLowerCase().includes(normalized);
      const dateMatch = !row.month || ((!fromMonth || row.month >= fromMonth) && (!toMonth || row.month <= toMonth));
      const requestTermMatch =
        activePage !== "IT Requests" ||
        selectedRequestTerms.length === 0 ||
        ((selectedTypes.length === 0 || selectedTypes.includes(row.type)) &&
          (selectedCategories.length === 0 || selectedCategories.includes(row.category)) &&
          (selectedStatuses.length === 0 || selectedStatuses.includes(row.status)));
      return departmentMatch && searchMatch && dateMatch && requestTermMatch;
    });
  }, [activePage, fromMonth, search, selectedDepartments, selectedRequestTerms, toMonth]);

  const unfilteredPageRows = useMemo(() => scopedRows(activePage, allRequests), [activePage]);
  const pageRows = useMemo(() => scopedRows(activePage, activePage === "Dashboard" ? allRequests : filteredRequests), [activePage, filteredRequests]);

  const departmentRequests = useMemo(() => sortRows(groupRequests(pageRows, "department"), "requests", requestSort), [pageRows, requestSort]);
  const departmentSpend = useMemo(() => sortRows(groupRequests(pageRows, "department"), "spend", spendSort), [pageRows, spendSort]);
  const categoryRows = useMemo(() => sortRows(groupRequests(pageRows, "category"), "requests", requestSort), [pageRows, requestSort]);
  const typeRows = useMemo(() => sortRows(groupRequests(pageRows, "type"), "requests", requestSort), [pageRows, requestSort]);
  const statusRows = useMemo(() => sortRows(groupRequests(pageRows, "status"), "requests", requestSort), [pageRows, requestSort]);
  const trendRows = useMemo(() => aggregateTimeline(pageRows, timelineMode), [pageRows, timelineMode]);
  const spendCategoryRows = useMemo(() => sortRows(groupRequests(pageRows, "category"), "spend", spendSort), [pageRows, spendSort]);
  const compareTypeRows = useMemo(() => groupDepartmentTypes(pageRows, compareDepartments), [compareDepartments, pageRows]);
  const sortedRequests = useMemo(
    () => [...pageRows].sort((a, b) => (requestSort === "asc" ? a.department.localeCompare(b.department) : b.department.localeCompare(a.department))),
    [pageRows, requestSort]
  );

  const summaryInsights = useMemo(() => {
    const topDepartment = departmentRequests[0];
    const topSpend = departmentSpend[0];
    const firstTrend = trendRows[0];
    const lastTrend = trendRows[trendRows.length - 1];
    const movement = firstTrend && lastTrend ? lastTrend.requests - firstTrend.requests : 0;
    return [
      topDepartment ? `Requests are highest in ${topDepartment.name} with ${topDepartment.requests} requests.` : null,
      topSpend ? `Spend is concentrated in ${topSpend.name} at ${formatINR(topSpend.spend || 0)}.` : null,
      firstTrend && lastTrend ? `Request volume ${movement >= 0 ? "increased" : "decreased"} from ${firstTrend.name} to ${lastTrend.name} based on the selected data.` : null
    ].filter(Boolean) as string[];
  }, [departmentRequests, departmentSpend, trendRows]);

  async function exportExcel(title: string, rows: unknown[]) {
    const xlsx = await import("xlsx");
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Dashboard Data");
    xlsx.writeFile(workbook, `${slug(title)}.xlsx`);
  }

  async function exportPdf(title: string, rows: Record<string, unknown>[]) {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 34;
    const topic = title.replace(/\s+-\s+(Export All|Export Filtered)$/i, "");

    const drawTemplate = () => {
      doc.setDrawColor(220, 228, 239);
      doc.setLineWidth(0.8);
      doc.roundedRect(22, 22, pageWidth - 44, pageHeight - 44, 6, 6);
      doc.setFillColor(246, 248, 251);
      doc.rect(23, 23, pageWidth - 46, 54, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(35, 50, 68);
      doc.text("IT Request Analytics Dashboard", margin, 48);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(91, 105, 124);
      doc.text("Detailed export from validated dashboard data", pageWidth - margin, 48, { align: "right" });
    };

    drawTemplate();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(45, 103, 157);
    doc.text(`Topic: ${topic}`, margin, 98);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(91, 105, 124);
    doc.text(`Rows: ${rows.length} detailed request records`, margin, 116);

    if (rows.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(91, 105, 124);
      doc.text("No data available", margin, 146);
    } else {
      const columns = Object.keys(rows[0]);
      const body = rows.map((row) =>
        columns.map((column) => {
          const value = row[column];
          if (typeof value === "number" || typeof value === "string") return value;
          if (value === null || value === undefined) return "";
          return String(value);
        })
      );
      autoTable(doc, {
        startY: 136,
        margin: { left: margin, right: margin, bottom: 38 },
        head: [columns],
        body,
        styles: {
          fontSize: 7.5,
          cellPadding: 4,
          lineColor: [226, 232, 240],
          lineWidth: 0.25,
          textColor: [55, 65, 81],
          overflow: "linebreak",
          valign: "top"
        },
        headStyles: {
          fillColor: [231, 240, 251],
          textColor: [45, 103, 157],
          fontStyle: "bold",
          lineColor: [210, 222, 238],
          lineWidth: 0.4
        },
        alternateRowStyles: { fillColor: [250, 252, 255] },
        columnStyles: {
          ID: { cellWidth: 48 },
          Department: { cellWidth: 112 },
          Type: { cellWidth: 72 },
          Date: { cellWidth: 58 },
          Category: { cellWidth: 74 },
          Status: { cellWidth: 70 },
          Amount: { cellWidth: 72 },
          Description: { cellWidth: "auto" }
        },
        didDrawPage: () => {
          drawTemplate();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(120, 132, 150);
          doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 30, { align: "right" });
        }
      });
    }
    doc.save(`${slug(title)}.pdf`);
  }

  const exportPageRows = (scope: ExportScope) => rowsForExport(scope === "all" ? unfilteredPageRows : pageRows);
  const clearFilters = () => {
    setSelectedDepartments(allDepartments);
    setRequestSort("desc");
    setSpendSort("desc");
    setSelectedRequestTerms([]);
    setCompareDepartments(defaultCompareDepartments);
    setSearch("");
    setTimelineMode("monthly");
    setFromMonth(months[0] || "");
    setToMonth(months[months.length - 1] || "");
  };
  const selectedTemplate = (id: string, fallback: ChartTemplate, options: ChartTemplateOption[]) => {
    const saved = chartTemplates[id];
    return saved && options.some((option) => option.value === saved) ? saved : fallback;
  };
  const setChartTemplate = (id: string, value: ChartTemplate) => {
    setChartTemplates((current) => ({ ...current, [id]: value }));
  };
  const chartTemplateProps = (id: string, fallback: ChartTemplate, options: ChartTemplateOption[]) => ({
    templateOptions: options,
    selectedTemplate: selectedTemplate(id, fallback, options),
    onTemplateChange: (value: ChartTemplate) => setChartTemplate(id, value)
  });

  return (
    <div className="min-h-screen overflow-x-hidden">
      {sidebarOpen && <button className="no-print fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-[min(18rem,86vw)] flex-col border-r border-line bg-white/92 shadow-soft backdrop-blur transition-transform duration-300 lg:w-72 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-line px-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Analytics</p>
            <h1 className="text-lg font-semibold text-ink">IT Requests</h1>
          </div>
          <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <button
                key={page.id}
                onClick={() => {
                  setActivePage(page.id);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                  activePage === page.id ? "bg-[#e7f0fb] text-[#2d679d]" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                {page.id}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-line bg-white/82 backdrop-blur">
          <div className="flex min-h-20 flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button className="no-print rounded-md border border-line bg-white p-2.5 text-slate-600 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{activePage}</p>
                <h2 className="text-xl font-semibold leading-tight text-ink sm:text-2xl xl:text-3xl">IT Request Analytics Dashboard</h2>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:items-center lg:justify-end">
              <button
                className="btn-secondary no-print justify-center"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                {theme === "light" ? "Dark" : "Light"}
              </button>
              <ExportCluster
                onPdfAll={() => exportPdf(`${activePage} - Export All`, exportPageRows("all"))}
                onPdfFiltered={() => exportPdf(`${activePage} - Export Filtered`, exportPageRows("filtered"))}
                onExcelAll={() => exportExcel(`${activePage} - Export All`, exportPageRows("all"))}
                onExcelFiltered={() => exportExcel(`${activePage} - Export Filtered`, exportPageRows("filtered"))}
              />
            </div>
          </div>
        </header>

        <div className="w-full max-w-[1800px] space-y-5 px-3 py-4 sm:space-y-6 sm:px-5 sm:py-6 lg:px-7 xl:px-8">
          {activePage !== "Dashboard" && (
            <FilterPanel
              activePage={activePage}
              selectedDepartments={selectedDepartments}
              setSelectedDepartments={setSelectedDepartments}
              requestSort={requestSort}
              setRequestSort={setRequestSort}
              spendSort={spendSort}
              setSpendSort={setSpendSort}
              selectedRequestTerms={selectedRequestTerms}
              setSelectedRequestTerms={setSelectedRequestTerms}
              search={search}
              setSearch={setSearch}
              timelineMode={timelineMode}
              setTimelineMode={setTimelineMode}
              fromMonth={fromMonth}
              toMonth={toMonth}
              setFromMonth={setFromMonth}
              setToMonth={setToMonth}
              filtersOpen={filtersOpen}
              setFiltersOpen={setFiltersOpen}
              clearFilters={clearFilters}
            />
          )}

          <AnimatePresence mode="wait">
            <motion.section
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="space-y-6"
            >
              {!ready ? (
                <LoadingGrid />
              ) : (
                <>
                  {activePage === "Dashboard" && (
                    <>
                      <KpiGrid />
                      <ChartGrid>
                        <ChartPanel
                          id="dept-requests"
                          title="Department-wise Requests"
                          variant="wide"
                          data={departmentRequests}
                          table={tableModes["dept-requests"]}
                          compare={compareModes["dept-requests"]}
                          tableRows={pageRows}
                          compareDepartments={compareDepartments}
                          setCompareDepartments={setCompareDepartments}
                          {...chartTemplateProps("dept-requests", compareModes["dept-requests"] ? "stacked-bar" : "horizontal-bar", compareModes["dept-requests"] ? compareOptions : horizontalBarOptions)}
                          onToggleTable={() => toggle(setTableModes, "dept-requests")}
                          onToggleCompare={() => toggle(setCompareModes, "dept-requests")}
                          onPdf={() => exportPdf("Department-wise Requests", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Department-wise Requests", rowsForExport(pageRows))}
                        >
                          {compareModes["dept-requests"] ? (
                            <CompareChart template={selectedTemplate("dept-requests", "stacked-bar", compareOptions)} data={compareTypeRows} />
                          ) : (
                            <MetricChart template={selectedTemplate("dept-requests", "horizontal-bar", horizontalBarOptions)} data={departmentRequests} valueKey="requests" />
                          )}
                        </ChartPanel>
                        <ChartPanel
                          id="monthly-trend"
                          title="Monthly Trend Line"
                          variant="standard"
                          data={trendRows}
                          table={tableModes["monthly-trend"]}
                          tableRows={pageRows}
                          {...chartTemplateProps("monthly-trend", "line", lineOptions)}
                          onToggleTable={() => toggle(setTableModes, "monthly-trend")}
                          onPdf={() => exportPdf("Monthly Trend Line", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Monthly Trend Line", rowsForExport(pageRows))}
                        >
                          <TrendChart template={selectedTemplate("monthly-trend", "line", lineOptions)} data={trendRows} valueKey="requests" />
                        </ChartPanel>
                        <ChartPanel
                          id="spend-dept"
                          title="Spend by Department"
                          variant="wide"
                          data={departmentSpend}
                          table={tableModes["spend-dept"]}
                          compare={compareModes["spend-dept"]}
                          tableRows={pageRows}
                          compareDepartments={compareDepartments}
                          setCompareDepartments={setCompareDepartments}
                          {...chartTemplateProps("spend-dept", compareModes["spend-dept"] ? "stacked-bar" : "horizontal-bar", compareModes["spend-dept"] ? compareOptions : spendBarOptions)}
                          onToggleTable={() => toggle(setTableModes, "spend-dept")}
                          onToggleCompare={() => toggle(setCompareModes, "spend-dept")}
                          onPdf={() => exportPdf("Spend by Department", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Spend by Department", rowsForExport(pageRows))}
                        >
                          {compareModes["spend-dept"] ? (
                            <CompareChart template={selectedTemplate("spend-dept", "stacked-bar", compareOptions)} data={compareTypeRows} />
                          ) : (
                            <MetricChart template={selectedTemplate("spend-dept", "horizontal-bar", spendBarOptions)} data={departmentSpend} valueKey="spend" />
                          )}
                        </ChartPanel>
                        <ChartPanel
                          id="request-category"
                          title="Request Category"
                          variant="compact"
                          data={categoryRows}
                          table={tableModes["request-category"]}
                          compare={compareModes["request-category"]}
                          tableRows={pageRows}
                          compareDepartments={compareDepartments}
                          setCompareDepartments={setCompareDepartments}
                          {...chartTemplateProps("request-category", compareModes["request-category"] ? "stacked-bar" : "donut", compareModes["request-category"] ? compareOptions : donutOptions)}
                          onToggleTable={() => toggle(setTableModes, "request-category")}
                          onToggleCompare={() => toggle(setCompareModes, "request-category")}
                          onPdf={() => exportPdf("Request Category", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Request Category", rowsForExport(pageRows))}
                        >
                          {compareModes["request-category"] ? (
                            <CompareChart template={selectedTemplate("request-category", "stacked-bar", compareOptions)} data={compareTypeRows} />
                          ) : (
                            <MetricChart template={selectedTemplate("request-category", "donut", donutOptions)} data={categoryRows} valueKey="requests" />
                          )}
                        </ChartPanel>
                      </ChartGrid>
                      <Insights insights={summaryInsights} />
                    </>
                  )}

                  {activePage === "IT Requests" && (
                    <ChartGrid>
                      <ChartPanel id="request-status" title="Request Status Overview" variant="compact" data={statusRows} table={tableModes["request-status"]} tableRows={pageRows} {...chartTemplateProps("request-status", "donut", donutOptions)} onToggleTable={() => toggle(setTableModes, "request-status")} onPdf={() => exportPdf("Request Status Overview", rowsForExport(pageRows))} onExcel={() => exportExcel("Request Status Overview", rowsForExport(pageRows))}>
                        <MetricChart template={selectedTemplate("request-status", "donut", donutOptions)} data={statusRows} valueKey="requests" />
                      </ChartPanel>
                      <ChartPanel id="request-dept" title="Department-wise Requests" variant="wide" data={departmentRequests} table={tableModes["request-dept"]} compare={compareModes["request-dept"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("request-dept", compareModes["request-dept"] ? "stacked-bar" : "horizontal-bar", compareModes["request-dept"] ? compareOptions : horizontalBarOptions)} onToggleTable={() => toggle(setTableModes, "request-dept")} onToggleCompare={() => toggle(setCompareModes, "request-dept")} onPdf={() => exportPdf("Department-wise Requests", rowsForExport(pageRows))} onExcel={() => exportExcel("Department-wise Requests", rowsForExport(pageRows))}>
                        {compareModes["request-dept"] ? (
                          <CompareChart template={selectedTemplate("request-dept", "stacked-bar", compareOptions)} data={compareTypeRows} />
                        ) : (
                          <MetricChart template={selectedTemplate("request-dept", "horizontal-bar", horizontalBarOptions)} data={departmentRequests} valueKey="requests" />
                        )}
                      </ChartPanel>
                      <ChartPanel id="request-type" title="Request Category/Type Breakdown" variant="compact" data={typeRows} table={tableModes["request-type"]} tableRows={pageRows} {...chartTemplateProps("request-type", "donut", donutOptions)} onToggleTable={() => toggle(setTableModes, "request-type")} onPdf={() => exportPdf("Request Type Breakdown", rowsForExport(pageRows))} onExcel={() => exportExcel("Request Type Breakdown", rowsForExport(pageRows))}>
                        <MetricChart template={selectedTemplate("request-type", "donut", donutOptions)} data={typeRows} valueKey="requests" />
                      </ChartPanel>
                      <RequestTable title="Matching Requests" rows={sortedRequests} onPdf={(exportRows) => exportPdf("Matching Requests", rowsForExport(exportRows))} onExcel={(exportRows) => exportExcel("Matching Requests", rowsForExport(exportRows))} />
                    </ChartGrid>
                  )}

                  {activePage === "Budget" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <MiniKpi title="Total Spend Overview" value={formatINR(data.kpis.totalSpend.value)} icon={<IndianRupee size={20} />} />
                        <MiniKpi title="Known Row Spend" value={formatINR(pageRows.reduce((sum, row) => sum + (row.amount || 0), 0))} icon={<WalletCards size={20} />} />
                      </div>
                      <ChartGrid>
                        <ChartPanel id="budget-dept" title="Spend by Department" variant="wide" data={departmentSpend} table={tableModes["budget-dept"]} compare={compareModes["budget-dept"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("budget-dept", compareModes["budget-dept"] ? "stacked-bar" : "horizontal-bar", compareModes["budget-dept"] ? compareOptions : spendBarOptions)} onToggleTable={() => toggle(setTableModes, "budget-dept")} onToggleCompare={() => toggle(setCompareModes, "budget-dept")} onPdf={() => exportPdf("Spend by Department", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend by Department", rowsForExport(pageRows))}>
                          {compareModes["budget-dept"] ? (
                            <CompareChart template={selectedTemplate("budget-dept", "stacked-bar", compareOptions)} data={compareTypeRows} />
                          ) : (
                            <MetricChart template={selectedTemplate("budget-dept", "horizontal-bar", spendBarOptions)} data={departmentSpend} valueKey="spend" />
                          )}
                        </ChartPanel>
                        <ChartPanel id="budget-category" title="Spend by Request/Category" variant="compact" data={spendCategoryRows} table={tableModes["budget-category"]} compare={compareModes["budget-category"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("budget-category", compareModes["budget-category"] ? "stacked-bar" : "donut", compareModes["budget-category"] ? compareOptions : donutOptions)} onToggleTable={() => toggle(setTableModes, "budget-category")} onToggleCompare={() => toggle(setCompareModes, "budget-category")} onPdf={() => exportPdf("Spend by Category", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend by Category", rowsForExport(pageRows))}>
                          {compareModes["budget-category"] ? (
                            <CompareChart template={selectedTemplate("budget-category", "stacked-bar", compareOptions)} data={compareTypeRows} />
                          ) : (
                            <MetricChart template={selectedTemplate("budget-category", "donut", donutOptions)} data={spendCategoryRows} valueKey="spend" />
                          )}
                        </ChartPanel>
                        <ChartPanel id="budget-trend" title="Spend Trends Over Time" variant="standard" data={trendRows} table={tableModes["budget-trend"]} tableRows={pageRows} {...chartTemplateProps("budget-trend", "area", areaOptions)} onToggleTable={() => toggle(setTableModes, "budget-trend")} onPdf={() => exportPdf("Spend Trends", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend Trends", rowsForExport(pageRows))}>
                          <TrendChart template={selectedTemplate("budget-trend", "area", areaOptions)} data={trendRows} valueKey="spend" />
                        </ChartPanel>
                      </ChartGrid>
                    </>
                  )}

                  {activePage === "Departments" && (
                    <ChartGrid>
                      <ChartPanel id="dept-view-requests" title="Department Requests" variant="wide" data={departmentRequests} table={tableModes["dept-view-requests"]} compare={compareModes["dept-view-requests"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("dept-view-requests", compareModes["dept-view-requests"] ? "stacked-bar" : "horizontal-bar", compareModes["dept-view-requests"] ? compareOptions : horizontalBarOptions)} onToggleTable={() => toggle(setTableModes, "dept-view-requests")} onToggleCompare={() => toggle(setCompareModes, "dept-view-requests")} onPdf={() => exportPdf("Department Requests", rowsForExport(pageRows))} onExcel={() => exportExcel("Department Requests", rowsForExport(pageRows))}>
                        {compareModes["dept-view-requests"] ? (
                          <CompareChart template={selectedTemplate("dept-view-requests", "stacked-bar", compareOptions)} data={compareTypeRows} />
                        ) : (
                          <MetricChart template={selectedTemplate("dept-view-requests", "horizontal-bar", horizontalBarOptions)} data={departmentRequests} valueKey="requests" />
                        )}
                      </ChartPanel>
                      <ChartPanel id="dept-view-spend" title="Department Spend" variant="wide" data={departmentSpend} table={tableModes["dept-view-spend"]} compare={compareModes["dept-view-spend"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("dept-view-spend", compareModes["dept-view-spend"] ? "stacked-bar" : "horizontal-bar", compareModes["dept-view-spend"] ? compareOptions : spendBarOptions)} onToggleTable={() => toggle(setTableModes, "dept-view-spend")} onToggleCompare={() => toggle(setCompareModes, "dept-view-spend")} onPdf={() => exportPdf("Department Spend", rowsForExport(pageRows))} onExcel={() => exportExcel("Department Spend", rowsForExport(pageRows))}>
                        {compareModes["dept-view-spend"] ? (
                          <CompareChart template={selectedTemplate("dept-view-spend", "stacked-bar", compareOptions)} data={compareTypeRows} />
                        ) : (
                          <MetricChart template={selectedTemplate("dept-view-spend", "horizontal-bar", spendBarOptions)} data={departmentSpend} valueKey="spend" />
                        )}
                      </ChartPanel>
                    </ChartGrid>
                  )}

                  {activePage === "Trends" && (
                    <ChartGrid>
                      <ChartPanel id="trend-requests" title={`${labelTimeline(timelineMode)} Request Trends`} variant={compareModes["trend-requests"] ? "wide" : "standard"} data={trendRows} table={tableModes["trend-requests"]} compare={compareModes["trend-requests"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("trend-requests", compareModes["trend-requests"] ? "stacked-bar" : "line", compareModes["trend-requests"] ? compareOptions : lineOptions)} onToggleTable={() => toggle(setTableModes, "trend-requests")} onToggleCompare={() => toggle(setCompareModes, "trend-requests")} onPdf={() => exportPdf("Request Trends", rowsForExport(pageRows))} onExcel={() => exportExcel("Request Trends", rowsForExport(pageRows))}>
                        {compareModes["trend-requests"] ? (
                          <CompareChart template={selectedTemplate("trend-requests", "stacked-bar", compareOptions)} data={compareTypeRows} />
                        ) : (
                          <TrendChart template={selectedTemplate("trend-requests", "line", lineOptions)} data={trendRows} valueKey="requests" />
                        )}
                      </ChartPanel>
                      <ChartPanel id="trend-spend" title={`${labelTimeline(timelineMode)} Spend Trends`} variant="standard" data={trendRows} table={tableModes["trend-spend"]} tableRows={pageRows} {...chartTemplateProps("trend-spend", "area", areaOptions)} onToggleTable={() => toggle(setTableModes, "trend-spend")} onPdf={() => exportPdf("Spend Trends", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend Trends", rowsForExport(pageRows))}>
                        <TrendChart template={selectedTemplate("trend-spend", "area", areaOptions)} data={trendRows} valueKey="spend" />
                      </ChartPanel>
                      <ChartPanel id="trend-category" title="Request Category Comparison" variant="wide" data={categoryRows} table={tableModes["trend-category"]} compare={compareModes["trend-category"]} tableRows={pageRows} compareDepartments={compareDepartments} setCompareDepartments={setCompareDepartments} {...chartTemplateProps("trend-category", compareModes["trend-category"] ? "stacked-bar" : "horizontal-bar", compareModes["trend-category"] ? compareOptions : horizontalBarOptions)} onToggleTable={() => toggle(setTableModes, "trend-category")} onToggleCompare={() => toggle(setCompareModes, "trend-category")} onPdf={() => exportPdf("Category Comparison", rowsForExport(pageRows))} onExcel={() => exportExcel("Category Comparison", rowsForExport(pageRows))}>
                        {compareModes["trend-category"] ? (
                          <CompareChart template={selectedTemplate("trend-category", "stacked-bar", compareOptions)} data={compareTypeRows} />
                        ) : (
                          <MetricChart template={selectedTemplate("trend-category", "horizontal-bar", horizontalBarOptions)} data={categoryRows} valueKey="requests" />
                        )}
                      </ChartPanel>
                    </ChartGrid>
                  )}
                </>
              )}
            </motion.section>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function scopedRows(page: string, rows: RequestRow[]) {
  if (page === "Budget") return rows.filter((row) => row.amount !== null);
  return rows;
}

function toggle(setter: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void, key: string) {
  setter((current) => ({ ...current, [key]: !current[key] }));
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function labelTimeline(mode: TimelineMode) {
  return mode === "monthly" ? "Monthly" : mode === "quarterly" ? "Quarterly" : "Yearly";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function groupDepartmentTypes(rows: RequestRow[], departments: string[]) {
  return departments.map((department) => {
    const departmentRows = rows.filter((row) => row.department === department);
    return {
      name: department,
      Development: departmentRows.filter((row) => row.type === "Development").length,
      Subscription: departmentRows.filter((row) => row.type === "Subscription").length,
      Software: departmentRows.filter((row) => row.type === "Software").length,
      requests: departmentRows.length,
      spend: departmentRows.reduce((sum, row) => sum + (row.amount || 0), 0)
    };
  });
}

function ExportCluster({ onPdfAll, onPdfFiltered, onExcelAll, onExcelFiltered }: { onPdfAll: () => void; onPdfFiltered: () => void; onExcelAll: () => void; onExcelFiltered: () => void }) {
  return (
    <div className="no-print grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
      <button className="btn-secondary justify-center" onClick={onPdfAll}><FileDown size={16} /> PDF All</button>
      <button className="btn-primary justify-center" onClick={onPdfFiltered}><Download size={16} /> PDF Filtered</button>
      <button className="btn-secondary justify-center" onClick={onExcelAll}><FileSpreadsheet size={16} /> Excel All</button>
      <button className="btn-secondary justify-center" onClick={onExcelFiltered}><FileSpreadsheet size={16} /> Excel Filtered</button>
    </div>
  );
}

function FilterPanel(props: {
  activePage: string;
  selectedDepartments: string[];
  setSelectedDepartments: (value: string[]) => void;
  requestSort: SortDirection;
  setRequestSort: (value: SortDirection) => void;
  spendSort: SortDirection;
  setSpendSort: (value: SortDirection) => void;
  selectedRequestTerms: string[];
  setSelectedRequestTerms: (value: string[]) => void;
  search: string;
  setSearch: (value: string) => void;
  timelineMode: TimelineMode;
  setTimelineMode: (value: TimelineMode) => void;
  fromMonth: string;
  toMonth: string;
  setFromMonth: (value: string) => void;
  setToMonth: (value: string) => void;
  filtersOpen: boolean;
  setFiltersOpen: (value: boolean) => void;
  clearFilters: () => void;
}) {
  const showTimeline = true;
  const [requestTermsOpen, setRequestTermsOpen] = useState(false);
  const selectedCount = props.selectedDepartments.length;
  const allSelected = selectedCount === allDepartments.length;

  function toggleDepartment(department: string) {
    if (props.selectedDepartments.includes(department)) {
      props.setSelectedDepartments(props.selectedDepartments.filter((item) => item !== department));
    } else {
      props.setSelectedDepartments([...props.selectedDepartments, department]);
    }
  }

  function toggleRequestTerm(term: string) {
    if (props.selectedRequestTerms.includes(term)) {
      props.setSelectedRequestTerms(props.selectedRequestTerms.filter((item) => item !== term));
    } else {
      props.setSelectedRequestTerms([...props.selectedRequestTerms, term]);
    }
  }

  return (
    <section className="no-print relative rounded-lg border border-line bg-white/90 p-3 shadow-soft sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="w-full space-y-1 lg:max-w-xl">
          <span className="text-xs font-semibold uppercase text-slate-500">Search Requests</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="field pl-9" value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search request" />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button className="btn-primary justify-center" onClick={() => props.setFiltersOpen(!props.filtersOpen)}>
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <button className="btn-secondary justify-center" onClick={props.clearFilters}>Clear Filters</button>
        </div>
      </div>

      {props.filtersOpen && (
        <div className="mt-4 max-h-[72vh] w-full overflow-y-auto rounded-lg border border-line bg-white p-3 shadow-soft sm:p-4 md:absolute md:right-4 md:top-[calc(100%-8px)] md:z-30 md:mt-0 md:w-[min(720px,calc(100vw-2rem))]">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase text-slate-500">Departments</span>
                <button
                  className="text-xs font-semibold text-[#2d679d]"
                  onClick={() => props.setSelectedDepartments(allSelected ? [] : allDepartments)}
                >
                  {allSelected ? "Unselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-line p-2">
                {allDepartments.map((department) => (
                  <label key={department} className="flex min-h-11 items-start gap-2 rounded-md px-2 py-2 text-sm leading-6 text-slate-700 hover:bg-slate-50">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={props.selectedDepartments.includes(department)}
                      onChange={() => toggleDepartment(department)}
                    />
                    <span>{department}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{selectedCount} departments selected</p>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Requests</span>
              <select className="field" value={props.requestSort} onChange={(event) => props.setRequestSort(event.target.value as SortDirection)}>
                <option value="desc">High to low</option>
                <option value="asc">Low to high</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Spend</span>
              <select className="field" value={props.spendSort} onChange={(event) => props.setSpendSort(event.target.value as SortDirection)}>
                <option value="desc">High to low</option>
                <option value="asc">Low to high</option>
              </select>
            </label>
          </div>

          {props.activePage === "IT Requests" && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Requests</span>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Filter by exact request terms from the raw PDF.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-compact" onClick={() => setRequestTermsOpen(!requestTermsOpen)}>
                    {requestTermsOpen ? "Hide Terms" : "Open Terms"}
                  </button>
                  <button className="btn-compact" onClick={() => props.setSelectedRequestTerms([])}>
                    Clear Terms
                  </button>
                </div>
              </div>

              {requestTermsOpen && (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {requestTermGroups.map((group) => (
                    <div key={group.title} className="rounded-lg border border-line p-3">
                      <h4 className="text-sm font-semibold text-ink">{group.title}</h4>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.terms.map((term) => {
                          const key = `${group.scope}:${term}`;
                          const selected = props.selectedRequestTerms.includes(key);
                          return (
                            <button
                              key={key}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold leading-5 transition ${
                                selected ? "border-[#79a7d8] bg-[#e7f0fb] text-[#2d679d]" : "border-line bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              onClick={() => toggleRequestTerm(key)}
                            >
                              {term}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {props.selectedRequestTerms.length > 0 && (
                <p className="mt-3 text-xs leading-5 text-slate-500">{props.selectedRequestTerms.length} request term filters active.</p>
              )}
            </div>
          )}

          {showTimeline && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Timeline</span>
                  <div className="grid grid-cols-2 rounded-lg border border-line bg-slate-50 p-1 sm:grid-cols-4">
                    {(["monthly", "quarterly", "yearly"] as TimelineMode[]).map((mode) => (
                      <button key={mode} className={`flex-1 rounded-md px-3 py-2 text-sm capitalize ${props.timelineMode === mode ? "bg-white text-[#2d679d] shadow-sm" : "text-slate-600"}`} onClick={() => props.setTimelineMode(mode)}>
                        {mode}
                      </button>
                    ))}
                    <button className="flex-1 rounded-md px-3 py-2 text-sm text-slate-400" disabled title="Daily request counts are unavailable because the raw PDF contains month-year dates only.">
                      daily
                    </button>
                  </div>
                </div>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">From Date</span>
                  <input className="field" type="month" value={props.fromMonth} min={months[0]} max={months[months.length - 1]} onChange={(event) => props.setFromMonth(event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">To Date</span>
                  <input className="field" type="month" value={props.toMonth} min={months[0]} max={months[months.length - 1]} onChange={(event) => props.setToMonth(event.target.value)} />
                </label>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Day-wise filtering unavailable: the raw PDF provides exact month-year fields, not day-level dates.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function KpiGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MiniKpi title="Total Requests" value={String(data.kpis.totalRequests.value)} icon={<BarChart3 size={20} />} tone="blue" />
      <MiniKpi title="Department with Most Requests" value={`${data.kpis.departmentWithMostRequests.value} (${data.kpis.departmentWithMostRequests.requests})`} icon={<Building2 size={20} />} tone="green" />
      <MiniKpi title="Total Spend" value={formatINR(data.kpis.totalSpend.value)} icon={<IndianRupee size={20} />} tone="rose" />
    </div>
  );
}

function MiniKpi({ title, value, icon, tone = "blue" }: { title: string; value: string; icon: React.ReactNode; tone?: "blue" | "green" | "rose" }) {
  const tones = {
    blue: "bg-[#e7f0fb] text-[#2d679d]",
    green: "bg-[#e8f5ee] text-[#2f7a52]",
    rose: "bg-[#fff0f2] text-[#a04d62]"
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="print-panel rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 break-words text-xl font-semibold text-ink sm:text-2xl">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${tones[tone]}`}>{icon}</div>
      </div>
    </motion.div>
  );
}

function ChartGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-flow-dense items-start gap-4 lg:grid-cols-12 xl:gap-5">{children}</div>;
}

function panelSpan(variant: PanelVariant) {
  const spans: Record<PanelVariant, string> = {
    compact: "lg:col-span-6 xl:col-span-4",
    standard: "lg:col-span-6",
    wide: "lg:col-span-12 xl:col-span-8",
    full: "lg:col-span-12"
  };
  return spans[variant];
}

function panelViewport(variant: PanelVariant, template?: ChartTemplate) {
  if (template === "donut" || template === "pie") return "h-[18rem] sm:h-[20rem]";
  if (template === "line" || template === "area") return "h-[23rem] sm:h-[27rem]";
  if (template === "horizontal-bar" || template === "stacked-bar" || template === "grouped-bar") return "h-[24rem] sm:h-[28rem]";
  if (template === "vertical-bar") return "h-[22rem] sm:h-[25rem]";

  const heights: Record<PanelVariant, string> = {
    compact: "h-[20rem] sm:h-80",
    standard: "h-[22rem] sm:h-96",
    wide: "h-[24rem] sm:h-[28rem]",
    full: "h-[26rem] sm:h-[30rem]"
  };
  return heights[variant];
}

function chartCanvasHeight() {
  return "100%";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function chartHandlesOwnHeight(template?: ChartTemplate) {
  return template === "horizontal-bar" || template === "stacked-bar" || template === "grouped-bar";
}

function useChartResize() {
  return useContext(ChartResizeContext);
}

function barRowHeight(count: number) {
  if (count <= 2) return 72;
  if (count <= 6) return 56;
  if (count <= 14) return 44;
  return 38;
}

function barSize(count: number) {
  if (count <= 2) return 26;
  if (count <= 6) return 30;
  if (count <= 14) return 32;
  return 34;
}

function ChartPanel({
  id,
  title,
  variant = "standard",
  data: rows,
  tableRows,
  table,
  compare = false,
  compareDepartments,
  setCompareDepartments,
  templateOptions,
  selectedTemplate,
  onTemplateChange,
  children,
  onToggleTable,
  onToggleCompare,
  onPdf,
  onExcel
}: {
  id: string;
  title: string;
  variant?: PanelVariant;
  data: Record<string, unknown>[];
  tableRows?: RequestRow[];
  table?: boolean;
  compare?: boolean;
  compareDepartments?: string[];
  setCompareDepartments?: (value: string[]) => void;
  templateOptions?: ChartTemplateOption[];
  selectedTemplate?: ChartTemplate;
  onTemplateChange?: (value: ChartTemplate) => void;
  children: React.ReactNode;
  onToggleTable: () => void;
  onToggleCompare?: () => void;
  onPdf: () => void;
  onExcel: () => void;
}) {
  const [chartResize, setChartResize] = useState<ChartResize>({ widthScale: 1, heightScale: 1 });
  const chartOwnsHeight = chartHandlesOwnHeight(selectedTemplate);

  function startChartResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = chartResize.widthScale;
    const startHeight = chartResize.heightScale;

    function onMove(moveEvent: PointerEvent) {
      setChartResize({
        widthScale: clamp(startWidth + (moveEvent.clientX - startX) / 420, 1, 1.8),
        heightScale: clamp(startHeight + (moveEvent.clientY - startY) / 320, 0.8, 2.4)
      });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <section id={id} className={`print-panel min-w-0 rounded-lg border border-line bg-white p-3 shadow-soft sm:p-4 ${panelSpan(variant)}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="text-sm text-slate-500">{rows.length ? `${rows.length} data points` : "No data available"}</p>
        </div>
        <div className="no-print grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {templateOptions && selectedTemplate && onTemplateChange && (
            <select
              className="field col-span-2 h-10 min-w-44 py-1.5 text-xs font-semibold sm:col-span-1 sm:w-auto"
              value={selectedTemplate}
              onChange={(event) => onTemplateChange(event.target.value as ChartTemplate)}
              aria-label={`${title} chart template`}
            >
              {templateOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          {onToggleCompare && (
            <button className={`btn-compact justify-center ${compare ? "bg-[#e8f5ee] text-[#2f7a52]" : ""}`} onClick={onToggleCompare}>
              Compare Mode
            </button>
          )}
          <button className="btn-compact justify-center" onClick={onToggleTable}><Table2 size={15} /> View as Table</button>
          <button className="icon-btn" onClick={onPdf} aria-label={`Export ${title} PDF`}><FileDown size={16} /></button>
          <button className="icon-btn" onClick={onExcel} aria-label={`Export ${title} Excel`}><FileSpreadsheet size={16} /></button>
        </div>
      </div>
      {compare && compareDepartments && setCompareDepartments && (
        <CompareDepartmentPicker selectedDepartments={compareDepartments} setSelectedDepartments={setCompareDepartments} />
      )}
      {rows.length === 0 ? (
        <EmptyState />
      ) : table ? (
        <DataTable rows={rowsForExport(tableRows || [])} />
      ) : (
        <div className={`chart-pop relative ${panelViewport(variant, selectedTemplate)} overflow-auto overscroll-contain rounded-lg border border-line bg-white/40 p-1`}>
          <ChartResizeContext.Provider value={chartResize}>
            <div
              style={{
                height: chartOwnsHeight ? chartCanvasHeight() : `${chartResize.heightScale * 100}%`,
                minHeight: "100%",
                minWidth: "100%",
                width: `${chartResize.widthScale * 100}%`
              }}
            >
              {children}
            </div>
          </ChartResizeContext.Provider>
          <button
            type="button"
            className="chart-resize-handle no-print min-h-0"
            onPointerDown={startChartResize}
            onDoubleClick={() => setChartResize({ widthScale: 1, heightScale: 1 })}
            aria-label={`Resize ${title} chart`}
            title="Drag to resize chart canvas. Double-click to reset."
          />
        </div>
      )}
    </section>
  );
}

function CompareDepartmentPicker({
  selectedDepartments,
  setSelectedDepartments
}: {
  selectedDepartments: string[];
  setSelectedDepartments: (value: string[]) => void;
}) {
  function toggleDepartment(department: string) {
    if (selectedDepartments.includes(department)) {
      setSelectedDepartments(selectedDepartments.filter((item) => item !== department));
    } else {
      setSelectedDepartments([...selectedDepartments, department]);
    }
  }

  return (
    <div className="no-print mb-4 rounded-lg border border-line bg-[#f8fafc] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Compare Departments</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Selected departments appear as stacked bars split by request type.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-compact" onClick={() => setSelectedDepartments(defaultCompareDepartments)}>Top Departments</button>
          <button className="btn-compact" onClick={() => setSelectedDepartments([])}>Clear</button>
        </div>
      </div>
      <div className="flex max-h-32 flex-wrap gap-2 overflow-auto">
        {allDepartments.map((department) => {
          const selected = selectedDepartments.includes(department);
          return (
            <button
              key={department}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold leading-5 transition ${
                selected ? "border-[#79a7d8] bg-[#e7f0fb] text-[#2d679d]" : "border-line bg-white text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => toggleDepartment(department)}
            >
              {department}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <EmptyState />;
  const keys = Object.keys(rows[0]);
  return (
    <div className="max-h-80 max-w-full overflow-auto overscroll-x-contain rounded-lg border border-line">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{keys.map((key) => <th key={key} className="border-b border-line px-2.5 py-2 sm:px-3">{key}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-white even:bg-slate-50/60">
              {keys.map((key) => <td key={key} className="border-b border-line px-2.5 py-2.5 leading-6 text-slate-700 sm:px-3 sm:py-3">{String(row[key] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestTable({
  title,
  rows,
  onPdf,
  onExcel
}: {
  title: string;
  rows: RequestRow[];
  onPdf: (rows: RequestRow[]) => void;
  onExcel: (rows: RequestRow[]) => void;
}) {
  const [tableSearch, setTableSearch] = useState("");
  const visibleRows = useMemo(() => {
    const normalized = tableSearch.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.id, row.department, row.type, row.category, row.status, row.month, row.description, row.amountRaw]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [rows, tableSearch]);

  return (
    <section className="print-panel min-w-0 rounded-lg border border-line bg-white p-3 shadow-soft sm:p-4 lg:col-span-12">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-slate-500">{visibleRows.length} of {rows.length} requests</p>
        </div>
        <div className="no-print flex gap-2">
          <button className="icon-btn" onClick={() => onPdf(visibleRows)} aria-label="Export table PDF"><FileDown size={16} /></button>
          <button className="icon-btn" onClick={() => onExcel(visibleRows)} aria-label="Export table Excel"><FileSpreadsheet size={16} /></button>
        </div>
      </div>
      <label className="no-print mb-4 block max-w-xl space-y-1">
        <span className="text-xs font-semibold uppercase text-slate-500">Search Matching Requests</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="field pl-9" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Search inside matching requests" />
        </div>
      </label>
      <DataTable rows={rowsForExport(visibleRows)} />
    </section>
  );
}

function EmptyState() {
  return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-slate-50 px-4 text-center text-sm text-slate-500 sm:h-80">No data available</div>;
}

function NoData({ title }: { title: string }) {
  return (
    <section className="print-panel min-w-0 rounded-lg border border-line bg-white p-3 shadow-soft sm:p-4 lg:col-span-6 xl:col-span-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-4"><EmptyState /></div>
    </section>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:gap-5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-80 animate-pulse rounded-lg border border-line bg-white/70 p-4 shadow-soft">
          <div className="h-5 w-1/3 rounded bg-slate-200" />
          <div className="mt-8 h-56 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function Insights({ insights }: { insights: string[] }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
      <h3 className="text-base font-semibold">Show Insights</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {insights.map((item) => (
          <p key={item} className="rounded-lg bg-[#f6f8fb] p-3 text-sm text-slate-700">{item}</p>
        ))}
      </div>
    </section>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; payload?: Record<string, unknown> }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload[0]?.payload && typeof payload[0].payload.total === "number" ? payload[0].payload.total : null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-soft">
      <p className="font-semibold text-ink">{label || String(payload[0].payload?.name || "")}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-slate-600">
          {item.name}: {item.name.toLowerCase().includes("spend") ? formatINR(item.value) : item.value}
          {total ? ` (${((item.value / total) * 100).toFixed(1)}%)` : ""}
        </p>
      ))}
    </div>
  );
}

function wrapLabel(value: string, maxLength = 18) {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function WrappedYAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines = wrapLabel(String(payload?.value || ""), 20);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-8} y={0} textAnchor="end" fill="var(--muted)" fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={-8} dy={index === 0 ? -((lines.length - 1) * 7) : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function VerticalXAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <g transform={`translate(${x},${y + 10})`}>
      <text transform="rotate(-90)" textAnchor="end" fill="var(--muted)" fontSize={11}>
        {String(payload?.value || "")}
      </text>
    </g>
  );
}

function legendProps(isMobile: boolean) {
  return isMobile
    ? { align: "center" as const, verticalAlign: "bottom" as const, layout: "horizontal" as const }
    : { align: "right" as const, verticalAlign: "middle" as const, layout: "vertical" as const };
}

function axisFormatter(valueKey: "requests" | "spend") {
  return (value: number | string) => (valueKey === "spend" ? formatINR(Number(value), true) : String(value));
}

function barDomain(rows: Record<string, unknown>[], keys: string[]) {
  const maxValue = Math.max(
    0,
    ...rows.map((row) => keys.reduce((sum, key) => sum + Number(row[key] || 0), 0))
  );
  return Math.max(1, maxValue);
}

function BarScaleAxis({
  domainMax,
  isMobile,
  valueKey
}: {
  domainMax: number;
  isMobile: boolean;
  valueKey: "requests" | "spend";
}) {
  const yAxisWidth = isMobile ? 118 : 176;
  const rightMargin = isMobile ? 12 : 24;

  return (
    <div className="bar-sticky-axis h-12 flex-none bg-white/90">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[{ name: "axis" }]} layout="vertical" margin={{ top: 0, right: rightMargin, left: isMobile ? 0 : 12, bottom: 4 }}>
          <XAxis type="number" domain={[0, domainMax]} allowDecimals={valueKey === "spend"} tick={{ fontSize: 12 }} tickFormatter={axisFormatter(valueKey)} />
          <YAxis dataKey="name" type="category" width={yAxisWidth} tick={false} axisLine={false} tickLine={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartLegendList({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="bar-legend flex flex-wrap gap-2 px-2 pb-1 pt-2 text-xs font-semibold text-slate-600 md:w-28 md:flex-col md:justify-center md:px-0 md:py-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 leading-5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function MetricChart({
  template,
  data: rows,
  valueKey = "requests"
}: {
  template: ChartTemplate;
  data: Record<string, unknown>[];
  valueKey?: "requests" | "spend";
}) {
  if (template === "vertical-bar") return <VerticalBarViz data={rows} valueKey={valueKey} />;
  if (template === "donut") return <DonutViz data={rows} valueKey={valueKey} shape="donut" />;
  if (template === "pie") return <DonutViz data={rows} valueKey={valueKey} shape="pie" />;
  return <BarViz data={rows} valueKey={valueKey} />;
}

function TrendChart({
  template,
  data: rows,
  valueKey = "requests"
}: {
  template: ChartTemplate;
  data: Record<string, unknown>[];
  valueKey?: "requests" | "spend";
}) {
  if (template === "area") return <AreaViz data={rows} valueKey={valueKey} />;
  if (template === "vertical-bar") return <VerticalBarViz data={rows} valueKey={valueKey} />;
  return <LineViz data={rows} valueKey={valueKey} />;
}

function CompareChart({ template, data: rows }: { template: ChartTemplate; data: Record<string, unknown>[] }) {
  return <StackedDepartmentBar data={rows} mode={template === "grouped-bar" ? "grouped" : "stacked"} />;
}

function BarViz({ data: rows, valueKey }: { data: Record<string, unknown>[]; valueKey: "requests" | "spend" }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { heightScale } = useChartResize();
  const yAxisWidth = isMobile ? 118 : 176;
  const rightMargin = isMobile ? 12 : 24;
  const domainMax = barDomain(rows, [valueKey]);
  const needsScroll = rows.length > (isMobile ? 5 : 8);
  const scrollHeight = Math.max(280, rows.length * barRowHeight(rows.length) * heightScale);

  return (
    <div className="bar-chart-frame flex h-full min-h-0 flex-col md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`min-h-0 flex-1 ${needsScroll ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
          <div style={{ height: needsScroll ? scrollHeight : "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 8, right: rightMargin, left: isMobile ? 0 : 12, bottom: 0 }} barCategoryGap={8} barSize={barSize(rows.length)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
                <XAxis type="number" domain={[0, domainMax]} allowDecimals={valueKey === "spend"} hide tickFormatter={axisFormatter(valueKey)} />
                <YAxis dataKey="name" type="category" width={yAxisWidth} interval={0} tick={<WrappedYAxisTick />} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={valueKey} name={valueKey === "spend" ? "Spend" : "Requests"} radius={[0, 6, 6, 0]}>
                  {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <BarScaleAxis domainMax={domainMax} isMobile={isMobile} valueKey={valueKey} />
      </div>
      <ChartLegendList items={[{ label: valueKey === "spend" ? "Spend" : "Requests", color: "#79a7d8" }]} />
    </div>
  );
}

function VerticalBarViz({ data: rows, valueKey }: { data: Record<string, unknown>[]; valueKey: "requests" | "spend" }) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={isMobile ? { top: 8, right: 12, left: 0, bottom: 92 } : { top: 8, right: 82, left: 8, bottom: 92 }} barCategoryGap={10} barSize={barSize(rows.length)}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis dataKey="name" tick={<VerticalXAxisTick />} height={82} interval={0} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={axisFormatter(valueKey)} />
        <Tooltip content={<CustomTooltip />} />
        <Legend {...legendProps(isMobile)} />
        <Bar dataKey={valueKey} name={valueKey === "spend" ? "Spend" : "Requests"} radius={[6, 6, 0, 0]}>
          {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackedDepartmentBar({ data: rows, mode = "stacked" }: { data: Record<string, unknown>[]; mode?: "stacked" | "grouped" }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { heightScale } = useChartResize();
  const yAxisWidth = isMobile ? 118 : 176;
  const rightMargin = isMobile ? 12 : 24;
  const stackKeys = ["Development", "Subscription", "Software"];
  const domainMax =
    mode === "grouped"
      ? Math.max(1, ...rows.flatMap((row) => stackKeys.map((key) => Number(row[key] || 0))))
      : barDomain(rows, stackKeys);
  const needsScroll = rows.length > (isMobile ? 5 : 8);
  const scrollHeight = Math.max(280, rows.length * barRowHeight(rows.length) * heightScale);

  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="bar-chart-frame flex h-full min-h-0 flex-col md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`min-h-0 flex-1 ${needsScroll ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
          <div style={{ height: needsScroll ? scrollHeight : "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 8, right: rightMargin, left: isMobile ? 0 : 12, bottom: 0 }} barCategoryGap={8} barSize={barSize(rows.length)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
                <XAxis type="number" domain={[0, domainMax]} allowDecimals={false} hide />
                <YAxis dataKey="name" type="category" width={yAxisWidth} interval={0} tick={<WrappedYAxisTick />} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Development" stackId={mode === "stacked" ? "requests" : undefined} name="Development" fill="#79a7d8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Subscription" stackId={mode === "stacked" ? "requests" : undefined} name="Subscription" fill="#8fc9a8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Software" stackId={mode === "stacked" ? "requests" : undefined} name="Software" fill="#f6c66f" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <BarScaleAxis domainMax={domainMax} isMobile={isMobile} valueKey="requests" />
      </div>
      <ChartLegendList
        items={[
          { label: "Development", color: "#79a7d8" },
          { label: "Subscription", color: "#8fc9a8" },
          { label: "Software", color: "#f6c66f" }
        ]}
      />
    </div>
  );
}

function LineViz({ data: rows, valueKey = "requests" }: { data: Record<string, unknown>[]; valueKey?: "requests" | "spend" }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const label = valueKey === "spend" ? "Spend" : "Requests";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={isMobile ? { top: 8, right: 12, left: 0, bottom: 92 } : { top: 8, right: 82, left: 8, bottom: 82 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis dataKey="name" tick={<VerticalXAxisTick />} height={82} interval={0} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={axisFormatter(valueKey)} />
        <Tooltip content={<CustomTooltip />} />
        <Legend {...legendProps(isMobile)} />
        <Line type="monotone" dataKey={valueKey} name={label} stroke="#79a7d8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaViz({ data: rows, valueKey = "spend" }: { data: Record<string, unknown>[]; valueKey?: "requests" | "spend" }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const label = valueKey === "spend" ? "Spend" : "Requests";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={isMobile ? { top: 8, right: 12, left: 0, bottom: 92 } : { top: 8, right: 82, left: 8, bottom: 82 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8fc9a8" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#8fc9a8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis dataKey="name" tick={<VerticalXAxisTick />} height={82} interval={0} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={axisFormatter(valueKey)} />
        <Tooltip content={<CustomTooltip />} />
        <Legend {...legendProps(isMobile)} />
        <Area type="monotone" dataKey={valueKey} name={label} stroke="#4d9b70" strokeWidth={3} fill="url(#spendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DonutViz({
  data: rows,
  valueKey = "requests",
  shape = "donut"
}: {
  data: Record<string, unknown>[];
  valueKey?: "requests" | "spend";
  shape?: "donut" | "pie";
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const withTotal = rows.map((row) => ({ ...row, total }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 56 } : { top: 8, right: 86, left: 8, bottom: 8 }}>
        <Pie data={withTotal} dataKey={valueKey} nameKey="name" innerRadius={shape === "donut" ? (isMobile ? 46 : 62) : 0} outerRadius={isMobile ? 78 : 98} paddingAngle={3}>
          {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend {...legendProps(isMobile)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

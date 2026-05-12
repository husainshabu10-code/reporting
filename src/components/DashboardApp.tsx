"use client";

import { useEffect, useMemo, useState } from "react";
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
  Search,
  SlidersHorizontal,
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

const allRequests = data.requests as RequestRow[];
const allDepartments = Array.from(new Set(allRequests.map((row) => row.department))).sort();
const months = Array.from(new Set(allRequests.map((row) => row.month).filter(Boolean) as string[])).sort();
const requestTermGroups: Array<{ title: string; scope: RequestTermScope; terms: string[] }> = [
  { title: "Request Type", scope: "type", terms: Array.from(new Set(allRequests.map((row) => row.type))).sort() },
  { title: "Request Category", scope: "category", terms: Array.from(new Set(allRequests.map((row) => row.category))).sort() },
  { title: "Request Status", scope: "status", terms: Array.from(new Set(allRequests.map((row) => row.status))).sort() }
];

export default function DashboardApp() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(allDepartments);
  const [requestSort, setRequestSort] = useState<SortDirection>("desc");
  const [spendSort, setSpendSort] = useState<SortDirection>("desc");
  const [selectedRequestTerms, setSelectedRequestTerms] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("monthly");
  const [fromMonth, setFromMonth] = useState(months[0] || "");
  const [toMonth, setToMonth] = useState(months[months.length - 1] || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tableModes, setTableModes] = useState<Record<string, boolean>>({});
  const [compareModes, setCompareModes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 260);
    return () => window.clearTimeout(timer);
  }, []);

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
    setSearch("");
    setTimelineMode("monthly");
    setFromMonth(months[0] || "");
    setToMonth(months[months.length - 1] || "");
  };

  return (
    <div className="min-h-screen">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-72 border-r border-line bg-white/92 shadow-soft backdrop-blur transition-transform duration-300 lg:translate-x-0 ${
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
        <nav className="space-y-1 p-4">
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

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-line bg-white/82 backdrop-blur">
          <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button className="no-print rounded-md border border-line bg-white p-2 text-slate-600 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <div>
                <p className="text-sm text-slate-500">{activePage}</p>
                <h2 className="text-2xl font-semibold text-ink sm:text-3xl">IT Request Analytics Dashboard</h2>
              </div>
            </div>
            <ExportCluster
              onPdfAll={() => exportPdf(`${activePage} - Export All`, exportPageRows("all"))}
              onPdfFiltered={() => exportPdf(`${activePage} - Export Filtered`, exportPageRows("filtered"))}
              onExcelAll={() => exportExcel(`${activePage} - Export All`, exportPageRows("all"))}
              onExcelFiltered={() => exportExcel(`${activePage} - Export Filtered`, exportPageRows("filtered"))}
            />
          </div>
        </header>

        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
                          data={departmentRequests}
                          table={tableModes["dept-requests"]}
                          compare={compareModes["dept-requests"]}
                          onToggleTable={() => toggle(setTableModes, "dept-requests")}
                          onToggleCompare={() => toggle(setCompareModes, "dept-requests")}
                          onPdf={() => exportPdf("Department-wise Requests", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Department-wise Requests", rowsForExport(pageRows))}
                        >
                          {compareModes["dept-requests"] ? <DualBar data={departmentRequests.slice(0, 12)} /> : <BarViz data={departmentRequests.slice(0, 12)} valueKey="requests" />}
                        </ChartPanel>
                        <ChartPanel
                          id="monthly-trend"
                          title="Monthly Trend Line"
                          data={trendRows}
                          table={tableModes["monthly-trend"]}
                          onToggleTable={() => toggle(setTableModes, "monthly-trend")}
                          onPdf={() => exportPdf("Monthly Trend Line", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Monthly Trend Line", rowsForExport(pageRows))}
                        >
                          <LineViz data={trendRows} />
                        </ChartPanel>
                        <ChartPanel
                          id="spend-dept"
                          title="Spend by Department"
                          data={departmentSpend}
                          table={tableModes["spend-dept"]}
                          compare={compareModes["spend-dept"]}
                          onToggleTable={() => toggle(setTableModes, "spend-dept")}
                          onToggleCompare={() => toggle(setCompareModes, "spend-dept")}
                          onPdf={() => exportPdf("Spend by Department", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Spend by Department", rowsForExport(pageRows))}
                        >
                          {compareModes["spend-dept"] ? <DualBar data={departmentSpend.slice(0, 12)} /> : <BarViz data={departmentSpend.slice(0, 12)} valueKey="spend" />}
                        </ChartPanel>
                        <ChartPanel
                          id="request-category"
                          title="Request Category"
                          data={categoryRows}
                          table={tableModes["request-category"]}
                          compare={compareModes["request-category"]}
                          onToggleTable={() => toggle(setTableModes, "request-category")}
                          onToggleCompare={() => toggle(setCompareModes, "request-category")}
                          onPdf={() => exportPdf("Request Category", rowsForExport(pageRows))}
                          onExcel={() => exportExcel("Request Category", rowsForExport(pageRows))}
                        >
                          {compareModes["request-category"] ? <DualBar data={categoryRows} /> : <DonutViz data={categoryRows} />}
                        </ChartPanel>
                      </ChartGrid>
                      <Insights insights={summaryInsights} />
                    </>
                  )}

                  {activePage === "IT Requests" && (
                    <ChartGrid>
                      <ChartPanel id="request-status" title="Request Status Overview" data={statusRows} table={tableModes["request-status"]} onToggleTable={() => toggle(setTableModes, "request-status")} onPdf={() => exportPdf("Request Status Overview", rowsForExport(pageRows))} onExcel={() => exportExcel("Request Status Overview", rowsForExport(pageRows))}>
                        <DonutViz data={statusRows} />
                      </ChartPanel>
                      <ChartPanel id="request-dept" title="Department-wise Requests" data={departmentRequests} table={tableModes["request-dept"]} compare={compareModes["request-dept"]} onToggleTable={() => toggle(setTableModes, "request-dept")} onToggleCompare={() => toggle(setCompareModes, "request-dept")} onPdf={() => exportPdf("Department-wise Requests", rowsForExport(pageRows))} onExcel={() => exportExcel("Department-wise Requests", rowsForExport(pageRows))}>
                        {compareModes["request-dept"] ? <DualBar data={departmentRequests.slice(0, 12)} /> : <BarViz data={departmentRequests.slice(0, 12)} valueKey="requests" />}
                      </ChartPanel>
                      <ChartPanel id="request-type" title="Request Category/Type Breakdown" data={typeRows} table={tableModes["request-type"]} onToggleTable={() => toggle(setTableModes, "request-type")} onPdf={() => exportPdf("Request Type Breakdown", rowsForExport(pageRows))} onExcel={() => exportExcel("Request Type Breakdown", rowsForExport(pageRows))}>
                        <DonutViz data={typeRows} />
                      </ChartPanel>
                      <RequestTable title="Matching Requests" rows={sortedRequests} onPdf={() => exportPdf("Matching Requests", rowsForExport(sortedRequests))} onExcel={() => exportExcel("Matching Requests", rowsForExport(sortedRequests))} />
                    </ChartGrid>
                  )}

                  {activePage === "Budget" && (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <MiniKpi title="Total Spend Overview" value={formatINR(data.kpis.totalSpend.value, true)} icon={<IndianRupee size={20} />} />
                        <MiniKpi title="Known Row Spend" value={formatINR(pageRows.reduce((sum, row) => sum + (row.amount || 0), 0), true)} icon={<WalletCards size={20} />} />
                        <MiniKpi title="TBD Amount Requests" value={String(pageRows.filter((row) => row.amount === null).length)} icon={<SlidersHorizontal size={20} />} />
                      </div>
                      <ChartGrid>
                        <ChartPanel id="budget-dept" title="Spend by Department" data={departmentSpend} table={tableModes["budget-dept"]} compare={compareModes["budget-dept"]} onToggleTable={() => toggle(setTableModes, "budget-dept")} onToggleCompare={() => toggle(setCompareModes, "budget-dept")} onPdf={() => exportPdf("Spend by Department", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend by Department", rowsForExport(pageRows))}>
                          {compareModes["budget-dept"] ? <DualBar data={departmentSpend.slice(0, 12)} /> : <BarViz data={departmentSpend.slice(0, 12)} valueKey="spend" />}
                        </ChartPanel>
                        <ChartPanel id="budget-category" title="Spend by Request/Category" data={spendCategoryRows} table={tableModes["budget-category"]} compare={compareModes["budget-category"]} onToggleTable={() => toggle(setTableModes, "budget-category")} onToggleCompare={() => toggle(setCompareModes, "budget-category")} onPdf={() => exportPdf("Spend by Category", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend by Category", rowsForExport(pageRows))}>
                          {compareModes["budget-category"] ? <DualBar data={spendCategoryRows} /> : <DonutViz data={spendCategoryRows} valueKey="spend" />}
                        </ChartPanel>
                        <ChartPanel id="budget-trend" title="Spend Trends Over Time" data={trendRows} table={tableModes["budget-trend"]} onToggleTable={() => toggle(setTableModes, "budget-trend")} onPdf={() => exportPdf("Spend Trends", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend Trends", rowsForExport(pageRows))}>
                          <AreaViz data={trendRows} />
                        </ChartPanel>
                      </ChartGrid>
                    </>
                  )}

                  {activePage === "Departments" && (
                    <ChartGrid>
                      <ChartPanel id="dept-view-requests" title="Department Requests" data={departmentRequests} table={tableModes["dept-view-requests"]} compare={compareModes["dept-view-requests"]} onToggleTable={() => toggle(setTableModes, "dept-view-requests")} onToggleCompare={() => toggle(setCompareModes, "dept-view-requests")} onPdf={() => exportPdf("Department Requests", rowsForExport(pageRows))} onExcel={() => exportExcel("Department Requests", rowsForExport(pageRows))}>
                        {compareModes["dept-view-requests"] ? <DualBar data={departmentRequests.slice(0, 14)} /> : <BarViz data={departmentRequests.slice(0, 14)} valueKey="requests" />}
                      </ChartPanel>
                      <ChartPanel id="dept-view-spend" title="Department Spend" data={departmentSpend} table={tableModes["dept-view-spend"]} compare={compareModes["dept-view-spend"]} onToggleTable={() => toggle(setTableModes, "dept-view-spend")} onToggleCompare={() => toggle(setCompareModes, "dept-view-spend")} onPdf={() => exportPdf("Department Spend", rowsForExport(pageRows))} onExcel={() => exportExcel("Department Spend", rowsForExport(pageRows))}>
                        {compareModes["dept-view-spend"] ? <DualBar data={departmentSpend.slice(0, 14)} /> : <BarViz data={departmentSpend.slice(0, 14)} valueKey="spend" />}
                      </ChartPanel>
                      <NoData title="Project Involvement" />
                    </ChartGrid>
                  )}

                  {activePage === "Trends" && (
                    <ChartGrid>
                      <ChartPanel id="trend-requests" title={`${labelTimeline(timelineMode)} Request Trends`} data={trendRows} table={tableModes["trend-requests"]} compare={compareModes["trend-requests"]} onToggleTable={() => toggle(setTableModes, "trend-requests")} onToggleCompare={() => toggle(setCompareModes, "trend-requests")} onPdf={() => exportPdf("Request Trends", rowsForExport(pageRows))} onExcel={() => exportExcel("Request Trends", rowsForExport(pageRows))}>
                        {compareModes["trend-requests"] ? <DualBar data={trendRows} /> : <LineViz data={trendRows} />}
                      </ChartPanel>
                      <ChartPanel id="trend-spend" title={`${labelTimeline(timelineMode)} Spend Trends`} data={trendRows} table={tableModes["trend-spend"]} onToggleTable={() => toggle(setTableModes, "trend-spend")} onPdf={() => exportPdf("Spend Trends", rowsForExport(pageRows))} onExcel={() => exportExcel("Spend Trends", rowsForExport(pageRows))}>
                        <AreaViz data={trendRows} />
                      </ChartPanel>
                      <ChartPanel id="trend-category" title="Request Category Comparison" data={categoryRows} table={tableModes["trend-category"]} compare={compareModes["trend-category"]} onToggleTable={() => toggle(setTableModes, "trend-category")} onToggleCompare={() => toggle(setCompareModes, "trend-category")} onPdf={() => exportPdf("Category Comparison", rowsForExport(pageRows))} onExcel={() => exportExcel("Category Comparison", rowsForExport(pageRows))}>
                        {compareModes["trend-category"] ? <DualBar data={categoryRows} /> : <BarViz data={categoryRows} valueKey="requests" />}
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

function labelTimeline(mode: TimelineMode) {
  return mode === "monthly" ? "Monthly" : mode === "quarterly" ? "Quarterly" : "Yearly";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function chartRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    Name: row.name,
    Requests: row.requests ?? "",
    Spend: typeof row.spend === "number" ? formatINR(row.spend) : row.spend ?? "",
    Percentage: row.percentage ?? ""
  }));
}

function ExportCluster({ onPdfAll, onPdfFiltered, onExcelAll, onExcelFiltered }: { onPdfAll: () => void; onPdfFiltered: () => void; onExcelAll: () => void; onExcelFiltered: () => void }) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button className="btn-secondary" onClick={onPdfAll}><FileDown size={16} /> PDF All</button>
      <button className="btn-primary" onClick={onPdfFiltered}><Download size={16} /> PDF Filtered</button>
      <button className="btn-secondary" onClick={onExcelAll}><FileSpreadsheet size={16} /> Excel All</button>
      <button className="btn-secondary" onClick={onExcelFiltered}><FileSpreadsheet size={16} /> Excel Filtered</button>
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
    <section className="no-print relative rounded-lg border border-line bg-white/90 p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="w-full space-y-1 lg:max-w-xl">
          <span className="text-xs font-semibold uppercase text-slate-500">Search Requests</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="field pl-9" value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search request" />
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => props.setFiltersOpen(!props.filtersOpen)}>
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <button className="btn-secondary" onClick={props.clearFilters}>Clear Filters</button>
        </div>
      </div>

      {props.filtersOpen && (
        <div className="absolute right-4 top-[calc(100%-8px)] z-30 w-[min(720px,calc(100vw-2rem))] rounded-lg border border-line bg-white p-4 shadow-soft">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
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
                  <label key={department} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm leading-6 text-slate-700 hover:bg-slate-50">
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
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
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
                  <div className="flex rounded-lg border border-line bg-slate-50 p-1">
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
    <div className="grid gap-4 md:grid-cols-3">
      <MiniKpi title="Total Requests" value={String(data.kpis.totalRequests.value)} icon={<BarChart3 size={20} />} tone="blue" />
      <MiniKpi title="Department with Most Requests" value={`${data.kpis.departmentWithMostRequests.value} (${data.kpis.departmentWithMostRequests.requests})`} icon={<Building2 size={20} />} tone="green" />
      <MiniKpi title="Total Spend" value={formatINR(data.kpis.totalSpend.value, true)} icon={<IndianRupee size={20} />} tone="rose" />
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="print-panel rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${tones[tone]}`}>{icon}</div>
      </div>
    </motion.div>
  );
}

function ChartGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 xl:grid-cols-2">{children}</div>;
}

function ChartPanel({
  id,
  title,
  data: rows,
  table,
  compare = false,
  children,
  onToggleTable,
  onToggleCompare,
  onPdf,
  onExcel
}: {
  id: string;
  title: string;
  data: Record<string, unknown>[];
  table?: boolean;
  compare?: boolean;
  children: React.ReactNode;
  onToggleTable: () => void;
  onToggleCompare?: () => void;
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <section id={id} className="print-panel rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="text-sm text-slate-500">{rows.length ? `${rows.length} data points` : "No data available"}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {onToggleCompare && (
            <button className={`btn-compact ${compare ? "bg-[#e8f5ee] text-[#2f7a52]" : ""}`} onClick={onToggleCompare}>
              Compare Mode
            </button>
          )}
          <button className="btn-compact" onClick={onToggleTable}><Table2 size={15} /> View as Table</button>
          <button className="icon-btn" onClick={onPdf} aria-label={`Export ${title} PDF`}><FileDown size={16} /></button>
          <button className="icon-btn" onClick={onExcel} aria-label={`Export ${title} Excel`}><FileSpreadsheet size={16} /></button>
        </div>
      </div>
      {rows.length === 0 ? <EmptyState /> : table ? <DataTable rows={chartRows(rows)} /> : <div className="chart-pop h-96">{children}</div>}
    </section>
  );
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <EmptyState />;
  const keys = Object.keys(rows[0]);
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-line">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{keys.map((key) => <th key={key} className="border-b border-line px-3 py-2">{key}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-white even:bg-slate-50/60">
              {keys.map((key) => <td key={key} className="border-b border-line px-3 py-3 leading-6 text-slate-700">{String(row[key] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestTable({ title, rows, onPdf, onExcel }: { title: string; rows: RequestRow[]; onPdf: () => void; onExcel: () => void }) {
  return (
    <section className="print-panel rounded-lg border border-line bg-white p-4 shadow-soft xl:col-span-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-slate-500">{rows.length} requests</p>
        </div>
        <div className="no-print flex gap-2">
          <button className="icon-btn" onClick={onPdf} aria-label="Export table PDF"><FileDown size={16} /></button>
          <button className="icon-btn" onClick={onExcel} aria-label="Export table Excel"><FileSpreadsheet size={16} /></button>
        </div>
      </div>
      <DataTable rows={rowsForExport(rows)} />
    </section>
  );
}

function EmptyState() {
  return <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-line bg-slate-50 text-sm text-slate-500">No data available</div>;
}

function NoData({ title }: { title: string }) {
  return (
    <section className="print-panel rounded-lg border border-line bg-white p-4 shadow-soft">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-4"><EmptyState /></div>
    </section>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
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
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h3 className="text-base font-semibold">Show Insights</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
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
      <text x={-8} y={0} textAnchor="end" fill="#536174" fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={-8} dy={index === 0 ? -((lines.length - 1) * 7) : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function WrappedXAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines = wrapLabel(String(payload?.value || ""), 14);
  return (
    <g transform={`translate(${x},${y + 10})`}>
      <text textAnchor="middle" fill="#536174" fontSize={10}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : 13}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function BarViz({ data: rows, valueKey }: { data: Record<string, unknown>[]; valueKey: "requests" | "spend" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 82, left: 12, bottom: 8 }} barCategoryGap={10}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => (valueKey === "spend" ? formatINR(Number(value), true) : String(value))} />
        <YAxis dataKey="name" type="category" width={176} interval={0} tick={<WrappedYAxisTick />} />
        <Tooltip content={<CustomTooltip />} />
        <Legend align="right" verticalAlign="middle" layout="vertical" />
        <Bar dataKey={valueKey} name={valueKey === "spend" ? "Spend" : "Requests"} radius={[0, 6, 6, 0]}>
          {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DualBar({ data: rows }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 86, left: 8, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis dataKey="name" tick={<WrappedXAxisTick />} height={88} interval={0} />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(value) => formatINR(Number(value), true)} />
        <Tooltip content={<CustomTooltip />} />
        <Legend align="right" verticalAlign="middle" layout="vertical" />
        <Bar yAxisId="left" dataKey="requests" name="Requests" fill="#79a7d8" radius={[6, 6, 0, 0]} />
        <Bar yAxisId="right" dataKey="spend" name="Spend" fill="#f2a6a6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineViz({ data: rows }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 82, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend align="right" verticalAlign="middle" layout="vertical" />
        <Line type="monotone" dataKey="requests" name="Requests" stroke="#79a7d8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaViz({ data: rows }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 82, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8fc9a8" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#8fc9a8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatINR(Number(value), true)} />
        <Tooltip content={<CustomTooltip />} />
        <Legend align="right" verticalAlign="middle" layout="vertical" />
        <Area type="monotone" dataKey="spend" name="Spend" stroke="#4d9b70" strokeWidth={3} fill="url(#spendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DonutViz({ data: rows, valueKey = "requests" }: { data: Record<string, unknown>[]; valueKey?: "requests" | "spend" }) {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const withTotal = rows.map((row) => ({ ...row, total }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 86, left: 8, bottom: 8 }}>
        <Pie data={withTotal} dataKey={valueKey} nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={3}>
          {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend align="right" verticalAlign="middle" layout="vertical" />
      </PieChart>
    </ResponsiveContainer>
  );
}

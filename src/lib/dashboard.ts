export type RequestRow = {
  id: string;
  department: string;
  type: string;
  date: string;
  month: string | null;
  description: string;
  category: string;
  amount: number | null;
  amountRaw: string;
  status: string;
  source: { pdf: string; pages: number[]; section: string };
};

export type ChartRow = {
  name: string;
  requests?: number;
  spend?: number | null;
  percentage?: number;
  [key: string]: string | number | null | undefined;
};

export const palette = ["#79a7d8", "#f2a6a6", "#8fc9a8", "#f6c66f", "#b9a7e8", "#8fd3d0", "#f0a7c5", "#a9c6a3"];

export function formatINR(value: number | null | undefined, short = false) {
  if (value === null || value === undefined) return "TBD";
  if (!short) return `₹${value.toLocaleString("en-IN")}`;
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(abs >= 100000000 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function groupRequests(rows: RequestRow[], key: keyof RequestRow) {
  const map = new Map<string, { name: string; requests: number; spend: number }>();
  rows.forEach((row) => {
    const name = String(row[key] || "Unspecified");
    const current = map.get(name) || { name, requests: 0, spend: 0 };
    current.requests += 1;
    current.spend += row.amount || 0;
    map.set(name, current);
  });
  return [...map.values()];
}

export function sortRows(rows: ChartRow[], key: "requests" | "spend", direction: "asc" | "desc") {
  return [...rows].sort((a, b) => {
    const first = Number(a[key] || 0);
    const second = Number(b[key] || 0);
    return direction === "asc" ? first - second : second - first;
  });
}

export function monthLabel(month: string) {
  const [year, value] = month.split("-");
  const date = new Date(Number(year), Number(value) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function quarterLabel(month: string) {
  const [year, value] = month.split("-");
  const quarter = Math.floor((Number(value) - 1) / 3) + 1;
  return `${year} Q${quarter}`;
}

export function aggregateTimeline(rows: RequestRow[], mode: "monthly" | "quarterly" | "yearly") {
  const map = new Map<string, { name: string; requests: number; spend: number }>();
  rows.forEach((row) => {
    if (!row.month) return;
    const key = mode === "monthly" ? row.month : mode === "quarterly" ? quarterLabel(row.month) : row.month.slice(0, 4);
    const name = mode === "monthly" ? monthLabel(row.month) : key;
    const current = map.get(key) || { name, requests: 0, spend: 0 };
    current.requests += 1;
    current.spend += row.amount || 0;
    map.set(key, current);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

export function rowsForExport(rows: RequestRow[]) {
  return rows.map((row) => ({
    ID: row.id,
    Department: row.department,
    Type: row.type,
    Date: row.date,
    Category: row.category,
    Status: row.status,
    Amount: row.amount === null ? "TBD" : formatINR(row.amount),
    Description: row.description
  }));
}

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const rawPdfPath = "C:/Users/husai/OneDrive/Documents/IT_Requests_Summary_Full.pdf";
const reportPdfPath = "C:/Users/husai/Downloads/Strategic_IT_Request_Analysis_Final_Revised.pdf";
const rawPdfName = "IT_Requests_Summary_Full.pdf";
const reportPdfName = "Strategic_IT_Request_Analysis_Final_Revised.pdf";
const outDir = path.resolve("src/data");
const docsDir = path.resolve("docs");

function readPdfStreams(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const pdfText = buffer.toString("latin1");
  const kidsRaw = [...pdfText.matchAll(/\/Kids\[([\s\S]*?)\]/g)][0]?.[1].match(/\d+ 0 R/g) || [];
  const kids = kidsRaw.map((item) => parseInt(item, 10));
  const objects = new Map();
  const objectRegex = /(\d+) 0 obj\s*([\s\S]*?)\s*endobj/g;
  let objectMatch;

  while ((objectMatch = objectRegex.exec(pdfText))) {
    objects.set(Number(objectMatch[1]), objectMatch[2]);
  }

  function streamFor(objectId) {
    const body = objects.get(objectId) || "";
    const streamMatch = body.match(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/);
    if (!streamMatch) return "";
    const data = Buffer.from(streamMatch[2], "latin1");
    return streamMatch[1].includes("FlateDecode") ? zlib.inflateSync(data).toString("latin1") : streamMatch[2];
  }

  return kids.map((pageObject, index) => {
    const pageBody = objects.get(pageObject) || "";
    const contentObjects = [...pageBody.matchAll(/\/Contents\s+(\d+)\s+0\s+R/g)].map((match) => Number(match[1]));
    return {
      page: index + 1,
      pageObject,
      content: contentObjects.map(streamFor).join("\n")
    };
  });
}

function decodeLiteral(input) {
  let output = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char !== "\\") {
      output += char;
      continue;
    }
    const next = input[++index];
    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "(" || next === ")" || next === "\\") output += next;
    else if (/[0-7]/.test(next || "")) {
      let octal = next;
      for (let step = 0; step < 2 && /[0-7]/.test(input[index + 1] || ""); step += 1) {
        octal += input[++index];
      }
      output += String.fromCharCode(parseInt(octal, 8));
    } else if (next) {
      output += next;
    }
  }
  return output;
}

function parseTextArray(arrayText) {
  let output = "";
  for (let index = 0; index < arrayText.length; index += 1) {
    if (arrayText[index] === "(") {
      let depth = 1;
      let literal = "";
      let innerIndex = index + 1;
      for (; innerIndex < arrayText.length; innerIndex += 1) {
        const char = arrayText[innerIndex];
        if (char === "\\") {
          literal += char + (arrayText[innerIndex + 1] || "");
          innerIndex += 1;
        } else if (char === "(") {
          depth += 1;
          literal += char;
        } else if (char === ")") {
          depth -= 1;
          if (depth === 0) break;
          literal += char;
        } else {
          literal += char;
        }
      }
      output += decodeLiteral(literal);
      index = innerIndex;
    } else if (arrayText[index] === "<") {
      const end = arrayText.indexOf(">", index + 1);
      if (end > index) {
        const hex = arrayText.slice(index + 1, end).replace(/\s+/g, "");
        for (let offset = 0; offset < hex.length; offset += 4) {
          const code = parseInt(hex.slice(offset, offset + 4), 16);
          if (!Number.isNaN(code)) output += String.fromCharCode(code);
        }
        index = end;
      }
    }
  }
  return output;
}

function extractPageItems(page) {
  const lines = page.content.split(/\r?\n/);
  const items = [];
  let x = 0;
  let y = 0;
  let font = "";

  for (const line of lines) {
    const matrix = line.match(/(?:^|\s)([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm/);
    if (matrix) {
      x = Number(matrix[5]);
      y = Number(matrix[6]);
    }
    const fontMatch = line.match(/\/(F\d+)\s+([\d.]+)\s+Tf/);
    if (fontMatch) font = fontMatch[1];

    const textArray = line.match(/\[(.*)\]\s*TJ/);
    if (textArray) {
      const text = parseTextArray(textArray[1]);
      if (text.trim()) items.push({ page: page.page, x, y, font, text });
    }
  }

  return items;
}

function makeLines(items, pageStart, pageEnd) {
  const groups = [];
  for (const item of items.filter((entry) => entry.page >= pageStart && entry.page <= pageEnd)) {
    let group = groups.find((entry) => entry.page === item.page && Math.abs(entry.y - item.y) < 1.5);
    if (!group) {
      group = { page: item.page, y: item.y, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.x - b.x),
      text: group.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")
    }))
    .sort((a, b) => a.page - b.page || b.y - a.y);
}

function cleanText(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();
}

function parseAmount(value) {
  if (!value || /TBD/i.test(value)) return null;
  const amount = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(amount) ? null : amount;
}

function parseDate(label) {
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12"
  };
  const match = label.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*-\s*(\d{2})/);
  return match ? `20${match[2]}-${months[match[1]]}` : null;
}

function isDepartmentHeader(line) {
  return line.text.includes("|") && /requests/i.test(line.text) && /Known:/i.test(line.text);
}

function isRowStart(line) {
  const rowTypes = new Set(["Development", "Software", "Subscription"]);
  return Boolean(line.items.find((item) => item.x < 105 && rowTypes.has(item.text)));
}

function splitColumns(line) {
  const parts = { type: [], date: [], description: [], category: [], amount: [], status: [] };
  for (const item of line.items) {
    if (item.x < 105) parts.type.push(item.text);
    else if (item.x < 146) parts.date.push(item.text);
    else if (item.x < 350) parts.description.push(item.text);
    else if (item.x < 430) parts.category.push(item.text);
    else if (item.x < 495) parts.amount.push(item.text);
    else parts.status.push(item.text);
  }
  return parts;
}

function parseRequests(items) {
  const lines = makeLines(items, 13, 24);
  const departments = [];
  const requests = [];
  let currentDepartment = null;
  let currentRow = null;

  function finalizeRow() {
    if (!currentRow) return;
    const dateLabel = cleanText(currentRow.date.join(" "));
    const amountPieces = currentRow.amount.join(" ");
    requests.push({
      id: `REQ-${String(requests.length + 1).padStart(3, "0")}`,
      department: currentDepartment?.name || "Unknown",
      type: cleanText(currentRow.type.join(" ")),
      date: dateLabel,
      month: parseDate(dateLabel),
      description: cleanText(currentRow.description.join(" ")),
      category: cleanText(currentRow.category.join(" ")),
      amount: parseAmount(amountPieces),
      amountRaw: /TBD/i.test(amountPieces) ? "TBD" : `₹${cleanText(amountPieces.replace(/ൟ/g, ""))}`,
      status: cleanText(currentRow.status.join(" ")),
      source: {
        pdf: rawPdfName,
        pages: [...new Set(currentRow.pages)].sort((a, b) => a - b),
        section: "9. Department-Wise Detailed Request Breakdown"
      }
    });
    currentRow = null;
  }

  for (const line of lines) {
    if (isDepartmentHeader(line)) {
      finalizeRow();
      const name = cleanText(line.text.split("|")[0]);
      const requestCount = line.text.match(/(\d+)\s+requests/i);
      const devRequests = line.text.match(/Dev:\s*(\d+)/i);
      const knownSpend = /Known:\s*TBD/i.test(line.text) ? null : parseAmount(line.text.split("Known:")[1] || "");
      currentDepartment = {
        name,
        requestCount: requestCount ? Number(requestCount[1]) : null,
        devRequests: devRequests ? Number(devRequests[1]) : null,
        knownSpend,
        source: { pdf: rawPdfName, page: line.page, section: "9. Department-Wise Detailed Request Breakdown" }
      };
      departments.push(currentDepartment);
      continue;
    }

    if (
      line.text.includes("Amount") ||
      line.text.includes("(INR)") ||
      /^Type\s+Date/.test(line.text) ||
      /^9\./.test(line.text) ||
      /^Each department/.test(line.text)
    ) {
      continue;
    }

    if (isRowStart(line)) {
      finalizeRow();
      const parts = splitColumns(line);
      currentRow = { ...parts, pages: [line.page] };
    } else if (currentRow) {
      const parts = splitColumns(line);
      currentRow.date.push(...parts.date);
      currentRow.description.push(...parts.description);
      currentRow.category.push(...parts.category);
      currentRow.amount.push(...parts.amount);
      currentRow.status.push(...parts.status);
      currentRow.pages.push(line.page);
    }
  }

  finalizeRow();
  return { departments, requests };
}

function aggregate(requests, key, value = "count") {
  const map = new Map();
  for (const request of requests) {
    const name = request[key];
    const current = map.get(name) || { name, requests: 0, spend: 0 };
    current.requests += 1;
    current.spend += request.amount || 0;
    map.set(name, current);
  }
  return [...map.values()].sort((a, b) => (value === "spend" ? b.spend - a.spend : b.requests - a.requests));
}

function monthlyTrend(requests) {
  const map = new Map();
  for (const request of requests) {
    if (!request.month) continue;
    const entry = map.get(request.month) || { month: request.month, requests: 0, spend: 0 };
    entry.requests += 1;
    entry.spend += request.amount || 0;
    map.set(request.month, entry);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function normalizeKnownSpend(value) {
  return value === null ? null : Number(value);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

const pages = readPdfStreams(rawPdfPath);
const items = pages.flatMap(extractPageItems);
const { departments, requests } = parseRequests(items);

const categorySummary = [
  { name: "Development", requests: 42, spend: 18845766, percentage: 74.6, source: { pdf: rawPdfName, page: 1, section: "2. Financial Summary" } },
  { name: "Subscriptions", requests: 73, spend: 4169393, percentage: 16.5, source: { pdf: rawPdfName, page: 1, section: "2. Financial Summary" } },
  { name: "Software / HW / Cloud", requests: 42, spend: 2237988, percentage: 8.9, source: { pdf: rawPdfName, page: 1, section: "2. Financial Summary" } }
];

const statusSummary = [
  { name: "Approved", requests: 139, percentage: 88.5, source: { pdf: rawPdfName, page: 1, section: "1. Request Count Summary" } },
  { name: "Pending", requests: 15, percentage: 9.6, source: { pdf: rawPdfName, page: 1, section: "1. Request Count Summary" } },
  { name: "Under Review", requests: 3, percentage: 1.9, source: { pdf: rawPdfName, page: 1, section: "1. Request Count Summary" } }
];

const departmentSummary = departments.map((department) => ({
  name: department.name,
  requests: requests.filter((request) => request.department === department.name).length,
  spend: normalizeKnownSpend(department.knownSpend),
  rowSpend: requests.filter((request) => request.department === department.name).reduce((sum, request) => sum + (request.amount || 0), 0),
  devRequests: department.devRequests,
  source: department.source
}));

const rowLevelKnownSpend = requests.reduce((sum, request) => sum + (request.amount || 0), 0);
const summaryKnownSpend = 25253147;
const validationNotes = [
  "The raw data PDF was extracted once into this structured JSON file.",
  "The chart/report PDF was reviewed only for dashboard structure and chart grouping logic.",
  "No mock, placeholder, inferred, or invented values were added.",
  "Original PDFs are not copied to public assets and are excluded by .gitignore.",
  `Row-level known spend sums to ₹${rowLevelKnownSpend.toLocaleString("en-IN")}; the raw PDF financial summary states ₹${summaryKnownSpend.toLocaleString("en-IN")}. Both values are retained with source context rather than reconciled by assumption.`,
  `Detailed request rows include ${requests.filter((request) => request.amount === null).length} TBD amount rows; the raw PDF summary/data-quality sections state 11 TBD rows. The dashboard does not invent a reconciliation.`
];

const data = {
  title: "IT Request Analytics Dashboard",
  metadata: {
    rawPdf: rawPdfName,
    reportPdfReference: reportPdfName,
    extractionScope: "Raw PDF exact data only. Report PDF used only for structure/chart logic reference.",
    projectPages: false,
    slaPages: false
  },
  kpis: {
    totalRequests: { value: 157, source: { pdf: rawPdfName, page: 1, section: "1. Request Count Summary" } },
    departmentWithMostRequests: { value: "DH Pro", requests: 25, source: { pdf: rawPdfName, page: 36, section: "11. Final Summary" } },
    totalSpend: { value: summaryKnownSpend, source: { pdf: rawPdfName, page: 1, section: "2. Financial Summary" } }
  },
  statusSummary,
  categorySummary,
  departmentSummary,
  categoryBreakdown: aggregate(requests, "category"),
  typeBreakdown: aggregate(requests, "type"),
  monthlyTrend: monthlyTrend(requests),
  requests,
  validation: {
    rawPdf: rawPdfName,
    reportPdfReference: reportPdfName,
    extractionPages: "Raw PDF pages 1, 13-24, and 36",
    exactRequestRowsExtracted: requests.length,
    noMockDataUsed: true,
    notes: validationNotes
  }
};

fs.writeFileSync(path.join(outDir, "dashboard-data.json"), `${JSON.stringify(data, null, 2)}\n`);

const validationReport = `# Data Validation Report

## Source Files

- Raw data PDF: ${rawPdfName}
- Charts/report PDF reference: ${reportPdfName}

## Extraction Result

- Extracted ${requests.length} request rows from raw PDF pages 13-24.
- Extracted executive KPI and financial summaries from raw PDF pages 1 and 36.
- Extracted status totals from raw PDF page 1.
- Extracted category financial totals from raw PDF page 1.
- Extracted department headers from raw PDF pages 13-24.
- Reviewed the charts/report PDF only as a visual/structural reference; no dashboard values were taken from it.

## Validation

- No mock data was used.
- No placeholder values were added.
- No assumed, inferred, or invented values were added.
- Values that are not clearly available in the raw PDF remain unavailable or \`TBD\`.
- Projects and SLA pages are hidden because project timelines/progress and SLA metrics are not clearly present in the raw PDF.
- The original PDFs are not placed in \`public/\` and are excluded from deployment assets.

## Reconciliation Notes

- Row-level known spend from extracted request rows: ₹${rowLevelKnownSpend.toLocaleString("en-IN")}
- Raw PDF financial summary known spend: ₹${summaryKnownSpend.toLocaleString("en-IN")} (page 1)
- Development row-level known spend: ₹${requests.filter((request) => request.type === "Development").reduce((sum, request) => sum + (request.amount || 0), 0).toLocaleString("en-IN")}
- Development summary known spend: ₹1,88,45,766 (page 1)
- Detailed request rows with \`TBD\` amount: ${requests.filter((request) => request.amount === null).length}
- Raw PDF summary/data-quality sections state requests with \`TBD\` amount: 11 (pages 1 and 12)
- The dashboard does not invent a correction. Executive KPI/category cards use the exact summary values from page 1, while row/table views use exact request rows from pages 13-24.

## Structured Output

- \`src/data/dashboard-data.json\`
`;

fs.writeFileSync(path.join(docsDir, "data-validation-report.md"), validationReport);

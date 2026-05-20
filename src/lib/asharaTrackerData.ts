export const INITIAL_CITIES = ["Nairobi", "Mombasa", "Daresalam", "Mumbai", "Surat", "Pune", "Nagpur", "Colombo"];

export const ZONES = [
  "Masjid",
  "CMZ",
  "SHZ OFFICES",
  "Central Offices",
  "Checkpoints",
  "Relay Area",
  "Public Wi-Fi Area",
  "CCTV / Security",
  "Construction",
  "General"
] as const;

export const OWNERSHIP_TYPES = ["Central IT", "Local City IT", "Vendor", "Construction Team", "Department", "Joint"] as const;
export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export const EVENT_CRITICALITIES = ["Waaz Critical", "Operations Critical", "Department Support", "Optional"] as const;
export const STATUSES = [
  "Not Started",
  "Info Awaited",
  "Under Review",
  "In Progress",
  "Blocked",
  "Ready for Testing",
  "Tested",
  "Completed",
  "Not Required"
] as const;
export const BUDGET_STATUSES = ["Not Required", "Quote Pending", "Quote Received", "Approval Pending", "Approved", "Paid"] as const;
export const DOCUMENT_STATUSES = ["Not Attached", "Draft Attached", "Final Attached", "Needs Revision"] as const;
export const RISK_LEVELS = ["High", "Medium", "Low"] as const;
export const PROGRESS_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const TASK_WEIGHTS = ["Very high", "High", "Medium", "Low"] as const;

export type Zone = (typeof ZONES)[number];
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number] | "";
export type Priority = (typeof PRIORITIES)[number] | "";
export type EventCriticality = (typeof EVENT_CRITICALITIES)[number] | "";
export type Status = (typeof STATUSES)[number] | "";
export type BudgetStatus = (typeof BUDGET_STATUSES)[number] | "";
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number] | "";
export type RiskLevel = (typeof RISK_LEVELS)[number] | "";
export type ProgressValue = (typeof PROGRESS_VALUES)[number];
export type TaskWeight = (typeof TASK_WEIGHTS)[number] | "";

export type Workstream = {
  name: string;
  tasks: string[];
};

export type VendorEntry = {
  name: string;
  contact: string;
};

export type AttachmentReference = {
  name: string;
  type: string;
  addedAt: string;
};

export type TrackerTask = {
  id: string;
  city: string;
  zoneArea: Zone;
  workstream: string;
  taskName: string;
  ownershipType: OwnershipType;
  taskOwner: string;
  supportingPerson: string;
  priority: Priority;
  eventCriticality: EventCriticality;
  status: Status;
  progress: number;
  dueDate: string;
  targetReadinessDate: string;
  dependency: string;
  vendorName: string;
  vendorContact: string;
  vendors: VendorEntry[];
  budgetStatus: BudgetStatus;
  documentStatus: DocumentStatus;
  riskLevel: RiskLevel;
  taskWeight: TaskWeight;
  blockerReason: string;
  lastUpdateDate: string;
  nextFollowUpDate: string;
  remarksLatestUpdate: string;
  documentLinkAttachmentReference: string;
  attachments: AttachmentReference[];
  progressManuallyEdited?: boolean;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_PROGRESS: Record<(typeof STATUSES)[number], number> = {
  "Not Started": 0,
  "Info Awaited": 10,
  "Under Review": 20,
  "In Progress": 50,
  Blocked: 30,
  "Ready for Testing": 80,
  Tested: 90,
  Completed: 100,
  "Not Required": 100
};

export const STATUS_MEANINGS: Array<{ status: Status; meaning: string }> = [
  { status: "Not Started", meaning: "No work has begun." },
  { status: "Info Awaited", meaning: "Waiting for city/local team information." },
  { status: "Under Review", meaning: "Central IT is reviewing the requirement." },
  { status: "In Progress", meaning: "Work has started." },
  { status: "Blocked", meaning: "Cannot move forward due to an issue." },
  { status: "Ready for Testing", meaning: "Setup is done and testing is pending." },
  { status: "Tested", meaning: "Tested successfully." },
  { status: "Completed", meaning: "Fully closed." },
  { status: "Not Required", meaning: "Confirmed not needed for that city/area." }
];

const CSV_TASK_ROWS: Array<{ zoneArea: Zone; workstream: string; taskName: string }> = [
  { zoneArea: "General", workstream: "City IT Coordination & Governance", taskName: "City IT SPOC confirmed" },
  { zoneArea: "General", workstream: "City IT Coordination & Governance", taskName: "Local IT team list collected" },
  { zoneArea: "General", workstream: "City IT Coordination & Governance", taskName: "Escalation matrix finalized" },
  { zoneArea: "General", workstream: "City IT Coordination & Governance", taskName: "IT scope confirmed with city" },
  { zoneArea: "Masjid", workstream: "Site Survey & Requirement Collection", taskName: "Masjid / main venue IT survey completed" },
  { zoneArea: "SHZ OFFICES", workstream: "Site Survey & Requirement Collection", taskName: "SHZ OFFICES survey completed" },
  { zoneArea: "Central Offices", workstream: "Site Survey & Requirement Collection", taskName: "Central offices survey completed" },
  { zoneArea: "Checkpoints", workstream: "Site Survey & Requirement Collection", taskName: "Checkpoints and scanning locations mapped" },
  { zoneArea: "General", workstream: "Site Survey & Requirement Collection", taskName: "Power points and backup availability checked" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "ISP requirement finalized" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "Main ISP quotation received" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "Backup ISP quotation received" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "ISP line installation completed" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "ISP line testing completed" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "Static IP / public IP requirement checked" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "ISP contact and escalation shared" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "Network HLD prepared" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "IP plan prepared" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "VLAN plan finalized" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "Firewall policy finalized" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "ITS app access rule configured" },
  { zoneArea: "Public Wi-Fi Area", workstream: "Network Design, VLANs & Firewall", taskName: "Public Wi-Fi access rules configured" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "Network diagram attached" },
  { zoneArea: "Construction", workstream: "Cabling & Construction Coordination", taskName: "Cable route plan shared with construction team" },
  { zoneArea: "Construction", workstream: "Cabling & Construction Coordination", taskName: "LAN point requirement finalized" },
  { zoneArea: "Construction", workstream: "Cabling & Construction Coordination", taskName: "Fiber requirement checked" },
  { zoneArea: "Construction", workstream: "Cabling & Construction Coordination", taskName: "Cabling vendor finalized" },
  { zoneArea: "General", workstream: "Hardware Procurement & Inventory", taskName: "Required hardware list finalized" },
  { zoneArea: "General", workstream: "Hardware Procurement & Inventory", taskName: "Existing inventory checked" },
  { zoneArea: "General", workstream: "Hardware Procurement & Inventory", taskName: "Quotations received" },
  { zoneArea: "General", workstream: "Wi-Fi & Access Points", taskName: "Wi-Fi coverage plan prepared" },
  { zoneArea: "General", workstream: "Wi-Fi & Access Points", taskName: "AP quantity finalized" },
  { zoneArea: "General", workstream: "Wi-Fi & Access Points", taskName: "AP mounting locations confirmed" },
  { zoneArea: "Public Wi-Fi Area", workstream: "Wi-Fi & Access Points", taskName: "Public Wi-Fi SSID configured" },
  { zoneArea: "General", workstream: "Wi-Fi & Access Points", taskName: "Internal SSID configured" },
  { zoneArea: "General", workstream: "Wi-Fi & Access Points", taskName: "Wi-Fi load test completed" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Server requirement finalized" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Server setup completed" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Backup process configured" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Application testing completed" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Access credentials secured" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Recovery plan documented" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "Checkpoint list finalized" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "Scanner/device quantity finalized" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "Device allocation completed" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "ITS/e-pass scanning tested" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "Backup process for scanning failure prepared" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "Checkpoint IT support assigned" },
  { zoneArea: "Central Offices", workstream: "Printers, Office IT & Department Support", taskName: "Department IT requirements collected" },
  { zoneArea: "Central Offices", workstream: "Printers, Office IT & Department Support", taskName: "Printer requirement finalized" },
  { zoneArea: "Central Offices", workstream: "Printers, Office IT & Department Support", taskName: "Office LAN/Wi-Fi planned" },
  { zoneArea: "SHZ OFFICES", workstream: "Printers, Office IT & Department Support", taskName: "SHZ OFFICES IT setup completed" },
  { zoneArea: "Central Offices", workstream: "Printers, Office IT & Department Support", taskName: "Support contact shared with departments" },
  { zoneArea: "General", workstream: "Power Backup & UPS", taskName: "Critical IT power points identified" },
  { zoneArea: "General", workstream: "Power Backup & UPS", taskName: "UPS requirement finalized" },
  { zoneArea: "General", workstream: "Power Backup & UPS", taskName: "Generator backup coordination completed" },
  { zoneArea: "General", workstream: "Power Backup & UPS", taskName: "Power failover test completed" },
  { zoneArea: "General", workstream: "Power Backup & UPS", taskName: "Spare adapters and extensions arranged" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV scope and ownership confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV vendor / local security SPOC confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "Camera location and coverage plan collected" },
  { zoneArea: "Masjid", workstream: "CCTV & Surveillance Systems", taskName: "Masjid CCTV coverage requirement confirmed" },
  { zoneArea: "SHZ OFFICES", workstream: "CCTV & Surveillance Systems", taskName: "SHZ OFFICES CCTV requirement confirmed" },
  { zoneArea: "Checkpoints", workstream: "CCTV & Surveillance Systems", taskName: "Checkpoint CCTV coverage requirement confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "DVR / NVR location and access confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV storage and recording duration confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV network / IP requirement confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV VLAN / network segregation requirement confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV power and UPS backup requirement confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV installation status verified" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "Live monitoring display / control room requirement confirmed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV live view and recording test completed" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV escalation contact list documented" },
  { zoneArea: "General", workstream: "ISP & Internet Connectivity", taskName: "ISP equipment list planned and quotation ready" },
  { zoneArea: "General", workstream: "Network Design, VLANs & Firewall", taskName: "Network, firewall and VLAN equipment list planned and quotation ready" },
  { zoneArea: "Construction", workstream: "Cabling & Construction Coordination", taskName: "Cabling material list planned and quotation ready" },
  { zoneArea: "General", workstream: "Hardware Procurement & Inventory", taskName: "Hardware procurement list planned and quotation ready" },
  { zoneArea: "Public Wi-Fi Area", workstream: "Wi-Fi & Access Points", taskName: "Wi-Fi/AP equipment list planned and quotation ready" },
  { zoneArea: "General", workstream: "Servers, Applications & Services", taskName: "Server/application equipment list planned and quotation ready" },
  { zoneArea: "Checkpoints", workstream: "Scanning, E-Pass & Checkpoint IT", taskName: "Scanning/checkpoint equipment list planned and quotation ready" },
  { zoneArea: "Central Offices", workstream: "Printers, Office IT & Department Support", taskName: "Office IT and printer equipment list planned and quotation ready" },
  { zoneArea: "General", workstream: "Power Backup & UPS", taskName: "UPS/power backup equipment list planned and quotation ready" },
  { zoneArea: "CCTV / Security", workstream: "CCTV & Surveillance Systems", taskName: "CCTV equipment list planned and quotation ready" },
];


export const WORKSTREAMS: Workstream[] = buildWorkstreams(CSV_TASK_ROWS);

export const CSV_HEADERS: Array<{ key: keyof TrackerTask; label: string }> = [
  { key: "id", label: "Task ID" },
  { key: "city", label: "City" },
  { key: "zoneArea", label: "Zone / Area" },
  { key: "workstream", label: "Workstream" },
  { key: "taskName", label: "Task Name" },
  { key: "ownershipType", label: "Ownership Type" },
  { key: "taskOwner", label: "Task Owner" },
  { key: "supportingPerson", label: "Supporting Person" },
  { key: "priority", label: "Priority" },
  { key: "eventCriticality", label: "Event Criticality" },
  { key: "status", label: "Status" },
  { key: "progress", label: "Progress %" },
  { key: "dueDate", label: "Due Date" },
  { key: "targetReadinessDate", label: "Target Readiness Date" },
  { key: "dependency", label: "Dependency" },
  { key: "vendorName", label: "Primary Vendor Name" },
  { key: "vendorContact", label: "Primary Vendor Contact" },
  { key: "budgetStatus", label: "Budget Status" },
  { key: "documentStatus", label: "Document Status" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "taskWeight", label: "Task Weight" },
  { key: "blockerReason", label: "Blocker Reason" },
  { key: "lastUpdateDate", label: "Last Update Date" },
  { key: "nextFollowUpDate", label: "Next Follow-up Date" },
  { key: "remarksLatestUpdate", label: "Remarks / Latest Update" },
  { key: "documentLinkAttachmentReference", label: "Document Link / Attachment Reference" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" }
];

export function inferArea(taskName: string, workstreamName = ""): Zone {
  const value = `${taskName} ${workstreamName}`.toLowerCase();
  if (value.includes("shz offices")) return "SHZ OFFICES";
  if (value.includes("central offices")) return "Central Offices";
  if (value.includes("checkpoint") || value.includes("scanner") || value.includes("scanning") || value.includes("e-pass")) return "Checkpoints";
  if (value.includes("relay") || value.includes("av ")) return "Relay Area";
  if (value.includes("public wi-fi") || value.includes("captive portal")) return "Public Wi-Fi Area";
  if (value.includes("cctv") || value.includes("surveillance") || value.includes("security")) return "CCTV / Security";
  if (value.includes("construction") || value.includes("cabling") || value.includes("cable") || value.includes("fiber")) return "Construction";
  if (value.includes("masjid") || value.includes("main venue") || value.includes("waaz")) return "Masjid";
  if (value.includes("office") || value.includes("printer") || value.includes("department")) return "Central Offices";
  return "General";
}

export function taskDisplayName(task: Pick<TrackerTask, "city" | "zoneArea" | "taskName">) {
  return toSentenceCase(task.taskName);
}

export function makeTaskId(city: string, workstream: string, taskName: string) {
  return [city, workstream, taskName]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createDefaultTask(city: string, workstream: string, taskName: string, zoneArea: Zone = inferArea(taskName, workstream)): TrackerTask {
  const now = new Date().toISOString();
  return {
    id: makeTaskId(city, workstream, taskName),
    city,
    zoneArea,
    workstream,
    taskName: toSentenceCase(taskName),
    ownershipType: "",
    taskOwner: "",
    supportingPerson: "",
    priority: "",
    eventCriticality: "",
    status: "",
    progress: 0,
    dueDate: "",
    targetReadinessDate: "",
    dependency: "",
    vendorName: "",
    vendorContact: "",
    vendors: [],
    budgetStatus: "",
    documentStatus: "",
    riskLevel: "",
    taskWeight: "",
    blockerReason: "",
    lastUpdateDate: "",
    nextFollowUpDate: "",
    remarksLatestUpdate: "",
    documentLinkAttachmentReference: "",
    attachments: [],
    progressManuallyEdited: false,
    createdAt: now,
    updatedAt: now
  };
}

export function toSentenceCase(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function createBlankTask(city = INITIAL_CITIES[0] ?? "Nairobi"): TrackerTask {
  const now = new Date().toISOString();
  return {
    ...createDefaultTask(city, WORKSTREAMS[0].name, "New readiness task"),
    id: `manual-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  };
}

export function generateDefaultTasksForCities(cities: string[]) {
  return cities.flatMap((city) =>
    CSV_TASK_ROWS.map((row) => createDefaultTask(city, row.workstream, row.taskName, row.zoneArea))
  );
}

export function generateDefaultTasksForCity(city: string) {
  return generateDefaultTasksForCities([city]);
}

function inferCriticality(taskName: string, workstream: string): EventCriticality {
  const value = `${taskName} ${workstream}`.toLowerCase();
  if (value.includes("waaz") || value.includes("isp") || value.includes("firewall") || value.includes("checkpoint") || value.includes("scanning")) {
    return "Waaz Critical";
  }
  if (value.includes("department") || value.includes("printer") || value.includes("office")) return "Department Support";
  return "Operations Critical";
}

function buildWorkstreams(rows: Array<{ workstream: string; taskName: string }>): Workstream[] {
  const byName = new Map<string, string[]>();
  rows.forEach((row) => {
    byName.set(row.workstream, [...(byName.get(row.workstream) || []), row.taskName]);
  });
  return Array.from(byName.entries()).map(([name, tasks]) => ({ name, tasks }));
}

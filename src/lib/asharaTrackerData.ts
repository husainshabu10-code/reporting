export const INITIAL_CITIES = ["Nairobi", "Mombasa", "Daresalam", "Mumbai", "Surat", "Pune", "Nagpur", "Colombo"];

export const ZONES = [
  "Masjid",
  "CMZ",
  "SHZ OFFICES",
  "Central Offices",
  "Checkpoints",
  "Relay Area",
  "Public Wi-Fi Area",
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

export type Zone = (typeof ZONES)[number];
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type EventCriticality = (typeof EVENT_CRITICALITIES)[number];
export type Status = (typeof STATUSES)[number];
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type ProgressValue = (typeof PROGRESS_VALUES)[number];

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

export const STATUS_PROGRESS: Record<Status, number> = {
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

export const WORKSTREAMS: Workstream[] = [
  {
    name: "City IT Coordination & Governance",
    tasks: [
      "City IT SPOC confirmed",
      "Local IT team list collected",
      "Daily reporting format agreed",
      "Escalation matrix finalized",
      "IT scope confirmed with city"
    ]
  },
  {
    name: "Site Survey & Requirement Collection",
    tasks: [
      "Masjid / main venue IT survey completed",
      "SHZ OFFICES survey completed",
      "Central offices survey completed",
      "Relay / AV coordination points confirmed",
      "Checkpoints and scanning locations mapped",
      "Power points and backup availability checked"
    ]
  },
  {
    name: "ISP & Internet Connectivity",
    tasks: [
      "ISP requirement finalized",
      "Main ISP quotation received",
      "Backup ISP quotation received",
      "ISP line installation completed",
      "ISP line testing completed",
      "Static IP / public IP requirement checked",
      "ISP contact and escalation shared"
    ]
  },
  {
    name: "Network Design, VLANs & Firewall",
    tasks: [
      "Network HLD prepared",
      "IP plan prepared",
      "VLAN plan finalized",
      "Firewall policy finalized",
      "ITS app access rule configured",
      "Public Wi-Fi access rules configured",
      "Network diagram attached"
    ]
  },
  {
    name: "Cabling & Construction Coordination",
    tasks: [
      "Cable route plan shared with construction team",
      "LAN point requirement finalized",
      "Fiber requirement checked",
      "Cabling vendor finalized",
      "Cabling work started",
      "Cabling testing completed",
      "Cable labeling completed"
    ]
  },
  {
    name: "Hardware Procurement & Inventory",
    tasks: [
      "Required hardware list finalized",
      "Existing inventory checked",
      "Buy vs rent decision completed",
      "Quotations received",
      "Approval received",
      "Hardware delivered",
      "Inventory serial numbers recorded",
      "Accessories arranged"
    ]
  },
  {
    name: "Wi-Fi & Access Points",
    tasks: [
      "Wi-Fi coverage plan prepared",
      "AP quantity finalized",
      "AP mounting locations confirmed",
      "Public Wi-Fi SSID configured",
      "Internal SSID configured",
      "Captive portal or password policy finalized",
      "Wi-Fi load test completed"
    ]
  },
  {
    name: "Servers, Applications & Services",
    tasks: [
      "Server requirement finalized",
      "Application dependency list prepared",
      "Server setup completed",
      "Backup process configured",
      "Application testing completed",
      "Access credentials secured",
      "Recovery plan documented"
    ]
  },
  {
    name: "Scanning, E-Pass & Checkpoint IT",
    tasks: [
      "Checkpoint list finalized",
      "Scanner/device quantity finalized",
      "Device allocation completed",
      "Checkpoint internet tested",
      "ITS/e-pass scanning tested",
      "Backup process for scanning failure prepared",
      "Checkpoint IT support assigned"
    ]
  },
  {
    name: "Printers, Office IT & Department Support",
    tasks: [
      "Department IT requirements collected",
      "Printer requirement finalized",
      "Printer setup completed",
      "Office LAN/Wi-Fi tested",
      "Shared folders / access requirements checked",
      "SHZ OFFICES IT setup completed",
      "Support contact shared with departments"
    ]
  },
  {
    name: "Power Backup & UPS",
    tasks: [
      "Critical IT power points identified",
      "UPS requirement finalized",
      "Generator backup coordination completed",
      "Power failover test completed",
      "Spare adapters and extensions arranged"
    ]
  },
  {
    name: "Testing, Dry Run & Readiness",
    tasks: [
      "Full network test completed",
      "Main ISP failover tested",
      "Scanning dry run completed",
      "Office IT dry run completed",
      "Waaz-time firewall rules tested",
      "Post-waaz internet rules tested",
      "Final readiness sign-off received"
    ]
  },
  {
    name: "Event-Day Operations",
    tasks: [
      "IT command center setup completed",
      "Shift roster finalized",
      "Daily issue log maintained",
      "Vendor standby confirmed",
      "Spare equipment kept ready",
      "Daily city status update received"
    ]
  },
  {
    name: "Post-Event Closure & Handover",
    tasks: [
      "Equipment collected",
      "Inventory returned and verified",
      "Vendor bills collected",
      "Incident report prepared",
      "Final city IT report prepared",
      "Lessons learned documented",
      "Documents archived"
    ]
  }
];

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

export function createDefaultTask(city: string, workstream: string, taskName: string): TrackerTask {
  const now = new Date().toISOString();
  return {
    id: makeTaskId(city, workstream, taskName),
    city,
    zoneArea: inferArea(taskName, workstream),
    workstream,
    taskName: toSentenceCase(taskName),
    ownershipType: "Joint",
    taskOwner: "",
    supportingPerson: "",
    priority: "Medium",
    eventCriticality: inferCriticality(taskName, workstream),
    status: "Not Started",
    progress: 0,
    dueDate: "",
    targetReadinessDate: "",
    dependency: "",
    vendorName: "",
    vendorContact: "",
    vendors: [],
    budgetStatus: "Not Required",
    documentStatus: "Not Attached",
    riskLevel: "Medium",
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
    WORKSTREAMS.flatMap((workstream) => workstream.tasks.map((taskName) => createDefaultTask(city, workstream.name, taskName)))
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

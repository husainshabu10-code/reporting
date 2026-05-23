import {
  PRIORITY_OPTIONS,
  TASK_TYPES,
  TEAM_TYPES,
  UNIT_OPTIONS,
  ZONE_TYPES,
  type Area,
  type AreaAccess,
  type EventPrepState,
  type FormField,
  type GlobalOption,
  type LiveTask,
  type Profile,
  type Reminder,
  type TaskTemplate,
  type ZoneType
} from "@/lib/eventPrepTypes";

const now = new Date().toISOString();

export const zoneTypes: ZoneType[] = ZONE_TYPES.map((name, index) => ({
  id: `zone-${index + 1}`,
  name,
  displayOrder: index + 1
}));

export const seedProfiles: Profile[] = [
  { id: "profile-super-admin", email: "superadmin@example.com", fullName: "Super Admin", role: "super_admin", status: "active", mustChangePassword: false },
  { id: "profile-admin", email: "admin@example.com", fullName: "Admin User", role: "admin", status: "active", mustChangePassword: false },
  { id: "profile-area-admin", email: "area.admin@example.com", fullName: "CMZ Area Admin", role: "area_admin", status: "active", mustChangePassword: false },
  { id: "profile-verifier", email: "verifier@example.com", fullName: "Central IT Verifier", role: "verifier", status: "active", mustChangePassword: false },
  { id: "profile-report-user", email: "report.user@example.com", fullName: "CMZ Report User", role: "report_user", status: "active", mustChangePassword: false },
  { id: "profile-viewer", email: "viewer@example.com", fullName: "Viewer", role: "viewer", status: "active", mustChangePassword: false }
];

export const seedAreas: Area[] = [
  {
    id: "area-cmz-main",
    zoneTypeId: "zone-1",
    name: "CMZ Main Area",
    code: "CMZ-MAIN",
    active: true,
    dailyDeadline: "20:00",
    reminderTime: "18:30",
    escalationTime: "21:00"
  },
  {
    id: "area-central-shz",
    zoneTypeId: "zone-2",
    name: "SHZ OFFICES",
    code: "SHZ-OFFICES",
    active: true,
    dailyDeadline: "20:00",
    reminderTime: "18:30",
    escalationTime: "21:00"
  },
  {
    id: "area-relay-1",
    zoneTypeId: "zone-3",
    name: "Relay Zone 1 - Area Name",
    code: "RELAY-1",
    active: true,
    dailyDeadline: "20:00",
    reminderTime: "18:30",
    escalationTime: "21:00"
  }
];

export const seedAreaAccess: AreaAccess[] = [
  { id: "access-area-admin-cmz", profileId: "profile-area-admin", areaId: "area-cmz-main", role: "area_admin" },
  { id: "access-report-cmz", profileId: "profile-report-user", areaId: "area-cmz-main", role: "report_user" },
  { id: "access-verifier-cmz", profileId: "profile-verifier", areaId: "area-cmz-main", role: "verifier" },
  { id: "access-verifier-shz", profileId: "profile-verifier", areaId: "area-central-shz", role: "verifier" }
];

export const seedTaskTemplates: TaskTemplate[] = [
  {
    id: "template-isp-confirmation",
    day: 1,
    priorityLevel: "Critical",
    mainObjective: "Confirm connectivity readiness",
    workstream: "ISP & Internet Connectivity",
    taskDetails: "Confirm primary and backup ISP availability with site handoff timeline.",
    responsibleTeam: "Central IT",
    followUpQuestions: "Has the vendor confirmed delivery date and escalation contact?",
    requiredEquipment: "ISP router, fiber/copper handoff, static IP details",
    expectedOutput: "ISP readiness confirmed with escalation path.",
    testingRequired: "Yes",
    hiddenReference: { dependencies: "Vendor confirmation", riskIfDelayed: "Network readiness delay" },
    importedAt: now
  },
  {
    id: "template-ap-installation",
    day: 3,
    priorityLevel: "High",
    mainObjective: "Prepare wireless coverage",
    workstream: "Wi-Fi & Access Points",
    taskDetails: "Install and label required access points in the assigned area.",
    responsibleTeam: "Local IT Team",
    followUpQuestions: "Are all mounting locations accessible and powered?",
    requiredEquipment: "Access points, patch cords, mounting kit",
    expectedOutput: "Area Wi-Fi APs installed and ready for testing.",
    testingRequired: "Yes",
    hiddenReference: { dependencies: "Cabling completed", riskIfDelayed: "Coverage gap" },
    importedAt: now
  },
  {
    id: "template-power-check",
    day: 2,
    priorityLevel: "High",
    mainObjective: "Confirm power backup",
    workstream: "Power Backup & UPS",
    taskDetails: "Check UPS, power points, and extension availability for critical IT equipment.",
    responsibleTeam: "Electrician/Power Team",
    followUpQuestions: "Is backup power available for all critical points?",
    requiredEquipment: "UPS, extensions, power tester",
    expectedOutput: "Power readiness confirmed for the area.",
    testingRequired: "No",
    importedAt: now
  }
];

export const seedLiveTasks: LiveTask[] = [
  {
    id: "live-cmz-isp",
    templateId: "template-isp-confirmation",
    areaId: "area-cmz-main",
    taskType: "Testing-Based Task",
    prepDay: 1,
    startDate: "2026-06-01",
    dueDate: "2026-06-01",
    priority: "Critical",
    assignedProfileIds: ["profile-report-user"],
    assignedVerifierIds: ["profile-verifier"],
    verificationRequired: true,
    verificationRule: "one_verifier",
    evidenceNote: "Upload ISP confirmation or test screenshot if available.",
    active: true,
    notApplicable: false
  },
  {
    id: "live-cmz-ap",
    templateId: "template-ap-installation",
    areaId: "area-cmz-main",
    taskType: "Quantity-Based Task",
    prepDay: 3,
    startDate: "2026-06-03",
    dueDate: "2026-06-03",
    priority: "High",
    requiredQuantity: 10,
    unit: "Device",
    assignedProfileIds: ["profile-report-user"],
    assignedVerifierIds: ["profile-verifier"],
    verificationRequired: true,
    verificationRule: "one_verifier",
    evidenceNote: "Photo evidence recommended after installation.",
    active: true,
    notApplicable: false
  }
];

const optionGroups: Array<[string, readonly string[]]> = [
  ["Workstreams", ["ISP & Internet Connectivity", "Wi-Fi & Access Points", "Power Backup & UPS", "Network Design, VLANs & Firewall"]],
  ["Priority options", PRIORITY_OPTIONS],
  ["Units", UNIT_OPTIONS],
  ["Team Types", TEAM_TYPES],
  ["Task Types", TASK_TYPES],
  ["Status options", ["Pending", "In Progress", "Completed", "Issue Found"]],
  ["Request types", ["Extra Equipment Request", "Extra Manpower / Support Request", "Change in Required Quantity", "Technical Issue / Support Request", "Access Request", "Other Custom Request", "Not Applicable / Task Removal Request"]],
  ["Evidence types", ["Photo", "Document", "Test Screenshot", "Signed Handoff"]],
  ["Reminder types", ["Daily report submission", "Partially updated daily reports", "Overdue tasks", "Tasks due today", "Pending verification", "Partially verified tasks", "Rejected / Needs Correction tasks", "Requests needing review", "Requests sent for verification", "Access requests pending approval"]],
  ["Activity Log Categories", ["Login activity", "Task updates", "File activity", "Daily reports", "Verification actions", "Requests", "Access changes", "Area changes", "Template changes", "Reminder activity", "Form/global field changes"]]
];

const seedGlobalOptions: GlobalOption[] = optionGroups.flatMap(([group, values]) =>
  values.map((value) => ({
    id: `${group}-${value}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    group,
    value,
    active: true
  }))
);

const defaultFields = ["status", "remarks", "file_upload", "user_role_standing", "escalation_points", "supporting_personnel"];
export const seedFormFields: FormField[] = TASK_TYPES.flatMap((taskType) =>
  [...defaultFields, ...(taskType === "Quantity-Based Task" ? ["completed_quantity"] : [])].map((fieldKey, index) => ({
    id: `${taskType}-${fieldKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    taskType,
    fieldKey,
    label: fieldKey.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    required: fieldKey === "status",
    visible: true,
    displayOrder: index + 1
  }))
);

const seedReminders: Reminder[] = [
  {
    id: "reminder-daily-report-default",
    reminderType: "Daily report submission",
    deadlineTime: "20:00",
    reminderTime: "18:30",
    escalationTime: "21:00",
    recipients: ["Admin", "Area Admin", "Verifier"],
    active: true
  },
  {
    id: "reminder-pending-verification-default",
    reminderType: "Pending verification",
    deadlineTime: "20:00",
    reminderTime: "19:00",
    escalationTime: "22:00",
    recipients: ["Verifier", "Admin"],
    active: true
  }
];

export function createSeedState(): EventPrepState {
  return {
    settings: {
      eventStartDate: "2026-06-21",
      preparationStartDate: "2026-06-01"
    },
    profiles: seedProfiles,
    zoneTypes,
    areas: seedAreas,
    areaAccess: seedAreaAccess,
    taskTemplates: seedTaskTemplates,
    liveTasks: seedLiveTasks,
    dailyReports: [],
    taskUpdates: [],
    taskFiles: [],
    verificationLogs: [],
    requests: [],
    requestReviews: [],
    reminders: seedReminders,
    notifications: [],
    activityLogs: [],
    reportExports: [],
    globalOptions: seedGlobalOptions,
    formFields: seedFormFields
  };
}

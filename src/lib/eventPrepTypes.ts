export const ZONE_TYPES = ["CMZ", "Central Office", "Relay Zone"] as const;
export const USER_ROLES = ["super_admin", "admin", "area_admin", "verifier", "report_user", "viewer"] as const;
export const TASK_TYPES = ["Simple Task", "Quantity-Based Task", "Document-Based Task", "Testing-Based Task", "Issue/Support Task"] as const;
export const USER_TASK_STATUSES = ["Pending", "In Progress", "Completed", "Issue Found"] as const;
export const VERIFICATION_STATUSES = ["Not Submitted", "Needs Verification", "Partially Verified", "Verified Completed", "Rejected / Needs Correction"] as const;
export const REPORT_STATUSES = ["Not Started", "Draft Saved", "Partially Updated", "Submitted", "Late Submitted", "Escalated", "Closed"] as const;
export const REQUEST_TYPES = [
  "Extra Equipment Request",
  "Extra Manpower / Support Request",
  "Change in Required Quantity",
  "Technical Issue / Support Request",
  "Access Request",
  "Other Custom Request",
  "Not Applicable / Task Removal Request"
] as const;
export const REQUEST_STATUSES = ["Under Review", "Sent for Verification", "Need More Info", "Approved", "Rejected", "Closed"] as const;
export const TEAM_TYPES = [
  "Local IT Team",
  "Vendor",
  "SOC",
  "NOC",
  "Central IT",
  "Volunteer",
  "Area Coordinator",
  "Relay Team",
  "Electrician/Power Team",
  "Other"
] as const;
export const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"] as const;
export const UNIT_OPTIONS = ["Item", "Point", "Device", "Link", "Rack", "Document", "Person", "Hour"] as const;

export type ZoneTypeName = (typeof ZONE_TYPES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type TaskTypeName = (typeof TASK_TYPES)[number];
export type UserTaskStatus = (typeof USER_TASK_STATUSES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type DailyReportStatus = (typeof REPORT_STATUSES)[number];
export type RequestTypeName = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type Priority = (typeof PRIORITY_OPTIONS)[number];

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: "active" | "pending_approval" | "disabled";
  mustChangePassword: boolean;
  createdBy?: string;
};

export type ZoneType = {
  id: string;
  name: ZoneTypeName;
  displayOrder: number;
};

export type Area = {
  id: string;
  zoneTypeId: string;
  name: string;
  code: string;
  active: boolean;
  dailyDeadline: string;
  reminderTime: string;
  escalationTime: string;
};

export type AreaAccess = {
  id: string;
  profileId: string;
  areaId: string;
  role: UserRole;
};

export type TaskTemplate = {
  id: string;
  source?: "imported" | "custom";
  day: number;
  priorityLevel: Priority;
  mainObjective: string;
  workstream: string;
  taskDetails: string;
  responsibleTeam: string;
  followUpQuestions: string;
  requiredEquipment: string;
  expectedOutput: string;
  testingRequired: string;
  hiddenReference?: {
    dependencies?: string;
    riskIfDelayed?: string;
  };
  importedAt: string;
};

export type LiveTask = {
  id: string;
  templateId: string;
  areaId: string;
  taskDetails?: string;
  mainObjective?: string;
  workstream?: string;
  responsibleTeam?: string;
  followUpQuestions?: string;
  requiredEquipment?: string;
  expectedOutput?: string;
  testingRequired?: string;
  taskType: TaskTypeName;
  prepDay: number;
  startDate: string;
  dueDate: string;
  actualCompletionDate?: string;
  priority: Priority;
  requiredQuantity?: number;
  unit?: string;
  assignedProfileIds: string[];
  assignedVerifierIds: string[];
  verificationRequired: boolean;
  verificationRule: "one_verifier" | "all_verifiers" | "sequential";
  evidenceNote?: string;
  active: boolean;
  notApplicable: boolean;
  delayReason?: string;
  revisedDueDate?: string;
};

export type DailyReport = {
  id: string;
  areaId: string;
  reportDate: string;
  prepDay: number;
  status: DailyReportStatus;
  generalRemark: string;
  submittedBy?: string;
  submittedAt?: string;
  updatedAt: string;
};

export type TaskUpdate = {
  id: string;
  liveTaskId: string;
  dailyReportId: string;
  updatedBy: string;
  status: UserTaskStatus;
  verificationStatus: VerificationStatus;
  remarks: string;
  completedQuantity?: number;
  userRoleStanding: string;
  escalationPoints: EscalationPoint[];
  supportingPersonnel: SupportingPerson[];
  correctionComment?: string;
  updatedAt: string;
};

export type TaskFile = {
  id: string;
  liveTaskId: string;
  taskUpdateId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath?: string;
  reviewLocked: boolean;
  uploadedAt: string;
};

export type EscalationPoint = {
  id: string;
  name: string;
  contactNumber: string;
  emailOrWhatsapp: string;
  roleStanding: string;
  teamOrganization: string;
  reason: string;
};

export type SupportingPerson = {
  id: string;
  name: string;
  contactNumber: string;
  roleStanding: string;
  teamTypes: string[];
  responsibility: string;
};

export type VerificationLog = {
  id: string;
  liveTaskId: string;
  taskUpdateId: string;
  verifierId: string;
  action: "verified" | "rejected" | "comment";
  comment: string;
  createdAt: string;
};

export type AreaRequest = {
  id: string;
  requestType: RequestTypeName;
  areaId: string;
  relatedLiveTaskId?: string;
  title: string;
  details: string;
  quantityRequested?: number;
  priority: Priority;
  requiredByDate: string;
  attachmentName?: string;
  requestedBy: string;
  status: RequestStatus;
  decisionRemarks?: string;
  createdAt: string;
};

export type RequestReview = {
  id: string;
  requestId: string;
  reviewerId: string;
  comment: string;
  recommendation: string;
  completed: boolean;
  createdAt: string;
};

export type Reminder = {
  id: string;
  areaId?: string;
  reminderType: string;
  deadlineTime: string;
  reminderTime: string;
  escalationTime: string;
  recipients: string[];
  active: boolean;
};

export type ActivityLog = {
  id: string;
  category: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
};

export type InAppNotification = {
  id: string;
  userId: string;
  areaId?: string;
  title: string;
  message: string;
  type:
    | "Daily report reminder"
    | "Missing report"
    | "Partially updated report"
    | "Task needs verification"
    | "Task needs correction"
    | "Request status changed"
    | "Access request approved/rejected"
    | "Overdue task";
  isRead: boolean;
  createdAt: string;
  relatedTaskId?: string;
  relatedRequestId?: string;
  relatedDailyReportId?: string;
};

export type GlobalOption = {
  id: string;
  group: string;
  value: string;
  active: boolean;
};

export type FormField = {
  id: string;
  taskType: TaskTypeName;
  fieldKey: string;
  label: string;
  required: boolean;
  visible: boolean;
  displayOrder: number;
};

export type EventSettings = {
  eventStartDate: string;
  preparationStartDate: string;
};

export type EventPrepState = {
  settings: EventSettings;
  profiles: Profile[];
  zoneTypes: ZoneType[];
  areas: Area[];
  areaAccess: AreaAccess[];
  taskTemplates: TaskTemplate[];
  liveTasks: LiveTask[];
  dailyReports: DailyReport[];
  taskUpdates: TaskUpdate[];
  taskFiles: TaskFile[];
  verificationLogs: VerificationLog[];
  requests: AreaRequest[];
  requestReviews: RequestReview[];
  reminders: Reminder[];
  notifications: InAppNotification[];
  activityLogs: ActivityLog[];
  globalOptions: GlobalOption[];
  formFields: FormField[];
};

export type DashboardMetrics = {
  overallVerifiedPercent: number;
  totalLiveTasks: number;
  verifiedTasks: number;
  submittedReports: number;
  missingOrPartialReports: number;
  needsVerification: number;
  issueFound: number;
  pendingRequests: number;
  daysToEvent: number;
};

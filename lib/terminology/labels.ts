/**
 * Centralized Terminology Dictionary
 *
 * This file contains all user-facing labels for the application.
 * Use these constants instead of hardcoding strings to ensure consistency.
 *
 * NOTE: These are DISPLAY labels only. Do not change database values or API routes.
 */

// =============================================================================
// NAVIGATION LABELS
// =============================================================================

export const navLabels = {
  // Main sections
  dashboard: "Dashboard",
  performance: "Performance",  // formerly "KPI"
  crm: "CRM",
  ticketing: "Ticketing",
  arDso: "AR / DSO",  // formerly just "DSO"

  // Performance (KPI) submenu
  performanceOverview: "Overview",
  myPerformance: "My Performance",  // formerly "My KPI"
  teamPerformance: "Team Performance",  // formerly "Team KPI"
  performanceTargets: "Targets",
  performanceUpdates: "Updates",  // formerly "Input"

  // CRM submenu
  leadTriageQueue: "Lead Triage Queue",  // formerly "Lead Inbox"
  myWorkQueue: "My Work Queue",  // formerly "Sales Inbox"
  salesPipeline: "Sales Pipeline",  // formerly "Pipeline"
  accounts: "Accounts",
  // Renamed to Targets in the CRM target-state
  prospectingTargets: "Targets",  // formerly "Prospecting Targets"
  activities: "Activities",
  actionableItems: "Actionable Items",  // "No Record Left Behind" debug view

  // Ticketing submenu
  allTickets: "All Tickets",
  createTicket: "Create Ticket",

  // AR/DSO submenu
  dsoOverview: "Overview",
  invoices: "Invoices",
  payments: "Payments",
} as const;

// =============================================================================
// PAGE LABELS (Titles, Subtitles, Breadcrumbs)
// =============================================================================

export const pageLabels = {
  // CRM Pages
  leadTriageQueue: {
    title: "Lead Triage Queue",
    subtitle: "Intake work queue (not messages). Qualify before sending to Sales Pool.",
    breadcrumb: "Lead Triage Queue",
  },
  myWorkQueue: {
    title: "My Work Queue",
    subtitle: "Daily follow-ups by due date. Every open item requires Next Action + Due Date.",
    breadcrumb: "My Work Queue",
  },
  salesPipeline: {
    title: "Sales Pipeline",
    subtitle: "Track opportunities through the sales process.",
    breadcrumb: "Sales Pipeline",
  },
  accounts: {
    title: "Accounts",
    subtitle: "Master customer records and company profiles.",
    breadcrumb: "Accounts",
  },
  accountDetail: {
    title: "Account Details",
    subtitle: "360-degree view of account information.",
    breadcrumb: "Account Details",
  },
  prospectingTargets: {
    // Renamed to Targets in the CRM target-state
    title: "Targets",
    subtitle: "Pre-lead workspace. Convert when qualified.",
    breadcrumb: "Targets",
  },
  activities: {
    title: "Activities",
    subtitle: "Track all interactions and follow-ups.",
    breadcrumb: "Activities",
  },
  activityPlanner: {
    title: "Activity Planner",
    subtitle: "Plan and schedule upcoming activities.",
    breadcrumb: "Activity Planner",
  },
  actionable: {
    title: "Actionable Items",
    subtitle: "No record left behind - all items requiring attention.",
    breadcrumb: "Actionable Items",
  },

  // Performance (KPI) Pages
  performanceOverview: {
    title: "Performance Overview",
    subtitle: "Key metrics and performance indicators.",
    breadcrumb: "Overview",
  },
  myPerformance: {
    title: "My Performance",
    subtitle: "Your personal performance metrics and goals.",
    breadcrumb: "My Performance",
  },
  teamPerformance: {
    title: "Team Performance",
    subtitle: "Team-wide performance metrics and comparisons.",
    breadcrumb: "Team Performance",
  },
  performanceTargets: {
    title: "Performance Targets",
    subtitle: "Set and track performance goals.",
    breadcrumb: "Targets",
  },
  performanceUpdates: {
    title: "Performance Updates",
    subtitle: "Manual data entry for performance tracking.",
    breadcrumb: "Updates",
  },

  // AR/DSO Pages
  arDsoOverview: {
    title: "AR / DSO Overview",
    subtitle: "Accounts receivable and days sales outstanding metrics.",
    breadcrumb: "Overview",
  },
} as const;

// =============================================================================
// ACTION LABELS (Buttons, Links, CTAs)
// =============================================================================

export const actionLabels = {
  // Lead actions
  sendToSalesPool: "Send to Sales Pool",  // formerly "Handover"
  claimLead: "Claim Lead",  // formerly "Get Lead" / "Claim"
  triageLead: "Triage",
  qualifyLead: "Qualify",
  nurtureLead: "Nurture",
  disqualifyLead: "Disqualify",

  // Opportunity actions
  quickCreate: "Quick Create",  // formerly "Quick Add"
  changeStage: "Change Stage",
  convertToLeadOpportunity: "Convert to Lead & Opportunity",  // formerly "Convert"

  // Activity actions
  completeActivity: "Complete",
  scheduleActivity: "Schedule Activity",
  logActivity: "Log Activity",

  // Common actions
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  view: "View",
  add: "Add",
  create: "Create",
  search: "Search",
  filter: "Filter",
  export: "Export",
  import: "Import",
  refresh: "Refresh",
} as const;

// =============================================================================
// STATUS & FIELD LABELS
// =============================================================================

export const fieldLabels = {
  // Time-related
  nextAction: "Next Action",  // formerly "Next Step"
  nextActionDate: "Next Action Date",
  pastDue: "Past Due",  // formerly "Overdue"
  responseSla: "Response SLA",  // formerly "SLA"
  responseTimeSla: "Response Time SLA",
  dueDate: "Due Date",
  createdAt: "Created",
  updatedAt: "Updated",

  // Entity fields
  companyName: "Company Name",
  contactName: "Contact Name",
  email: "Email",
  phone: "Phone",
  source: "Source",
  notes: "Notes",
  status: "Status",
  stage: "Stage",
  owner: "Owner",
  value: "Value",
  probability: "Probability",
  expectedCloseDate: "Expected Close Date",

  // Common column headers
  actions: "Actions",
  activity: "Activity",
  account: "Account",
  contact: "Contact",
  amount: "Amount",
  date: "Date",
  type: "Type",
} as const;

// =============================================================================
// LEAD STATUS DISPLAY LABELS
// =============================================================================

const leadStatusMap: Record<string, string> = {
  new: "New",
  "New": "New",
  contacted: "Contacted",
  "Contacted": "Contacted",
  "In Review": "In Review",
  qualified: "Qualified",
  "Qualified": "Qualified",
  nurture: "Nurture",
  "Nurture": "Nurture",
  disqualified: "Disqualified",
  "Disqualified": "Disqualified",
  converted: "Converted",
  "Converted": "Converted",
  "Handed Over": "Sent to Sales Pool",
};

export function getLeadStatusLabel(status: string): string {
  return leadStatusMap[status] || status;
}

// =============================================================================
// OPPORTUNITY STAGE DISPLAY LABELS
// =============================================================================

const opportunityStageMap: Record<string, string> = {
  // Map stored values to display labels
  "Prospecting": "Prospecting",
  "SQL Qualified": "SQL Qualified (Actionable)",
  "Discovery": "Discovery",
  "Discovery Completed": "Discovery (Confirmed)",
  "Rate Build": "Solutioning (Build Rate)",
  "Solutioning": "Solutioning (Build Rate)",
  "Proposal Sent": "Proposal Sent",
  "Quote Sent": "Quote Sent (Delivered)",
  "Follow-up Active": "Follow-up (Active)",
  "Negotiation": "Negotiation",
  "Approval": "Approval / Credit Check",
  "Credit Check": "Approval / Credit Check",
  "Approval / Credit Check": "Approval / Credit Check",
  "Booking": "Booking / Trial",
  "Trial Shipment": "Booking / Trial",
  "Booking / Trial Shipment": "Booking / Trial",
  "Verbal Commit": "Verbal Commit",
  "Won": "Won (Onboarding)",
  "Closed Won": "Won (Onboarding)",
  "Won (Onboarding)": "Won (Onboarding)",
  "Lost": "Lost / Nurture",
  "Closed Lost": "Lost / Nurture",
  "Lost / Nurture": "Lost / Nurture",
  "On Hold": "On Hold",
};

export function getOpportunityStageLabel(stage: string): string {
  return opportunityStageMap[stage] || stage;
}

// =============================================================================
// ACTIVITY TYPE DISPLAY LABELS
// =============================================================================

const activityTypeMap: Record<string, string> = {
  "Call": "Call",
  "Email": "Email",
  "Visit": "Visit",
  "Online Meeting": "Online Meeting",
  "WhatsApp": "WhatsApp",
  "LinkedIn Message": "LinkedIn Message",
  "Send Proposal": "Send Proposal",
  "Send Quote": "Send Quote",
  "Follow Up": "Follow Up",
  "Internal Meeting": "Internal Meeting",
  "Other": "Other",
};

export function getActivityTypeLabel(type: string): string {
  return activityTypeMap[type] || type;
}

// =============================================================================
// EMPTY STATE MESSAGES
// =============================================================================

export const emptyStateMessages = {
  leadTriageQueue: {
    title: "No leads to triage",
    description: "New leads will appear here for qualification.",
  },
  myWorkQueue: {
    title: "No pending activities",
    description: "Your work queue is clear. Great job!",
  },
  salesPipeline: {
    title: "No opportunities",
    description: "Create your first opportunity to start tracking deals.",
  },
  accounts: {
    title: "No accounts found",
    description: "Add your first account to get started.",
  },
  prospectingTargets: {
    title: "No prospecting targets",
    description: "Add targets to build your prospecting list.",
  },
  activities: {
    title: "No activities",
    description: "Schedule activities to track your customer interactions.",
  },
  actionable: {
    title: "All clear!",
    description: "No urgent items require attention. Great job keeping everything on track!",
  },
  noResults: {
    title: "No results found",
    description: "Try adjusting your search or filter criteria.",
  },
} as const;

// =============================================================================
// TOAST / NOTIFICATION MESSAGES
// =============================================================================

export const toastMessages = {
  // Success messages
  leadSentToSalesPool: "Lead sent to Sales Pool",
  leadClaimed: "Lead claimed successfully",
  leadQualified: "Lead qualified",
  leadDisqualified: "Lead disqualified",
  opportunityCreated: "Opportunity created",
  opportunityStageChanged: "Stage updated successfully",
  activityCompleted: "Activity completed",
  activityScheduled: "Activity scheduled",
  accountCreated: "Account created",
  accountUpdated: "Account updated",
  targetConverted: "Target converted to Lead & Opportunity",
  saved: "Changes saved",

  // Error messages
  errorGeneric: "An error occurred. Please try again.",
  errorLoading: "Failed to load data",
  errorSaving: "Failed to save changes",
  errorClaimingLead: "Failed to claim lead. It may have been claimed by another user.",
} as const;

// =============================================================================
// MODAL TITLES
// =============================================================================

export const modalTitles = {
  triageLead: "Triage Lead",
  sendToSalesPool: "Send to Sales Pool",
  claimLead: "Claim Lead",
  changeStage: "Change Opportunity Stage",
  quickCreateOpportunity: "Quick Create Opportunity",
  addActivity: "Add Activity",
  completeActivity: "Complete Activity",
  addAccount: "Add Account",
  addContact: "Add Contact",
  addTarget: "Add Prospecting Target",
  convertTarget: "Convert Target",
  confirmAction: "Confirm Action",
} as const;

// =============================================================================
// LEGACY TERM NORMALIZER (for auto-fix of scattered strings)
// =============================================================================

const legacyTermMap: Record<string, string> = {
  // Inbox -> Queue terminology
  "Lead Inbox": "Lead Triage Queue",
  "Sales Inbox": "My Work Queue",
  "inbox": "queue",
  "Inbox": "Queue",

  // Customer -> Account
  "Customer": "Account",
  "Customers": "Accounts",
  "customer": "account",
  "customers": "accounts",

  // Prospect -> Opportunity (in certain contexts)
  "Prospect": "Opportunity",
  "Prospects": "Opportunities",

  // Task -> Activity
  "Task": "Activity",
  "Tasks": "Activities",
  "task": "activity",
  "tasks": "activities",

  // KPI -> Performance
  "KPI": "Performance",
  "My KPI": "My Performance",
  "Team KPI": "Team Performance",

  // Action terminology
  "Handover": "Send to Sales Pool",
  "handover": "send to Sales Pool",
  "Next Step": "Next Action",
  "next step": "next action",
  "Overdue": "Past Due",
  "overdue": "past due",
  "SLA": "Response SLA",
};

/**
 * Normalize legacy terms to current terminology.
 * Use this for migrating old strings or validating consistency.
 */
export function normalizeLabel(input: string): string {
  return legacyTermMap[input] || input;
}

/**
 * Check if a string contains any legacy terms that should be updated.
 */
export function hasLegacyTerms(input: string): boolean {
  const legacyPatterns = [
    /\bInbox\b/,
    /\bCustomer(s)?\b/,
    /\bProspect(s)?\b/,
    /\bTask(s)?\b/,
    /\bKPI\b/,
    /\bHandover\b/,
    /\bOverdue\b/,
  ];
  return legacyPatterns.some(pattern => pattern.test(input));
}

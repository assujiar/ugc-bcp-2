/**
 * RBAC Permissions Configuration
 * LOCKED - 5 TOP-LEVEL MENUS ONLY - DO NOT ADD
 *
 * @see BLUEPRINT.md Section 2.2, 7.3
 * @see docs/validator.json
 */

import type { RoleName } from "./roles";

// Top-level menu items (EXACT MATCH - 5 ONLY)
export const TOP_LEVEL_MENUS = [
  "Dashboard",
  "KPI",
  "CRM",
  "Ticketing",
  "DSO",
] as const;

export type MenuItem = (typeof TOP_LEVEL_MENUS)[number];

// Menu count validation
export const MENU_COUNT = 5;
if (TOP_LEVEL_MENUS.length !== MENU_COUNT) {
  throw new Error(`VALIDATION FAILED: Expected ${MENU_COUNT} menus, got ${TOP_LEVEL_MENUS.length}`);
}

// Access level types
export type AccessLevel =
  | "NA"           // No access - menu not shown
  | "R"            // Read only
  | "R_ALL"        // Read all (Director)
  | "R_OWN"        // Read own data only
  | "R_TEAM"       // Read team data
  | "R_SLA"        // Read SLA/response time only
  | "R_AR_DSO"     // Read AR/DSO summary
  | "R_SCOPED"     // Read scoped by customer ownership
  | "RW"           // Read/Write
  | "RW_OWN"       // Read/Write own data
  | "RW_ASSIST"    // Read/Write assist (sales support)
  | "RW_DEPT_MASKED" // Read/Write department + masked view
  | "A";           // Admin (full access)

// RBAC Matrix: Role → Menu → Access Level
// Source of truth from BLUEPRINT.md Section 7.2
export const RBAC_MATRIX: Record<RoleName, Record<MenuItem, AccessLevel>> = {
  "Director": {
    Dashboard: "R_ALL",
    KPI: "R",
    CRM: "R",
    Ticketing: "R",
    DSO: "R",
  },
  "super admin": {
    Dashboard: "R",
    KPI: "A",
    CRM: "A",
    Ticketing: "A",
    DSO: "A",
  },
  "Marketing Manager": {
    Dashboard: "R",
    KPI: "RW",
    CRM: "RW",
    Ticketing: "RW",
    DSO: "NA",
  },
  "Marcomm (marketing staff)": {
    Dashboard: "R_OWN",
    KPI: "RW_OWN",
    CRM: "RW_OWN",
    Ticketing: "RW",
    DSO: "NA",
  },
  "DGO (Marketing staff)": {
    Dashboard: "R_OWN",
    KPI: "RW_OWN",
    CRM: "RW_OWN",
    Ticketing: "RW",
    DSO: "NA",
  },
  "MACX (marketing staff)": {
    Dashboard: "R_OWN",
    KPI: "RW_OWN",
    CRM: "RW_OWN",
    Ticketing: "RW",
    DSO: "NA",
  },
  "VSDO (marketing staff)": {
    Dashboard: "R_OWN",
    KPI: "RW_OWN",
    CRM: "RW_OWN",
    Ticketing: "RW",
    DSO: "NA",
  },
  "sales manager": {
    Dashboard: "R_TEAM",
    KPI: "RW",
    CRM: "RW",
    Ticketing: "RW",
    DSO: "R_SCOPED",
  },
  "salesperson": {
    Dashboard: "R_OWN",
    KPI: "RW_OWN",
    CRM: "RW_OWN",
    Ticketing: "RW",
    DSO: "R_SCOPED",
  },
  "sales support": {
    Dashboard: "NA",
    KPI: "NA",
    CRM: "RW_ASSIST",
    Ticketing: "RW",
    DSO: "NA",
  },
  "EXIM Ops (operation)": {
    Dashboard: "R_SLA",
    KPI: "NA",
    CRM: "NA",
    Ticketing: "RW_DEPT_MASKED",
    DSO: "NA",
  },
  "domestics Ops (operation)": {
    Dashboard: "R_SLA",
    KPI: "NA",
    CRM: "NA",
    Ticketing: "RW_DEPT_MASKED",
    DSO: "NA",
  },
  "Import DTD Ops (operation)": {
    Dashboard: "R_SLA",
    KPI: "NA",
    CRM: "NA",
    Ticketing: "RW_DEPT_MASKED",
    DSO: "NA",
  },
  "traffic & warehous (operation)": {
    Dashboard: "R_SLA",
    KPI: "NA",
    CRM: "NA",
    Ticketing: "RW_DEPT_MASKED",
    DSO: "NA",
  },
  "finance": {
    Dashboard: "R_AR_DSO",
    KPI: "R",
    CRM: "R",
    Ticketing: "NA",
    DSO: "RW",
  },
};

/**
 * Get allowed menus for a role
 * CRITICAL: Only returns menus where access !== "NA"
 * Sidebar MUST use this function - no disabled/greyed menus allowed
 */
export function getAllowedMenus(role: RoleName): MenuItem[] {
  const permissions = RBAC_MATRIX[role];
  return TOP_LEVEL_MENUS.filter((menu) => permissions[menu] !== "NA");
}

/**
 * Check if role can access a specific menu
 */
export function canAccessMenu(role: RoleName, menu: MenuItem): boolean {
  return RBAC_MATRIX[role][menu] !== "NA";
}

/**
 * Get access level for a role on a menu
 */
export function getAccessLevel(role: RoleName, menu: MenuItem): AccessLevel {
  return RBAC_MATRIX[role][menu];
}

/**
 * Check if role has write access to a menu
 */
export function canWrite(role: RoleName, menu: MenuItem): boolean {
  const level = RBAC_MATRIX[role][menu];
  return level.startsWith("RW") || level === "A";
}

/**
 * Check if role is admin for a menu
 */
export function isAdmin(role: RoleName, menu: MenuItem): boolean {
  return RBAC_MATRIX[role][menu] === "A";
}

/**
 * Check if role is read-only (Director pattern)
 */
export function isReadOnly(role: RoleName): boolean {
  return role === "Director";
}

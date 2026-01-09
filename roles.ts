/**
 * RBAC Roles Configuration
 * LOCKED - 15 ROLES EXACT - DO NOT ADD OR MODIFY
 *
 * @see BLUEPRINT.md Section 2.1
 * @see docs/validator.json
 */

// Type-safe role names (EXACT MATCH REQUIRED)
export const ROLES = [
  "Director",
  "super admin",
  "Marketing Manager",
  "Marcomm (marketing staff)",
  "DGO (Marketing staff)",
  "MACX (marketing staff)",
  "VSDO (marketing staff)",
  "sales manager",
  "salesperson",
  "sales support",
  "EXIM Ops (operation)",
  "domestics Ops (operation)",
  "Import DTD Ops (operation)",
  "traffic & warehous (operation)",
  "finance",
] as const;

export type RoleName = (typeof ROLES)[number];

// Role count validation
export const ROLES_COUNT = 15;
if (ROLES.length !== ROLES_COUNT) {
  throw new Error(`VALIDATION FAILED: Expected ${ROLES_COUNT} roles, got ${ROLES.length}`);
}

// Role groups for easier checks
export const ROLE_GROUPS = {
  director: ["Director"] as const,
  superAdmin: ["super admin"] as const,
  marketingManager: ["Marketing Manager"] as const,
  marketingStaff: [
    "Marcomm (marketing staff)",
    "DGO (Marketing staff)",
    "MACX (marketing staff)",
    "VSDO (marketing staff)",
  ] as const,
  salesManager: ["sales manager"] as const,
  salesperson: ["salesperson"] as const,
  salesSupport: ["sales support"] as const,
  ops: [
    "EXIM Ops (operation)",
    "domestics Ops (operation)",
    "Import DTD Ops (operation)",
    "traffic & warehous (operation)",
  ] as const,
  finance: ["finance"] as const,
} as const;

// Combined groups for convenience
export const ALL_MARKETING_ROLES: RoleName[] = [
  "Marketing Manager",
  ...ROLE_GROUPS.marketingStaff,
];

export const ALL_SALES_ROLES: RoleName[] = [
  "sales manager",
  "salesperson",
  "sales support",
];

export const ALL_OPS_ROLES: RoleName[] = [...ROLE_GROUPS.ops];

// Helper functions
export function isDirector(role: RoleName): boolean {
  return role === "Director";
}

export function isSuperAdmin(role: RoleName): boolean {
  return role === "super admin";
}

export function isMarketingManager(role: RoleName): boolean {
  return role === "Marketing Manager";
}

export function isMarketingStaff(role: RoleName): boolean {
  return (ROLE_GROUPS.marketingStaff as readonly string[]).includes(role);
}

export function isMarketing(role: RoleName): boolean {
  return ALL_MARKETING_ROLES.includes(role);
}

export function isSalesManager(role: RoleName): boolean {
  return role === "sales manager";
}

export function isSalesperson(role: RoleName): boolean {
  return role === "salesperson";
}

export function isSalesSupport(role: RoleName): boolean {
  return role === "sales support";
}

export function isSales(role: RoleName): boolean {
  return ALL_SALES_ROLES.includes(role);
}

export function isOps(role: RoleName): boolean {
  return ALL_OPS_ROLES.includes(role);
}

export function isFinance(role: RoleName): boolean {
  return role === "finance";
}

// Validate role is in the list
export function isValidRole(role: string): role is RoleName {
  return (ROLES as readonly string[]).includes(role);
}

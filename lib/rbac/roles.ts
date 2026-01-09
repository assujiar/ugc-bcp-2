/**
 * RBAC Role Definitions
 * 
 * LOCKED: 15 Roles - DO NOT MODIFY
 */

import { RoleName, ROLES } from "@/lib/types";

// Role category helpers
export const MARKETING_ROLES: RoleName[] = [
  "Marketing Manager",
  "Marcomm (marketing staff)",
  "DGO (Marketing staff)",
  "MACX (marketing staff)",
  "VSDO (marketing staff)",
];

export const SALES_ROLES: RoleName[] = [
  "sales manager",
  "salesperson",
  "sales support",
];

export const OPS_ROLES: RoleName[] = [
  "EXIM Ops (operation)",
  "domestics Ops (operation)",
  "Import DTD Ops (operation)",
  "traffic & warehous (operation)",
];

export const ADMIN_ROLES: RoleName[] = ["super admin", "Director"];

// Role check helpers
export function isValidRole(role: string): role is RoleName {
  return ROLES.includes(role as RoleName);
}

export function isMarketingRole(role: RoleName): boolean {
  return MARKETING_ROLES.includes(role);
}

export function isSalesRole(role: RoleName): boolean {
  return SALES_ROLES.includes(role);
}

export function isOpsRole(role: RoleName): boolean {
  return OPS_ROLES.includes(role);
}

export function isAdminRole(role: RoleName): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdmin(role: RoleName): boolean {
  return role === "super admin";
}

export function isDirector(role: RoleName): boolean {
  return role === "Director";
}

export function isFinance(role: RoleName): boolean {
  return role === "finance";
}

// Get role category
export function getRoleCategory(
  role: RoleName
): "admin" | "marketing" | "sales" | "ops" | "finance" {
  if (isAdminRole(role)) return "admin";
  if (isMarketingRole(role)) return "marketing";
  if (isSalesRole(role)) return "sales";
  if (isOpsRole(role)) return "ops";
  if (isFinance(role)) return "finance";
  return "admin"; // fallback
}

/**
 * RBAC Permissions
 * 
 * Menu access control based on role
 * LOCKED: 5 Menus - DO NOT MODIFY
 */

import { MenuName, RoleName, ROLE_MENU_ACCESS, MENUS } from "@/lib/types";

/**
 * Get allowed menus for a role
 * Returns only menus the role can access
 */
export function getAllowedMenus(role: RoleName): MenuName[] {
  return ROLE_MENU_ACCESS[role] || [];
}

/**
 * Check if a role can access a specific menu
 */
export function canAccessMenu(role: RoleName, menu: MenuName): boolean {
  const allowedMenus = getAllowedMenus(role);
  return allowedMenus.includes(menu);
}

/**
 * Get menu visibility map for sidebar rendering
 */
export function getMenuVisibility(role: RoleName): Record<MenuName, boolean> {
  const allowedMenus = getAllowedMenus(role);
  return MENUS.reduce(
    (acc, menu) => {
      acc[menu] = allowedMenus.includes(menu);
      return acc;
    },
    {} as Record<MenuName, boolean>
  );
}

// ==========================================
// MODULE-SPECIFIC PERMISSIONS
// ==========================================

export type PermissionLevel = "R" | "RW" | "A" | "NA";

interface ModulePermission {
  read: boolean;
  write: boolean;
  admin: boolean;
  scoped: "all" | "team" | "own" | "dept" | "none";
}

/**
 * Get CRM permissions for a role
 */
export function getCRMPermission(role: RoleName): ModulePermission {
  switch (role) {
    case "Director":
      return { read: true, write: false, admin: false, scoped: "all" };
    case "super admin":
      return { read: true, write: true, admin: true, scoped: "all" };
    case "Marketing Manager":
      return { read: true, write: true, admin: false, scoped: "all" };
    case "Marcomm (marketing staff)":
    case "DGO (Marketing staff)":
    case "MACX (marketing staff)":
    case "VSDO (marketing staff)":
      return { read: true, write: true, admin: false, scoped: "own" };
    case "sales manager":
      return { read: true, write: true, admin: false, scoped: "team" };
    case "salesperson":
      return { read: true, write: true, admin: false, scoped: "own" };
    case "sales support":
      return { read: true, write: true, admin: false, scoped: "all" };
    case "finance":
      return { read: true, write: false, admin: false, scoped: "all" };
    default:
      return { read: false, write: false, admin: false, scoped: "none" };
  }
}

/**
 * Get Ticketing permissions for a role
 */
export function getTicketingPermission(role: RoleName): ModulePermission {
  switch (role) {
    case "Director":
      return { read: true, write: false, admin: false, scoped: "all" };
    case "super admin":
      return { read: true, write: true, admin: true, scoped: "all" };
    case "Marketing Manager":
    case "Marcomm (marketing staff)":
    case "DGO (Marketing staff)":
    case "MACX (marketing staff)":
    case "VSDO (marketing staff)":
    case "sales manager":
    case "salesperson":
    case "sales support":
      return { read: true, write: true, admin: false, scoped: "all" };
    case "EXIM Ops (operation)":
    case "domestics Ops (operation)":
    case "Import DTD Ops (operation)":
    case "traffic & warehous (operation)":
      return { read: true, write: true, admin: false, scoped: "dept" };
    case "finance":
      return { read: false, write: false, admin: false, scoped: "none" };
    default:
      return { read: false, write: false, admin: false, scoped: "none" };
  }
}

/**
 * Get DSO permissions for a role
 */
export function getDSOPermission(role: RoleName): ModulePermission {
  switch (role) {
    case "Director":
      return { read: true, write: false, admin: false, scoped: "all" };
    case "super admin":
      return { read: true, write: true, admin: true, scoped: "all" };
    case "finance":
      return { read: true, write: true, admin: false, scoped: "all" };
    case "sales manager":
      return { read: true, write: false, admin: false, scoped: "team" };
    case "salesperson":
      return { read: true, write: false, admin: false, scoped: "own" };
    default:
      return { read: false, write: false, admin: false, scoped: "none" };
  }
}

/**
 * Get KPI permissions for a role
 */
export function getKPIPermission(role: RoleName): ModulePermission {
  switch (role) {
    case "Director":
      return { read: true, write: false, admin: false, scoped: "all" };
    case "super admin":
      return { read: true, write: true, admin: true, scoped: "all" };
    case "Marketing Manager":
      return { read: true, write: true, admin: false, scoped: "team" };
    case "Marcomm (marketing staff)":
    case "DGO (Marketing staff)":
    case "MACX (marketing staff)":
    case "VSDO (marketing staff)":
      return { read: true, write: true, admin: false, scoped: "own" };
    case "sales manager":
      return { read: true, write: true, admin: false, scoped: "team" };
    case "salesperson":
      return { read: true, write: true, admin: false, scoped: "own" };
    case "finance":
      return { read: true, write: false, admin: false, scoped: "all" };
    default:
      return { read: false, write: false, admin: false, scoped: "none" };
  }
}

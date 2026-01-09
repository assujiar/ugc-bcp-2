/**
 * UGC Logistics Integrated Dashboard - Type Definitions
 * 
 * LOCKED: 15 Roles, 5 Menus, 8 Departments
 */

export * from "./database";

// ==========================================
// ROLES (15 EXACT - LOCKED)
// ==========================================
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

// ==========================================
// MENUS (5 TOP-LEVEL - LOCKED)
// ==========================================
export const MENUS = [
  "Dashboard",
  "KPI",
  "CRM",
  "Ticketing",
  "DSO",
] as const;

export type MenuName = (typeof MENUS)[number];

// ==========================================
// DEPARTMENTS (8 FIXED)
// ==========================================
export const DEPARTMENTS = {
  MKT: "marketing",
  SAL: "sales",
  DOM: "Domestics Ops",
  EXI: "EXIM Ops",
  DTD: "Import DTD Ops",
  FIN: "finance",
  TRF: "warehouse & traffic",
  DIR: "director",
} as const;

export type DeptCode = keyof typeof DEPARTMENTS;

// ==========================================
// USER PROFILE
// ==========================================
export interface UserProfile {
  user_id: string;
  user_code: string;
  full_name: string;
  role_name: RoleName;
  dept_code: DeptCode;
  manager_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// MENU ACCESS MAPPING (from validator.json)
// ==========================================
export const ROLE_MENU_ACCESS: Record<RoleName, MenuName[]> = {
  Director: ["Dashboard", "KPI", "CRM", "Ticketing", "DSO"],
  "super admin": ["Dashboard", "KPI", "CRM", "Ticketing", "DSO"],
  "Marketing Manager": ["Dashboard", "KPI", "CRM", "Ticketing"],
  "Marcomm (marketing staff)": ["Dashboard", "KPI", "CRM", "Ticketing"],
  "DGO (Marketing staff)": ["Dashboard", "KPI", "CRM", "Ticketing"],
  "MACX (marketing staff)": ["Dashboard", "KPI", "CRM", "Ticketing"],
  "VSDO (marketing staff)": ["Dashboard", "KPI", "CRM", "Ticketing"],
  "sales manager": ["Dashboard", "KPI", "CRM", "Ticketing", "DSO"],
  salesperson: ["Dashboard", "KPI", "CRM", "Ticketing", "DSO"],
  "sales support": ["CRM", "Ticketing"],
  "EXIM Ops (operation)": ["Dashboard", "Ticketing"],
  "domestics Ops (operation)": ["Dashboard", "Ticketing"],
  "Import DTD Ops (operation)": ["Dashboard", "Ticketing"],
  "traffic & warehous (operation)": ["Dashboard", "Ticketing"],
  finance: ["Dashboard", "KPI", "CRM", "DSO"],
};

// ==========================================
// API RESPONSE TYPES
// ==========================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// FILTER TYPES
// ==========================================
export interface DateRange {
  from: string;
  to: string;
}

export interface FilterState {
  search?: string;
  dateRange?: DateRange;
  status?: string;
  channel?: string;
  department?: DeptCode;
  page?: number;
  pageSize?: number;
}

"use client";

import * as React from "react";
import { useUser } from "@/lib/contexts/user-context";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Mail,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  user_id: string;
  user_code: string;
  full_name: string;
  role_name: string;
  dept_code: string;
  manager_user_id: string | null;
  created_at: string;
  email?: string;
}

const ROLES = [
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
];

const DEPARTMENTS = [
  { code: "MKT", name: "Marketing" },
  { code: "SAL", name: "Sales" },
  { code: "DOM", name: "Domestics Ops" },
  { code: "EXI", name: "EXIM Ops" },
  { code: "DTD", name: "Import DTD Ops" },
  { code: "FIN", name: "Finance" },
  { code: "TRF", name: "Warehouse & Traffic" },
  { code: "DIR", name: "Director" },
];

export default function UserManagementPage() {
  const { user } = useUser();
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<Profile[]>([]);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<Profile | null>(null);
  const [formData, setFormData] = React.useState({
    full_name: "",
    role_name: "",
    dept_code: "",
    email: "",
  });
  const [saving, setSaving] = React.useState(false);

  // Check if current user can manage users
  const canManage = user?.role_name === "super admin" || user?.role_name === "Marketing Manager";

  // Load users
  React.useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (roleFilter) params.append("role", roleFilter);
        if (deptFilter) params.append("dept", deptFilter);

        const response = await fetch(`/api/users/manage?${params.toString()}`);
        const data = await response.json();
        if (data.data) {
          setUsers(data.data);
        }
      } catch (err) {
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    if (canManage) {
      loadUsers();
    }
  }, [canManage, roleFilter, deptFilter]);

  // Filter users by search
  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(searchLower) ||
      u.user_code.toLowerCase().includes(searchLower) ||
      u.role_name.toLowerCase().includes(searchLower)
    );
  });

  const handleEdit = (profile: Profile) => {
    setEditingUser(profile);
    setFormData({
      full_name: profile.full_name,
      role_name: profile.role_name,
      dept_code: profile.dept_code,
      email: profile.email || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/manage/${editingUser.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === editingUser.user_id ? { ...u, ...formData } : u
        )
      );
      setSuccess("User updated successfully");
      setShowModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">
          Only Super Admin and Marketing Manager can manage users.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground">Manage system users and their roles</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-destructive" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-[14px] bg-success/10 border border-success/20 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
          <p className="text-sm text-success">{success}</p>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">All Roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept.code} value={dept.code}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-secondary/10">
              <Building2 className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {new Set(users.map((u) => u.dept_code)).size}
              </p>
              <p className="text-xs text-muted-foreground">Departments</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-success/10">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {new Set(users.map((u) => u.role_name)).size}
              </p>
              <p className="text-xs text-muted-foreground">Active Roles</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-warning/10">
              <Users className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.role_name.includes("manager")).length}
              </p>
              <p className="text-xs text-muted-foreground">Managers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Code
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Department
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((profile) => (
                  <tr
                    key={profile.user_id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {profile.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{profile.full_name}</p>
                          {profile.email && (
                            <p className="text-xs text-muted-foreground">{profile.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-mono text-muted-foreground">
                        {profile.user_code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">{profile.role_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge badge-outline">{profile.dept_code}</span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleEdit(profile)}
                        className="p-2 rounded-[8px] hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Edit User</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role
                </label>
                <select
                  value={formData.role_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, role_name: e.target.value }))
                  }
                  className="input w-full"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Department
                </label>
                <select
                  value={formData.dept_code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dept_code: e.target.value }))
                  }
                  className="input w-full"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.code} value={dept.code}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-outline">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

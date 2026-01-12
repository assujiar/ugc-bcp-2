"use client";

import * as React from "react";
import { useUser } from "@/lib/contexts/user-context";
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
  Building2,
  Mail,
  UserPlus,
  X,
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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterRole, setFilterRole] = React.useState("");
  const [filterDept, setFilterDept] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<Profile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    full_name: "",
    role_name: "",
    dept_code: "",
    email: "",
  });

  // Check access
  const canManage = user?.role_name === "super admin" || user?.role_name === "Marketing Manager";
  const isSuperAdmin = user?.role_name === "super admin";

  // Roles that Marketing Manager can manage
  const allowedRolesForMM = [
    "Marketing Manager",
    "Marcomm (marketing staff)",
    "DGO (Marketing staff)",
    "MACX (marketing staff)",
    "VSDO (marketing staff)",
  ];

  const manageableRoles = isSuperAdmin ? ROLES : allowedRolesForMM;

  // Load users
  React.useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      try {
        let url = "/api/users/manage";
        const params = new URLSearchParams();
        if (filterRole) params.append("role", filterRole);
        if (filterDept) params.append("dept", filterDept);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        const data = await response.json();
        if (data.data) {
          setUsers(data.data);
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        setError("Failed to load users");
      }
      setLoading(false);
    }
    if (canManage) {
      loadUsers();
    }
  }, [canManage, filterRole, filterDept]);

  // Filter users by search
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(query) ||
        u.user_code.toLowerCase().includes(query) ||
        u.role_name.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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
    if (!formData.full_name || !formData.role_name || !formData.dept_code) {
      setError("Please fill all required fields");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingUser
        ? `/api/users/manage/${editingUser.user_id}`
        : "/api/users/manage";
      const method = editingUser ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(editingUser ? "User updated successfully" : "User created successfully");
        setShowModal(false);
        setEditingUser(null);
        // Reload users
        const reloadResponse = await fetch("/api/users/manage");
        const reloadData = await reloadResponse.json();
        if (reloadData.data) setUsers(reloadData.data);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError("Failed to save user");
    }
    setSaving(false);
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground">Access Restricted</p>
        <p className="text-muted-foreground">
          Only Super Admin and Marketing Manager can access user management
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? "Manage all users and roles"
              : "Manage marketing team members"}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ full_name: "", role_name: "", dept_code: "MKT", email: "" });
            setShowModal(true);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-destructive" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-[14px] bg-success/10 border border-success/20 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <p className="text-sm text-success">{success}</p>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, code, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-10"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="input"
          >
            <option value="">All Roles</option>
            {manageableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="input"
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

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
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
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((profile) => (
                  <tr
                    key={profile.user_id}
                    className="border-b border-border/50 hover:bg-muted/50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                          {profile.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {profile.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground font-mono">
                        {profile.user_code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">{profile.role_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {DEPARTMENTS.find((d) => d.code === profile.dept_code)?.name ||
                          profile.dept_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleEdit(profile)}
                        className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                        disabled={!isSuperAdmin && !allowedRolesForMM.includes(profile.role_name)}
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

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {editingUser ? "Edit User" : "Add New User"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.role_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, role_name: e.target.value }))
                  }
                  className="input w-full"
                  required
                >
                  <option value="">Select role...</option>
                  {manageableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Department <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.dept_code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dept_code: e.target.value }))
                  }
                  className="input w-full"
                  required
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.code} value={dept.code}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                }}
                className="btn-outline"
              >
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

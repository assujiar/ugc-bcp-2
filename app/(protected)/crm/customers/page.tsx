"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { fetchCustomers, Customer, PaginatedResponse } from "@/lib/api";
import { DataTable, Column } from "@/components/table";
import { FilterField } from "@/components/filter";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";

// Filter fields
const filterFields: FilterField[] = [
  {
    key: "search",
    label: "Search",
    type: "search",
    placeholder: "Search customers...",
  },
];

// Table columns
const columns: Column<Customer>[] = [
  {
    key: "company_name",
    header: "Company",
    sortable: true,
    render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary font-medium">
          {row.company_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-foreground">{row.company_name}</p>
          <p className="text-xs text-muted-foreground">{row.customer_id}</p>
        </div>
      </div>
    ),
  },
  {
    key: "pic_name",
    header: "Contact Person",
    render: (_, row) => (
      <div>
        <p className="text-sm text-foreground">{row.pic_name}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          {row.pic_email}
        </div>
      </div>
    ),
  },
  {
    key: "pic_phone",
    header: "Phone",
    render: (value) => (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Phone className="h-3 w-3" />
        {value as string}
      </div>
    ),
  },
  {
    key: "city",
    header: "Location",
    render: (_, row) => (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {row.city || "-"}{row.country ? `, ${row.country}` : ""}
      </div>
    ),
  },
  {
    key: "npwp",
    header: "NPWP",
    render: (value) => (
      <span className="text-sm text-muted-foreground">{(value as string) || "-"}</span>
    ),
  },
  {
    key: "created_at",
    header: "Created",
    sortable: true,
    render: (value) => (
      <span className="text-sm text-muted-foreground">
        {new Date(value as string).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (_, row) => (
      <div className="flex items-center justify-end gap-1">
        <button className="p-2 hover:bg-muted rounded-[8px] transition-colors">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </button>
        <button className="p-2 hover:bg-muted rounded-[8px] transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    ),
  },
];

export default function CustomersPage() {
  const { isDirector } = useUser();
  const searchParams = useSearchParams();

  const [data, setData] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  React.useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      setError(null);

      const params = {
        page: parseInt(searchParams.get("page") || "1", 10),
        pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
        search: searchParams.get("search") || undefined,
        sortBy: searchParams.get("sortBy") || "created_at",
        sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
      };

      const result = await fetchCustomers(params);

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const response = result.data as PaginatedResponse<Customer>;
        setData(response.data || []);
        setPagination(response.pagination);
      }

      setLoading(false);
    }

    loadCustomers();
  }, [searchParams]);

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        {!isDirector && (
          <Link href="/crm/customers/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-muted-foreground mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-foreground">{pagination.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground mb-1">This Month</p>
          <p className="text-2xl font-bold text-foreground">
            {data.filter(c => {
              const created = new Date(c.created_at);
              const now = new Date();
              return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading customers...</span>
        </div>
      ) : (
        <DataTable
          data={data}
          columns={columns}
          total={pagination.total}
          pageSize={pagination.pageSize}
          page={pagination.page}/>
      )}
    </>
  );
}



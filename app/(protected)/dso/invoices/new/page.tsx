"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { createInvoice, fetchCustomers, Customer, PaginatedResponse } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  DollarSign,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function NewInvoicePage() {
  const router = useRouter();
  const { user, isFinance } = useUser();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Customer search
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [loadingCustomers, setLoadingCustomers] = React.useState(false);

  const [formData, setFormData] = React.useState({
    customer_id: "",
    customer_name: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    invoice_amount: "",
    currency: "IDR",
    notes: "",
  });

  // Check authorization
  const canCreate = isFinance || user?.role_name === "super admin";

  // Search customers
  React.useEffect(() => {
    async function searchCustomers() {
      if (customerSearch.length < 2) {
        setCustomers([]);
        return;
      }

      setLoadingCustomers(true);
      const result = await fetchCustomers({ search: customerSearch, pageSize: 10 });
      if (result.data) {
        const response = result.data as PaginatedResponse<Customer>;
        setCustomers(response.data || []);
      }
      setLoadingCustomers(false);
    }

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch]);

  const handleSelectCustomer = (customer: Customer) => {
    setFormData((prev) => ({
      ...prev,
      customer_id: customer.customer_id,
      customer_name: customer.company_name,
    }));
    setCustomers([]);
    setCustomerSearch("");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.customer_id) {
      setError("Please select a customer");
      setLoading(false);
      return;
    }

    if (!formData.invoice_amount || parseFloat(formData.invoice_amount) <= 0) {
      setError("Please enter a valid invoice amount");
      setLoading(false);
      return;
    }

    const result = await createInvoice({
      customer_id: formData.customer_id,
      invoice_date: formData.invoice_date,
      due_date: formData.due_date,
      invoice_amount: parseFloat(formData.invoice_amount),
      currency: formData.currency,
      notes: formData.notes || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/dso/invoices");
      }, 1500);
    }
  };

  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only finance users can create invoices</p>
        <Link href="/dso/invoices" className="btn-primary mt-4">
          Back to Invoices
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-success mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Invoice Created Successfully!</h2>
        <p className="text-muted-foreground">Redirecting to invoices list...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/dso/invoices"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Create New Invoice</h1>
        <p className="text-muted-foreground">Record a new customer invoice</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Customer Selection */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Customer
          </h3>

          {formData.customer_id ? (
            <div className="flex items-center justify-between p-4 rounded-[12px] bg-muted">
              <div>
                <p className="font-medium text-foreground">{formData.customer_name}</p>
                <p className="text-sm text-muted-foreground">{formData.customer_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, customer_id: "", customer_name: "" }))}
                className="text-sm text-primary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="input w-full pl-10"
                  placeholder="Search customer by name..."
                />
                {loadingCustomers && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {customers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-[12px] shadow-lg max-h-60 overflow-auto">
                  {customers.map((customer) => (
                    <button
                      key={customer.customer_id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full px-4 py-3 text-left hover:bg-muted transition-colors first:rounded-t-[12px] last:rounded-b-[12px]"
                    >
                      <p className="font-medium text-foreground">{customer.company_name}</p>
                      <p className="text-sm text-muted-foreground">{customer.pic_email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Invoice Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Invoice Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                name="invoice_date"
                value={formData.invoice_date}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Due Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Amount
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Invoice Amount <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                name="invoice_amount"
                value={formData.invoice_amount}
                onChange={handleChange}
                className="input w-full"
                placeholder="10000000"
                min="0"
                step="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="input w-full"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dso/invoices" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Invoice"
            )}
          </button>
        </div>
      </form>
    </>
  );
}

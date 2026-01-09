"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { recordPayment, fetchInvoices, Invoice, PaginatedResponse } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Calendar,
  CreditCard,
  Search,
  FileText,
} from "lucide-react";
import Link from "next/link";

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isFinance } = useUser();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Invoice search
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [invoiceSearch, setInvoiceSearch] = React.useState("");
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);

  const [formData, setFormData] = React.useState({
    invoice_id: searchParams.get("invoice_id") || "",
    invoice_display: "",
    invoice_amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "Transfer",
    reference_no: "",
    notes: "",
  });

  const canCreate = isFinance || user?.role_name === "super admin";

  // Search invoices
  React.useEffect(() => {
    async function searchInvoices() {
      if (invoiceSearch.length < 2) {
        setInvoices([]);
        return;
      }

      setLoadingInvoices(true);
      const result = await fetchInvoices({ search: invoiceSearch, status: "outstanding", pageSize: 10 });
      if (result.data) {
        const response = result.data as PaginatedResponse<Invoice>;
        setInvoices(response.data || []);
      }
      setLoadingInvoices(false);
    }

    const debounce = setTimeout(searchInvoices, 300);
    return () => clearTimeout(debounce);
  }, [invoiceSearch]);

  const handleSelectInvoice = (invoice: Invoice) => {
    setFormData((prev) => ({
      ...prev,
      invoice_id: invoice.invoice_id,
      invoice_display: `${invoice.invoice_id} - ${invoice.customer?.company_name || "Unknown"}`,
      invoice_amount: invoice.outstanding_amount || invoice.invoice_amount,
    }));
    setInvoices([]);
    setInvoiceSearch("");
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

    if (!formData.invoice_id) {
      setError("Please select an invoice");
      setLoading(false);
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid payment amount");
      setLoading(false);
      return;
    }

    const result = await recordPayment(formData.invoice_id, {
      payment_date: formData.payment_date,
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method || undefined,
      reference_no: formData.reference_no || undefined,
      notes: formData.notes || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/dso/payments");
      }, 1500);
    }
  };

  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only finance users can record payments</p>
        <Link href="/dso/payments" className="btn-primary mt-4">
          Back to Payments
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-success mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Payment Recorded Successfully!</h2>
        <p className="text-muted-foreground">Redirecting to payments list...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/dso/payments"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Record Payment</h1>
        <p className="text-muted-foreground">Record a customer payment against an invoice</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Invoice Selection */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Select Invoice
          </h3>

          {formData.invoice_id ? (
            <div className="flex items-center justify-between p-4 rounded-[12px] bg-muted">
              <div>
                <p className="font-medium text-foreground">{formData.invoice_display}</p>
                <p className="text-sm text-muted-foreground">
                  Outstanding: Rp {formData.invoice_amount.toLocaleString("id-ID")}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    invoice_id: "",
                    invoice_display: "",
                    invoice_amount: 0,
                  }))
                }
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
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="input w-full pl-10"
                  placeholder="Search invoice by ID or customer..."
                />
                {loadingInvoices && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {invoices.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-[12px] shadow-lg max-h-60 overflow-auto">
                  {invoices.map((invoice) => (
                    <button
                      key={invoice.invoice_id}
                      type="button"
                      onClick={() => handleSelectInvoice(invoice)}
                      className="w-full px-4 py-3 text-left hover:bg-muted transition-colors first:rounded-t-[12px] last:rounded-b-[12px]"
                    >
                      <p className="font-medium text-foreground">{invoice.invoice_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customer?.company_name || "Unknown"} - Outstanding: Rp{" "}
                        {(invoice.outstanding_amount || invoice.invoice_amount).toLocaleString("id-ID")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Details */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Payment Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Payment Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Payment Method
              </label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Giro">Giro</option>
                <option value="Virtual Account">Virtual Account</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Amount <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="input w-full"
                placeholder="10000000"
                min="0"
                step="1"
                required
              />
              {formData.invoice_amount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      amount: prev.invoice_amount.toString(),
                    }))
                  }
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Pay full amount (Rp {formData.invoice_amount.toLocaleString("id-ID")})
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Reference No.
              </label>
              <input
                type="text"
                name="reference_no"
                value={formData.reference_no}
                onChange={handleChange}
                className="input w-full"
                placeholder="TRF-123456"
              />
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
          <Link href="/dso/payments" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Recording...
              </>
            ) : (
              "Record Payment"
            )}
          </button>
        </div>
      </form>
    </>
  );
}

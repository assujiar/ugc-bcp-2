"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import { fetchPayments, recordPayment } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  Building2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Invoice {
  invoice_id: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  customer?: {
    company_name: string;
  };
}

interface Payment {
  payment_id: number;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.invoice_id as string;
  const { user, isFinance, isDirector } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [payments, setPayments] = React.useState<Payment[]>([]);

  // Payment form state
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [paymentData, setPaymentData] = React.useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "Transfer",
    reference_no: "",
    notes: "",
  });

  // Load invoice and payments
  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch invoice
        const invoiceResponse = await fetch(`/api/invoices/${invoiceId}`);
        const invoiceData = await invoiceResponse.json();
        
        if (invoiceData.error) {
          setError(invoiceData.error);
        } else if (invoiceData.data) {
          setInvoice(invoiceData.data);
        }

        // Fetch payments
        const paymentsResult = await fetchPayments(invoiceId);
        if (paymentsResult.data) {
          setPayments((paymentsResult.data as { data: Payment[] }).data || []);
        }
      } catch (err) {
        setError("Failed to load invoice");
      }
      setLoading(false);
    }
    loadData();
  }, [invoiceId]);

  // Calculate totals
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = invoice ? invoice.invoice_amount - totalPaid : 0;
  const isOverdue = invoice ? new Date(invoice.due_date) < new Date() && outstanding > 0 : false;
  const isPaidInFull = outstanding <= 0;

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await recordPayment(invoiceId, {
      payment_date: paymentData.payment_date,
      amount: parseFloat(paymentData.amount),
      payment_method: paymentData.payment_method,
      reference_no: paymentData.reference_no || undefined,
      notes: paymentData.notes || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Payment recorded successfully");
      setShowPaymentModal(false);
      setPaymentData({
        payment_date: new Date().toISOString().split("T")[0],
        amount: "",
        payment_method: "Transfer",
        reference_no: "",
        notes: "",
      });
      // Reload payments
      const paymentsResult = await fetchPayments(invoiceId);
      if (paymentsResult.data) {
        setPayments((paymentsResult.data as { data: Payment[] }).data || []);
      }
      setTimeout(() => setSuccess(null), 3000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading invoice...</span>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground">Invoice Not Found</p>
        <Link href="/dso/invoices" className="btn-primary mt-4">
          Back to Invoices
        </Link>
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{invoice.invoice_id}</h1>
              {isPaidInFull ? (
                <span className="badge badge-success">Paid</span>
              ) : isOverdue ? (
                <span className="badge badge-destructive">Overdue</span>
              ) : (
                <span className="badge badge-warning">Outstanding</span>
              )}
            </div>
            <p className="text-muted-foreground">
              {invoice.customer?.company_name || invoice.customer_id}
            </p>
          </div>
          {isFinance && !isPaidInFull && (
            <button
              onClick={() => {
                setPaymentData((prev) => ({ ...prev, amount: outstanding.toString() }));
                setShowPaymentModal(true);
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-[14px] bg-success/10 border border-success/20 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <p className="text-sm text-success">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Summary */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Invoice Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Date</p>
                <p className="font-medium text-foreground">
                  {new Date(invoice.invoice_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className={cn(
                  "font-medium",
                  isOverdue ? "text-destructive" : "text-foreground"
                )}>
                  {new Date(invoice.due_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(invoice.invoice_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Currency</p>
                <p className="font-medium text-foreground">{invoice.currency}</p>
              </div>
            </div>
            {invoice.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-foreground">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card bg-primary/5 border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Invoice Amount</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(invoice.invoice_amount)}
              </p>
            </div>
            <div className="card bg-success/5 border-success/20">
              <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
              <p className="text-xl font-bold text-success">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div className={cn(
              "card",
              isPaidInFull ? "bg-success/5 border-success/20" :
              isOverdue ? "bg-destructive/5 border-destructive/20" :
              "bg-warning/5 border-warning/20"
            )}>
              <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
              <p className={cn(
                "text-xl font-bold",
                isPaidInFull ? "text-success" :
                isOverdue ? "text-destructive" :
                "text-warning"
              )}>
                {formatCurrency(Math.max(0, outstanding))}
              </p>
            </div>
          </div>

          {/* Payment History */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Payment History
            </h3>
            
            {payments.length > 0 ? (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.payment_id}
                    className="flex items-center justify-between p-4 rounded-[12px] bg-muted"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_method || "N/A"} • {payment.reference_no || "No ref"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-foreground">
                        {new Date(payment.payment_date).toLocaleDateString("id-ID")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.created_at).toLocaleTimeString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No payments recorded yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Customer
            </h3>
            <p className="font-medium text-foreground">
              {invoice.customer?.company_name || "N/A"}
            </p>
            <p className="text-sm text-muted-foreground">{invoice.customer_id}</p>
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">Created</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              {payments.map((payment, idx) => (
                <div key={payment.payment_id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-success mt-2" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Payment #{idx + 1}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(payment.amount)} - {new Date(payment.payment_date).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
              ))}
              {isPaidInFull && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-success mt-2" />
                  <div>
                    <p className="text-sm font-medium text-success">Paid in Full</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Record Payment
            </h3>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, payment_date: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="input w-full"
                  placeholder="Enter amount"
                  required
                />
                {outstanding > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentData((prev) => ({ ...prev, amount: outstanding.toString() }))}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Pay full amount ({formatCurrency(outstanding)})
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, payment_method: e.target.value }))}
                  className="input w-full"
                >
                  <option value="Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Giro">Giro</option>
                  <option value="VA">Virtual Account</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Reference No
                </label>
                <input
                  type="text"
                  value={paymentData.reference_no}
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, reference_no: e.target.value }))}
                  className="input w-full"
                  placeholder="Transfer ref / check no"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="input w-full"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Record Payment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

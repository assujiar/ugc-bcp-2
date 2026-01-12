"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { createCustomer } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import Link from "next/link";

export default function NewCustomerPage() {
  const router = useRouter();
  const { user, isDirector } = useUser();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [formData, setFormData] = React.useState({
    company_name: "",
    npwp: "",
    pic_name: "",
    pic_phone: "",
    pic_email: "",
    address: "",
    city: "",
    country: "Indonesia",
  });

  // Director can't create customers
  const canCreate = !isDirector;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.company_name || !formData.pic_name || !formData.pic_phone || !formData.pic_email) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    const result = await createCustomer({
      company_name: formData.company_name,
      npwp: formData.npwp || undefined,
      pic_name: formData.pic_name,
      pic_phone: formData.pic_phone,
      pic_email: formData.pic_email,
      address: formData.address || undefined,
      city: formData.city || undefined,
      country: formData.country || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/crm/customers");
      }, 1500);
    }
  };

  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Read-Only Access</p>
        <p className="text-sm text-muted-foreground">Director role cannot create customers</p>
        <Link href="/crm/customers" className="btn-primary mt-4">
          Back to Customers
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-success mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Customer Created Successfully!</h2>
        <p className="text-muted-foreground">Redirecting to customers list...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/crm/customers"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Add New Customer</h1>
        <p className="text-muted-foreground">Create a new customer record</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Company Information */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Company Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Company Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className="input w-full"
                placeholder="PT Example Company"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">NPWP</label>
              <input
                type="text"
                name="npwp"
                value={formData.npwp}
                onChange={handleChange}
                className="input w-full"
                placeholder="00.000.000.0-000.000"
              />
            </div>
          </div>
        </div>

        {/* Contact Person */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Contact Person
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                PIC Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="pic_name"
                value={formData.pic_name}
                onChange={handleChange}
                className="input w-full"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Phone <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                name="pic_phone"
                value={formData.pic_phone}
                onChange={handleChange}
                className="input w-full"
                placeholder="08123456789"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                name="pic_email"
                value={formData.pic_email}
                onChange={handleChange}
                className="input w-full"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input w-full"
                rows={3}
                placeholder="Jl. Example No. 123, Kelurahan..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="input w-full"
                placeholder="Jakarta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="input w-full"
                placeholder="Indonesia"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/crm/customers" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Customer"
            )}
          </button>
        </div>
      </form>
    </>
  );
}

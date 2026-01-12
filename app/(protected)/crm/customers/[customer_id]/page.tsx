"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
} from "lucide-react";

interface Customer {
  customer_id: string;
  company_name: string;
  npwp: string | null;
  pic_name: string;
  pic_phone: string;
  pic_email: string;
  address: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export default function CustomerEditPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.customer_id as string;
  const { user, isDirector } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [customer, setCustomer] = React.useState<Customer | null>(null);

  // Form state
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

  // Load customer data
  React.useEffect(() => {
    async function loadCustomer() {
      setLoading(true);
      try {
        const response = await fetch(`/api/customers/${customerId}`);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else if (data.data) {
          setCustomer(data.data);
          setFormData({
            company_name: data.data.company_name || "",
            npwp: data.data.npwp || "",
            pic_name: data.data.pic_name || "",
            pic_phone: data.data.pic_phone || "",
            pic_email: data.data.pic_email || "",
            address: data.data.address || "",
            city: data.data.city || "",
            country: data.data.country || "Indonesia",
          });
        }
      } catch (err) {
        setError("Failed to load customer");
      }
      setLoading(false);
    }
    loadCustomer();
  }, [customerId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.company_name || !formData.pic_name || !formData.pic_phone || !formData.pic_email) {
      setError("Please fill all required fields");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/crm/customers");
        }, 1500);
      }
    } catch (err) {
      setError("Failed to update customer");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading customer...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground">Customer Not Found</p>
        <Link href="/crm/customers" className="btn-primary mt-4">
          Back to Customers
        </Link>
      </div>
    );
  }

  if (isDirector) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground">Read Only Access</p>
        <p className="text-muted-foreground mb-4">Directors cannot edit customer data</p>
        <Link href="/crm/customers" className="btn-primary">
          Back to Customers
        </Link>
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
        <h1 className="text-2xl font-bold text-foreground">Edit Customer</h1>
        <p className="text-muted-foreground">{customer.customer_id}</p>
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
          <p className="text-sm text-success">Customer updated successfully! Redirecting...</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="card mb-6">
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
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                NPWP
              </label>
              <input
                type="text"
                name="npwp"
                value={formData.npwp}
                onChange={handleChange}
                className="input w-full"
                placeholder="XX.XXX.XXX.X-XXX.XXX"
              />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Contact Person
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                PIC Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="pic_name"
                value={formData.pic_name}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <Phone className="h-3 w-3 inline mr-1" />
                Phone <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                name="pic_phone"
                value={formData.pic_phone}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <Mail className="h-3 w-3 inline mr-1" />
                Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                name="pic_email"
                value={formData.pic_email}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Full Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input w-full"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link href="/crm/customers" className="btn-outline">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </>
  );
}

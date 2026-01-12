"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { fetchTickets, updateTicket, fetchTicketMessages, addTicketMessage, Ticket } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
  Clock,
  User,
  MapPin,
  Package,
  FileText,
  CheckCircle,
  AlertCircle,
  XCircle,
  Building2,
  Truck,
  MessageSquare,
  RefreshCw,
  Lock,
  Info,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketMessage {
  message_id: number;
  ticket_id: string;
  message: string;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN: "badge-warning",
    "WAITING RESPON": "badge-info",
    "WAITING CUSTOMER": "badge-info",
    "IN PROGRESS": "badge-info",
    CLOSED: "badge-success",
    "CLOSED LOST": "badge-destructive",
  };
  return styles[status] || "badge";
}

// Status options based on ticket type
const INQUIRY_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "WAITING RESPON", label: "Waiting Response" },
  { value: "WAITING CUSTOMER", label: "Waiting Customer" },
  { value: "CLOSED", label: "Closed (Won)" },
  { value: "CLOSED LOST", label: "Closed Lost" },
];

const GENERAL_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "IN PROGRESS", label: "In Progress" },
  { value: "CLOSED", label: "Closed" },
];

// ============================================================
// FIX-11: Status Transition Maps (Valid Transitions Only)
// ============================================================
const INQUIRY_TRANSITIONS: Record<string, string[]> = {
  "OPEN": ["WAITING RESPON", "WAITING CUSTOMER", "CLOSED", "CLOSED LOST"],
  "WAITING RESPON": ["WAITING CUSTOMER", "CLOSED", "CLOSED LOST"],
  "WAITING CUSTOMER": ["WAITING RESPON", "CLOSED", "CLOSED LOST"],
  "CLOSED": [],      // Terminal state
  "CLOSED LOST": [], // Terminal state
};

const GENERAL_TRANSITIONS: Record<string, string[]> = {
  "OPEN": ["IN PROGRESS", "CLOSED"],
  "IN PROGRESS": ["CLOSED"],
  "CLOSED": [], // Terminal state
};

// Get ordered list of all statuses for flow visualization
const INQUIRY_STATUS_ORDER = ["OPEN", "WAITING RESPON", "WAITING CUSTOMER", "CLOSED", "CLOSED LOST"];
const GENERAL_STATUS_ORDER = ["OPEN", "IN PROGRESS", "CLOSED"];

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.ticket_id as string;
  const { user, isDirector, isOps } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [messages, setMessages] = React.useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState("");
  const [sendingMessage, setSendingMessage] = React.useState(false);

  // Status update state
  const [showStatusModal, setShowStatusModal] = React.useState(false);
  const [newStatus, setNewStatus] = React.useState("");
  const [closeReason, setCloseReason] = React.useState("");
  const [competitorRate, setCompetitorRate] = React.useState("");
  const [customerBudget, setCustomerBudget] = React.useState("");

  // Load ticket data
  React.useEffect(() => {
    async function loadTicket() {
      setLoading(true);
      const result = await fetchTickets({ search: ticketId, pageSize: 1 });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const tickets = (result.data as { data: Ticket[] }).data || [];
        const foundTicket = tickets.find((t) => t.ticket_id === ticketId);
        if (foundTicket) {
          setTicket(foundTicket);
        } else {
          setError("Ticket not found");
        }
      }

      // Load messages
      const messagesResult = await fetchTicketMessages(ticketId);
      if (messagesResult.data) {
        setMessages((messagesResult.data as { data: TicketMessage[] }).data || []);
      }

      setLoading(false);
    }
    loadTicket();
  }, [ticketId]);

  // ============================================================
  // FIX-11: Derived state for status transitions
  // ============================================================
  const currentStatus = ticket?.inquiry_status || ticket?.ticket_status || "";
  const isInquiry = ticket?.ticket_type === "inquiry tariff";
  
  // Get transition map and status order based on ticket type
  const transitions = isInquiry ? INQUIRY_TRANSITIONS : GENERAL_TRANSITIONS;
  const statusOrder = isInquiry ? INQUIRY_STATUS_ORDER : GENERAL_STATUS_ORDER;
  const allStatuses = isInquiry ? INQUIRY_STATUSES : GENERAL_STATUSES;
  
  // Get valid next statuses from current status
  const validNextStatuses = transitions[currentStatus] || [];
  const isTerminalState = validNextStatuses.length === 0;
  
  // Filter status options to only show valid transitions
  const filteredStatusOptions = allStatuses.filter(s => 
    validNextStatuses.includes(s.value)
  );

  const canUpdateStatus = !isDirector && !isTerminalState && (
    user?.role_name === "super admin" ||
    ticket?.created_by === user?.user_id ||
    ticket?.assigned_to === user?.user_id ||
    (isOps && user?.dept_code === ticket?.dept_target)
  );

  // ============================================================
  // FIX-11: Open modal with first valid option as default
  // ============================================================
  const openStatusModal = () => {
    if (filteredStatusOptions.length > 0) {
      setNewStatus(filteredStatusOptions[0].value);
    }
    setCloseReason("");
    setCompetitorRate("");
    setCustomerBudget("");
    setShowStatusModal(true);
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    // ============================================================
    // FIX-11: Double-check transition validity
    // ============================================================
    if (!validNextStatuses.includes(newStatus)) {
      setError(`Invalid transition from ${currentStatus} to ${newStatus}`);
      return;
    }

    // Validate close reason for CLOSED LOST
    if (newStatus === "CLOSED LOST" && !closeReason) {
      setError("Please provide a reason for closing the deal");
      return;
    }

    setSaving(true);
    setError(null);

    const updateData: Partial<Ticket> & { close_reason?: string; competitor_rate?: number; customer_budget?: number } = {};
    
    if (isInquiry) {
      updateData.inquiry_status = newStatus as Ticket["inquiry_status"];
    } else {
      updateData.ticket_status = newStatus as Ticket["ticket_status"];
    }

    if (newStatus === "CLOSED LOST") {
      updateData.close_reason = closeReason;
      if (competitorRate) updateData.competitor_rate = parseFloat(competitorRate);
      if (customerBudget) updateData.customer_budget = parseFloat(customerBudget);
    }

    const result = await updateTicket(ticketId, updateData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Status updated successfully");
      setShowStatusModal(false);
      // Reload ticket
      const reloadResult = await fetchTickets({ search: ticketId, pageSize: 1 });
      if (reloadResult.data) {
        const tickets = (reloadResult.data as { data: Ticket[] }).data || [];
        const foundTicket = tickets.find((t) => t.ticket_id === ticketId);
        if (foundTicket) setTicket(foundTicket);
      }
      setTimeout(() => setSuccess(null), 3000);
    }
    setSaving(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    const result = await addTicketMessage(ticketId, newMessage);

    if (result.error) {
      setError(result.error);
    } else {
      setNewMessage("");
      // Reload messages
      const messagesResult = await fetchTicketMessages(ticketId);
      if (messagesResult.data) {
        setMessages((messagesResult.data as { data: TicketMessage[] }).data || []);
      }
    }
    setSendingMessage(false);
  };

  // ============================================================
  // FIX-11: Helper to determine status state in flow
  // ============================================================
  const getStatusState = (status: string): "current" | "past" | "valid-next" | "future" => {
    if (status === currentStatus) return "current";
    
    const currentIndex = statusOrder.indexOf(currentStatus);
    const statusIndex = statusOrder.indexOf(status);
    
    // For inquiry tickets, past is more complex due to branching
    // Simplify: if index < current and not a valid next, it's past
    if (statusIndex < currentIndex && !validNextStatuses.includes(status)) {
      return "past";
    }
    
    if (validNextStatuses.includes(status)) {
      return "valid-next";
    }
    
    return "future";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading ticket...</span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground">Ticket Not Found</p>
        <Link href="/ticketing" className="btn-primary mt-4">
          Back to Tickets
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/ticketing"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{ticket.ticket_id}</h1>
              <span className={cn("badge", getStatusBadge(currentStatus))}>
                {currentStatus}
              </span>
              {/* FIX-11: Terminal state indicator */}
              {isTerminalState && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Final
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{ticket.subject}</p>
          </div>
          {canUpdateStatus && (
            <button
              onClick={openStatusModal}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Update Status
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
          {/* Description */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Description
            </h3>
            <p className="text-foreground whitespace-pre-wrap">
              {ticket.description || "No description provided"}
            </p>
          </div>

          {/* RFQ Details (for inquiry tariff) */}
          {ticket.ticket_type === "inquiry tariff" && (
            <div className="card">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-muted-foreground" />
                Shipment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Origin */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Origin
                  </p>
                  <div className="p-3 rounded-[10px] bg-muted">
                    <p className="text-foreground">{ticket.origin_address || "-"}</p>
                    <p className="text-sm text-muted-foreground">
                      {[ticket.origin_city, ticket.origin_country].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
                {/* Destination */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Destination
                  </p>
                  <div className="p-3 rounded-[10px] bg-muted">
                    <p className="text-foreground">{ticket.destination_address || "-"}</p>
                    <p className="text-sm text-muted-foreground">
                      {[ticket.destination_city, ticket.destination_country].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
                {/* Cargo */}
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="h-4 w-4" /> Cargo Details
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-[10px] bg-muted">
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-medium text-foreground">{ticket.cargo_category || "-"}</p>
                    </div>
                    <div className="p-3 rounded-[10px] bg-muted">
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="font-medium text-foreground">{ticket.cargo_qty || "-"}</p>
                    </div>
                    <div className="p-3 rounded-[10px] bg-muted">
                      <p className="text-xs text-muted-foreground">Dimensions</p>
                      <p className="font-medium text-foreground">{ticket.cargo_dimensions || "-"}</p>
                    </div>
                    <div className="p-3 rounded-[10px] bg-muted">
                      <p className="text-xs text-muted-foreground">Weight</p>
                      <p className="font-medium text-foreground">
                        {ticket.cargo_weight ? `${ticket.cargo_weight} kg` : "-"}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Scope */}
                {ticket.scope_of_work && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Scope of Work</p>
                    <p className="text-foreground">{ticket.scope_of_work}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages Thread */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              Messages
            </h3>
            
            {/* Messages List */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
              {messages.length > 0 ? (
                messages.map((msg) => {
                  const isOwn = msg.created_by === user?.user_id;
                  return (
                    <div
                      key={msg.message_id}
                      className={cn(
                        "flex gap-3",
                        isOwn ? "flex-row-reverse" : ""
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
                          isOwn ? "bg-primary" : "bg-secondary"
                        )}
                      >
                        {(msg.creator?.full_name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={cn(
                          "max-w-[70%] p-3 rounded-[12px]",
                          isOwn ? "bg-primary/10" : "bg-muted"
                        )}
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {msg.creator?.full_name || "Unknown"}
                        </p>
                        <p className="text-foreground text-sm">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages yet
                </p>
              )}
            </div>

            {/* Message Input */}
            {!isDirector && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="input flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="btn-primary"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* ============================================================ */}
          {/* FIX-11: Status Flow Visualization */}
          {/* ============================================================ */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Status Flow
            </h3>
            <div className="space-y-2">
              {statusOrder.map((status, index) => {
                const state = getStatusState(status);
                const statusLabel = allStatuses.find(s => s.value === status)?.label || status;
                const isCurrent = state === "current";
                const isPast = state === "past";
                const isValidNext = state === "valid-next";
                
                return (
                  <div
                    key={status}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-[10px] transition-colors",
                      isCurrent && "bg-primary/10 border border-primary/30",
                      isPast && "opacity-50",
                      isValidNext && "bg-muted/50 border border-dashed border-muted-foreground/30",
                      !isCurrent && !isPast && !isValidNext && "opacity-30"
                    )}
                  >
                    {/* Status indicator */}
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                        isCurrent && "bg-primary text-white",
                        isPast && "bg-muted-foreground/30 text-muted-foreground",
                        isValidNext && "border-2 border-primary/50 text-primary",
                        !isCurrent && !isPast && !isValidNext && "border border-muted-foreground/20"
                      )}
                    >
                      {isCurrent && <div className="w-2 h-2 bg-white rounded-full" />}
                      {isPast && <Check className="h-3 w-3" />}
                      {isValidNext && <ArrowRight className="h-3 w-3" />}
                    </div>
                    
                    {/* Status label */}
                    <span
                      className={cn(
                        "text-sm flex-1",
                        isCurrent && "font-medium text-primary",
                        isPast && "text-muted-foreground line-through",
                        isValidNext && "text-foreground",
                        !isCurrent && !isPast && !isValidNext && "text-muted-foreground"
                      )}
                    >
                      {statusLabel}
                    </span>
                    
                    {/* Current indicator */}
                    {isCurrent && (
                      <span className="text-xs text-primary font-medium">Current</span>
                    )}
                    {isValidNext && (
                      <span className="text-xs text-muted-foreground">Available</span>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Terminal state message */}
            {isTerminalState && (
              <div className="mt-4 p-3 rounded-[10px] bg-muted flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  This ticket is in a final state and cannot be updated.
                </span>
              </div>
            )}
          </div>

          {/* Ticket Info */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4">Ticket Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium text-foreground capitalize">{ticket.ticket_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium text-foreground">{ticket.dept_target}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Service</p>
                <p className="font-medium text-foreground">{ticket.service_code || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium text-foreground">
                  {new Date(ticket.created_at).toLocaleString("id-ID")}
                </p>
              </div>
              {ticket.closed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Closed</p>
                  <p className="font-medium text-foreground">
                    {new Date(ticket.closed_at).toLocaleString("id-ID")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* People */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              People
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="font-medium text-foreground">
                  {ticket.created_by_profile?.full_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p className="font-medium text-foreground">
                  {ticket.assigned_to_profile?.full_name || "Unassigned"}
                </p>
              </div>
            </div>
          </div>

          {/* Customer (masked for Ops on RFQ from leads) */}
          {ticket.related_customer_id && (
            <div className="card">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Customer
              </h3>
              {ticket.need_customer_masking && isOps ? (
                <p className="text-muted-foreground italic">MASKED</p>
              ) : (
                <p className="font-medium text-foreground">
                  {ticket.customer?.company_name || ticket.related_customer_id}
                </p>
              )}
            </div>
          )}

          {/* Close Info (if closed lost) */}
          {currentStatus === "CLOSED LOST" && ticket.close_reason && (
            <div className="card border-l-4 border-l-destructive">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Close Reason
              </h3>
              <p className="text-foreground text-sm mb-2">{ticket.close_reason}</p>
              {(ticket.competitor_rate || ticket.customer_budget) && (
                <div className="flex gap-4 text-sm">
                  {ticket.competitor_rate && (
                    <div>
                      <span className="text-muted-foreground">Competitor: </span>
                      <span className="font-medium">Rp {ticket.competitor_rate.toLocaleString("id-ID")}</span>
                    </div>
                  )}
                  {ticket.customer_budget && (
                    <div>
                      <span className="text-muted-foreground">Budget: </span>
                      <span className="font-medium">Rp {ticket.customer_budget.toLocaleString("id-ID")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* FIX-11: Enhanced Status Update Modal with Transition Preview */}
      {/* ============================================================ */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Update Ticket Status
            </h3>

            {/* Transition Preview */}
            <div className="mb-4 p-3 rounded-[10px] bg-muted flex items-center justify-center gap-3">
              <span className={cn("badge", getStatusBadge(currentStatus))}>
                {currentStatus}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className={cn("badge", newStatus ? getStatusBadge(newStatus) : "badge")}>
                {newStatus || "Select..."}
              </span>
            </div>

            <div className="space-y-4">
              {/* Status Select - Filtered to valid transitions only */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input w-full"
                >
                  {filteredStatusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {/* Info about filtered options */}
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Only valid transitions from "{currentStatus}" are shown.
                </p>
              </div>

              {/* Close Reason (for CLOSED LOST) */}
              {newStatus === "CLOSED LOST" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Reason <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Select reason...</option>
                      <option value="Price too high">Price too high / not competitive</option>
                      <option value="Customer budget constraint">Customer budget constraint</option>
                      <option value="Competitor won">Competitor won</option>
                      <option value="No response from customer">No response from customer</option>
                      <option value="Project cancelled">Project cancelled</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Competitor Rate (optional)
                    </label>
                    <input
                      type="number"
                      value={competitorRate}
                      onChange={(e) => setCompetitorRate(e.target.value)}
                      className="input w-full"
                      placeholder="e.g., 15000000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Customer Budget (optional)
                    </label>
                    <input
                      type="number"
                      value={customerBudget}
                      onChange={(e) => setCustomerBudget(e.target.value)}
                      className="input w-full"
                      placeholder="e.g., 12000000"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={saving || !newStatus || (newStatus === "CLOSED LOST" && !closeReason)}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
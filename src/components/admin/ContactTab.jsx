import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, MessageSquare, ChevronDown, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const TYPE_COLORS = {
  incident: "bg-red-100 text-red-700",
  recommendation: "bg-blue-100 text-blue-700",
  question: "bg-purple-100 text-purple-700",
  other: "bg-muted text-muted-foreground",
};

const TYPE_LABELS = {
  incident: "🐛 Incident",
  recommendation: "💡 Recommendation",
  question: "❓ Question",
  other: "📬 Other",
};

const STATUS_COLORS = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-muted text-muted-foreground",
};

export default function ContactTab() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState({});
  const [replies, setReplies] = useState({});
  const [sendingReply, setSendingReply] = useState({});

  useEffect(() => {
    base44.entities.ContactMessage.list("-created_date", 200).then(data => {
      setTickets(data);
      setLoading(false);
    });
  }, []);

  const updateStatus = async (ticket, status) => {
    await base44.entities.ContactMessage.update(ticket.id, { status });
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status } : t));
    toast({ title: `Ticket marked as ${status.replace("_", " ")}` });
  };

  const saveNotes = async (ticket) => {
    setSaving(s => ({ ...s, [ticket.id]: true }));
    await base44.entities.ContactMessage.update(ticket.id, { admin_notes: notes[ticket.id] ?? ticket.admin_notes ?? "" });
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, admin_notes: notes[ticket.id] ?? t.admin_notes } : t));
    setSaving(s => ({ ...s, [ticket.id]: false }));
    toast({ title: "Notes saved" });
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const sendReply = async (ticket) => {
    const msg = replies[ticket.id]?.trim();
    if (!msg) { toast({ title: "Please write a reply first", variant: "destructive" }); return; }
    setSendingReply(s => ({ ...s, [ticket.id]: true }));
    await base44.functions.invoke("replyToTicket", {
      ticket_id: ticket.id,
      user_email: ticket.user_email,
      user_name: ticket.user_name || ticket.user_email,
      subject: ticket.subject,
      reply_message: msg,
    });
    setReplies(r => ({ ...r, [ticket.id]: "" }));
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: "in_progress" } : t));
    setSendingReply(s => ({ ...s, [ticket.id]: false }));
    toast({ title: "Reply sent!", description: `Email delivered to ${ticket.user_email}` });
  };

  const filtered = tickets.filter(t =>
    (statusFilter === "all" || t.status === statusFilter) &&
    (typeFilter === "all" || t.type === typeFilter)
  );

  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  tickets.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="bg-card rounded-2xl border border-border p-4">
            <p className="text-2xl font-bold font-sora text-foreground">{count}</p>
            <p className={`text-xs font-medium capitalize mt-1 px-2 py-0.5 rounded-full inline-block ${STATUS_COLORS[status]}`}>{status.replace("_", " ")}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="incident">Incident</SelectItem>
            <SelectItem value="recommendation">Recommendation</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Tickets */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tickets found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <div key={ticket.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggle(ticket.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[ticket.type]}`}>
                      {TYPE_LABELS[ticket.type] || ticket.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[ticket.status]}`}>
                      {ticket.status?.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ticket.user_name || ticket.user_email} · {new Date(ticket.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex-shrink-0 text-muted-foreground">
                  {expanded[ticket.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expanded details */}
              {expanded[ticket.id] && (
                <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">From</p>
                    <p className="text-sm text-foreground">{ticket.user_name} · <span className="text-primary">{ticket.user_email}</span></p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Admin Notes <span className="text-muted-foreground/50">(internal, not sent to user)</span></p>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      rows={3}
                      placeholder="Internal notes (not visible to user)..."
                      defaultValue={ticket.admin_notes || ""}
                      onChange={e => setNotes(n => ({ ...n, [ticket.id]: e.target.value }))}
                    />
                  </div>

                  {/* Reply to user */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                      <Send size={12} /> Reply to User <span className="font-normal text-blue-500">— email sent directly to {ticket.user_email}</span>
                    </p>
                    <textarea
                      className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                      rows={4}
                      placeholder={`Write your reply to ${ticket.user_name || ticket.user_email}...`}
                      value={replies[ticket.id] || ""}
                      onChange={e => setReplies(r => ({ ...r, [ticket.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={sendingReply[ticket.id] || !replies[ticket.id]?.trim()}
                      onClick={() => sendReply(ticket)}
                    >
                      {sendingReply[ticket.id] ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {sendingReply[ticket.id] ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium text-muted-foreground">Change status:</p>
                    {["open", "in_progress", "resolved", "closed"].map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(ticket, s)}
                        className={`text-xs px-3 py-1 rounded-lg border capitalize transition-all ${ticket.status === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs ml-auto"
                      disabled={saving[ticket.id]}
                      onClick={() => saveNotes(ticket)}
                    >
                      {saving[ticket.id] ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                      Save Notes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

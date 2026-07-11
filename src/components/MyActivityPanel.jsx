import { Link } from "react-router-dom";
import { FileText, BookPlus, Edit3, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     color: "bg-gray-100 text-gray-600",    icon: Edit3 },
  pending:   { label: "Pending",   color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved:  { label: "Approved",  color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-600",       icon: XCircle },
  published: { label: "Published", color: "bg-blue-100 text-blue-700",     icon: CheckCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

export default function MyActivityPanel({ submissions, requests }) {
  const hasActivity = submissions.length > 0 || requests.length > 0;
  if (!hasActivity) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {submissions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> My Contributions
          </h2>
          <div className="space-y-2">
            {submissions.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.bank_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.created_date).toLocaleDateString()}</p>
                  {s.admin_feedback && <p className="text-xs text-muted-foreground italic mt-0.5">"{s.admin_feedback}"</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={s.status} />
                  {s.status === "draft" && (
                    <Link to={`/contribute?draft_id=${s.id}`}
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Edit3 size={11} /> Edit
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link to="/contribute" className="text-xs text-primary hover:underline mt-3 inline-block">
            + New Contribution
          </Link>
        </div>
      )}

      {requests.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BookPlus className="w-4 h-4 text-primary" /> My Bank Requests
          </h2>
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.bank_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(r.created_date).toLocaleDateString()}</p>
                  {r.admin_feedback && <p className="text-xs text-muted-foreground italic mt-0.5">"{r.admin_feedback}"</p>}
                  {r.is_fulfilled && <span className="text-xs text-emerald-600 font-medium">✓ Fulfilled</span>}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
          <Link to="/contribute?tab=request" className="text-xs text-primary hover:underline mt-3 inline-block">
            + New Request
          </Link>
        </div>
      )}
    </div>
  );
}

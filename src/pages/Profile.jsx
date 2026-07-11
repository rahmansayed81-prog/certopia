import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { User, Zap, Trophy, FileText, CheckCircle, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function Profile() {
  const { user, checkAppState } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [myQuestions, setMyQuestions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: "" });
  const [tab, setTab] = useState("questions");

  useEffect(() => {
    if (!user) return;
    setForm({ bio: user.bio || "" });
    Promise.all([
      base44.entities.CreditTransaction.filter({ user_email: user.email }, "-created_date", 20),
      base44.entities.Question.filter({ contributor_email: user.email }, "-created_date", 20),
    ]).then(([tx, qs]) => { setTransactions(tx); setMyQuestions(qs); });
  }, [user]);

  const handleSave = async () => {
    await base44.auth.updateMe(form);
    await checkAppState();
    setEditing(false);
    toast({ title: "Profile updated!" });
  };

  const statusColors = { pending: "text-yellow-600", ai_verified: "text-blue-600", approved: "text-emerald-600", rejected: "text-red-600" };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-primary">{user?.full_name?.[0]?.toUpperCase() || "U"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-sora text-xl font-bold text-foreground">{user?.full_name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium capitalize">{user?.role}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
            {editing ? (
              <div className="mt-3 space-y-2">
                <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell us about yourself..." rows={2} className="resize-none text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}><Save size={13} className="mr-1" /> Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X size={13} /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1">
                <p className="text-sm text-muted-foreground flex-1">{user?.bio || "No bio yet."}</p>
                <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
          {[
            { label: "CC Balance", value: `${user?.cc_balance || 0} ⚡`, color: "text-accent" },
            { label: "Submitted", value: user?.total_questions_submitted || 0, color: "text-blue-600" },
            { label: "Approved", value: user?.total_questions_approved || 0, color: "text-emerald-600" },
            { label: "Best Score", value: user?.best_score ? `${user.best_score}%` : "—", color: "text-purple-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-bold font-sora ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        {[["questions", "My Questions"], ["transactions", "CC History"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div className="space-y-3">
          {myQuestions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">You haven't submitted any questions yet.</p>
            </div>
          ) : myQuestions.map(q => (
            <div key={q.id} className="bg-card rounded-xl border border-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                <span className={`text-xs font-medium flex-shrink-0 capitalize ${statusColors[q.status] || ""}`}>{q.status?.replace("_", " ")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{new Date(q.created_date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No credit transactions yet.</p>
            </div>
          ) : transactions.map(tx => (
            <div key={tx.id} className="bg-card rounded-xl border border-border px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">{tx.reason}</p>
                <p className="text-xs text-muted-foreground">{new Date(tx.created_date).toLocaleDateString()}</p>
              </div>
              <span className={`text-sm font-bold ${tx.type === "earn" ? "text-emerald-600" : "text-red-500"}`}>
                {tx.type === "earn" ? "+" : "−"}{tx.amount} CC
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
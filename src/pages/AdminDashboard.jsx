import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Zap, BookOpen, Plus, Trash2, CheckCircle, XCircle, Settings, Globe, Layers, Inbox, Pencil, Eye, EyeOff, ChevronDown, ChevronUp, MessageSquare, Loader2 } from "lucide-react";
import NewsTab from "../components/admin/NewsTab";
import ContributionsTab from "../components/admin/ContributionsTab";
import EarlyBirdTab from "../components/admin/EarlyBirdTab";
import ContactTab from "../components/admin/ContactTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const TABS = [
  { key: "moderation", label: "Moderation", icon: CheckCircle },
  { key: "questions", label: "Questions", icon: BookOpen },
  { key: "contributions", label: "Contributions", icon: Inbox },
  { key: "sub_admins", label: "Sub-Admins", icon: Users },
  { key: "invite_codes", label: "Invite Codes", icon: Zap },
  { key: "content", label: "Content", icon: Layers },
  { key: "news", label: "News", icon: Globe },
  { key: "early_bird", label: "Early Bird", icon: Zap },
  { key: "contact", label: "Contact", icon: MessageSquare },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState("moderation");

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-sora text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Platform management & moderation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-xl p-1 gap-1 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === "moderation" && <ModerationTab />}
      {tab === "questions" && <QuestionsTab />}
      {tab === "sub_admins" && <SubAdminsTab />}
      {tab === "invite_codes" && <InviteCodesTab />}
      {tab === "content" && <ContentTab />}
      {tab === "contributions" && <ContributionsTab />}
      {tab === "news" && <NewsTab />}
      {tab === "early_bird" && <EarlyBirdTab />}
      {tab === "contact" && <ContactTab />}
    </div>
  );
}

function ModerationTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [aiLoading, setAiLoading] = useState({});

  useEffect(() => {
    base44.entities.Question.filter({ status: filter }, "-created_date", 50).then(q => { setQuestions(q); setLoading(false); });
  }, [filter]);

  const updateStatus = async (q, status, notes = "") => {
    await base44.entities.Question.update(q.id, { status, ai_verification_notes: notes });
    setQuestions(prev => prev.filter(x => x.id !== q.id));
    if (status === "approved") {
      // Award CC to contributor
      const contribs = await base44.entities.User.filter({ email: q.contributor_email });
      if (contribs[0]) {
        await base44.auth.updateMe({ cc_balance: (contribs[0].cc_balance || 0) + 15, total_questions_approved: (contribs[0].total_questions_approved || 0) + 1 });
        await base44.entities.CreditTransaction.create({ user_email: q.contributor_email, type: "earn", amount: 15, reason: "Question approved", reason_key: "question_approved", reference_id: q.id });
      }
    }
    toast({ title: `Question ${status.replace("_", " ")}` });
  };

  const runAIVerification = async (q) => {
    setAiLoading(l => ({ ...l, [q.id]: true }));
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are verifying a professional certification exam question. Assess if this question is valid, accurate, and suitable for a professional certification exam.

Question: ${q.question_text}
Options: ${q.options?.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}${o.is_correct ? " [MARKED CORRECT]" : ""}`).join(", ")}
Explanation: ${q.explanation || "None provided"}
Source: ${q.source_url || "None provided"}

Respond with: is_valid (boolean), confidence (0-100), notes (string with brief assessment), suggested_status ("ai_verified" or "rejected")`,
      response_json_schema: {
        type: "object", properties: {
          is_valid: { type: "boolean" },
          confidence: { type: "number" },
          notes: { type: "string" },
          suggested_status: { type: "string" }
        }
      }
    });
    await base44.entities.Question.update(q.id, { status: result.suggested_status || "ai_verified", ai_verification_notes: `[AI ${result.confidence}% confidence] ${result.notes}` });
    // Award CC if verified
    if (result.is_valid) {
      await base44.entities.CreditTransaction.create({ user_email: q.contributor_email, type: "earn", amount: 10, reason: "Question AI verified", reason_key: "question_ai_verified", reference_id: q.id });
    }
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, status: result.suggested_status || "ai_verified", ai_verification_notes: result.notes } : x));
    setAiLoading(l => ({ ...l, [q.id]: false }));
    toast({ title: `AI Verification: ${result.is_valid ? "✅ Valid" : "❌ Issues found"}`, description: result.notes });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["pending", "ai_verified", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${filter === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? <div className="h-32 bg-muted rounded-2xl animate-pulse" /> :
        questions.length === 0 ? <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">No {filter} questions.</div> :
        <div className="space-y-4">
          {questions.map(q => (
            <div key={q.id} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                <span className="text-xs text-muted-foreground flex-shrink-0">{q.contributor_email}</span>
              </div>
              {q.ai_verification_notes && (
                <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-blue-700 mb-3">{q.ai_verification_notes}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => runAIVerification(q)} disabled={aiLoading[q.id]} className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1.5">
                  {aiLoading[q.id] ? "Verifying..." : <><Zap size={12} /> AI Verify</>}
                </Button>
                <Button size="sm" onClick={() => updateStatus(q, "approved")} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle size={12} /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(q, "rejected")} className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                  <XCircle size={12} /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function QuestionsTab() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.Question.list("-created_date", 100),
      base44.entities.QuestionBank.list("-created_date"),
    ]).then(([q, b]) => { setQuestions(q); setBanks(b); setLoading(false); });
  }, []);

  const filtered = filter === "all" ? questions : questions.filter(q => q.status === filter);

  const startEdit = (q) => { setEditingId(q.id); setEditForm({ ...q, options: q.options ? [...q.options.map(o => ({ ...o }))] : [] }); };

  const handleSave = async () => {
    await base44.entities.Question.update(editingId, editForm);
    setQuestions(prev => prev.map(q => q.id === editingId ? { ...q, ...editForm } : q));
    setEditingId(null);
    toast({ title: "Question updated!" });
  };

  const updateOption = (idx, field, value) => {
    setEditForm(f => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, [field]: value } : o) }));
  };

  const markAllApproved = async () => {
    const pending = questions.filter(q => q.status !== "approved");
    await Promise.all(pending.map(q => base44.entities.Question.update(q.id, { status: "approved" })));
    setQuestions(prev => prev.map(q => ({ ...q, status: "approved" })));
    toast({ title: `${pending.length} questions marked as approved` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "ai_verified", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${filter === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {s === "all" ? `All (${questions.length})` : `${s.replace("_", " ")} (${questions.filter(q => q.status === s).length})`}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={markAllApproved} className="text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
          <CheckCircle size={12} /> Approve All
        </Button>
      </div>

      {loading ? <div className="h-32 bg-muted rounded-2xl animate-pulse" /> :
        filtered.length === 0 ? <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">No questions.</div> :
        <div className="space-y-3">
          {filtered.map(q => (
            <div key={q.id} className="bg-card rounded-2xl border border-border p-5">
              {editingId === q.id ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full text-sm border border-input rounded-lg p-2 resize-none bg-background text-foreground"
                    rows={3}
                    value={editForm.question_text || ""}
                    onChange={e => setEditForm(f => ({ ...f, question_text: e.target.value }))}
                  />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Options (check correct)</p>
                    {(editForm.options || []).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="checkbox" checked={!!opt.is_correct} onChange={e => updateOption(idx, "is_correct", e.target.checked)} className="accent-primary" />
                        <Input value={opt.text} onChange={e => updateOption(idx, "text", e.target.value)} className="text-xs h-8" />
                      </div>
                    ))}
                  </div>
                  <textarea
                    className="w-full text-xs border border-input rounded-lg p-2 resize-none bg-background text-foreground"
                    rows={2}
                    placeholder="Explanation"
                    value={editForm.explanation || ""}
                    onChange={e => setEditForm(f => ({ ...f, explanation: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={editForm.question_bank_id || ""} onValueChange={v => setEditForm(f => ({ ...f, question_bank_id: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Question Bank" /></SelectTrigger>
                      <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={editForm.status || "pending"} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>{["pending","ai_verified","approved","rejected"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={editForm.difficulty || ""} onValueChange={v => setEditForm(f => ({ ...f, difficulty: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                      <SelectContent>{["associate","professional","expert"].map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Source URL" value={editForm.source_url || ""} onChange={e => setEditForm(f => ({ ...f, source_url: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-foreground flex-1">{q.question_text}</p>
                    <Button size="sm" variant="outline" onClick={() => startEdit(q)} className="text-xs flex-shrink-0">Edit</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="font-mono text-muted-foreground/60">ID: {q.id}</span>
                    <span className={`px-2 py-0.5 rounded-full capitalize font-medium ${
                      q.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      q.status === "rejected" ? "bg-red-100 text-red-600" :
                      q.status === "ai_verified" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                    }`}>{q.status?.replace("_"," ")}</span>
                    {q.difficulty && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{q.difficulty}</span>}
                    <span className="text-muted-foreground">Bank: {banks.find(b => b.id === q.question_bank_id)?.name || q.question_bank_id}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function SubAdminsTab() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [domains, setDomains] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ user_email: "", user_name: "", scope_type: "category", domain_ids: [], category_ids: [], permissions: ["moderate_questions"] });

  useEffect(() => {
    Promise.all([
      base44.entities.SubAdminAssignment.list("-created_date"),
      base44.entities.Category.filter({ is_active: true }),
      base44.entities.Domain.filter({ is_active: true }),
    ]).then(([a, c, d]) => { setAssignments(a); setCategories(c); setDomains(d); });
  }, []);

  const handleCreate = async () => {
    if (!form.user_email) { toast({ title: "Email required", variant: "destructive" }); return; }
    // Update user role to sub_admin
    const users = await base44.entities.User.filter({ email: form.user_email });
    if (users[0]) await base44.entities.User.update(users[0].id, { role: "sub_admin" });
    const me = await base44.auth.me();
    const created = await base44.entities.SubAdminAssignment.create({ ...form, assigned_by: me.email });
    setAssignments(prev => [created, ...prev]);
    setShowForm(false);
    setForm({ user_email: "", user_name: "", scope_type: "category", domain_ids: [], category_ids: [], permissions: ["moderate_questions"] });
    toast({ title: "Sub-admin assigned!" });
  };

  const handleDeactivate = async (a) => {
    await base44.entities.SubAdminAssignment.update(a.id, { is_active: false });
    setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, is_active: false } : x));
    toast({ title: "Sub-admin deactivated" });
  };

  const PERMS = ["moderate_questions", "manage_banks", "manage_tracks", "view_analytics"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1.5"><Plus size={14} /> Assign Sub-Admin</Button>
      </div>
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-foreground">New Sub-Admin Assignment</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">User Email *</label>
              <Input value={form.user_email} onChange={e => setForm(f => ({ ...f, user_email: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
              <Input value={form.user_name} onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))} placeholder="Full name" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Scope</label>
            <div className="flex gap-2">
              {["domain", "category"].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, scope_type: s }))}
                  className={`px-4 py-2 rounded-xl text-sm border capitalize transition-all ${form.scope_type === s ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {form.scope_type === "category" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assigned Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button key={c.id} onClick={() => setForm(f => ({ ...f, category_ids: f.category_ids.includes(c.id) ? f.category_ids.filter(x => x !== c.id) : [...f.category_ids, c.id] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${form.category_ids.includes(c.id) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {form.scope_type === "domain" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assigned Domains</label>
              <div className="flex flex-wrap gap-2">
                {domains.map(d => (
                  <button key={d.id} onClick={() => setForm(f => ({ ...f, domain_ids: f.domain_ids.includes(d.id) ? f.domain_ids.filter(x => x !== d.id) : [...f.domain_ids, d.id] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${form.domain_ids.includes(d.id) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {PERMS.map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p] }))}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${form.permissions.includes(p) ? "bg-secondary text-secondary-foreground border-primary/30" : "border-border text-muted-foreground"}`}>
                  {p.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Assign</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {assignments.map(a => (
          <div key={a.id} className={`bg-card rounded-xl border p-4 flex items-start justify-between gap-3 ${!a.is_active ? "opacity-50" : "border-border"}`}>
            <div>
              <p className="font-medium text-sm text-foreground">{a.user_name || a.user_email}</p>
              <p className="text-xs text-muted-foreground">{a.user_email}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{a.scope_type}</span>
                {(a.permissions || []).map(p => <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p.replace(/_/g, " ")}</span>)}
                {!a.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Inactive</span>}
              </div>
            </div>
            {a.is_active && (
              <Button size="sm" variant="outline" onClick={() => handleDeactivate(a)} className="text-red-500 border-red-200 hover:bg-red-50 text-xs">Deactivate</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteCodesTab() {
  const { toast } = useToast();
  const [codes, setCodes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", cc_reward: 50, max_uses: 0, is_active: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [expandedUsers, setExpandedUsers] = useState({});
  const [gateDisabled, setGateDisabled] = useState(false);
  const [gateSettingId, setGateSettingId] = useState(null);
  const [togglingGate, setTogglingGate] = useState(false);

  useEffect(() => {
    base44.entities.InvitationCode.list("-created_date").then(setCodes);
    base44.entities.AppSetting.filter({ key: "invite_gate_disabled" }).then(settings => {
      if (settings[0]) {
        setGateSettingId(settings[0].id);
        setGateDisabled(settings[0].value === "true");
      }
    });
  }, []);

  const toggleGate = async () => {
    setTogglingGate(true);
    const newValue = !gateDisabled;
    if (gateSettingId) {
      await base44.entities.AppSetting.update(gateSettingId, { value: String(newValue) });
    } else {
      const created = await base44.entities.AppSetting.create({
        key: "invite_gate_disabled",
        value: String(newValue),
        description: "When true, users can access the platform without an invitation code",
      });
      setGateSettingId(created.id);
    }
    setGateDisabled(newValue);
    setTogglingGate(false);
    toast({ title: newValue ? "Invite gate disabled — users can now sign in freely" : "Invite gate enabled — users must use an invite code" });
  };

  const generate = () => setForm(f => ({ ...f, code: "CERT-" + Math.random().toString(36).substring(2, 8).toUpperCase() }));

  const handleCreate = async () => {
    if (!form.code) { toast({ title: "Code required", variant: "destructive" }); return; }
    const created = await base44.entities.InvitationCode.create({ ...form, uses_count: 0, used_by_emails: [] });
    setCodes(prev => [created, ...prev]);
    setShowForm(false);
    setForm({ code: "", description: "", cc_reward: 50, max_uses: 0, is_active: true });
    toast({ title: "Invite code created!" });
  };

  const toggleActive = async (c) => {
    await base44.entities.InvitationCode.update(c.id, { is_active: !c.is_active });
    setCodes(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete code "${c.code}"? This cannot be undone.`)) return;
    await base44.entities.InvitationCode.delete(c.id);
    setCodes(prev => prev.filter(x => x.id !== c.id));
    toast({ title: "Code deleted" });
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ code: c.code, description: c.description || "", cc_reward: c.cc_reward || 0, max_uses: c.max_uses || 0 });
  };

  const handleSaveEdit = async (c) => {
    await base44.entities.InvitationCode.update(c.id, editForm);
    setCodes(prev => prev.map(x => x.id === c.id ? { ...x, ...editForm } : x));
    setEditingId(null);
    toast({ title: "Code updated!" });
  };

  const toggleUsersExpand = (id) => setExpandedUsers(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      {/* Invite Gate Toggle */}
      <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border ${gateDisabled ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div>
          <p className="text-sm font-semibold text-foreground">Invitation Code Requirement</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {gateDisabled
              ? "🔓 Open access — users can sign in without an invite code"
              : "🔒 Private beta — users must enter an invite code to access the platform"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={togglingGate}
          onClick={toggleGate}
          className={`flex-shrink-0 gap-1.5 text-xs font-medium ${gateDisabled ? "border-amber-300 text-amber-700 hover:bg-amber-100" : "border-emerald-300 text-emerald-700 hover:bg-emerald-100"}`}
        >
          {togglingGate ? <Loader2 size={13} className="animate-spin" /> : null}
          {gateDisabled ? "Enable Invite Gate" : "Disable Invite Gate"}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1.5"><Plus size={14} /> New Code</Button>
      </div>
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-foreground">New Invitation Code</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Code *</label>
              <div className="flex gap-2">
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="CERT-XXXX" className="font-mono" />
                <Button size="sm" variant="outline" onClick={generate} type="button">Auto</Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CC Reward</label>
              <Input type="number" value={form.cc_reward} onChange={e => setForm(f => ({ ...f, cc_reward: parseInt(e.target.value) || 0 }))} min={0} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Uses (0 = unlimited)</label>
              <Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: parseInt(e.target.value) || 0 }))} min={0} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Oracle team beta" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Create Code</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {codes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border text-sm">No invite codes yet. Create one to start the beta.</div>
        ) : codes.map(c => {
          const maxUses = c.max_uses || 0;
          const used = c.uses_count || 0;
          const pct = maxUses > 0 ? Math.min(100, Math.round((used / maxUses) * 100)) : 0;
          const isFull = maxUses > 0 && used >= maxUses;
          const usedByEmails = c.used_by_emails || [];
          const isEditingThis = editingId === c.id;
          const usersExpanded = expandedUsers[c.id];

          return (
            <div key={c.id} className={`bg-card rounded-xl border border-border p-4 space-y-3 ${!c.is_active ? "opacity-60" : ""}`}>
              {isEditingThis ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Edit Code</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Code</label>
                      <Input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">CC Reward</label>
                      <Input type="number" value={editForm.cc_reward} onChange={e => setEditForm(f => ({ ...f, cc_reward: parseInt(e.target.value) || 0 }))} min={0} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Uses (0 = unlimited)</label>
                      <Input type="number" value={editForm.max_uses} onChange={e => setEditForm(f => ({ ...f, max_uses: parseInt(e.target.value) || 0 }))} min={0} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                      <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(c)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm font-bold text-foreground bg-muted px-3 py-1.5 rounded-lg">{c.code}</div>
                      {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isFull ? "bg-red-100 text-red-600" :
                        c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {isFull ? "Quota Full" : c.is_active ? "Active" : "Inactive"}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(c)} className="text-xs h-7">
                        {c.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)} className="text-xs h-7 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50">
                        <Pencil size={11} /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(c)} className="text-xs h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 size={11} /> Delete
                      </Button>
                    </div>
                  </div>

                  {/* Quota bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span>⚡</span> {c.cc_reward} CC per use
                      </span>
                      <span className={`font-medium ${isFull ? "text-red-600" : "text-foreground"}`}>
                        {used} / {maxUses > 0 ? maxUses : "∞"} uses
                      </span>
                    </div>
                    {maxUses > 0 && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Associated users */}
                  {usedByEmails.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleUsersExpand(c.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Users size={12} />
                        {usedByEmails.length} user{usedByEmails.length !== 1 ? "s" : ""} used this code
                        {usersExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {usersExpanded && (
                        <div className="mt-2 bg-muted rounded-lg p-3 space-y-1">
                          {usedByEmails.map(email => (
                            <div key={email} className="text-xs text-foreground font-mono flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                              {email}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContentTab() {
  const { toast } = useToast();
  const [tab, setTab] = useState("domains");
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.Domain.list("sort_order"),
      base44.entities.Category.list("sort_order"),
      base44.entities.Track.list("sort_order"),
      base44.entities.QuestionBank.list("-created_date"),
    ]).then(([d, c, t, b]) => { setDomains(d); setCategories(c); setTracks(t); setBanks(b); });
  }, []);

  const setters = { domains: setDomains, categories: setCategories, tracks: setTracks, banks: setBanks };
  const currentList = { domains, categories, tracks, banks }[tab] || [];

  const handleCreate = async () => {
    let created;
    if (tab === "domains") created = await base44.entities.Domain.create({ ...form, is_active: true });
    else if (tab === "categories") created = await base44.entities.Category.create({ ...form, is_active: true });
    else if (tab === "tracks") created = await base44.entities.Track.create({ ...form, is_active: true });
    else if (tab === "banks") created = await base44.entities.QuestionBank.create({ ...form, is_active: true, question_count: 0 });
    setters[tab](prev => [...prev, created]);
    setForm({});
    setShowForm(false);
    toast({ title: "Created!" });
  };

  const handleUpdate = async (item) => {
    let updated;
    if (tab === "domains") updated = await base44.entities.Domain.update(item.id, editForm);
    else if (tab === "categories") updated = await base44.entities.Category.update(item.id, editForm);
    else if (tab === "tracks") updated = await base44.entities.Track.update(item.id, editForm);
    else if (tab === "banks") updated = await base44.entities.QuestionBank.update(item.id, editForm);
    setters[tab](prev => prev.map(x => x.id === item.id ? { ...x, ...editForm } : x));
    setEditingId(null);
    toast({ title: "Updated!" });
  };

  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item }); };

  const FormFields = ({ f, setF, isEdit }) => (
    <>
      <Input placeholder="Name *" value={f.name || ""} onChange={e => setF(p => ({ ...p, name: e.target.value }))} />
      <Input placeholder="Description" value={f.description || ""} onChange={e => setF(p => ({ ...p, description: e.target.value }))} />
      {tab === "domains" && <Input placeholder="Icon (emoji)" value={f.icon || ""} onChange={e => setF(p => ({ ...p, icon: e.target.value }))} />}
      {(tab === "categories" || tab === "tracks" || tab === "banks") && (
        <Select value={f.domain_id || ""} onValueChange={v => setF(p => ({ ...p, domain_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
          <SelectContent>{domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {(tab === "tracks" || tab === "banks") && (
        <Select value={f.category_id || ""} onValueChange={v => setF(p => ({ ...p, category_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {tab === "banks" && (
        <>
          {isEdit && (
            <Select value={f.track_id || ""} onValueChange={v => setF(p => ({ ...p, track_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select track" /></SelectTrigger>
              <SelectContent>{tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={f.difficulty || ""} onValueChange={v => setF(p => ({ ...p, difficulty: v }))}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>{["associate","professional","expert"].map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" placeholder="CC Unlock Cost (0=free)" value={f.cc_unlock_cost || 0} onChange={e => setF(p => ({ ...p, cc_unlock_cost: parseInt(e.target.value) || 0, is_premium: parseInt(e.target.value) > 0 }))} />
        </>
      )}
    </>
  );

  const contentTabs = ["domains", "categories", "tracks", "banks"];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {contentTabs.map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); setEditingId(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${tab === t ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            {t}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="ml-auto gap-1.5 text-xs">
          <Plus size={12} /> Add
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-semibold text-foreground text-sm capitalize">New {tab.slice(0, -1)}</h3>
          <FormFields f={form} setF={setForm} isEdit={false} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {currentList.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm bg-card rounded-2xl border border-border">No {tab} yet.</div>
        ) : currentList.map(item => (
          <div key={item.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            {editingId === item.id ? (
              <div className="space-y-3">
                <FormFields f={editForm} setF={setEditForm} isEdit={true} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdate(item)}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {item.icon && <span className="text-lg flex-shrink-0">{item.icon}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      {item.is_premium && <span className="text-xs text-amber-600 font-medium">⚡ {item.cc_unlock_cost} CC</span>}
                      {item.difficulty && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{item.difficulty}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.is_active ? "Active" : "Inactive"}</span>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                    <p className="text-xs text-muted-foreground/60 mt-1 font-mono">ID: {item.id}</p>
                    {item.question_count !== undefined && <p className="text-xs text-muted-foreground mt-0.5">{item.question_count} questions</p>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => startEdit(item)} className="text-xs flex-shrink-0">Edit</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Settings, CheckCircle, XCircle, Zap, Inbox, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function SubAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [bankContributions, setBankContributions] = useState([]);
  const [aiLoading, setAiLoading] = useState({});
  const [filter, setFilter] = useState("pending");
  const [mainTab, setMainTab] = useState("questions");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "sub_admin") navigate("/dashboard");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    base44.entities.SubAdminAssignment.filter({ user_email: user.email, is_active: true }).then(assignments => {
      if (!assignments[0]) { setLoading(false); return; }
      const a = assignments[0];
      setAssignment(a);

      const categoryIds = a.category_ids || [];
      const domainIds = a.domain_ids || [];

      const qPromise = categoryIds.length > 0
        ? Promise.all(categoryIds.map(cid => base44.entities.Question.filter({ category_id: cid, status: filter }, "-created_date", 20))).then(r => r.flat())
        : Promise.resolve([]);

      const cPromise = categoryIds.length > 0
        ? Promise.all(categoryIds.map(cid => base44.entities.BankContribution.filter({ category_id: cid }, "-created_date", 20))).then(r => r.flat())
        : domainIds.length > 0
          ? Promise.all(domainIds.map(did => base44.entities.BankContribution.filter({ domain_id: did }, "-created_date", 20))).then(r => r.flat())
          : Promise.resolve([]);

      Promise.all([qPromise, cPromise]).then(([qs, cs]) => {
        setQuestions(qs);
        setBankContributions(cs);
        setLoading(false);
      });
    });
  }, [user, filter]);

  const updateStatus = async (q, status) => {
    await base44.entities.Question.update(q.id, { status });
    setQuestions(prev => prev.filter(x => x.id !== q.id));
    if (status === "approved") {
      await base44.entities.CreditTransaction.create({ user_email: q.contributor_email, type: "earn", amount: 15, reason: "Question approved", reason_key: "question_approved", reference_id: q.id });
    }
    toast({ title: `Question ${status}` });
  };

  const runAIVerification = async (q) => {
    setAiLoading(l => ({ ...l, [q.id]: true }));
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Verify this certification exam question for accuracy and quality:
Question: ${q.question_text}
Options: ${q.options?.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}${o.is_correct ? " [CORRECT]" : ""}`).join(", ")}
Explanation: ${q.explanation || "None"}
Respond with: is_valid (boolean), confidence (0-100), notes (string), suggested_status ("ai_verified" or "rejected")`,
      response_json_schema: { type: "object", properties: { is_valid: { type: "boolean" }, confidence: { type: "number" }, notes: { type: "string" }, suggested_status: { type: "string" } } }
    });
    await base44.entities.Question.update(q.id, { status: result.suggested_status || "ai_verified", ai_verification_notes: `[AI ${result.confidence}%] ${result.notes}` });
    if (result.is_valid) {
      await base44.entities.CreditTransaction.create({ user_email: q.contributor_email, type: "earn", amount: 10, reason: "Question AI verified", reason_key: "question_ai_verified", reference_id: q.id });
    }
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, status: result.suggested_status || "ai_verified", ai_verification_notes: result.notes } : x));
    setAiLoading(l => ({ ...l, [q.id]: false }));
    toast({ title: `AI: ${result.is_valid ? "✅ Valid" : "❌ Issues found"}`, description: result.notes });
  };

  if (loading) return <div className="p-6 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  if (!assignment) return (
    <div className="p-6 text-center text-muted-foreground mt-16">
      <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>No active sub-admin assignment found for your account.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <Settings className="w-5 h-5 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="font-sora text-2xl font-bold text-foreground">Moderation Dashboard</h1>
          <p className="text-muted-foreground text-sm capitalize">
            Scope: {assignment.scope_type} · Permissions: {(assignment.permissions || []).join(", ").replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <div className="flex bg-muted rounded-xl p-1 gap-1 w-fit">
        <button onClick={() => setMainTab("questions")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${mainTab === "questions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <CheckCircle size={14} /> Questions
        </button>
        <button onClick={() => setMainTab("contributions")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${mainTab === "contributions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Inbox size={14} /> Bank Contributions ({bankContributions.length})
        </button>
      </div>

      {mainTab === "questions" && (
        <>
          <div className="flex gap-2 flex-wrap">
            {["pending", "ai_verified", "approved", "rejected"].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize ${filter === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          {questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
              No {filter} questions in your assigned areas.
            </div>
          ) : (
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
                    {(assignment.permissions || []).includes("moderate_questions") && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => runAIVerification(q)} disabled={aiLoading[q.id]} className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1.5">
                          {aiLoading[q.id] ? "Verifying..." : <><Zap size={12} /> AI Verify</>}
                        </Button>
                        <Button size="sm" onClick={() => updateStatus(q, "approved")} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                          <CheckCircle size={12} /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(q, "rejected")} className="text-red-600 border-red-200 gap-1">
                          <XCircle size={12} /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mainTab === "contributions" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
              const header = "question_text,option_a,option_b,option_c,option_d,correct_option,explanation,source_url";
              const example = '"What is the primary purpose of Oracle HCM Cloud?","HR management","Financial reporting","Supply chain","CRM","A","Oracle HCM Cloud is a human resources management solution.",""';
              const blob = new Blob([header + "\n" + example], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "questions_template.csv"; a.click();
              URL.revokeObjectURL(url);
            }}>
              <FileText size={12} /> Download Template
            </Button>
          </div>
          {bankContributions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">No bank contributions in your scope.</div>
          ) : bankContributions.map(item => (
            <div key={item.id} className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-foreground">{item.bank_name}</p>
                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  {item.notes && <p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {item.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">By {item.contributor_name || item.contributor_email} · {new Date(item.created_date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ item.status === "approved" ? "bg-emerald-100 text-emerald-700" : item.status === "rejected" ? "bg-red-100 text-red-600" : item.status === "published" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700" }`}>{item.status}</span>
                  {item.file_url && (
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"><Download size={11} /> {item.file_name || "File"}</Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
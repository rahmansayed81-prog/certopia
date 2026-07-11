import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Check, X, Upload, BookOpen, FileText, Pencil, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  published: "bg-blue-100 text-blue-700",
};

function parseCsv(text) {
  const lines = text.trim().split("\n");
  return lines.slice(1).filter(l => l.trim()).map(line => {
    // handle basic quoted fields
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += line[i];
    }
    cols.push(cur.trim());
    const [question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source_url] = cols;
    const correctIdx = ["A","B","C","D"].indexOf((correct_option || "").toUpperCase());
    const options = [option_a, option_b, option_c, option_d]
      .filter(Boolean)
      .map((text, i) => ({ text, is_correct: i === correctIdx }));
    return { question_text, options, explanation: explanation || "", source_url: source_url || "" };
  }).filter(q => q.question_text);
}

function downloadTemplate() {
  const header = "question_text,option_a,option_b,option_c,option_d,correct_option,explanation,source_url";
  const example = '"What is the primary purpose of Oracle HCM Cloud?","HR management","Financial reporting","Supply chain","CRM","A","Oracle HCM Cloud is a human resources management solution.",""';
  const blob = new Blob([header + "\n" + example], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "questions_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function ContributionsTab() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("contributions");
  const [contributions, setContributions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState(null);
  const [publishName, setPublishName] = useState("");
  const [csvUploadId, setCsvUploadId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.BankContribution.list("-created_date", 50),
      base44.entities.BankRequest.list("-created_date", 50),
      base44.entities.Domain.filter({ is_active: true }),
      base44.entities.Category.filter({ is_active: true }),
      base44.entities.Track.filter({ is_active: true }),
    ]).then(([c, r, d, cats, trks]) => {
      setContributions(c);
      setRequests(r);
      setDomains(d);
      setCategories(cats);
      setTracks(trks);
      setLoading(false);
    });
  }, []);

  const updateStatus = async (item, type, status) => {
    if (type === "contribution") {
      await base44.entities.BankContribution.update(item.id, { status });
      setContributions(prev => prev.map(x => x.id === item.id ? { ...x, status } : x));
    } else {
      await base44.entities.BankRequest.update(item.id, { status });
      setRequests(prev => prev.map(x => x.id === item.id ? { ...x, status } : x));
    }
    toast({ title: `Marked as ${status}` });
  };

  const handleCsvUpload = async (item, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setCsvUploadId(item.id);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.BankContribution.update(item.id, { final_csv_url: file_url, final_csv_name: file.name });
    setContributions(prev => prev.map(x => x.id === item.id ? { ...x, final_csv_url: file_url, final_csv_name: file.name } : x));
    setUploading(false);
    setCsvUploadId(null);
    toast({ title: "CSV uploaded!" });
  };

  const handleSaveEdit = async (item) => {
    await base44.entities.BankContribution.update(item.id, editForm);
    setContributions(prev => prev.map(x => x.id === item.id ? { ...x, ...editForm } : x));
    setEditingId(null);
    toast({ title: "Details updated!" });
  };

  const handlePublish = async (item) => {
    if (!publishName.trim()) { toast({ title: "Publishing name required", variant: "destructive" }); return; }

    const bank = await base44.entities.QuestionBank.create({
      name: publishName,
      description: item.description,
      domain_id: item.domain_id,
      category_id: item.category_id,
      track_id: item.track_id,
      difficulty: item.difficulty,
      is_active: true,
      question_count: 0,
    });

    // Parse CSV and bulk-create questions if CSV was uploaded
    let questionCount = 0;
    if (item.final_csv_url) {
      const resp = await fetch(item.final_csv_url);
      const text = await resp.text();
      const parsed = parseCsv(text);
      if (parsed.length > 0) {
        const questions = parsed.map(q => ({
          ...q,
          question_bank_id: bank.id,
          status: "approved",
          difficulty: item.difficulty || "associate",
          contributor_email: item.contributor_email,
        }));
        await base44.entities.Question.bulkCreate(questions);
        await base44.entities.QuestionBank.update(bank.id, { question_count: questions.length });
        questionCount = questions.length;
      }
    }

    await base44.entities.BankContribution.update(item.id, { status: "published", published_bank_id: bank.id, publish_name: publishName });

    // Award CC for approved & published contribution
    const isLinkedToRequest = !!item.bank_request_id;
    const ccApprovalReward = isLinkedToRequest ? 10 : 5;
    const contributor = await base44.entities.User.filter({ email: item.contributor_email });
    if (contributor[0]) {
      const currentBalance = contributor[0].cc_balance || 0;
      await base44.entities.User.update(contributor[0].id, { cc_balance: currentBalance + ccApprovalReward });
      await base44.entities.CreditTransaction.create({
        user_email: item.contributor_email,
        type: "earn",
        amount: ccApprovalReward,
        reason: isLinkedToRequest ? `Requested bank approved & published: ${publishName}` : `Contribution approved & published: ${publishName}`,
        reason_key: "question_approved",
      });
    }

    // Fulfill linked request by ID first, then fall back to name match
    let requestToFulfill = null;
    if (item.bank_request_id) {
      const linked = await base44.entities.BankRequest.filter({ id: item.bank_request_id });
      if (linked[0]) requestToFulfill = linked[0];
    }
    if (!requestToFulfill) {
      const byName = await base44.entities.BankRequest.filter({ bank_name: item.bank_name, status: "approved" });
      if (byName[0]) requestToFulfill = byName[0];
    }
    if (requestToFulfill) {
      await base44.entities.BankRequest.update(requestToFulfill.id, { is_fulfilled: true, status: "approved" });
      await base44.integrations.Core.SendEmail({
        to: requestToFulfill.requester_email,
        subject: `Your bank request "${requestToFulfill.bank_name}" has been fulfilled! 🎉`,
        body: `Hi ${requestToFulfill.requester_name || "there"},\n\nGreat news! The question bank you requested — "${requestToFulfill.bank_name}" — has been contributed and published on Certopia as "${publishName}".\n\nHead over to the platform to start practicing!\n\nThe Certopia Team`,
      });
    }

    setContributions(prev => prev.map(x => x.id === item.id ? { ...x, status: "published", published_bank_id: bank.id } : x));
    setPublishingId(null);
    setPublishName("");
    toast({ title: "Bank published!", description: `"${publishName}" is now live${questionCount > 0 ? ` · ${questionCount} questions imported` : ""}${requestToFulfill ? " · Requester notified" : ""}.` });
  };

  const list = (subTab === "contributions" ? contributions : requests).filter(x => filter === "all" || x.status === filter);
  const filteredCats = categories.filter(c => !editForm.domain_id || c.domain_id === editForm.domain_id);
  const filteredTracks = tracks.filter(t => !editForm.category_id || t.category_id === editForm.category_id);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {["contributions", "requests"].map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${subTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-1.5 text-xs ml-2">
          <FileText size={12} /> Download Template
        </Button>
        <div className="flex gap-1.5 ml-auto">
          {["pending", "approved", "rejected", "all"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${filter === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="h-32 bg-muted rounded-2xl animate-pulse" /> : list.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border text-sm">No {filter} {subTab}.</div>
      ) : (
        <div className="space-y-3">
          {list.map(item => (
            <div key={item.id} className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || ""}`}>{item.status}</span>
                  </div>

                  {/* Inline Edit Form for bank details */}
                  {editingId === item.id ? (
                    <div className="space-y-3 mt-2">
                      <Input value={editForm.bank_name || ""} onChange={e => setEditForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Bank Name" />
                      <Input value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={editForm.domain_id || ""} onValueChange={v => setEditForm(f => ({ ...f, domain_id: v, category_id: "", track_id: "" }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Domain" /></SelectTrigger>
                          <SelectContent>{domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={editForm.category_id || ""} onValueChange={v => setEditForm(f => ({ ...f, category_id: v, track_id: "" }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                          <SelectContent>{filteredCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={editForm.track_id || ""} onValueChange={v => setEditForm(f => ({ ...f, track_id: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Track (optional)" /></SelectTrigger>
                          <SelectContent>{filteredTracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={editForm.difficulty || ""} onValueChange={v => setEditForm(f => ({ ...f, difficulty: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                          <SelectContent>{["associate","professional","expert"].map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(item)} className="gap-1 h-8 text-xs"><Save size={12} /> Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-8 text-xs"><XCircle size={12} /> Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">{item.bank_name}</p>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      {item.rationale && <p className="text-sm text-muted-foreground"><span className="font-medium">Rationale:</span> {item.rationale}</p>}
                      {item.notes && <p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {item.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        By {item.contributor_email || item.requester_email} · {new Date(item.created_date).toLocaleDateString()}
                      </p>
                      {item.difficulty && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{item.difficulty}</span>}
                    </>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0 flex-wrap items-start">
                  {/* Edit bank details */}
                  {subTab === "contributions" && item.status !== "published" && editingId !== item.id && (
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setEditForm({ bank_name: item.bank_name, description: item.description, domain_id: item.domain_id, category_id: item.category_id, track_id: item.track_id, difficulty: item.difficulty }); }} className="gap-1 h-8 text-xs">
                      <Pencil size={12} /> Edit Details
                    </Button>
                  )}

                  {/* Download original file */}
                  {subTab === "contributions" && item.file_url && (
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"><Download size={12} /> {item.file_name || "Contribution File"}</Button>
                    </a>
                  )}

                  {/* Download final CSV */}
                  {subTab === "contributions" && item.final_csv_url && (
                    <a href={item.final_csv_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-emerald-700 border-emerald-200"><Download size={12} /> {item.final_csv_name || "CSV"}</Button>
                    </a>
                  )}

                  {/* Approve / Reject */}
                  {item.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => updateStatus(item, subTab === "contributions" ? "contribution" : "request", "approved")} className="gap-1 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                        <Check size={12} /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(item, subTab === "contributions" ? "contribution" : "request", "rejected")} className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs">
                        <X size={12} /> Reject
                      </Button>
                    </>
                  )}

                  {/* Upload CSV + Publish (approved contributions only, not yet published) */}
                  {subTab === "contributions" && item.status === "approved" && !item.published_bank_id && (
                    <>
                      <label className="cursor-pointer">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 pointer-events-none" asChild>
                          <span>{uploading && csvUploadId === item.id ? "Uploading..." : <><Upload size={12} /> Upload CSV</>}</span>
                        </Button>
                        <input type="file" accept=".csv" className="hidden" onChange={e => handleCsvUpload(item, e)} />
                      </label>
                      {publishingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input value={publishName} onChange={e => setPublishName(e.target.value)}
                            placeholder="Publishing name..." className="h-8 text-xs border border-input rounded-md px-2 bg-background w-48" />
                          <Button size="sm" onClick={() => handlePublish(item)} className="gap-1 bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                            <BookOpen size={12} /> Publish
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPublishingId(null)} className="h-8 text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => { setPublishingId(item.id); setPublishName(item.bank_name); }} className="gap-1 bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                          <BookOpen size={12} /> Publish Bank
                        </Button>
                      )}
                    </>
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

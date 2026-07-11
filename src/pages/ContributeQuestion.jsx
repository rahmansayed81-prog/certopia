import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Upload, BookPlus, CheckCircle, Loader2, Paperclip, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function ContributeQuestion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const draftId = urlParams.get("draft_id");
  const linkedRequestId = urlParams.get("request_id") || "";
  const initialTab = urlParams.get("tab") === "request" ? "request" : "contribute";
  const [tab, setTab] = useState(initialTab);
  const [draftContribution, setDraftContribution] = useState(null);
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const [contributeForm, setContributeForm] = useState({
    bank_name: urlParams.get("bank_name") || "",
    description: urlParams.get("description") || "",
    domain_id: urlParams.get("domain_id") || "",
    category_id: urlParams.get("category_id") || "",
    track_id: "",
    notes: "", file: null, file_url: "", file_name: "",
  });

  const [requestForm, setRequestForm] = useState({
    bank_name: "", description: "", domain_id: "", category_id: "",
    rationale: "",
  });

  useEffect(() => { base44.entities.Domain.filter({ is_active: true }).then(setDomains); }, []);

  // Load draft if draft_id param present
  useEffect(() => {
    if (!draftId) return;
    base44.entities.BankContribution.filter({ id: draftId }).then(res => {
      if (res[0]) {
        const d = res[0];
        setDraftContribution(d);
        setContributeForm(f => ({
          ...f,
          bank_name: d.bank_name || "",
          description: d.description || "",
          domain_id: d.domain_id || "",
          category_id: d.category_id || "",
          track_id: d.track_id || "",
          difficulty: d.difficulty || "associate",
          notes: d.notes || "",
        }));
      }
    });
  }, [draftId]);

  const domainId = tab === "contribute" ? contributeForm.domain_id : requestForm.domain_id;
  const categoryId = tab === "contribute" ? contributeForm.category_id : requestForm.category_id;

  useEffect(() => {
    if (domainId) base44.entities.Category.filter({ domain_id: domainId, is_active: true }).then(setCategories);
    else setCategories([]);
  }, [domainId]);

  useEffect(() => {
    if (categoryId && tab === "contribute") base44.entities.Track.filter({ category_id: categoryId, is_active: true }).then(setTracks);
    else setTracks([]);
  }, [categoryId, tab]);

  const setC = (k, v) => setContributeForm(f => ({ ...f, [k]: v }));
  const setR = (k, v) => setRequestForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setC("file", file);
  };

  const handleSaveDraft = async () => {
    if (!contributeForm.bank_name.trim()) { toast({ title: "Bank name is required", variant: "destructive" }); return; }
    setSaving(true);
    let file_url = draftContribution?.file_url || "";
    let file_name = draftContribution?.file_name || "";
    if (contributeForm.file) {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file: contributeForm.file });
      file_url = url;
      file_name = contributeForm.file.name;
    }
    const data = {
      bank_name: contributeForm.bank_name,
      description: contributeForm.description,
      domain_id: contributeForm.domain_id,
      category_id: contributeForm.category_id,
      track_id: contributeForm.track_id,
      difficulty: contributeForm.difficulty,
      notes: contributeForm.notes,
      file_url,
      file_name,
      contributor_email: user.email,
      contributor_name: user.full_name,
      bank_request_id: linkedRequestId || (draftContribution?.bank_request_id || ""),
      status: "draft",
    };
    if (draftContribution) {
      await base44.entities.BankContribution.update(draftContribution.id, data);
    } else {
      const created = await base44.entities.BankContribution.create(data);
      setDraftContribution(created);
    }
    setSaving(false);
    toast({ title: "Draft saved!", description: "You can come back and edit it anytime." });
  };

  const handleContribute = async () => {
    if (!contributeForm.bank_name.trim()) { toast({ title: "Bank name is required", variant: "destructive" }); return; }
    setSubmitting(true);

    let file_url = "";
    let file_name = "";
    if (contributeForm.file) {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file: contributeForm.file });
      file_url = url;
      file_name = contributeForm.file.name;
    }

    const isLinkedToRequest = !!(linkedRequestId || draftContribution?.bank_request_id);
    const ccEarned = isLinkedToRequest ? 10 : 5;

    const data = {
      bank_name: contributeForm.bank_name,
      description: contributeForm.description,
      domain_id: contributeForm.domain_id,
      category_id: contributeForm.category_id,
      track_id: contributeForm.track_id,
      difficulty: contributeForm.difficulty,
      notes: contributeForm.notes,
      file_url: file_url || (draftContribution?.file_url || ""),
      file_name: file_name || (draftContribution?.file_name || ""),
      contributor_email: user.email,
      contributor_name: user.full_name,
      bank_request_id: linkedRequestId || (draftContribution?.bank_request_id || ""),
      status: "pending",
    };

    if (draftContribution) {
      await base44.entities.BankContribution.update(draftContribution.id, data);
    } else {
      await base44.entities.BankContribution.create(data);
    }

    // Award CC for contribution
    await base44.auth.updateMe({ cc_balance: (user.cc_balance || 0) + ccEarned });
    await base44.entities.CreditTransaction.create({
      user_email: user.email,
      type: "earn",
      amount: ccEarned,
      reason: isLinkedToRequest ? `Contributed for a requested bank: ${contributeForm.bank_name}` : `Contributed question bank: ${contributeForm.bank_name}`,
      reason_key: "question_submitted",
    });

    setSubmitting(false);
    setSubmitted("contribute");
    toast({ title: `Question bank submitted! +${ccEarned} CC earned 🎉`, description: "An admin will review and publish it." });
  };

  const handleRequest = async () => {
    if (!requestForm.bank_name.trim()) { toast({ title: "Bank name is required", variant: "destructive" }); return; }
    setSubmitting(true);

    await base44.entities.BankRequest.create({
      ...requestForm,
      requester_email: user.email,
      requester_name: user.full_name,
      status: "pending",
    });

    setSubmitting(false);
    setSubmitted("request");
    toast({ title: "Bank request submitted!", description: "Your request is pending admin approval." });
  };

  if (submitted) return (
    <div className="p-6 max-w-2xl mx-auto text-center mt-16">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="font-sora text-2xl font-bold text-foreground mb-2">
        {submitted === "contribute" ? "Bank Submitted!" : "Request Sent!"}
      </h2>
      <p className="text-muted-foreground mb-6 text-sm">
        {submitted === "contribute"
          ? "Your question bank is pending review. Once approved, it will be published on the platform."
          : "Your bank request is pending admin approval. You can track it on your Dashboard."}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={() => { setSubmitted(null); setContributeForm({ bank_name: "", description: "", domain_id: "", category_id: "", track_id: "", difficulty: "associate", notes: "", file: null, file_url: "", file_name: "" }); setRequestForm({ bank_name: "", description: "", domain_id: "", category_id: "", difficulty: "associate", rationale: "" }); }}>
          Submit Another
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-foreground">Contribute</h1>
        <p className="text-muted-foreground mt-1 text-sm">Submit a question bank or request a new one.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        <button onClick={() => setTab("contribute")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === "contribute" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Upload size={15} /> Submit Question Bank
        </button>
        <button onClick={() => setTab("request")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === "request" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <BookPlus size={15} /> Request a Bank
        </button>
      </div>

      {tab === "contribute" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <p className="text-sm text-muted-foreground">Upload a CSV, Excel, or PDF file containing your questions, along with the bank details below.</p>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Bank Name *</label>
            <Input value={contributeForm.bank_name} onChange={e => setC("bank_name", e.target.value)} placeholder="e.g. Oracle HCM Cloud 2024 – Practice Set" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Description</label>
            <Textarea value={contributeForm.description} onChange={e => setC("description", e.target.value)} placeholder="Briefly describe the content and scope of this bank..." rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Domain</label>
              <Select value={contributeForm.domain_id} onValueChange={v => { setC("domain_id", v); setC("category_id", ""); setC("track_id", ""); }}>
                <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                <SelectContent>{domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Category</label>
              <Select value={contributeForm.category_id} onValueChange={v => { setC("category_id", v); setC("track_id", ""); }} disabled={!contributeForm.domain_id}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Track</label>
              <Select value={contributeForm.track_id} onValueChange={v => setC("track_id", v)} disabled={!contributeForm.category_id}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Attach File</label>
            {contributeForm.file ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/40">
                <Paperclip size={16} className="text-primary" />
                <span className="text-sm text-foreground flex-1 truncate">{contributeForm.file.name}</span>
                <button onClick={() => setC("file", null)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors bg-muted/20">
                <Upload size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload CSV, Excel, or PDF</span>
                <input type="file" accept=".csv,.xlsx,.xls,.pdf,.json" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Additional Notes</label>
            <Textarea value={contributeForm.notes} onChange={e => setC("notes", e.target.value)} placeholder="Any notes for the reviewer..." rows={2} className="resize-none" />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="flex-1 h-11">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Draft</>}
            </Button>
            <Button onClick={handleContribute} disabled={submitting} className="flex-1 h-11 font-semibold">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...</> : <><Upload className="w-4 h-4 mr-2" /> Submit</>}
            </Button>
          </div>
        </div>
      )}

      {tab === "request" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <p className="text-sm text-muted-foreground">Don't have questions to contribute yet? Request a new question bank and an admin will review and create it.</p>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Bank Name *</label>
            <Input value={requestForm.bank_name} onChange={e => setR("bank_name", e.target.value)} placeholder="e.g. Oracle SCM Cloud 2025 Practitioner" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Description</label>
            <Textarea value={requestForm.description} onChange={e => setR("description", e.target.value)} placeholder="What topics should this bank cover?" rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Domain</label>
              <Select value={requestForm.domain_id} onValueChange={v => { setR("domain_id", v); setR("category_id", ""); }}>
                <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                <SelectContent>{domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Category</label>
              <Select value={requestForm.category_id} onValueChange={v => setR("category_id", v)} disabled={!requestForm.domain_id}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Why is this bank needed?</label>
            <Textarea value={requestForm.rationale} onChange={e => setR("rationale", e.target.value)} placeholder="Explain why this bank would be valuable to the community..." rows={3} className="resize-none" />
          </div>

          <Button onClick={handleRequest} disabled={submitting} className="w-full h-11 font-semibold">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</> : <><BookPlus className="w-4 h-4 mr-2" /> Submit Request</>}
          </Button>
        </div>
      )}
    </div>
  );
}
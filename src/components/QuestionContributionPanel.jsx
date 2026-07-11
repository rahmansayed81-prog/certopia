import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ThumbsUp, ThumbsDown, Plus, X, Link as LinkIcon, FileText, BookOpen, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const SOURCE_ICONS = { url: LinkIcon, note: FileText, course_ref: BookOpen, screenshot: Image };
const SOURCE_LABELS = { url: "URL", note: "Note", course_ref: "Course Ref", screenshot: "Screenshot" };

export default function QuestionContributionPanel({ questionId, bankId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contributions, setContributions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [sources, setSources] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.QuestionContribution.filter({ question_id: questionId }, "-created_date", 20)
      .then(r => { setContributions(r); setLoading(false); });
  }, [questionId]);

  const addSource = () => setSources(s => [...s, { type: "url", content: "" }]);
  const removeSource = (i) => setSources(s => s.filter((_, idx) => idx !== i));
  const updateSource = (i, field, val) => setSources(s => s.map((src, idx) => idx === i ? { ...src, [field]: val } : src));

  const handleSubmit = async () => {
    if (!note.trim()) { toast({ title: "Note is required", variant: "destructive" }); return; }
    setSubmitting(true);
    const created = await base44.entities.QuestionContribution.create({
      question_id: questionId,
      bank_id: bankId,
      contributor_email: user.email,
      contributor_name: user.full_name,
      note,
      sources: sources.filter(s => s.content.trim()),
      upvotes: 0,
      downvotes: 0,
      upvoted_by: [],
      downvoted_by: [],
    });
    setContributions(prev => [created, ...prev]);
    setNote("");
    setSources([]);
    setShowForm(false);
    setSubmitting(false);
    toast({ title: "Contribution submitted!" });
  };

  const handleVote = async (contrib, type) => {
    const upvoted_by = contrib.upvoted_by || [];
    const downvoted_by = contrib.downvoted_by || [];
    const alreadyUp = upvoted_by.includes(user.email);
    const alreadyDown = downvoted_by.includes(user.email);

    let newUp = contrib.upvotes || 0;
    let newDown = contrib.downvotes || 0;
    let newUpBy = [...upvoted_by];
    let newDownBy = [...downvoted_by];

    if (type === "up") {
      if (alreadyUp) { newUp--; newUpBy = newUpBy.filter(e => e !== user.email); }
      else { newUp++; newUpBy.push(user.email); if (alreadyDown) { newDown--; newDownBy = newDownBy.filter(e => e !== user.email); } }
    } else {
      if (alreadyDown) { newDown--; newDownBy = newDownBy.filter(e => e !== user.email); }
      else { newDown++; newDownBy.push(user.email); if (alreadyUp) { newUp--; newUpBy = newUpBy.filter(e => e !== user.email); } }
    }

    await base44.entities.QuestionContribution.update(contrib.id, {
      upvotes: newUp, downvotes: newDown, upvoted_by: newUpBy, downvoted_by: newDownBy,
    });
    setContributions(prev => prev.map(c => c.id === contrib.id ? {
      ...c, upvotes: newUp, downvotes: newDown, upvoted_by: newUpBy, downvoted_by: newDownBy,
    } : c));
  };

  if (loading) return null;

  return (
    <div className="mt-2 border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">
          Community Contributions {contributions.length > 0 && `(${contributions.length})`}
        </p>
        <button onClick={() => setShowForm(!showForm)}
          className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus size={11} /> Add Contribution
        </button>
      </div>

      {showForm && (
        <div className="bg-muted/40 rounded-xl p-4 mb-3 space-y-3 border border-border">
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Provide an alternative answer, correction, or supporting note..."
            rows={3}
            className="resize-none text-sm"
          />
          <div className="space-y-2">
            {sources.map((src, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={src.type} onChange={e => updateSource(i, "type", e.target.value)}
                  className="text-xs border border-input rounded-md px-2 py-1.5 bg-background">
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <Input value={src.content} onChange={e => updateSource(i, "content", e.target.value)}
                  placeholder={src.type === "url" ? "https://..." : "Description..."} className="h-8 text-xs flex-1" />
                <button onClick={() => removeSource(i)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
            ))}
            <button onClick={addSource} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              <Plus size={11} /> Add Source
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={submitting} className="h-8 text-xs">
              {submitting ? "Submitting..." : "Submit"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-8 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {contributions.length > 0 && (
        <div className="space-y-2">
          {contributions.map(c => {
            const upvotedByMe = (c.upvoted_by || []).includes(user?.email);
            const downvotedByMe = (c.downvoted_by || []).includes(user?.email);
            return (
              <div key={c.id} className="bg-muted/30 rounded-lg p-3 text-xs border border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-foreground/80 leading-relaxed">{c.note}</p>
                    {(c.sources || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {c.sources.map((src, i) => {
                          const Icon = SOURCE_ICONS[src.type] || LinkIcon;
                          return (
                            <span key={i} className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              <Icon size={10} />
                              {src.type === "url" ? (
                                <a href={src.content} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px]">{src.content}</a>
                              ) : src.content}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-muted-foreground/60 mt-1">{c.contributor_name || c.contributor_email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleVote(c, "up")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${upvotedByMe ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "border-border text-muted-foreground hover:text-emerald-600"}`}>
                      <ThumbsUp size={11} /> {c.upvotes || 0}
                    </button>
                    <button onClick={() => handleVote(c, "down")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${downvotedByMe ? "bg-red-100 text-red-600 border-red-200" : "border-border text-muted-foreground hover:text-red-500"}`}>
                      <ThumbsDown size={11} /> {c.downvotes || 0}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

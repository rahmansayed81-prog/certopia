import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function NewsTab() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", badge: "", publish_to: ["dashboard"], is_published: true, pinned: false });

  useEffect(() => { base44.entities.NewsAnnouncement.list("-created_date").then(setItems); }, []);

  const toggle = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const handleCreate = async () => {
    if (!form.title || !form.body) { toast({ title: "Title and content required", variant: "destructive" }); return; }
    const created = await base44.entities.NewsAnnouncement.create(form);
    setItems(prev => [created, ...prev]);
    setForm({ title: "", body: "", badge: "", publish_to: ["dashboard"], is_published: true, pinned: false });
    setShowForm(false);
    toast({ title: "News published!" });
  };

  const handleDelete = async (item) => {
    await base44.entities.NewsAnnouncement.delete(item.id);
    setItems(prev => prev.filter(x => x.id !== item.id));
    toast({ title: "Deleted" });
  };

  const handleToggle = async (item, field) => {
    const updated = { [field]: !item[field] };
    await base44.entities.NewsAnnouncement.update(item.id, updated);
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, ...updated } : x));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5"><Plus size={14} /> New Announcement</Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">New Announcement</h3>
          <Input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea
            className="w-full text-sm border border-input rounded-lg p-2 resize-none bg-background text-foreground min-h-[100px]"
            placeholder="Content *"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          />
          <Input placeholder="Badge label (e.g. New, Update, Beta)" value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Publish To</p>
            <div className="flex gap-2">
              {["home", "dashboard"].map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, publish_to: toggle(f.publish_to, p) }))}
                  className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition-all ${form.publish_to.includes(p) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="accent-primary" />
              Published
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-primary" />
              Pinned
            </label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Publish</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm bg-card rounded-2xl border border-border">No announcements yet.</div>
        ) : items.map(item => (
          <div key={item.id} className={`bg-card rounded-xl border border-border p-4 space-y-2 ${!item.is_published ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {item.pinned && <Pin size={12} className="text-primary" />}
                  {item.badge && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{item.badge}</span>}
                  {(item.publish_to || []).map(p => (
                    <span key={p} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full capitalize">{p}</span>
                  ))}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {item.is_published ? "Live" : "Draft"}
                  </span>
                </div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleToggle(item, "is_published")} className="text-xs h-7">
                  {item.is_published ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(item)} className="text-xs h-7 text-red-500 border-red-200 hover:bg-red-50">
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

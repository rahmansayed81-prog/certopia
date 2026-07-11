import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS = {
  incident: "🐛 Incident / Bug",
  recommendation: "💡 Recommendation",
  question: "❓ Question",
  other: "📬 Other",
};

export default function ContactForm({ user, onClose }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ type: "other", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    await base44.entities.ContactMessage.create({
      user_email: user.email,
      user_name: user.full_name || user.email,
      type: form.type,
      subject: form.subject,
      message: form.message,
      status: "open",
    });
    await base44.functions.invoke("notifyAdminsNewTicket", {
      user_email: user.email,
      user_name: user.full_name || user.email,
      type: form.type,
      subject: form.subject,
      message: form.message,
    });
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Message Sent!</h3>
          <p className="text-sm text-muted-foreground mt-1">Our team will get back to you as soon as possible.</p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>Close</Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
        <Input
          placeholder="Brief summary of your message"
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          maxLength={120}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          rows={5}
          placeholder="Describe your issue, suggestion, or question in detail..."
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground text-right mt-0.5">{form.message.length}/2000</p>
      </div>
      <Button type="submit" disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {loading ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}

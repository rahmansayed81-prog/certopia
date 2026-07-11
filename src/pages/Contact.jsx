import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Loader2 } from "lucide-react";
import ContactForm from "@/components/ContactForm";

export default function Contact() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-sora text-2xl font-bold text-foreground">Contact Us</h1>
          <p className="text-muted-foreground text-sm">Report an issue, share a recommendation, or ask a question.</p>
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        {user ? (
          <ContactForm user={user} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Please log in to contact us.</p>
        )}
      </div>
    </div>
  );
}
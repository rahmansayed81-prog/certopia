import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function InviteCodeGate({ onSuccess }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");

    const allCodes = await base44.entities.InvitationCode.filter({ code: code.trim().toUpperCase(), is_active: true });
    if (!allCodes.length) {
      setError("Invalid or inactive invitation code. Please try again.");
      setLoading(false);
      return;
    }
    const inv = allCodes[0];
    const maxUses = inv.max_uses || 0;
    if (maxUses > 0 && inv.uses_count >= maxUses) {
      setError("This invitation code has reached its usage limit.");
      setLoading(false);
      return;
    }
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      setError("This invitation code has expired.");
      setLoading(false);
      return;
    }

    const me = await base44.auth.me();
    const usedBy = inv.used_by_emails || [];
    if (usedBy.includes(me.email)) {
      setError("You have already used this invitation code.");
      setLoading(false);
      return;
    }

    // Update invitation code usage
    await base44.entities.InvitationCode.update(inv.id, {
      uses_count: (inv.uses_count || 0) + 1,
      used_by_emails: [...usedBy, me.email],
    });

    // Determine reward: use the invite code's cc_reward, plus early bird bonus if applicable
    const codeReward = inv.cc_reward || 0;

    // Check early bird: count all CreditTransactions with reason_key "invite_code"
    const allInviteTxns = await base44.entities.CreditTransaction.filter({ reason_key: "invite_code" });
    const isEarlyBird = allInviteTxns.length < 50;
    const earlyBirdBonus = isEarlyBird ? 20 : 0;
    const totalReward = codeReward + earlyBirdBonus;

    await base44.auth.updateMe({
      invite_code_used: inv.code,
      cc_balance: (me.cc_balance || 0) + totalReward,
    });

    await base44.entities.CreditTransaction.create({
      user_email: me.email,
      type: "earn",
      amount: codeReward,
      reason: `Joined with invite code: ${inv.code}`,
      reason_key: "invite_code",
      reference_id: inv.id,
    });

    if (isEarlyBird) {
      await base44.entities.CreditTransaction.create({
        user_email: me.email,
        type: "earn",
        amount: earlyBirdBonus,
        reason: "Early Bird bonus — one of the first 50 users",
        reason_key: "admin_grant",
        reference_id: inv.id,
      });
      toast({ title: "Welcome to Certopia! 🐦 Early Bird Bonus!", description: `You earned ${codeReward} CC for the invite code + ${earlyBirdBonus} CC early bird bonus!` });
    } else {
      toast({ title: "Welcome to Certopia! 🎉", description: `You earned ${codeReward} CC for joining!` });
    }

    setLoading(false);
    setTimeout(() => onSuccess?.(), 500);
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4 shadow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-sora text-3xl font-bold text-foreground">Welcome to Certopia</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Certopia is currently in private beta.<br />
            Enter your invitation code to get started.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Invitation Code</label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="CERTOPIA-XXXX"
                className="text-center text-lg font-mono tracking-widest h-12"
                maxLength={30}
              />
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
            <Button type="submit" disabled={loading || !code.trim()} className="w-full h-11 font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              {loading ? "Verifying..." : "Activate & Enter Platform"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Don't have a code? Contact{" "}
            <a href="mailto:hello@certopia.io" className="text-primary hover:underline">hello@certopia.io</a>
          </p>
        </div>
      </div>
    </div>
  );
}

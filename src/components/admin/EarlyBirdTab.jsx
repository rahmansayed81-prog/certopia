import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, BookOpen, HelpCircle, Star, Loader2, Plus, Minus, Coins, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function EarlyBirdTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inviteTxns, setInviteTxns] = useState([]);
  const [bankContribs, setBankContribs] = useState([]);
  const [questionContribs, setQuestionContribs] = useState([]);
  const [userBalances, setUserBalances] = useState({});
  const [creditManage, setCreditManage] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditAction, setCreditAction] = useState("grant");
  const [savingCredit, setSavingCredit] = useState(false);
  const [earlyBirdLimit, setEarlyBirdLimit] = useState(50);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("50");
  const [removingEmail, setRemovingEmail] = useState(null);

  const loadData = async () => {
    const [invites, banks, questions] = await Promise.all([
      base44.entities.CreditTransaction.filter({ reason_key: "invite_code" }),
      base44.entities.BankContribution.list("-created_date", 500),
      base44.entities.Question.list("-created_date", 500),
    ]);
    setInviteTxns(invites);
    setBankContribs(banks);
    setQuestionContribs(questions);

    // Fetch balances for all users
    const emails = [...new Set(invites.map(i => i.user_email))];
    const allUsers = await base44.entities.User.list();
    const balanceMap = {};
    allUsers.forEach(u => { balanceMap[u.email] = u.cc_balance || 0; });
    setUserBalances(balanceMap);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreditSave = async (email) => {
    const amount = parseInt(creditAmount);
    if (!amount || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setSavingCredit(true);

    const users = await base44.entities.User.filter({ email });
    if (!users[0]) { toast({ title: "User not found", variant: "destructive" }); setSavingCredit(false); return; }

    const currentBalance = userBalances[email] || 0;
    const newBalance = creditAction === "grant" ? currentBalance + amount : Math.max(0, currentBalance - amount);

    await base44.functions.invoke("adminUpdateUserBalance", { user_email: email, cc_balance: newBalance });
    await base44.entities.CreditTransaction.create({
      user_email: email,
      type: creditAction === "grant" ? "earn" : "spend",
      amount,
      reason: creditReason || (creditAction === "grant" ? "Admin grant" : "Admin deduct"),
      reason_key: creditAction === "grant" ? "admin_grant" : "admin_deduct",
    });

    setUserBalances(prev => ({ ...prev, [email]: newBalance }));
    setCreditManage(null);
    setCreditAmount("");
    setCreditReason("");
    setSavingCredit(false);
    toast({ title: `${creditAction === "grant" ? "Granted" : "Deducted"} ${amount} CC ${creditAction === "grant" ? "to" : "from"} ${email}` });
  };

  const handleRemoveUser = async (email) => {
    if (!window.confirm(`Remove ${email} from the early bird list? This will delete their invite_code transaction(s).`)) return;
    setRemovingEmail(email);
    const txnsToDelete = inviteTxns.filter(t => t.user_email === email);
    await Promise.all(txnsToDelete.map(t => base44.entities.CreditTransaction.delete(t.id)));
    setInviteTxns(prev => prev.filter(t => t.user_email !== email));
    setRemovingEmail(null);
    toast({ title: `${email} removed from early bird list` });
  };

  const handleSaveLimit = () => {
    const val = parseInt(limitInput);
    if (val > 0) { setEarlyBirdLimit(val); toast({ title: `Early bird limit updated to ${val}` }); }
    setEditingLimit(false);
  };

  // Build enriched user list sorted by join order (invite transaction date)
  // Deduplicate by email (keep earliest)
  const seenEmails = new Set();
  const uniqueTxns = inviteTxns
    .slice()
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    .filter(t => { if (seenEmails.has(t.user_email)) return false; seenEmails.add(t.user_email); return true; });

  const earlyBirdUsers = uniqueTxns.map((txn, index) => {
    const email = txn.user_email;
    const isBankContributor = bankContribs.some(b => b.contributor_email === email);
    const isQuestionContributor = questionContribs.some(q => q.contributor_email === email);
    return {
      email,
      joinedAt: txn.created_date,
      position: index + 1,
      isEarlyBird: index < earlyBirdLimit,
      isBankContributor,
      isQuestionContributor,
      bankCount: bankContribs.filter(b => b.contributor_email === email).length,
      questionCount: questionContribs.filter(q => q.contributor_email === email).length,
    };
  });

  const totalEarlyBirds = earlyBirdUsers.filter(u => u.isEarlyBird).length;
  const totalBankContribs = earlyBirdUsers.filter(u => u.isBankContributor).length;
  const totalQContribs = earlyBirdUsers.filter(u => u.isQuestionContributor).length;
  const spotsLeft = Math.max(0, earlyBirdLimit - totalEarlyBirds);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Star} label="Early Bird Users" value={totalEarlyBirds} sub={`${spotsLeft} spots left`} color="amber" />
        <StatCard icon={Users} label="Total Registered" value={earlyBirdUsers.length} sub="via invite code" color="primary" />
        <StatCard icon={BookOpen} label="Bank Contributors" value={totalBankContribs} sub="submitted a bank" color="blue" />
        <StatCard icon={HelpCircle} label="Question Contributors" value={totalQContribs} sub="submitted questions" color="emerald" />
      </div>

      {/* Progress bar */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold text-sm text-foreground">Early Bird Progress</h3>
          <div className="flex items-center gap-2">
            {editingLimit ? (
              <>
                <Input
                  type="number"
                  min={1}
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  className="h-7 w-20 text-xs"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleSaveLimit(); if (e.key === "Escape") setEditingLimit(false); }}
                />
                <button onClick={handleSaveLimit} className="text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                <button onClick={() => setEditingLimit(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground font-mono">{totalEarlyBirds} / {earlyBirdLimit} spots</span>
                <button onClick={() => { setLimitInput(String(earlyBirdLimit)); setEditingLimit(true); }} className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
            style={{ width: `${Math.min(100, (totalEarlyBirds / earlyBirdLimit) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {spotsLeft > 0
            ? `${spotsLeft} early bird spots remaining — new users joining now will still receive the 20 CC bonus`
            : `🎉 All ${earlyBirdLimit} early bird spots have been filled!`}
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Registered Users</h3>
        </div>
        <div className="divide-y divide-border">
          {earlyBirdUsers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No users registered yet.</div>
          ) : earlyBirdUsers.map(u => (
            <div key={u.email} className={`px-5 py-3 hover:bg-muted/40 transition-colors ${!u.isEarlyBird ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-4">
                {/* Position */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  u.position <= 10 ? "bg-amber-100 text-amber-700" :
                  u.isEarlyBird ? "bg-secondary text-secondary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  #{u.position}
                </div>

                {/* Email + join date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{new Date(u.joinedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>

                {/* CC Balance */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-primary">{userBalances[u.email] ?? "—"} CC</p>
                  <p className="text-xs text-muted-foreground">balance</p>
                </div>

                {/* Type badges */}
                <div className="hidden md:flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                  {u.isEarlyBird && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                      <Star size={10} className="fill-amber-500 text-amber-500" /> Early Bird
                    </span>
                  )}
                  {u.isBankContributor && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                      <BookOpen size={10} /> {u.bankCount} Bank{u.bankCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {u.isQuestionContributor && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                      <HelpCircle size={10} /> {u.questionCount} Q{u.questionCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {!u.isEarlyBird && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Late Joiner</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => { setCreditManage(creditManage === u.email ? null : u.email); setCreditAmount(""); setCreditReason(""); setCreditAction("grant"); }}
                  >
                    <Coins size={12} /> Manage CC
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={removingEmail === u.email}
                    onClick={() => handleRemoveUser(u.email)}
                  >
                    {removingEmail === u.email ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </Button>
                </div>
              </div>

              {/* Inline credit management panel */}
              {creditManage === u.email && (
                <div className="mt-3 ml-12 bg-muted/60 rounded-xl p-4 space-y-3 border border-border">
                  <p className="text-xs font-semibold text-foreground">Manage Credits for <span className="text-primary">{u.email}</span></p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreditAction("grant")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${creditAction === "grant" ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-emerald-400"}`}
                    >
                      <Plus size={12} /> Grant
                    </button>
                    <button
                      onClick={() => setCreditAction("deduct")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${creditAction === "deduct" ? "bg-red-600 text-white border-red-600" : "border-border text-muted-foreground hover:border-red-400"}`}
                    >
                      <Minus size={12} /> Deduct
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Amount (CC)"
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                    <Input
                      placeholder="Reason (optional)"
                      value={creditReason}
                      onChange={e => setCreditReason(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={savingCredit} onClick={() => handleCreditSave(u.email)}
                      className={`text-xs ${creditAction === "grant" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                      {savingCredit ? <Loader2 size={12} className="animate-spin" /> : creditAction === "grant" ? `Grant CC` : `Deduct CC`}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setCreditManage(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    amber: "bg-amber-50 text-amber-600",
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold font-sora text-foreground">{value}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

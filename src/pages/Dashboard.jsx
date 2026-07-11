import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import InviteCodeGate from "../components/InviteCodeGate";
import { BookOpen, FileText, Trophy, Zap, ArrowRight, TrendingUp, CheckCircle, Megaphone, Pin, X } from "lucide-react";
import MyActivityPanel from "../components/MyActivityPanel";
import { Button } from "@/components/ui/button";

const CC_RULES = [
  { action: "Contribute Content", earn: "+5 CC", icon: "✍️" },
  { action: "Approved & Published", earn: "+5 CC", icon: "✅" },
  { action: "Early Bird", earn: "+20 CC", icon: "🐦" },
  { action: "Unlock Question Bank", spend: "−10 CC", icon: "🔓" },
];

export default function Dashboard() {
  const { user, checkAppState } = useAuth();
  const [showInviteGate, setShowInviteGate] = useState(false);
  const [gateCheckDone, setGateCheckDone] = useState(false);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [communityRequests, setCommunityRequests] = useState([]);
  const [news, setNews] = useState([]);
  const [dismissedNews, setDismissedNews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed_news_ids") || "[]");
    } catch { return []; }
  });
  const [newContentBanners, setNewContentBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const checkGate = async () => {
      // Always fetch fresh user data to avoid stale state
      const freshUser = await base44.auth.me();

      if (freshUser.invite_code_used) {
        setGateCheckDone(true);
        return;
      }

      const settings = await base44.entities.AppSetting.filter({ key: "invite_gate_disabled" });

      if (settings[0]?.value === "true") {
        // Gate is disabled — grant welcome + early bird credits once
        const welcomeCC = 10;
        const allInviteTxns = await base44.entities.CreditTransaction.filter({ reason_key: "invite_code" });
        const isEarlyBird = allInviteTxns.length < 50;
        const earlyBirdBonus = isEarlyBird ? 20 : 0;
        const totalReward = welcomeCC + earlyBirdBonus;

        await base44.auth.updateMe({
          invite_code_used: "OPEN_ACCESS",
          cc_balance: (freshUser.cc_balance || 0) + totalReward,
        });

        await base44.entities.CreditTransaction.create({
          user_email: freshUser.email,
          type: "earn",
          amount: welcomeCC,
          reason: "Welcome bonus — open access",
          reason_key: "invite_code",
        });

        if (isEarlyBird) {
          await base44.entities.CreditTransaction.create({
            user_email: freshUser.email,
            type: "earn",
            amount: earlyBirdBonus,
            reason: "Early Bird bonus — one of the first 50 users",
            reason_key: "admin_grant",
          });
        }

        await checkAppState();
        setGateCheckDone(true);
      } else {
        setShowInviteGate(true);
        setGateCheckDone(true);
      }
    };

    checkGate();
  }, [user?.email]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const seenKey = `seen_content_ids_${user.email}`;
      const seenIds = JSON.parse(localStorage.getItem(seenKey) || "[]");

      const [attempts, submissions, requests, approved, allNews, recentBanks, recentDomains, recentCategories] = await Promise.all([
        base44.entities.ExamAttempt.filter({ user_email: user.email }, "-created_date", 5),
        base44.entities.BankContribution.filter({ contributor_email: user.email }, "-created_date", 5),
        base44.entities.BankRequest.filter({ requester_email: user.email }, "-created_date", 5),
        base44.entities.BankRequest.filter({ status: "approved", is_fulfilled: false }, "-created_date", 10),
        base44.entities.NewsAnnouncement.filter({ is_published: true }, "-created_date", 5),
        base44.entities.QuestionBank.filter({ is_active: true }, "-created_date", 20),
        base44.entities.Domain.filter({ is_active: true }, "-created_date", 10),
        base44.entities.Category.filter({ is_active: true }, "-created_date", 10),
      ]);

      // Find new content items the user hasn't been shown yet
      const allNewItems = [
        ...recentBanks.map(b => ({ id: `bank_${b.id}`, label: `New Question Bank: ${b.name}` })),
        ...recentDomains.map(d => ({ id: `domain_${d.id}`, label: `New Domain Available: ${d.name}` })),
        ...recentCategories.map(c => ({ id: `cat_${c.id}`, label: `New Category Added: ${c.name}` })),
      ];

      const unseen = allNewItems.filter(item => !seenIds.includes(item.id));
      if (unseen.length > 0) {
        setNewContentBanners(unseen);
        // Mark all as seen
        const newSeenIds = [...seenIds, ...unseen.map(i => i.id)];
        localStorage.setItem(seenKey, JSON.stringify(newSeenIds));
      }

      setRecentAttempts(attempts);
      setMySubmissions(submissions);
      setMyRequests(requests);
      setCommunityRequests(approved);
      setNews(allNews.filter(n => (n.publish_to || []).includes("dashboard")));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleInviteSuccess = async () => {
    setShowInviteGate(false);
    await checkAppState();
  };

  const stats = [
    { label: "Questions Submitted", value: user?.total_questions_submitted || 0, icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Questions Approved", value: user?.total_questions_approved || 0, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Exams Taken", value: user?.total_exams_taken || 0, icon: Trophy, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Best Score", value: user?.best_score ? `${user.best_score}%` : "—", icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
  ];

  if (!gateCheckDone) return null;
  if (showInviteGate) return <InviteCodeGate onSuccess={handleInviteSuccess} />;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-sora text-2xl font-bold text-foreground">
            Welcome back, {user?.full_name?.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Ready to continue your certification journey?</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20">
          <span className="text-accent text-lg">⚡</span>
          <div>
            <p className="text-xs text-muted-foreground">Your Balance</p>
            <p className="font-bold text-accent text-lg leading-none">{(user?.cc_balance || 0).toLocaleString()} CC</p>
          </div>
        </div>
      </div>

      {/* Announcements */}
      {(newContentBanners.length > 0 || news.filter(n => !dismissedNews.includes(n.id)).length > 0) && (
        <div className="space-y-2">
          {newContentBanners.map(item => (
            <div key={item.id} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <Megaphone size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">New</span>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                </div>
              </div>
              <button onClick={() => setNewContentBanners(prev => prev.filter(b => b.id !== item.id))} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                <X size={14} />
              </button>
            </div>
          ))}
          {news.filter(n => !dismissedNews.includes(n.id)).map(n => (
            <div key={n.id} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              {n.pinned ? <Pin size={14} className="text-primary flex-shrink-0 mt-0.5" /> : <Megaphone size={14} className="text-primary flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {n.badge && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">{n.badge}</span>}
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
              </div>
              <button onClick={() => {
                  const updated = [...dismissedNews, n.id];
                  setDismissedNews(updated);
                  localStorage.setItem("dismissed_news_ids", JSON.stringify(updated));
                }} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold font-sora text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/browse" className="group bg-primary rounded-2xl p-6 text-white hover:bg-primary/90 transition-colors">
          <BookOpen className="w-7 h-7 mb-3 opacity-80" />
          <h3 className="font-semibold text-lg">Browse Question Banks</h3>
          <p className="text-white/70 text-sm mt-1">Explore domains, tracks and practice questions</p>
          <ArrowRight className="w-5 h-5 mt-3 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link to="/contribute" className="group rounded-2xl p-6 hover:opacity-90 transition-all" style={{backgroundColor: "#10b981"}}>
          <FileText className="w-7 h-7 mb-3 text-white" />
          <h3 className="font-semibold text-lg text-white">Contribute Question Bank</h3>
          <p className="text-white/80 text-sm mt-1">Earn CC by submitting question bank</p>
          <ArrowRight className="w-5 h-5 mt-3 text-white group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link to="/leaderboard" className="group bg-card rounded-2xl border border-border p-6 hover:border-primary/30 hover:shadow-sm transition-all">
          <Trophy className="w-7 h-7 mb-3 text-amber-500" />
          <h3 className="font-semibold text-lg text-foreground">Leaderboard</h3>
          <p className="text-muted-foreground text-sm mt-1">See top contributors and performers</p>
          <ArrowRight className="w-5 h-5 mt-3 text-primary group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Community Bank Requests */}
      {communityRequests.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Community Bank Requests
          </h2>
          <p className="text-xs text-muted-foreground mb-4">These banks have been requested by the community — help contribute questions for them!</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {communityRequests.map(req => {
              const params = new URLSearchParams();
              if (req.bank_name) params.set("bank_name", req.bank_name);
              if (req.description) params.set("description", req.description);
              if (req.domain_id) params.set("domain_id", req.domain_id);
              if (req.category_id) params.set("category_id", req.category_id);
              if (req.difficulty) params.set("difficulty", req.difficulty);
              params.set("request_id", req.id);
              return (
                <Link key={req.id} to={`/contribute?${params.toString()}`}
                  className="group block p-4 rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{req.bank_name}</p>
                    <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  {req.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.description}</p>}
                  {req.difficulty && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{req.difficulty}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* My Activity */}
      <MyActivityPanel submissions={mySubmissions} requests={myRequests} />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* CC Economy */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" /> How to Earn CC
          </h2>
          <div className="space-y-2">
            {CC_RULES.map((rule) => (
              <div key={rule.action} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{rule.icon}</span>
                  <span className="text-sm text-foreground/80">{rule.action}</span>
                </div>
                <span className={`text-sm font-semibold ${rule.earn ? "text-emerald-600" : "text-red-500"}`}>
                  {rule.earn || rule.spend}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
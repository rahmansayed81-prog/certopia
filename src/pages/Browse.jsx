import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronRight, BookOpen, Search, Lock, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_CC_COST = 10;

const difficultyColors = {
  associate: "bg-emerald-100 text-emerald-700",
  professional: "bg-blue-100 text-blue-700",
  expert: "bg-purple-100 text-purple-700",
};

export default function Browse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [unlockedBanks, setUnlockedBanks] = useState(user?.unlocked_bank_ids || []);
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [questionCounts, setQuestionCounts] = useState({});

  useEffect(() => {
    base44.entities.Domain.filter({ is_active: true }, "sort_order").then(d => {
      setDomains(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      base44.entities.Category.filter({ domain_id: selectedDomain.id, is_active: true }, "sort_order").then(setCategories);
    }
  }, [selectedDomain]);

  useEffect(() => {
    if (selectedCategory) {
      Promise.all([
        base44.entities.Track.filter({ category_id: selectedCategory.id, is_active: true }, "sort_order"),
        base44.entities.QuestionBank.filter({ category_id: selectedCategory.id, is_active: true }),
      ]).then(([t, b]) => {
        setTracks(t);
        setBanks(b);
        loadQuestionCounts(b);
      });
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedTrack) {
      base44.entities.QuestionBank.filter({ track_id: selectedTrack.id, is_active: true }).then(b => {
        setBanks(b);
        loadQuestionCounts(b);
      });
    }
  }, [selectedTrack]);

  const loadQuestionCounts = async (bankList) => {
    if (!bankList.length) return;
    // Fetch all approved questions and count per bank (matching by id OR by name)
    const bankIds = bankList.map(b => b.id);
    const bankNames = bankList.map(b => b.name);
    const allQuestions = await base44.entities.Question.filter({ status: "approved" }, null, 2000);
    const counts = {};
    bankList.forEach(b => { counts[b.id] = 0; });
    allQuestions.forEach(q => {
      const qbid = q.question_bank_id;
      if (bankIds.includes(qbid)) {
        counts[qbid] = (counts[qbid] || 0) + 1;
      } else {
        // match by bank name
        const matched = bankList.find(b => b.name === qbid);
        if (matched) counts[matched.id] = (counts[matched.id] || 0) + 1;
      }
    });
    setQuestionCounts(counts);
  };

  const breadcrumb = [
    selectedDomain && { label: selectedDomain.name, onClick: () => { setSelectedCategory(null); setSelectedTrack(null); } },
    selectedCategory && { label: selectedCategory.name, onClick: () => setSelectedTrack(null) },
    selectedTrack && { label: selectedTrack.name, onClick: () => {} },
  ].filter(Boolean);

  const filteredBanks = banks.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  const isAdmin = user?.role === "admin";

  const isBankUnlocked = (bank) => {
    if (isAdmin) return true;
    return unlockedBanks.includes(bank.id);
  };

  const handleBankClick = async (bank) => {
    if (isBankUnlocked(bank)) {
      navigate(`/question-bank/${bank.id}`);
      return;
    }
    const cost = bank.cc_unlock_cost || DEFAULT_CC_COST;
    const balance = user?.cc_balance || 0;
    if (balance < cost) {
      toast({ title: "Insufficient CC", description: `You need ${cost} CC to unlock this bank. You have ${balance} CC.`, variant: "destructive" });
      return;
    }
    const newUnlockedIds = [...(user.unlocked_bank_ids || []), bank.id];
    await base44.auth.updateMe({ cc_balance: balance - cost, unlocked_bank_ids: newUnlockedIds });
    await base44.entities.CreditTransaction.create({
      user_email: user.email, type: "spend", amount: cost,
      reason: `Unlocked question bank: ${bank.name}`, reason_key: "unlock_bank", reference_id: bank.id,
    });
    setUnlockedBanks(newUnlockedIds);
    toast({ title: "Bank Unlocked! 🔓", description: `You can now access all questions in ${bank.name}.` });
    navigate(`/question-bank/${bank.id}`);
  };

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-foreground">Browse</h1>
        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button onClick={() => { setSelectedDomain(null); setSelectedCategory(null); setSelectedTrack(null); }}
              className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
              <ArrowLeft size={14} /> All Domains
            </button>
            {breadcrumb.map(({ label, onClick }, i) => (
              <span key={i} className="flex items-center gap-2">
                <ChevronRight size={14} className="text-muted-foreground" />
                <button onClick={onClick} className="text-sm text-foreground font-medium hover:text-primary">{label}</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Domains */}
      {!selectedDomain && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">Select a domain to explore certifications</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No domains available yet. Check back soon!</p>
              </div>
            ) : domains.map(d => (
              <button key={d.id} onClick={() => setSelectedDomain(d)}
                className="text-left p-5 bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">{d.icon || "📚"}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-foreground">{d.name}</h3>
                {d.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {selectedDomain && !selectedCategory && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">Select a category</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">No categories yet in this domain.</div>
            ) : categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCategory(c)}
                className="text-left p-5 bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{c.icon || "📂"}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{c.name}</h3>
                {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tracks + Banks */}
      {selectedCategory && (
        <div className="space-y-6">
          {/* Tracks */}
          {tracks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Tracks</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTrack(null)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${!selectedTrack ? "bg-primary text-white border-primary" : "bg-card border-border hover:border-primary/40"}`}>
                  All Tracks
                </button>
                {tracks.map(t => (
                  <button key={t.id} onClick={() => setSelectedTrack(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedTrack?.id === t.id ? "bg-primary text-white border-primary" : "bg-card border-border hover:border-primary/40"}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Banks */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-3">
              <p className="text-sm font-medium text-foreground">Question Banks ({filteredBanks.length})</p>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-9 text-sm" />
              </div>
            </div>
            {filteredBanks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No question banks found.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredBanks.map(b => {
                  const unlocked = isBankUnlocked(b);
                  const cost = b.cc_unlock_cost || DEFAULT_CC_COST;
                  return (
                    <button key={b.id} onClick={() => handleBankClick(b)}
                      className={`text-left p-5 bg-card rounded-2xl border transition-all group ${unlocked ? "border-border hover:border-primary/40 hover:shadow-md" : "border-border hover:border-amber-400/60 hover:shadow-md"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Lock size={12} className={unlocked ? "text-emerald-500" : "text-amber-500"} />
                            <h3 className={`font-semibold transition-colors ${unlocked ? "text-foreground group-hover:text-primary" : "text-foreground/80"}`}>{b.name}</h3>
                          </div>
                          {b.description && <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>}
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            {b.difficulty && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[b.difficulty] || ""}`}>{b.difficulty}</span>}
                            <span className="text-xs text-muted-foreground">{questionCounts[b.id] ?? b.question_count ?? 0} questions</span>
                            {!unlocked && <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">⚡ {cost} CC to unlock</span>}
                            {unlocked && <span className="text-xs text-emerald-600 font-medium">✓ Unlocked</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1 flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
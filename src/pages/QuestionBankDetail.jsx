import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import QuestionCard from "../components/QuestionCard";
import { ArrowLeft, Play, Lock, BookOpen, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import QuestionContributionPanel from "../components/QuestionContributionPanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function QuestionBankDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [bank, setBank] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.QuestionBank.filter({ id }),
      base44.entities.MockExam.filter({ question_bank_id: id, is_active: true }),
    ]).then(async ([banks, ex]) => {
      const bank = banks[0];
      setBank(bank);
      setExams(ex);
      if (!bank?.is_premium || (bank?.cc_unlock_cost || 0) === 0) setUnlocked(true);

      // Fetch questions by real ID AND by bank name (in case they were imported using name as key)
      const [byId, byName] = await Promise.all([
        base44.entities.Question.filter({ question_bank_id: id, status: "approved" }),
        bank?.name ? base44.entities.Question.filter({ question_bank_id: bank.name, status: "approved" }) : Promise.resolve([]),
      ]);
      // Merge and deduplicate
      const merged = [...byId];
      const existingIds = new Set(byId.map(q => q.id));
      byName.forEach(q => { if (!existingIds.has(q.id)) merged.push(q); });
      setQuestions(merged);
      setLoading(false);
    });
  }, [id]);

  const handleUnlock = async () => {
    if (!user || (user.cc_balance || 0) < bank.cc_unlock_cost) {
      toast({ title: "Insufficient CC", description: `You need ${bank.cc_unlock_cost} CC to unlock this bank.`, variant: "destructive" });
      return;
    }
    await base44.auth.updateMe({ cc_balance: (user.cc_balance || 0) - bank.cc_unlock_cost });
    await base44.entities.CreditTransaction.create({
      user_email: user.email, type: "spend", amount: bank.cc_unlock_cost,
      reason: `Unlocked question bank: ${bank.name}`, reason_key: "unlock_bank", reference_id: id,
    });
    setUnlocked(true);
    toast({ title: "Bank Unlocked! 🔓", description: "You can now access all questions in this bank." });
  };

  const handleStartExam = (exam) => {
    navigate(`/exam/${exam.id}`);
  };

  const handleStartPractice = async () => {
    // Create a temporary mock exam on the fly
    const exam = await base44.entities.MockExam.create({
      title: `${bank.name} — Practice`,
      question_bank_id: id,
      question_count: Math.min(questions.length, 60),
      time_limit_minutes: 90,
      pass_score: 65,
      cc_cost: 0,
      is_active: true,
    });
    navigate(`/exam/${exam.id}`);
  };

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
      <div className="h-32 bg-muted rounded-2xl animate-pulse" />
    </div>
  );

  if (!bank) return <div className="p-6 text-center text-muted-foreground">Bank not found.</div>;

  // Shuffle questions and randomize option order per render
  const previewQuestions = (() => {
    const shuffled = unlocked ? [...questions] : [...questions.slice(0, 3)];
    return shuffled.map(q => ({
      ...q,
      options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : q.options,
    }));
  })();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {bank.is_premium && <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">Premium</span>}
              {bank.difficulty && <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-full font-medium capitalize">{bank.difficulty}</span>}
            </div>
            <h1 className="font-sora text-2xl font-bold text-foreground">{bank.name}</h1>
            {bank.description && <p className="text-muted-foreground mt-2">{bank.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold font-sora text-foreground">{questions.length}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
          </div>
        </div>

        {/* Practice / Exam buttons */}
        <div className="mt-5 pt-5 border-t border-border flex flex-wrap gap-3 items-start">
          {exams.length > 0 ? (
            exams.map(exam => (
              <div key={exam.id} className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{exam.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen size={11} /> {exam.question_count}Q</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> {exam.time_limit_minutes}min</span>
                    {exam.cc_cost > 0 && <span className="text-xs text-amber-600 font-medium">⚡ {exam.cc_cost} CC</span>}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleStartExam(exam)} className="ml-auto gap-1.5">
                  <Play size={13} /> Start
                </Button>
              </div>
            ))
          ) : null}
          {questions.length > 0 && (
            <Button onClick={handleStartPractice} className="gap-2" disabled={!unlocked && bank.is_premium}>
              <Zap size={15} /> Start Practice Exam
            </Button>
          )}
        </div>
      </div>

      {/* Lock Gate */}
      {bank.is_premium && !unlocked && (
        <div className="bg-card rounded-2xl border border-amber-200 p-6 text-center">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground text-lg">Premium Question Bank</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Unlock all {questions.length} questions in this bank for just {bank.cc_unlock_cost} CC.
            Your balance: <span className="font-semibold text-accent">{user?.cc_balance || 0} CC</span>
          </p>
          <Button onClick={handleUnlock} className="gap-2">
            <span>⚡</span> Unlock for {bank.cc_unlock_cost} CC
          </Button>
        </div>
      )}

      {/* Questions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Questions {!unlocked && bank.is_premium && "(Preview — first 3)"}</h2>
          {unlocked && <span className="text-sm text-muted-foreground">{questions.length} approved questions</span>}
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No approved questions yet. Be the first to contribute!</p>
            <Link to="/contribute"><Button variant="link" className="mt-2 text-primary">Contribute a Question →</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {previewQuestions.map((q, i) => (
              <div key={q.id} className="bg-card rounded-2xl border border-border p-4">
                <QuestionCard question={q} index={i} showAnswer={expandedQ === q.id} />
                <button onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                  className="w-full mt-1 text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1 transition-colors">
                  {expandedQ === q.id ? <><ChevronUp size={12} /> Hide answer</> : <><ChevronDown size={12} /> Show answer & explanation</>}
                </button>
                <QuestionContributionPanel questionId={q.id} bankId={id} />
              </div>
            ))}
            {!unlocked && bank.is_premium && questions.length > 3 && (
              <div className="text-center py-6 bg-muted/30 rounded-2xl border border-dashed border-border text-muted-foreground">
                <Lock size={20} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{questions.length - 3} more questions locked. Unlock to access all.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
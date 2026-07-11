import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import ExamTimer from "../components/ExamTimer";
import { Flag, ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [flagged, setFlagged] = useState(new Set());
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      const exams = await base44.entities.MockExam.filter({ id });
      if (!exams[0]) { navigate("/browse"); return; }
      const e = exams[0];
      setExam(e);

      // Fetch questions from the bank
      const qs = await base44.entities.Question.filter({ question_bank_id: e.question_bank_id, status: "approved" });
      // Shuffle and take required count
      const shuffled = qs.sort(() => Math.random() - 0.5).slice(0, e.question_count || 60);
      setQuestions(shuffled);

      // Create attempt record
      const attempt = await base44.entities.ExamAttempt.create({
        user_email: user.email, mock_exam_id: id,
        question_bank_id: e.question_bank_id, status: "in_progress",
      });
      setAttemptId(attempt.id);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    const answersArr = questions.map(q => {
      const selectedIdx = answers[q.id];
      const isCorrect = selectedIdx !== undefined && q.options[selectedIdx]?.is_correct;
      return { question_id: q.id, selected_option_index: selectedIdx ?? -1, is_correct: !!isCorrect };
    });

    const correct = answersArr.filter(a => a.is_correct).length;
    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= (exam?.pass_score || 65);

    await base44.entities.ExamAttempt.update(attemptId, {
      answers: answersArr, score_percent: score, correct_count: correct,
      total_count: total, time_taken_seconds: timeTaken, status: "completed", passed,
    });

    // Award CC + update user
    const newExams = (user.total_exams_taken || 0) + 1;
    const newBest = Math.max(user.best_score || 0, score);
    await base44.auth.updateMe({ total_exams_taken: newExams, best_score: newBest, cc_balance: (user.cc_balance || 0) + 2 });
    await base44.entities.CreditTransaction.create({
      user_email: user.email, type: "earn", amount: 2, reason: "Completed mock exam", reason_key: "exam_completed", reference_id: id,
    });

    navigate(`/exam-results/${attemptId}`);
  }, [submitting, answers, questions, exam, attemptId, startTime]);

  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const unanswered = questions.length - answered;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-foreground text-sm">{exam?.title}</h1>
          <p className="text-xs text-muted-foreground">{answered}/{questions.length} answered</p>
        </div>
        <div className="flex items-center gap-3">
          {exam?.time_limit_minutes > 0 && (
            <ExamTimer totalSeconds={exam.time_limit_minutes * 60} onTimeUp={handleSubmit} />
          )}
          <Button size="sm" variant="destructive" onClick={() => {
            if (unanswered > 0) {
              if (!window.confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) return;
            }
            handleSubmit();
          }} disabled={submitting}>
            Submit Exam
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Question Area */}
        <div className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
            </div>

            {/* Question */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Question {current + 1} of {questions.length}</span>
                <button onClick={() => setFlagged(f => { const n = new Set(f); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${flagged.has(q.id) ? "text-amber-600 border-amber-300 bg-amber-50" : "text-muted-foreground border-border hover:border-amber-300"}`}>
                  <Flag size={12} /> {flagged.has(q.id) ? "Flagged" : "Flag"}
                </button>
              </div>

              <p className="text-foreground font-medium leading-relaxed text-base">{q?.question_text}</p>

              <div className="space-y-2.5">
                {q?.options?.map((opt, idx) => {
                  const selected = answers[q.id] === idx;
                  return (
                    <button key={idx} onClick={() => setAnswers(a => ({ ...a, [q.id]: idx }))}
                      className={`w-full text-left px-4 py-3.5 rounded-xl text-sm border transition-all flex items-center gap-3 ${
                        selected ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
                      }`}>
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${selected ? "border-primary bg-primary text-white" : "border-current/30"}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pb-8">
              <Button variant="outline" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                <ChevronLeft size={16} className="mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {answers[q?.id] !== undefined ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={14} /> Answered</span> : <span className="text-amber-500 flex items-center gap-1"><AlertCircle size={14} /> Unanswered</span>}
              </span>
              <Button variant="outline" onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>
                Next <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Question Map */}
        <div className="hidden lg:block w-52 border-l border-border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Question Navigator</p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                  i === current ? "bg-primary text-white" :
                  answers[q.id] !== undefined ? "bg-emerald-100 text-emerald-700" :
                  flagged.has(q.id) ? "bg-amber-100 text-amber-700" :
                  "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> Answered</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-100 inline-block" /> Flagged</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-muted inline-block" /> Not visited</div>
          </div>
        </div>
      </div>
    </div>
  );
}
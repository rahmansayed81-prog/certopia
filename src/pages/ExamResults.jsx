import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import QuestionCard from "../components/QuestionCard";
import { Trophy, CheckCircle, XCircle, Clock, ArrowLeft, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExamResults() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [expandedQ, setExpandedQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const attempts = await base44.entities.ExamAttempt.filter({ id });
      if (!attempts[0]) return;
      const a = attempts[0];
      setAttempt(a);

      const [exams, qs] = await Promise.all([
        base44.entities.MockExam.filter({ id: a.mock_exam_id }),
        Promise.all((a.answers || []).map(ans => base44.entities.Question.filter({ id: ans.question_id }).then(r => r[0]))),
      ]);
      setExam(exams[0]);
      setQuestions(qs.filter(Boolean));
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!attempt) return <div className="p-6 text-center text-muted-foreground">Results not found.</div>;

  const score = attempt.score_percent || 0;
  const passed = attempt.passed;
  const mins = Math.floor((attempt.time_taken_seconds || 0) / 60);
  const secs = (attempt.time_taken_seconds || 0) % 60;

  const filteredAnswers = (attempt.answers || []).filter(a => {
    if (filter === "correct") return a.is_correct;
    if (filter === "incorrect") return !a.is_correct;
    return true;
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link to="/browse" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft size={16} /> Back to Browse
      </Link>

      {/* Score Card */}
      <div className={`rounded-2xl p-8 text-center border ${passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? "bg-emerald-100" : "bg-red-100"}`}>
          {passed ? <Trophy className="w-10 h-10 text-emerald-600" /> : <XCircle className="w-10 h-10 text-red-500" />}
        </div>
        <h1 className="font-sora text-4xl font-bold mb-1" style={{ color: passed ? "#059669" : "#dc2626" }}>{score.toFixed(0)}%</h1>
        <p className={`text-lg font-semibold ${passed ? "text-emerald-700" : "text-red-600"}`}>
          {passed ? "🎉 Passed!" : "Not Passed"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{exam?.title}</p>

        <div className="flex items-center justify-center gap-8 mt-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground font-sora">{attempt.correct_count}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground font-sora">{(attempt.total_count || 0) - (attempt.correct_count || 0)}</p>
            <p className="text-xs text-muted-foreground">Incorrect</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground font-sora">{mins}:{String(secs).padStart(2, "0")}</p>
            <p className="text-xs text-muted-foreground">Time taken</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground font-sora">{exam?.pass_score || 65}%</p>
            <p className="text-xs text-muted-foreground">Pass mark</p>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Your score</span><span>{score.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${passed ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${score}%` }} />
        </div>
        <div className="flex justify-end mt-1">
          <span className="text-xs text-muted-foreground">Pass mark: {exam?.pass_score || 65}%</span>
        </div>
      </div>

      {/* Question Review */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-foreground">Question Review</h2>
          <div className="flex gap-2">
            {["all", "correct", "incorrect"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${filter === f ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredAnswers.map((ans, i) => {
            const q = questions.find(q => q?.id === ans.question_id);
            if (!q) return null;
            return (
              <div key={i}>
                <div className={`flex items-center gap-2 mb-2 px-2`}>
                  {ans.is_correct ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-red-500" />}
                  <span className={`text-xs font-medium ${ans.is_correct ? "text-emerald-600" : "text-red-500"}`}>
                    {ans.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
                <QuestionCard question={q} showAnswer={expandedQ === ans.question_id} selectedOption={ans.selected_option_index} index={i} />
                <button onClick={() => setExpandedQ(expandedQ === ans.question_id ? null : ans.question_id)}
                  className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1 mt-1">
                  {expandedQ === ans.question_id ? <><ChevronUp size={12} /> Hide explanation</> : <><ChevronDown size={12} /> Show explanation</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 justify-center pt-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          <RotateCcw size={14} className="mr-2" /> Take Again
        </Button>
        <Link to="/browse"><Button>Browse More Exams</Button></Link>
      </div>
    </div>
  );
}
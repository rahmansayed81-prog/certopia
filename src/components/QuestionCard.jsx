import { CheckCircle, XCircle, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const difficultyColors = {
  associate: "bg-emerald-100 text-emerald-700",
  professional: "bg-blue-100 text-blue-700",
  expert: "bg-purple-100 text-purple-700",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  ai_verified: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function QuestionCard({ question, showAnswer = false, showStatus = false, selectedOption = null, onSelectOption, index }) {
  const correctIndex = question.options?.findIndex(o => o.is_correct);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {index !== undefined && (
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
              {index + 1}
            </span>
          )}
          <p className="text-foreground font-medium leading-relaxed">{question.question_text}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {question.difficulty && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[question.difficulty] || ""}`}>
              {question.difficulty}
            </span>
          )}
          {showStatus && question.status && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[question.status] || ""}`}>
              {question.status.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {question.options?.map((option, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = idx === correctIndex;
          let optionClass = "border border-border bg-muted/50 text-foreground/80";

          if (showAnswer) {
            if (isCorrect) optionClass = "border border-emerald-300 bg-emerald-50 text-emerald-800 font-medium";
            else if (isSelected && !isCorrect) optionClass = "border border-red-300 bg-red-50 text-red-800";
          } else if (isSelected) {
            optionClass = "border border-primary bg-primary/10 text-primary font-medium";
          }

          return (
            <button
              key={idx}
              onClick={() => onSelectOption?.(idx)}
              disabled={showAnswer}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-150 flex items-center gap-3 ${optionClass} ${!showAnswer && !isSelected ? "hover:border-primary/40 hover:bg-primary/5" : ""} ${onSelectOption && !showAnswer ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className="w-5 h-5 rounded-full border-2 border-current/30 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1">{option.text}</span>
              {showAnswer && isCorrect && <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />}
              {showAnswer && isSelected && !isCorrect && <XCircle size={16} className="text-red-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {showAnswer && question.explanation && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-600 mb-1">Explanation</p>
          <p className="text-sm text-blue-800">{question.explanation}</p>
          {question.source_url && (
            <a href={question.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-2 underline">
              Official Source <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

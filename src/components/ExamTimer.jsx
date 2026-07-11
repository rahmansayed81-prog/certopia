import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

export default function ExamTimer({ totalSeconds, onTimeUp }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (remaining <= 0) { onTimeUp?.(); return; }
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (remaining / totalSeconds) * 100;
  const isWarning = remaining < 300; // < 5 min
  const isCritical = remaining < 60;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono ${
      isCritical ? "bg-red-50 border-red-200 text-red-700" :
      isWarning ? "bg-amber-50 border-amber-200 text-amber-700" :
      "bg-card border-border text-foreground"
    }`}>
      {isWarning ? <AlertTriangle size={16} /> : <Clock size={16} />}
      <span className="text-lg font-bold">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}

import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Trophy, Zap, Star, Medal } from "lucide-react";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { user } = useAuth();
  const [contributors, setContributors] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [tab, setTab] = useState("contributors");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.User.list("-total_questions_approved", 20),
      base44.entities.User.list("-best_score", 20),
    ]).then(([c, s]) => {
      setContributors(c.filter(u => (u.total_questions_approved || 0) > 0));
      setScorers(s.filter(u => (u.best_score || 0) > 0));
      setLoading(false);
    });
  }, []);

  const list = tab === "contributors" ? contributors : scorers;

  const getValue = (u) => tab === "contributors"
    ? `${u.total_questions_approved || 0} approved`
    : `${u.best_score || 0}% best score`;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" /> Leaderboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Recognizing top contributors and performers on Certopia.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        {[["contributors", "Top Contributors"], ["scorers", "Top Scorers"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(10)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No data yet. Be the first to make it on the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((u, i) => {
            const isMe = u.email === user?.email;
            return (
              <div key={u.id} className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${isMe ? "bg-primary/5 border-primary/30" : "bg-card border-border"} ${i < 3 ? "shadow-sm" : ""}`}>
                <div className="w-8 text-center flex-shrink-0">
                  {i < 3 ? <span className="text-xl">{medals[i]}</span> : <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isMe ? "bg-primary text-white" : "bg-secondary text-secondary-foreground"}`}>
                  {u.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {u.full_name || "Anonymous"} {isMe && <span className="text-xs text-primary font-normal">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{getValue(u)}</p>
                </div>
                <div className="flex items-center gap-1 text-accent font-bold text-sm">
                  <span>⚡</span>
                  <span>{u.cc_balance || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
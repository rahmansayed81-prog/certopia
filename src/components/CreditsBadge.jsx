export default function CreditsBadge({ balance = 0, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/15 border border-accent/30">
        <span className="text-accent text-sm">⚡</span>
        <span className="text-xs font-bold text-accent">{balance}</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
      <div className="flex items-center justify-between">
        <span className="text-xs text-sidebar-foreground/60 font-medium">Certopia Credits</span>
        <span className="text-accent text-base">⚡</span>
      </div>
      <p className="text-xl font-bold text-accent mt-0.5">{balance.toLocaleString()} CC</p>
    </div>
  );
}

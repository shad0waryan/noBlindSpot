// ── Spinner ───────────────────────────────────
export const Spinner = ({ size = "md" }) => {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <div className={`${sizes[size]} border-2 border-brand-500 border-t-transparent rounded-full animate-spin`} />
  );
};

// ── Alert ─────────────────────────────────────
export const Alert = ({ type = "error", message }) => {
  if (!message) return null;
  const styles = {
    error:   "bg-red-500/10 border-red-500/30 text-red-400",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    info:    "bg-brand-500/10 border-brand-500/30 text-brand-300",
  };
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm font-body ${styles[type]}`}>
      {message}
    </div>
  );
};

// ── Progress Bar ──────────────────────────────
export const ProgressBar = ({ known = 0, partial = 0, total = 1 }) => {
  const knownPct   = Math.round((known / total) * 100);
  const partialPct = Math.round((partial / total) * 100);
  const unknownPct = 100 - knownPct - partialPct;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-800 gap-0.5">
        {knownPct > 0 && (
          <div className="bg-emerald-500 transition-all duration-500 rounded-l-full" style={{ width: `${knownPct}%` }} />
        )}
        {partialPct > 0 && (
          <div className="bg-amber-500 transition-all duration-500" style={{ width: `${partialPct}%` }} />
        )}
        {unknownPct > 0 && (
          <div className="bg-slate-700 transition-all duration-500 rounded-r-full" style={{ width: `${unknownPct}%` }} />
        )}
      </div>
      <div className="flex gap-4 text-xs font-body text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          {knownPct}% known
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          {partialPct}% partial
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
          {unknownPct}% unknown
        </span>
      </div>
    </div>
  );
};

// ── Status Badge ──────────────────────────────
export const StatusBadge = ({ status }) => {
  const styles = {
    unknown: "badge-unknown",
    partial: "badge-partial",
    known:   "badge-known",
  };
  const labels = { unknown: "Unknown", partial: "Partial", known: "Known" };
  return (
    <span className={`text-xs font-display font-medium px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// ── Empty State ───────────────────────────────
export const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-display font-semibold text-white text-lg mb-2">{title}</h3>
    <p className="text-slate-400 font-body text-sm max-w-xs mb-6">{description}</p>
    {action}
  </div>
);

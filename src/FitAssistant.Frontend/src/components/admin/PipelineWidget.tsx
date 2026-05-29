import React, { useEffect, useRef, useState } from 'react';
import { getPipelineStats, type PipelineStats, type PipelineEvent } from '../../api';
import { useToast } from '../../hooks/useToast';
import './PipelineWidget.css';

/** Pipeline event kinds that earn a toast. Every kind the backend currently
 *  emits is surfaced; if a noisier source is added later, exclude it here. */
const TOAST_KINDS = new Set([
  'feed.deliver',
  'goal.progress',
  'achievement.unlock',
  'olap.write',
]);

/**
 * Floating bottom-right HUD that polls /api/admin/pipeline-stats every 3 s.
 * Two surfaces:
 *  - Chip: rolling counts (consumed · DuckDB rows) + an in-flight badge.
 *  - Components panel (on click): one row per architecture piece with a
 *    health dot and counter.
 *
 * New backend events surface as ordinary toasts (see TOAST_KINDS) rather
 * than living inside the widget — the toast stream IS the event log.
 */
interface PipelineWidgetProps {
  /** Used to resolve "4-A" tokens in event summaries to first names. */
  users?: { id: string; name: string }[];
}

export const PipelineWidget: React.FC<PipelineWidgetProps> = ({ users = [] }) => {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [open, setOpen]   = useState(false);
  const [hidden, setHidden] = useState(false);
  const [flash, setFlash] = useState(false);
  const lastEventRef = useRef<string | null>(null);
  const firstLoadRef = useRef(true);
  const toast = useToast();

  // id → first name. Both "4-A" (suffix) and "UserProfiles/4-A" map to the
  // same name so we can swap whichever shape the backend embedded.
  const nameByToken = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) {
      const first = u.name.split(' ')[0];
      const suffix = u.id.includes('/') ? u.id.slice(u.id.indexOf('/') + 1) : u.id;
      m.set(suffix, first);
      m.set(`UserProfiles/${suffix}`, first);
    }
    return m;
  }, [users]);

  // `toast` from useToast() is stable across renders (provider-bound), but
  // ESLint can't see that — capture into a ref so the polling effect doesn't
  // need it in its deps (would otherwise re-arm the interval on every render).
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const nameByTokenRef = useRef(nameByToken);
  nameByTokenRef.current = nameByToken;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getPipelineStats();
        if (cancelled) return;
        const newest = s.recent[0]?.at ?? null;
        if (newest && newest !== lastEventRef.current) {
          if (!firstLoadRef.current) {
            // Surface every NEW event of an interesting kind as a toast.
            // Newer-than-lastSeen window means a burst between polls fans
            // out into several toasts in arrival order (oldest first so the
            // stack reads top-to-bottom newest).
            const lastSeen = lastEventRef.current;
            const fresh = lastSeen
              ? s.recent.filter(e => e.at > lastSeen)
              : s.recent.slice(0, 1);
            fresh
              .filter(e => TOAST_KINDS.has(e.kind))
              .reverse()
              .forEach(e => {
                // Fan-out shape ("actor -> recipient | tail") reads as a
                // FEED delivery regardless of the underlying event kind —
                // it's the moment one user's activity reached another
                // user's feed because that other user follows them.
                const isFanout = /^(\S+)\s*->\s*(\S+)\s*\|/.test(e.summary);
                toastRef.current.show({
                  tone: toneFor(e.kind),
                  icon: isFanout ? '📨' : iconFor(e.kind),
                  kind: isFanout ? 'feed' : kindLabel(e.kind),
                  source: 'system',
                  message: formatSummary(e, nameByTokenRef.current),
                });
              });
            setFlash(true);
            window.setTimeout(() => setFlash(false), 1500);
          }
          lastEventRef.current = newest;
        }
        firstLoadRef.current = false;
        setStats(s);
      } catch { /* keep last good state on transient failures */ }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  if (hidden) {
    return (
      <button
        type="button"
        className="pipeline-widget pipeline-widget--hidden"
        title="Show pipeline HUD"
        onClick={() => setHidden(false)}
      >⚙︎</button>
    );
  }

  const inFlight = stats ? Math.max(0, stats.queueEtl.published - stats.queueEtl.consumed) : 0;

  return (
    <div className={`pipeline-widget ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`pipeline-widget__chip ${flash ? 'is-flashing' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="pipeline-widget__dot" aria-hidden="true" />
        <span className="pipeline-widget__chip-label">System status</span>
        {stats && (
          <>
            <span className="pipeline-widget__chip-stat">{stats.queueEtl.consumed}</span>
            <span className="pipeline-widget__chip-sep">·</span>
            <span className="pipeline-widget__chip-stat">{stats.duckdb.rowCount}</span>
            {inFlight > 0 && (
              <span className="pipeline-widget__inflight" title={`${inFlight} message(s) in flight`}>+{inFlight}</span>
            )}
          </>
        )}
      </button>

      {open && stats && (
        <div className="pipeline-widget__panel" role="region" aria-label="Pipeline live state">
          <Components stats={stats} inFlight={inFlight} />
          <div className="pipeline-widget__foot">
            <button type="button" className="pipeline-widget__hide" onClick={() => setHidden(true)} title="Hide HUD">
              Hide
            </button>
            <span className="pipeline-widget__gen">live · polls every 3 s</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Architecture as a vertical list. One row per component:
 *   ● Name              status text                count
 * Status dot colour signals health (warm = active, cold = idle, busy =
 * messages in flight). Order roughly follows pipeline flow.
 */
const Components: React.FC<{ stats: PipelineStats; inFlight: number }> = ({ stats, inFlight }) => {
  // Stat strings are self-describing — "32" means nothing on its own; "32
  // sessions" or "+3 in flight" reads at a glance. Full status text moves
  // to the row's `title` attribute for hover.
  const rows: ComponentRow[] = [
    { name: 'RavenDB',     tone: 'warm',
                           status: 'ExerciseSessions collection',
                           stat:   `${stats.olapEtl.writes} sessions` },
    { name: 'Queue ETL',   tone: stats.queueEtl.published > 0 ? 'warm' : 'cold',
                           status: `activity-feed-etl · ${stats.queueEtl.transforms} transforms · ${stats.queueEtl.published} published`,
                           stat:   `${stats.queueEtl.published} published` },
    { name: 'RabbitMQ',    tone: inFlight > 0 ? 'busy' : (stats.queueEtl.consumed > 0 ? 'warm' : 'cold'),
                           status: `activity_feed queue · ${inFlight > 0 ? `${inFlight} in flight` : 'drained'}`,
                           stat:   inFlight > 0 ? `+${inFlight} in flight` : 'drained' },
    { name: 'FitFeed',     tone: stats.queueEtl.consumed > 0 ? 'warm' : 'cold',
                           status: 'consumer + in-process read model',
                           stat:   `${stats.queueEtl.consumed} delivered` },
    { name: 'OLAP ETL',    tone: stats.olapEtl.writes > 0 ? 'warm' : 'cold',
                           status: 'trends-olap-etl · writes Parquet to MinIO',
                           stat:   `${stats.olapEtl.writes} flushes` },
    { name: 'MinIO',       tone: stats.minio.parquetFiles > 0 ? 'warm' : 'cold',
                           status: `bucket ${stats.minio.bucket} · ${formatBytes(stats.minio.totalBytes)}`,
                           stat:   `${stats.minio.parquetFiles} parquet` },
    { name: 'DuckDB',      tone: stats.duckdb.rowCount > 0 ? 'warm' : 'cold',
                           status: stats.duckdb.ready ? 'embedded · httpfs over MinIO' : 'not ready',
                           stat:   `${stats.duckdb.rowCount} rows · ${stats.duckdb.queryCount} q` },
  ];

  return (
    <section className="pw-components">
      <h4 className="pw-components__head">Components</h4>
      <ul className="pw-components__list">
        {rows.map(r => (
          <li key={r.name} className={`pw-component pw-component--${r.tone}`} title={r.status}>
            <span className="pw-component__dot" aria-hidden="true" />
            <span className="pw-component__name">{r.name}</span>
            <span className="pw-component__count">{r.stat}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

type ComponentRow = {
  name:   string;
  tone:   'cold' | 'warm' | 'busy';
  status: string; // full description, surfaced on hover via the row's title attr
  stat:   string; // visible compact stat — must be self-describing on its own
};

function kindLabel(kind: string): string {
  if (kind === 'feed.deliver')       return 'feed';
  if (kind === 'achievement.unlock') return 'trophy';
  if (kind === 'goal.progress')      return 'goal';
  if (kind === 'olap.write')         return 'write';
  return kind;
}

function toneFor(kind: string): 'success' | 'info' {
  // Achievement + goal wins read as positive milestones; everything else is
  // just the pipeline doing its job.
  return kind === 'achievement.unlock' || kind === 'goal.progress' ? 'success' : 'info';
}

/** Per-kind emoji rendered as the toast's leading icon. Picked to depict
 *  the kind of pipeline activity at a glance. */
function iconFor(kind: string): string {
  switch (kind) {
    case 'feed.deliver':       return '📨';
    case 'achievement.unlock': return '🏆';
    case 'goal.progress':      return '🎯';
    case 'olap.write':         return '📊';
    default:                   return 'ℹ';
  }
}

/**
 * The pipeline event summaries carry raw stripped user ids ("4-A") and
 * sometimes inline goal text. The HUD is narrow — rewrite for display
 * (full original text stays in the row's title attr for debugging):
 *   - swap any "X-A" / "UserProfiles/X-A" token to the user's first name
 *   - drop the inline goal quote and the "(fanned to N friend(s))" suffix
 *     for goal-fulfillment events — they push the line past the column
 *
 * Underlying events stay untouched per the rule "present differently in
 * this widget" — backend wire format is the contract for other consumers.
 */
function formatSummary(e: PipelineEvent, nameByToken: Map<string, string>): string {
  // Resolve "4-A" / "UserProfiles/4-A" tokens to first names.
  const swap = (s: string) => s.replace(/(?:UserProfiles\/)?(\d+-[A-Z])/g, (m, tok) => nameByToken.get(tok) ?? nameByToken.get(m) ?? m);

  // Fan-out shape ("actor -> recipient | tail") covers both feed.deliver
  // and per-friend goal.progress events. Phrase them as "X's <thing>
  // delivered to Y's feed (Y follows X)" so the audience grasps why the
  // event fired without knowing the underlying event-kind semantics.
  const fanned = e.summary.match(/^(\S+)\s*->\s*(\S+)\s*\|\s*(.*)$/);
  if (fanned) {
    const actor = nameByToken.get(fanned[1]) ?? fanned[1];
    const recipient = nameByToken.get(fanned[2]) ?? fanned[2];
    let tail: string;
    if (fanned[3].startsWith('goals:')) {
      const counts = fanned[3].slice('goals:'.length).trim();
      tail = `goal progress (${counts})`;
    } else {
      tail = fanned[3].replace('/', '·');
    }
    return `${actor}'s ${tail} → ${recipient}'s feed (follows ${actor})`;
  }

  // Backend goal-progress (one per DailyGoals mutation, before fan-out):
  //   "1-A hit 2/3 goals (fanned to N friend(s))"
  if (e.kind === 'goal.progress') {
    const actor = e.summary.match(/^(\S+)/)?.[1] ?? '';
    const counts = e.summary.match(/hit (\d+\/\d+) goals/)?.[1] ?? '';
    return counts
      ? `${nameByToken.get(actor) ?? actor} hit ${counts} daily goals`
      : `${nameByToken.get(actor) ?? actor} hit a daily goal`;
  }

  // Fallback — universal token swap for anything else that mentions an id.
  return swap(e.summary);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import React, { useEffect, useMemo, useState } from 'react';
import { FeatureBadge } from '../common/FeatureBadge';
import { getLiveWorkouts, liveWorkoutsStreamUrl, LiveWorkout } from '../../api';
import './LiveWorkouts.css';

interface LiveWorkoutsProps {
  refreshKey?: number;
  /** Current user (suffix or full) — filtered out so "others" really means others. */
  currentUserId?: string | null;
}

function suffix(id: string): string {
  return id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;
}

function liveFor(isoStart: string): string {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(isoStart)) / 60_000));
  if (m < 1) return 'just started';
  if (m < 60) return `live · ${m}m`;
  return `live · ${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Live "others training right now" strip backed by the RavenDB Changes API.
 * Snapshot fetch on mount + EventSource on /api/live/workouts/stream;
 * `started` adds a row, `completed` removes it. LIVE = `endTime is null`.
 */
export const LiveWorkouts: React.FC<LiveWorkoutsProps> = ({ refreshKey = 0, currentUserId }) => {
  const [rows, setRows] = useState<Map<string, LiveWorkout>>(new Map());
  const [snapshotError, setSnapshotError] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    getLiveWorkouts()
      .then((r) => {
        if (!alive) return;
        setRows(new Map(r.items.map((item) => [item.session.id, item])));
        setSnapshotError(false);
      })
      .catch(() => { if (alive) setSnapshotError(true); });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    const url = liveWorkoutsStreamUrl();
    if (url.startsWith('data:')) return; // mock mode — skip SSE
    const es = new EventSource(url);

    es.addEventListener('hello', () => setStreamConnected(true));

    // Backend is intentionally dumb — every Put on ExerciseSession fans out.
    // "Live" = endTime null; the client converges its `rows` map to that
    // truth on each frame. If the desired state matches what's already in
    // the map (live for a known id, or completed for an unknown one), we
    // return `prev` so React skips the re-render — that's the dedup.
    es.onmessage = (raw) => {
      const evt = JSON.parse(raw.data) as LiveWorkout;
      const id = evt.session.id;
      const live = evt.session.endTime === null;
      setRows((prev) => {
        if (live === prev.has(id)) return prev;
        const next = new Map(prev);
        if (live) next.set(id, evt);
        else      next.delete(id);
        return next;
      });
    };

    es.onerror = () => setStreamConnected(false);

    return () => es.close();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const me = currentUserId ? suffix(currentUserId) : null;
  const visible = useMemo(() => {
    void tick; // re-derive every 15s so "live · Xm" labels stay current
    return Array.from(rows.values())
      .filter((r) => suffix(r.session.userProfileId) !== me)
      .sort((a, b) => Date.parse(b.session.startTime) - Date.parse(a.session.startTime));
  }, [rows, me, tick]);

  return (
    <section className="live-wo" data-phase-slot="activity-ticker" aria-label="Live workouts in progress on other users">
      <div className="live-wo__head">
        <span className="live-wo__pulse" aria-hidden="true" data-connected={streamConnected ? 'yes' : 'no'} />
        <span className="live-wo__title">Live workouts</span>
        <span className="live-wo__count" data-testid="live-workouts-count">{visible.length}</span>
        <FeatureBadge feature="changes-api" />
      </div>

      <div className="live-wo__rail" data-testid="live-workouts">
        {snapshotError && <span className="live-wo__empty">Live stream offline.</span>}
        {!snapshotError && visible.length === 0 && (
          <span className="live-wo__empty">
            No live workouts right now — kicks off the moment another user starts a session.
          </span>
        )}
        {visible.slice(0, 10).map((r) => (
          <span key={r.session.id} className="live-wo__item">
            <span className="live-wo__live-pill" aria-label="Live"><span className="live-wo__live-dot" />LIVE</span>
            <strong>{r.userName}</strong>
            {' · '}{r.session.type}
            {/* Duration is derived from (endTime − startTime). The session
                doc has no minutes field; the `live · Xm` subtitle below is
                the only elapsed signal for in-progress workouts. */}
            {r.session.caloriesBurned ? <> {' · '} {r.session.caloriesBurned} cal</> : null}
            {' · '}<span className="live-wo__when">{liveFor(r.session.startTime)}</span>
          </span>
        ))}
      </div>
    </section>
  );
};

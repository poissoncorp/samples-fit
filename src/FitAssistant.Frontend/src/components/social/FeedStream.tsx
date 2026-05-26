import React from 'react';
import { Card } from '../common/Card';
import type { FeedItem } from '../../api';

interface FeedStreamProps {
  items: FeedItem[];
  /** userId → display name. Workout items render the actor's name when known. */
  nameLookup: Map<string, string>;
}

/** Vertical stream of feed cards. Workouts on top of any achievement runs. */
export const FeedStream: React.FC<FeedStreamProps> = ({ items, nameLookup }) => {
  if (items.length === 0) {
    return (
      <Card>
        <p className="social-tab__empty">
          Your feed is quiet. Log a workout — if you have friends in the seed
          graph, theirs will start showing up here in real time.
        </p>
      </Card>
    );
  }

  return (
    <div className="feed-stream" aria-label="Activity feed">
      {items.map(item => (
        <FeedCard key={item.id} item={item} nameLookup={nameLookup} />
      ))}
    </div>
  );
};

const FeedCard: React.FC<{ item: FeedItem; nameLookup: Map<string, string> }> = ({ item, nameLookup }) => {
  const when = formatRelative(item.createdAt);

  if (item.kind === 'achievement') {
    return (
      <Card className="feed-card feed-card--achievement">
        <div className="feed-card__icon" aria-hidden="true">{item.icon ?? '🏆'}</div>
        <div className="feed-card__body">
          <div className="feed-card__title">{item.title ?? 'Achievement'}</div>
          <div className="feed-card__detail">{item.detail}</div>
          <div className="feed-card__meta">{when}</div>
        </div>
      </Card>
    );
  }

  if (item.kind === 'goal') {
    const actor = (item.actorUserId && nameLookup.get(item.actorUserId)) ?? 'A friend';
    return (
      <Card className="feed-card feed-card--goal">
        <div className="feed-card__icon" aria-hidden="true">🎯</div>
        <div className="feed-card__body">
          <div className="feed-card__title">{actor} hit a daily goal.</div>
          {item.detail && <div className="feed-card__detail">“{item.detail}”</div>}
          <div className="feed-card__meta">{when}</div>
        </div>
      </Card>
    );
  }

  const actorName = (item.actorUserId && nameLookup.get(item.actorUserId)) ?? 'A friend';
  return (
    <Card className="feed-card feed-card--workout">
      <div className="feed-card__icon" aria-hidden="true">💪</div>
      <div className="feed-card__body">
        <div className="feed-card__title">
          {actorName} logged a {item.exerciseType ?? 'workout'}.
        </div>
        <div className="feed-card__detail">
          {item.durationMinutes ? `${item.durationMinutes} min` : ''}
          {item.caloriesBurned ? ` · ${item.caloriesBurned} kcal` : ''}
        </div>
        <div className="feed-card__meta">{when}</div>
      </div>
    </Card>
  );
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60)   return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60)   return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24)    return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

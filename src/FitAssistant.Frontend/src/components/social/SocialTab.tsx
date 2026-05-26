import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  getFeed, getAchievements, getFriends, streamFeed,
  type FeedItem, type Achievements, type FriendSummary,
} from '../../api';
import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';
import { FeatureBadge } from '../common/FeatureBadge';
import { FeedStream } from './FeedStream';
import { SuggestedFriends } from './SuggestedFriends';
import { AchievementHighlights } from './AchievementHighlights';
import './SocialTab.css';

interface SocialTabProps {
  userId: string;
  users: { id: string; name: string }[];
}

/**
 * Top-level Social tab. Three panels:
 *   1. Feed stream  — workout + achievement items, newest-first.
 *                     Initial page from GET /api/feed; live updates via SSE
 *                     from /feed/{userId}/live.
 *   2. Suggested friends sidebar — read from /api/friends/{userId}.
 *   3. Achievement highlights — current streak / level / lifetime totals.
 *
 * All three live in the FitFeed service (in-process read model) except the
 * friend graph, which is in main RavenDB. The browser hits FitFeed directly.
 */
export const SocialTab: React.FC<SocialTabProps> = ({ userId, users }) => {
  const initialFeed   = useApi(() => getFeed(userId),       [userId]);
  const achievements  = useApi(() => getAchievements(userId), [userId]);
  const friends       = useApi(() => getFriends(userId),    [userId]);

  // Live tail. Newest item lands at the head of `liveItems`; the renderer
  // merges with the initial page below, de-duplicating by id.
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    const cleanup = streamFeed(userId, (item) => {
      setLiveItems((prev) => {
        if (prev.some(p => p.id === item.id)) return prev; // dedupe
        return [item, ...prev].slice(0, 100);
      });
    });
    return cleanup;
  }, [userId]);

  // Reset live buffer when the user switches.
  useEffect(() => { setLiveItems([]); }, [userId]);

  const allItems = mergeItems(liveItems, initialFeed.data?.items ?? []);
  const nameLookup = new Map<string, string>();
  for (const u of users) nameLookup.set(u.id, u.name);

  return (
    <section className="social-tab">
      <div className="social-tab__feed-col">
        <div className="social-tab__head">
          <h2 className="social-tab__title">Social</h2>
          <div className="social-tab__badges">
            <FeatureBadge feature="queue-etl" />
          </div>
        </div>

        {achievements.data ? (
          <AchievementHighlights state={achievements.data as Achievements} />
        ) : (
          <Card><Skeleton width="100%" height="60px" /></Card>
        )}

        {initialFeed.loading && !initialFeed.data ? (
          <Card>
            <Skeleton width="100%" height="22px" />
            <div style={{ height: 8 }} />
            <Skeleton width="92%" height="22px" />
            <div style={{ height: 8 }} />
            <Skeleton width="62%" height="22px" />
          </Card>
        ) : initialFeed.error ? (
          <Card>
            <p className="social-tab__empty">
              The FitFeed service is unreachable. The feed will fill in once
              it's running and the Queue ETL has fanned out some workouts.
            </p>
          </Card>
        ) : (
          <FeedStream items={allItems} nameLookup={nameLookup} />
        )}
      </div>

      <aside className="social-tab__side">
        <SuggestedFriends
          loading={friends.loading}
          currentUserId={userId}
          friends={(friends.data?.friends ?? []) as FriendSummary[]}
          allUsers={users}
          onGraphChanged={() => { friends.reload(); initialFeed.reload(); }}
        />
      </aside>
    </section>
  );
};

/** Merge a live-tail buffer in front of the initial page, dedup by id. */
function mergeItems(live: FeedItem[], initial: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of [...live, ...initial]) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

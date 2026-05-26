import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Pill } from '../common/Pill';
import { Skeleton } from '../common/Skeleton';
import { followUser, unfollowUser, type FriendSummary } from '../../api';
import { useToast } from '../../hooks/useToast';

interface PersonOption {
  id: string;        // full doc id, e.g. UserProfiles/2-A
  name: string;
  isPremium?: boolean;
  goal?: string;
}

interface SuggestedFriendsProps {
  loading: boolean;
  /** Caller (the current user) — never appears in either list. */
  currentUserId: string;
  /** Hydrated current friend list from /api/friends/{userId}. */
  friends: FriendSummary[];
  /** Every user known to the app — used to build the follow-list. */
  allUsers: { id: string; name: string }[];
  /** Bumped when the graph changes so the feed re-fetches. */
  onGraphChanged: () => void;
}

function normalize(id: string): string {
  return id.includes('/') ? id : `UserProfiles/${id}`;
}

/** Strip the "UserProfiles/" prefix so the URL doesn't carry an encoded "/". */
function strip(id: string): string {
  return id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;
}

/**
 * Sidebar with two lists:
 *   1. Friends you follow — each has an Unfollow button.
 *   2. Other users you don't follow yet — each has a Follow button.
 * Both buttons hit the FriendsController and trigger a feed re-fetch so
 * the next exercise the followed user logs fans out to the right audience.
 */
export const SuggestedFriends: React.FC<SuggestedFriendsProps> = ({
  loading, currentUserId, friends, allUsers, onGraphChanged,
}) => {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const meFull = normalize(currentUserId);
  const friendIds = new Set(friends.map(f => f.id));

  const others: PersonOption[] = allUsers
    .map(u => ({ id: normalize(u.id), name: u.name }))
    .filter(u => u.id !== meFull && !friendIds.has(u.id));

  const doFollow = async (other: PersonOption) => {
    setBusyId(other.id);
    try {
      await followUser(strip(currentUserId), strip(other.id));
      toast.show({ tone: 'success', kind: 'social', message: `Following ${other.name}` });
      onGraphChanged();
    } catch {
      toast.show({ tone: 'error', kind: 'social', message: `Could not follow ${other.name}` });
    } finally {
      setBusyId(null);
    }
  };

  const doUnfollow = async (friend: FriendSummary) => {
    setBusyId(friend.id);
    try {
      await unfollowUser(strip(currentUserId), strip(friend.id));
      toast.show({ tone: 'success', kind: 'social', message: `Unfollowed ${friend.name}` });
      onGraphChanged();
    } catch {
      toast.show({ tone: 'error', kind: 'social', message: `Could not unfollow ${friend.name}` });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="suggested-friends">
      <h3 className="suggested-friends__title">Your friends</h3>
      {loading ? (
        <>
          <Skeleton width="100%" height="32px" />
          <div style={{ height: 6 }} />
          <Skeleton width="100%" height="32px" />
        </>
      ) : friends.length === 0 ? (
        <p className="suggested-friends__empty">No one yet — follow someone below.</p>
      ) : (
        <ul className="suggested-friends__list">
          {friends.map(f => (
            <li key={f.id} className="suggested-friends__row" data-testid={`friend-row-${f.id}`}>
              <span className="suggested-friends__name">{f.name}</span>
              <button
                type="button"
                className="suggested-friends__action suggested-friends__action--unfollow"
                disabled={busyId === f.id}
                onClick={() => doUnfollow(f)}
                data-testid={`unfollow-${f.id}`}
                aria-label={`Unfollow ${f.name}`}
              >
                Unfollow
              </button>
              <span className="suggested-friends__goal">
                {f.isPremium && <Pill tone="fallback" size="xs">Ultra</Pill>} {f.goal}
              </span>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <>
          <h3 className="suggested-friends__title" style={{ marginTop: 16 }}>Follow more</h3>
          <ul className="suggested-friends__list">
            {others.map(o => (
              <li key={o.id} className="suggested-friends__row" data-testid={`suggest-row-${o.id}`}>
                <span className="suggested-friends__name">{o.name}</span>
                <button
                  type="button"
                  className="suggested-friends__action suggested-friends__action--follow"
                  disabled={busyId === o.id}
                  onClick={() => doFollow(o)}
                  data-testid={`follow-${o.id}`}
                  aria-label={`Follow ${o.name}`}
                >
                  + Follow
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
};

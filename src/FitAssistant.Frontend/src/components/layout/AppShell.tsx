import React, { useState, useCallback } from 'react';
import { TopBar } from './TopBar';
import { UserSummary } from './UserPill';
import { KpiRibbon } from '../hero/KpiRibbon';
import { DailyGoalsCard } from '../goals/DailyGoalsCard';
import { LiveWorkouts } from '../summary/LiveWorkouts';
import { TimeSeriesPanel } from '../timeseries/TimeSeriesPanel';
import { Coach } from '../coach/Coach';
import { SocialTab } from '../social/SocialTab';
import { PipelineWidget } from '../admin/PipelineWidget';
import './AppShell.css';

type ActiveTab = 'dashboard' | 'social';

interface AppShellProps {
  users: UserSummary[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  onUserCreated: (user: UserSummary) => void;
  isMockMode: boolean;
}

/**
 * Top-level layout. All four content surfaces are live:
 *   - KPI ribbon ("glance")
 *   - AI summary ("read")
 *   - Time-series panel ("drill")
 *   - Coach panel ("ask")
 * Each surface refetches when refreshKey bumps (e.g. after a tab-local
 * "Log a meal" / "Sync wearable" action).
 */
export const AppShell: React.FC<AppShellProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  onUserCreated,
  isMockMode,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const handleLocalRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);


  return (
    <div className="app-shell">
      {/* Overlay portals — toasts mount here so they appear inside the
          sample frame (top-right) rather than escaping to the page corner.
          The pipeline widget anchors to .app-shell via position: absolute,
          so no portal needed for it. */}
      <div id="app-shell-toast-root" className="app-shell__toast-root" />

      <TopBar
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={onSelectUser}
        onUserCreated={onUserCreated}
        isMockMode={isMockMode}
      />

      {/* Top-level tabs. Dashboard = the existing four-section layout;
          Social = feed stream + achievements + suggested friends, served by
          the FitAssistant.FitFeed worker (ADR-0004). */}
      <nav className="app-shell__tabs" role="tablist" aria-label="Sections">
        <button
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          className={`app-shell__tab ${activeTab === 'dashboard' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >Dashboard</button>
        <button
          role="tab"
          aria-selected={activeTab === 'social'}
          className={`app-shell__tab ${activeTab === 'social' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('social')}
        >Social</button>
      </nav>

      <main className="app-shell__main">
        {activeTab === 'social' && selectedUserId && (
          <SocialTab userId={selectedUserId} users={users.map(u => ({ id: u.id, name: u.name }))} />
        )}

        {activeTab === 'dashboard' && selectedUserId && (
          <KpiRibbon userId={selectedUserId} refreshKey={refreshKey} />
        )}

        {activeTab === 'dashboard' && selectedUserId && (
          <DailyGoalsCard userId={selectedUserId} refreshKey={refreshKey} />
        )}

        {/* Changes-API-driven live workouts strip — sits in the Read zone,
            after the GenAI summary card, before the Drill/Ask split. Snapshot
            REST + SSE updates from /api/live/workouts(/stream). */}
        {activeTab === 'dashboard' && selectedUserId && (
          <LiveWorkouts refreshKey={refreshKey} currentUserId={selectedUserId} />
        )}

        {activeTab === 'dashboard' && (
          <section className="app-shell__split">
            {selectedUserId && (
              <div className="app-shell__timeseries-slot">
                <TimeSeriesPanel
                  userId={selectedUserId}
                  refreshKey={refreshKey}
                  onLocalRefresh={handleLocalRefresh}
                />
              </div>
            )}
            {selectedUserId && (
              <div className="app-shell__coach-slot">
                <Coach
                  userId={selectedUserId}
                  isPremium={users.find(u => u.id === selectedUserId)?.isPremium ?? false}
                  onLocalRefresh={handleLocalRefresh}
                />
              </div>
            )}
          </section>
        )}
      </main>

      {/* System-status HUD — sticky-bottom inside the sample frame, floats
          with scroll just like the toast root floats sticky-top. Polls
          /api/admin/pipeline-stats every 3 s. */}
      <PipelineWidget users={users} />
    </div>
  );
};

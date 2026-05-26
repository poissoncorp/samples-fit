import React, { useState } from 'react';
import { Card } from '../common/Card';
import { RangeChips, Range } from './RangeChips';
import { HeartRateTab } from './HeartRateTab';
import { CaloriesTab } from './CaloriesTab';
import { ActivitiesTab } from './ActivitiesTab';
import { TrendsTab } from './TrendsTab';
import { FeatureBadge, FeatureKey } from '../common/FeatureBadge';
import { TrophyShelf } from './TrophyShelf';
import { useApi } from '../../hooks/useApi';
import { getAchievements } from '../../api';
import './TimeSeriesPanel.css';

type TabKey = 'hr' | 'calories' | 'activities' | 'trends';

interface TimeSeriesPanelProps {
  userId: string;
  refreshKey: number;
  onLocalRefresh: () => void;
}

const TABS: Array<{
  key: TabKey;
  label: string;
  tone: string;
  defaultRange: Range;
  testId: string;
  features: FeatureKey[];
}> = [
  { key: 'hr',         label: 'Heart rate', tone: 'red',    defaultRange: '24h', testId: 'tab-hr',         features: ['rollups', 'retention-policy'] },
  { key: 'calories',   label: 'Calories',   tone: 'blue',   defaultRange: '7d',  testId: 'tab-calories',   features: ['map-reduce-index'] },
  { key: 'activities', label: 'Workouts',   tone: 'purple', defaultRange: '7d',  testId: 'tab-activities', features: ['genai-simple'] },
  { key: 'trends',     label: 'Trends',     tone: 'green',  defaultRange: '7d',  testId: 'tab-trends',     features: ['olap-etl'] },
];

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({ userId, refreshKey, onLocalRefresh }) => {
  const [activeKey, setActiveKey] = useState<TabKey>('hr');
  const [ranges, setRanges] = useState<Record<TabKey, Range>>({
    hr: '24h',
    calories: '7d',
    activities: '30d',
    trends: '7d',
  });

  // Achievement state for the shelf pill — comes from FitFeed (in-process read model).
  const achievements = useApi(() => getAchievements(userId), [userId, refreshKey]);

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.key === activeKey);
    const next =
      e.key === 'ArrowRight'
        ? TABS[(idx + 1) % TABS.length].key
        : TABS[(idx - 1 + TABS.length) % TABS.length].key;
    setActiveKey(next);
  };

  return (
    <Card padding="md" testId="timeseries-panel" className="ts-panel">
      <div className="ts-panel__head">
        <div
          className="ts-panel__tabs"
          role="tablist"
          aria-label="Time series category"
          data-testid="timeseries-tabs"
          onKeyDown={onTabKey}
        >
          {TABS.map((t) => {
            const active = t.key === activeKey;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                data-testid={t.testId}
                className={`ts-panel__tab ts-panel__tab--${t.tone} ${active ? 'is-active' : ''}`}
                onClick={() => setActiveKey(t.key)}
              >
                <span className="ts-panel__tab-dot" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="ts-panel__head-r">
          <TrophyShelf state={achievements.data ?? null} />
          {TABS.find((t) => t.key === activeKey)!.features.map((f) => (
            <FeatureBadge key={f} feature={f} />
          ))}
          {/* Trends has its own period selector; Activities is an
              internally-scrolling list; Calories renders the full window the
              map-reduce index covers. Only Heart Rate offers range chips. */}
          {activeKey === 'hr' && (
            <RangeChips
              value={ranges.hr}
              onChange={(r) => setRanges((prev) => ({ ...prev, hr: r }))}
              options={['24h', '7d', '30d']}
            />
          )}
        </div>
      </div>

      <div className="ts-panel__body" role="tabpanel">
        {activeKey === 'hr' && (
          <HeartRateTab userId={userId} range={ranges.hr} refreshKey={refreshKey} onLocalRefresh={onLocalRefresh} />
        )}
        {activeKey === 'calories' && (
          <CaloriesTab userId={userId} range={ranges.calories} refreshKey={refreshKey} onLocalRefresh={onLocalRefresh} />
        )}
        {activeKey === 'activities' && (
          <ActivitiesTab
            userId={userId}
            range={ranges.activities}
            refreshKey={refreshKey}
            onLocalRefresh={onLocalRefresh}
          />
        )}
        {activeKey === 'trends' && (
          <TrendsTab userId={userId} refreshKey={refreshKey} />
        )}
      </div>
    </Card>
  );
};

import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { getHeartRate, simulateWearableSync } from '../../api';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { useToast } from '../../hooks/useToast';
import { Range } from './RangeChips';
import { ChartTooltip } from './ChartTooltip';

interface HeartRateTabProps {
  userId: string;
  range: Range;
  refreshKey: number;
  onLocalRefresh: () => void;
}

function formatLabel(timestamp: string, range: Range): string {
  const d = new Date(timestamp);
  if (range === '24h' || range === '7d' && d.getDate() === new Date().getDate()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const HeartRateTab: React.FC<HeartRateTabProps> = ({ userId, range, refreshKey, onLocalRefresh }) => {
  const { data, loading, error, reload } = useApi(
    () => getHeartRate(userId, range),
    [userId, range, refreshKey]
  );
  const toast = useToast();

  const chartData = useMemo(
    () =>
      (data ?? []).map((p) => ({
        ts: p.timestamp,
        label: formatLabel(p.timestamp, range),
        bpm: p.bpm,
      })),
    [data, range]
  );

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const bpms = data.map((p) => p.bpm);
    // Round — raw rollup-aggregated BPM can be a multi-decimal float.
    const min = Math.round(Math.min(...bpms));
    const max = Math.round(Math.max(...bpms));
    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    return { min, max, avg };
  }, [data]);

  const handleSync = async () => {
    try {
      const result = await simulateWearableSync(userId);
      toast.show({ tone: 'success', kind: 'sync', message: result.message });
      reload();
      onLocalRefresh();
    } catch {
      toast.show({ tone: 'error', kind: 'sync', message: 'Wearable sync failed' });
    }
  };

  return (
    <div className="ts-tab">
      <div className="ts-tab__head">
        <div className="ts-tab__stats">
          {stats ? (
            <>
              <Stat label="Avg" value={`${stats.avg} bpm`} />
              <Stat label="Range" value={`${stats.min}–${stats.max}`} />
            </>
          ) : loading ? (
            <Skeleton width="160px" height="14px" />
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSync}
          testId="hr-sync"
          iconLeft={<span aria-hidden="true">⌚</span>}
        >
          Sync wearable
        </Button>
      </div>

      <div className="ts-tab__chart">
        {loading && !data ? (
          <Skeleton width="100%" height="240px" radius={16} />
        ) : error ? (
          <ChartError onRetry={reload} />
        ) : chartData.length === 0 ? (
          <ChartEmpty hint="No heart-rate data yet — run Sync wearable above." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="hr-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ring-red)" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="var(--ring-red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-mute)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-mute)' }}
                axisLine={false}
                tickLine={false}
                // Round-down min, round-up max → integer ticks. Without this
                // recharts can produce labels like "55.179" / "162.4" which
                // get clipped at the 50px width margin.
                domain={[
                  (dataMin: number) => Math.floor(dataMin / 5) * 5,
                  (dataMax: number) => Math.ceil(dataMax / 5) * 5,
                ]}
                allowDecimals={false}
                tickFormatter={(v: number) => `${Math.round(v)}`}
                width={50}
              />
              <Tooltip content={<ChartTooltip unit="bpm" />} />
              <Area
                type="monotone"
                dataKey="bpm"
                stroke="var(--ring-red)"
                strokeWidth={2}
                fill="url(#hr-grad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ts-tab__stat">
    <span className="ts-tab__stat-label">{label}</span>
    <span className="ts-tab__stat-value">{value}</span>
  </div>
);

export const ChartEmpty: React.FC<{ hint: string }> = ({ hint }) => (
  <div className="ts-tab__empty">{hint}</div>
);

export const ChartError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="ts-tab__empty">
    Couldn't load this chart.{' '}
    <button type="button" className="ts-tab__retry" onClick={onRetry}>
      Retry
    </button>
  </div>
);

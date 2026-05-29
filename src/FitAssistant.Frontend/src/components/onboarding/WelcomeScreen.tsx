import React, { useState } from 'react';
import { seedAll, getUsers } from '../../api';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useToast } from '../../hooks/useToast';
import { UserSummary } from '../layout/UserPill';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onUsersReady: (users: UserSummary[]) => void;
}

interface Solution {
  icon: string;
  tone: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
  primitive: string;
  headline: string;
  detail: string;
}

const SOLUTIONS: Solution[] = [
  {
    icon: '💬',
    tone: 'purple',
    primitive: 'AI Agent',
    headline: "Coaching grounded in this user's own data.",
    detail:
      'Bounded RQL tool queries scope every answer to the calling user. Streaming, sub-agents, and photo attachments all live on a single Conversation primitive in @conversations.',
  },
  {
    icon: '💓',
    tone: 'red',
    primitive: 'Time Series + Rollups',
    headline: 'Sensor data at scale, queryable forever.',
    detail:
      'Heart rate lives directly on the user document. A multi-tier rollup pyramid (raw → hourly → daily → monthly) auto-serves the right tier per chart range while storage stays bounded.',
  },
  {
    icon: '🎯',
    tone: 'green',
    primitive: 'GenAI Tasks',
    headline: 'Personalised content, regenerated from data daily.',
    detail:
      'A GenAI Task writes today\'s goals from yesterday\'s activity against a strict JSON schema. @ai-hashes dedup elides the model call when context is unchanged.',
  },
  {
    icon: '🔔',
    tone: 'yellow',
    primitive: 'Subscriptions',
    headline: 'React to data changes the moment they happen.',
    detail:
      'Two subscriptions watch exercise and food docs and flip goals to fulfilled the moment activity crosses a BURN or INTAKE threshold. A third fans goal events out to friends.',
  },
  {
    icon: '📡',
    tone: 'blue',
    primitive: 'Changes API + Queue ETL',
    headline: 'Live updates pushed, not polled.',
    detail:
      "The live-workouts ticker is push-driven by the Changes API. A Queue ETL fans every ExerciseSession into RabbitMQ so every follower's feed updates within seconds.",
  },
  {
    icon: '📊',
    tone: 'orange',
    primitive: 'OLAP ETL + DuckDB',
    headline: 'Cross-user analytics without OLTP load.',
    detail:
      'A scheduled OLAP ETL writes ExerciseSessions to Parquet on MinIO. Embedded DuckDB queries the lake via httpfs for percentile rankings — the OLTP store stays cool.',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onUsersReady }) => {
  const [seeding, setSeeding] = useState(false);
  const toast = useToast();

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedAll();
      const users = await getUsers();
      toast.show({ tone: 'success', message: 'Sample data seeded' });
      onUsersReady(users);
    } catch (e) {
      toast.show({
        tone: 'error',
        message: 'Seed failed — is the backend running?',
        action: { label: 'Retry', onClick: handleSeed },
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome__inner">
        <section className="welcome__hero">
          <div className="welcome__rings" aria-hidden="true">
            <svg viewBox="0 0 200 200" width="116" height="116">
              <defs>
                <linearGradient id="ringRed" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--ring-red)" />
                  <stop offset="100%" stopColor="#ff7a8f" />
                </linearGradient>
                <linearGradient id="ringGreen" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--ring-green)" />
                  <stop offset="100%" stopColor="#cdf78b" />
                </linearGradient>
                <linearGradient id="ringBlue" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--ring-blue)" />
                  <stop offset="100%" stopColor="#5ee9e3" />
                </linearGradient>
              </defs>
              {[
                { r: 80, color: 'url(#ringRed)', dash: 0.78 },
                { r: 60, color: 'url(#ringGreen)', dash: 0.62 },
                { r: 40, color: 'url(#ringBlue)', dash: 0.9 },
              ].map((ring, i) => {
                const c = 2 * Math.PI * ring.r;
                return (
                  <g key={i} transform="translate(100 100) rotate(-90)">
                    <circle cx="0" cy="0" r={ring.r} fill="none" stroke="var(--bg-sunken)" strokeWidth="14" />
                    <circle
                      cx="0"
                      cy="0"
                      r={ring.r}
                      fill="none"
                      stroke={ring.color}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${c * ring.dash} ${c}`}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="welcome__hero-text">
            <h1 className="welcome__title">Fit Assistant</h1>
            <p className="welcome__lead">
              A RavenDB sample app — AI coaching, time-series, and real-time social on one database.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            loading={seeding}
            onClick={handleSeed}
            testId="welcome-seed"
          >
            Seed sample data
          </Button>
        </section>

        <section className="welcome__section">
          <header className="welcome__section-head">
            <h2 className="welcome__section-title">Challenges &amp; solutions</h2>
            <p className="welcome__section-lead">
              Six engineering goals every data-rich consumer app hits — and the RavenDB primitive
              that takes each off your plate.
            </p>
          </header>

          <div className="welcome__grid">
            {SOLUTIONS.map((s) => (
              <Card
                key={s.primitive}
                className={`welcome__card welcome__card--${s.tone}`}
                padding="md"
              >
                <div className="welcome__card-head">
                  <span className="welcome__card-icon" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span className="welcome__card-primitive">{s.primitive}</span>
                </div>
                <p className="welcome__card-headline">{s.headline}</p>
                <p className="welcome__card-detail">{s.detail}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

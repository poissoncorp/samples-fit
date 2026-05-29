import React, { useCallback, useEffect, useState } from 'react';
import { getUsers } from './api';
import { AppShell } from './components/layout/AppShell';
import { WelcomeScreen } from './components/onboarding/WelcomeScreen';
import { UserSummary } from './components/layout/UserPill';
import './styles/theme-variables.css';
import './App.css';

type Phase = 'loading' | 'welcome' | 'shell' | 'error';

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const list = await getUsers();
      if (list.length === 0) {
        setUsers([]);
        setPhase('welcome');
        return;
      }
      setUsers(list);
      setSelectedUserId((current) => current ?? list[0].id);
      setPhase('shell');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('getUsers failed', e);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUsersReady = useCallback((list: UserSummary[]) => {
    setUsers(list);
    setSelectedUserId(list[0]?.id ?? null);
    setPhase(list.length > 0 ? 'shell' : 'welcome');
  }, []);

  const handleUserCreated = useCallback((u: UserSummary) => {
    setUsers((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, u]));
    setSelectedUserId(u.id);
    setPhase('shell');
  }, []);

  const handleSelectUser = useCallback((id: string) => {
    setSelectedUserId(id);
  }, []);

  if (phase === 'loading') {
    return <div className="app-bootstrap" aria-hidden="true" />;
  }

  if (phase === 'error') {
    return (
      <div className="app-bootstrap-error">
        <div className="app-bootstrap-error__title">Backend unreachable</div>
        <button type="button" className="app-bootstrap-error__retry" onClick={loadUsers}>
          Retry
        </button>
      </div>
    );
  }

  if (phase === 'welcome') {
    return <WelcomeScreen onUsersReady={handleUsersReady} />;
  }

  return (
    <AppShell
      users={users}
      selectedUserId={selectedUserId}
      onSelectUser={handleSelectUser}
      onUserCreated={handleUserCreated}
    />
  );
};

export default App;

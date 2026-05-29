import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../common/Card';
import { CoachQuickActions } from './CoachQuickActions';
import { MessageBubble, CoachMessage } from './MessageBubble';
import { CoachThinking } from './CoachThinking';
import { streamChat } from '../../api';
import { useToast } from '../../hooks/useToast';
import { FeatureBadge } from '../common/FeatureBadge';
import './Coach.css';

interface CoachProps {
  userId: string;
  isPremium: boolean;
  onLocalRefresh: () => void;
}

let nextMsgId = 1;
const newId = () => `m-${nextMsgId++}`;

export const Coach: React.FC<CoachProps> = ({
  userId,
  isPremium,
  onLocalRefresh,
}) => {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const hasMessages = messages.length > 0;

  useEffect(() => {
    setMessages([]);
    setStreaming(false);
    setPendingFile(null);
  }, [userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  const appendMessage = useCallback((m: CoachMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const updateLast = useCallback((updater: (m: CoachMessage) => CoachMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = updater(next[next.length - 1]);
      return next;
    });
  }, []);

  // Unified send path — multipart POST to /api/chat for every turn (photo or
  // not). The parent fit-assistant agent decides whether to delegate to
  // food-photo-analyzer based on whether an attachment is on the conversation.
  const handleSend = useCallback(async () => {
    const text = input.trim();
    const file = pendingFile;
    if (!text && !file) return;
    if (streaming) return;

    setInput('');
    setPendingFile(null);

    const userMsg: CoachMessage = {
      id: newId(),
      role: 'user',
      content: text || 'Analyse this photo',
      attachmentName: file?.name,
    };
    appendMessage(userMsg);
    appendMessage({ id: newId(), role: 'assistant', content: '', streaming: true });
    setStreaming(true);

    const promptToSend = text || 'I just snapped this photo. Analyse it and log the meal.';

    try {
      await streamChat(
        promptToSend,
        userId,
        (chunk) => {
          updateLast((m) => ({ ...m, content: m.content + chunk }));
        },
        () => {
          updateLast((m) => ({ ...m, streaming: false }));
          setStreaming(false);
          onLocalRefresh();
        },
        file,
      );
    } catch {
      updateLast((m) => ({ ...m, streaming: false, content: 'Connection lost. Try again.' }));
      setStreaming(false);
    }
  }, [input, pendingFile, streaming, userId, appendMessage, updateLast, onLocalRefresh]);

  const runMotivate = useCallback(async () => {
    if (streaming) return;
    setInput('');
    setPendingFile(null);
    appendMessage({ id: newId(), role: 'user', content: 'Motivate me' });
    appendMessage({ id: newId(), role: 'assistant', content: '', streaming: true });
    setStreaming(true);
    try {
      await streamChat(
        'Motivate me — give me a quick pep-talk based on my last week.',
        userId,
        (chunk) => updateLast((m) => ({ ...m, content: m.content + chunk })),
        () => {
          updateLast((m) => ({ ...m, streaming: false }));
          setStreaming(false);
          onLocalRefresh();
        },
        null,
        'motivate',
      );
    } catch {
      updateLast((m) => ({ ...m, streaming: false, content: 'Could not fetch motivation.' }));
      setStreaming(false);
    }
  }, [userId, streaming, appendMessage, updateLast, onLocalRefresh]);

  const triggerPhotoPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Log-a-workout — stages a draft prompt in the composer for the user to
  // edit and send. The parent agent's LogExercise action parses the structured
  // fields (Type, Duration, Calories, HR) from the natural-language message —
  // showcasing LLM-as-parser as part of the tool-actions surface.
  const handleLogWorkoutPrompt = useCallback(() => {
    if (streaming) return;
    setInput('I just did 30 min running, burned about 250 cal, avg HR 145, max 168');
    const el = inputRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      });
    }
  }, [streaming]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    e.target.value = '';
  };

  return (
    <Card padding="none" testId="coach-panel" className="coach">
      <header className="coach__head">
        <div className="coach__head-l">
          <span className="coach__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div className="coach__head-text">
            <div className="coach__title">Coach</div>
            <div className="coach__badges coach__badges--ribbon">
              <FeatureBadge feature="ai-agent" />
              <FeatureBadge feature="multi-agent" />
              <FeatureBadge feature="tool-actions" />
              <FeatureBadge feature="tool-queries" />
              <FeatureBadge feature="ai-agent-parameters" />
              <FeatureBadge feature="streaming" />
              <FeatureBadge feature="attachments" />
            </div>
          </div>
        </div>
      </header>

      <div className="coach__body" ref={scrollRef}>
        {hasMessages ? (
          messages.map((m) =>
            m.role === 'assistant' && m.streaming && !m.content
              ? <CoachThinking key={m.id} />
              : <MessageBubble key={m.id} message={m} />
          )
        ) : (
          <CoachQuickActions
            onMotivate={runMotivate}
            onAnalyzePhoto={triggerPhotoPicker}
            onLogWorkout={handleLogWorkoutPrompt}
            disabled={streaming}
            motivateLocked={!isPremium}
          />
        )}
      </div>

      <footer className="coach__foot">
        {pendingFile && (
          <div className="coach__pending">
            <span aria-hidden="true">📎</span>
            <span className="coach__pending-name">{pendingFile.name}</span>
            <span className="coach__pending-badges">
              <FeatureBadge feature="attachments" size="xs" />
            </span>
            <button
              type="button"
              className="coach__pending-x"
              aria-label="Remove attachment"
              onClick={() => setPendingFile(null)}
            >
              ×
            </button>
          </div>
        )}

        <div className="coach__inputRow">
          <button
            type="button"
            className="coach__attach"
            aria-label="Attach a food photo"
            data-testid="coach-attach"
            onClick={triggerPhotoPicker}
            disabled={streaming}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14.5 3.5a3.5 3.5 0 1 1 5 5L11 17a2 2 0 1 1-2.8-2.8l7-7" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            data-testid="coach-file"
          />

          <textarea
            ref={inputRef}
            className="coach__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={pendingFile ? 'Add a note (optional) and send' : 'Ask Coach about your week…'}
            rows={1}
            data-testid="coach-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <button
            type="button"
            className="coach__send"
            aria-label="Send message"
            data-testid="coach-send"
            onClick={handleSend}
            disabled={streaming || (!input.trim() && !pendingFile)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M2 12l20-9-9 20-2-9-9-2z" />
            </svg>
          </button>
        </div>
      </footer>
    </Card>
  );
};

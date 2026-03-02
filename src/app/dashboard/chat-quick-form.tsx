'use client';

import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';

type ChatMode =
  | '/today'
  | '/plan'
  | '/content'
  | '/recruit'
  | '/objections'
  | '/products'
  | '/compplan'
  | '/vocabulary'
  | '/encouragement';

type PresetQuestion = {
  id: string;
  mode: ChatMode;
  label: string;
  prompt: string;
};

const PRESET_QUESTIONS: PresetQuestion[] = [
  {
    id: 'today-plan',
    mode: '/today',
    label: 'What should I do today to move my business forward?',
    prompt: 'What should I do today to move my business forward? Give me a practical step-by-step plan.'
  },
  {
    id: 'weekly-growth',
    mode: '/plan',
    label: 'What is my best weekly business growth plan?',
    prompt: 'Build me a weekly business growth plan with daily targets for sales and recruiting.'
  },
  {
    id: 'content-week',
    mode: '/content',
    label: 'What content should I post this week?',
    prompt: 'Give me a 7-day content plan for social selling that helps attract prospects and sales.'
  },
  {
    id: 'recruiting-strategy',
    mode: '/recruit',
    label: 'How do I recruit more people this month?',
    prompt: 'Give me a practical recruiting strategy for this month, including outreach and follow-up steps.'
  },
  {
    id: 'handle-no',
    mode: '/objections',
    label: 'How should I respond when someone says no?',
    prompt: 'How should I respond when someone says no while staying respectful and confident?'
  },
  {
    id: 'product-positioning',
    mode: '/products',
    label: 'How do I position products by pain point?',
    prompt: 'Show me how to position products by pain point, problem, solution, and outcome.'
  },
  {
    id: 'comp-plan',
    mode: '/compplan',
    label: 'How do I explain my compensation plan simply?',
    prompt: 'Help me explain a compensation plan simply to a new prospect.'
  },
  {
    id: 'vocab',
    mode: '/vocabulary',
    label: 'What network marketing terms should I master first?',
    prompt: 'Teach me core network marketing terms and how to apply them in daily prospecting.'
  },
  {
    id: 'mindset',
    mode: '/encouragement',
    label: 'How do I stay consistent after rejection?',
    prompt: 'Give me mindset coaching to stay consistent after rejection and daily discouragement.'
  }
];

type ChatResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
  needsEmailVerification?: boolean;
  verifyPath?: string;
  needsSubscription?: boolean;
  checkoutPath?: string;
  portalPath?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pairId: string;
};

export function ChatQuickForm() {
  const [selectedQuestionId, setSelectedQuestionId] = useState(PRESET_QUESTIONS[0].id);
  const [prompt, setPrompt] = useState(PRESET_QUESTIONS[0].prompt);
  const [isLoading, setIsLoading] = useState(false);
  const [chatFeed, setChatFeed] = useState<ChatMessage[]>([]);
  const [lastAssistantAnswer, setLastAssistantAnswer] = useState('');
  const [error, setError] = useState('');
  const [verifyPath, setVerifyPath] = useState<string | null>(null);
  const [checkoutPath, setCheckoutPath] = useState<string | null>(null);
  const [portalPath, setPortalPath] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<ChatMode>('/today');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyFailedMessageId, setCopyFailedMessageId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedPreset = PRESET_QUESTIONS.find((q) => q.id === selectedQuestionId) ?? PRESET_QUESTIONS[0];

  function latestAssistantText(messages: ChatMessage[]): string {
    for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
      if (messages[idx].role === 'assistant') {
        return messages[idx].text;
      }
    }
    return '';
  }

  async function submitChat(mode: ChatMode, promptToSend: string) {
    setIsLoading(true);
    setError('');
    setVerifyPath(null);
    setCheckoutPath(null);
    setPortalPath(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt: promptToSend })
      });

      const data = (await res.json()) as ChatResponse;
      if (!data.ok) {
        setError(data.error ?? 'Request failed.');
        setVerifyPath(data.needsEmailVerification ? data.verifyPath ?? '/auth/verify/resend' : null);
        setCheckoutPath(data.needsSubscription ? data.checkoutPath ?? '/api/stripe/checkout' : null);
        setPortalPath(data.needsSubscription ? data.portalPath ?? '/api/stripe/portal' : null);
        return;
      }

      const assistantText = data.answer ?? '';
      const pairId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setChatFeed((prev) => [
        ...prev,
        { id: `${pairId}-u`, role: 'user', text: promptToSend, pairId },
        { id: `${pairId}-a`, role: 'assistant', text: assistantText, pairId }
      ]);
      setLastAssistantAnswer(assistantText);
      setPrompt('');
      setLastMode(mode);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Please enter a question.');
      return;
    }

    await submitChat(selectedPreset.mode, prompt.trim());
  }

  async function openBilling(path: string) {
    setError('');
    try {
      const res = await fetch(path, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        setError(data.error ?? 'Unable to open billing.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Unable to open billing.');
    }
  }

  async function onYesFollowUp() {
    if (!lastAssistantAnswer.trim()) return;

    const followUpPrompt = `Based on your last response below, do the specific next-step action you just offered and provide the finished deliverable now.\n\nLast response:\n${lastAssistantAnswer}`;
    await submitChat(lastMode, followUpPrompt);
  }

  async function onSomethingElse() {
    if (!lastAssistantAnswer.trim()) return;
    setShowCopyModal(true);
  }

  async function handleCopyAndContinue() {
    try {
      await navigator.clipboard.writeText(lastAssistantAnswer);
    } catch {
      // If clipboard write fails, continue and let user copy manually.
    } finally {
      setShowCopyModal(false);
      setLastAssistantAnswer('');
      setPrompt('');
      textareaRef.current?.focus();
    }
  }

  function handleContinueWithoutCopy() {
    setShowCopyModal(false);
    setLastAssistantAnswer('');
    setPrompt('');
    textareaRef.current?.focus();
  }

  async function copyResponse(messageId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setCopyFailedMessageId(null);
      setTimeout(() => setCopiedMessageId((prev) => (prev === messageId ? null : prev)), 1400);
    } catch {
      setCopyFailedMessageId(messageId);
      setCopiedMessageId(null);
      setTimeout(() => setCopyFailedMessageId((prev) => (prev === messageId ? null : prev)), 1400);
    }
  }

  function deletePair(pairId: string) {
    setChatFeed((prev) => {
      const next = prev.filter((message) => message.pairId !== pairId);
      setLastAssistantAnswer(latestAssistantText(next));
      return next;
    });
  }

  return (
    <div className="card">
      <h2 className="mb-2 text-lg font-semibold">Ask My Moneymaker</h2>
      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          {verifyPath ? (
            <Link href={verifyPath} className="mt-2 inline-block text-clemson-purple underline">
              Verify email now
            </Link>
          ) : null}
          {checkoutPath ? (
            <button
              className="mt-2 ml-3 inline-block text-clemson-purple underline"
              type="button"
              onClick={() => openBilling(checkoutPath)}
            >
              Subscribe for $1.99/mo
            </button>
          ) : null}
          {portalPath ? (
            <button
              className="mt-2 ml-3 inline-block text-clemson-purple underline"
              type="button"
              onClick={() => openBilling(portalPath)}
            >
              Manage billing
            </button>
          ) : null}
        </div>
      ) : null}

      {chatFeed.length ? (
        <div className="mt-3 space-y-2">
          {chatFeed.map((message) => (
            <div
              key={message.id}
              className={`relative rounded-xl border p-3 text-sm ${
                message.role === 'assistant'
                  ? 'border-slate-200 bg-slate-50 text-slate-800'
                  : 'border-clemson-stadium bg-white text-clemson-avenue'
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {message.role === 'assistant' ? 'My Moneymaker' : 'You'}
              </p>
              <div className="whitespace-pre-wrap">{message.text}</div>
              {message.role === 'assistant' ? (
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {copiedMessageId === message.id ? (
                    <span className="absolute -top-8 right-0 rounded-md bg-clemson-purple px-2 py-1 text-[11px] font-semibold text-white">
                      Copied
                    </span>
                  ) : null}
                  {copyFailedMessageId === message.id ? (
                    <span className="absolute -top-8 right-0 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
                      Copy failed
                    </span>
                  ) : null}
                  <button
                    className="rounded-md border border-clemson-stadium bg-white px-2 py-1 text-xs"
                    type="button"
                    title="Copy"
                    aria-label="Copy"
                    onClick={() => copyResponse(message.id, message.text)}
                  >
                    <img src="/icons/copy-badge.png" alt="Copy" className="h-5 w-5" />
                  </button>
                  <button
                    className="rounded-md border border-clemson-stadium bg-white px-2 py-1 text-xs"
                    type="button"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => deletePair(message.pairId)}
                  >
                    <img src="/icons/delete-badge.png" alt="Delete" className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <button className="btn" type="button" onClick={onYesFollowUp}>
              Yes
            </button>
            <button
              className="rounded-xl border border-clemson-stadium px-4 py-2 text-sm font-semibold text-clemson-avenue"
              type="button"
              onClick={onSomethingElse}
            >
              Something else
            </button>
            <button
              className="rounded-xl border border-clemson-stadium px-4 py-2 text-sm font-semibold text-clemson-avenue"
              type="button"
              onClick={() => {
                setChatFeed([]);
                setLastAssistantAnswer('');
                setError('');
                setPrompt('');
              }}
            >
              Clear chat
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className={`${chatFeed.length ? 'mt-4' : 'mt-0'} space-y-2`}>
        <select
          name="question"
          className="input"
          value={selectedQuestionId}
          onChange={(event) => {
            const nextId = event.target.value;
            setSelectedQuestionId(nextId);
            const preset = PRESET_QUESTIONS.find((q) => q.id === nextId);
            if (preset) {
              setPrompt(preset.prompt);
            }
            textareaRef.current?.focus();
          }}
        >
          {PRESET_QUESTIONS.map((question) => (
            <option key={question.id} value={question.id}>
              {question.label}
            </option>
          ))}
        </select>

        <textarea
          ref={textareaRef}
          className="input min-h-32"
          name="prompt"
          placeholder="Type your question or edit the selected question..."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          required
        />

        <button className="btn" type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Ask My Moneymaker'}
        </button>
      </form>

      {showCopyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-clemson-stadium bg-white p-4 shadow-xl">
            <h3 className="text-lg font-bold text-clemson-purple">My Moneymaker</h3>
            <p className="mt-2 text-sm text-slate-700">
              Before continuing, copy this response for your records.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn" type="button" onClick={handleCopyAndContinue}>
                Copy and continue
              </button>
              <button
                className="rounded-xl border border-clemson-stadium px-4 py-2 text-sm font-semibold text-clemson-avenue"
                type="button"
                onClick={handleContinueWithoutCopy}
              >
                Continue without copy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

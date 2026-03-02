export const CHAT_MODES = [
  '/today',
  '/plan',
  '/content',
  '/recruit',
  '/objections',
  '/products',
  '/compplan',
  '/vocabulary',
  '/encouragement'
] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

export const MODE_SYSTEM_HINTS: Record<ChatMode, string> = {
  '/today': 'Generate a practical daily plan with trackable actions.',
  '/plan': 'Create a business plan with milestones and weekly checkpoints.',
  '/content': 'Design social media strategy and content pillars for conversions.',
  '/recruit': 'Give recruiting strategy, scripts, and follow-up framework.',
  '/objections': 'Handle rejection and objections with respectful persuasion.',
  '/products': 'Sell by pain-point-to-outcome mapping, not ingredient dumping.',
  '/compplan': 'Explain compensation plan mechanics in plain language.',
  '/vocabulary': 'Teach network marketing terminology with practical examples.',
  '/encouragement': 'Coach resilience, consistency, and confidence after setbacks.'
};

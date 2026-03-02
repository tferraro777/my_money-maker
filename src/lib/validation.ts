import { z } from 'zod';
import { CHAT_MODES } from '@/lib/modes';

export const onboardingSchema = z.object({
  fullName: z.string().min(2),
  phoneNumber: z.string().min(5),
  street: z.string().min(2),
  city: z.string().min(2),
  stateProvince: z.string().min(2),
  postalCode: z.string().min(2),
  country: z.string().min(2),
  birthdate: z.string().min(8),
  timezone: z.string().min(2),
  preferredLanguage: z.string().min(2),
  targetAudience: z.record(z.any()),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  existingSystems: z.record(z.any()),
  primaryGoals: z.array(z.string()).min(1),
  companies: z
    .array(
      z.object({
        name: z.string().min(2),
        products: z.array(
          z.object({
            name: z.string().min(2),
            description: z.string().optional(),
            ingredients: z.string().optional()
          })
        )
      })
    )
    .min(1)
});

export const chatSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  mode: z.enum(CHAT_MODES),
  prompt: z.string().min(2),
  activeCompanyId: z.string().uuid().nullable().optional()
});

export const incomeEntrySchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().datetime(),
  userTimezone: z.string().min(2),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  type: z.enum(['sale', 'commission', 'bonus', 'other']),
  notes: z.string().max(300).nullable().optional()
});

export const activityEntrySchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().datetime(),
  userTimezone: z.string().min(2),
  activityType: z.enum([
    'outreach_messages',
    'follow_up_messages',
    'content_posts',
    'live_videos',
    'calls_booked',
    'presentations_given',
    'samples_sent',
    'team_trainings',
    'custom'
  ]),
  quantity: z.number().int().positive().default(1),
  notes: z.string().max(300).nullable().optional()
});

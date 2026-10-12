import type { User, Webhook } from '../api/types';

export const TEST_CREDENTIALS = {
  email: 'demo@smartsender.dev',
  password: 'password123',
} as const;

export const MOCK_USER: User = {
  id: 1,
  email: TEST_CREDENTIALS.email,
  first_name: 'Demo',
  last_name: 'User',
  name: 'Demo User',
};

const EVENTS = [
  'Order created',
  'Order paid',
  'Order shipped',
  'Order cancelled',
  'Subscriber joined',
  'Subscriber left',
  'Message delivered',
  'Message failed',
  'Campaign started',
  'Campaign finished',
  'Payment refunded',
  'Lead qualified',
  'Chat assigned',
  'Chat closed',
] as const;

const TARGETS = ['crm', 'analytics'] as const;

/** 28 deterministic webhooks so pagination and search are predictable. */
export function seedWebhooks(): Webhook[] {
  const base = Date.UTC(2026, 0, 1);
  const day = 24 * 60 * 60 * 1000;

  return TARGETS.flatMap((target, targetIndex) =>
    EVENTS.map((event, eventIndex) => {
      const id = targetIndex * EVENTS.length + eventIndex + 1;
      const slug = event.toLowerCase().replace(/\s+/g, '-');
      return {
        id,
        name: `${event} → ${target.toUpperCase()}`,
        url: `https://${target}.example.com/hooks/${slug}`,
        active: id % 4 !== 0,
        created_at: new Date(base + id * day).toISOString(),
      };
    }),
  );
}

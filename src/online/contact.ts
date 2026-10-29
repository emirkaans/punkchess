// The contact page's message: what a visitor may send (server/contact.ts checks it,
// src/ui/ContactPage.tsx shows the same limits) and what staff see. Pure.

export const CONTACT_TOPICS = ['bug', 'idea', 'account', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_NAME_MAX = 60;
export const CONTACT_EMAIL_MAX = 120;
export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 2000;
/** One sender may write this many messages an hour. */
export const CONTACT_PER_HOUR = 3;
/** Messages are kept this long. */
export const CONTACT_KEEP_DAYS = 365;

export interface ContactInput {
  readonly topic: ContactTopic;
  readonly name: string | null;
  readonly email: string | null;
  readonly message: string;
}

export type ContactProblem = 'topic' | 'email' | 'short' | 'long';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A sent form as a message, or what is wrong with it. */
export function cleanContact(body: unknown): ContactInput | { readonly problem: ContactProblem } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const topic = CONTACT_TOPICS.find((x) => x === b.topic);
  if (!topic) return { problem: 'topic' };
  const email = text(b.email);
  if (email && (email.length > CONTACT_EMAIL_MAX || !EMAIL.test(email))) return { problem: 'email' };
  const message = text(b.message);
  if (message.length < CONTACT_MESSAGE_MIN) return { problem: 'short' };
  if (message.length > CONTACT_MESSAGE_MAX) return { problem: 'long' };
  const name = text(b.name).slice(0, CONTACT_NAME_MAX);
  return { topic, name: name || null, email: email || null, message };
}

/** A message as staff see it on the admin page. */
export interface ContactMessage {
  readonly id: number;
  readonly at: number;
  readonly topic: ContactTopic;
  readonly name: string | null;
  readonly email: string | null;
  readonly username: string | null;
  readonly message: string;
  readonly readAt: number | null;
}

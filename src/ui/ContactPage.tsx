import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  CONTACT_EMAIL_MAX,
  CONTACT_MESSAGE_MAX,
  CONTACT_MESSAGE_MIN,
  CONTACT_NAME_MAX,
  CONTACT_TOPICS,
  cleanContact,
} from '../online/contact.ts';
import type { ContactTopic } from '../online/contact.ts';
import type { MessageKey } from '../i18n/index.ts';
import { useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';

const MAIL = 'info@punkchess.com';

/**
 * /contact: a form that writes to the site team (server/contact.ts); staff read the
 * messages on the admin page. The address stays for those who prefer email.
 */
export function ContactPage() {
  const { t } = useI18n();
  const account = useAccount();
  const [topic, setTopic] = useState<ContactTopic>('bug');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  // Never shown: only bots fill it in (the server then drops the message).
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const problemText = (code: string) => {
    const known = ['topic', 'email', 'short', 'long', 'too-many'];
    const n = code === 'short' ? CONTACT_MESSAGE_MIN : CONTACT_MESSAGE_MAX;
    return t((known.includes(code) ? `contact.error.${code}` : 'contact.error.other') as MessageKey, {
      n: String(n),
    });
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = { topic, name, email, message, website };
    const local = cleanContact(body);
    if ('problem' in local) return setProblem(local.problem);
    setProblem(null);
    setState('sending');
    const res = await fetch('/api/contact', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) {
      setState('sent');
      setMessage('');
      return;
    }
    setState('idle');
    setProblem(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'network');
  };

  return (
    <main className="tournament-page contact-page">
      <header className="tz-head">
        <div className="tz-title">
          <p className="tz-meta">{t('contact.meta')}</p>
          <h1 className="tz-section-title contact-title">{t('contact.title')}</h1>
          <p className="contact-lede">{t('contact.lede')}</p>
        </div>
      </header>

      {state === 'sent' ? (
        <section className="tz-section contact-sent" role="status">
          <p>{t('contact.sent')}</p>
          <button onClick={() => setState('idle')}>{t('contact.again')}</button>
        </section>
      ) : (
        <form className="tz-section contact-form" onSubmit={(e) => void send(e)} noValidate>
          <fieldset className="contact-topics">
            <legend>{t('contact.topic')}</legend>
            {CONTACT_TOPICS.map((id) => (
              <label key={id} className={topic === id ? 'on' : ''}>
                <input type="radio" name="topic" checked={topic === id} onChange={() => setTopic(id)} />
                {t(`contact.topic.${id}`)}
              </label>
            ))}
          </fieldset>

          {account.user ? (
            <p className="muted">{t('contact.signedIn', { name: account.user.username })}</p>
          ) : (
            <label className="analysis-field">
              <span>{t('contact.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={CONTACT_NAME_MAX}
                autoComplete="name"
              />
            </label>
          )}

          <label className="analysis-field">
            <span>{t('contact.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={CONTACT_EMAIL_MAX}
              autoComplete="email"
            />
          </label>
          <p className="contact-note">{t('contact.emailNote')}</p>

          <label className="analysis-field">
            <span>{t('contact.message')}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={CONTACT_MESSAGE_MAX}
              rows={7}
              required
            />
          </label>
          <p className="contact-count">
            {t('contact.count', { n: String(message.trim().length), max: String(CONTACT_MESSAGE_MAX) })}
          </p>

          <label className="contact-trap" aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>

          {problem && <p className="error">{problemText(problem)}</p>}
          <button className="primary contact-send" type="submit" disabled={state === 'sending'}>
            {t(state === 'sending' ? 'contact.sending' : 'contact.send')}
          </button>
        </form>
      )}

      <footer className="contact-foot">
        <p>
          {t('contact.mail')} <a href={`mailto:${MAIL}`}>{MAIL}</a>
        </p>
        <p>
          {t('contact.privacy')} <a href="/privacy">{t('legal.privacy')}</a>
        </p>
      </footer>
    </main>
  );
}

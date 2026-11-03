import { useEffect, useState } from 'react';
import type { MessageKey } from '../i18n/index.ts';
import { sameName } from '../online/rename.ts';
import type { RenameInfo } from '../online/rename.ts';
import { refreshAccount } from './account.ts';
import { refreshCoins } from './coins.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { Modal } from './Modal.tsx';

/**
 * Changing one's username (server/rename.ts): the new name with a live "available?" check, what
 * it costs (the first change is free, later ones punk coins) and when the next change is allowed.
 */
export function RenameDialog({ onDone, onClose }: { onDone: (username: string) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [info, setInfo] = useState<RenameInfo | null>(null);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/me/username', { credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<RenameInfo>) : null))
      .then((d) => {
        if (d) {
          setInfo(d);
          setName(d.username);
        }
      })
      .catch(() => {});
  }, []);

  // The name typed is checked as it is typed (a moment after the last key).
  const trimmed = name.trim();
  const capitalsOnly = !!info && trimmed !== info.username && sameName(trimmed, info.username);
  useEffect(() => {
    if (!info || trimmed === info.username || capitalsOnly) return setProblem(null);
    const id = setTimeout(() => {
      void fetch(`/api/auth/username?name=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json() as Promise<{ problem?: string }>)
        .then((d) => setProblem(d.problem ?? null))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(id);
  }, [trimmed, info, capitalsOnly]);

  const waiting = !!info?.nextAt && !capitalsOnly;
  const cost = capitalsOnly ? 0 : (info?.cost ?? 0);
  const short = cost > (info?.balance ?? 0);
  const blocked = !info || busy || trimmed === info.username || !!problem || waiting || short;

  const save = async () => {
    setBusy(true);
    const res = await fetch('/api/me/username', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: trimmed }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { username?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.username) return setProblem(data?.error ?? 'network');
    await refreshAccount();
    void refreshCoins();
    onDone(data.username);
  };

  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Modal label={t('rename.title')} onClose={onClose} className="rename-dialog">
      <h2>{t('rename.title')}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) void save();
        }}
      >
        <input
          className="rename-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label={t('rename.title')}
        />
        <p className={problem ? 'rename-note bad' : 'rename-note'} role="status">
          {problem
            ? t(`rename.problem.${problem}` as MessageKey)
            : waiting
              ? t('rename.wait', { date: date(info!.nextAt!) })
              : capitalsOnly
                ? t('rename.capitals')
                : cost > 0
                  ? t('rename.cost', { n: String(cost) })
                  : t('rename.free')}
        </p>
        <p className="muted rename-rules">{t('rename.rules')}</p>
        <div className="rename-actions">
          <button type="button" onClick={onClose}>
            {t('settings.back')}
          </button>
          <button type="submit" className="primary" disabled={blocked}>
            {cost > 0 && <CoinIcon />}
            {busy ? t('rename.saving') : cost > 0 ? t('rename.pay', { n: String(cost) }) : t('rename.save')}
          </button>
        </div>
        {short && !waiting && <p className="rename-note bad">{t('store.notEnough')}</p>}
      </form>
    </Modal>
  );
}

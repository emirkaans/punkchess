import { useEffect, useState } from 'react';
import {
  AVATAR_OPTIONS,
  AVATAR_PARTS,
  DEFAULT_AVATAR,
  avatarSvg,
  optionColor,
  randomAvatar,
} from '../avatar/avatar.ts';
import type { Avatar, AvatarPart } from '../avatar/avatar.ts';
import type { MessageKey } from '../i18n/index.ts';
import { refreshAccount, signInWithGoogle, useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';

/** Each part's icon for the phone rail (24×24 strokes). */
const PART_ICONS: Readonly<Record<AvatarPart, string>> = {
  head: 'M12 3c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9z',
  skin: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  eyes: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  mouth: 'M5 11c3 5 11 5 14 0',
  hair: 'M6 14L5 4l4 4 3-6 3 6 4-4-1 10',
  hairColor: 'M8 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM16 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  extra: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v3M12 19v3',
};

interface Props {
  /** Where to go once the character is saved (or skipped); null: the player's profile. */
  next: string | null;
  onOpen: (path: string) => void;
}

/** The avatar drawn from its parts. */
export function AvatarView({ avatar, className = '' }: { avatar: Avatar; className?: string }) {
  return <span className={`char-avatar ${className}`} dangerouslySetInnerHTML={{ __html: avatarSvg(avatar) }} />;
}

/**
 * The character creator ("Ayna"): parts on the left, the character in a round mirror, the
 * picked part's options on the right (each a small preview, colours as swatches). Opened after
 * signing up and from the player's profile.
 */
export function CharacterCreator({ next, onOpen }: Props) {
  const { t } = useI18n();
  const account = useAccount();
  const [avatar, setAvatar] = useState<Avatar>(account.user?.avatar ?? DEFAULT_AVATAR);
  const [part, setPart] = useState<AvatarPart>('hair');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // The saved character arrives with the account: start from it.
  const saved = account.user?.avatar ?? null;
  useEffect(() => {
    if (saved) setAvatar(saved);
  }, [saved]);

  const done = () => onOpen(next ?? (account.user ? `/@/${account.user.username}` : '/'));
  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatar }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await refreshAccount();
      done();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (!account.loading && !account.user) {
    return (
      <main className="character-page">
        <h1 className="character-title">{t('character.title')}</h1>
        <p className="muted">{t('character.signIn')}</p>
        {account.canSignIn && (
          <button className="primary" onClick={() => signInWithGoogle('/character')}>
            {t('account.signIn')}
          </button>
        )}
      </main>
    );
  }

  const colour = optionColor(part, AVATAR_OPTIONS[part][0].id) !== null;
  const label = (p: AvatarPart, id: string) => t(`character.opt.${p}.${id}` as MessageKey);
  return (
    <main className="character-page">
      <h1 className="character-title">{t('character.title')}</h1>
      <p className="muted character-lede">{t('character.lede')}</p>
      <div className="character-creator">
        <div className="character-parts" role="tablist" aria-label={t('character.title')}>
          {AVATAR_PARTS.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={part === p}
              className={part === p ? 'on' : ''}
              onClick={() => setPart(p)}
            >
              {/* Phones: an icon and a short name in a narrow rail; wider screens: the full name. */}
              <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={PART_ICONS[p]} />
              </svg>
              <span className="cp-full">{t(`character.part.${p}` as MessageKey)}</span>
              <span className="cp-short" aria-hidden="true">
                {t(`character.short.${p}` as MessageKey)}
              </span>
            </button>
          ))}
        </div>
        <div className="character-mirror">
          <AvatarView avatar={avatar} />
        </div>
        <div className="character-side" role="tabpanel">
          <span className="character-picked">
            {t(`character.part.${part}` as MessageKey)} · {label(part, avatar[part])}
          </span>
          <div className={colour ? 'character-swatches' : 'character-options'}>
            {AVATAR_OPTIONS[part].map((o) =>
              colour ? (
                <button
                  key={o.id}
                  className="character-swatch"
                  style={{ background: o.color }}
                  aria-label={label(part, o.id)}
                  aria-pressed={avatar[part] === o.id}
                  onClick={() => setAvatar({ ...avatar, [part]: o.id })}
                />
              ) : (
                <button
                  key={o.id}
                  className="character-option"
                  aria-label={label(part, o.id)}
                  aria-pressed={avatar[part] === o.id}
                  onClick={() => setAvatar({ ...avatar, [part]: o.id })}
                >
                  <AvatarView avatar={{ ...avatar, [part]: o.id }} />
                </button>
              ),
            )}
          </div>
          <div className="character-actions">
            <button onClick={() => setAvatar(randomAvatar())}>🎲 {t('character.random')}</button>
            <button className="primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('character.saving') : t('character.save')}
            </button>
          </div>
          {failed && (
            <p className="notice" role="alert">
              {t('character.error')}
            </p>
          )}
          {next && (
            <button className="link-button character-skip" onClick={done}>
              {t('character.skip')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

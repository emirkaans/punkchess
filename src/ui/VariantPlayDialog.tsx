import { useState } from 'react';
import { TIME_CONTROLS } from '../clock/clock.ts';
import { getVariant, listVariants } from '../engine/index.ts';
import type { Color, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';
import { Modal } from './Modal.tsx';
import { ApiError, createOnlineGame } from './online/connection.ts';
import type { Lobby } from './online/LobbyPage.tsx';
import { playerIdentity } from './online/lobbyConnection.ts';
import type { GameSettings } from './settings.ts';

type Opponent = 'online' | 'friend' | 'bot' | 'botvbot' | 'hotseat';

const GROUPS: readonly (readonly [MessageKey, readonly Opponent[]])[] = [
  ['setup.group.online', ['online', 'friend']],
  ['setup.group.device', ['bot', 'botvbot', 'hotseat']],
];

/** Each opponent's icon (30×30 strokes). */
const OPPONENT_ICONS: Readonly<Record<Opponent, string>> = {
  online: 'M15 4a11 11 0 1 0 0 22 11 11 0 0 0 0-22zM4 15h22M15 4c4 4 4 18 0 22M15 4c-4 4-4 18 0 22',
  friend: 'M12 18l-3 3a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M18 12l3-3a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0M11 19l8-8',
  bot: 'M9 9h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3zM15 4v5M11 15h.01M19 15h.01M11 19h8M3 14v4M27 14v4',
  botvbot:
    'M4 11h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM19 11h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM7.5 7v4M22.5 7v4M5 16h.01M10 16h.01M20 16h.01M25 16h.01M14 16h2',
  hotseat:
    'M10 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM21 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 25c0-5 3-8 7-8s7 3 7 8M14 25c0-5 3-8 7-8s7 3 7 8',
};

const GO: Readonly<Record<Opponent, MessageKey>> = {
  online: 'lobby.findOpponent',
  friend: 'setup.go.friend',
  bot: 'setup.go.bot',
  botvbot: 'setup.go.botvbot',
  hotseat: 'setup.go.hotseat',
};

/**
 * Starting a game (a variant card on the home page), design "Önce Rakip": who you play first —
 * online (a random opponent or a friend) or on this device (the computer, bot against bot, two
 * people) — then only the options that opponent needs: the variant, the time, your colour, the
 * computer's level, rated or not. The dialog keeps one size; the options share its height.
 */
export function VariantPlayDialog({
  variant,
  lobby,
  onOpenGame,
  initial,
  onStart,
  onClose,
}: {
  /** The saved settings: games on this device start from them. */
  initial: GameSettings;
  variant: VariantDefinition;
  lobby: Lobby;
  onOpenGame: (id: string) => void;
  /** Starts a game on this device with these settings. */
  onStart: (patch: Partial<GameSettings>) => void;
  onClose: () => void;
}) {
  const { t, vt } = useI18n();
  const account = useAccount();
  const [opponent, setOpponent] = useState<Opponent>('online');
  const [variantId, setVariantId] = useState(variant.id);
  // Online games and games on this device keep their own time and colour (the latter saved).
  const [onlineTime, setOnlineTime] = useState('5+0');
  const [localTime, setLocalTime] = useState(initial.timeControl);
  const [onlineColor, setOnlineColor] = useState<Color | 'random'>('random');
  const [localColor, setLocalColor] = useState<Color | 'random'>(initial.humanColor);
  const [rated, setRated] = useState(true);
  const [botLevel, setBotLevel] = useState(initial.botLevel);
  const [whiteLevel, setWhiteLevel] = useState(initial.whiteLevel);
  const [blackLevel, setBlackLevel] = useState(initial.blackLevel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const waiting = !!lobby.mySeek && !lobby.seeks.find((s) => s.id === lobby.mySeek)?.quick;
  const online = opponent === 'online' || opponent === 'friend';
  const isRated = online && !!account.user && rated;
  const timeControlId = online ? onlineTime : localTime;
  const setTimeControlId = online ? setOnlineTime : setLocalTime;
  const color = online ? onlineColor : localColor;
  const setColor = online ? setOnlineColor : setLocalColor;

  const go = async () => {
    setError(null);
    if (opponent === 'online') return lobby.seek({ variantId, timeControlId, color, rated: isRated });
    if (opponent === 'friend') {
      setBusy(true);
      try {
        const ticket = await createOnlineGame({
          variantId,
          timeControlId,
          color,
          playerId: playerIdentity().id,
          rated: isRated,
        });
        onOpenGame(ticket.gameId);
      } catch (e) {
        setError(e instanceof ApiError && e.code !== 'network' ? 'online.error.create' : 'online.error.network');
        setBusy(false);
      }
      return;
    }
    if (opponent === 'bot')
      return onStart({ mode: 'bot', variantId, botLevel, humanColor: color, timeControl: timeControlId });
    if (opponent === 'botvbot') return onStart({ mode: 'botvbot', variantId, whiteLevel, blackLevel });
    onStart({ mode: 'hotseat', variantId, timeControl: timeControlId });
  };

  const colorLabel = (c: Color | 'random') => (c === 'random' ? t('online.random') : t(`color.${c}`));
  const timeLabel = (id: string) =>
    id === 'none' ? t('time.none') : (TIME_CONTROLS.find((tc) => tc.id === id)?.label ?? id);
  const levels = (value: number, set: (n: number) => void, label: string) => (
    <div className="setup-group">
      <span className="setup-label">{label}</span>
      <div className="setup-levels">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => set(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
  const chips = <T extends string>(items: readonly T[], value: T, set: (v: T) => void, label: (v: T) => string) => (
    <div className="setup-chips">
      {items.map((v) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>
          {label(v)}
        </button>
      ))}
    </div>
  );
  const summary = [
    vt(getVariant(variantId)).name,
    opponent === 'bot'
      ? t('setup.levelShort', { n: String(botLevel) })
      : opponent === 'botvbot'
        ? `${whiteLevel} vs ${blackLevel}`
        : timeLabel(timeControlId),
    online ? t(isRated ? 'lobby.rated' : 'lobby.casual') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // How much room the options get: the computer has the most of them, two people the fewest.
  const density = opponent === 'bot' ? 'dense' : opponent === 'hotseat' ? 'roomy' : 'airy';

  return (
    <Modal label={t('setup.title')} onClose={onClose} className="game-setup">
      <div className="setup-head">
        <h2>{t('setup.title')}</h2>
        <button type="button" className="setup-close" onClick={onClose} aria-label={t('war.alert.close')}>
          ✕
        </button>
      </div>
      <div className="setup-opponents">
        {GROUPS.map(([label, list]) => (
          <div key={label} className={`setup-opp-group n${list.length}`}>
            <span className="setup-label">{t(label)}</span>
            <div className="setup-opp-row">
              {list.map((o) => (
                <button key={o} type="button" aria-pressed={opponent === o} onClick={() => setOpponent(o)}>
                  <svg viewBox="0 0 30 30" aria-hidden="true">
                    <path d={OPPONENT_ICONS[o]} />
                  </svg>
                  {t(`setup.opp.${o}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`setup-main ${density}`}>
        <div className="setup-group">
          <span className="setup-label">{t('newGame.variant')}</span>
          <div className="setup-variants">
            {listVariants().map((v, i) => (
              <button
                key={v.id}
                type="button"
                className={i % 2 ? 'lime' : ''}
                aria-pressed={variantId === v.id}
                onClick={() => setVariantId(v.id)}
              >
                {v.emblem && (
                  <svg viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: v.emblem }} />
                )}
                <b>{vt(v).name}</b>
              </button>
            ))}
          </div>
        </div>
        {opponent === 'bot' && levels(botLevel, setBotLevel, t('setup.botLevel'))}
        {opponent === 'botvbot' && levels(whiteLevel, setWhiteLevel, t('setup.whiteBot'))}
        {opponent === 'botvbot' && levels(blackLevel, setBlackLevel, t('setup.blackBot'))}
        {opponent !== 'botvbot' && (
          <div className="setup-group">
            <span className="setup-label">{t('newGame.time')}</span>
            {chips(
              TIME_CONTROLS.map((tc) => tc.id),
              timeControlId,
              setTimeControlId,
              timeLabel,
            )}
          </div>
        )}
        {(online || opponent === 'bot') && (
          <div className="setup-group">
            <span className="setup-label">{t('online.color')}</span>
            {chips(['w', 'random', 'b'] as const, color, setColor, colorLabel)}
          </div>
        )}
        {opponent === 'hotseat' && <p className="setup-note">{t('setup.hotseatNote')}</p>}
        {error && <p className="error">{t(error)}</p>}
        {lobby.error && opponent === 'online' && <p className="error">{t(`lobby.error.${lobby.error}`)}</p>}
      </div>
      <div className="setup-foot">
        {online && account.user && (
          <button type="button" className="setup-toggle" aria-pressed={rated} onClick={() => setRated(!rated)}>
            <i aria-hidden="true" />
            {t(rated ? 'lobby.rated' : 'lobby.casual')}
          </button>
        )}
        {opponent === 'online' && waiting ? (
          <div className="setup-waiting">
            <span>{t('lobby.searching')}</span>
            <button type="button" onClick={lobby.cancel}>
              {t('lobby.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="setup-go"
            disabled={busy || (opponent === 'online' && lobby.status !== 'open')}
            onClick={() => void go()}
          >
            {busy ? t('online.creating') : t(GO[opponent])}
            <small>{summary}</small>
          </button>
        )}
      </div>
    </Modal>
  );
}

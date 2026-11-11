import { useLayoutEffect, useRef, useState } from 'react';
import { listVariants } from '../engine/index.ts';
import type { Color, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';
import { Modal } from './Modal.tsx';
import { TimePicker } from './PlayOptions.tsx';
import { ApiError, createOnlineGame } from './online/connection.ts';
import type { Lobby } from './online/LobbyPage.tsx';
import { playerIdentity } from './online/lobbyConnection.ts';
import type { GameSettings } from './settings.ts';

export type Opponent = 'online' | 'friend' | 'bot' | 'botvbot' | 'hotseat';

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

/** The dialog's own size (src/ui/styles.css, .modal.play-setup), which it scales from. */
const BASE = { w: 580, h: 360 };

/**
 * How much the dialog is scaled, given its own height `contentH` (at its own size, as tall as
 * its content needs, at least BASE.h): on a large screen up to about 60% of the window's width
 * and 75% of its height, at most twice its size; and always small enough that the whole of it
 * fits the window's height, down to 55% (phones too, where it stacks), so nothing ever scrolls.
 */
export function dialogScale(width: number, height: number, contentH: number = BASE.h): number {
  const room = (height - 24) / contentH;
  const grow = width <= 620 ? 1 : Math.min(2, (width * 0.6) / BASE.w, ((height - 48) * 0.75) / contentH);
  return Math.round(Math.max(0.55, Math.min(Math.max(1, grow), room)) * 100) / 100;
}

/** Scales the dialog (CSS zoom) to its content and the window, after every render and resize. */
function useDialogFit() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const modal = ref.current?.parentElement;
      if (!modal) return;
      modal.style.zoom = '1';
      modal.style.zoom = String(dialogScale(innerWidth, innerHeight, modal.offsetHeight));
    };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  });
  return ref;
}

/**
 * Starting a game (a variant card on the home page), design "İki Sütun": who you play on the
 * left — online (a random opponent or a friend) or on this device (the computer, bot against bot,
 * two people) — and on the right only the options that opponent needs: the variant (its emblem),
 * the time, your colour (the colour itself), the computer's level, rated or not. One size
 * whoever the opponent; phones stack it.
 */
export function VariantPlayDialog({
  variant,
  lobby,
  onOpenGame,
  initial,
  opponent: firstOpponent = 'online',
  onStart,
  onClose,
}: {
  /** The opponent picked when it opens (the home page's "play the computer" opens on it). */
  opponent?: Opponent;
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
  const sideRef = useDialogFit();
  const [opponent, setOpponent] = useState<Opponent>(firstOpponent);
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
  const levels = (value: number, set: (n: number) => void, label: string) => (
    <div className="ps-group">
      <span className="ps-label">{label}</span>
      <div className="ps-levels">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => set(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
  // Your colour as the colour itself: white, half and half (random), black.
  const colors = (
    <div className="ps-group">
      <span className="ps-label">{t('online.color')}</span>
      <div className="ps-colorrow">
        <div className="ps-colors">
          {(['w', 'random', 'b'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`ps-swatch ${c}`}
              aria-pressed={color === c}
              aria-label={colorLabel(c)}
              title={colorLabel(c)}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        {online && account.user && (
          <button type="button" className="setup-toggle" aria-pressed={rated} onClick={() => setRated(!rated)}>
            <i aria-hidden="true" />
            {t(rated ? 'lobby.rated' : 'lobby.casual')}
          </button>
        )}
      </div>
    </div>
  );
  const time = <TimePicker value={timeControlId} onChange={setTimeControlId} />;

  return (
    <Modal label={t('setup.title')} onClose={onClose} className="play-setup">
      {/* Design "İki Sütun": who you play on the left, only that opponent's options on the right,
          everything centred; one size whoever the opponent. */}
      <aside className="ps-side" ref={sideRef}>
        <h2>{t('setup.title')}</h2>
        {GROUPS.map(([label, list]) => (
          <div key={label} className="ps-opp-group">
            <span className="ps-label">{t(label)}</span>
            {list.map((o) => (
              <button
                key={o}
                type="button"
                className="ps-opp"
                aria-label={t(`setup.opp.${o}` as MessageKey)}
                aria-pressed={opponent === o}
                onClick={() => setOpponent(o)}
              >
                <svg viewBox="0 0 30 30" aria-hidden="true">
                  <path d={OPPONENT_ICONS[o]} />
                </svg>
                <span>
                  <b>{t(`setup.opp.${o}` as MessageKey)}</b>
                  <small>{t(`setup.desc.${o}` as MessageKey)}</small>
                </span>
              </button>
            ))}
          </div>
        ))}
      </aside>
      <div className="ps-main">
        <button type="button" className="setup-close" onClick={onClose} aria-label={t('war.alert.close')}>
          ✕
        </button>
        <div className="ps-group">
          <span className="ps-label">{t('newGame.variant')}</span>
          <div className="ps-variants">
            {listVariants().map((v) => (
              <button key={v.id} type="button" aria-pressed={variantId === v.id} onClick={() => setVariantId(v.id)}>
                {v.emblem && (
                  <svg viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: v.emblem }} />
                )}
                <b>{vt(v).name}</b>
              </button>
            ))}
          </div>
        </div>
        {opponent === 'botvbot' && levels(whiteLevel, setWhiteLevel, t('setup.whiteBot'))}
        {opponent === 'botvbot' && levels(blackLevel, setBlackLevel, t('setup.blackBot'))}
        {opponent !== 'botvbot' && time}
        {opponent === 'bot' ? (
          // The computer's level and your colour share a row (the dialog keeps its height).
          <div className="ps-pair">
            {levels(botLevel, setBotLevel, t('setup.botLevel'))}
            {colors}
          </div>
        ) : (
          online && colors
        )}
        {opponent === 'hotseat' && <p className="ps-note">{t('setup.hotseatNote')}</p>}
        {error && <p className="error">{t(error)}</p>}
        {lobby.error && opponent === 'online' && <p className="error">{t(`lobby.error.${lobby.error}`)}</p>}
        <div className="ps-foot">
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
              className="ps-go"
              disabled={busy || (opponent === 'online' && lobby.status !== 'open')}
              onClick={() => void go()}
            >
              {busy ? t('online.creating') : t(GO[opponent])}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

import type { MessageKey } from '../i18n/index.ts';
import { useI18n } from './i18n.tsx';
import { Modal } from './Modal.tsx';
import type { Prefs, Switch } from './prefs.ts';

type Toggle = Switch | 'sound' | 'stickers';

interface Props {
  prefs: Prefs;
  onPrefs: (update: (p: Prefs) => Prefs) => void;
  onClose: () => void;
}

const GROUPS: { title: MessageKey; switches: { key: Toggle; note?: MessageKey }[] }[] = [
  {
    title: 'prefs.game',
    switches: [
      { key: 'autoQueen', note: 'prefs.autoQueen.note' },
      { key: 'premoves', note: 'prefs.premoves.note' },
    ],
  },
  { title: 'prefs.board', switches: [{ key: 'moveHints' }, { key: 'coordinates' }, { key: 'lastMove' }] },
  {
    title: 'prefs.soundGroup',
    switches: [{ key: 'sound' }, { key: 'stickers', note: 'prefs.stickers.note' }],
  },
];

/** Preferences: how the game behaves and sounds (the look is in the settings dialog). */
export function PreferencesDialog({ prefs, onPrefs, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Modal label={t('prefs.title')} className="settings" onClose={onClose}>
      <h2>{t('prefs.title')}</h2>
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="prefs-group">{t(group.title)}</h3>
          {group.switches.map(({ key, note }) => (
            <div key={key}>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => onPrefs((p) => ({ ...p, [key]: !p[key] }))}
                />
                <span className="switch" aria-hidden="true" />
                {t(`prefs.${key}` as MessageKey)}
              </label>
              {note && <p className="prefs-note">{t(note)}</p>}
            </div>
          ))}
        </section>
      ))}
      <div className="modal-actions">
        <button className="primary" onClick={onClose} data-autofocus>
          {t('close')}
        </button>
      </div>
    </Modal>
  );
}

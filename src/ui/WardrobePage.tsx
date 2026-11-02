import { useState } from 'react';
import { DEFAULT_AVATAR } from '../avatar/avatar.ts';
import { figureSvg, itemView } from '../avatar/figure.ts';
import { EMPTY_OUTFIT, STORE_ITEMS, STORE_SLOTS, wearKombin } from '../avatar/outfit.ts';
import type { Outfit, OutfitSlot } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { signInWithGoogle, useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';
import { useShop } from './shop.tsx';

const Figure = ({ svg, className }: { svg: string; className: string }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
);

/**
 * The wardrobe ("Dolabım", design "Kombin Kartları"): the outfit worn now and the three saved
 * ones as cards (put one on, or save over it), then everything the player owns by kind, worn
 * or taken off with a tap. Only clothes: the hair and beard stay at the barber's. Phones: the
 * worn outfit beside a column of the saved ones, the kinds as a strip, the clothes below.
 */
export function WardrobePage({ onOpen }: { onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const avatar = account.user?.avatar ?? DEFAULT_AVATAR;
  const [slot, setSlot] = useState<OutfitSlot>('jacket');
  const { store, msg, name, act, busy, wearSaved, saveKombin } = useShop();

  if (!account.loading && !account.user) {
    return (
      <main className="store-page">
        <h1 className="store-title">{t('wardrobe.title')}</h1>
        <p className="muted">{t('wardrobe.signIn')}</p>
        {account.canSignIn && (
          <button className="primary" onClick={() => signInWithGoogle('/wardrobe')}>
            {t('account.signIn')}
          </button>
        )}
      </main>
    );
  }

  const worn = store?.outfit ?? EMPTY_OUTFIT;
  const mine = STORE_ITEMS.filter((i) => i.slot === slot && store?.owned.has(i.id));
  // A saved outfit is "on" when the clothes worn now are exactly its clothes.
  const isOn = (k: Outfit) => STORE_SLOTS.every((s) => wearKombin(worn, k)[s] === worn[s]);

  return (
    <main className="store-page">
      <div className="wardrobe">
        <div className="wardrobe-looks">
          <div className="wardrobe-card now">
            <span className="store-label">{t('wardrobe.now')}</span>
            <Figure svg={figureSvg(avatar, worn)} className="wardrobe-fig" />
            <h1 className="wardrobe-title">{t('wardrobe.title')}</h1>
          </div>
          <div className="wardrobe-kombins">
            {(store?.kombins ?? [null, null, null]).map((k, i) =>
              k ? (
                <div key={i} className={isOn(k) ? 'wardrobe-card kombin on' : 'wardrobe-card kombin'}>
                  <Figure svg={figureSvg(avatar, wearKombin(worn, k))} className="wardrobe-fig" />
                  <b>{t('wardrobe.kombin', { n: String(i + 1) })}</b>
                  <div className="wardrobe-acts">
                    <button className="store-buy" disabled={busy || isOn(k)} onClick={() => void wearSaved(i)}>
                      {t('store.wear')}
                    </button>
                    <button className="wardrobe-save" disabled={busy} onClick={() => void saveKombin(i)}>
                      {t('wardrobe.saveOver')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  key={i}
                  className="wardrobe-card kombin empty"
                  disabled={!store || busy}
                  onClick={() => void saveKombin(i)}
                >
                  <span className="wardrobe-plus" aria-hidden="true">
                    +
                  </span>
                  <b>{t('wardrobe.kombin', { n: String(i + 1) })}</b>
                  <span>{t('wardrobe.saveNow')}</span>
                </button>
              ),
            )}
          </div>
        </div>
        <div className="wardrobe-tabs" role="tablist">
          {STORE_SLOTS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={slot === s}
              className={slot === s ? 'on' : ''}
              onClick={() => setSlot(s)}
            >
              {t(`store.slot.${s}` as MessageKey)}
            </button>
          ))}
          <p className={msg?.bad ? 'store-msg bad' : 'store-msg'} role="status">
            {msg?.text ?? ''}
          </p>
        </div>
        <div className="wardrobe-grid" role="tabpanel">
          {mine.map((item) => (
            <button
              key={item.id}
              className="wardrobe-item"
              aria-pressed={worn[item.slot] === item.id}
              disabled={busy}
              onClick={() => void act(item)}
            >
              <Figure
                svg={figureSvg(avatar, { ...EMPTY_OUTFIT, [item.slot]: item.id }, itemView(item.slot, item.id))}
                className="store-pic"
              />
              <b>{name(item.id)}</b>
              <span>{worn[item.slot] === item.id ? t('wardrobe.wearing') : t('store.wear')}</span>
            </button>
          ))}
          {store && mine.length === 0 && (
            <div className="wardrobe-none">
              <span>{t('wardrobe.none')}</span>
              <button className="link-button" onClick={() => onOpen('/store')}>
                {t('store.title')} →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

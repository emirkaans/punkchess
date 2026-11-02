import { useEffect, useState } from 'react';
import { useCoins } from './coins.ts';
import { useI18n } from './i18n.tsx';

/** A coin glyph: a round punk coin with a crown. */
export function CoinIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`coin-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#c6ff3d" stroke="#0a0a0b" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#0a0a0b" strokeWidth="1" opacity=".5" />
      <path d="M7.5 15l1-6 2.2 2.6L12 8l1.3 3.6L15.5 9l1 6z" fill="#0a0a0b" />
    </svg>
  );
}

/** "+N punk coin" for a few seconds after earning some (src/ui/coins.ts). */
export function CoinToast() {
  const { t } = useI18n();
  const { news } = useCoins();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!news) return;
    setShown(news.key);
    const id = setTimeout(() => setShown(null), 3500);
    return () => clearTimeout(id);
  }, [news]);
  if (!news || shown !== news.key) return null;
  return (
    <div className="coin-toast" role="status" key={news.key}>
      <CoinIcon />
      <b>+{news.amount}</b> {t('coins.name')}
    </div>
  );
}

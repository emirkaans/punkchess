import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportError } from './errorReport.ts';
import { useI18n } from './i18n.tsx';
import { useServerDown } from './serverStatus.ts';

/** The page that broke (design 1A "Patlama"): a fallen king, BOOM, reload or go home. */
function Crashed() {
  const { t } = useI18n();
  return (
    <div className="crash" role="alert">
      <a className="crash-logo" href="/">
        punk<span>chess</span>
      </a>
      <span className="crash-king" aria-hidden="true">
        ♚
      </span>
      <div className="crash-boom">{t('crash.title')}</div>
      <p>{t('crash.body')}</p>
      <div className="crash-btns">
        <button className="crash-reload" onClick={() => location.reload()}>
          {t('crash.reload')}
        </button>
        <a className="crash-home" href="/">
          {t('crash.home')}
        </a>
      </div>
    </div>
  );
}

/**
 * Catches an error while the page is drawn: instead of an empty screen, the crash page; the error
 * is reported like any other (src/ui/errorReport.ts).
 */
export class CrashGuard extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const e = error as Error | undefined;
    reportError(String(e?.message ?? error), `${e?.stack ?? ''}\n${info.componentStack ?? ''}`);
  }

  render() {
    return this.state.crashed ? <Crashed /> : this.props.children;
  }
}

/** The strip at the top while the server does not answer (design 2B). */
export function ServerStrip({ onBot }: { onBot: () => void }) {
  const { t } = useI18n();
  const down = useServerDown();
  if (!down) return null;
  return (
    <div className="server-strip" role="status">
      <span className="server-dot" aria-hidden="true" />
      <span>
        {t('server.down')} <small>· {t('server.retry')}</small>
      </span>
      <button onClick={onBot}>{t('server.bot')} →</button>
    </div>
  );
}

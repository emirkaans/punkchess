import { signInWithGoogle, useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';

/**
 * The door of a page that needs an account (the store, the barber, the wardrobe, the
 * character): its name, why to sign in and the sign-in button, in the middle of the screen.
 */
export function SignInGate({ title, text, returnTo }: { title: string; text: string; returnTo: string }) {
  const { t } = useI18n();
  const account = useAccount();
  return (
    <main className="signin-gate">
      <div className="signin-card">
        <i className="signin-drip" style={{ left: '14%', animationDelay: '0.1s' }} aria-hidden="true" />
        <i className="signin-drip" style={{ left: '78%', animationDelay: '0.35s' }} aria-hidden="true" />
        <svg className="signin-crown" viewBox="0 0 150 104" aria-hidden="true">
          <path d="M12 92 L12 22 L48 56 L75 12 L102 56 L138 22 L138 92 Z" />
        </svg>
        <h1 className="signin-title">{title}</h1>
        <p className="signin-text">{text}</p>
        {account.canSignIn && (
          <>
            <button className="signin-google" onClick={() => signInWithGoogle(returnTo)}>
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.8-6.1z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"
                />
              </svg>
              {t('account.signIn')}
            </button>
            <p className="signin-free">{t('account.gateFree')}</p>
          </>
        )}
      </div>
    </main>
  );
}

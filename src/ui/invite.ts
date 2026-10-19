// Invite links: punkchess.com/?ref=<username>. Opening one remembers the
// inviter for 30 days in a cookie that the account sign-up reads
// (server/auth.ts), and takes the parameter out of the address.

const REF_COOKIE = 'pc_ref';
const DAYS = 30;

/** An invite link to send friends. */
export const inviteLink = (username: string): string => `${location.origin}/?ref=${encodeURIComponent(username)}`;

/** Remembers the inviter of a link this page was opened with. */
export function keepInviter(): void {
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref === null) return;
  if (/^[A-Za-z0-9_-]{3,20}$/.test(ref)) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${REF_COOKIE}=${ref}; Max-Age=${DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
  }
  params.delete('ref');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
}

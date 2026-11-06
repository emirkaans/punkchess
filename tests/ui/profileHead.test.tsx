// @vitest-environment happy-dom
// The profile's head (design "Vitrin"): the character in full, the character and wardrobe buttons
// on one's own profile, and the rename tucked away in the account menu behind the gear.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ProfilePage } = await import('../../src/ui/ProfilePage.tsx');
const { refreshAccount } = await import('../../src/ui/account.ts');

const profile = (username: string) => ({
  username,
  createdAt: Date.UTC(2026, 9, 12),
  games: 3,
  ratings: [],
  patches: [],
  followers: 0,
  following: 0,
  followed: false,
  nemesis: null,
  victim: null,
  gang: null,
  jacket: 'denim-storm',
  tag: 'drip',
  avatar: null,
  outfit: null,
  stats: {},
});

function serve(me: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.startsWith('/api/me')) return json(me ? { user: { username: me } } : {});
      const m = /^\/api\/users\/([^/?]+)$/.exec(url);
      if (m) return json(profile(decodeURIComponent(m[1])));
      if (url.includes('/games')) return json({ games: [], more: false });
      return new Response('{}', { status: 404 });
    }),
  );
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe('profile head', () => {
  it('shows the full figure; on one’s own profile, the buttons and the rename behind the gear', async () => {
    serve('MrPunk');
    await refreshAccount();
    const onOpen = vi.fn();
    const { container } = render(<ProfilePage username="MrPunk" onOpen={onOpen} />);
    await screen.findByRole('heading', { name: 'MrPunk' });

    // The whole figure (200×360), not the round head.
    expect(container.querySelector('.profile-figure svg')?.getAttribute('viewBox')).toBe('0 0 200 360');

    // The rename is not out in the open.
    expect(screen.queryByText('Adını değiştir')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Karakterini düzenle/ }));
    expect(onOpen).toHaveBeenCalledWith('/character');
    fireEvent.click(screen.getByRole('button', { name: /Dolabım/ }));
    expect(onOpen).toHaveBeenCalledWith('/wardrobe');

    fireEvent.click(screen.getByRole('button', { name: 'Hesap' }));
    expect(screen.getByRole('menuitem', { name: 'Adını değiştir' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Hesap ayarları' })).toBeTruthy();
  });

  it('someone else’s profile has no character buttons and no account menu', async () => {
    serve('MrPunk');
    await refreshAccount();
    render(<ProfilePage username="AdaPunk" onOpen={() => {}} />);
    await screen.findByRole('heading', { name: 'AdaPunk' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Karakterini düzenle/ })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Hesap' })).toBeNull();
  });
});

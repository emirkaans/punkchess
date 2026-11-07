// @vitest-environment happy-dom
// When things break: the crash page instead of an empty screen, the strip while the server does
// not answer, and the Worker's own outage page.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { outagePage } from '../../server/outage.ts';

const { CrashGuard, ServerStrip } = await import('../../src/ui/CrashScreen.tsx');
const { noteServer } = await import('../../src/ui/serverStatus.ts');

afterEach(cleanup);

function Boom(): never {
  throw new Error('kaboom');
}

describe('kesinti ve hata ekranları', () => {
  it('sayfa patlarsa boş ekran yerine BOOM, Yenile ve Ana sayfa; hata bildirilir', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sent = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    render(
      <CrashGuard>
        <Boom />
      </CrashGuard>,
    );
    expect(screen.getByRole('alert').textContent).toContain('BOOM!');
    expect(screen.getByText(/Kayıt bize geldi/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yenile' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ana sayfa' })).toBeTruthy();
    expect(sent.mock.calls.some(([url]) => url === '/api/errors')).toBe(true);
    vi.restoreAllMocks();
  });

  it('sunucu cevap vermezse şerit çıkar, cevap verince kaybolur', () => {
    const onBot = vi.fn();
    render(<ServerStrip onBot={onBot} />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => noteServer(false));
    expect(screen.getByRole('status').textContent).toContain('Sunucu cevap vermiyor');
    screen.getByRole('button').click();
    expect(onBot).toHaveBeenCalled();
    act(() => noteServer(true));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sunucunun kesinti sayfası: 503, tarayıcının diline göre, 30 saniyede bir yenilenir', async () => {
    const tr = outagePage(new Request('https://punkchess.com/', { headers: { 'accept-language': 'tr-TR,tr;q=0.9' } }));
    expect(tr.status).toBe(503);
    const html = await tr.text();
    expect(html).toContain('KISA BİR ARA');
    expect(html).toContain('http-equiv="refresh" content="30"');
    const en = await outagePage(
      new Request('https://punkchess.com/', { headers: { 'accept-language': 'en-US,en;q=0.9' } }),
    ).text();
    expect(en).toContain('SHORT BREAK');
  });
});

// @vitest-environment happy-dom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../src/ui/i18n.tsx';

describe('the tab title', () => {
  it('follows the language, and leaves a page title of its own alone', async () => {
    document.title = 'punkchess · Ücretsiz online satranç ve varyantları';
    const { rerender } = render(<I18nProvider locale="en">x</I18nProvider>);
    expect(document.title).toBe('punkchess · Free online chess and variants');
    expect(document.documentElement.lang).toBe('en');

    rerender(<I18nProvider locale="de">x</I18nProvider>);
    await waitFor(() => expect(document.title).toBe('punkchess · Kostenloses Online-Schach und Varianten'));
    expect(document.documentElement.lang).toBe('de');

    document.title = 'Privacy · punkchess';
    rerender(<I18nProvider locale="tr">x</I18nProvider>);
    expect(document.title).toBe('Privacy · punkchess');
    expect(document.documentElement.lang).toBe('tr');
  });
});

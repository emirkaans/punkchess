import { describe, expect, it } from 'vitest';
import { CONTACT_MESSAGE_MAX, cleanContact } from '../src/online/contact.ts';
import { parseRoute, pathOf } from '../src/ui/routes.ts';
import { limitKind } from '../server/limits.ts';

describe('iletişim formu', () => {
  const ok = { topic: 'bug', name: ' Ali ', email: 'ali@example.com', message: 'Tahta yüklenmiyor, yardım!' };

  it('geçerli mesajı temizler', () => {
    expect(cleanContact(ok)).toEqual({
      topic: 'bug',
      name: 'Ali',
      email: 'ali@example.com',
      message: 'Tahta yüklenmiyor, yardım!',
    });
  });

  it('ad ve e-posta isteğe bağlı', () => {
    expect(cleanContact({ ...ok, name: '', email: '  ' })).toMatchObject({ name: null, email: null });
  });

  it('bozuk girdileri reddeder', () => {
    expect(cleanContact({ ...ok, topic: 'spam' })).toEqual({ problem: 'topic' });
    expect(cleanContact({ ...ok, email: 'ali@' })).toEqual({ problem: 'email' });
    expect(cleanContact({ ...ok, message: 'kısa' })).toEqual({ problem: 'short' });
    expect(cleanContact({ ...ok, message: 'x'.repeat(CONTACT_MESSAGE_MAX + 1) })).toEqual({ problem: 'long' });
    expect(cleanContact(null)).toEqual({ problem: 'topic' });
  });

  it('sayfa adresi oyun kimliği sanılmaz', () => {
    expect(parseRoute('/contact')).toEqual({ kind: 'contact' });
    expect(pathOf({ kind: 'contact' })).toBe('/contact');
  });

  it('gönderim sıkı istek sınırına girer', () => {
    expect(limitKind('POST', '/api/contact')).toBe('create');
  });
});

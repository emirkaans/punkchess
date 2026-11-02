import { describe, expect, it } from 'vitest';
import { deviceOf, isBot, isPageKind } from '../src/online/traffic.ts';

describe('site analizi', () => {
  it('sayfa türü sadece küçük harf; botlar sayılmaz; cihaz türü tarayıcıdan', () => {
    expect(isPageKind('store')).toBe(true);
    expect(isPageKind('/@/ali')).toBe(false);
    expect(isPageKind('x')).toBe(false);
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148')).toBe(false);
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148')).toBe('phone');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });
});

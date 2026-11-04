import { describe, expect, it } from 'vitest';
import { keyMatches } from '../server/auth-util.ts';
import { MAX_HISTORY_DAYS, historyDays, reportDue } from '../src/online/report.ts';

describe('günlük rapor anahtarı', () => {
  it('doğru anahtar kabul edilir', async () => {
    expect(await keyMatches('Bearer gizli', 'gizli')).toBe(true);
  });

  it('yanlış, eksik ya da tanımsız anahtar reddedilir', async () => {
    expect(await keyMatches('Bearer yanlis', 'gizli')).toBe(false);
    expect(await keyMatches('gizli', 'gizli')).toBe(false);
    expect(await keyMatches(null, 'gizli')).toBe(false);
    expect(await keyMatches('Bearer ', '')).toBe(false);
    expect(await keyMatches('Bearer x', undefined)).toBe(false);
  });
});

describe('günlük raporun saklanması', () => {
  // 2026-11-04 in UTC; Turkey is UTC+3.
  const at = (utcHour: number, min = 0) => Date.UTC(2026, 10, 4, utcHour, min);

  it('Türkiye saatiyle 23:00 ile gece yarısı arasında saklanır', () => {
    expect(reportDue(at(19, 55))).toBe(false);
    expect(reportDue(at(20, 0))).toBe(true);
    expect(reportDue(at(20, 55))).toBe(true);
    expect(reportDue(at(21, 0))).toBe(false);
  });

  it('geçmiş gün sayısı 1 ile üst sınır arasında kalır', () => {
    expect(historyDays(null)).toBe(7);
    expect(historyDays('30')).toBe(30);
    expect(historyDays('0')).toBe(1);
    expect(historyDays('9999')).toBe(MAX_HISTORY_DAYS);
    expect(historyDays('abc')).toBe(7);
  });
});

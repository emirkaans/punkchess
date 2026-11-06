// Browser side of punk coins: the signed-in player's balance (shared by every component) and
// the "+N" news after earning some (src/ui/CoinToast.tsx shows it).

import { useSyncExternalStore } from 'react';
import type { CoinsResponse } from '../coins/rules.ts';
import { loadPrefs } from './prefs.ts';
import { playSound } from './sound.ts';
import { refreshQuests } from './quests.ts';

interface CoinState {
  /** The balance; null until asked (or signed out). */
  readonly balance: number | null;
  /** The latest earning, for the toast; `key` changes with every one. */
  readonly news: { readonly key: number; readonly amount: number } | null;
}

let state: CoinState = { balance: null, news: null };
const listeners = new Set<() => void>();
const set = (next: CoinState) => {
  state = next;
  for (const l of listeners) l();
};

/** Asks the server for the balance (again); signed out, it is forgotten. */
export async function refreshCoins(): Promise<void> {
  try {
    const res = await fetch('/api/me/coins', { credentials: 'same-origin' });
    const data = res.ok ? ((await res.json()) as CoinsResponse) : null;
    set({ ...state, balance: data ? data.balance : null });
  } catch {
    // keep what we had
  }
}

/** Coins just earned (`amount` from a server answer): the balance goes up, the toast shows and a coin rings (sound on). */
export function noteCoins(amount: number | undefined | null): void {
  if (!amount || amount <= 0) return;
  set({
    balance: state.balance === null ? null : state.balance + amount,
    news: { key: (state.news?.key ?? 0) + 1, amount },
  });
  if (loadPrefs().sound) playSound('coin');
  if (state.balance === null) void refreshCoins();
  // Whatever paid may have counted for a quest too (and finished one: its toast).
  void refreshQuests();
}

export function useCoins(): CoinState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

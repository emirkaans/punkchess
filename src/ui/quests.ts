// Browser side of the daily quests (server/quests.ts): today's quests of the signed-in player,
// shared by every component, and the news when one gets done (src/ui/QuestsCard.tsx shows it).

import { useSyncExternalStore } from 'react';
import type { QuestsResponse } from '../quests/rules.ts';

interface QuestState {
  /** Today's quests; null until asked (or signed out). */
  readonly data: QuestsResponse | null;
  /** The quest just done, for the toast; `key` changes with every one. */
  readonly news: { readonly key: number; readonly id: string; readonly coins: number } | null;
}

let state: QuestState = { data: null, news: null };
const listeners = new Set<() => void>();
const set = (next: QuestState) => {
  state = next;
  for (const l of listeners) l();
};

const done = (q: QuestsResponse['quests'][number]) => q.progress >= q.target;

/** Asks the server for today's quests (again); one that got done since is news. */
export async function refreshQuests(): Promise<void> {
  try {
    const res = await fetch('/api/me/quests', { credentials: 'same-origin' });
    const data = res.ok ? ((await res.json()) as QuestsResponse) : null;
    const before = state.data;
    const fresh =
      data && before && before.day === data.day
        ? data.quests.find((q, i) => done(q) && before.quests[i]?.id === q.id && !done(before.quests[i]))
        : undefined;
    set({
      data,
      news: fresh ? { key: (state.news?.key ?? 0) + 1, id: fresh.id, coins: fresh.coins } : state.news,
    });
  } catch {
    // keep what we had
  }
}

/** Changes the quest in `slot` (once a day). */
export async function swapQuest(slot: number): Promise<boolean> {
  try {
    const res = await fetch('/api/me/quests/swap', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slot }),
    });
    if (!res.ok) return false;
    set({ ...state, data: (await res.json()) as QuestsResponse });
    return true;
  } catch {
    return false;
  }
}

export function useQuests(): QuestState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

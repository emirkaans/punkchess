// A language that is not built in (src/i18n/locales/*.ts): loaded when the language is picked,
// so the other languages' visitors do not download it. Anything missing falls back to English.

import type { RuleCardTexts, SetupQuestionTexts } from '../engine/index.ts';
import type { MessageKey } from './messages.ts';

/** A variant's texts as data (the badge functions are built from `LocalePack.badges`). */
export interface VariantPackTexts {
  readonly name?: string;
  readonly description?: readonly string[];
  readonly rules?: RuleCardTexts;
  readonly pieceNames?: Readonly<Record<string, string>>;
  readonly highlightLabel?: string;
  readonly setup?: Readonly<Record<string, SetupQuestionTexts>>;
}

export interface LocalePack {
  readonly messages: Readonly<Record<MessageKey, string>>;
  /** By variant id. */
  readonly variants: Readonly<Record<string, VariantPackTexts>>;
  readonly badges: {
    /** {name}: the Jester's default form. */
    readonly jesterNoMove: string;
    /** {name}: the opponent's last moved piece. */
    readonly jesterLast: string;
    readonly nitro: string;
  };
}

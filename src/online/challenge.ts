// Challenges from a profile: shapes of the challenge API (server/challenges.ts). Pure.

/** An open challenge is offered for this long. */
export const CHALLENGE_TTL_MS = 10 * 60_000;

/** How often a signed-in browser asks for new challenges (while its tab is visible). */
export const CHALLENGE_POLL_MS = 20_000;

export interface Challenge {
  readonly id: string;
  /** Who challenges (username). */
  readonly from: string;
  readonly gameId: string;
  readonly variantId: string;
  readonly timeControlId: string;
  readonly rated: boolean;
  readonly createdAt: number;
}

export interface ChallengeList {
  readonly challenges: readonly Challenge[];
  /** Gang wars to tell the player about (missing from older servers: none). */
  readonly wars?: readonly WarAlert[];
}

/**
 * A gang war the player should know about: their gang's war has started
 * ('live': go to the boards), or, for a founder, another gang declared war
 * on theirs ('pending': answer it on the gang's page).
 */
export interface WarAlert {
  readonly kind: 'live' | 'pending';
  readonly warId: string;
  /** The player's gang's tag, and the other gang's. */
  readonly us: string;
  readonly them: string;
  /** The boards, once live. */
  readonly tournamentId: string | null;
}

export interface ChallengeRequest {
  /** Username of the challenged player. */
  readonly to: string;
  readonly gameId: string;
  readonly variantId: string;
  readonly timeControlId: string;
  readonly rated: boolean;
}

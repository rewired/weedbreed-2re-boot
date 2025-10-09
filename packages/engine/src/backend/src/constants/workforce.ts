import { HOURS_PER_DAY } from './simConstants.ts';

export const SHIFT_MINUTES = 480 as const; // 8 hours
export const BREAK_MINUTES = 15 as const;
export const RAISE_COOLDOWN_DAYS = 180 as const;
export const RAISE_MIN_EMPLOYMENT_DAYS = 180 as const;
export const RAISE_JITTER_RANGE_DAYS = 45 as const;
export const RAISE_ACCEPT_DEFAULT_RATE_INCREASE = 0.05 as const;
export const RAISE_BONUS_DEFAULT_RATE_INCREASE = 0.03 as const;
export const RAISE_ACCEPT_DEFAULT_MORALE_BOOST = 0.06 as const;
export const RAISE_BONUS_DEFAULT_MORALE_BOOST = 0.04 as const;
export const RAISE_IGNORE_DEFAULT_MORALE_PENALTY = -0.08 as const;

export const WORKDAY_MINUTES = HOURS_PER_DAY * 60;

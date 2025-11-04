import Decimal from "decimal.js";

/**
 * Validates VestingConfig parameters to ensure they are within acceptable bounds.
 * @throws Error if any validation fails
 */
export function validateVestingConfig(config: VestingConfig): void {
  const {
    vestingStartTimestampSeconds,
    vestingDurationSeconds,
    minClaimablePercentStart: minClaimablePercent,
    maxClaimablePercentEnd: maxClaimablePercent,
    growthRate,
  } = config;

  if (vestingStartTimestampSeconds < 0) {
    throw new Error(
      `Invalid vestingStartTimestampSeconds: ${vestingStartTimestampSeconds}. Must be >= 0.`,
    );
  }

  if (vestingDurationSeconds <= 0) {
    throw new Error(
      `Invalid vestingDurationSeconds: ${vestingDurationSeconds}. Must be > 0.`,
    );
  }

  if (minClaimablePercent <= 0 || minClaimablePercent >= 100) {
    throw new Error(
      `Invalid minClaimablePercent: ${minClaimablePercent}. Must be between 0 and 100 (exclusive).`,
    );
  }

  if (maxClaimablePercent <= 0 || maxClaimablePercent > 100) {
    throw new Error(
      `Invalid maxClaimablePercent: ${maxClaimablePercent}. Must be between 0 (exclusive) and 100 (inclusive).`,
    );
  }

  if (minClaimablePercent >= maxClaimablePercent) {
    throw new Error(
      `Invalid percentage range: minClaimablePercent (${minClaimablePercent}) must be less than maxClaimablePercent (${maxClaimablePercent}).`,
    );
  }

  if (growthRate <= 0) {
    throw new Error(`Invalid growthRate: ${growthRate}. Must be > 0.`);
  }
}

export interface VestingConfig {
  // Season 4 end date - vesting start timestamp (seconds)
  vestingStartTimestampSeconds: number;

  // Vesting duration in seconds (180 days)
  vestingDurationSeconds: number;

  // Minimum claimable percentage at start (10%)
  minClaimablePercentStart: number;

  // Maximum claimable percentage at end (100%)
  maxClaimablePercentEnd: number;

  // Exponential growth rate (k value)
  // k=2.506 gives ~30% at day 90
  // Higher k = steeper curve at the end
  growthRate: number;
}

export interface VestingCalculation {
  // Current timestamp when calculation was performed
  calculatedAt: number;

  // Days elapsed since vesting start
  daysElapsed: number;

  // Percentage of allocation claimable (0-100)
  claimablePercent: number;

  // Percentage that would be forfeited (0-100)
  forfeitablePercent: number;

  // Actual claimable amount for this user
  claimableAmount: Decimal;

  // Amount that would be forfeited
  forfeitableAmount: Decimal;

  // Whether vesting is complete (day 180+)
  isFullyVested: boolean;
}

/**
 * Calculates the claimable percentage at a specific point in time using an exponential curve.
 *
 * Formula: claimablePercent = MIN + (MAX - MIN) * ((e^(k*t/T) - 1) / (e^k - 1))
 * where:
 * - MIN = minimum claimable (10%)
 * - MAX = maximum claimable (100%)
 * - k = growth rate (2.506)
 * - t = time elapsed
 * - T = total vesting duration
 *
 * @param currentTimestamp - The current timestamp in seconds
 * @param config - Vesting configuration
 * @returns Claimable percentage (capped between minClaimablePercentStart and maxClaimablePercentEnd)
 */
export function calculateClaimablePercentAtTime(
  currentTimestamp: number,
  config: VestingConfig,
): number {
  validateVestingConfig(config);

  const {
    vestingStartTimestampSeconds: vestingStartTimestamp,
    vestingDurationSeconds,
    minClaimablePercentStart: minClaimablePercent,
    maxClaimablePercentEnd: maxClaimablePercent,
    growthRate,
  } = config;

  if (currentTimestamp < vestingStartTimestamp) {
    return 0;
  }

  const elapsedSeconds = currentTimestamp - vestingStartTimestamp;

  if (elapsedSeconds >= vestingDurationSeconds) {
    return maxClaimablePercent;
  }

  // Calculate normalized time (0 to 1)
  const normalizedTime = elapsedSeconds / vestingDurationSeconds;

  // Exponential curve calculation
  const exponentialFactor =
    (Math.exp(growthRate * normalizedTime) - 1) / (Math.exp(growthRate) - 1);

  const claimablePercent =
    minClaimablePercent +
    (maxClaimablePercent - minClaimablePercent) * exponentialFactor;

  return Math.max(
    minClaimablePercent,
    Math.min(maxClaimablePercent, claimablePercent),
  );
}

/**
 * Calculates the full vesting details for a user at the current point in time.
 * This function can be called by the crank at any time to determine how much
 * a user can claim and how much they would forfeit.
 *
 * @param userAllocation - User's total allocation
 * @param currentTimestamp - Current timestamp in seconds (defaults to now)
 * @param config - Vesting configuration
 * @returns Complete vesting calculation
 */
export function calculateVestingAtTime(
  userAllocation: Decimal,
  currentTimestamp: number = Math.floor(Date.now() / 1000),
  config: VestingConfig,
): VestingCalculation {
  validateVestingConfig(config);

  if (userAllocation.isNegative()) {
    throw new Error(
      `Invalid userAllocation: ${userAllocation.toString()}. Must be >= 0.`,
    );
  }

  const {
    vestingStartTimestampSeconds: vestingStartTimestamp,
    vestingDurationSeconds,
  } = config;

  // Calculate elapsed time
  const elapsedSeconds = Math.max(0, currentTimestamp - vestingStartTimestamp);
  const daysElapsed = elapsedSeconds / (24 * 60 * 60);

  // Check if fully vested
  const isFullyVested = elapsedSeconds >= vestingDurationSeconds;

  // Calculate claimable percentage
  const claimablePercent = calculateClaimablePercentAtTime(
    currentTimestamp,
    config,
  );
  const forfeitablePercent = 100 - claimablePercent;

  // Calculate actual amounts
  const claimableAmount = userAllocation.mul(claimablePercent).div(100);
  const forfeitableAmount = userAllocation.sub(claimableAmount);

  return {
    calculatedAt: currentTimestamp,
    daysElapsed,
    claimablePercent,
    forfeitablePercent,
    claimableAmount,
    forfeitableAmount,
    isFullyVested,
  };
}

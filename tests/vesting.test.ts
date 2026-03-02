import { expect } from 'chai';
import Decimal from 'decimal.js';
import {
  calculateClaimablePercentAtTime,
  calculateVestingAtTime,
  validateVestingConfig,
  VestingConfig,
} from '../src/utils/vestingUtils';

const SECONDS_PER_DAY = 86400;

const defaultConfig: VestingConfig = {
  vestingStartTimestampSeconds: 1000000,
  vestingDurationSeconds: 180 * SECONDS_PER_DAY, // 180 days
  minClaimablePercentStart: 10,
  maxClaimablePercentEnd: 100,
  growthRate: 2.506,
};

describe('Vesting utils', () => {
  describe('validateVestingConfig', () => {
    it('accepts valid config', () => {
      expect(() => validateVestingConfig(defaultConfig)).to.not.throw();
    });

    it('rejects negative start timestamp', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, vestingStartTimestampSeconds: -1 }),
      ).to.throw('Must be >= 0');
    });

    it('rejects zero duration', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, vestingDurationSeconds: 0 }),
      ).to.throw('Must be > 0');
    });

    it('rejects minClaimablePercent >= 100', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, minClaimablePercentStart: 100 }),
      ).to.throw('Must be between 0 and 100');
    });

    it('rejects minClaimablePercent <= 0', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, minClaimablePercentStart: 0 }),
      ).to.throw('Must be between 0 and 100');
    });

    it('rejects maxClaimablePercent > 100', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, maxClaimablePercentEnd: 101 }),
      ).to.throw('Must be between 0');
    });

    it('rejects min >= max', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, minClaimablePercentStart: 50, maxClaimablePercentEnd: 50 }),
      ).to.throw('must be less than');
    });

    it('rejects zero growth rate', () => {
      expect(() =>
        validateVestingConfig({ ...defaultConfig, growthRate: 0 }),
      ).to.throw('Must be > 0');
    });
  });

  describe('calculateClaimablePercentAtTime', () => {
    it('returns 0 before vesting starts', () => {
      const result = calculateClaimablePercentAtTime(defaultConfig.vestingStartTimestampSeconds - 1, defaultConfig);
      expect(result).to.equal(0);
    });

    it('returns minClaimablePercent at vesting start', () => {
      const result = calculateClaimablePercentAtTime(defaultConfig.vestingStartTimestampSeconds, defaultConfig);
      expect(result).to.be.closeTo(defaultConfig.minClaimablePercentStart, 0.01);
    });

    it('returns maxClaimablePercent at or after vesting end', () => {
      const endTs = defaultConfig.vestingStartTimestampSeconds + defaultConfig.vestingDurationSeconds;
      const result = calculateClaimablePercentAtTime(endTs, defaultConfig);
      expect(result).to.equal(defaultConfig.maxClaimablePercentEnd);
    });

    it('returns maxClaimablePercent well after vesting end', () => {
      const wayAfter = defaultConfig.vestingStartTimestampSeconds + defaultConfig.vestingDurationSeconds + 100000;
      const result = calculateClaimablePercentAtTime(wayAfter, defaultConfig);
      expect(result).to.equal(defaultConfig.maxClaimablePercentEnd);
    });

    it('monotonically increases over time', () => {
      const start = defaultConfig.vestingStartTimestampSeconds;
      const end = start + defaultConfig.vestingDurationSeconds;
      let prev = 0;
      for (let t = start; t <= end; t += SECONDS_PER_DAY) {
        const current = calculateClaimablePercentAtTime(t, defaultConfig);
        expect(current).to.be.gte(prev);
        prev = current;
      }
    });

    it('at day 90 with k=2.506 is approximately 30%', () => {
      const day90 = defaultConfig.vestingStartTimestampSeconds + 90 * SECONDS_PER_DAY;
      const result = calculateClaimablePercentAtTime(day90, defaultConfig);
      // k=2.506 is tuned to give ~30% at day 90
      expect(result).to.be.closeTo(30, 5);
    });

    it('is between min and max at midpoint', () => {
      const midpoint =
        defaultConfig.vestingStartTimestampSeconds + defaultConfig.vestingDurationSeconds / 2;
      const result = calculateClaimablePercentAtTime(midpoint, defaultConfig);
      expect(result).to.be.gte(defaultConfig.minClaimablePercentStart);
      expect(result).to.be.lte(defaultConfig.maxClaimablePercentEnd);
    });
  });

  describe('calculateVestingAtTime', () => {
    it('returns full amount when fully vested', () => {
      const allocation = new Decimal(1000);
      const endTs = defaultConfig.vestingStartTimestampSeconds + defaultConfig.vestingDurationSeconds;
      const result = calculateVestingAtTime(allocation, endTs, defaultConfig);

      expect(result.isFullyVested).to.be.true;
      expect(result.claimablePercent).to.equal(100);
      expect(result.forfeitablePercent).to.equal(0);
      expect(result.claimableAmount.toNumber()).to.equal(1000);
      expect(result.forfeitableAmount.toNumber()).to.equal(0);
    });

    it('returns partial amounts during vesting', () => {
      const allocation = new Decimal(1000);
      const midTs = defaultConfig.vestingStartTimestampSeconds + defaultConfig.vestingDurationSeconds / 2;
      const result = calculateVestingAtTime(allocation, midTs, defaultConfig);

      expect(result.isFullyVested).to.be.false;
      expect(result.claimablePercent).to.be.gt(10);
      expect(result.claimablePercent).to.be.lt(100);
      expect(result.claimableAmount.toNumber()).to.be.gt(0);
      expect(result.claimableAmount.toNumber()).to.be.lt(1000);
      // claimable + forfeitable = total
      expect(result.claimableAmount.add(result.forfeitableAmount).toNumber()).to.be.closeTo(1000, 0.001);
    });

    it('daysElapsed is correct', () => {
      const allocation = new Decimal(100);
      const ts = defaultConfig.vestingStartTimestampSeconds + 30 * SECONDS_PER_DAY;
      const result = calculateVestingAtTime(allocation, ts, defaultConfig);
      expect(result.daysElapsed).to.be.closeTo(30, 0.001);
    });

    it('throws on negative allocation', () => {
      expect(() =>
        calculateVestingAtTime(new Decimal(-1), defaultConfig.vestingStartTimestampSeconds, defaultConfig),
      ).to.throw('Must be >= 0');
    });

    it('zero allocation returns zero amounts', () => {
      const result = calculateVestingAtTime(
        new Decimal(0),
        defaultConfig.vestingStartTimestampSeconds + SECONDS_PER_DAY,
        defaultConfig,
      );
      expect(result.claimableAmount.toNumber()).to.equal(0);
      expect(result.forfeitableAmount.toNumber()).to.equal(0);
    });
  });
});

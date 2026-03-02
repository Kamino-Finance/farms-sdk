import { expect } from 'chai';
import Decimal from 'decimal.js';
import { calculateCurrentRewardPerToken } from '../src/utils/mathUtils';
import { RewardType } from '../src/@codegen/farms/types';

// Minimal stub of RewardInfo for testing calculateCurrentRewardPerToken
function makeRewardInfo(
  points: { tsStart: bigint; rewardPerTimeUnit: bigint }[],
): any {
  return {
    rewardScheduleCurve: {
      points,
    },
  };
}

describe('mathUtils', () => {
  describe('calculateCurrentRewardPerToken', () => {
    it('returns the only point rps when a single point exists', () => {
      const rewardInfo = makeRewardInfo([
        { tsStart: 0n, rewardPerTimeUnit: 500n },
      ]);
      const result = calculateCurrentRewardPerToken(rewardInfo, new Decimal(100));
      expect(result).to.equal(500);
    });

    it('returns the latest applicable point rps', () => {
      const rewardInfo = makeRewardInfo([
        { tsStart: 0n, rewardPerTimeUnit: 100n },
        { tsStart: 50n, rewardPerTimeUnit: 200n },
        { tsStart: 100n, rewardPerTimeUnit: 300n },
      ]);

      // At t=0, first point applies
      expect(calculateCurrentRewardPerToken(rewardInfo, new Decimal(0))).to.equal(100);
      // At t=50, second point applies
      expect(calculateCurrentRewardPerToken(rewardInfo, new Decimal(50))).to.equal(200);
      // At t=75, still second point
      expect(calculateCurrentRewardPerToken(rewardInfo, new Decimal(75))).to.equal(200);
      // At t=100, third point applies
      expect(calculateCurrentRewardPerToken(rewardInfo, new Decimal(100))).to.equal(300);
      // At t=999, still third point
      expect(calculateCurrentRewardPerToken(rewardInfo, new Decimal(999))).to.equal(300);
    });

    it('handles timestamps before any point', () => {
      const rewardInfo = makeRewardInfo([
        { tsStart: 100n, rewardPerTimeUnit: 42n },
      ]);
      // Before the first point, index 0 is still selected (it's the only one)
      const result = calculateCurrentRewardPerToken(rewardInfo, new Decimal(0));
      expect(result).to.equal(42);
    });
  });
});

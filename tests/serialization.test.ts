import { expect } from 'chai';
import { address, getAddressEncoder } from '@solana/kit';
import {
  serializeConfigValue,
  serializeRewardCurvePoint,
} from '../src/utils/operations';

describe('Serialization utils', () => {
  describe('serializeConfigValue', () => {
    it('serializes reward_index=0 value=0 as 16 zero bytes', () => {
      const result = serializeConfigValue(0n, 0n);
      expect(result).to.be.instanceOf(Uint8Array);
      expect(result.length).to.equal(16);
      expect(Array.from(result)).to.deep.equal(new Array(16).fill(0));
    });

    it('serializes reward_index and value in little-endian u64', () => {
      const result = serializeConfigValue(1n, 1000n);
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(1n);
      expect(view.getBigUint64(8, true)).to.equal(1000n);
    });

    it('handles large bigint values', () => {
      const maxU64 = (1n << 64n) - 1n;
      const result = serializeConfigValue(maxU64, maxU64);
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(maxU64);
      expect(view.getBigUint64(8, true)).to.equal(maxU64);
    });

    it('reward_index=2 value=500 roundtrips correctly', () => {
      const result = serializeConfigValue(2n, 500n);
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(2n);
      expect(view.getBigUint64(8, true)).to.equal(500n);
    });
  });

  describe('serializeRewardCurvePoint', () => {
    it('serializes empty points array', () => {
      const result = serializeRewardCurvePoint(0, []);
      // 8 bytes reward_index + 4 bytes length + 0 points
      expect(result.length).to.equal(12);
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(0n);
      expect(view.getUint32(8, true)).to.equal(0);
    });

    it('serializes single point', () => {
      const result = serializeRewardCurvePoint(0, [{ startTs: 100, rps: 200 }]);
      expect(result.length).to.equal(12 + 16); // header + 1 point
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(0n); // reward_index
      expect(view.getUint32(8, true)).to.equal(1); // points count
      expect(view.getBigUint64(12, true)).to.equal(100n); // startTs
      expect(view.getBigUint64(20, true)).to.equal(200n); // rps
    });

    it('serializes multiple points', () => {
      const points = [
        { startTs: 1000, rps: 50 },
        { startTs: 2000, rps: 100 },
        { startTs: 3000, rps: 150 },
      ];
      const result = serializeRewardCurvePoint(1, points);
      expect(result.length).to.equal(12 + 16 * 3); // header + 3 points
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(1n); // reward_index
      expect(view.getUint32(8, true)).to.equal(3); // points count

      for (let i = 0; i < points.length; i++) {
        expect(view.getBigUint64(12 + 16 * i, true)).to.equal(BigInt(points[i].startTs));
        expect(view.getBigUint64(20 + 16 * i, true)).to.equal(BigInt(points[i].rps));
      }
    });

    it('reward_index is encoded correctly', () => {
      const result = serializeRewardCurvePoint(5, [{ startTs: 0, rps: 0 }]);
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(0, true)).to.equal(5n);
    });
  });
});

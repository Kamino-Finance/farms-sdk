import { expect } from 'chai';
import { address } from '@solana/kit';
import { RewardType, FarmConfigOption, LockingMode } from '../src/@codegen/farms/types';

describe('Codama enum types', () => {
  describe('RewardType', () => {
    it('Proportional is 0', () => {
      expect(RewardType.Proportional).to.equal(0);
    });

    it('Constant is 1', () => {
      expect(RewardType.Constant).to.equal(1);
    });

    it('reverse mapping works', () => {
      expect(RewardType[RewardType.Proportional]).to.equal('Proportional');
      expect(RewardType[RewardType.Constant]).to.equal('Constant');
    });
  });

  describe('LockingMode', () => {
    it('None is 0', () => {
      expect(LockingMode.None).to.equal(0);
    });

    it('Continuous is 1', () => {
      expect(LockingMode.Continuous).to.equal(1);
    });

    it('WithExpiry is 2', () => {
      expect(LockingMode.WithExpiry).to.equal(2);
    });
  });

  describe('FarmConfigOption', () => {
    it('has UpdateRewardRps as 0', () => {
      expect(FarmConfigOption.UpdateRewardRps).to.equal(0);
    });

    it('has LockingMode', () => {
      expect(FarmConfigOption.LockingMode).to.be.a('number');
    });

    it('has DepositCapAmount', () => {
      expect(FarmConfigOption.DepositCapAmount).to.be.a('number');
    });

    it('all values are unique', () => {
      const values = Object.values(FarmConfigOption).filter((v) => typeof v === 'number');
      const unique = new Set(values);
      expect(unique.size).to.equal(values.length);
    });
  });
});

describe('Address constants', () => {
  it('FARMS_PROGRAM_ADDRESS is the expected value', () => {
    const { FARMS_PROGRAM_ADDRESS } = require('../src/@codegen/farms/programs');
    expect(FARMS_PROGRAM_ADDRESS).to.equal('FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr');
  });
});

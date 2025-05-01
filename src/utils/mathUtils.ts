import { UserState } from "../@codegen/farms/accounts/UserState";
import { FarmState } from "../@codegen/farms/accounts/FarmState";
import Decimal from "decimal.js";
import { WAD } from "./utils";
import { RewardInfo, RewardType } from "../@codegen/farms/types";
import { OraclePrices } from "@kamino-finance/scope-sdk/dist/@codegen/scope/accounts";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";

export function calculatePendingRewards(
  farmState: FarmState,
  userState: UserState,
  rewardIndex: number,
  ts: Decimal,
  scopePrices: OraclePrices | null,
): Decimal {
  let scopePrice: Decimal | null = scopePriceForFarm(farmState, scopePrices);
  const newRewardPerToken = calculateRewardPerStake(
    farmState,
    ts,
    rewardIndex,
    scopePrice,
  );
  const rewardTally = new Decimal(
    userState.rewardsTallyScaled[rewardIndex].toString(),
  ).div(WAD);

  let activeStakeScaled = new Decimal(0);
  if (farmState.delegateAuthority === DEFAULT_PUBLIC_KEY) {
    activeStakeScaled = new Decimal(userState.activeStakeScaled.toString()).div(
      WAD,
    );
  } else {
    activeStakeScaled = new Decimal(userState.activeStakeScaled.toString());
  }

  const newRewardTally = activeStakeScaled.mul(newRewardPerToken);
  const newReward = new Decimal(newRewardTally.sub(rewardTally).toFixed(0));
  const prevReward = new Decimal(
    userState.rewardsIssuedUnclaimed[rewardIndex].toString(),
  );
  const finalReward = prevReward.add(newReward);

  return finalReward;
}

export function calculateCurrentRewardPerToken(
  rewardInfo: RewardInfo,
  currentTimeUnit: Decimal,
): number {
  const rewardCurve = rewardInfo.rewardScheduleCurve;

  let index = 0;
  for (let i = 0; i < rewardCurve.points.length; i++) {
    if (
      new Decimal(rewardCurve.points[i].tsStart.toString()).lte(currentTimeUnit)
    ) {
      index = i;
    } else {
      break;
    }
  }

  return rewardCurve.points[index].rewardPerTimeUnit.toNumber();
}

function calculateRewardPerStake(
  farmState: FarmState,
  ts: Decimal,
  rewardIndex: number,
  scopePrice: Decimal | null,
): Decimal {
  const rewardInfo = farmState.rewardInfos[rewardIndex];

  const newRewards = calculateNewRewardToBeIssued(
    farmState,
    ts,
    rewardIndex,
    scopePrice,
  );

  let scaledRewards = newRewards.mul(WAD);
  let rewardPerTokenScaled = new Decimal(
    rewardInfo.rewardPerShareScaled.toString(),
  ).div(WAD);
  let rewardPerTokenScaledAdded = new Decimal(0);
  const totalActiveStakeScaled = new Decimal(
    farmState.totalActiveStakeScaled.toString(),
  );

  if (farmState.delegateAuthority === DEFAULT_PUBLIC_KEY) {
    rewardPerTokenScaledAdded = scaledRewards.div(totalActiveStakeScaled);
  } else {
    if (
      scaledRewards.gt(new Decimal(0)) &&
      totalActiveStakeScaled.gt(new Decimal(0))
    ) {
      rewardPerTokenScaledAdded = scaledRewards
        .div(totalActiveStakeScaled)
        .div(WAD);
    }
  }

  const finalRewardPerToken = rewardPerTokenScaled.add(
    rewardPerTokenScaledAdded,
  );

  return finalRewardPerToken;
}

export function calculateNewRewardToBeIssued(
  farmState: FarmState,
  ts: Decimal,
  rewardIndex: number,
  scopePrice: Decimal | null,
): Decimal {
  const rewardInfo = farmState.rewardInfos[rewardIndex];
  const tsDiff = ts.sub(new Decimal(rewardInfo.lastIssuanceTs.toString()));

  let rps = calculateCurrentRewardPerToken(rewardInfo, ts);
  let rpsDecimal = new Decimal(10 ** rewardInfo.rewardsPerSecondDecimals);
  let newRewards = tsDiff.mul(new Decimal(rps)).div(rpsDecimal);

  if (rewardInfo.rewardType == RewardType.Proportional.discriminator) {
    // In the `Proportional` case `rps` means
    // `reward per second for entire farm`
  } else if (rewardInfo.rewardType == RewardType.Constant.discriminator) {
    // In the `Constant` case `rps` means
    // `reward per second for each lamport staked`
    const totalStaked = new Decimal(farmState.totalStakedAmount.toString());
    newRewards = newRewards.mul(totalStaked);
  }

  if (farmState.scopePrices !== DEFAULT_PUBLIC_KEY) {
    // Oracle adjustment
    if (scopePrice == null) {
      throw new Error("Scope price not provided");
    }
    console.log("Adjusting by scope price", scopePrice.toString());
    newRewards = newRewards.mul(scopePrice);
  }

  // We cap rewards by how much is available in the farm anyway
  let cappedRewards = Decimal.min(
    newRewards,
    new Decimal(rewardInfo.rewardsAvailable.toString()),
  );

  return cappedRewards;
}

export function scopePriceForFarm(
  farmState: FarmState,
  scopePrices: OraclePrices | null,
): Decimal | null {
  let scopePrice: Decimal | null = null;
  if (farmState.scopePrices !== DEFAULT_PUBLIC_KEY) {
    if (scopePrices == null) {
      throw new Error("Scope prices not provided");
    }
    const price =
      scopePrices.prices[
        new Decimal(farmState.scopeOraclePriceId.toString()).toNumber()
      ];
    const factor = new Decimal(10).pow(price.price.exp.toString());
    scopePrice = new Decimal(price.price.value.toString()).div(factor);
  }

  return scopePrice;
}

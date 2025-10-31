import { Kamino } from "@kamino-finance/kliquidity-sdk";
import { Address, Rpc, SolanaRpcApi } from "@solana/kit";
import { Farms } from "../Farms";
import Decimal from "decimal.js";
import { FarmIncentives } from "../models";
import { FarmState } from "../@codegen/farms/accounts";
import { getTokenPrice } from "./price";
import { Connection } from "@solana/web3.js";

export async function getRewardsApyForStrategy(
  connection: Rpc<SolanaRpcApi>,
  legacyConnection: Connection,
  strategy: Address,
): Promise<FarmIncentives> {
  const kaminoClient = new Kamino("mainnet-beta", connection, legacyConnection);

  const strategyState = await kaminoClient.getStrategyByAddress(strategy);

  if (!strategyState) {
    throw new Error(`Strategy state not found for strategy: ${strategy}`);
  }
  const farm = strategyState.farm;
  const stakedTokenMintDecimals = strategyState.sharesMintDecimals.toNumber();
  const stakedTokenPrice = await kaminoClient.getStrategySharePrice(strategy);

  const farmsClient = new Farms(connection);

  console.log(`Farm: ${farm}`);
  return await getFarmIncentives(
    farmsClient,
    farm,
    stakedTokenPrice,
    stakedTokenMintDecimals,
  );
}

export async function getFarmIncentives(
  farmsClient: Farms,
  farm: Address,
  stakedTokenPrice: Decimal,
  stakedTokenMintDecimals: number,
  pricesMap?: Map<Address, Decimal>,
): Promise<FarmIncentives> {
  const farmState = await FarmState.fetch(
    farmsClient.getConnection(),
    farm,
    farmsClient.getProgramID(),
  );

  if (!farmState) {
    throw new Error(`Farm state not found for farm: ${farm}`);
  }

  return await getFarmIncentivesWithExistentState(
    farmsClient,
    farm,
    farmState,
    stakedTokenPrice,
    stakedTokenMintDecimals,
    pricesMap,
  );
}

export async function getFarmIncentivesWithExistentState(
  farmsClient: Farms,
  farm: Address,
  farmState: FarmState,
  stakedTokenPrice: Decimal,
  stakedTokenMintDecimals: number,
  pricesMap?: Map<Address, Decimal>,
): Promise<FarmIncentives> {
  return await farmsClient.calculateFarmIncentivesApy(
    { farmState, key: farm },
    getTokenPrice,
    stakedTokenPrice,
    stakedTokenMintDecimals,
    pricesMap,
  );
}

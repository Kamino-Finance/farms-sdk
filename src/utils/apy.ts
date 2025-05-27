import { Kamino } from "@kamino-finance/kliquidity-sdk";
import { Address, Rpc, SolanaRpcApi } from "@solana/kit";
import { Farms } from "../Farms";
import Decimal from "decimal.js";
import { FarmIncentives } from "../models";
import { FarmState } from "../@codegen/farms/accounts";
import { getPriceForTokenMint } from "./price";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";
import { fromLegacyPublicKey } from "@solana/compat";
import { toLegacyPublicKey } from "./compat";
import { KaminoMarket, Reserve } from "@kamino-finance/klend-sdk";
import { Connection } from "@solana/web3.js";

export async function getRewardsApyForStrategy(
  connection: Rpc<SolanaRpcApi>,
  legacyConnection: Connection,
  strategy: Address,
): Promise<FarmIncentives> {
  const admin = process.env.ADMIN;
  const rpc = process.env.RPC;

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

export async function getRewardsApyForReserve(
  connection: Rpc<SolanaRpcApi>,
  legacyConnection: Connection,
  reserve: Address,
): Promise<ReserveIncentives> {
  const reserveIncentives: ReserveIncentives = {
    collateralFarmIncentives: null,
    debtFarmIncentives: null,
  };

  const reserveAccount = await Reserve.fetch(
    legacyConnection,
    toLegacyPublicKey(reserve),
  );
  if (!reserveAccount) {
    throw new Error(`Reserve state not found for reserve: ${reserve}`);
  }

  const klendMarket = await KaminoMarket.load(
    legacyConnection,
    reserveAccount.lendingMarket,
    450,
  );
  if (!klendMarket) {
    throw new Error(
      `Market state not found for market: ${reserveAccount.lendingMarket.toBase58()}`,
    );
  }

  const kaminoReserve = klendMarket.getReserveByAddress(
    toLegacyPublicKey(reserve),
  );

  if (!kaminoReserve) {
    throw new Error(`Strategy state not found for strategy: ${reserve}`);
  }

  const farmCollateral = fromLegacyPublicKey(
    kaminoReserve.state.farmCollateral,
  );
  const farmDebt = fromLegacyPublicKey(kaminoReserve.state.farmDebt);

  const stakedTokenMintDecimals = kaminoReserve.getMintDecimals();
  const reserveTokenPrice = await getPriceForTokenMint(
    fromLegacyPublicKey(kaminoReserve.getLiquidityMint()),
  );
  const reserveCtokenPrice = reserveTokenPrice.div(
    kaminoReserve.getCollateralExchangeRate(),
  );
  console.log(`reserveCtokenPrice: ${reserveCtokenPrice}`);

  const farmsClient = new Farms(connection);

  if (farmCollateral !== DEFAULT_PUBLIC_KEY) {
    const farmIncentivesCollateral = await getFarmIncentives(
      farmsClient,
      farmCollateral,
      reserveCtokenPrice,
      6, // ctokens have 6 decimals - can be fetched from on chain as well
    );
    reserveIncentives.collateralFarmIncentives = farmIncentivesCollateral;
  }
  if (farmDebt !== DEFAULT_PUBLIC_KEY) {
    const farmIncentivesDebt = await getFarmIncentives(
      farmsClient,
      farmDebt,
      reserveTokenPrice,
      stakedTokenMintDecimals,
    );
    reserveIncentives.debtFarmIncentives = farmIncentivesDebt;
  }

  return reserveIncentives;
}

export async function getFarmIncentives(
  farmsClient: Farms,
  farm: Address,
  stakedTokenPrice: Decimal,
  stakedTokenMintDecimals: number,
): Promise<FarmIncentives> {
  const farmState = await FarmState.fetch(
    farmsClient.getConnection(),
    farm,
    farmsClient.getProgramID(),
  );

  if (!farmState) {
    throw new Error(`Farm state not found for farm: ${farm}`);
  }

  const farmsIncentives = await farmsClient.calculateFarmIncentivesApy(
    { farmState, key: farm },
    getPriceForTokenMint,
    stakedTokenPrice,
    stakedTokenMintDecimals,
  );

  return farmsIncentives;
}

export interface ReserveIncentives {
  collateralFarmIncentives: FarmIncentives | null;
  debtFarmIncentives: FarmIncentives | null;
}

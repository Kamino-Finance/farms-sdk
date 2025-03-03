import {
  InitObligationFarmsForReserveAccounts,
  InitObligationFarmsForReserveArgs,
  KaminoMarket,
  KaminoObligation,
  KaminoReserve,
  initObligationFarmsForReserve,
} from "@kamino-finance/klend-sdk";
import {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Farms } from "../Farms";
import { initializeClient } from "./utils";
import {
  Env,
  Web3Client,
  accountExist,
  getFarmsProgramId,
  sleep,
} from "../utils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export async function initAllKlendUserObligationFarmsFromFileCommand(
  market: string,
  file: string,
  reserveStr: string,
  farmType: string,
) {
  const admin = process.env.ADMIN;
  const rpc = process.env.RPC;
  const klendProgramId = new PublicKey(process.env.KLEND_PROGRAM_ID || "");

  const env = initializeClient(rpc!, admin!, getFarmsProgramId(rpc!), false);
  const c = env.provider.connection;
  const farmsClient = new Farms(env.provider.connection);
  const reserveAddress = new PublicKey(reserveStr);

  const shouldExecute = true;
  const lendingMarket = new PublicKey(market);
  const kaminoMarket = await KaminoMarket.load(
    c,
    lendingMarket,
    450,
    klendProgramId,
  );

  if (!kaminoMarket) {
    throw new Error("Kamino market not found");
  }

  let ixns: TransactionInstruction[] = [];

  const fs = require("fs");
  const rawData = fs.readFileSync(file, "utf8");
  const obligationAddresses: string[] = JSON.parse(rawData);

  let startAt = 0;
  let stopAt = obligationAddresses.length;
  let i = startAt;
  for (let i = startAt; i < stopAt; i++) {
    const obligationAddress = obligationAddresses[i];
    console.log(
      `Running through obligation ${i}/${obligationAddresses.length} ixns ${ixns.length}`,
    );
    let obligation = (await kaminoMarket.getObligationByAddress(
      new PublicKey(obligationAddress),
    ))!;
    if (!obligation) {
      continue;
    }
    const reserve = kaminoMarket.getReserveByAddress(reserveAddress)!;

    const reserveFarms: [PublicKey, number][] = [
      farmType === "collateral"
        ? [reserve.state.farmCollateral, 0]
        : [reserve.state.farmDebt, 1],
    ];
    for (const [reserveFarm, mode] of reserveFarms) {
      if (reserveFarm.equals(PublicKey.default)) {
        continue;
      }

      // For this reserve, do both collateral and debt
      const userStatePda = getUserFarmPda(
        reserveFarm,
        obligation.obligationAddress,
        farmsClient.getProgramID(),
      );

      // Only init if does not exist
      if (!(await accountExist(c, userStatePda))) {
        ixns.push(
          getInitIxn(
            env,
            obligation,
            kaminoMarket,
            reserve,
            reserveFarm,
            userStatePda,
            farmsClient.getProgramID(),
            mode,
          ),
        );
      }
    }
  }

  // Execute these first
  console.log("Executing ixns", ixns.length);
  let promises: any = [];
  if (shouldExecute) {
    let batchSize = 5;
    let thisBatch: TransactionInstruction[] = [];
    let maxConcurrent = 20;
    for (let i = 0; i < ixns.length; i++) {
      thisBatch.push(ixns[i]);
      console.log("Executing ixn", i);
      if (thisBatch.length >= batchSize || i === ixns.length - 1) {
        promises.push(
          executeWithoutAwait(env, farmsClient, thisBatch, env.web3Client).then(
            (sig) => {
              console.log(`Init Signature ${sig} for ${i}/${ixns.length}`);
            },
          ),
        );
        thisBatch = [];
      }

      if (promises.length >= maxConcurrent || i === ixns.length - 1) {
        await Promise.all(promises);
        promises = [];
      }
    }
  }
  await Promise.all(promises);
}

const executeWithoutAwait = async (
  env: Env,
  farmsClient: Farms,
  thisBatch: TransactionInstruction[],
  web3Client: Web3Client,
) => {
  let numRetries = 5;
  let retry = 0;
  while (retry < numRetries) {
    try {
      const sig = await farmsClient.executeTransaction(
        thisBatch,
        env.initialOwner,
        [],
        web3Client,
        25_000,
      );
      return sig;
    } catch (e) {
      retry += 1;
      await sleep(1000);
    }
  }
  return null;
};

const BASE_SEED_USER_STATE = Buffer.from("user");
const getUserFarmPda = (
  farm: PublicKey,
  obligation: PublicKey,
  farmsProgramId: PublicKey,
) =>
  PublicKey.findProgramAddressSync(
    [BASE_SEED_USER_STATE, farm.toBytes(), obligation.toBytes()],
    farmsProgramId,
  )[0];

const getInitIxn = (
  env: Env,
  obligation: KaminoObligation,
  market: KaminoMarket,
  reserve: KaminoReserve,
  reserveFarm: PublicKey,
  userStatePda: PublicKey,
  farmsProgramId: PublicKey,
  mode: number,
): TransactionInstruction => {
  const args = {
    mode,
  } as InitObligationFarmsForReserveArgs;
  const accts = {
    payer: env.initialOwner.publicKey,
    owner: obligation.state.owner,
    obligation: obligation.obligationAddress,
    lendingMarketAuthority: market.getLendingMarketAuthority(),
    reserve: reserve.address,
    reserveFarmState: reserveFarm,
    obligationFarm: userStatePda,
    lendingMarket: reserve.state.lendingMarket,
    farmsProgram: farmsProgramId,
    rent: SYSVAR_RENT_PUBKEY,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  } as InitObligationFarmsForReserveAccounts;
  const ixn = initObligationFarmsForReserve(args, accts, market.programId);
  return ixn;
};

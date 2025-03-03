import {
  KaminoAction,
  KaminoMarket,
  KaminoObligation,
  getObligationTypeFromObligation,
  sleep,
} from "@kamino-finance/klend-sdk";
import {
  AddressLookupTableAccount,
  BlockhashWithExpiryBlockHeight,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAddExtraComputeUnitFeeTransaction,
  initializeClient,
} from "./utils";
import { Env, getFarmsProgramId } from "../utils";

export const LENDING_LUT = new PublicKey(
  "284iwGtA9X9aLy3KsyV8uT2pXLARhYbiSi5SiM2g47M2",
);

export async function refreshAllKlendObligationFarmsFromFileCommand(
  market: string,
  file: string,
) {
  const admin = process.env.ADMIN;
  const rpc = process.env.RPC;
  const klendProgramId = new PublicKey(process.env.KLEND_PROGRAM_ID || "");

  const env = initializeClient(rpc!, admin!, getFarmsProgramId(rpc!), false);
  const c = env.provider.connection;

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

  const fs = require("fs");
  const rawData = fs.readFileSync(file, "utf8");
  const obligationAddresses: string[] = JSON.parse(rawData);

  let startAt = 0;
  let stopAt = obligationAddresses.length;
  let maxConcurrent = 30;
  let promises: any = [];

  let lut = (await c.getAddressLookupTable(LENDING_LUT)).value!;

  for (let i = startAt; i < stopAt; i++) {
    const obligationAddress = new PublicKey(obligationAddresses[i]);

    // console.log("Obligation", obligationAddress.toString());

    const obligation =
      await kaminoMarket.getObligationByAddress(obligationAddress);

    const kaminoAction = buildRefreshObligationTxns(
      kaminoMarket,
      env.initialOwner.publicKey,
      obligationAddress,
    );

    promises.push(
      executeWithoutAwait(
        env,
        obligationAddress,
        i,
        kaminoAction,
        lut,
        obligationAddresses.length,
      ),
    );

    if (
      promises.length >= maxConcurrent ||
      i === obligationAddresses.length - 1 ||
      i === stopAt - 1
    ) {
      await Promise.all(promises);
      promises = [];
    }
  }

  await sleep(10);
}

const executeWithoutAwait = async (
  env: Env,
  obligation: PublicKey,
  i: number,
  kaminoAction: Promise<KaminoAction>,
  lut: AddressLookupTableAccount,
  len: number,
): Promise<string | null> => {
  let numRetries = 5;
  let retry = 0;
  while (retry < numRetries) {
    try {
      const action = await kaminoAction;
      const sig = await sendTransactionFromAction(
        env.provider.connection,
        action,
        env.initialOwner,
        [lut],
        "Refreshed Obligation " +
          i +
          " " +
          obligation.toString() +
          " out of " +
          len,
      );

      return sig;
    } catch (e) {
      console.log("Obligation error", i, obligation.toString(), e);
      retry += 1;
      await sleep(1000);
    }
  }
  return null;
};

export const sendTransactionFromAction = async (
  c: Connection,
  kaminoAction: KaminoAction,
  liquidator: Keypair,
  lookupTables: AddressLookupTableAccount[],
  withDescription: string = "",
): Promise<TransactionSignature> => {
  const priorityFeeMultiplier = 50_000;
  const microLamport = 10 ** 6; // 1 lamport
  const computeUnits = 1_200_000;
  const microLamportsPrioritizationFee = microLamport / computeUnits;
  const priorityFeeIxn = createAddExtraComputeUnitFeeTransaction(
    computeUnits,
    Math.round(microLamportsPrioritizationFee * priorityFeeMultiplier),
  );

  const ixs = [
    ...priorityFeeIxn,
    ...kaminoAction.setupIxs,
    ...kaminoAction.lendingIxs,
    ...kaminoAction.cleanupIxs,
  ];
  return sendAndConfirmTransactionV0(
    c,
    liquidator,
    ixs,
    lookupTables,
    [],
    withDescription,
    (str) => console.log(str),
  );
};

export async function sendAndConfirmTransactionV0(
  c: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  lookupTables: AddressLookupTableAccount[],
  signers: Signer[],
  withDescription: string = "",
  logger: (str: string) => void = console.log,
): Promise<TransactionSignature> {
  const blockhash = await c.getLatestBlockhash("confirmed");
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions,
  }).compileToV0Message(lookupTables);
  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer, ...signers]);
  let sig: string;
  try {
    sig = await c.sendTransaction(tx, {
      preflightCommitment: "processed",
      skipPreflight: true,
    });
    logger(`Transaction Hash: ${withDescription} ${sig}`);
  } catch (e: any) {
    logger(e);
  }
  const status = await confirmTx(c, sig!, blockhash);
  return sig!;
}

export async function confirmTx(
  connection: Connection,
  txHash: string,
  txnBlockhash: BlockhashWithExpiryBlockHeight,
) {
  return connection.confirmTransaction(
    {
      blockhash: txnBlockhash.blockhash,
      lastValidBlockHeight: txnBlockhash.lastValidBlockHeight,
      signature: txHash,
    },
    "confirmed",
  );
}

async function buildRefreshObligationTxns(
  kaminoMarket: KaminoMarket,
  payer: PublicKey,
  obligation: PublicKey,
) {
  const kaminoObligation = await KaminoObligation.load(
    kaminoMarket,
    obligation,
  );
  if (!kaminoObligation) {
    throw new Error(`Obligation ${obligation.toBase58()} not found`);
  }

  const firstReserve = kaminoObligation.state.deposits.find(
    (d) => !d.depositReserve.equals(PublicKey.default),
  )!.depositReserve;
  const firstKaminoReserve = kaminoMarket.getReserveByAddress(firstReserve);
  if (!firstKaminoReserve) {
    throw new Error(`Reserve ${firstReserve.toBase58()} not found`);
  }
  const axn = await KaminoAction.initialize(
    "refreshObligation",
    "0",
    firstKaminoReserve?.getLiquidityMint(),
    kaminoObligation.state.owner,
    kaminoMarket,
    kaminoObligation,
    PublicKey.default,
    undefined,
    payer,
  );

  axn.addRefreshObligation(payer);

  return axn;
}

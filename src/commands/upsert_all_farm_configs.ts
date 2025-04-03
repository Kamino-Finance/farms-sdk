import {
  PublicKey,
  TransactionInstruction,
  Keypair,
  Transaction,
  TransactionSignature,
  Signer,
  VersionedTransaction,
} from "@solana/web3.js";
import Decimal from "decimal.js";
import { Farms, printMultisigTx, printSimulateTx } from "../Farms";
import { FarmState } from "../rpc_client/accounts";
import { FarmConfigOption } from "../rpc_client/types";
import {
  createAddExtraComputeUnitFeeTransaction,
  initializeClient,
} from "./utils";
import {
  Env,
  getFarmsProgramId,
  noopProfiledFunctionExecution,
  retryAsync,
  signSendAndConfirmRawTransactionWithRetry,
} from "../utils";
import { RewardCurvePoint } from "../Farms";
import { FarmConfig } from "./download_all_farm_configs";
import fs from "fs";
import colors from "picocolors";
import { U64_MAX } from "@kamino-finance/klend-sdk";
import { BN } from "@coral-xyz/anchor";

const microLamport = 10 ** 6;
const computeUnits = 200_000;
const microLamportsPrioritizationFee = microLamport / computeUnits;

export async function upsertAllFarmConfigsCommand(
  targetPath: string,
  mode: string,
  priorityFeeMultiplier: number,
) {
  const admin = process.env.ADMIN;
  const rpc = process.env.RPC;
  const env = initializeClient(
    rpc!,
    admin!,
    getFarmsProgramId(rpc!),
    mode === "multisig",
  );
  // Load files from given directory
  const farmConfigs = recursiveReadDirectoryOfConfigs(targetPath);

  const slot = await env.provider.connection.getSlot("finalized");

  for (const [_index, farmConfig] of farmConfigs.entries()) {
    await upsertFarmConfig(env, farmConfig, mode, slot, priorityFeeMultiplier);
  }
}

async function upsertFarmConfig(
  env: Env,
  farmConfig: FarmConfig,
  mode: string,
  slot: number,
  priorityFeeMultiplier: number,
) {
  let ixs: TransactionInstruction[] = [];
  let signers: Keypair[] = [env.initialOwner];
  const farmsClient = new Farms(env.provider.connection);

  const farmState = await FarmState.fetch(
    env.provider.connection,
    farmConfig.farmPubkey,
  );
  if (farmState === null) {
    throw Error("Farm state does not exist");
  }

  const topUpPayer =
    mode === "multisig"
      ? new PublicKey(process.env.MULTISIG!)
      : env.initialOwner.publicKey;
  const payer = farmState.farmAdmin;

  validateStakingTokenMint(farmConfig, farmState);

  // Set farm configurations based on differences between config and current farm state
  ixs.push(
    ...(await setDepositCapIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setLockingModeIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setLockingStartIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setLockingDurationIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setLockingEarlyWithdrawalPenaltyIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setStrategyIdIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setWithdrawAuthorityIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setSlashedAmountSpillAddressIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setPendingFarmAdminIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setDelegateRpsAdminIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setScopePricesAccountIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setScopeOraclePriceIdIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setScopeOracleMaxAgeIxIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setDepositWarmupPeriodIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  ixs.push(
    ...(await setWithdrawCooldownPeriodIfNecessary(
      payer,
      farmsClient,
      farmConfig,
      farmState,
      mode,
    )),
  );

  for (const [rewardIndex, _rewardInfoConfig] of farmConfig.rewards.entries()) {
    const rewardTokenProgram =
      farmState.rewardInfos[rewardIndex].token.tokenProgram;
    const rewardDecimals =
      farmState.rewardInfos[rewardIndex].token.decimals.toNumber();
    // Initialize reward if required
    ixs.push(
      ...(await initRewardIfNecessary(
        payer,
        farmsClient,
        farmConfig,
        farmState,
        rewardIndex,
        mode,
      )),
    );

    ixs.push(
      ...(await setRpsDecimalsIxIfNecessary(
        payer,
        farmsClient,
        farmConfig,
        farmState,
        rewardIndex,
        mode,
      )),
    );

    ixs.push(
      ...(await setRewardTypeIxIfNecessary(
        payer,
        farmsClient,
        farmConfig,
        farmState,
        rewardIndex,
        mode,
      )),
    );

    ixs.push(
      ...(await setRewardMinClaimDurationIxIfNecessary(
        payer,
        farmsClient,
        farmConfig,
        farmState,
        rewardIndex,
        mode,
      )),
    );

    const { rewardCurve, rewardPerSecond } = getConfigRewardRps(
      farmState,
      farmConfig,
      rewardIndex,
    );

    if (rewardPerSecond == -1 && !rewardCurve) {
      throw new Error("Must have either reward per second or reward curve");
    }

    const setRewardCurveIxn = await setRewardCurveIfNecessary(
      env,
      payer,
      farmsClient,
      farmState,
      farmConfig,
      rewardCurve,
      rewardIndex,
      rewardDecimals,
      slot,
      mode,
    );
    ixs.push(...setRewardCurveIxn);

    let setRewardRpsIxns: TransactionInstruction[] = [];
    if (setRewardCurveIxn.length == 0) {
      setRewardRpsIxns.push(
        ...(await setRewardPerSecondIfNecessary(
          payer,
          farmsClient,
          farmState,
          farmConfig,
          rewardPerSecond,
          rewardIndex,
          rewardDecimals,
          mode,
        )),
      );
    }
    ixs.push(...setRewardRpsIxns);
    // Topup
    ixs.push(
      ...(await topupRewardAmountNecessary(
        env,
        topUpPayer,
        farmsClient,
        farmState,
        farmConfig,
        rewardIndex,
        rewardDecimals,
        rewardTokenProgram,
        slot,
        setRewardCurveIxn.length == 0 && setRewardRpsIxns.length == 0,
        mode,
      )),
    );
  }

  // 5. Send or print txn
  const { blockhash } = await retryAsync(async () =>
    noopProfiledFunctionExecution(
      env.provider.connection.getLatestBlockhash("confirmed"),
    ),
  );
  let txn = new Transaction();
  txn.recentBlockhash = blockhash;
  txn.feePayer =
    mode === "multisig"
      ? new PublicKey(process.env.MULTISIG!)
      : env.initialOwner.publicKey;

  if (ixs.length !== 0) {
    if (mode !== "multisig") {
      const priorityFeeIxn = createAddExtraComputeUnitFeeTransaction(
        computeUnits,
        microLamportsPrioritizationFee * priorityFeeMultiplier,
      );
      txn.add(...priorityFeeIxn);
    }
    txn.add(...ixs);
    if (mode === "simulate") {
      await printSimulateTx(env.provider.connection, txn);
    } else if (mode === "multisig") {
      await printMultisigTx(txn);
    } else if (mode === "execute") {
      console.log("Sending.");
      const sig = await retryAsync(async () =>
        noopProfiledFunctionExecution(
          sendAndConfirmTxn(
            env,
            new VersionedTransaction(txn.compileMessage()),
            signers,
          ),
        ),
      );
      console.log("Signature", sig);
    }
  }
  mode !== "multisig" && ixs.length > 0 && console.log("-".repeat(150));
}

async function sendAndConfirmTxn(
  env: Env,
  txn: VersionedTransaction,
  signers: Signer[],
): Promise<TransactionSignature> {
  const sig = await signSendAndConfirmRawTransactionWithRetry({
    mainConnection: env.web3Client.sendConnection,
    extraConnections: env.web3Client.sendConnectionsExtra,
    tx: txn,
    signers,
    commitment: "confirmed",
    sendTransactionOptions: {
      maxRetries: 5,
      preflightCommitment: "confirmed",
    },
  });

  return sig;
}

function validateStakingTokenMint(
  farmConfig: FarmConfig,
  farmState: FarmState,
) {
  if (!farmState.token.mint.equals(farmConfig.stakingTokenMint)) {
    throw (
      "Staking token mint mismatch Config: " +
      farmConfig.stakingTokenMint.toString() +
      " FarmState: " +
      farmState.token.mint.toString()
    );
  }
}

async function setDepositCapIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let depositCapAmountIx = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.DepositCapAmount.kind]: "",
    }),
    farmConfig.depositCapAmount,
    0,
  );

  const currentDepositCapAmount = new Decimal(
    farmState.depositCapAmount.toString(),
  ).toNumber();

  if (currentDepositCapAmount != farmConfig.depositCapAmount) {
    const valueStringBefore =
      "depositCapAmount before".padEnd(40) + ": " + currentDepositCapAmount;
    const valueStringAfter =
      "depositCapAmount after".padEnd(40) + ": " + farmConfig.depositCapAmount;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [depositCapAmountIx];
  }

  return [];
}

async function setLockingModeIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setLockingModeIx = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.LockingMode.kind]: "",
    }),
    farmConfig.lockingMode,
    0,
  );

  const currentLockingMode = new Decimal(
    farmState.lockingMode.toString(),
  ).toNumber();

  if (currentLockingMode != farmConfig.lockingMode) {
    const valueStringBefore =
      "lockingMode before".padEnd(40) + ": " + currentLockingMode;
    const valueStringAfter =
      "lockingMode after".padEnd(40) + ": " + farmConfig.lockingMode;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setLockingModeIx];
  }

  return [];
}

async function setLockingStartIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setLockingStart = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.LockingStartTimestamp.kind]: "",
    }),
    farmConfig.lockingStart,
    0,
  );

  const currentLockingStartTimestamp = new Decimal(
    farmState.lockingStartTimestamp.toString(),
  ).toNumber();

  if (currentLockingStartTimestamp != farmConfig.lockingStart) {
    const valueStringBefore =
      "lockingStartTimestamp before".padEnd(40) +
      ": " +
      currentLockingStartTimestamp;
    const valueStringAfter =
      "lockingStartTimestamp after".padEnd(40) + ": " + farmConfig.lockingStart;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setLockingStart];
  }

  return [];
}

async function setLockingDurationIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setLockingDuration = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.LockingDuration.kind]: "",
    }),
    farmConfig.lockingDuration,
    0,
  );

  const currentLockingDuration = new Decimal(
    farmState.lockingDuration.toString(),
  ).toNumber();

  if (currentLockingDuration != farmConfig.lockingDuration) {
    const valueStringBefore =
      "lockingDuration before".padEnd(40) + ": " + currentLockingDuration;
    const valueStringAfter =
      "lockingDuration after".padEnd(40) + ": " + farmConfig.lockingDuration;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setLockingDuration];
  }

  return [];
}

async function setLockingEarlyWithdrawalPenaltyIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setLockingEarlyWithdrawalPenalty = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.LockingEarlyWithdrawalPenaltyBps.kind]: "",
    }),
    farmConfig.lockingEarlyWithdrawalPenaltyBps,
    0,
  );

  const currentLockingEarlyWithdrawalPenalty = new Decimal(
    farmState.lockingEarlyWithdrawalPenaltyBps.toString(),
  ).toNumber();

  if (
    currentLockingEarlyWithdrawalPenalty !=
    farmConfig.lockingEarlyWithdrawalPenaltyBps
  ) {
    const valueStringBefore =
      "lockingEarlyWithdrawalPenaltyBps before".padEnd(40) +
      ": " +
      currentLockingEarlyWithdrawalPenalty;
    const valueStringAfter =
      "lockingEarlyWithdrawalPenaltyBps after".padEnd(40) +
      ": " +
      farmConfig.lockingEarlyWithdrawalPenaltyBps;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setLockingEarlyWithdrawalPenalty];
  }

  return [];
}

async function setStrategyIdIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setStrategyId = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.UpdateStrategyId.kind]: "",
    }),
    farmConfig.strategyId,
    0,
  );

  if (!farmState.strategyId.equals(farmConfig.strategyId)) {
    const valueStringBefore =
      "strategyId before".padEnd(40) + ": " + farmState.strategyId.toString();
    const valueStringAfter =
      "strategyId after".padEnd(40) + ": " + farmConfig.strategyId.toString();
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setStrategyId];
  }

  return [];
}

async function setWithdrawAuthorityIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setWithdrawAuthority = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.WithdrawAuthority.kind]: "",
    }),
    farmConfig.withdrawAuthority,
    0,
  );

  if (!farmState.withdrawAuthority.equals(farmConfig.withdrawAuthority)) {
    const valueStringBefore =
      "withdrawAuthority before".padEnd(40) +
      ": " +
      farmState.withdrawAuthority.toString();
    const valueStringAfter =
      "withdrawAuthority after".padEnd(40) +
      ": " +
      farmConfig.withdrawAuthority.toString();
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setWithdrawAuthority];
  }

  return [];
}

async function setSlashedAmountSpillAddressIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setSlashedAmountSpillAddress = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.SlashedAmountSpillAddress.kind]: "",
    }),
    farmConfig.slashedAmountSpillAddress,
    0,
  );

  if (
    !farmState.slashedAmountSpillAddress.equals(
      farmConfig.slashedAmountSpillAddress,
    )
  ) {
    const valueStringBefore =
      "slashedAmountSpillAddress before".padEnd(40) +
      ": " +
      farmState.slashedAmountSpillAddress.toString();
    const valueStringAfter =
      "slashedAmountSpillAddress after".padEnd(40) +
      ": " +
      farmConfig.slashedAmountSpillAddress.toString();
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setSlashedAmountSpillAddress];
  }

  return [];
}

async function setScopePricesAccountIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setScopePricesAccount = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.ScopePricesAccount.kind]: "",
    }),
    farmConfig.scopePrices,
    0,
  );

  if (!farmState.scopePrices.equals(farmConfig.scopePrices)) {
    const valueStringBefore =
      "scopePrices before".padEnd(40) + ": " + farmState.scopePrices.toString();
    const valueStringAfter =
      "scopePrices after".padEnd(40) + ": " + farmConfig.scopePrices.toString();
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setScopePricesAccount];
  }

  return [];
}

async function setPendingFarmAdminIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setPendingFarmAdmin = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.UpdatePendingFarmAdmin.kind]: "",
    }),
    farmConfig.pendingFarmAdmin,
    0,
  );

  if (!farmState.pendingFarmAdmin.equals(farmConfig.pendingFarmAdmin)) {
    const valueStringBefore =
      "pendingFarmAdmin before".padEnd(40) +
      ": " +
      farmState.pendingFarmAdmin.toString();
    const valueStringAfter =
      "pendingFarmAdmin after".padEnd(40) +
      ": " +
      farmConfig.pendingFarmAdmin.toString();
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setPendingFarmAdmin];
  }

  return [];
}

async function setDelegateRpsAdminIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setDelegateRpsAdmin = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.UpdateDelegatedRpsAdmin.kind]: "",
    }),
    farmConfig.delegatedRpsAdmin,
    0,
  );

  if (!farmState.delegatedRpsAdmin.equals(farmConfig.delegatedRpsAdmin)) {
    const valueStringBefore =
      "delegatedRpsAdmin before".padEnd(40) +
      ": " +
      farmState.delegatedRpsAdmin.toString();
    const valueStringAfter =
      "delegatedRpsAdmin after".padEnd(40) +
      ": " +
      farmConfig.delegatedRpsAdmin.toString();
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setDelegateRpsAdmin];
  }

  return [];
}

async function setScopeOraclePriceIdIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  const currentScopeOraclePriceId = new Decimal(
    farmState.scopeOraclePriceId.toString(),
  );

  if (
    !currentScopeOraclePriceId.eq(new Decimal(farmConfig.scopePriceOracleId))
  ) {
    const valueStringBefore =
      "scopeOraclePriceId before".padEnd(40) +
      ": " +
      farmState.scopeOraclePriceId;
    const valueStringAfter =
      "scopeOraclePriceId after".padEnd(40) +
      ": " +
      farmConfig.scopePriceOracleId;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    let setScopeOraclePriceId = await farmsClient.updateFarmConfigIx(
      payer,
      farmConfig.farmPubkey,
      PublicKey.default,
      FarmConfigOption.fromDecoded({
        [FarmConfigOption.ScopeOraclePriceId.kind]: "",
      }),
      new BN(farmConfig.scopePriceOracleId),
      0,
    );

    return [setScopeOraclePriceId];
  }

  return [];
}

async function setScopeOracleMaxAgeIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setScopeOracleMaxAge = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.ScopeOracleMaxAge.kind]: "",
    }),
    farmConfig.scopeOracleMaxAge,
    0,
  );

  const currentScopeOracleMaxAge = new Decimal(
    farmState.scopeOracleMaxAge.toString(),
  ).toNumber();

  if (currentScopeOracleMaxAge != farmConfig.scopeOracleMaxAge) {
    const valueStringBefore =
      "scopeOracleMaxAge before".padEnd(40) + ": " + currentScopeOracleMaxAge;
    const valueStringAfter =
      "scopeOracleMaxAge after".padEnd(40) + ": " + farmConfig.lockingDuration;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setScopeOracleMaxAge];
  }

  return [];
}

async function setDepositWarmupPeriodIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setDepositWarmupPeriodIx = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.DepositWarmupPeriod.kind]: "",
    }),
    farmConfig.depositWarmupPeriod,
    0,
  );

  const currentDepositWarmupPeriod = new Decimal(
    farmState.depositWarmupPeriod.toString(),
  ).toNumber();

  if (currentDepositWarmupPeriod != farmConfig.depositWarmupPeriod) {
    const valueStringBefore =
      "depositWarmupPeriod before".padEnd(40) +
      ": " +
      currentDepositWarmupPeriod;
    const valueStringAfter =
      "depositWarmupPeriod after".padEnd(40) +
      ": " +
      farmConfig.depositWarmupPeriod;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setDepositWarmupPeriodIx];
  }

  return [];
}

async function setWithdrawCooldownPeriodIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setWithdrawCooldownPeriodIx = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    PublicKey.default,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.WithdrawCooldownPeriod.kind]: "",
    }),
    farmConfig.withdrawCooldownPeriod,
    0,
  );

  const currentWithdrawCooldownPeriod = new Decimal(
    farmState.withdrawalCooldownPeriod.toString(),
  ).toNumber();

  if (currentWithdrawCooldownPeriod != farmConfig.depositWarmupPeriod) {
    const valueStringBefore =
      "withdrawalCooldownPeriod before".padEnd(40) +
      ": " +
      currentWithdrawCooldownPeriod;
    const valueStringAfter =
      "withdrawalCooldownPeriod after".padEnd(40) +
      ": " +
      farmConfig.withdrawCooldownPeriod;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
    );

    return [setWithdrawCooldownPeriodIx];
  }

  return [];
}

async function initRewardIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  rewardIndex: number,
  mode: string,
): Promise<TransactionInstruction[]> {
  if (
    !farmState.rewardInfos[rewardIndex].token.mint.equals(PublicKey.default) &&
    !farmConfig.rewards[rewardIndex]?.rewardTokenMint.equals(
      farmState.rewardInfos[rewardIndex].token.mint,
    )
  ) {
    throw new Error(
      "Reward token mint already initialized and does not match config",
    );
  }

  if (
    !farmConfig.rewards[rewardIndex]?.rewardTokenMint.equals(
      farmState.rewardInfos[rewardIndex].token.mint,
    )
  ) {
    const rewardMint = farmConfig.rewards[rewardIndex]?.rewardTokenMint!;
    const tokenProgram = (await farmsClient
      .getConnection()
      .getAccountInfo(rewardMint))!.owner;
    const initRewardIx = await farmsClient.addRewardToFarmIx(
      payer,
      farmState.globalConfig,
      farmConfig.farmPubkey,
      rewardMint,
      tokenProgram,
    );

    mode !== "multisig" &&
      console.log(
        "Change for farm: ",
        colors.yellow(farmConfig.farmPubkey.toString().padEnd(50)),
      );
    mode !== "multisig" &&
      console.log(
        colors.green("initialize new reward with mint".padEnd(40) + ": "),
        colors.yellow(rewardMint.toString()),
        "\n",
      );

    return [initRewardIx];
  }

  return [];
}

async function setRpsDecimalsIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  rewardIndex: number,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setRpsDecimals = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    farmConfig.rewards[rewardIndex]?.rewardTokenMint!,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.RpsDecimals.kind]: "",
    }),
    farmConfig.rewards[rewardIndex]?.rewardPerSecondDecimals!,
    rewardIndex,
  );

  const currentRpsDecimals = new Decimal(
    farmState.rewardInfos[rewardIndex]?.rewardsPerSecondDecimals!.toString(),
  ).toNumber();

  if (
    currentRpsDecimals !=
    farmConfig.rewards[rewardIndex]?.rewardPerSecondDecimals!
  ) {
    const valueStringBefore =
      "rpsDecimals before".padEnd(40) + ": " + currentRpsDecimals;
    const valueStringAfter =
      "rpsDecimals after".padEnd(40) +
      ": " +
      farmConfig.rewards[rewardIndex]?.rewardPerSecondDecimals!;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
      rewardIndex,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!.toString(),
    );

    return [setRpsDecimals];
  }

  return [];
}

async function setRewardTypeIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  rewardIndex: number,
  mode: string,
): Promise<TransactionInstruction[]> {
  let configRewardType: number = 0;
  if (farmConfig.rewards[rewardIndex]?.rewardType === "Proportional") {
    configRewardType = 0;
  } else if (farmConfig.rewards[rewardIndex]?.rewardType === "Constant") {
    configRewardType = 1;
  } else {
    throw new Error(
      `Reward type invalid for farm ${farmConfig.farmPubkey.toString()}`,
    );
  }

  let setRewardType = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    farmConfig.rewards[rewardIndex]?.rewardTokenMint!,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.RewardType.kind]: "",
    }),
    configRewardType,
    rewardIndex,
  );

  const currentRewardTypeString =
    farmState.rewardInfos[rewardIndex]?.rewardType === 0
      ? "Proportional"
      : "Constant";

  if (farmState.rewardInfos[rewardIndex]?.rewardType != configRewardType) {
    const valueStringBefore =
      "rewardType before".padEnd(40) + ": " + currentRewardTypeString;
    const valueStringAfter =
      "rewardType after".padEnd(40) +
      ": " +
      farmConfig.rewards[rewardIndex]?.rewardType;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
      rewardIndex,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!.toString(),
    );

    return [setRewardType];
  }

  return [];
}

async function setRewardMinClaimDurationIxIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmConfig: FarmConfig,
  farmState: FarmState,
  rewardIndex: number,
  mode: string,
): Promise<TransactionInstruction[]> {
  let setRewardMinClaimDuration = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    farmConfig.rewards[rewardIndex]?.rewardTokenMint!,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.UpdateRewardMinClaimDuration.kind]: "",
    }),
    farmConfig.rewards[rewardIndex]?.minClaimDurationSeconds!,
    rewardIndex,
  );

  const currentMinClaimDurationSeconds = new Decimal(
    farmState.rewardInfos[rewardIndex]?.minClaimDurationSeconds.toString(),
  ).toNumber();

  if (
    currentMinClaimDurationSeconds !=
    farmConfig.rewards[rewardIndex]?.minClaimDurationSeconds!
  ) {
    const valueStringBefore =
      "minClaimDurationSeconds before".padEnd(40) +
      ": " +
      currentMinClaimDurationSeconds;
    const valueStringAfter =
      "minClaimDurationSeconds after".padEnd(40) +
      ": " +
      farmConfig.rewards[rewardIndex]?.minClaimDurationSeconds!;
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
      rewardIndex,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!.toString(),
    );

    return [setRewardMinClaimDuration];
  }

  return [];
}

function getCurrentRewardInfo(farmState: FarmState, rewardIndex: number) {
  let rpsDecimalsCurrent =
    farmState?.rewardInfos[rewardIndex].rewardsPerSecondDecimals ?? 0;

  let rewardsAvailableLamports = 0;
  if (farmState) {
    let rewardInfo = farmState!.rewardInfos[rewardIndex];
    rewardsAvailableLamports = new Decimal(
      rewardInfo.rewardsAvailable.toString(),
    ).toNumber();
  }

  let rpsCurrent =
    farmState?.rewardInfos[
      rewardIndex
    ].rewardScheduleCurve.points[0].rewardPerTimeUnit.toNumber() ?? 0;

  return {
    rpsDecimalsCurrent,
    rewardsAvailableLamports,
    rpsCurrent,
  };
}

function getConfigRewardRps(
  farmState: FarmState,
  farmConfig: FarmConfig,
  rewardIndex: number,
) {
  const rewardCurve: RewardCurvePoint[] = [];
  farmConfig.rewards[rewardIndex]?.rewardCurve.forEach((point) => {
    rewardCurve.push({
      startTs: point!.startTs,
      rps: point!.rps,
    });
  });

  const rewardToTopUpDurationSeconds = farmConfig.rewards[rewardIndex]
    ?.rewardToTopUpDurationDays
    ? farmConfig.rewards[rewardIndex]?.rewardToTopUpDurationDays! * 24 * 60 * 60
    : 0;
  const rewardPerSecond =
    rewardToTopUpDurationSeconds == 0
      ? -1
      : Math.round(
          (farmConfig.rewards[rewardIndex]?.rewardToTopUp! /
            rewardToTopUpDurationSeconds) *
            Math.pow(
              10,
              new Decimal(
                farmState.rewardInfos[rewardIndex].token.decimals.toString(),
              ).toNumber(),
            ),
        );

  if (rewardCurve.length == 1 && rewardPerSecond != -1) {
    rewardCurve[0].rps = Number(rewardPerSecond.toFixed(0));
  }

  return {
    rewardCurve,
    rewardPerSecond,
  };
}

async function setRewardPerSecondIfNecessary(
  payer: PublicKey,
  farmsClient: Farms,
  farmState: FarmState,
  farmConfig: FarmConfig,
  rewardPerSecond: number,
  rewardIndex: number,
  rewardDecimals: number,
  mode: string,
): Promise<TransactionInstruction[]> {
  const { rewardsAvailableLamports } = getCurrentRewardInfo(
    farmState,
    rewardIndex,
  );

  const rpsCurrent =
    farmState?.rewardInfos[
      rewardIndex
    ].rewardScheduleCurve.points[0].rewardPerTimeUnit.toNumber() ?? 0;

  if (rpsCurrent != rewardPerSecond && rewardPerSecond != -1) {
    const valueStringBefore =
      "rewardPerSecond before".padEnd(40) + ": " + rpsCurrent;
    const valueStringAfter =
      "rewardPerSecond after".padEnd(40) + ": " + Math.round(rewardPerSecond);
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
      rewardIndex,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!.toString(),
    );

    const rpsDecimalsCurrent =
      farmConfig.rewards[rewardIndex]!.rewardPerSecondDecimals;

    if (rewardPerSecond) {
      estimateRewardDuration(
        rewardDecimals,
        farmConfig.rewards[rewardIndex]?.rewardToTopUp!,
        rewardsAvailableLamports,
        rpsCurrent / 10 ** rpsCurrent,
        rewardPerSecond /
          10 ** farmConfig.rewards[rewardIndex]?.rewardPerSecondDecimals!,
        rpsDecimalsCurrent,
        mode,
      );
    }

    let setRewardPerSecond = await farmsClient.updateFarmConfigIx(
      payer,
      farmConfig.farmPubkey,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!,
      FarmConfigOption.fromDecoded({
        [FarmConfigOption.UpdateRewardRps.kind]: "",
      }),
      rewardPerSecond,
      rewardIndex,
    );

    return [setRewardPerSecond];
  }

  return [];
}

async function setRewardCurveIfNecessary(
  env: Env,
  payer: PublicKey,
  farmsClient: Farms,
  farmState: FarmState,
  farmConfig: FarmConfig,
  rewardCurve: RewardCurvePoint[],
  rewardIndex: number,
  rewardDecimals: number,
  slot: number,
  mode: string,
): Promise<TransactionInstruction[]> {
  const { rewardsAvailableLamports } = getCurrentRewardInfo(
    farmState,
    rewardIndex,
  );

  const { currentRewardCurve, ts } = await getCurrentRewardCurveAndTs(
    env,
    farmState,
    rewardIndex,
    slot,
  );

  let setRewardCurvePoint = await farmsClient.updateFarmConfigIx(
    payer,
    farmConfig.farmPubkey,
    farmConfig.rewards[rewardIndex]?.rewardTokenMint!,
    FarmConfigOption.fromDecoded({
      [FarmConfigOption.UpdateRewardScheduleCurvePoints.kind]: "",
    }),
    rewardCurve,
    rewardIndex,
  );

  let newCurve = false;

  if (rewardCurve.length > currentRewardCurve.length) {
    newCurve = true;
  }

  for (
    let i = 0;
    i < Math.min(rewardCurve.length, currentRewardCurve.length);
    i++
  ) {
    if (
      (currentRewardCurve[i].startTs != rewardCurve[i].startTs ||
        currentRewardCurve[i].rps != rewardCurve[i].rps) &&
      !(
        rewardCurve[i].startTs == 0 &&
        currentRewardCurve[i].startTs == Number(U64_MAX)
      )
    ) {
      newCurve = true;
      break;
    }
  }

  if (newCurve) {
    const valueStringBefore =
      "rewardCurve before".padEnd(40) +
      ": " +
      JSON.stringify(currentRewardCurve);
    const valueStringAfter =
      "rewardCurve after".padEnd(40) + ": " + JSON.stringify(rewardCurve);
    printDiff(
      mode,
      valueStringBefore,
      valueStringAfter,
      farmConfig.farmPubkey.toString(),
      rewardIndex,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!.toString(),
    );

    const rpsDecimalsCurrent =
      farmConfig.rewards[rewardIndex]!.rewardPerSecondDecimals;

    estimateRewardDurationRewardCurve(
      rewardDecimals,
      farmConfig.rewards[rewardIndex]?.rewardToTopUp!,
      rewardsAvailableLamports,
      currentRewardCurve,
      rewardCurve,
      rpsDecimalsCurrent,
      ts!,
      mode,
    );

    return [setRewardCurvePoint];
  }
  return [];
}

async function topupRewardAmountNecessary(
  env: Env,
  payer: PublicKey,
  farmsClient: Farms,
  farmState: FarmState,
  farmConfig: FarmConfig,
  rewardIndex: number,
  rewardDecimals: number,
  tokenProgram: PublicKey,
  slot: number,
  topUpOnly: boolean,
  mode: string,
): Promise<TransactionInstruction[]> {
  if (farmConfig.rewards[rewardIndex]?.rewardToTopUp! > 0) {
    let topupIx = await farmsClient.addRewardAmountToFarmIx(
      payer,
      farmConfig.farmPubkey,
      farmConfig.rewards[rewardIndex]?.rewardTokenMint!,
      new Decimal(farmConfig.rewards[rewardIndex]?.rewardToTopUp!),
      rewardIndex,
      rewardDecimals,
      tokenProgram,
      farmConfig.scopePrices.equals(PublicKey.default)
        ? undefined
        : farmConfig.scopePrices,
    );
    const rewardIndexString =
      rewardIndex == -1
        ? ""
        : " - rewardIndex[" +
          rewardIndex +
          "] : " +
          farmConfig.rewards[rewardIndex]?.rewardTokenMint!.toString();

    const valueStringAfter =
      "reward to top up".padEnd(40) +
      ": " +
      farmConfig.rewards[rewardIndex]?.rewardToTopUp!;

    mode !== "multisig" &&
      console.log(
        "Change for farm: ",
        colors.yellow(
          farmConfig.farmPubkey.toString().concat(rewardIndexString).padEnd(65),
        ),
      );
    mode !== "multisig" && console.log(colors.green(valueStringAfter), "\n");

    if (topUpOnly) {
      const { rewardsAvailableLamports } = getCurrentRewardInfo(
        farmState,
        rewardIndex,
      );

      const { currentRewardCurve, ts } = await getCurrentRewardCurveAndTs(
        env,
        farmState,
        rewardIndex,
        slot,
      );

      const rpsDecimalsCurrent =
        farmConfig.rewards[rewardIndex]!.rewardPerSecondDecimals;

      estimateRewardDurationRewardCurve(
        rewardDecimals,
        farmConfig.rewards[rewardIndex]?.rewardToTopUp!,
        rewardsAvailableLamports,
        currentRewardCurve,
        currentRewardCurve,
        rpsDecimalsCurrent,
        ts!,
        mode,
      );
    }

    return [topupIx];
  }

  return [];
}

export function estimateRewardDurationRewardCurve(
  rewardDecimals: number,
  rewardToTopUp: number,
  remainingLamports: number,
  rewardCurveCurrent: RewardCurvePoint[],
  newRewardCurve: RewardCurvePoint[],
  rpsDecimalsCurrent: number,
  ts: number,
  mode: string,
) {
  const rewardFactor = 10 ** rewardDecimals;

  /// Rewards available
  const newLamports = remainingLamports + rewardToTopUp * rewardFactor;

  // If we change the number of lamports available
  const numDaysBalanceRemaining = calculateDaysBalanceRemaining(
    remainingLamports,
    rewardCurveCurrent,
    rpsDecimalsCurrent,
    ts,
  );
  const numDaysTopupRemaining = calculateDaysBalanceRemaining(
    newLamports,
    rewardCurveCurrent,
    rpsDecimalsCurrent,
    ts,
  );

  mode !== "multisig" &&
    console.log("Days with current balance:", numDaysBalanceRemaining);
  mode !== "multisig" &&
    console.log("Days with new balance:", numDaysTopupRemaining);

  // If we change the number of rps
  const daysWithNewRps = calculateDaysBalanceRemaining(
    remainingLamports,
    newRewardCurve,
    rpsDecimalsCurrent,
    ts,
  );
  const daysWithNewRpsAndTopup = calculateDaysBalanceRemaining(
    newLamports,
    newRewardCurve,
    rpsDecimalsCurrent,
    ts,
  );

  mode !== "multisig" &&
    console.log(
      "Days with current balance and new reward curve",
      daysWithNewRps,
    );
  mode !== "multisig" &&
    console.log(
      "Days with new balance and new reward curve",
      daysWithNewRpsAndTopup,
      "\n",
    );

  return {
    remainingLamports,
    rewardFactor,
  };
}

export function calculateDaysBalanceRemaining(
  lamports: number,
  rewardCurve: RewardCurvePoint[],
  rpsDecimalsCurrent: number,
  ts: number,
) {
  let numDays: number = 0;
  let remainingLamports: number = lamports;
  for (const [index, _curvePoint] of rewardCurve.entries()) {
    const rps = rewardCurve[index].rps / 10 ** rpsDecimalsCurrent;
    if (index == rewardCurve.length - 1) {
      return numDays + remainingLamports / rps / 86400;
    }
    if (remainingLamports > 0) {
      if (
        ts >= rewardCurve[index].startTs &&
        ts < rewardCurve[index + 1].startTs
      ) {
        const secondsWithCurrentRps = remainingLamports / rps;
        if (ts + secondsWithCurrentRps <= rewardCurve[index + 1].startTs) {
          numDays += secondsWithCurrentRps / 86400;
          return numDays; // all remaining lamports elapsed
        } else {
          const actualSecondsAtCurrentRps = rewardCurve[index + 1].startTs - ts;
          numDays += actualSecondsAtCurrentRps / 86400;
          remainingLamports -= actualSecondsAtCurrentRps * rps;

          ts = rewardCurve[index + 1].startTs; // advance time to next curve point for estimation
        }
      }
    }
  }

  return numDays;
}

function parseFarmConfigFromFile(farmConfigFromFile: any): FarmConfig {
  const farmConfig: FarmConfig = {
    farmMetadata: {
      type: farmConfigFromFile.farmMetadata.type,
      reserve: farmConfigFromFile.reserve
        ? new PublicKey(farmConfigFromFile.reserve)
        : undefined,
      market: farmConfigFromFile.market
        ? new PublicKey(farmConfigFromFile.market)
        : undefined,
      strategy: farmConfigFromFile.strategy
        ? new PublicKey(farmConfigFromFile.strategy)
        : undefined,
    },
    farmPubkey: new PublicKey(farmConfigFromFile.farmPubkey),
    stakingTokenMint: new PublicKey(farmConfigFromFile.stakingTokenMint),
    withdrawAuthority: new PublicKey(farmConfigFromFile.withdrawAuthority),
    globalConfig: new PublicKey(farmConfigFromFile.globalConfig),
    strategyId: new PublicKey(farmConfigFromFile.strategyId),
    depositCapAmount: farmConfigFromFile.depositCapAmount,
    rewards: farmConfigFromFile.rewards.map(
      (reward: {
        rewardTokenMint: string;
        rewardType: string;
        rewardPerSecondDecimals: number;
        minClaimDurationSeconds: number;
        rewardCurve?: string;
        rewardAvailable?: boolean;
        rewardToTopUp?: number;
        rewardToTopUpDurationDays?: number;
      }) => {
        return {
          rewardTokenMint: new PublicKey(reward.rewardTokenMint),
          rewardType: reward.rewardType,
          rewardPerSecondDecimals: reward.rewardPerSecondDecimals,
          minClaimDurationSeconds: reward.minClaimDurationSeconds,
          rewardCurve: reward.rewardCurve,
          rewardAvailable: reward.rewardAvailable,
          rewardToTopUp: reward.rewardToTopUp,
          rewardToTopUpDurationDays: reward.rewardToTopUpDurationDays,
        };
      },
    ),
    pendingFarmAdmin: new PublicKey(farmConfigFromFile.pendingFarmAdmin),
    scopePrices: new PublicKey(farmConfigFromFile.scopePrices),
    scopePriceOracleId: farmConfigFromFile.scopePriceOracleId,
    scopeOracleMaxAge: farmConfigFromFile.scopeOracleMaxAge,
    lockingMode: farmConfigFromFile.lockingMode,
    lockingStart: farmConfigFromFile.lockingStart,
    lockingDuration: farmConfigFromFile.lockingDuration,
    lockingEarlyWithdrawalPenaltyBps:
      farmConfigFromFile.lockingEarlyWithdrawalPenaltyBps,
    depositWarmupPeriod: farmConfigFromFile.depositWarmupPeriod,
    withdrawCooldownPeriod: farmConfigFromFile.withdrawCooldownPeriod,
    slashedAmountSpillAddress: new PublicKey(
      farmConfigFromFile.slashedAmountSpillAddress,
    ),
    delegatedRpsAdmin: new PublicKey(farmConfigFromFile.delegatedRpsAdmin),
  };
  return farmConfig;
}

function recursiveReadDirectoryOfConfigs(targetPath: string): FarmConfig[] {
  const farmConfigs: FarmConfig[] = [];

  fs.readdirSync(targetPath, { withFileTypes: true }).forEach((file) => {
    if (file.isDirectory()) {
      farmConfigs.push(
        ...recursiveReadDirectoryOfConfigs(targetPath + "/" + file.name),
      );
    } else {
      const farmConfigFromFile = JSON.parse(
        fs.readFileSync(targetPath + "/" + file.name, "utf8"),
      );
      farmConfigs.push(parseFarmConfigFromFile(farmConfigFromFile));
    }
  });

  return farmConfigs;
}

function printDiff(
  mode: string,
  valueStringBefore: string,
  valueStringAfter: string,
  farmPubkeyString: string,
  rewardIndex: number = -1,
  rewardMint: string = "",
) {
  const rewardIndexString =
    rewardIndex == -1
      ? ""
      : " - rewardIndex[" + rewardIndex + "] : " + rewardMint;

  mode !== "multisig" &&
    console.log(
      "Change for farm: ",
      colors.yellow(farmPubkeyString.concat(rewardIndexString).padEnd(65)),
    );
  mode !== "multisig" && console.log(colors.red(valueStringBefore));
  mode !== "multisig" && console.log(colors.green(valueStringAfter), "\n");
}

export function estimateRewardDuration(
  rewardDecimals: number,
  rewardToTopUp: number,
  remainingLamports: number,
  rpsCurrent: number,
  newRps: number,
  rpsDecimalsCurrent: number,
  mode: string,
) {
  rpsCurrent = rpsCurrent / 10 ** rpsDecimalsCurrent;
  newRps = newRps / 10 ** rpsDecimalsCurrent;
  const rewardFactor = 10 ** rewardDecimals;

  /// Rewards available
  const newLamports = remainingLamports + rewardToTopUp * rewardFactor;

  // If we change the number of lamports available
  const numDaysBalanceRemaining = remainingLamports / rpsCurrent / 86400;
  const numDaysTopupRemaining = newLamports / rpsCurrent / 86400;

  mode !== "multisig" &&
    console.log("Days with current balance:", numDaysBalanceRemaining);
  mode !== "multisig" &&
    console.log("Days with new balance:", numDaysTopupRemaining);

  // If we change the number of rps
  const daysWithNewRps = remainingLamports / newRps / 86400;
  const daysWithNewRpsAndTopup = newLamports / newRps / 86400;

  mode !== "multisig" &&
    console.log("Days with current balance and new rps", daysWithNewRps);
  mode !== "multisig" &&
    console.log(
      "Days with new balance and new rps",
      daysWithNewRpsAndTopup,
      "\n",
    );

  return {
    remainingLamports,
    rewardFactor,
  };
}

async function getCurrentRewardCurveAndTs(
  env: Env,
  farmState: FarmState,
  rewardIndex: number,
  slot: number,
): Promise<{ currentRewardCurve: RewardCurvePoint[]; ts: number }> {
  let currentRewardCurve: RewardCurvePoint[] = [];
  if (farmState) {
    for (const point of farmState.rewardInfos[rewardIndex].rewardScheduleCurve
      .points) {
      if (
        point.tsStart.toString() === U64_MAX &&
        new Decimal(point.rewardPerTimeUnit.toString()).toNumber() === 0
      ) {
        continue;
      }
      currentRewardCurve.push({
        startTs: new Decimal(point.tsStart.toString()).toNumber(),
        rps: new Decimal(point.rewardPerTimeUnit.toString()).toNumber(),
      });
    }
  }

  let ts = await env.provider.connection.getBlockTime(slot);

  return {
    currentRewardCurve,
    ts: ts!,
  };
}

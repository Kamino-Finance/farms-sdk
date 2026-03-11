import { getFarmsErrorMessage } from "../@codegen/farms/errors/farms";
import {
  Address,
  IInstruction,
  Rpc,
  GetBalanceApi,
  address,
  Lamports,
  GetTokenAccountBalanceApi,
  TransactionSigner,
  GetMinimumBalanceForRentExemptionApi,
  GetAccountInfoApi,
  getProgramDerivedAddress,
  getAddressEncoder,
  isAddress,
} from "@solana/kit";
import { Decimal } from "decimal.js";
import {
  FarmState,
  UserState,
  GlobalConfig,
  fetchMaybeFarmState,
  fetchMaybeUserState,
  fetchMaybeGlobalConfig,
} from "../@codegen/farms/accounts";
import { getCreateAccountInstruction } from "@solana-program/system";
import { FARMS_PROGRAM_ADDRESS } from "../@codegen/farms/programs";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";

export const WAD = new Decimal("1".concat(Array(18 + 1).join("0")));

export type GlobalConfigFlagValueType = "number" | "bool" | "publicKey";

const addressEncoder = getAddressEncoder();

export function collToLamportsDecimal(
  amount: Decimal.Value,
  decimals: number,
): Decimal {
  const factor = Math.pow(10, decimals);
  return new Decimal(amount).mul(factor);
}
export function lamportsToCollDecimal(
  amount: Decimal.Value,
  decimals: number,
): Decimal {
  const factor = Math.pow(10, decimals);
  return new Decimal(amount).div(factor);
}

export function decimalToBN(value: Decimal): bigint {
  // Note: the `Decimal.toString()` can return exponential notation (e.g. "1e9") for large numbers. This notation is
  // not accepted by `BigInt` constructor (i.e. invalid character "e"). Hence, we use `Decimal.toFixed()` (which is
  // different than `number.toFixed()` - it will not do any rounding, just render a normal notation).
  // see https://mikemcl.github.io/decimal.js/#toFixed
  return BigInt(value.toFixed());
}

export interface GlobalConfigAccounts {
  globalAdmin: TransactionSigner;
  globalConfig: TransactionSigner;
  treasuryVaults: Array<Address>;
  treasuryVaultAuthority: Address;
  globalAdminRewardAtas: Array<Address>;
}

export interface FarmAccounts {
  farmAdmin: TransactionSigner;
  farmState: TransactionSigner;
  tokenMint: Address;
  farmVault: Address;
  rewardVaults: Array<Address>;
  farmVaultAuthority: Address;
  rewardMints: Array<Address>;
  adminRewardAtas: Array<Address>;
}

export async function checkIfAccountExists(
  connection: Rpc<GetAccountInfoApi>,
  account: Address,
): Promise<boolean> {
  return (
    (await connection.getAccountInfo(account, { encoding: "base64" }).send())
      .value != null
  );
}

/**
 * Get the custom program error code if there's any in the error message and return parsed error code hex to number string
 * @param errMessage string - error message that would contain the word "custom program error:" if it's a customer program error
 * @returns [boolean, string] - probably not a custom program error if false otherwise the second element will be the code number in string
 */
export const getCustomProgramErrorCode = (
  errMessage: string,
): [boolean, string] => {
  const index = errMessage.indexOf("Custom program error:");
  if (index === -1) {
    return [false, "May not be a custom program error"];
  } else {
    return [
      true,
      `${parseInt(
        errMessage.substring(index + 22, index + 28).replace(" ", ""),
        16,
      )}`,
    ];
  }
};

/**
 *
 * Maps the private Anchor type ProgramError to a normal Error.
 * Pass ProgramErr.msg as the Error message so that it can be used with chai matchers
 *
 * @param fn - function which may throw an anchor ProgramError
 */
export async function mapAnchorError<T>(fn: Promise<T>): Promise<T> {
  try {
    return await fn;
  } catch (e: any) {
    let [isCustomProgramError, errorCode] = getCustomProgramErrorCode(
      JSON.stringify(e),
    );
    if (isCustomProgramError) {
      if (!isNaN(Number(errorCode))) {
        const errorMessage = getFarmsErrorMessage(Number(errorCode) as any);
        if (errorMessage) {
          throw new Error(errorMessage);
        }
      }
      throw new Error(e);
    }
    throw e;
  }
}

export async function getTokenAccountBalance(
  rpc: Rpc<GetTokenAccountBalanceApi>,
  tokenAccount: Address,
): Promise<Decimal> {
  const tokenAccountBalance = await rpc
    .getTokenAccountBalance(tokenAccount)
    .send();
  return new Decimal(tokenAccountBalance.value.amount).div(
    Decimal.pow(10, tokenAccountBalance.value.decimals),
  );
}

export async function getTokenAccountBalanceLamports(
  rpc: Rpc<GetTokenAccountBalanceApi>,
  tokenAccount: Address,
): Promise<number> {
  const tokenAccountBalance = await rpc
    .getTokenAccountBalance(tokenAccount)
    .send();
  return new Decimal(tokenAccountBalance.value.amount).toNumber();
}

export async function getSolBalanceInLamports(
  rpc: Rpc<GetBalanceApi>,
  account: Address,
): Promise<Lamports> {
  let balance: Lamports | undefined = undefined;
  while (balance === undefined) {
    balance = (await rpc.getBalance(account).send()).value;
  }
  return balance;
}

export async function getSolBalance(
  rpc: Rpc<GetBalanceApi>,
  account: Address,
): Promise<Decimal> {
  const balance = new Decimal(
    (await getSolBalanceInLamports(rpc, account)).toString(),
  );
  return lamportsToCollDecimal(balance, 9);
}

export function createAddExtraComputeUnitsTransaction(
  units: number,
): IInstruction {
  return getSetComputeUnitLimitInstruction({ units });
}

export function u16ToBytes(num: number) {
  const arr = new ArrayBuffer(2);
  const view = new DataView(arr);
  view.setUint16(0, num, false);
  return new Uint8Array(arr);
}

export async function accountExist(
  rpc: Rpc<GetAccountInfoApi>,
  account: Address,
) {
  const info = await rpc.getAccountInfo(account, { encoding: "base64" }).send();
  if (info.value === null || info.value.data[0].length === 0) {
    return false;
  }
  return true;
}

export async function fetchFarmStateWithRetry(
  rpc: Rpc<GetAccountInfoApi>,
  addr: Address,
): Promise<FarmState | null> {
  return fetchWithRetry(async () => {
    const account = await fetchMaybeFarmState(rpc, addr);
    return account.exists ? account.data : null;
  }, addr);
}

export async function fetchGlobalConfigWithRetry(
  rpc: Rpc<GetAccountInfoApi>,
  addr: Address,
): Promise<GlobalConfig> {
  const result = await fetchWithRetry(async () => {
    const account = await fetchMaybeGlobalConfig(rpc, addr);
    return account.exists ? account.data : null;
  }, addr);
  if (result === null) {
    throw new Error(`GlobalConfig account ${addr} not found after retries`);
  }
  return result;
}

export async function fetchUserStateWithRetry(
  rpc: Rpc<GetAccountInfoApi>,
  addr: Address,
): Promise<UserState> {
  const result = await fetchWithRetry(async () => {
    const account = await fetchMaybeUserState(rpc, addr);
    return account.exists ? account.data : null;
  }, addr);
  if (result === null) {
    throw new Error(`UserState account ${addr} not found after retries`);
  }
  return result;
}

export async function getTreasuryVaultPDA(
  programId: Address,
  globalConfig: Address,
  rewardMint: Address,
): Promise<Address> {
  const [treasuryVault] = await getProgramDerivedAddress({
    seeds: [
      new TextEncoder().encode("tvault"),
      addressEncoder.encode(globalConfig),
      addressEncoder.encode(rewardMint),
    ],
    programAddress: programId,
  });
  return treasuryVault;
}

export async function getTreasuryAuthorityPDA(
  farmsProgramId: Address,
  globalConfig: Address,
): Promise<Address> {
  const [treasuryAuthority] = await getProgramDerivedAddress({
    seeds: [
      new TextEncoder().encode("authority"),
      addressEncoder.encode(globalConfig),
    ],
    programAddress: farmsProgramId,
  });
  return treasuryAuthority;
}

export async function getFarmAuthorityPDA(
  farmsProgramId: Address,
  farmState: Address,
): Promise<Address> {
  const [farmAuthority] = await getProgramDerivedAddress({
    seeds: [
      new TextEncoder().encode("authority"),
      addressEncoder.encode(farmState),
    ],
    programAddress: farmsProgramId,
  });
  return farmAuthority;
}

export async function getFarmVaultPDA(
  farmsProgramId: Address,
  farmState: Address,
  tokenMint: Address,
): Promise<Address> {
  const [farmVault] = await getProgramDerivedAddress({
    seeds: [
      new TextEncoder().encode("fvault"),
      addressEncoder.encode(farmState),
      addressEncoder.encode(tokenMint),
    ],
    programAddress: farmsProgramId,
  });
  return farmVault;
}

export async function getRewardVaultPDA(
  programId: Address,
  farmState: Address,
  rewardMint: Address,
): Promise<Address> {
  const [rewardVault] = await getProgramDerivedAddress({
    seeds: [
      new TextEncoder().encode("rvault"),
      addressEncoder.encode(farmState),
      addressEncoder.encode(rewardMint),
    ],
    programAddress: programId,
  });
  return rewardVault;
}

export async function getUserStatePDA(
  programId: Address,
  farmState: Address,
  owner: Address,
): Promise<Address> {
  const [userState] = await getProgramDerivedAddress({
    seeds: [
      new TextEncoder().encode("user"),
      addressEncoder.encode(farmState),
      addressEncoder.encode(owner),
    ],
    programAddress: programId,
  });
  return userState;
}

async function fetchWithRetry(
  fetch: () => Promise<any>,
  address: Address,
  retries: number = 3,
) {
  for (let i = 0; i < retries; i++) {
    let resp = await fetch();
    if (resp !== null) {
      return resp;
    }
    console.log(
      `[${i + 1}/${retries}] Fetched account ${address} is null. Refetching...`,
    );
  }
  return null;
}

export function getGlobalConfigValue(
  flagValueType: GlobalConfigFlagValueType,
  flagValue: string,
): number[] {
  let value: bigint | Address | boolean;
  if (flagValueType === "number") {
    value = BigInt(flagValue);
  } else if (flagValueType === "bool") {
    if (flagValue === "false") {
      value = false;
    } else if (flagValue === "true") {
      value = true;
    } else {
      throw new Error("the provided flag value is not valid bool");
    }
  } else if (flagValueType === "publicKey") {
    value = address(flagValue);
  } else {
    throw new Error("flagValueType must be 'number', 'bool', or 'publicKey'");
  }

  let buffer: Uint8Array;
  if (typeof value === "string" && isAddress(value)) {
    buffer = new Uint8Array(addressEncoder.encode(value));
  } else if (typeof value === "boolean") {
    buffer = new Uint8Array(32);
    buffer[0] = value ? 1 : 0;
  } else if (typeof value === "bigint") {
    buffer = new Uint8Array(32);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(0, value, true); // Because we send 32 bytes and a u64 has 8 bytes, we write it in LE
  } else {
    throw Error("wrong type for value");
  }
  return [...buffer];
}

export async function createKeypairRentExemptIx(
  rpc: Rpc<GetMinimumBalanceForRentExemptionApi>,
  payer: TransactionSigner,
  account: TransactionSigner,
  size: bigint,
  programId: Address = FARMS_PROGRAM_ADDRESS,
): Promise<IInstruction> {
  return getCreateAccountInstruction({
    payer: payer,
    space: size,
    lamports: await rpc.getMinimumBalanceForRentExemption(size).send(),
    programAddress: programId,
    newAccount: account,
  });
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function scaleDownWads(value: bigint) {
  return new Decimal(value.toString()).div(WAD).toNumber();
}

export function convertAmountToStake(
  amount: Decimal,
  totalStaked: Decimal,
  totalAmount: Decimal,
): Decimal {
  if (amount === new Decimal(0)) {
    return new Decimal(0);
  }

  if (totalAmount !== new Decimal(0)) {
    return totalStaked.mul(amount).div(totalAmount);
  } else {
    return amount;
  }
}

export const parseTokenSymbol = (tokenSymbol: number[]): string => {
  return String.fromCharCode(...tokenSymbol.filter((x) => x > 0));
};

export async function retryAsync(
  fn: () => Promise<any>,
  retriesLeft = 5,
  interval = 2000,
): Promise<any> {
  try {
    return await fn();
  } catch (error) {
    if (retriesLeft) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      return await retryAsync(fn, retriesLeft - 1, interval);
    }
    throw error;
  }
}

export function noopProfiledFunctionExecution(
  promise: Promise<any>,
): Promise<any> {
  return promise;
}

export function isValidPubkey(address?: Address): address is Address {
  if (!address) {
    return false;
  }

  return address !== DEFAULT_PUBLIC_KEY;
}

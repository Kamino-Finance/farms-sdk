import { Address, generateKeyPairSigner, TransactionSigner } from "@solana/kit";
import { getFarmAuthorityPDA, getFarmVaultPDA } from "./utils";
import { FarmAccounts } from "./utils";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";
import { FARMS_PROGRAM_ADDRESS as FARMS_PROGRAM_ID } from "../@codegen/farms/programs";

export async function createFarmAccounts(
  farmsProgramId: Address,
  rewardTokens: Array<Address>,
  tokenMint: Address,
  farmAdmin: TransactionSigner,
): Promise<FarmAccounts> {
  const farmState: TransactionSigner = await generateKeyPairSigner();

  const farmVault = await getFarmVaultPDA(
    farmsProgramId,
    farmState.address,
    tokenMint,
  );
  const farmVaultAuthority = await getFarmAuthorityPDA(
    farmsProgramId,
    farmState.address,
  );

  let rewardVaults = new Array<Address>();
  let adminRewardAtas = new Array<Address>();

  let farmAccounts: FarmAccounts = {
    farmAdmin: farmAdmin,
    farmState: farmState,
    tokenMint,
    farmVault,
    rewardVaults,
    farmVaultAuthority,
    rewardMints: rewardTokens,
    adminRewardAtas,
  };

  return farmAccounts;
}

export async function createDelegatedFarmAccounts(
  rewardTokens: Array<Address>,
  farmAdmin: TransactionSigner,
  farmsProgramId: Address = FARMS_PROGRAM_ID,
): Promise<FarmAccounts> {
  const farmState: TransactionSigner = await generateKeyPairSigner();

  const farmVaultAuthority = await getFarmAuthorityPDA(
    farmsProgramId,
    farmState.address,
  );

  let rewardVaults = new Array<Address>();
  let adminRewardAtas = new Array<Address>();

  let farmAccounts: FarmAccounts = {
    farmAdmin: farmAdmin,
    farmState: farmState,
    tokenMint: DEFAULT_PUBLIC_KEY,
    farmVault: DEFAULT_PUBLIC_KEY,
    rewardVaults,
    farmVaultAuthority,
    rewardMints: rewardTokens,
    adminRewardAtas,
  };

  return farmAccounts;
}

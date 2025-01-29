import {
  TransactionInstruction,
  PublicKey,
  AccountMeta,
} from "@solana/web3.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId";

export interface InitializeFarmDelegatedAccounts {
  farmAdmin: PublicKey;
  farmDelegate: PublicKey;
  farmState: PublicKey;
  globalConfig: PublicKey;
  farmVaultsAuthority: PublicKey;
  systemProgram: PublicKey;
  rent: PublicKey;
}

export function initializeFarmDelegated(
  accounts: InitializeFarmDelegatedAccounts,
  programId: PublicKey = PROGRAM_ID,
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.farmAdmin, isSigner: true, isWritable: true },
    { pubkey: accounts.farmDelegate, isSigner: true, isWritable: false },
    { pubkey: accounts.farmState, isSigner: false, isWritable: true },
    { pubkey: accounts.globalConfig, isSigner: false, isWritable: false },
    {
      pubkey: accounts.farmVaultsAuthority,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.rent, isSigner: false, isWritable: false },
  ];
  const identifier = Buffer.from([250, 84, 101, 25, 51, 77, 204, 91]);
  const data = identifier;
  const ix = new TransactionInstruction({ keys, programId, data });
  return ix;
}

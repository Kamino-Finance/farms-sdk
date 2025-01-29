import {
  TransactionInstruction,
  PublicKey,
  AccountMeta,
} from "@solana/web3.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId";

export interface InitializeUserAccounts {
  authority: PublicKey;
  payer: PublicKey;
  owner: PublicKey;
  delegatee: PublicKey;
  userState: PublicKey;
  farmState: PublicKey;
  systemProgram: PublicKey;
  rent: PublicKey;
}

export function initializeUser(
  accounts: InitializeUserAccounts,
  programId: PublicKey = PROGRAM_ID,
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.payer, isSigner: true, isWritable: true },
    { pubkey: accounts.owner, isSigner: false, isWritable: false },
    { pubkey: accounts.delegatee, isSigner: false, isWritable: false },
    { pubkey: accounts.userState, isSigner: false, isWritable: true },
    { pubkey: accounts.farmState, isSigner: false, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.rent, isSigner: false, isWritable: false },
  ];
  const identifier = Buffer.from([111, 17, 185, 250, 60, 122, 38, 254]);
  const data = identifier;
  const ix = new TransactionInstruction({ keys, programId, data });
  return ix;
}

import {
  address,
  Address,
  generateKeyPairSigner,
  getAddressEncoder,
  GetAccountInfoApi,
  Instruction,
  lamports,
  Rpc,
  TransactionSigner,
} from '@solana/kit';
import Decimal from 'decimal.js';
import { Env } from './env';
import { ConnectionPool, sendAndConfirmTx } from './tx';
import { getCreateAccountInstruction, SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import {
  getCreateAssociatedTokenInstruction,
  getInitializeMint2Instruction,
  getMintToInstruction,
} from '@solana-program/token-2022';
import { getAssociatedTokenAddress } from '../../src/utils/token';
import { FARMS_PROGRAM_ADDRESS } from '../../src/@codegen/farms/programs';

export const SOLMintMainnet: Address = address('So11111111111111111111111111111111111111112');
export const USDCMintMainnet: Address = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export async function accountExists(rpc: Rpc<GetAccountInfoApi>, account: Address): Promise<boolean> {
  const info = await rpc.getAccountInfo(account).send();
  return info.value != null && info.value.data.length > 0;
}

export async function solAirdrop(rpc: Rpc<any>, to: Address, solAmount: number = 100): Promise<void> {
  await (rpc as any).requestAirdrop(to, lamports(BigInt(solAmount * 1e9))).send();
  await new Promise((r) => setTimeout(r, 1000));
}

export async function createMint(env: Env, decimals: number = 6): Promise<Address> {
  const mint = await generateKeyPairSigner();
  const space = 82n; // Mint account size
  const rentExempt = await env.c.rpc.getMinimumBalanceForRentExemption(space).send();

  const createAccountIx = getCreateAccountInstruction({
    payer: env.admin,
    newAccount: mint,
    lamports: rentExempt,
    space: space,
    programAddress: TOKEN_PROGRAM_ADDRESS,
  });

  const initMintIx = getInitializeMint2Instruction({
    mint: mint.address,
    decimals,
    mintAuthority: env.admin.address,
    freezeAuthority: null,
  });

  await sendAndConfirmTx(env.c, env.admin, [createAccountIx, initMintIx], [mint]);
  return mint.address;
}

export async function setupAta(
  env: Env,
  mint: Address,
  owner: Address = env.admin.address,
): Promise<Address> {
  const ata = await getAssociatedTokenAddress(owner, mint, TOKEN_PROGRAM_ADDRESS);
  const ix = getCreateAssociatedTokenInstruction({
    payer: env.admin,
    owner,
    mint,
    ata,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await sendAndConfirmTx(env.c, env.admin, [ix]);
  return ata;
}

export async function mintTo(
  env: Env,
  mint: Address,
  destination: Address,
  amount: bigint,
): Promise<void> {
  const ix = getMintToInstruction({
    mint,
    token: destination,
    mintAuthority: env.admin,
    amount,
  });
  await sendAndConfirmTx(env.c, env.admin, [ix]);
}

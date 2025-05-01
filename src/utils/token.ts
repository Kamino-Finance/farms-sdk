import {
  Address,
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  IInstruction,
  Rpc,
  TransactionSigner,
} from "@solana/kit";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
} from "@solana-program/token-2022";
import {
  getCreateAccountInstruction,
  SYSTEM_PROGRAM_ADDRESS,
} from "@solana-program/system";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

export async function createMintInstructions(
  rpc: Rpc<GetMinimumBalanceForRentExemptionApi>,
  authority: TransactionSigner,
  mint: TransactionSigner,
  decimals: number,
): Promise<IInstruction[]> {
  return [
    getCreateAccountInstruction({
      payer: authority,
      space: 82n,
      lamports: await rpc.getMinimumBalanceForRentExemption(82n).send(),
      programAddress: TOKEN_PROGRAM_ADDRESS,
      newAccount: mint,
    }),
    getInitializeMint2Instruction(
      {
        mint: mint.address,
        decimals,
        mintAuthority: authority.address,
        freezeAuthority: null,
      },
      { programAddress: TOKEN_PROGRAM_ADDRESS },
    ),
  ];
}

export async function getMintDecimals(
  rpc: Rpc<GetAccountInfoApi>,
  mintAddress: Address,
): Promise<number> {
  const mint = await fetchMint(rpc, mintAddress);
  return mint.data.decimals;
}

export async function getAssociatedTokenAddress(
  owner: Address,
  tokenMintAddress: Address,
  tokenProgram: Address,
): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    mint: tokenMintAddress,
    owner,
    tokenProgram,
  });
  return ata;
}

export async function createAssociatedTokenAccountIdempotentInstruction(
  payer: TransactionSigner,
  mint: Address,
  tokenProgram: Address,
  owner: Address = payer.address,
  ata?: Address,
): Promise<[Address, IInstruction]> {
  let ataAddress = ata;
  if (!ataAddress) {
    ataAddress = await getAssociatedTokenAddress(owner, mint, tokenProgram);
  }
  const createUserTokenAccountIx =
    getCreateAssociatedTokenIdempotentInstruction(
      {
        ata: ataAddress,
        mint: mint,
        owner,
        payer,
        tokenProgram,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
      },
      { programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS },
    );
  return [ataAddress, createUserTokenAccountIx];
}

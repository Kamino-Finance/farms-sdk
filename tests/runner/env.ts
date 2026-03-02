import {
  address,
  Address,
  createDefaultRpcTransport,
  createRpc,
  createSolanaRpcApi,
  createSolanaRpcSubscriptions,
  DEFAULT_RPC_CONFIG,
  generateKeyPairSigner,
  lamports,
  SolanaRpcApi,
  TransactionSigner,
} from '@solana/kit';
import { ConnectionPool } from './tx';

export type Env = {
  admin: TransactionSigner;
  c: ConnectionPool;
  farmsProgramId: Address;
};

export type InitEnvParams = {
  rpcUrl?: string;
  wsUrl?: string;
  admin?: TransactionSigner;
  farmsProgramId?: Address;
};

export async function initEnv({
  rpcUrl = 'http://localhost:8899',
  wsUrl = 'ws://localhost:8900',
  farmsProgramId = address('FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr'),
  admin,
}: InitEnvParams = {}): Promise<Env> {
  const api = createSolanaRpcApi<SolanaRpcApi>({
    ...DEFAULT_RPC_CONFIG,
    defaultCommitment: 'processed',
  });
  const rpc = createRpc({ api, transport: createDefaultRpcTransport({ url: rpcUrl }) });
  const ws = createSolanaRpcSubscriptions(wsUrl);

  const adminSigner = admin ?? (await generateKeyPairSigner());

  const solAirdrop = 1000;
  await rpc.requestAirdrop(adminSigner.address, lamports(BigInt(solAirdrop * 1e9))).send();
  // Give airdrop time to land
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`Airdropped ${solAirdrop} SOL to admin: ${adminSigner.address}`);

  return {
    admin: adminSigner,
    c: { rpc, wsRpc: ws },
    farmsProgramId,
  };
}

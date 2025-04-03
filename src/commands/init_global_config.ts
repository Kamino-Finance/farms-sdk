import { Keypair } from "@solana/web3.js";
import { Farms } from "../Farms";
import { GlobalConfig } from "../rpc_client/accounts";
import { initializeClient } from "./utils";
import { getFarmsProgramId } from "../utils";

export async function initGlobalConfigCommand() {
  const admin = process.env.ADMIN;
  const rpc = process.env.RPC;
  const env = initializeClient(rpc!, admin!, getFarmsProgramId(rpc!), false);
  const globalConfig = Keypair.generate();
  const farmsClient = new Farms(env.provider.connection);
  await farmsClient.createGlobalConfig(
    env.initialOwner,
    globalConfig,
    1,
    env.web3Client,
  );

  let globalConfigState: GlobalConfig | null = await GlobalConfig.fetch(
    env.provider.connection,
    globalConfig.publicKey,
  );
  console.log(
    "Global Config",
    globalConfig.publicKey.toString(),
    globalConfigState?.toJSON(),
  );
}

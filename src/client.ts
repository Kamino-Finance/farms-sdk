#!/usr/bin/env npx ts-node

import * as anchor from "@coral-xyz/anchor";
import { Command } from "commander";
import Decimal from "decimal.js";
import dotenv from "dotenv";
dotenv.config({
  path: `../.env${process.env.ENV ? "." + process.env.ENV : ""}`,
});

import { collToLamportsDecimal } from "./utils/utils";
import { PublicKey } from "@solana/web3.js";
import { Farms } from "./Farms";
import { getFarmsProgramId, parseKeypairFile } from "./utils";
import { initializeClient } from "./commands/utils";
import { refreshFarmCommand } from "./commands/refresh_farm";
import { refreshKlendFarmsCommand } from "./commands/refresh_klend_farm";
import { refreshAllUsersCommand } from "./commands/refresh_all_users";
import { initGlobalConfigCommand } from "./commands/init_global_config";
import { updateGlobalConfigCommand } from "./commands/update_global_config";
import { initFarm } from "./commands/init_farm";
import { harvestUserRewardsCommand } from "./commands/harvest_user_rewards";
import { updateFarmConfigCommand } from "./commands/update_farm_config";
import { initRewardCommand } from "./commands/init_reward";
import { refreshAllKlendUsersCommand } from "./commands/refresh_all_klend_users";
import { harvestKlendUserRewardsCommand } from "./commands/harvest_klend_user_rewards";
import { downloadAllUserObligationsForReserve } from "./commands/download_all_klend_user_obligation_farms";
import { updateFarmAdminCommand } from "./commands/update_farm_admin";
import { updateGlobalConfigAdminCommand } from "./commands/update_global_admin";
import { downloadAllFarmStates } from "./commands/download_all_farm_states";
import { updateAllFarmsPendingAdminsFromFile } from "./commands/update_all_farms_pending_admins_from_file";
import { updateAllFarmsAdminsFromFile } from "./commands/update_all_farms_admins_from_file";
import { initializeKlendFarmForReserve } from "./commands/init_klend_farm";
import { initAllKlendUserObligationFarmsFromFileCommand } from "./commands/init_all_klend_user_obligation_farms_from_file";
import { refreshAllKlendObligationFarmsFromFileCommand } from "./commands/refresh_all_klend_user_obligation_farms_from_file";
import { withdrawFarmRewardCommand } from "./commands/withdraw_farm_reward_command";
import { downloadAllFarmConfigs } from "./commands/download_all_farm_configs";
import { upsertAllFarmConfigsCommand } from "./commands/upsert_all_farm_configs";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  topUpFarmForRewardForStrategy,
  updateFarmRpsForRewardCommand,
} from "./commands/example_update_rps_and_top_up";
import { initFarmDelegated } from "./commands/init_farm_delegated";
import {
  createMintFromKeypair,
  getAssociatedTokenAddress,
  getMintDecimals,
  mintTo,
  setupAta,
} from "./utils/token";

const BaseMintOptions = ["base-mint", "base-mint-file", "init-base-mint"];
export type BaseMintOption = (typeof BaseMintOptions)[number];

async function main() {
  const commands = new Command();

  commands
    .name("farms-cli")
    .description("CLI to interact with the farms program");

  commands.command("init-global-config").action(async () => {
    await initGlobalConfigCommand();
  });

  commands
    .command("update-global-config")
    .option("--update-mode <string>")
    .option("--flag-value-type <string>", "number|bool|publicKey")
    .option("--flag-value <string>")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation",
    )
    .action(
      async ({
        updateMode,
        flagValueType,
        flagValue,
        priorityFeeMultiplier,
        mode,
      }) => {
        await updateGlobalConfigCommand(
          updateMode,
          flagValueType,
          flagValue,
          mode,
          priorityFeeMultiplier
            ? new Decimal(priorityFeeMultiplier).toNumber()
            : 1,
        );
      },
    );

  commands
    .command("update-global-config-admin")
    .option(
      "--global-config <string>",
      "global-config pubkey - overrides .env file value",
    )
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation",
    )
    .action(async ({ globalConfig, priorityFeeMultiplier, mode }) => {
      await updateGlobalConfigAdminCommand(
        globalConfig ? new PublicKey(globalConfig) : PublicKey.default,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("init-farm")
    .option("--token-mint, <string>", "Token mint for farm token")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation",
    )
    .action(async ({ tokenMint, priorityFeeMultiplier, mode }) => {
      await initFarm(
        tokenMint,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("init-farm-delegated")
    .option("--delegated-authority-path, <string>", "the delegated farm admin")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation",
    )
    .action(async ({ delegatedAuthorityPath, priorityFeeMultiplier, mode }) => {
      const delegatedAuthorityKeyPair = parseKeypairFile(
        delegatedAuthorityPath,
      );

      await initFarmDelegated(
        delegatedAuthorityKeyPair,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("init-reward")
    .description("Add a new reward for an existing farm")
    .option("--farm, <string>")
    .option("--reward-mint, <string>", "Token mint for farm token")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation",
    )
    .action(async ({ farm, rewardMint, priorityFeeMultiplier, mode }) => {
      await initRewardCommand(
        farm,
        rewardMint,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("update-farm-config")
    .description("Update config of an existing reward for an existing farm")
    .option("--farm, <string>")
    .option("--reward-mint, <string>")
    .option("--update-mode <string>", "The mode name")
    .option("--value <string>")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(
      async ({
        farm,
        rewardMint,
        updateMode,
        value,
        priorityFeeMultiplier,
        mode,
      }) => {
        await updateFarmConfigCommand(
          farm,
          rewardMint,
          updateMode,
          value,
          mode,
          priorityFeeMultiplier
            ? new Decimal(priorityFeeMultiplier).toNumber()
            : 1,
        );
      },
    );

  commands
    .command("update-farm-admin")
    .description(
      "Update admin of an existing farm by signing with the pending_admin",
    )
    .option("--farm, <string>")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(async ({ farm, priorityFeeMultiplier, mode }) => {
      await updateFarmAdminCommand(
        farm,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("harvest-user-rewards")
    .description("Simulate the txn to harvest rewards for a user")
    .option("--farm, <string>")
    .option("--user, <string>")
    .option("--reward-mint, <string>")
    .action(async ({ farm, user, rewardMint }) => {
      await harvestUserRewardsCommand(farm, user, rewardMint);
    });

  commands
    .command("refresh-farm")
    .description("Top up reward tokens to vault of existing reward")
    .option(`--farm <string>`, "The admin keypair file")
    .action(async ({ farm }) => {
      await refreshFarmCommand(farm);
    });

  commands
    .command("refresh-all-users")
    .description("Refresh all users for given farm")
    .option("--farm <string>")
    .action(async ({ farm }) => {
      await refreshAllUsersCommand(farm);
    });

  commands
    .command("refresh-klend-farms")
    .option(`--reserve <string>`)
    .action(async ({ reserve }) => {
      await refreshKlendFarmsCommand(reserve);
    });

  commands
    .command("refresh-all-klend-users")
    .option(`--reserve <string>`)
    .action(async ({ reserve }) => {
      await refreshAllKlendUsersCommand(reserve);
    });

  commands
    .command("download-all-user-obligations-for-reserve")
    .requiredOption(`--market <string>`)
    .requiredOption(`--reserve <string>`)
    .action(async ({ market, reserve }) => {
      await downloadAllUserObligationsForReserve(market, reserve);
    });

  commands
    .command("init-all-klend-user-obligation-farms-from-file")
    .requiredOption(`--market <string>`)
    .requiredOption(`--file <string>`)
    .requiredOption(`--reserve <string>`)
    .requiredOption(`--farm-type <string>`, `collateral | debt`)
    .action(async ({ market, file, reserve, farmType }) => {
      await initAllKlendUserObligationFarmsFromFileCommand(
        market,
        file,
        reserve,
        farmType,
      );
    });

  commands
    .command("refresh-all-klend-obligation-farms-from-file")
    .requiredOption(`--market <string>`)
    .requiredOption(`--file <string>`)
    .action(async ({ market, file }) => {
      await refreshAllKlendObligationFarmsFromFileCommand(market, file);
    });

  commands
    .command("harvest-klend-user-rewards")
    .description("Simulate the txn to harvest rewards for a user")
    .option("--reserve, <string>")
    .option("--user, <string>")
    .option("--reward-mint, <string>")
    .action(async ({ reserve, user, rewardMint }) => {
      await harvestKlendUserRewardsCommand(reserve, user, rewardMint);
    });

  commands
    .command("withdraw-farm-reward")
    .description("Simulate the txn to harvest rewards for a user")
    .option("--farm, <string>")
    .option("--reward-mint, <string>")
    .option("--amount, <string>")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(
      async ({ farm, rewardMint, amount, priorityFeeMultiplier, mode }) => {
        await withdrawFarmRewardCommand(
          farm,
          rewardMint,
          amount,
          mode,
          priorityFeeMultiplier
            ? new Decimal(priorityFeeMultiplier).toNumber()
            : 1,
        );
      },
    );

  commands
    .command("top-up-reward")
    .description("Top up reward tokens to vault of existing reward")
    .option(`--admin <string>`, "The admin keypair file")
    .option(`--rpc <string>`, "The Solana cluster to use")
    .option("--farm, <string>")
    .option("--reward-mint, <string>", "Mint for desired reward token")
    .option("--amount <number>", "Amount of reward tokens to add to vault")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .option(
      "--mode <string>",
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(
      async ({
        admin,
        rpc,
        farm,
        rewardMint,
        amount,
        priorityFeeMultiplier,
        mode,
      }) => {
        const env = initializeClient(
          rpc,
          admin,
          getFarmsProgramId(rpc),
          mode === "multisig",
        );

        const farmsClient = new Farms(env.provider.connection);

        const sig = await farmsClient.addRewardAmountToFarm(
          env.initialOwner,
          new PublicKey(farm),
          new PublicKey(rewardMint),
          new Decimal(amount),
          mode,
          priorityFeeMultiplier
            ? new Decimal(priorityFeeMultiplier).toNumber()
            : 1,
        );

        mode !== "multisig" && console.log("Signature", sig);
      },
    );

  commands
    .command("download-all-farm-state-keys-and-admins")
    .action(async () => {
      await downloadAllFarmStates();
    });

  commands
    .command("update-all-farms-pending-admins-from-file")
    .requiredOption(
      `--file <string>`,
      "The file with list of farms and current admin",
    )
    .requiredOption(`--pending-admin <string>`, "The pending admin to be set")
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .requiredOption(
      `--mode <string>`,
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(async ({ file, pendingAdmin, priorityFeeMultiplier, mode }) => {
      await updateAllFarmsPendingAdminsFromFile(
        file,
        pendingAdmin,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("update-all-farms-admins-from-file")
    .requiredOption(
      `--file <string>`,
      "The file with list of farms and current admin",
    )
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .requiredOption(
      `--mode <string>`,
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(async ({ file, priorityFeeMultiplier, mode }) => {
      await updateAllFarmsAdminsFromFile(
        file,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("download-all-farm-configs")
    .requiredOption(
      `--target-path <string>`,
      "The path to download the farms to",
    )
    .action(async ({ targetPath }) => {
      await downloadAllFarmConfigs(targetPath);
    });

  commands
    .command("upsert-all-farm-configs")
    .requiredOption(
      `--target-path <string>`,
      "The path to download the farms to",
    )
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .requiredOption(
      `--mode <string>`,
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(async ({ targetPath, priorityFeeMultiplier, mode }) => {
      await upsertAllFarmConfigsCommand(
        targetPath,
        mode,
        priorityFeeMultiplier
          ? new Decimal(priorityFeeMultiplier).toNumber()
          : 1,
      );
    });

  commands
    .command("init-klend-farm")
    .requiredOption(`--reserve <string>`, "The reserve to create the farm for")
    .requiredOption(`--kind <string>`, "The kind of farm - Collateral | Debt")
    .requiredOption(
      `--multisig-to-execute <string>`,
      "The multisig used to execute the transaction - should be LendingMarket admin",
    )
    .requiredOption(
      `--pending-admin <string>`,
      "The pending admin to be set in order to transfer authority on creation - usually farms multisig",
    )
    .option(
      "--priority-fee-multiplier <string>",
      "the amount of priority fees to add - (multiply 1 lamport)",
    )
    .requiredOption(
      `--mode <string>`,
      "multisig - will print bs58 txn only, simulate - will print bs64 txn explorer link and simulation, execute - will execute",
    )
    .action(
      async ({
        reserve,
        kind,
        multisigToExecute,
        pendingAdmin,
        priorityFeeMultiplier,
        mode,
      }) => {
        await initializeKlendFarmForReserve(
          new PublicKey(reserve),
          kind,
          new PublicKey(multisigToExecute),
          new PublicKey(pendingAdmin),
          mode,
          priorityFeeMultiplier
            ? new Decimal(priorityFeeMultiplier).toNumber()
            : 1,
        );
      },
    );

  commands
    .command("update-farm-rps-for-reward")
    .requiredOption(`--farm <string>`, "The farm")
    .requiredOption(`--reward <string>`, "The reward mint")
    .requiredOption(`--rps <string>`, "The rewards per second to set")
    .action(async ({ farm, reward, rps }) => {
      await updateFarmRpsForRewardCommand(
        new PublicKey(reward),
        new PublicKey(farm),
        parseInt(rps),
      );
    });

  commands
    .command("top-up-farm-for-reward")
    .requiredOption(`--farm <string>`, "The farm")
    .requiredOption(`--reward <string>`, "The reward mint")
    .requiredOption(`--amount <string>`, "The amount to top up")
    .action(async ({ farm, reward, amount }) => {
      await topUpFarmForRewardForStrategy(
        new PublicKey(reward),
        new PublicKey(farm),
        new Decimal(amount),
      );
    });

  commands
    .command("create-mint")
    .option(`--admin <string>`, "The admin keypair file")
    .option(`--cluster <string>`, "The Solana cluster to use")
    .action(async ({ admin, cluster }) => {
      const env = initializeClient(
        cluster,
        admin,
        getFarmsProgramId(cluster),
        false,
      );

      const tokenMint = new anchor.web3.Keypair();

      await createMintFromKeypair(
        env.provider,
        env.initialOwner.publicKey,
        tokenMint,
      );

      console.log("new mint: ", tokenMint.publicKey.toString());
    });

  commands
    .command("create-ata")
    .option(`--admin <string>`, "The admin keypair file")
    .option(`--cluster <string>`, "The Solana cluster to use")
    .option(`--mint <string>`, "The Mint to use")
    .action(async ({ admin, cluster, mint }) => {
      const env = initializeClient(
        cluster,
        admin,
        getFarmsProgramId(cluster),
        false,
      );

      const tokenMint = new PublicKey(mint);

      const ata = await setupAta(env.provider, tokenMint, env.initialOwner);

      console.log("new ata: ", ata.toString());
    });

  commands
    .command("mint-token")
    .option(`--admin <string>`, "The admin keypair file")
    .option(`--cluster <string>`, "The Solana cluster to use")
    .option(`--mint <string>`, "The Mint to use")
    .option(`--amount <string>`, "The amount to reward")
    .action(async ({ admin, cluster, mint, amount }) => {
      const env = initializeClient(
        cluster,
        admin,
        getFarmsProgramId(cluster),
        false,
      );

      const tokenMint = new PublicKey(mint);
      const adminAta = await getAssociatedTokenAddress(
        env.initialOwner.publicKey,
        tokenMint,
        TOKEN_PROGRAM_ID,
      );

      const mintDecimals = await getMintDecimals(
        env.provider.connection,
        tokenMint,
      );
      const amountLamports = collToLamportsDecimal(
        new Decimal(amount),
        mintDecimals,
      );

      await mintTo(
        env.provider,
        tokenMint,
        adminAta,
        amountLamports.toNumber(),
      );

      console.log("success");
    });

  await commands.parseAsync();
}

main()
  .then(() => {
    process.exit();
  })
  .catch((e) => {
    console.error("\n\nFarms CLI exited with error:\n\n", e);
    process.exit(1);
  });

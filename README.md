# Farms SDK

Farms SDK is a TypeScript client SDK for easy access to the Farms on-chain data.

## How to install the SDK

[![npm](https://img.shields.io/npm/v/@kamino-finance/farms-sdk)](https://www.npmjs.com/package/@kamino-finance/farms-sdk)

```shell
npm install @solana/web3.js decimal.js @kamino-finance/farms-sdk 
```

```shell
npm update @kamino-finance/farms-sdk
```

## How to use the SDK

```typescript
// Initialize the client and then you can use it to fetch data by calling it
const farmsClient = new Farms(env.provider.connection);
```

## How to install the SDK

`yarn install`

# Client (CLI) Usage

#### .env file

In order to use the CLI, you will need a .env file. An example of it: 
```
RPC=rpc
ADMIN=../user.json
FARMS_GLOBAL_CONFIG=6UodrBjL2ZreDy7QdR4YV1oxqMBjVYSEyrFpctqqwGwL
KLEND_PROGRAM_ID=SLendK7ySfcEzyaFqy93gDnD3RtrpXJcnRwb6zFHJSh
LENDING_MARKET=6WVSwDQXrBZeQVnu6hpnsRZhodaJTZBUaC334SiiBKdb
KLEND_POINTS_MINT=KpsgfQAhVwUosX1SL2eiwBHejcTe8UvwSj4UWwnZiBU
SCOPE_PRICES=3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C
MULTISIG=BbM3mbcLsa3QcYEVx8iovwfKaA1iZ6DK5fEbbtHwS3N8
```

`cp ./.env.example ./.env` 

#### --mode parameter

Most commands will allow you to specify `--mode` which is used to specify how the txns
are ran:
- `--mode simulate` - Prints all the logs and simulates the transaction without execution
- `--mode execute` - Prints all the logs and executes the transaction
- `--mode multisig` - Prints no logs at all. The only output is the transaction in base58 - to be used for multisig

### --priority-fee-multiplier paramter

Most commands will allow you to specify `--priority-fee-multiplier` which is used to set the multiplier pritority fee.
The base is 1 lamport so `--priority-fee-multiplier 50000` would mean 50_000 lamports.

### How to create a global config

`yarn cli init-global-config`

### How to create a farm

`yarn cli init-farm --token-mint <mint_pk> --priority-fee-multiplier 50000 --mode execute`

### How to create a klend farm

`yarn cli init-klend-farm --reserve <reserve_pk> --kind Collateral/Debt --multisig-to-execute <multisig_auth_pk> --pending-admin <multisig_auth_pk> --priority-fee-multiplier 50000 --mode execute`

### How to init a reward for a farm

`yarn cli init-reward --farm <farm_pk> --reward-mint <mint_pk> --priority-fee-multiplier 50000 --mode execute`

Initializing a reward can also be done by adding it to the config of an existing farm config. More details of this flow explained below.

### How to update a farm

The easiest way to update and *batch update* farms is to use the following flow:

1. Download all farm configs:
`yarn cli download-all-farm-configs --target-path configs/latest`
This will download all farms split in 3 main folders:
- lending -> split in further folders for each market - based on the API, contains all farms (Coll/Debt) for all reserves for each market.
- yvaults -> contains all farms for live strategies
- standaloneFarms -> contains farms which are not included in the first two main folders

2. Modify the configs you want to. Most modifications are straightforward and almost everything can be changed.
To note:
- `rewardAvailable` - only shows how much there is available - modifying won't change anything
- `rewardToTopUp` - by default always 0 - modify this in order to create a top up change. By default this will be executed by your .env admin as this ixn is permissionless.
- `rewardToTopUpDurationDays` - works with `rewardToTopUp` and is used to calculated the reqiured RPS for the given topUp -> will update the rewardCurve *only if* it's a signle value curve and it's not modified by you.

3. Update everything by running:
`yarn cli upsert-all-farm-configs --target-path configs/latest --priority-fee-multiplier 50000 --mode print` - to only see the diff of your changes
`yarn cli upsert-all-farm-configs --target-path configs/latest --priority-fee-multiplier 50000 --mode simulate` - to only see the transaction simulation of your changes
`yarn cli upsert-all-farm-configs --target-path configs/latest --priority-fee-multiplier 50000 --mode execute/multisig` - to either execute or get the bs58 txns for multisig

### How to change a farm admin

First you need to make sure the pending admin is set to the right armin. This can be updated following the proccess above.

Then run the following command in order to set the current admin to the pending admin. (Can only be signed by the pending admin)

`yarn cli update-farm-admin --farm farm_address --priority-fee-multiplier 1000 --mode execute/multisig`


### How to Initialize and Refresh user obligation for new Klend farm

1. Download the obligations:
`yarn cli download-all-user-obligations-for-reserve --market <market> --reserve <reserve>`

2. Initialize all user obligations:
`yarn cli init-all-klend-user-obligation-farms-from-file --market <market> --file obligations-<reserve>.json`

3. Refresh all user obligations:
`yarn cli refresh-all-klend-obligation-farms-from-file --market <market> --file obligations-<reserve>.json`

### How to Set RPS as a delegated farm admin

```ts
  const farmsClient = new Farms(connection);

  const updateIxn = await farmsClient.updateFarmRpsForRewardIx(env.initialOwner.publicKey, reward, farm, rewardsPerSecond);
```

For a full example check `farms-sdk/src/commands/example_update_rps_and_top_up.ts`

### How to fetch all farms for a user

`yarn cli get-all-farms-for-user-with-filter --wallet <wallet_pk> --vault <vault_pk_1> --vault <vault_pk_2>`

`yarn cli get-all-farms-for-user-without-filter --wallet <wallet_pk>`

### How to top up a farm - permissionless

```ts
  const farmsClient = new Farms(connection);

  const topUpIx = await farmsClient.topUpFarmForRewardIx(env.initialOwner.publicKey, reward, farm, amountToTopUp);
```

For a full example check `farms-sdk/src/commands/example_update_rps_and_top_up.ts`

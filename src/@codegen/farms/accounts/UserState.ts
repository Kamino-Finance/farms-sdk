/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  address,
  Address,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  Rpc,
} from "@solana/kit"
/* eslint-enable @typescript-eslint/no-unused-vars */
import * as borsh from "../utils/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import { borshAddress } from "../utils" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UserStateFields {
  userId: bigint
  farmState: Address
  owner: Address
  /** Indicate if this user state is part of a delegated farm */
  isFarmDelegated: number
  padding0: Array<number>
  /**
   * Rewards tally used for computation of gained rewards
   * (scaled from `Decimal` representation).
   */
  rewardsTallyScaled: Array<bigint>
  /** Number of reward tokens ready for claim */
  rewardsIssuedUnclaimed: Array<bigint>
  lastClaimTs: Array<bigint>
  /**
   * User stake deposited and usable, generating rewards and fees.
   * (scaled from `Decimal` representation).
   */
  activeStakeScaled: bigint
  /**
   * User stake deposited but not usable and not generating rewards yet.
   * (scaled from `Decimal` representation).
   */
  pendingDepositStakeScaled: bigint
  /**
   * After this timestamp, pending user stake can be moved to user stake
   * Initialized to now() + delayed user stake period
   */
  pendingDepositStakeTs: bigint
  /**
   * User deposits unstaked, pending for withdrawal, not usable and not generating rewards.
   * (scaled from `Decimal` representation).
   */
  pendingWithdrawalUnstakeScaled: bigint
  /** After this timestamp, user can withdraw their deposit. */
  pendingWithdrawalUnstakeTs: bigint
  /** User bump used for account address validation */
  bump: bigint
  /** Delegatee used for initialisation - useful to check against */
  delegatee: Address
  lastStakeTs: bigint
  /**
   * Cumulative rewards issued to the user - ONLY used for stats/analytics
   * DO NOT USE IN ANY CALCULATIONS
   * Old userStates will have this field populated only from the point of release
   * not reflecting any historical data before this was released
   */
  rewardsIssuedCumulative: Array<bigint>
  padding1: Array<bigint>
}

export interface UserStateJSON {
  userId: string
  farmState: string
  owner: string
  /** Indicate if this user state is part of a delegated farm */
  isFarmDelegated: number
  padding0: Array<number>
  /**
   * Rewards tally used for computation of gained rewards
   * (scaled from `Decimal` representation).
   */
  rewardsTallyScaled: Array<string>
  /** Number of reward tokens ready for claim */
  rewardsIssuedUnclaimed: Array<string>
  lastClaimTs: Array<string>
  /**
   * User stake deposited and usable, generating rewards and fees.
   * (scaled from `Decimal` representation).
   */
  activeStakeScaled: string
  /**
   * User stake deposited but not usable and not generating rewards yet.
   * (scaled from `Decimal` representation).
   */
  pendingDepositStakeScaled: string
  /**
   * After this timestamp, pending user stake can be moved to user stake
   * Initialized to now() + delayed user stake period
   */
  pendingDepositStakeTs: string
  /**
   * User deposits unstaked, pending for withdrawal, not usable and not generating rewards.
   * (scaled from `Decimal` representation).
   */
  pendingWithdrawalUnstakeScaled: string
  /** After this timestamp, user can withdraw their deposit. */
  pendingWithdrawalUnstakeTs: string
  /** User bump used for account address validation */
  bump: string
  /** Delegatee used for initialisation - useful to check against */
  delegatee: string
  lastStakeTs: string
  /**
   * Cumulative rewards issued to the user - ONLY used for stats/analytics
   * DO NOT USE IN ANY CALCULATIONS
   * Old userStates will have this field populated only from the point of release
   * not reflecting any historical data before this was released
   */
  rewardsIssuedCumulative: Array<string>
  padding1: Array<string>
}

export class UserState {
  readonly userId: bigint
  readonly farmState: Address
  readonly owner: Address
  /** Indicate if this user state is part of a delegated farm */
  readonly isFarmDelegated: number
  readonly padding0: Array<number>
  /**
   * Rewards tally used for computation of gained rewards
   * (scaled from `Decimal` representation).
   */
  readonly rewardsTallyScaled: Array<bigint>
  /** Number of reward tokens ready for claim */
  readonly rewardsIssuedUnclaimed: Array<bigint>
  readonly lastClaimTs: Array<bigint>
  /**
   * User stake deposited and usable, generating rewards and fees.
   * (scaled from `Decimal` representation).
   */
  readonly activeStakeScaled: bigint
  /**
   * User stake deposited but not usable and not generating rewards yet.
   * (scaled from `Decimal` representation).
   */
  readonly pendingDepositStakeScaled: bigint
  /**
   * After this timestamp, pending user stake can be moved to user stake
   * Initialized to now() + delayed user stake period
   */
  readonly pendingDepositStakeTs: bigint
  /**
   * User deposits unstaked, pending for withdrawal, not usable and not generating rewards.
   * (scaled from `Decimal` representation).
   */
  readonly pendingWithdrawalUnstakeScaled: bigint
  /** After this timestamp, user can withdraw their deposit. */
  readonly pendingWithdrawalUnstakeTs: bigint
  /** User bump used for account address validation */
  readonly bump: bigint
  /** Delegatee used for initialisation - useful to check against */
  readonly delegatee: Address
  readonly lastStakeTs: bigint
  /**
   * Cumulative rewards issued to the user - ONLY used for stats/analytics
   * DO NOT USE IN ANY CALCULATIONS
   * Old userStates will have this field populated only from the point of release
   * not reflecting any historical data before this was released
   */
  readonly rewardsIssuedCumulative: Array<bigint>
  readonly padding1: Array<bigint>

  static readonly discriminator = new Uint8Array([
    72, 177, 85, 249, 76, 167, 186, 126,
  ])

  static readonly layout = borsh.struct<UserState>([
    borsh.u64("userId"),
    borshAddress("farmState"),
    borshAddress("owner"),
    borsh.u8("isFarmDelegated"),
    borsh.array(borsh.u8(), 7, "padding0"),
    borsh.array(borsh.u128(), 10, "rewardsTallyScaled"),
    borsh.array(borsh.u64(), 10, "rewardsIssuedUnclaimed"),
    borsh.array(borsh.u64(), 10, "lastClaimTs"),
    borsh.u128("activeStakeScaled"),
    borsh.u128("pendingDepositStakeScaled"),
    borsh.u64("pendingDepositStakeTs"),
    borsh.u128("pendingWithdrawalUnstakeScaled"),
    borsh.u64("pendingWithdrawalUnstakeTs"),
    borsh.u64("bump"),
    borshAddress("delegatee"),
    borsh.u64("lastStakeTs"),
    borsh.array(borsh.u64(), 10, "rewardsIssuedCumulative"),
    borsh.array(borsh.u64(), 40, "padding1"),
  ])

  constructor(fields: UserStateFields) {
    this.userId = fields.userId
    this.farmState = fields.farmState
    this.owner = fields.owner
    this.isFarmDelegated = fields.isFarmDelegated
    this.padding0 = fields.padding0
    this.rewardsTallyScaled = fields.rewardsTallyScaled
    this.rewardsIssuedUnclaimed = fields.rewardsIssuedUnclaimed
    this.lastClaimTs = fields.lastClaimTs
    this.activeStakeScaled = fields.activeStakeScaled
    this.pendingDepositStakeScaled = fields.pendingDepositStakeScaled
    this.pendingDepositStakeTs = fields.pendingDepositStakeTs
    this.pendingWithdrawalUnstakeScaled = fields.pendingWithdrawalUnstakeScaled
    this.pendingWithdrawalUnstakeTs = fields.pendingWithdrawalUnstakeTs
    this.bump = fields.bump
    this.delegatee = fields.delegatee
    this.lastStakeTs = fields.lastStakeTs
    this.rewardsIssuedCumulative = fields.rewardsIssuedCumulative
    this.padding1 = fields.padding1
  }

  static async fetch(
    rpc: Rpc<GetAccountInfoApi>,
    address: Address,
    programId: Address = PROGRAM_ID
  ): Promise<UserState | null> {
    const info = await fetchEncodedAccount(rpc, address)

    if (!info.exists) {
      return null
    }
    if (info.programAddress !== programId) {
      throw new Error(
        `UserStateFields account ${address} belongs to wrong program ${info.programAddress}, expected ${programId}`
      )
    }

    return this.decode(new Uint8Array(info.data))
  }

  static async fetchMultiple(
    rpc: Rpc<GetMultipleAccountsApi>,
    addresses: Address[],
    programId: Address = PROGRAM_ID
  ): Promise<Array<UserState | null>> {
    const infos = await fetchEncodedAccounts(rpc, addresses)

    return infos.map((info) => {
      if (!info.exists) {
        return null
      }
      if (info.programAddress !== programId) {
        throw new Error(
          `UserStateFields account ${info.address} belongs to wrong program ${info.programAddress}, expected ${programId}`
        )
      }

      return this.decode(new Uint8Array(info.data))
    })
  }

  static decode(data: Uint8Array): UserState {
    if (data.length < UserState.discriminator.length) {
      throw new Error("invalid account discriminator")
    }
    for (let i = 0; i < UserState.discriminator.length; i++) {
      if (data[i] !== UserState.discriminator[i]) {
        throw new Error("invalid account discriminator")
      }
    }

    const dec = UserState.layout.decode(
      data.subarray(UserState.discriminator.length)
    )

    return new UserState({
      userId: dec.userId,
      farmState: dec.farmState,
      owner: dec.owner,
      isFarmDelegated: dec.isFarmDelegated,
      padding0: dec.padding0,
      rewardsTallyScaled: dec.rewardsTallyScaled,
      rewardsIssuedUnclaimed: dec.rewardsIssuedUnclaimed,
      lastClaimTs: dec.lastClaimTs,
      activeStakeScaled: dec.activeStakeScaled,
      pendingDepositStakeScaled: dec.pendingDepositStakeScaled,
      pendingDepositStakeTs: dec.pendingDepositStakeTs,
      pendingWithdrawalUnstakeScaled: dec.pendingWithdrawalUnstakeScaled,
      pendingWithdrawalUnstakeTs: dec.pendingWithdrawalUnstakeTs,
      bump: dec.bump,
      delegatee: dec.delegatee,
      lastStakeTs: dec.lastStakeTs,
      rewardsIssuedCumulative: dec.rewardsIssuedCumulative,
      padding1: dec.padding1,
    })
  }

  toJSON(): UserStateJSON {
    return {
      userId: this.userId.toString(),
      farmState: this.farmState,
      owner: this.owner,
      isFarmDelegated: this.isFarmDelegated,
      padding0: this.padding0,
      rewardsTallyScaled: this.rewardsTallyScaled.map((item) =>
        item.toString()
      ),
      rewardsIssuedUnclaimed: this.rewardsIssuedUnclaimed.map((item) =>
        item.toString()
      ),
      lastClaimTs: this.lastClaimTs.map((item) => item.toString()),
      activeStakeScaled: this.activeStakeScaled.toString(),
      pendingDepositStakeScaled: this.pendingDepositStakeScaled.toString(),
      pendingDepositStakeTs: this.pendingDepositStakeTs.toString(),
      pendingWithdrawalUnstakeScaled:
        this.pendingWithdrawalUnstakeScaled.toString(),
      pendingWithdrawalUnstakeTs: this.pendingWithdrawalUnstakeTs.toString(),
      bump: this.bump.toString(),
      delegatee: this.delegatee,
      lastStakeTs: this.lastStakeTs.toString(),
      rewardsIssuedCumulative: this.rewardsIssuedCumulative.map((item) =>
        item.toString()
      ),
      padding1: this.padding1.map((item) => item.toString()),
    }
  }

  static fromJSON(obj: UserStateJSON): UserState {
    return new UserState({
      userId: BigInt(obj.userId),
      farmState: address(obj.farmState),
      owner: address(obj.owner),
      isFarmDelegated: obj.isFarmDelegated,
      padding0: obj.padding0,
      rewardsTallyScaled: obj.rewardsTallyScaled.map((item) => BigInt(item)),
      rewardsIssuedUnclaimed: obj.rewardsIssuedUnclaimed.map((item) =>
        BigInt(item)
      ),
      lastClaimTs: obj.lastClaimTs.map((item) => BigInt(item)),
      activeStakeScaled: BigInt(obj.activeStakeScaled),
      pendingDepositStakeScaled: BigInt(obj.pendingDepositStakeScaled),
      pendingDepositStakeTs: BigInt(obj.pendingDepositStakeTs),
      pendingWithdrawalUnstakeScaled: BigInt(
        obj.pendingWithdrawalUnstakeScaled
      ),
      pendingWithdrawalUnstakeTs: BigInt(obj.pendingWithdrawalUnstakeTs),
      bump: BigInt(obj.bump),
      delegatee: address(obj.delegatee),
      lastStakeTs: BigInt(obj.lastStakeTs),
      rewardsIssuedCumulative: obj.rewardsIssuedCumulative.map((item) =>
        BigInt(item)
      ),
      padding1: obj.padding1.map((item) => BigInt(item)),
    })
  }
}

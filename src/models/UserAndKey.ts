import { Address } from "@solana/kit";
import { UserState } from "../@codegen/farms/accounts";

export type UserAndKey = {
  userState: UserState;
  key: Address;
};

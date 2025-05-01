import { Address } from "@solana/kit";
import { FarmState } from "../@codegen/farms/accounts";

export type FarmAndKey = {
  farmState: FarmState;
  key: Address;
};

import { FarmState } from "../@codegen/farms/accounts";
import { Address, none, Option, some } from "@solana/kit";
import { DEFAULT_PUBLIC_KEY } from "./pubkey";

export function getScopePricesFromFarm(farm: FarmState): Option<Address> {
  return farm.scopePrices === DEFAULT_PUBLIC_KEY
    ? none()
    : some(farm.scopePrices);
}

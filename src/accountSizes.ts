import { getFarmStateSize } from "./@codegen/farms/accounts/farmState";
import { getGlobalConfigSize } from "./@codegen/farms/accounts/globalConfig";

export const SIZE_FARM_STATE = BigInt(getFarmStateSize());
export const SIZE_GLOBAL_CONFIG = BigInt(getGlobalConfigSize());

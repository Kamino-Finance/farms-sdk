import axios from "axios";
import { Kamino } from "@kamino-finance/kliquidity-sdk";
import { Address } from "@solana/kit";
import { Farms } from "../Farms";
import Decimal from "decimal.js";
import { FarmIncentives } from "../models";
import { FarmState } from "../@codegen/farms/accounts";

export const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v2";
export interface GetJupiterPriceParams {
  ids: string;
  vsToken?: string;
  showExtraInfo?: boolean;
}

export interface GetJupiterPriceResponse {
  data: {
    [key: string]: GetJupiterPriceTokenInfo;
  };
  timeTaken: number;
}

interface GetJupiterPriceTokenInfo {
  id: string;
  type: string;
  price: string;
}

async function fetchJupiterPrice(
  query: GetJupiterPriceParams,
): Promise<GetJupiterPriceResponse> {
  const response = await axios.get<GetJupiterPriceResponse>(JUPITER_PRICE_API, {
    params: query,
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
}

export async function getPriceForTokenMint(mint: Address): Promise<Decimal> {
  const mintString = mint.toString();
  const query: GetJupiterPriceParams = {
    ids: mintString,
  };

  return fetchJupiterPrice(query)
    .then((response) => {
      const tokenInfo = response.data[mintString];
      if (tokenInfo) {
        return new Decimal(tokenInfo.price);
      } else {
        throw new Error(`No price found for token mint: ${mintString}`);
      }
    })
    .catch((error) => {
      console.error(
        `Error fetching price for token mint ${mintString}:`,
        error,
      );
      throw error;
    });
}

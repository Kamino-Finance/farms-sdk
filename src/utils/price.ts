import axios from "axios";
import { Address } from "@solana/kit";
import Decimal from "decimal.js";

export const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
export interface GetJupiterPriceParams {
  ids: string;
  vsToken?: string;
  showExtraInfo?: boolean;
}

export interface GetJupiterPriceResponse {
  [key: string]: GetJupiterPriceTokenInfo;
}

interface GetJupiterPriceTokenInfo {
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h: number;
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
      const tokenInfo = response[mintString];
      if (tokenInfo) {
        return new Decimal(tokenInfo.usdPrice);
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

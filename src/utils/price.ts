import { Address } from "@solana/kit";
import Decimal from "decimal.js";

export const KSWAP_BASE_API = "https://api.kamino.finance/kswap";
export interface GetJupiterPriceParams {
  ids: string;
  vsToken?: string;
  showExtraInfo?: boolean;
}

interface TokenPriceData {
  isScaledUiToken: boolean;
  value: number;
  updateUnixTime: number;
  updateHumanTime: string;
  priceInNative: number;
  priceChange24h: number;
}

interface BatchPriceResponse {
  success: boolean;
  data: { [key: string]: TokenPriceData | null };
}

export async function getTokensBatchPrice(
  tokens: Address[],
): Promise<Map<Address, Decimal>> {
  const tokensParams = tokens
    .map((token) => `tokens=${encodeURIComponent(token)}`)
    .join("&");
  const url = `${KSWAP_BASE_API}/batch-token-prices?${tokensParams}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch tokens batch price: ${response.statusText}`,
    );
  }
  const data = (await response.json()) as BatchPriceResponse;

  // Check if response has success field and it's true
  if (!data.success) {
    throw new Error("API response indicates failure: " + JSON.stringify(data));
  }

  const prices = new Map<Address, Decimal>();
  for (const token of tokens) {
    const tokenData = data.data[token];
    if (
      tokenData &&
      tokenData.value !== null &&
      tokenData.value !== undefined
    ) {
      try {
        const price = new Decimal(tokenData.value);
        prices.set(token, price);
      } catch (error) {
        console.error(
          `Failed to parse price for token, setting to 0: ${token}: ${error}`,
        );
        prices.set(token, new Decimal(0));
      }
    } else {
      console.warn(`No price data available for token ${token}, setting to 0`);
      prices.set(token, new Decimal(0));
    }
  }
  return prices;
}

export async function getTokenPrice(token: Address): Promise<Decimal> {
  const tokenPrice = await getTokensBatchPrice([token]);
  return tokenPrice.get(token)!;
}

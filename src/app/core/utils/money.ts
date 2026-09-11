/** Shared rounding + GST/profit helpers for the Product and Purchase "Add
 * Product" forms. Both forms let the user type the Purchase Price as
 * GST-inclusive and/or a Profit % to auto-fill Selling Price, so the same
 * small set of formulas needs to live in one place instead of being
 * duplicated (and drifting) between product-form.ts and purchase-form.ts. */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Rounds to the nearest whole rupee - no paise. Used for the auto-calculated
 * Selling Price (a retail mobile/appliance shop prices in round rupees, e.g.
 * ₹11000 rather than ₹10999.88 - see the "round off" ask alongside the
 * Profit % feature). Not used for internal ex-GST/GST-inclusive conversions
 * elsewhere in this file - those stay at paise precision since they feed tax
 * math that must stay exact. */
export function round0(value: number): number {
  return Math.round(value);
}

/** Purchase-line/product tax math always uses the ex-GST rate as the base
 * (see purchase-form's lineTaxableAmount/lineGstAmount) - so a GST-inclusive
 * price typed into the UI has to be converted down to its ex-GST equivalent
 * before it's stored as base_price. */
export function exGstFromInclusive(inclusivePrice: number, gstRatePercent: number): number {
  if (!inclusivePrice || inclusivePrice <= 0) return 0;
  const rate = gstRatePercent || 0;
  return round2(inclusivePrice / (1 + rate / 100));
}

export function inclusiveFromExGst(exGstPrice: number, gstRatePercent: number): number {
  if (!exGstPrice || exGstPrice <= 0) return 0;
  const rate = gstRatePercent || 0;
  return round2(exGstPrice * (1 + rate / 100));
}

/** Same conversion as exGstFromInclusive(), but WITHOUT rounding the
 * intermediate ex-GST value - used specifically for Billing's `CartLine.rate`,
 * which gets converted back UP for display on every render via
 * inclusiveFromExGst() (billing.ts's lineRateInclusive() getter). Rounding
 * the ex-GST value to 2 decimals here means multiplying it back up by the
 * GST rate almost never lands exactly back on the original inclusive figure
 * - e.g. a clean ₹27500 selling price becomes ex-GST ₹23305.08 (rounded),
 * which re-inflates to ₹27499.99, one paisa short, purely from rounding
 * twice. Keeping full float precision here means the round-trip lands back
 * on the original figure to the cent. This is safe to send to the server
 * unrounded too - SalesService.php rounds `sale_price`/the tax split itself
 * from whatever `rate` it receives, so an unrounded rate reaching it is
 * actually more accurate than pre-rounding twice on the way there. */
export function exGstFromInclusiveExact(inclusivePrice: number, gstRatePercent: number): number {
  if (!inclusivePrice || inclusivePrice <= 0) return 0;
  const rate = gstRatePercent || 0;
  return inclusivePrice / (1 + rate / 100);
}

/** Selling price = a direct percentage markup on `basePrice`. `basePrice` is
 * whatever the caller passes - as of the "selling price is GST-inclusive"
 * correction, that's the GST-INCLUSIVE Purchase Price itself (not the ex-GST
 * cost): selling price = purchase price * (1 + profit%/100), e.g. purchase
 * 10000 + profit 10% = 11000, all GST-inclusive. This function is a generic
 * percentage-markup formula - it doesn't care what basis its argument is in,
 * only the caller does. Rounded to the nearest whole rupee (round0), not
 * paise - a retail shop wants a clean ₹11000 price tag, not ₹10999.88. */
export function sellingPriceFromProfit(basePrice: number, profitPercent: number): number {
  if (!basePrice || basePrice <= 0) return 0;
  return round0(basePrice * (1 + (profitPercent || 0) / 100));
}

/** Inverse of the above - used to derive a starting Profit % when editing an
 * existing product/line that already has both a (GST-inclusive) purchase
 * price and a (GST-inclusive) selling price. */
export function profitPercentFromPrices(basePrice: number, sellingPrice: number): number | null {
  if (!basePrice || basePrice <= 0) return null;
  return round2(((sellingPrice - basePrice) / basePrice) * 100);
}

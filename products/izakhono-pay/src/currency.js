/**
 * Currency-safe primitives for the global IZAKHONO PAY ledger/API.
 * This registry is groundwork only: provider routing remains ZAR-only until
 * each market, merchant account, payment rail and settlement flow is approved.
 */
export const CURRENCY_EXPONENTS = Object.freeze({
  AED:2, AUD:2, BHD:3, BRL:2, CAD:2, CHF:2, CLP:0, CNY:2, EUR:2,
  GBP:2, GHS:2, HKD:2, INR:2, JOD:3, JPY:0, KES:2, KRW:0, KWD:3,
  MXN:2, NGN:2, NZD:2, OMR:3, SAR:2, SGD:2, TND:3, USD:2, XAF:0,
  XOF:0, ZAR:2
});
export const SUPPORTED_CURRENCY_CODES=Object.freeze(Object.keys(CURRENCY_EXPONENTS).sort());

export function currencyExponent(currency){
  const code=String(currency||'').toUpperCase();
  if(!Object.hasOwn(CURRENCY_EXPONENTS,code))throw new Error('unsupported_currency_code');
  return CURRENCY_EXPONENTS[code];
}

export function toMinorUnits(amount,currency){
  const exponent=currencyExponent(currency);
  const raw=typeof amount==='number'&&Number.isFinite(amount)?String(amount):String(amount??'').trim();
  const match=/^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(raw);
  if(!match)throw new Error('invalid_decimal_amount');
  const fraction=match[2]||'';
  if(fraction.length>exponent)throw new Error('currency_precision_exceeded');
  const scale=10n**BigInt(exponent);
  const whole=BigInt(match[1]);
  const fractional=BigInt((fraction+'0'.repeat(exponent)).slice(0,exponent)||'0');
  const minor=whole*scale+fractional;
  if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('amount_exceeds_safe_integer');
  return Number(minor);
}

export function fromMinorUnits(amountMinor,currency){
  const exponent=currencyExponent(currency);
  if(!Number.isSafeInteger(amountMinor)||amountMinor<0)throw new Error('invalid_minor_unit_amount');
  const scale=10**exponent;
  return amountMinor/scale;
}

export function formatMinorUnits(amountMinor,currency,locale='en'){
  const code=String(currency||'').toUpperCase();
  currencyExponent(code);
  if(!Number.isSafeInteger(amountMinor))throw new Error('invalid_minor_unit_amount');
  return new Intl.NumberFormat(locale,{style:'currency',currency:code}).format(fromMinorUnits(amountMinor,code));
}

export const USDC_DECIMALS = 6;
export const ODDS_PRECISION = 1000n;

export function shortAddress(addr?: string | null, len = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, len + 2)}…${addr.slice(-len)}`;
}

export function formatUsdc(raw: bigint, opts: { decimals?: number; suffix?: string } = {}): string {
  const dp = opts.decimals ?? 2;
  const whole = raw / 10n ** BigInt(USDC_DECIMALS);
  const frac = raw % 10n ** BigInt(USDC_DECIMALS);
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, dp);
  const out = dp > 0 ? `${whole}.${fracStr}` : whole.toString();
  return opts.suffix === undefined ? `${out} USDC` : `${out}${opts.suffix}`;
}

/** Native balance: 18 decimals on Arc. */
export function formatNative(raw: bigint, dp = 4): string {
  const whole = raw / 10n ** 18n;
  const frac = raw % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").slice(0, dp);
  return `${whole}.${fracStr}`;
}

export function oddsToDecimal(uintOdds: bigint): number {
  return Number(uintOdds) / Number(ODDS_PRECISION);
}

export function impliedProbabilityPct(uintOdds: bigint): number {
  return (Number(ODDS_PRECISION) / Number(uintOdds)) * 100;
}

export function overroundPct(yesOdds: bigint, noOdds: bigint): number {
  return (
    (Number(ODDS_PRECISION) / Number(yesOdds) +
      Number(ODDS_PRECISION) / Number(noOdds) -
      1) *
    100
  );
}

export function timeUntil(unixSeconds: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = Number(unixSeconds) - now;
  if (delta <= 0) return "closed";
  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);
  const mins = Math.floor((delta % 3600) / 60);
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatDate(unixSeconds: bigint): string {
  const d = new Date(Number(unixSeconds) * 1000);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Pinned-locale Intl formatters. Server and client must render identical
// strings or hydration fails, and host locales differ (Node vs browser),
// so all user-facing date/number formatting pins "en-US" here instead of
// calling toLocale* directly at call sites.

const LOCALE = "en-US";

export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString(LOCALE, options);
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(LOCALE);
}

export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE);
}

export function formatUsd(value: number): string {
  return `$${formatNumber(value)}`;
}

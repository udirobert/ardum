// Field routes — the single source for “does this path live inside Mira's dusk field?”
// Extracted from two ad-hoc copies in MiraField + SiteChrome so arrival
// can flip between dusk and editorial without drifting.

export function isFieldRoute(pathname: string): boolean {
  // Editorial refuge: arrival ("/") is warm parchment, not a full-bleed dusk field.
  // The field is the atmosphere only once a journey exists.
  if (pathname === "/" || pathname === "") return false;
  return pathname.startsWith("/episode/") || pathname.startsWith("/invite/");
}

export function isEditorialRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

export function isJourneyRoute(pathname: string): boolean {
  return pathname === "/" || isFieldRoute(pathname);
}

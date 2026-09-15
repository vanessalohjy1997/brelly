/**
 * Every icon the web app can draw, by the name Material Symbols knows it as.
 *
 * The phone declares each icon inline as `{ ios: "cloud.rain.fill", android:
 * "rainy" }` — a pair, because `expo-symbols` draws SF Symbols on iOS and
 * Material Symbols elsewhere. Here only the Material half means anything, so
 * carrying the pair would be a second copy of a mapping nothing reads.
 *
 * It is a closed registry rather than a loose string for two reasons. The font
 * is **subsetted to exactly these names** (see `iconFontHref`), so an icon
 * drawn from outside the list has no glyph and renders as its own name in
 * words — a failure that looks like a typo in the copy. And the keys are what
 * the call sites read: `Icons.rain` says what is meant, where `"rainy"` says
 * what it looks like.
 *
 * Every name here was checked against Google's own `.codepoints` file for the
 * rounded variable font, not against memory.
 */
export const Icons = {
  // Weather, the vocabulary `forecastToSymbol` maps NEA's text onto.
  thunder: "thunderstorm",
  rain: "rainy",
  cloudy: "cloud",
  partlyCloudy: "partly_cloudy_day",
  partlyCloudyNight: "partly_cloudy_night",
  sunny: "sunny",
  clearNight: "moon_stars",
  windy: "air",
  hazy: "foggy",
  uv: "wb_sunny",
  humidity: "water_drop",
  umbrella: "umbrella",

  // Navigation and structure.
  today: "today",
  plans: "calendar_month",
  history: "history",
  settings: "settings",
  menu: "menu",
  close: "close",
  back: "arrow_back",

  // Actions and states.
  add: "add",
  search: "search",
  clear: "cancel",
  repeat: "repeat",
  time: "schedule",
  indoor: "apartment",
  location: "my_location",
  alerts: "notifications",
  alertsOff: "notifications_off",
  clearOlder: "delete_sweep",
  success: "check_circle",
  warning: "warning",
  error: "error",
  refresh: "refresh",
  edit: "edit",
  duplicate: "content_copy",
  delete: "delete",
} as const;

export type IconKey = keyof typeof Icons;
export type IconName = (typeof Icons)[IconKey];

/** Sorted and de-duplicated, because the font URL is a cache key. */
export const ICON_NAMES: readonly IconName[] = Array.from(
  new Set(Object.values(Icons)),
).sort() as IconName[];

/**
 * The Google Fonts stylesheet for exactly the icons above.
 *
 * `icon_names` is what makes this affordable: the full rounded variable font is
 * several megabytes, and the subset for this list is a couple of kilobytes.
 *
 * It is a third-party request, which is the one thing to be clear-eyed about.
 * `next/font/google` would self-host it and cannot — its catalogue excludes the
 * icon fonts, checked rather than assumed. Self-hosting a subset built at
 * deploy time is the better answer and belongs with the rest of the Phase 4
 * hosting work, where the CSP that would forbid this is written anyway.
 *
 * `FILL@0` keeps the outlined weight, which is the one that reads as a symbol
 * rather than a blob at `IconSize.metadata`.
 */
export function iconFontHref(): string {
  const axes = "opsz,wght,FILL,GRAD@24,400,0,0";
  return `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:${axes}&icon_names=${ICON_NAMES.join(",")}&display=block`;
}

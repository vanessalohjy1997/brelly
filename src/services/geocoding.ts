const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY!;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaceSuggestion = {
  placeId: string;
  displayName: string;
  secondaryText: string; // e.g. "Singapore"
};

export type PlaceDetails = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

// ─── Session token ────────────────────────────────────────────────────────────
// A session token groups autocomplete keystrokes + the final Place Details call
// into one billable session. Without it, every keystroke is billed separately.

let currentSessionToken: string | null = null;

function getSessionToken(): string {
  if (!currentSessionToken) {
    currentSessionToken = Math.random().toString(36).slice(2) + Date.now();
  }
  return currentSessionToken;
}

function resetSessionToken(): void {
  // Call this after a place is selected to invalidate the session.
  // The next autocomplete search starts a fresh billable session.
  currentSessionToken = null;
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
  if (input.trim().length < 2) return [];

  const res = await fetch(`${PLACES_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
    },
    body: JSON.stringify({
      input,
      sessionToken: getSessionToken(),
      // Bias results toward Singapore
      locationBias: {
        circle: {
          center: { latitude: 1.3521, longitude: 103.8198 },
          radius: 30000, // 30km radius covers all of Singapore
        },
      },
      // Only return results in Singapore
      includedRegionCodes: ["sg"],
    }),
  });

  if (!res.ok) throw new Error(`Places autocomplete error: ${res.status}`);

  const json = await res.json();
  const suggestions = json.suggestions ?? [];

  return suggestions
    .filter((s: any) => s.placePrediction)
    .map((s: any) => ({
      placeId: s.placePrediction.placeId,
      displayName: s.placePrediction.structuredFormat.mainText.text,
      secondaryText:
        s.placePrediction.structuredFormat.secondaryText?.text ?? "Singapore",
    }));
}

// ─── Place Details ────────────────────────────────────────────────────────────

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY,
      // Field mask controls exactly what data we get back — and what we're billed for.
      // Only requesting Essentials fields keeps us on the cheapest SKU.
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
  });

  if (!res.ok) throw new Error(`Place details error: ${res.status}`);

  const json = await res.json();

  // This call closes the session — reset the token so the next
  // search starts a new billable session
  resetSessionToken();

  return {
    placeId: json.id,
    displayName: json.displayName.text,
    formattedAddress: json.formattedAddress,
    latitude: json.location.latitude,
    longitude: json.location.longitude,
  };
}

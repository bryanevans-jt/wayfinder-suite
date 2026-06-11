export type GeocodeInput = {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

function buildAddressQuery(input: GeocodeInput): string {
  return [
    input.addressLine1.trim(),
    input.addressLine2?.trim(),
    input.city.trim(),
    input.state.trim().toUpperCase(),
    input.zip.trim(),
    "USA",
  ]
    .filter(Boolean)
    .join(", ");
}

export async function geocodeUsAddress(input: GeocodeInput): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    return null;
  }

  const q = buildAddressQuery(input);
  if (!q.replace(/[, USA]/g, "").trim()) {
    return null;
  }

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };

  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    return null;
  }

  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

/** Great-circle distance in miles. */
export function distanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const EMPLOYER_MATCH_RADIUS_MILES = 10;

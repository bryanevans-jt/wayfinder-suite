import { geocodeUsAddress } from "@/lib/geocoding";
import { validateEmploymentCategoryFields } from "@wayfinder/branding";

export async function buildEmployerLocationPatch(body: {
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<{
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
}> {
  const address_line1 = (body.address_line1 ?? "").trim() || null;
  const address_line2 =
    typeof body.address_line2 === "string" ? body.address_line2.trim() || null : null;
  const city = (body.city ?? "").trim() || null;
  const state = body.state?.trim().toUpperCase() || null;
  const zip = (body.zip ?? "").trim() || null;

  let latitude: number | null = null;
  let longitude: number | null = null;

  if (address_line1 && city && state && zip) {
    const geocoded = await geocodeUsAddress({
      addressLine1: address_line1,
      addressLine2: address_line2,
      city,
      state,
      zip,
    });
    if (geocoded) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }
  }

  return {
    address_line1,
    address_line2,
    city,
    state,
    zip,
    latitude,
    longitude,
  };
}

export function buildEmployerPositionPatch(body: Record<string, unknown>) {
  const primary = validateEmploymentCategoryFields(
    body.position_need_primary as string | undefined,
    body.position_need_primary_other as string | undefined,
    "Primary position type commonly hired"
  );
  if (primary.error) {
    throw new Error(primary.error);
  }

  const secondary = validateEmploymentCategoryFields(
    body.position_need_secondary as string | undefined,
    body.position_need_secondary_other as string | undefined,
    "Secondary position type commonly hired"
  );
  if (secondary.error) {
    throw new Error(secondary.error);
  }

  return {
    position_need_primary: primary.category,
    position_need_primary_other: primary.otherText,
    position_need_secondary: secondary.category,
    position_need_secondary_other: secondary.otherText,
  };
}

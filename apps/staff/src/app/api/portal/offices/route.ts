import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { insertOfficeRow } from "@wayfinder/supabase";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const { admin } = await assertPortalSession("supervisor");
    let result = await admin.from("offices").select("id, name, city, state").order("name");
    if (
      result.error?.message.includes("city") ||
      result.error?.message.includes("state")
    ) {
      const fallback = await admin.from("offices").select("id, name").order("name");
      if (fallback.error) throw new Error(fallback.error.message);
      return Response.json({ offices: fallback.data ?? [] });
    }
    if (result.error) throw new Error(result.error.message);
    return Response.json({ offices: result.data ?? [] });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as { name?: string; state?: string; city?: string };
    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Office name is required" }, { status: 400 });
    }
    const office = await insertOfficeRow(admin, name, {
      state: body.state?.trim(),
      city: body.city?.trim(),
    });
    return Response.json({ office });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      city?: string;
      state?: string;
    };
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const patch: Record<string, string | null> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return Response.json({ error: "Office name cannot be empty" }, { status: 400 });
      }
      patch.name = name;
    }
    if (body.city !== undefined) {
      patch.city = body.city.trim() || null;
    }
    if (body.state !== undefined) {
      const state = body.state.trim();
      patch.state = state || null;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    let result = await admin
      .from("offices")
      .update(patch)
      .eq("id", id)
      .select("id, name, city, state")
      .maybeSingle();

    if (result.error?.message.includes("Could not find the 'city'")) {
      if (body.city !== undefined) {
        return Response.json(
          {
            error:
              "Could not save city — run migration 20250614120000_offices_city_state_columns.sql in Supabase.",
          },
          { status: 503 }
        );
      }
      const { city: _city, ...withoutCity } = patch;
      if (Object.keys(withoutCity).length > 0) {
        result = await admin
          .from("offices")
          .update(withoutCity)
          .eq("id", id)
          .select("id, name, city, state")
          .maybeSingle();
      }
    }
    if (result.error?.message.includes("Could not find the 'state'")) {
      if (body.state !== undefined) {
        return Response.json(
          {
            error:
              "Could not save state — run migration 20250614120000_offices_city_state_columns.sql in Supabase.",
          },
          { status: 503 }
        );
      }
      const { state: _state, ...withoutState } = patch;
      if (Object.keys(withoutState).length > 0) {
        result = await admin
          .from("offices")
          .update(withoutState)
          .eq("id", id)
          .select("id, name, city, state")
          .maybeSingle();
      }
    }

    if (result.error) throw new Error(result.error.message);
    return Response.json({ ok: true, office: result.data });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    const { error } = await admin.from("offices").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

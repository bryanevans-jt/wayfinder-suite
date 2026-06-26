import { assertPortalMutation, assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  filterOfficesForPicker,
  queryAllOffices,
} from "@/lib/office-visibility";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { insertOfficeRow } from "@wayfinder/supabase";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const { admin, role } = await assertPortalSession("supervisor");
    const offices = filterOfficesForPicker(await queryAllOffices(admin), {
      includeHidden: isSuperAdminRole(role),
    });
    return Response.json({ offices });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
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
    const { admin, role } = await assertPortalMutation("admin");
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      city?: string;
      state?: string;
      is_hidden?: boolean;
    };
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    if (body.is_hidden !== undefined && !isSuperAdminRole(role)) {
      return Response.json({ error: "Only super admins can hide offices" }, { status: 403 });
    }

    const patch: Record<string, string | boolean | null> = {};
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
    if (body.is_hidden !== undefined) {
      patch.is_hidden = Boolean(body.is_hidden);
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    let result = await admin
      .from("offices")
      .update(patch)
      .eq("id", id)
      .select("id, name, city, state, is_hidden")
      .maybeSingle();

    if (result.error?.message.includes("Could not find the 'is_hidden'")) {
      if (body.is_hidden !== undefined) {
        return Response.json(
          {
            error:
              "Could not update office visibility — run migration 20260627140000_offices_hidden_flag.sql in Supabase.",
          },
          { status: 503 }
        );
      }
      const { is_hidden: _hidden, ...withoutHidden } = patch;
      if (Object.keys(withoutHidden).length === 0) {
        return Response.json({ error: "Nothing to update" }, { status: 400 });
      }
      result = await admin
        .from("offices")
        .update(withoutHidden)
        .eq("id", id)
        .select("id, name, city, state")
        .maybeSingle();
    }

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
          .select("id, name, city, state, is_hidden")
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
          .select("id, name, city, state, is_hidden")
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
    const { admin } = await assertPortalMutation("admin");
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

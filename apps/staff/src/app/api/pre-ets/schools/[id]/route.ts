import { NextResponse } from "next/server";

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Deleting entire schools from Pre-ETS is disabled. Hide or combine program groups from Schools & groups instead.",
    },
    { status: 403 }
  );
}

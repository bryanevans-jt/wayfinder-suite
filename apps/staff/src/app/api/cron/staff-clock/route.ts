import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Time Clock cron is retired (still-working prompts / auto-outs no longer run).
 * Route kept registered in vercel.json so deploy cron config stays valid.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    retired: true,
    message: "Staff Time Clock feature retired; cron is a no-op.",
  });
}

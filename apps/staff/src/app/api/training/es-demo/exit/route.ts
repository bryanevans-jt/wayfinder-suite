import {
  TRAINING_DEMO_COOKIE_NAMES,
  trainingDemoCookieOptions,
} from "@wayfinder/supabase/training-demo-cookies";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const opts = { ...trainingDemoCookieOptions(0), maxAge: 0, expires: new Date(0) };
  for (const name of TRAINING_DEMO_COOKIE_NAMES) {
    response.cookies.set(name, "", opts);
  }
  return response;
}

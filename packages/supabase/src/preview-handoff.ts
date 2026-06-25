import { createHmac, timingSafeEqual } from "node:crypto";
import { clientAppOrigin } from "./preview-server";

export type PreviewHandoffPayload = {
  targetUserId: string;
  actorUserId: string;
  targetRole: string;
  targetName: string | null;
  exp: number;
};

function handoffSecret(): string {
  return (
    process.env.PREVIEW_HANDOFF_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "wayfinder-dev-preview-handoff"
  );
}

export function signPreviewHandoff(
  payload: Omit<PreviewHandoffPayload, "exp">,
  ttlSec = 120
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const data = JSON.stringify({ ...payload, exp });
  const sig = createHmac("sha256", handoffSecret()).update(data).digest("base64url");
  return `${Buffer.from(data, "utf8").toString("base64url")}.${sig}`;
}

export function verifyPreviewHandoff(token: string): PreviewHandoffPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const dataB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const data = Buffer.from(dataB64, "base64url").toString("utf8");
  const expected = createHmac("sha256", handoffSecret()).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }
  let payload: PreviewHandoffPayload;
  try {
    payload = JSON.parse(data) as PreviewHandoffPayload;
  } catch {
    return null;
  }
  if (!payload.targetUserId || !payload.actorUserId || !payload.targetRole || !payload.exp) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function buildClientPreviewHandoffUrl(
  payload: Omit<PreviewHandoffPayload, "exp">
): string {
  const token = signPreviewHandoff(payload);
  return `${clientAppOrigin()}/api/preview/handoff?token=${encodeURIComponent(token)}`;
}

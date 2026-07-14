import {
  SHARE_MOMENT_BUCKET,
  SHARE_MOMENT_RETENTION_MS,
} from "@/lib/share-moment-limits";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

type StorageEntry = {
  id?: string | null;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function entryTimestamp(entry: StorageEntry): number | null {
  const raw =
    entry.created_at ||
    entry.updated_at ||
    (typeof entry.metadata?.createdAt === "string" ? entry.metadata.createdAt : null);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

async function listFolder(
  admin: SupabaseClient,
  prefix: string
): Promise<StorageEntry[]> {
  const { data, error } = await admin.storage.from(SHARE_MOMENT_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (error) throw error;
  return (data ?? []) as StorageEntry[];
}

/**
 * Removes Share a Moment staging objects older than the retention window.
 * Covers orphaned uploads and photos kept briefly for oversized email download links.
 */
export async function cleanupExpiredTeamMomentPhotos(
  admin: SupabaseClient = createServiceRoleClient()
): Promise<{ deleted: number; scanned: number }> {
  const cutoff = Date.now() - SHARE_MOMENT_RETENTION_MS;
  const roots = await listFolder(admin, "");
  let scanned = 0;
  let deleted = 0;
  const toDelete: string[] = [];

  for (const root of roots) {
    // Top-level folders are per-user ids created by prepare-uploads.
    if (!root.id && root.name) {
      const children = await listFolder(admin, root.name);
      for (const child of children) {
        scanned += 1;
        const ts = entryTimestamp(child);
        if (ts == null || ts > cutoff) continue;
        toDelete.push(`${root.name}/${child.name}`);
      }
      continue;
    }

    scanned += 1;
    const ts = entryTimestamp(root);
    if (ts != null && ts <= cutoff) {
      toDelete.push(root.name);
    }
  }

  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100);
    const { error } = await admin.storage.from(SHARE_MOMENT_BUCKET).remove(chunk);
    if (error) throw error;
    deleted += chunk.length;
  }

  return { deleted, scanned };
}

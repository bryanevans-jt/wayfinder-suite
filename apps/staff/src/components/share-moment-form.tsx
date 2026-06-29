"use client";

import { friendlyClientError, parseApiErrorResponse } from "@wayfinder/supabase/error-log";
import { useEffect, useRef, useState } from "react";

type Props = {
  defaultTeamMemberName: string;
};

type PhotoEntry = {
  id: string;
  file: File;
  previewUrl: string | null;
};

const MAX_PHOTOS = 5;

function photoId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function isLikelyImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tif?f)$/i.test(file.name);
}

export function ShareMomentForm({ defaultTeamMemberName }: Props) {
  const [clientName, setClientName] = useState("");
  const [teamMemberName, setTeamMemberName] = useState(defaultTeamMemberName);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoEntry[]>([]);

  useEffect(() => {
    setTeamMemberName(defaultTeamMemberName);
  }, [defaultTeamMemberName]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    };
  }, []);

  function revokePreview(entry: PhotoEntry) {
    if (entry.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl);
    }
  }

  function onFilesSelected(list: FileList | null) {
    setError(null);
    setSuccess(false);

    const picked = list ? Array.from(list) : [];
    if (picked.length === 0) {
      setError(
        "No photos were added. If this keeps happening, try saving the image as JPEG or PNG and select it again."
      );
      return;
    }

    const valid = picked.filter((file) => file.size > 0 && isLikelyImage(file));
    if (valid.length === 0) {
      setError("Those files could not be used. Please choose JPEG, PNG, or WebP photos.");
      return;
    }

    setPhotos((prev) => {
      const existing = new Set(prev.map((entry) => entry.id));
      const next = [...prev];

      for (const file of valid) {
        if (next.length >= MAX_PHOTOS) break;
        const id = photoId(file);
        if (existing.has(id)) continue;
        existing.add(id);

        let previewUrl: string | null = null;
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {
          previewUrl = null;
        }

        next.push({ id, file, previewUrl });
      }

      return next;
    });

    window.setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }, 0);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const entry = prev.find((photo) => photo.id === id);
      if (entry) revokePreview(entry);
      return prev.filter((photo) => photo.id !== id);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const body = new FormData();
      body.set("clientName", clientName.trim());
      body.set("teamMemberName", teamMemberName.trim());
      body.set("notes", notes.trim());
      photos.forEach((entry) => body.append("photos", entry.file));

      const res = await fetch("/api/team-moments/share", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res);
        throw new Error(parsed.message);
      }

      setSuccess(true);
      setClientName("");
      setNotes("");
      setPhotos((prev) => {
        prev.forEach(revokePreview);
        return [];
      });
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-5">
      <label className="block text-sm">
        <span className="font-medium text-brand-black">Client name</span>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Bobby Johnson"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
          required
          disabled={busy}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-brand-black">Team member name</span>
        <input
          type="text"
          value={teamMemberName}
          onChange={(e) => setTeamMemberName(e.target.value)}
          placeholder="Your name or the ES on this visit"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
          required
          disabled={busy}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-brand-black">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={'e.g. "Bobby\'s first day on his new job at Publix" or "Working hard on a mock interview"'}
          rows={4}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
          required
          disabled={busy}
        />
      </label>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-brand-black">Photos</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-brand-black hover:bg-neutral-50"
            disabled={busy || photos.length >= MAX_PHOTOS}
          >
            Add photos
          </button>
          <span className="text-xs text-brand-black/60">
            {photos.length > 0
              ? `${photos.length} of ${MAX_PHOTOS} selected`
              : `Up to ${MAX_PHOTOS} photos, 4 MB each`}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => onFilesSelected(e.target.files)}
          disabled={busy}
        />
        {photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((entry) => (
              <li
                key={entry.id}
                className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
              >
                {entry.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.previewUrl}
                    alt={entry.file.name}
                    className="aspect-square w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback instanceof HTMLElement) {
                        fallback.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className="flex aspect-square w-full flex-col items-center justify-center px-3 text-center text-xs text-brand-black/70"
                  style={{ display: entry.previewUrl ? "none" : "flex" }}
                >
                  <span className="font-semibold text-brand-black">Photo added</span>
                  <span className="mt-1 break-all">{entry.file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(entry.id)}
                  className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-white"
                  disabled={busy}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-brand-black/60">
            Share photos from the job site, a meeting, mock interviews, celebrations, and other wins.
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-sm text-brand-black">
          Thank you — your moment was emailed successfully.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || photos.length === 0}
        className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Submit moment"}
      </button>
    </form>
  );
}

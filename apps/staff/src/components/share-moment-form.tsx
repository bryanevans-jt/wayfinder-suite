"use client";

import { friendlyClientError, parseApiErrorResponse } from "@wayfinder/supabase/error-log";
import { useEffect, useRef, useState } from "react";

type Props = {
  defaultTeamMemberName: string;
};

export function ShareMomentForm({ defaultTeamMemberName }: Props) {
  const [clientName, setClientName] = useState("");
  const [teamMemberName, setTeamMemberName] = useState(defaultTeamMemberName);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTeamMemberName(defaultTeamMemberName);
  }, [defaultTeamMemberName]);

  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  function onFilesSelected(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setSuccess(false);
    setPhotos((prev) => [...prev, ...Array.from(list)].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
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
      photos.forEach((photo) => body.append("photos", photo));

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
      setPhotos([]);
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
            disabled={busy || photos.length >= 5}
          >
            Add photos
          </button>
          <span className="text-xs text-brand-black/60">Up to 5 photos, 4 MB each</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
          disabled={busy}
        />
        {previewUrls.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previewUrls.map((url, index) => (
              <li key={url} className="relative overflow-hidden rounded-lg border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
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

"use client";

import { useMemo, useState } from "react";
import { createClient as createBrowserClient } from "@wayfinder/supabase/client";
import { APP_VERSION } from "@wayfinder/branding";
import {
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_TYPE_LABELS,
  type FeedbackType,
} from "@/lib/feedback";
import {
  FEEDBACK_ATTACHMENT_BUCKET,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  isFeedbackAttachmentFile,
} from "@/lib/feedback-limits";

type Props = {
  initialPageUrl?: string | null;
  showManageLink?: boolean;
};

export function FeedbackForm({ initialPageUrl = null, showManageLink = false }: Props) {
  const [type, setType] = useState<FeedbackType | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const appVersion = useMemo(() => {
    const commitMeta =
      typeof document !== "undefined"
        ? document.querySelector('meta[name="wayfinder-commit"]')?.getAttribute("content")
        : null;
    return commitMeta ? `${APP_VERSION} (${commitMeta})` : APP_VERSION;
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDoneMessage(null);
    setSaving(true);
    try {
      let attachmentPath: string | null = null;
      if (file) {
        if (!isFeedbackAttachmentFile(file)) {
          setError("Please attach a JPEG, PNG, WebP, HEIC image, or a PDF.");
          return;
        }
        if (file.size > FEEDBACK_ATTACHMENT_MAX_BYTES) {
          setError("Attachments must be 10 MB or smaller.");
          return;
        }
        const prepareRes = await fetch("/api/feedback/prepare-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            size: file.size,
          }),
        });
        const prepareJson = (await prepareRes.json()) as {
          error?: string;
          path?: string;
          token?: string;
          mimeType?: string;
        };
        if (!prepareRes.ok || !prepareJson.path || !prepareJson.token) {
          setError(prepareJson.error || "Could not prepare the attachment upload.");
          return;
        }
        const supabase = createBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from(FEEDBACK_ATTACHMENT_BUCKET)
          .uploadToSignedUrl(prepareJson.path, prepareJson.token, file, {
            contentType: prepareJson.mimeType || file.type,
          });
        if (uploadError) {
          setError(`Could not upload the attachment: ${uploadError.message}`);
          return;
        }
        attachmentPath = prepareJson.path;
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          pageUrl:
            initialPageUrl ||
            (typeof window !== "undefined" ? window.location.href : null),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          appVersion,
          attachmentPath,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDoneMessage(
        data.message || "Thank you — we received your note and will take a look."
      );
      setType("");
      setTitle("");
      setDescription("");
      setFile(null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (doneMessage) {
    return (
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-6">
        <h2 className="text-lg font-semibold text-brand-black">Thank you</h2>
        <p className="mt-2 text-sm text-brand-black/75">{doneMessage}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white"
            onClick={() => setDoneMessage(null)}
          >
            Send another note
          </button>
          {showManageLink ? (
            <a
              href="/dashboard/feedback/manage"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50"
            >
              Review submissions
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="feedback-type" className="block text-sm font-medium text-brand-black">
          Type <span className="text-red-600">*</span>
        </label>
        <select
          id="feedback-type"
          required
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType | "")}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Choose one…</option>
          <option value="problem">{FEEDBACK_TYPE_LABELS.problem}</option>
          <option value="feature">{FEEDBACK_TYPE_LABELS.feature}</option>
        </select>
      </div>

      <div>
        <label htmlFor="feedback-title" className="block text-sm font-medium text-brand-black">
          Title <span className="text-red-600">*</span>
        </label>
        <input
          id="feedback-title"
          required
          maxLength={FEEDBACK_TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short summary"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="feedback-description"
          className="block text-sm font-medium text-brand-black"
        >
          Description <span className="text-red-600">*</span>
        </label>
        <textarea
          id="feedback-description"
          required
          maxLength={FEEDBACK_DESCRIPTION_MAX}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us what happened, or what would help you at work."
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="feedback-file" className="block text-sm font-medium text-brand-black">
          Screenshot or file <span className="font-normal text-brand-black/55">(optional)</span>
        </label>
        <input
          id="feedback-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-brand-black/80"
        />
        <p className="mt-1 text-xs text-brand-black/55">
          JPEG, PNG, WebP, HEIC, or PDF up to 10 MB.
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Sending…" : "Send feedback"}
        </button>
        {showManageLink ? (
          <a
            href="/dashboard/feedback/manage"
            className="text-sm font-medium text-brand-green hover:underline"
          >
            Review submissions
          </a>
        ) : null}
      </div>
    </form>
  );
}

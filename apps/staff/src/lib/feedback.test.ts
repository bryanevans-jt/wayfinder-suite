import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSafeFeedbackAttachmentPath,
  parseFeedbackSubmitInput,
  isFeedbackStatus,
  isFeedbackType,
} from "./feedback";
import {
  buildFeedbackAdminUrl,
  buildFeedbackWebhookAuthHeader,
  buildFeedbackWebhookPayload,
  feedbackWebhookHostLabel,
  FEEDBACK_WEBHOOK_TIMEOUT_MS,
  isRetriableFeedbackWebhookFailure,
  notifyFeedbackWebhook,
} from "./feedback-webhook";

describe("parseFeedbackSubmitInput", () => {
  it("accepts a valid problem report", () => {
    const parsed = parseFeedbackSubmitInput({
      type: "problem",
      title: "Calendar stuck",
      description: "The week view never loads for me.",
      pageUrl: "https://wayfinder-pro.thejoshuatree.org/dashboard/feedback",
      userAgent: "Mozilla/5.0",
      appVersion: "1.3.1",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.type, "problem");
    assert.equal(parsed.value.title, "Calendar stuck");
  });

  it("rejects missing type/title/description", () => {
    assert.equal(parseFeedbackSubmitInput({ type: "", title: "x", description: "y" }).ok, false);
    assert.equal(
      parseFeedbackSubmitInput({ type: "feature", title: "", description: "y" }).ok,
      false
    );
    assert.equal(
      parseFeedbackSubmitInput({ type: "feature", title: "Idea", description: "  " }).ok,
      false
    );
  });

  it("rejects unsafe attachment paths", () => {
    const parsed = parseFeedbackSubmitInput({
      type: "feature",
      title: "Idea",
      description: "Please add dark mode",
      attachmentPath: "../secret",
    });
    assert.equal(parsed.ok, false);
  });
});

describe("isSafeFeedbackAttachmentPath", () => {
  it("requires the submitter prefix when provided", () => {
    assert.equal(isSafeFeedbackAttachmentPath("user-1/file.png", "user-1"), true);
    assert.equal(isSafeFeedbackAttachmentPath("user-2/file.png", "user-1"), false);
  });
});

describe("feedback enums", () => {
  it("recognizes type and status values", () => {
    assert.equal(isFeedbackType("problem"), true);
    assert.equal(isFeedbackType("feature"), true);
    assert.equal(isFeedbackType("bug"), false);
    assert.equal(isFeedbackStatus("new"), true);
    assert.equal(isFeedbackStatus("under_review"), true);
    assert.equal(isFeedbackStatus("done"), false);
  });
});

describe("feedback webhook helpers", () => {
  it("uses a 15s default timeout", () => {
    assert.equal(FEEDBACK_WEBHOOK_TIMEOUT_MS, 15_000);
  });

  it("builds Bearer Authorization by default", () => {
    assert.deepEqual(buildFeedbackWebhookAuthHeader("Authorization", "secret"), {
      name: "Authorization",
      value: "Bearer secret",
    });
  });

  it("supports a custom key header without Bearer wrapping", () => {
    assert.deepEqual(buildFeedbackWebhookAuthHeader("X-Radar-Key", "secret"), {
      name: "X-Radar-Key",
      value: "secret",
    });
  });

  it("logs host only, never the full webhook path", () => {
    assert.equal(
      feedbackWebhookHostLabel("https://radar.example/hooks/feedback?token=secret"),
      "radar.example"
    );
  });

  it("retries on abort/timeout and 5xx only", () => {
    assert.equal(isRetriableFeedbackWebhookFailure({ status: 500 }), true);
    assert.equal(isRetriableFeedbackWebhookFailure({ status: 502 }), true);
    assert.equal(isRetriableFeedbackWebhookFailure({ status: 400 }), false);
    assert.equal(
      isRetriableFeedbackWebhookFailure({
        error: Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
      }),
      true
    );
  });

  it("builds admin deep link and payload", () => {
    const payload = buildFeedbackWebhookPayload({
      id: "abc",
      type: "problem",
      title: "Broken button",
      description: "Save does nothing",
      submitterName: "Bryan Evans",
      submitterRole: "Super Admin",
      pageUrl: "https://example.com/dashboard",
      createdAt: "2026-11-13T00:00:00.000Z",
      staffAppUrl: "https://wayfinder-pro.thejoshuatree.org",
    });
    assert.equal(
      payload.admin_url,
      "https://wayfinder-pro.thejoshuatree.org/dashboard/feedback/manage?id=abc"
    );
    assert.equal(
      buildFeedbackAdminUrl("https://wayfinder-pro.thejoshuatree.org/", "abc"),
      "https://wayfinder-pro.thejoshuatree.org/dashboard/feedback/manage?id=abc"
    );
  });

  it("skips quietly when webhook env is missing", async () => {
    const result = await notifyFeedbackWebhook(
      buildFeedbackWebhookPayload({
        id: "abc",
        type: "feature",
        title: "Idea",
        description: "More filters",
        submitterName: "A",
        submitterRole: "ES",
        pageUrl: null,
        createdAt: "2026-11-13T00:00:00.000Z",
        staffAppUrl: null,
      }),
      {
        env: { url: null, key: null },
        fetchImpl: async () => {
          throw new Error("should not fetch");
        },
      }
    );
    assert.equal(result.sent, false);
    assert.match(String(result.skipped), /FEEDBACK_WEBHOOK_URL/);
  });

  it("retries once on 5xx then reports soft failure", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const logs: Array<{ message: string; detail?: unknown }> = [];
    const result = await notifyFeedbackWebhook(
      buildFeedbackWebhookPayload({
        id: "abc",
        type: "problem",
        title: "Issue",
        description: "Details",
        submitterName: "A",
        submitterRole: "Admin",
        pageUrl: null,
        createdAt: "2026-11-13T00:00:00.000Z",
        staffAppUrl: "https://wayfinder-pro.thejoshuatree.org",
      }),
      {
        env: {
          url: "https://radar.example/hooks/feedback",
          key: "radar-secret",
          keyHeader: "Authorization",
        },
        fetchImpl: async (url, init) => {
          calls.push({ url: String(url), init });
          return new Response("nope", { status: 500 });
        },
        log: (message, detail) => logs.push({ message, detail }),
      }
    );
    assert.equal(result.sent, false);
    assert.equal(calls.length, 2);
    assert.equal(result.attempts, 2);
    assert.equal(calls[0]?.url, "https://radar.example/hooks/feedback");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer radar-secret");
    assert.ok(logs.some((entry) => entry.message.includes("failed")));
    assert.ok(
      logs.every((entry) => !JSON.stringify(entry).includes("radar-secret")),
      "logs must not include the webhook key"
    );
    assert.ok(
      logs.every((entry) => !JSON.stringify(entry).includes("/hooks/feedback")),
      "logs must not include the full webhook URL path"
    );
  });

  it("retries once after AbortError then succeeds", async () => {
    let attempt = 0;
    const result = await notifyFeedbackWebhook(
      buildFeedbackWebhookPayload({
        id: "abc",
        type: "problem",
        title: "Issue",
        description: "Details",
        submitterName: "A",
        submitterRole: "Admin",
        pageUrl: null,
        createdAt: "2026-11-13T00:00:00.000Z",
        staffAppUrl: "https://wayfinder-pro.thejoshuatree.org",
      }),
      {
        env: {
          url: "https://radar.example/hooks/feedback",
          key: "radar-secret",
        },
        fetchImpl: async () => {
          attempt += 1;
          if (attempt === 1) {
            throw Object.assign(new Error("This operation was aborted"), {
              name: "AbortError",
            });
          }
          return new Response("ok", { status: 200 });
        },
        log: () => {},
      }
    );
    assert.equal(result.sent, true);
    assert.equal(result.attempts, 2);
    assert.equal(attempt, 2);
  });
});

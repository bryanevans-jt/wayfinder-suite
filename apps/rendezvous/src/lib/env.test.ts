import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  buildManageUrl,
  buildPublicBookingUrl,
  RENDEZVOUS_PRODUCTION_ORIGIN,
  rendezvousAppBaseUrl,
} from "./env";

describe("rendezvousAppBaseUrl", () => {
  const keys = [
    "APP_BASE_URL",
    "NEXT_PUBLIC_APP_BASE_URL",
    "NEXT_PUBLIC_RENDEZVOUS_APP_URL",
    "NODE_ENV",
    "VERCEL_ENV",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("prefers APP_BASE_URL for booking and manage links", () => {
    process.env.APP_BASE_URL = "https://rendezvous.thejoshuatree.org/";
    process.env.NEXT_PUBLIC_RENDEZVOUS_APP_URL = "https://ignored.example";
    assert.equal(rendezvousAppBaseUrl(), "https://rendezvous.thejoshuatree.org");
    assert.equal(
      buildPublicBookingUrl("jane-doe"),
      "https://rendezvous.thejoshuatree.org/book/jane-doe"
    );
    assert.equal(
      buildManageUrl("cancel", "tok"),
      "https://rendezvous.thejoshuatree.org/manage/cancel?token=tok"
    );
  });

  it("defaults to production origin outside development", () => {
    process.env.NODE_ENV = "production";
    assert.equal(rendezvousAppBaseUrl(), RENDEZVOUS_PRODUCTION_ORIGIN);
  });
});

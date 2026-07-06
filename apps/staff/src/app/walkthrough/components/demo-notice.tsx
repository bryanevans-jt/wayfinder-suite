"use client";

import { DEMO_ACTION_NOTICE } from "../lib/demo-copy";

export function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2 text-sm text-brand-black/85 ${className}`}
      role="status"
    >
      {DEMO_ACTION_NOTICE}
    </p>
  );
}

export function showDemoActionNotice() {
  if (typeof window !== "undefined") {
    window.alert(DEMO_ACTION_NOTICE);
  }
}

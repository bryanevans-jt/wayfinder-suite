"use client";

import { PwaInstallPrompt, REPORTS_APP_PRODUCT_NAME } from "@wayfinder/branding";

export function ReportsPwaPrompt() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-4">
      <PwaInstallPrompt
        productName={REPORTS_APP_PRODUCT_NAME}
        storageKey="reports-pwa-install-dismissed"
      />
    </div>
  );
}

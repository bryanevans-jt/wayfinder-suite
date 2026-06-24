"use client";

import { useEffect } from "react";

type Props = {
  largeText: boolean;
  highContrast: boolean;
};

export function AccessibilityHtmlInit({ largeText, highContrast }: Props) {
  useEffect(() => {
    document.documentElement.classList.toggle("wf-a11y-large-text", largeText);
    document.documentElement.classList.toggle("wf-a11y-high-contrast", highContrast);
  }, [largeText, highContrast]);

  return null;
}

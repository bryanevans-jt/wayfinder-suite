"use client";

import { CORE_FOUR_VALUES } from "@wayfinder/branding";
import Image from "next/image";

export function CoreFourValuesContent() {
  return (
    <div className="mt-8 space-y-8">
      {CORE_FOUR_VALUES.map((value, index) => (
        <article
          key={value.id}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <Image
                src={value.iconPath}
                alt=""
                width={96}
                height={96}
                className="h-20 w-20 rounded-2xl sm:h-24 sm:w-24"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                {index + 1}. {value.title}
              </p>
              <p className="mt-1 text-sm font-medium text-brand-black/70">{value.scriptures}</p>
              <p className="mt-4 text-sm leading-relaxed text-brand-black/85">{value.summary}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

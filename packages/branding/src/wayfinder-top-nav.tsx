import Image from "next/image";
import Link from "next/link";
import { WAYFINDER_LOGO_PATH } from "./constants";

export type WayfinderNavBadge =
  | "Pro"
  | "Counselor"
  | "Client"
  | "Super admin"
  | "Admin"
  | "Supervisor";

type Props = {
  badgeLabel: WayfinderNavBadge;
  homeHref: string;
  /** Screen-reader label for home (logo artwork includes the product name). */
  homeAriaLabel: string;
};

export function WayfinderTopNav({ badgeLabel, homeHref, homeAriaLabel }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-green/30 bg-brand-white">
      <nav
        className="mx-auto flex h-14 max-w-6xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8"
        aria-label="Primary"
      >
        <Link
          href={homeHref}
          aria-label={homeAriaLabel}
          className="flex shrink-0 items-center py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          <Image
            src={WAYFINDER_LOGO_PATH}
            alt=""
            width={220}
            height={66}
            className="h-10 w-auto max-w-[min(240px,70vw)] object-contain object-left sm:h-11 sm:max-w-[260px] lg:h-12 lg:max-w-[280px]"
            priority
            sizes="(max-width: 640px) 70vw, 280px"
          />
        </Link>
        <span className="ml-auto rounded-full border border-brand-green/40 bg-brand-green/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-green">
          {badgeLabel}
        </span>
      </nav>
    </header>
  );
}

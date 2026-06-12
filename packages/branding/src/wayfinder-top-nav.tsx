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
        className="mx-auto flex h-16 max-w-6xl flex-wrap items-center gap-3 px-4 sm:h-[4.5rem] sm:px-6 lg:h-20 lg:px-8 xl:h-[5.25rem]"
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
            width={400}
            height={120}
            className="h-11 w-auto max-w-[min(240px,70vw)] object-contain object-left sm:h-14 sm:max-w-[300px] lg:h-[4.25rem] lg:max-w-[360px] xl:h-[4.75rem] xl:max-w-[400px]"
            priority
            sizes="(max-width: 640px) 70vw, (max-width: 1280px) 360px, 400px"
          />
        </Link>
        <span className="ml-auto rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-brand-green sm:px-3.5 sm:py-1.5 sm:text-base lg:px-4 lg:text-lg">
          {badgeLabel}
        </span>
      </nav>
    </header>
  );
}

import Image from "next/image";
import { DEVELOPER_BADGE_LOGO_PATH, LEGAL_ENTITY } from "./constants";

type Props = {
  className?: string;
};

/** Small Joshua Tree logo — lower-left “developed for” badge, not the primary product mark. */
export function WayfinderDeveloperBadge({ className = "" }: Props) {
  return (
    <div
      className={`inline-flex items-center gap-3 sm:gap-4 ${className}`}
      title={`Developed for ${LEGAL_ENTITY}`}
    >
      <Image
        src={DEVELOPER_BADGE_LOGO_PATH}
        alt=""
        width={96}
        height={32}
        className="h-5 w-auto object-contain opacity-80 sm:h-6 lg:h-8"
        aria-hidden
      />
      <span className="text-[10px] font-normal leading-snug text-brand-black/50 sm:text-xs lg:text-sm">
        Developed for {LEGAL_ENTITY}
      </span>
    </div>
  );
}

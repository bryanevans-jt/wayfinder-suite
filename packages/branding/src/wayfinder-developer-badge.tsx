import Image from "next/image";
import { DEVELOPER_BADGE_LOGO_PATH, LEGAL_ENTITY } from "./constants";

type Props = {
  className?: string;
};

/** Small Joshua Tree logo — lower-left “developed for” badge, not the primary product mark. */
export function WayfinderDeveloperBadge({ className = "" }: Props) {
  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      title={`Developed for ${LEGAL_ENTITY}`}
    >
      <Image
        src={DEVELOPER_BADGE_LOGO_PATH}
        alt=""
        width={48}
        height={16}
        className="h-3 w-auto object-contain opacity-75"
        aria-hidden
      />
      <span className="text-[8px] font-normal leading-tight text-brand-black/45">
        Developed for {LEGAL_ENTITY}
      </span>
    </div>
  );
}

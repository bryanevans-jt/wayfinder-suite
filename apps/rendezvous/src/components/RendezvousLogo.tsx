import Image from "next/image";

type Props = {
  /** Accessible name; logo artwork already includes the wordmark. */
  alt?: string;
  className?: string;
  /** Visual scale. `hero` is for page headers; `header` for compact bars. */
  size?: "hero" | "header";
  priority?: boolean;
};

/**
 * Official Rendezvous lockup (mark + wordmark). Sized large enough to read
 * clearly on booking and admin surfaces.
 */
export function RendezvousLogo({
  alt = "Rendezvous",
  className = "",
  size = "hero",
  priority = false,
}: Props) {
  // Wide lockup — size by height so the mark stays readable on light pages.
  const sizeClass =
    size === "hero"
      ? "h-[4.5rem] sm:h-24 md:h-28 lg:h-32"
      : "h-11 sm:h-12";

  return (
    <Image
      src="/rendezvous-logo.png"
      alt={alt}
      width={1121}
      height={271}
      priority={priority}
      className={`rv-logo ${sizeClass} ${className}`.trim()}
    />
  );
}

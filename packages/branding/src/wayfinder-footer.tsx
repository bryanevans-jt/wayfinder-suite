import {
  APP_VERSION,
  CONFIDENTIALITY_NOTICE,
  COPYRIGHT_NOTICE,
  LEGAL_ENTITY,
} from "./constants";
import { WayfinderDeveloperBadge } from "./wayfinder-developer-badge";

type Props = {
  /** Public product name shown in the footer (defaults to Wayfinder). */
  productName?: string;
};

export function WayfinderFooter({ productName = "Wayfinder" }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="text-xs leading-relaxed text-brand-black/75 sm:text-sm lg:text-base">
          <span className="font-semibold text-brand-black">Confidentiality.</span>{" "}
          {CONFIDENTIALITY_NOTICE}
        </p>
        <div className="mt-5 space-y-2.5 border-t border-neutral-200/80 pt-5 sm:mt-6 sm:space-y-3 sm:pt-6">
          <WayfinderDeveloperBadge />
          <p className="text-xs text-brand-black/55 sm:text-sm lg:text-base">
            © {year} {LEGAL_ENTITY}. {productName} v{APP_VERSION}. {COPYRIGHT_NOTICE}
          </p>
        </div>
      </div>
    </footer>
  );
}

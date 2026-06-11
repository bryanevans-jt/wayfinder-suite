import {
  APP_VERSION,
  CONFIDENTIALITY_NOTICE,
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-xs leading-relaxed text-brand-black/75">
          <span className="font-semibold text-brand-black">Confidentiality.</span>{" "}
          {CONFIDENTIALITY_NOTICE}
        </p>
        <div className="mt-5 space-y-2 border-t border-neutral-200/80 pt-4">
          <WayfinderDeveloperBadge />
          <p className="text-[10px] text-brand-black/55">
            © {year} {LEGAL_ENTITY}. {productName} v{APP_VERSION}.
          </p>
        </div>
      </div>
    </footer>
  );
}

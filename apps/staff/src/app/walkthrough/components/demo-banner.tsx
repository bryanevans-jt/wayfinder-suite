import { DEMO_BANNER_BODY, DEMO_BANNER_TITLE } from "../lib/demo-copy";

export function DemoBanner() {
  return (
    <div
      className="border-b border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-center text-sm text-brand-black"
      role="status"
    >
      <p className="font-semibold text-brand-green">{DEMO_BANNER_TITLE}</p>
      <p className="mx-auto mt-1 max-w-3xl text-brand-black/85">{DEMO_BANNER_BODY}</p>
    </div>
  );
}

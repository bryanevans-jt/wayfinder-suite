import { LEGAL_ENTITY } from "@wayfinder/branding";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-auto border-t border-[color:var(--rv-line)] bg-white/35 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center sm:px-6">
        <p className="text-sm font-medium text-brand-black/75">
          Rendezvous Scheduling by {LEGAL_ENTITY}
        </p>
        <p className="mt-1 text-sm text-brand-black/55">
          © {year} {LEGAL_ENTITY}
        </p>
      </div>
    </footer>
  );
}

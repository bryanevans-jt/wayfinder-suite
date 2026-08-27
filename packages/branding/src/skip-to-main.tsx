/** Visually hidden until focused — first Tab target for keyboard / screen-reader users. */
export function SkipToMainLink({
  href = "#main-content",
  label = "Skip to main content",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-green focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand-gold"
    >
      {label}
    </a>
  );
}

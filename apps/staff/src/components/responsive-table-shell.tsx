type Props = {
  children: React.ReactNode;
  className?: string;
};

export function ResponsiveTableShell({ children, className = "" }: Props) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs text-brand-black/55 lg:hidden">
        Swipe horizontally to see all columns.
      </p>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain sm:mx-0">
        <div className="inline-block min-w-full px-4 sm:px-0">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Apply to wide data tables inside ResponsiveTableShell. */
export const RESPONSIVE_TABLE_CLASS =
  "min-w-[720px] w-full border-collapse text-left text-sm";

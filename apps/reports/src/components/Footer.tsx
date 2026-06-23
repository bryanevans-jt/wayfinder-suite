import { ReportSupportNote } from '@/components/ReportSupportNote';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="py-4 px-4 text-center text-sm text-gray-500 space-y-2">
      <p>© {currentYear} Joshua Tree Service Group · Wayfinder Reports</p>
      <ReportSupportNote className="text-xs" />
    </footer>
  );
}

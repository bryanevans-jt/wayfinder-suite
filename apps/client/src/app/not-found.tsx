import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center text-brand-black">
      <h1 className="text-2xl font-semibold text-brand-green">Page not found</h1>
      <p className="mt-3 text-sm text-brand-black/80">
        We couldn&apos;t find that page. Head back to your dashboard to continue your
        Wayfinder journey.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
      >
        Go to dashboard
      </Link>
    </main>
  );
}

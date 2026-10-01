/** Shared by server ZIP builder and worksheet export UI (keep in sync). */
export const PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE = 8;

export function preEtsTestRosterZipPartCount(
  rosterCount: number,
  chunkSize = PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE
): number {
  if (rosterCount <= 0) return 0;
  return Math.ceil(rosterCount / chunkSize);
}

export function preEtsTestRosterZipDownloadUrl(serviceMonth: string, part: number): string {
  return `/api/pre-ets/worksheets/test-rosters-zip?serviceMonth=${encodeURIComponent(serviceMonth)}&part=${part}`;
}

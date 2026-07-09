export const V2_ROSTER_IMPORT_RETIRED_MESSAGE =
  "Legacy v2 roster import is retired. Add or update clients in Wayfinder Pro instead of re-importing from the old Reports database.";

export function exitIfV2RosterRetired() {
  console.error(V2_ROSTER_IMPORT_RETIRED_MESSAGE);
  process.exit(1);
}

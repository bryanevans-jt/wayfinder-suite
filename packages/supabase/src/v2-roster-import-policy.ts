/** Legacy JT Reports v2 → Wayfinder roster migration is retired after the initial import. */
export const V2_ROSTER_IMPORT_RETIRED_MESSAGE =
  "Legacy v2 roster import is retired. Add or update clients in Wayfinder Pro instead of re-importing from the old Reports database.";

export class V2RosterImportRetiredError extends Error {
  constructor(message = V2_ROSTER_IMPORT_RETIRED_MESSAGE) {
    super(message);
    this.name = "V2RosterImportRetiredError";
  }
}

export function assertV2RosterImportAllowed(): void {
  throw new V2RosterImportRetiredError();
}

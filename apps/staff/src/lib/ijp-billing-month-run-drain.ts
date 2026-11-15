/**
 * Pure helpers for IJP Generate Invoices rows drain.
 * Unbilled client lists shrink as hours are stamped — never page with a rising offset.
 */

export type IjpBillingClientFailure = {
  clientId: string;
  reason: string;
};

/**
 * Remaining unbilled clients after removing ones already attempted this run.
 */
export function remainingUnbilledForDrain(
  unbilledClientIds: readonly string[],
  skipClientIds: readonly string[]
): string[] {
  if (skipClientIds.length === 0) return [...unbilledClientIds];
  const skip = new Set(skipClientIds.filter(Boolean));
  return unbilledClientIds.filter((id) => id && !skip.has(id));
}

/**
 * Next drain chunk: always take from the front of the remaining list (offset 0).
 */
export function selectNextUnbilledDrainChunk(
  unbilledClientIds: readonly string[],
  skipClientIds: readonly string[],
  limit: number
): {
  slice: string[];
  remainingBeforeChunk: number;
  done: boolean;
} {
  const capped = Math.max(1, Math.min(100, Math.floor(limit) || 1));
  const remaining = remainingUnbilledForDrain(unbilledClientIds, skipClientIds);
  if (remaining.length === 0) {
    return { slice: [], remainingBeforeChunk: 0, done: true };
  }
  const slice = remaining.slice(0, capped);
  return {
    slice,
    remainingBeforeChunk: remaining.length,
    // Provisional: caller marks done after processing when nothing remains to try.
    done: false,
  };
}

/** Merge prior skips with clients attempted in this chunk (deduped, stable order). */
export function mergeAttemptedSkipClientIds(
  previousSkipClientIds: readonly string[],
  attemptedThisChunk: readonly string[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...previousSkipClientIds, ...attemptedThisChunk]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Rows drain is finished when every currently-unbilled client has already been
 * attempted this run (success left the list, or failure/locked is skipped).
 */
export function isRowsDrainDone(
  unbilledClientIds: readonly string[],
  skipClientIds: readonly string[]
): boolean {
  return remainingUnbilledForDrain(unbilledClientIds, skipClientIds).length === 0;
}

/**
 * Simulate drain over a shrinking unbilled queue (for tests).
 * `stillUnbilledAfterAttempt` returns true when a client must be skipped to avoid a loop.
 */
export function simulateUnbilledDrainRun(opts: {
  initialUnbilledClientIds: readonly string[];
  batchSize: number;
  /** After an attempt, should this client still appear in the unbilled reload? */
  stillUnbilledAfterAttempt?: (clientId: string) => boolean;
  maxChunks?: number;
}): {
  chunks: number;
  processedOrder: string[];
  skipClientIds: string[];
  stuckSkipped: string[];
  done: boolean;
  hitChunkCap: boolean;
} {
  let unbilled = [...opts.initialUnbilledClientIds];
  let skipClientIds: string[] = [];
  const processedOrder: string[] = [];
  const stuckSkipped: string[] = [];
  const maxChunks = opts.maxChunks ?? 500;
  let chunks = 0;
  let done = false;
  let hitChunkCap = false;

  while (chunks < maxChunks) {
    chunks += 1;
    const { slice, done: empty } = selectNextUnbilledDrainChunk(
      unbilled,
      skipClientIds,
      opts.batchSize
    );
    if (empty || slice.length === 0) {
      done = true;
      break;
    }
    for (const clientId of slice) {
      processedOrder.push(clientId);
      skipClientIds = mergeAttemptedSkipClientIds(skipClientIds, [clientId]);
      const stillThere = opts.stillUnbilledAfterAttempt?.(clientId) === true;
      if (stillThere) {
        stuckSkipped.push(clientId);
      } else {
        unbilled = unbilled.filter((id) => id !== clientId);
      }
    }
    if (isRowsDrainDone(unbilled, skipClientIds)) {
      done = true;
      break;
    }
  }
  if (!done) hitChunkCap = true;

  return {
    chunks,
    processedOrder,
    skipClientIds,
    stuckSkipped,
    done,
    hitChunkCap,
  };
}

export type IjpGenerateInvoicesSummaryInput = {
  created: number;
  refreshed: number;
  compiled: number;
  compileErrors: number;
  skippedLocked: number;
  rowFailures: number;
  incomplete: boolean;
  completenessStillMissing: boolean;
  missingCount?: number;
};

/** User-facing Generate Invoices result line (UI + tests). */
export function formatIjpGenerateInvoicesSummary(
  input: IjpGenerateInvoicesSummaryInput
): { tone: "success" | "warning" | "error"; text: string } {
  const failed = input.compileErrors + input.rowFailures;
  const parts = [
    `created ${input.created}`,
    `refreshed ${input.refreshed}`,
    `compiled ${input.compiled}`,
    `failed ${failed}`,
  ];
  if (input.skippedLocked > 0) {
    parts.push(`skipped/locked ${input.skippedLocked}`);
  }
  if (input.compileErrors > 0) {
    parts.push(`compile errors ${input.compileErrors}`);
  }
  if (input.rowFailures > 0) {
    parts.push(`row failures ${input.rowFailures}`);
  }

  if (input.incomplete || input.completenessStillMissing) {
    const missing =
      input.missingCount != null && input.missingCount > 0
        ? ` Completeness still shows ${input.missingCount} client(s) needing generate.`
        : " Completeness still shows clients needing generate.";
    return {
      tone: failed > 0 || input.compileErrors > 0 ? "error" : "warning",
      text: `Generate Invoices did not finish cleanly (${parts.join(", ")}).${missing} Run Generate again to continue.`,
    };
  }

  if (failed > 0) {
    return {
      tone: "error",
      text: `Generate Invoices finished with failures (${parts.join(", ")}). Review compile/row errors and retry.`,
    };
  }

  return {
    tone: "success",
    text: `Generate Invoices finished (${parts.join(", ")}).`,
  };
}

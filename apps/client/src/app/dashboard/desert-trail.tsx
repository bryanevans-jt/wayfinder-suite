"use client";

import { useMemo } from "react";

export type TrailMilestone = {
  id: string;
  order_index: number;
  title: string;
  description: string | null;
};

type DesertTrailProps = {
  milestones: TrailMilestone[];
  currentStageId: string | null;
  readOnly: boolean;
};

function resolveCurrentIndex(
  milestones: TrailMilestone[],
  currentStageId: string | null
): number {
  const sorted = [...milestones].sort((a, b) => a.order_index - b.order_index);
  if (sorted.length === 0) {
    return 0;
  }
  if (!currentStageId) {
    return 0;
  }
  const idx = sorted.findIndex((m) => m.id === currentStageId);
  if (idx === -1) {
    return 0;
  }
  return idx;
}

export function DesertTrail({
  milestones,
  currentStageId,
  readOnly,
}: DesertTrailProps) {
  const sorted = useMemo(
    () => [...milestones].sort((a, b) => a.order_index - b.order_index),
    [milestones]
  );

  const currentIndex = useMemo(
    () => resolveCurrentIndex(milestones, currentStageId),
    [milestones, currentStageId]
  );

  if (sorted.length === 0) {
    return null;
  }

  const inner = (
    <ol className="relative space-y-0 pl-1">
        {sorted.map((milestone, index) => {
          const isLast = index === sorted.length - 1;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          const lineBelowCompleted = index < currentIndex;
          const lineBelowCurrent = index === currentIndex;

          const lineGray = "bg-neutral-300";
          let segmentClass = `w-0.5 flex-1 min-h-[1.75rem] ${lineGray}`;
          if (lineBelowCompleted) {
            segmentClass = "w-0.5 flex-1 min-h-[1.75rem] bg-brand-green";
          } else if (lineBelowCurrent) {
            segmentClass =
              `w-0.5 flex-1 min-h-[1.75rem] bg-gradient-to-b from-brand-green to-neutral-300`;
          }

          let circleClass =
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-300 bg-brand-white text-transparent";
          if (isCompleted) {
            circleClass =
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-green bg-brand-white text-brand-green";
          } else if (isCurrent) {
            circleClass =
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-gold bg-brand-white animate-pulse-brand-gold";
          } else if (isUpcoming) {
            circleClass =
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-300 bg-brand-white";
          }

          return (
            <li key={milestone.id} className="flex gap-4">
              <div className="flex w-9 shrink-0 flex-col items-center pt-0.5">
                <span className={circleClass} aria-current={isCurrent ? "step" : undefined}>
                  {isCompleted ? (
                    <svg
                      className="h-3.5 w-3.5 text-brand-green"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M2 6l3 3 5-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                {!isLast ? (
                  <div className="mt-1 flex flex-1 flex-col items-center py-0.5">
                    <div className={segmentClass} />
                  </div>
                ) : null}
              </div>
              <div className={`min-w-0 flex-1 ${!isLast ? "pb-10" : "pb-1"}`}>
                <p className="font-semibold text-brand-black">
                  {milestone.title}
                </p>
                {milestone.description ? (
                  <p
                    className={
                      isUpcoming
                        ? "mt-1 text-sm text-brand-black/45"
                        : "mt-1 text-sm text-brand-black/75"
                    }
                  >
                    {milestone.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
  );

  if (readOnly) {
    return (
      <div
        className="pointer-events-none select-none rounded-2xl border border-dashed border-neutral-300 bg-brand-white p-1"
        aria-readonly
      >
        {inner}
      </div>
    );
  }

  return <div className="bg-brand-white">{inner}</div>;
}
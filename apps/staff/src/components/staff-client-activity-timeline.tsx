"use client";

import { ClientActivityTimeline, type ClientActivityFeedItem } from "@wayfinder/branding";
import { ContactLogCorrectButton } from "@/components/contact-log-correct-button";

const CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

type Props = {
  feed: ClientActivityFeedItem[];
  clientId: string;
  currentUserId: string;
  allowCorrection: boolean;
};

function canCorrect(
  item: Extract<ClientActivityFeedItem, { kind: "contact" }>,
  currentUserId: string
): boolean {
  if (!item.logged_by || item.logged_by !== currentUserId) return false;
  const created = Date.parse(item.at);
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= CORRECTION_WINDOW_MS;
}

export function StaffClientActivityTimeline({
  feed,
  clientId,
  currentUserId,
  allowCorrection,
}: Props) {
  return (
    <ClientActivityTimeline
      feed={feed}
      showInternalNotes
      renderContactFooter={
        allowCorrection
          ? (item) =>
              canCorrect(item, currentUserId) ? (
                <ContactLogCorrectButton
                  logId={item.id}
                  clientId={clientId}
                  initialPublicOutcome={item.public_outcome ?? ""}
                  initialNotes={item.notes ?? ""}
                />
              ) : null
          : undefined
      }
    />
  );
}

"use client";

import BookingProviders from "./BookingProviders";
import ConversationalBooking from "./ConversationalBooking";
import type { Episode } from "@/episodes/model";

export default function CommitmentPanel({
  episode,
  onClose,
  onBooked,
}: {
  episode: Episode;
  onClose: () => void;
  onBooked?: () => void;
}) {
  const recommendation = episode.recommendation?.result;
  const intention = episode.intentions.at(-1);
  if (!recommendation || !intention) return null;

  return (
    <BookingProviders>
      <ConversationalBooking
        episodeId={episode.id}
        expectedRevision={episode.revision}
        retreatRootHash={recommendation.retreatRootHash}
        retreatTitle={recommendation.retreatTitle}
        depositUsd={recommendation.priceUsd}
        operatorAddress={
          recommendation.attestor ??
          "0x0000000000000000000000000000000000000000"
        }
        signals={{
          energy: intention.constraints.energy,
          budget: intention.constraints.budget,
          social: intention.constraints.social,
        }}
        onClose={onClose}
        onBooked={onBooked}
      />
    </BookingProviders>
  );
}

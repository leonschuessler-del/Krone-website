"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAvailabilityCheck } from "@/features/availability/use-availability-check";
import { AvailabilityResult } from "@/features/booking/AvailabilityResult";
import { scheduleHasRange } from "@/features/booking/hooks";
import { SchedulePicker } from "@/features/booking/SchedulePicker";
import { emptySchedule, useBookingStore, type ScheduleDraft } from "@/store/booking-store";
import type { SpaceView } from "./types";

/** Availability calendar for a single space on its detail page. */
export function SpaceAvailability({ space, spaces }: { space: SpaceView; spaces: SpaceView[] }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleDraft>(emptySchedule);
  const check = useAvailabilityCheck([space.id], schedule, { alternatives: 3 });
  const ready = scheduleHasRange(schedule) && check.data?.bookingAllowed === true;

  return (
    <div className="space-y-5">
      <SchedulePicker spaces={spaces} selectedIds={[space.id]} schedule={schedule} onChange={(p) => setSchedule((s) => ({ ...s, ...p }))} />
      {scheduleHasRange(schedule) && (
        <div className="rounded-2xl border border-sand bg-white p-4">
          <AvailabilityResult result={check} onPickAlternative={(alt) => setSchedule((s) => ({ ...s, rentalMode: "hourly", ...alt }))} />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="gold"
          size="lg"
          disabled={!ready}
          onClick={() => {
            const st = useBookingStore.getState();
            st.addSpace(space.id);
            st.setSchedule(schedule);
            st.setStep(3);
            router.push(`/buchen?spaces=${[...new Set([...st.selectedSpaceIds, space.id])].join(",")}`);
          }}
        >
          Mit diesem Termin buchen <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            const st = useBookingStore.getState();
            st.addSpace(space.id);
            if (schedule.date) st.setSchedule(schedule);
            router.push("/eventlocation#karte");
          }}
        >
          Weitere Bereiche hinzufügen
        </Button>
      </div>
    </div>
  );
}

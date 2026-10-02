"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RentalMode, SpaceId } from "@/domain/types";
import { track } from "@/lib/analytics";

/**
 * Central client-side booking state (selection → schedule → checkout).
 *
 * - Multi-select from the start: `selectedSpaceIds: string[]`.
 * - Persisted in sessionStorage so the selection survives navigation to a
 *   detail page and back, reloads and wizard steps – but not beyond the
 *   browser session (privacy by design: personal data is not kept longer).
 * - The server re-validates EVERYTHING (spaces, availability, prices) on
 *   submit. Nothing stored here is trusted.
 */

export interface ScheduleDraft {
  rentalMode: RentalMode;
  /** Local date in Europe/Berlin, YYYY-MM-DD */
  date: string | null;
  /** Only for daily (multi-day) rentals: inclusive end date */
  endDate: string | null;
  /** HH:mm local time (hourly rentals). endTime <= startTime means "next day". */
  startTime: string | null;
  endTime: string | null;
}

export interface EventDraft {
  eventType: string;
  guestCount: string;
  notes: string;
}

export interface ContactDraft {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  billingDifferent: boolean;
  billingName: string;
  billingStreet: string;
  billingHouseNumber: string;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;
}

export interface HandoverDraft {
  handoverSlotId: string | null;
  returnSlotId: string | null;
}

export interface BookingDraftState {
  selectedSpaceIds: SpaceId[];
  schedule: ScheduleDraft;
  extras: Record<string, number>;
  event: EventDraft;
  contact: ContactDraft;
  handover: HandoverDraft;
  acceptedTerms: Record<string, boolean>;
  step: number;
  submissionMode: "booking" | "inquiry";
  /** Last previewed space on the map (UI only). */
  previewSpaceId: SpaceId | null;

  toggleSpace: (id: SpaceId, requires?: readonly SpaceId[]) => void;
  addSpace: (id: SpaceId) => void;
  removeSpace: (id: SpaceId) => void;
  setSelection: (ids: SpaceId[]) => void;
  clearSelection: () => void;
  setPreview: (id: SpaceId | null) => void;
  setSchedule: (patch: Partial<ScheduleDraft>) => void;
  setExtra: (extraId: string, quantity: number) => void;
  setEvent: (patch: Partial<EventDraft>) => void;
  setContact: (patch: Partial<ContactDraft>) => void;
  setHandover: (patch: Partial<HandoverDraft>) => void;
  setTermAccepted: (termId: string, accepted: boolean) => void;
  setStep: (step: number) => void;
  setSubmissionMode: (mode: "booking" | "inquiry") => void;
  resetCheckout: () => void;
}

export const emptySchedule: ScheduleDraft = {
  rentalMode: "hourly",
  date: null,
  endDate: null,
  startTime: null,
  endTime: null,
};

const emptyEvent: EventDraft = { eventType: "", guestCount: "", notes: "" };

const emptyContact: ContactDraft = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  country: "Deutschland",
  billingDifferent: false,
  billingName: "",
  billingStreet: "",
  billingHouseNumber: "",
  billingPostalCode: "",
  billingCity: "",
  billingCountry: "Deutschland",
};

const unique = (ids: SpaceId[]) => Array.from(new Set(ids));

export const useBookingStore = create<BookingDraftState>()(
  persist(
    (set, get) => ({
      selectedSpaceIds: [],
      schedule: emptySchedule,
      extras: {},
      event: emptyEvent,
      contact: emptyContact,
      handover: { handoverSlotId: null, returnSlotId: null },
      acceptedTerms: {},
      step: 1,
      submissionMode: "booking",
      previewSpaceId: null,

      toggleSpace: (id, requires = []) => {
        const selected = get().selectedSpaceIds.includes(id);
        set({
          selectedSpaceIds: selected
            ? get().selectedSpaceIds.filter((s) => s !== id)
            : // a room that needs others (every room needs the Restaurant) brings them along
              unique([...get().selectedSpaceIds, ...requires, id]),
        });
        track(selected ? "space_deselected" : "space_selected", { spaceId: id });
      },
      addSpace: (id) => {
        if (get().selectedSpaceIds.includes(id)) return;
        set({ selectedSpaceIds: unique([...get().selectedSpaceIds, id]) });
        track("space_selected", { spaceId: id });
      },
      removeSpace: (id) => {
        set({ selectedSpaceIds: get().selectedSpaceIds.filter((s) => s !== id) });
        track("space_deselected", { spaceId: id });
      },
      setSelection: (ids) => set({ selectedSpaceIds: unique(ids) }),
      clearSelection: () => set({ selectedSpaceIds: [] }),
      setPreview: (id) => set({ previewSpaceId: id }),
      setSchedule: (patch) => set({ schedule: { ...get().schedule, ...patch } }),
      setExtra: (extraId, quantity) => {
        const extras = { ...get().extras };
        if (quantity <= 0) delete extras[extraId];
        else extras[extraId] = quantity;
        set({ extras });
      },
      setEvent: (patch) => set({ event: { ...get().event, ...patch } }),
      setContact: (patch) => set({ contact: { ...get().contact, ...patch } }),
      setHandover: (patch) => set({ handover: { ...get().handover, ...patch } }),
      setTermAccepted: (termId, accepted) => set({ acceptedTerms: { ...get().acceptedTerms, [termId]: accepted } }),
      setStep: (step) => set({ step }),
      setSubmissionMode: (mode) => set({ submissionMode: mode }),
      resetCheckout: () =>
        set({
          selectedSpaceIds: [],
          schedule: emptySchedule,
          extras: {},
          event: emptyEvent,
          handover: { handoverSlotId: null, returnSlotId: null },
          acceptedTerms: {},
          step: 1,
          submissionMode: "booking",
          previewSpaceId: null,
        }),
    }),
    {
      name: "krone-booking-draft",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (s) => ({
        selectedSpaceIds: s.selectedSpaceIds,
        schedule: s.schedule,
        extras: s.extras,
        event: s.event,
        contact: s.contact,
        handover: s.handover,
        acceptedTerms: s.acceptedTerms,
        step: s.step,
        submissionMode: s.submissionMode,
      }),
    },
  ),
);

export function useSelectionCount(): number {
  return useBookingStore((s) => s.selectedSpaceIds.length);
}

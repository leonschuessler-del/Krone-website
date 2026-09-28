import { describe, expect, it } from "vitest";
import { canTransition, generateBookingNumber, BOOKING_NUMBER_RE, statusAfterPayment } from "@/domain/booking";
import { getFullVenueSpaceIds, isFullVenueSelection, sanitizeSpaceIds, validateSelection } from "@/domain/selection";
import { spaceSeeds } from "@/content/spaces";
import { bookingSubmissionSchema } from "@/server/validation";

const spaces = spaceSeeds.map((s) => ({ ...s }));

describe("full venue selection (Test 61)", () => {
  it("selects exactly the spaces flagged includedInFullVenue – not every entity", () => {
    const ids = getFullVenueSpaceIds(spaces);
    expect(ids).toEqual(["restaurant", "kitchen", "side-room", "stage", "old-tavern", "winter-garden", "beer-garden"]);
    expect(ids).not.toContain("hotel");
    expect(isFullVenueSelection(ids, spaces)).toBe(true);
    expect(isFullVenueSelection(ids.slice(1), spaces)).toBe(false);
  });

  it("excludes spaces when includedInFullVenue is false", () => {
    const modified = spaces.map((s) => (s.id === "kitchen" ? { ...s, includedInFullVenue: false } : s));
    expect(getFullVenueSpaceIds(modified)).not.toContain("kitchen");
  });
});

describe("selection sanitising (URL state)", () => {
  it("drops unknown/invalid ids and duplicates", () => {
    expect(sanitizeSpaceIds("restaurant,stage,winter-garden,foo,<script>,stage,hotel", spaces)).toEqual(["restaurant", "stage", "winter-garden"]);
  });

  it("validates requires / incompatibleWith rules", () => {
    const withRules = spaces.map((s) =>
      s.id === "stage" ? { ...s, requires: ["restaurant"] } : s.id === "beer-garden" ? { ...s, incompatibleWith: ["winter-garden"] } : s,
    );
    expect(validateSelection(["stage"], withRules)).toEqual([{ type: "requires", spaceId: "stage", missing: ["restaurant"] }]);
    expect(validateSelection(["stage", "restaurant"], withRules)).toEqual([]);
    expect(validateSelection(["beer-garden", "winter-garden"], withRules)[0]?.type).toBe("incompatible");
  });
});

describe("booking status machine", () => {
  it("allows only valid transitions", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("completed", "pending")).toBe(false);
  });

  it("never confirms on failed payment", () => {
    expect(statusAfterPayment("pending", "failed")).toBe("pending");
    expect(statusAfterPayment("pending", "paid")).toBe("confirmed");
    expect(statusAfterPayment("cancelled", "paid")).toBe("cancelled");
  });

  it("generates readable booking numbers", () => {
    const n = generateBookingNumber("booking", 2026);
    expect(n).toMatch(BOOKING_NUMBER_RE);
    expect(n.startsWith("KR-2026-")).toBe(true);
    expect(generateBookingNumber("inquiry", 2026).startsWith("KA-2026-")).toBe(true);
  });
});

describe("booking validation", () => {
  const valid = {
    kind: "booking",
    spaceIds: ["restaurant"],
    schedule: { rentalMode: "hourly", date: "2026-10-14", startTime: "16:00", endTime: "22:00" },
    extras: [],
    event: { eventType: "birthday", guestCount: 40, notes: "" },
    contact: {
      firstName: "Erika",
      lastName: "Muster",
      email: "erika@example.org",
      phone: "+49 6028 12345",
      street: "Musterweg",
      houseNumber: "1",
      postalCode: "63849",
      city: "Leidersbach",
      country: "Deutschland",
    },
    handoverAt: null,
    returnAt: null,
    acceptedTerms: ["privacy"],
  };

  it("accepts a valid submission", () => {
    expect(bookingSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid e-mail, dates and unknown fields", () => {
    expect(bookingSubmissionSchema.safeParse({ ...valid, contact: { ...valid.contact, email: "nope" } }).success).toBe(false);
    expect(bookingSubmissionSchema.safeParse({ ...valid, schedule: { ...valid.schedule, date: "2026-13-40" } }).success).toBe(false);
    expect(bookingSubmissionSchema.safeParse({ ...valid, total: 0 }).success).toBe(false);
  });
});

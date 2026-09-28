import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SpaceEditor, type SpaceEditorData } from "@/features/admin/spaces/SpaceEditor";
import { PageHeader } from "@/features/admin/ui";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { getAdminSpace } from "@/server/services/admin-catalog-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bereich bearbeiten" };

export default async function AdminSpaceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/bereiche/${id}`);
  const result = await getAdminSpace(await getDb(), id);
  if (!result) notFound();
  const s = result.space;
  const data: SpaceEditorData = {
    id: s.id,
    slug: s.slug,
    code: s.code,
    name: s.name,
    color: s.color,
    shortDescription: s.shortDescription,
    longDescription: s.longDescription,
    areaSqm: s.areaSqm,
    capacitySeated: s.capacitySeated,
    capacityStanding: s.capacityStanding,
    basePrice: s.basePrice,
    priceModel: s.priceModel,
    deposit: s.deposit,
    cleaningFee: s.cleaningFee,
    minimumDurationMinutes: s.minimumDurationMinutes,
    maximumDurationMinutes: s.maximumDurationMinutes,
    setupBufferMinutes: s.setupBufferMinutes,
    cleanupBufferMinutes: s.cleanupBufferMinutes,
    advanceBookingMinHours: s.advanceBookingMinHours,
    advanceBookingMaxDays: s.advanceBookingMaxDays,
    bookingMode: s.bookingMode,
    availableForStandaloneRental: s.availableForStandaloneRental,
    includedInFullVenue: s.includedInFullVenue,
    bookable: s.bookable,
    active: s.active,
    usageOptions: s.usageOptions,
    rules: s.rules,
    needsVerification: s.needsVerification,
    features: result.features.map((f) => f.label),
  };

  return (
    <>
      <Link href="/admin/bereiche" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Alle Bereiche
      </Link>
      <PageHeader
        eyebrow={`Bereich · ${s.code}`}
        title={s.name}
        description="Änderungen werden nach dem Speichern sofort auf der Website und im Buchungsprozess verwendet."
        actions={
          <>
            <Link href={`/admin/karte?bereich=${s.id}`} className="inline-flex h-9 items-center rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold hover:border-ink/40">
              Auf der Karte bearbeiten
            </Link>
            <a href={`/bereiche/${s.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-gold-dark hover:underline">
              Öffentliche Seite <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>
        }
      />
      <SpaceEditor initial={data} />
    </>
  );
}

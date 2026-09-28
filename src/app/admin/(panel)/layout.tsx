import { and, count, isNull, notInArray } from "drizzle-orm";
import { AdminSidebar } from "@/features/admin/AdminNav";
import { env } from "@/lib/env";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { bookings, contactMessages } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const db = await getDb();
  const [[unreviewed], [openMessages]] = await Promise.all([
    db.select({ n: count() }).from(bookings).where(and(isNull(bookings.reviewedAt), notInArray(bookings.status, ["cancelled", "draft"]))),
    db.select({ n: count() }).from(contactMessages).where(isNull(contactMessages.handledAt)),
  ]);

  return (
    <div className="min-h-dvh bg-[#f6f1e7] text-ink">
      <AdminSidebar
        email={admin.email}
        demo={env.demoMode}
        badges={{ "/admin/buchungen": Number(unreviewed?.n ?? 0), "/admin/emails": Number(openMessages?.n ?? 0) }}
      />
      <div className="lg:pl-64">
        <main id="inhalt" className="mx-auto w-full max-w-[100rem] px-4 pb-16 pt-6 sm:px-6 md:pt-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

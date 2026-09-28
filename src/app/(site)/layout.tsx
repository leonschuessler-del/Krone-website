import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { StoreHydrator } from "@/components/providers/StoreHydrator";
import { env } from "@/lib/env";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Zum Inhalt springen
      </a>
      <StoreHydrator />
      <Header />
      <main id="inhalt" className="min-h-[60vh]">
        {children}
      </main>
      {env.demoMode && <DemoBanner />}
      <Footer />
    </>
  );
}

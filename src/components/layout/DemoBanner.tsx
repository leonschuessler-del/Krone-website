import { FlaskConical } from "lucide-react";
import { siteConfig } from "@/config/site";

export function DemoBanner() {
  return (
    <aside
      aria-label="Hinweis Demo-Modus"
      className="border-t border-warning/25 bg-warning-pale text-[0.82rem] text-[#5d4413]"
    >
      <div className="container-page flex items-start gap-2.5 py-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{siteConfig.demoNotice}</p>
      </div>
    </aside>
  );
}

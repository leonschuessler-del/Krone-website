"use client";

import { useRouter } from "next/navigation";
import { SiteMap } from "@/features/map/SiteMap";
import type { SpaceView } from "./types";

/** Small site map on detail pages: the current space is highlighted, others link to their pages. */
export function SpaceMiniMap({ spaces, currentId }: { spaces: SpaceView[]; currentId: string }) {
  const router = useRouter();
  return (
    <SiteMap
      spaces={spaces.filter((s) => s.shape)}
      selectedIds={[]}
      highlightIds={[currentId]}
      interactive={false}
      labels="code"
      showParking={false}
      onActivate={(id) => {
        const target = spaces.find((s) => s.id === id);
        if (target && id !== currentId) router.push(target.href);
      }}
      className="overflow-hidden rounded-2xl ring-1 ring-black/5"
      ariaLabel="Lage auf dem Grundstück"
    />
  );
}

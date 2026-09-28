import type { Point, Space } from "@/domain/types";
import type { SpaceMedia } from "@/lib/media";

/** Space enriched with map geometry and resolved media – what UI components receive. */
export interface SpaceView extends Space {
  shape: {
    polygon: Point[];
    labelPosition: { x: number; y: number };
  } | null;
  media: SpaceMedia;
  href: string;
}

/** Map-level status per space (derived from availability for the chosen time). */
export type MapSpaceStatus = "available" | "unavailable" | "partial" | "unknown";

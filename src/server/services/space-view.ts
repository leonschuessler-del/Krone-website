import { getSpaceShape } from "@/config/floorplan";
import type { Point, Space } from "@/domain/types";
import type { SpaceView } from "@/features/spaces/types";
import { getSpaceMedia } from "@/lib/media";

export interface ShapeOverride {
  polygon: Point[] | null;
  labelPosition: { x: number; y: number } | null;
}

/**
 * Combines a space record with map geometry and media.
 * Geometry precedence: database override (map editor) → src/config/floorplan.ts.
 */
export function toSpaceView(space: Space, mediaFolder: string, override?: ShapeOverride | null): SpaceView {
  const configShape = getSpaceShape(space.id);
  const polygon = override?.polygon ?? configShape?.polygon ?? null;
  const labelPosition = override?.labelPosition ?? configShape?.labelPosition ?? null;
  return {
    ...space,
    shape: polygon && polygon.length >= 3 && labelPosition ? { polygon, labelPosition } : null,
    media: getSpaceMedia(mediaFolder, space.name),
    href: `/bereiche/${space.slug}`,
  };
}

import Image from "next/image";
import type { SpaceView } from "@/features/spaces/types";
import { cn } from "@/lib/cn";
import { MediaPlaceholder } from "./MediaPlaceholder";

/** Hero image of a space, or an elegant placeholder when no real photo exists yet. */
export function SpaceImage({
  space,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  className,
  priority = false,
  placeholderSize = "md",
}: {
  space: Pick<SpaceView, "id" | "code" | "color" | "media" | "name">;
  sizes?: string;
  className?: string;
  priority?: boolean;
  placeholderSize?: "sm" | "md" | "lg";
}) {
  if (!space.media.hero) {
    return <MediaPlaceholder spaceId={space.id} code={space.code} color={space.color} className={className} size={placeholderSize} />;
  }
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Image src={space.media.hero.src} alt={space.media.hero.alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

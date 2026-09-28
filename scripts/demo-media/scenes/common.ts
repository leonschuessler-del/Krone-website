import { Defs, finish, svgDoc, type FinishOptions } from "../lib/svg";
import { Camera, Scene, type CameraSpec, type SceneOptions } from "../lib/persp";

export type ShotName = "hero" | "gallery-01" | "gallery-02" | "gallery-03" | "gallery-04";

export interface Shot {
  name: ShotName;
  /** Short description (used in logs / README). */
  title: string;
  render: () => string;
}

export interface SpaceScenes {
  folder: string;
  label: string;
  shots: Shot[];
  /** Include a Ken-Burns tour video (spaces only, not "property"). */
  tour: boolean;
}

export function makeScene(cam: CameraSpec, opts: SceneOptions = {}, defs?: Defs): Scene {
  return new Scene(new Camera(cam), defs ?? new Defs(), opts);
}

/** Renders a scene as a blurred (out-of-focus) background group. */
export function blurred(s: Scene, sd: number): string {
  return `<g filter="${s.defs.blur(sd)}">${s.render()}</g>`;
}

/** Wraps the scene with backdrop, optional mid layers and the finishing pass. */
export function compose(s: Scene, o: FinishOptions & { background?: string; before?: string; after?: string } = {}): string {
  const bg = o.background ? `<rect width="1600" height="1067" fill="${o.background}"/>` : "";
  return svgDoc(s.defs, `${bg}${o.before ?? ""}${s.render()}${o.after ?? ""}${finish(s.defs, o)}`);
}

/** Evening grade: multiply layer drawn *between* the scene and the glows (layer 1.8). */
export function eveningGrade(s: Scene, strength = 0.55, color = "#5b4636"): void {
  const g = s.defs.linear([
    [0, "#2a2019", 1],
    [0.5, color, 1],
    [1, "#3a2c22", 1],
  ]);
  s.raw(`<rect width="1600" height="1067" fill="${g}" opacity="${strength}" style="mix-blend-mode:multiply"/>`, 1.8);
}

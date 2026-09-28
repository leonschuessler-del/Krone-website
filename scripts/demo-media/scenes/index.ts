import type { SpaceScenes } from "./common";
import { beerGarden } from "./beer-garden";
import { hotel } from "./hotel";
import { kitchen } from "./kitchen";
import { oldTavern } from "./old-tavern";
import { property } from "./property";
import { restaurant } from "./restaurant";
import { sideRoom } from "./side-room";
import { stage } from "./stage";
import { winterGarden } from "./winter-garden";

export const ALL_SCENES: SpaceScenes[] = [restaurant, kitchen, sideRoom, stage, oldTavern, winterGarden, beerGarden, hotel, property];

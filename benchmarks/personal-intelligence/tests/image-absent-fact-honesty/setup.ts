import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { stageFixtureImages } from "../../lib/fixtures/image-extraction/stage";
import { PHOTO_IMAGE, UI_IMAGE } from "./constants";

// Stage both images the user "already saved": the settings screenshot,
// which carries no serial number, and the text-free photo.
export default stageFixtureImages([
  UI_IMAGE,
  PHOTO_IMAGE,
]) satisfies TestSetupCommand[];

import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { stageFixtureImages } from "../../lib/fixtures/image-extraction/stage";
import { UI_IMAGE } from "./constants";

// Stage the settings screenshot the user "already saved".
export default stageFixtureImages([UI_IMAGE]) satisfies TestSetupCommand[];

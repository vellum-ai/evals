import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { stageFixtureImages } from "../../lib/fixtures/image-extraction/stage";
import { TABLE_IMAGE } from "./constants";

// Stage the screenshot of the revenue table the user "already saved".
export default stageFixtureImages([TABLE_IMAGE]) satisfies TestSetupCommand[];

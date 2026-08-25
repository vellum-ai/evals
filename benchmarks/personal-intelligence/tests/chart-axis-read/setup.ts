import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { stageFixtureImages } from "../../lib/fixtures/image-extraction/stage";
import { CHART_IMAGE } from "./constants";

// Stage the chart image the user "already saved".
export default stageFixtureImages([CHART_IMAGE]) satisfies TestSetupCommand[];

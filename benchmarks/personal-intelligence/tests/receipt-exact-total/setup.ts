import type { TestSetupCommand } from "../../../../src/lib/setup-command";
import { stageFixtureImages } from "../../lib/fixtures/image-extraction/stage";
import { RECEIPT_IMAGE } from "./constants";

// Stage the receipt photo the user "already saved", so the assistant
// reaches it with `file_read` the way it would any other workspace file.
export default stageFixtureImages([RECEIPT_IMAGE]) satisfies TestSetupCommand[];

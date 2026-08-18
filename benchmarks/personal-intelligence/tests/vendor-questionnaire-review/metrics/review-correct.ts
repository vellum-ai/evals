import { makeQuestionnaireReviewMetric } from "../../../../../src/lib/common-metrics/questionnaire-review";
import { REVIEW_FILE, VENDOR_TRUTH } from "../constants";

export default makeQuestionnaireReviewMetric({
  file: REVIEW_FILE,
  vendors: VENDOR_TRUTH,
});

import { componseSingleStringPipeline } from "./processor";
import {
  capitalizeAfterSpace,
  removeWrappedContent,
  trimWhitespace,
} from "./transformers";

export const defaultContributorDisplayPipeline = componseSingleStringPipeline([
  removeWrappedContent("(", ")"),
  trimWhitespace,
  capitalizeAfterSpace,
]);

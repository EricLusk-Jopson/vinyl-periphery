import { composePipeline, liftToArray } from "./processor";
import {
  removeWrappedContent,
  trimWhitespace,
  replaceHyphensWithSpaces,
  capitalizeAfterSpace,
  splitCommaDelimited,
  removeEmptyStrings,
  removeDuplicates,
  separateBySpace,
} from "./transformers";

// Create standard transformers from our single-role functions
const arrayTransformers = {
  removeBracketContent: liftToArray(removeWrappedContent("[", "]")),
  trimWhitespace: liftToArray(trimWhitespace),
  replaceHyphensWithSpaces: liftToArray(replaceHyphensWithSpaces),
  capitalizeAfterSpace: liftToArray(capitalizeAfterSpace),
};

// Default pipeline combining all our transformers
export const defaultRolePipeline = composePipeline([
  arrayTransformers.removeBracketContent,
  arrayTransformers.trimWhitespace,
  splitCommaDelimited,
  arrayTransformers.replaceHyphensWithSpaces,
  arrayTransformers.capitalizeAfterSpace,
  removeEmptyStrings,
  removeDuplicates,
]);

export const spacedDefaultRolePipeline = composePipeline([
  defaultRolePipeline,
  separateBySpace,
]);

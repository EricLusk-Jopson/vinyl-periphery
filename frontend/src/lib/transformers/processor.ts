import {
  SingleStringTransformer,
  StringTransformer,
  Pipeline,
  SingleStringPipeline,
} from "./types";

// Utility to lift single-role transformer to array transformer
export const liftToArray =
  (fn: SingleStringTransformer): StringTransformer =>
  (strs: string[]) =>
    strs.map(fn);

// Utility to combine transformers
export const composePipeline =
  (transformers: StringTransformer[]): Pipeline =>
  (strs: string[]) =>
    transformers.reduce(
      (processed, transformer) => transformer(processed),
      strs
    );

// Utility to combine transformers
export const componseSingleStringPipeline =
  (transformers: SingleStringTransformer[]): SingleStringPipeline =>
  (str: string) =>
    transformers.reduce(
      (processed, transformer) => transformer(processed),
      str
    );

// Utility to create new single-role transformers
export const createSingleStringTransformer = (
  fn: SingleStringTransformer
): StringTransformer => liftToArray(fn);

// Utility to create custom pipelines
export const createPipeline = (transformers: StringTransformer[]): Pipeline =>
  composePipeline(transformers);

export const createSingleStringPipeline = (
  transformers: SingleStringTransformer[]
): SingleStringPipeline => componseSingleStringPipeline(transformers);

// Example usage:
// const roles = ['Lead Vocals [backing]', 'Guitar, Bass'];
// const processedRoles = defaultRolePipeline(roles);

// Example custom pipeline:
// const customPipeline = createPipeline([
//   standardTransformers.trimWhitespace,
//   splitCommaDelimited,
// ]);

import { SingleRoleTransformer, RoleTransformer, Pipeline } from "./types";

// Core transformation functions - each does one thing
const removeBracketContent = (role: string): string =>
  role.replace(/\[.*?\]/g, "");

const trimWhitespace = (role: string): string => role.trim();

const replaceHyphensWithSpaces = (role: string): string =>
  role.replace(/[-–—]/g, " ");

const capitalizeAfterSpace = (role: string): string =>
  role.replace(/\s+[a-z]/g, (match) => match.toUpperCase());

// Array-level transformations
const splitCommaDelimited = (roles: string[]): string[] =>
  roles.flatMap((role) => role.split(",").map((r) => r.trim()));

const removeEmptyRoles = (roles: string[]): string[] =>
  roles.filter((role) => role.length > 0);

const removeDuplicates = (roles: string[]): string[] =>
  Array.from(new Set(roles));

// Utility to lift single-role transformer to array transformer
const liftToArray =
  (fn: SingleRoleTransformer): RoleTransformer =>
  (roles: string[]) =>
    roles.map(fn);

// Utility to combine transformers
const composePipeline =
  (transformers: RoleTransformer[]): Pipeline =>
  (roles: string[]) =>
    transformers.reduce(
      (processed, transformer) => transformer(processed),
      roles
    );

// Create standard transformers from our single-role functions
const arrayTransformers = {
  removeBracketContent: liftToArray(removeBracketContent),
  trimWhitespace: liftToArray(trimWhitespace),
  replaceHyphensWithSpaces: liftToArray(replaceHyphensWithSpaces),
  capitalizeAfterSpace: liftToArray(capitalizeAfterSpace),
};

// Default pipeline combining all our transformers
export const defaultPipeline = composePipeline([
  arrayTransformers.removeBracketContent,
  arrayTransformers.trimWhitespace,
  splitCommaDelimited,
  arrayTransformers.replaceHyphensWithSpaces,
  arrayTransformers.capitalizeAfterSpace,
  removeEmptyRoles,
  removeDuplicates,
]);

// Utility to create new single-role transformers
export const createSingleRoleTransformer = (
  fn: SingleRoleTransformer
): RoleTransformer => liftToArray(fn);

// Utility to create custom pipelines
export const createPipeline = (transformers: RoleTransformer[]): Pipeline =>
  composePipeline(transformers);

// Example usage:
// const roles = ['Lead Vocals [backing]', 'Guitar, Bass'];
// const processedRoles = defaultPipeline(roles);

// Example custom pipeline:
// const customPipeline = createPipeline([
//   standardTransformers.trimWhitespace,
//   splitCommaDelimited,
// ]);

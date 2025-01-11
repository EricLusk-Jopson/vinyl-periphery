import { SingleStringTransformer, StringTransformer } from "./types";

export const removeWrappedContent: (
  openWrapper: string,
  closedWrapper: string
) => SingleStringTransformer = (openWrapper, closedWrapper) => (str) => {
  // Escape special regex characters
  const escapedOpen = openWrapper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedClose = closedWrapper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Create the regex pattern with the escaped wrappers
  const pattern = new RegExp(
    `${escapedOpen}[^${escapedOpen}${escapedClose}]*${escapedClose}`,
    "g"
  );

  let result = str;
  let previousResult;
  do {
    previousResult = result;
    result = result.replace(pattern, "");
  } while (result !== previousResult);

  return result;
};

export const trimWhitespace = (str: string): string => str.trim();

export const replaceHyphensWithSpaces: SingleStringTransformer = (str) => {
  return str.replace(/[-–—]/g, " ").replace(/\s+/g, " ");
};

export const capitalizeAfterSpace: SingleStringTransformer = (str) => {
  // Capitalize first character
  const result = str.charAt(0).toUpperCase() + str.slice(1);
  // Capitalize after spaces
  return result.replace(/\s+[a-z]/g, (match) => match.toUpperCase());
};

// Array-level transformations
export const splitCommaDelimited = (strs: string[]): string[] =>
  strs.flatMap((str) => str.split(",").map((r) => r.trim()));

export const removeEmptyStrings: StringTransformer = (strs) => {
  return strs.filter((str) => str.trim().length > 0);
};

export const removeDuplicates = (strs: string[]): string[] =>
  Array.from(new Set(strs));

import { extractColors } from "extract-colors";
import { FinalColor } from "extract-colors/lib/types/Color";

export interface Color {
  r: number;
  g: number;
  b: number;
}

/**
 * Default color palette to use when extraction fails
 */
export const defaultColorPalette = (): Color[] => [
  // White (original grayscale)
  { r: 1, g: 1, b: 1 },
  // #D9325E (pink/red)
  { r: 217, g: 50, b: 94 },
  // #6865BF (purple)
  { r: 104, g: 101, b: 191 },
  // #AAA7F2 (light purple)
  { r: 170, g: 167, b: 242 },
  // #F2695C (coral/orange)
  { r: 242, g: 105, b: 92 },
];

/**
 * Extract a color palette from an image URL
 * @param url - URL of the image to extract colors from
 * @param options - Configuration options
 * @returns Promise resolving to an array of Color objects
 */
export const extractColorPalette = async (
  url: string,
  options: {
    maxColors?: number;
    timeout?: number;
  } = {}
): Promise<Color[]> => {
  const {
    maxColors = 5,
    timeout = 5000, // 5 second timeout
  } = options;

  // Add a proxy if needed to avoid CORS issues
  const imageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  // Create a promise that rejects after the specified timeout
  const timeoutPromise = new Promise<Color[]>((_, reject) => {
    setTimeout(() => reject(new Error("Color extraction timed out")), timeout);
  });

  // The main extraction promise
  const extractionPromise = new Promise<Color[]>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = async () => {
      try {
        // Create a canvas to draw the image
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Draw the image to the canvas
        ctx.drawImage(img, 0, 0);

        // Get the image data from the canvas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Extract colors from the image data
        const extractedColors = await extractColors(imageData);

        // Convert the extracted colors to our Color interface format
        // Sort by area coverage (descending) and take top maxColors
        const sortedColors = extractedColors
          .sort((a, b) => b.area - a.area)
          .slice(0, maxColors)
          .map((color: FinalColor) => ({
            r: color.red,
            g: color.green,
            b: color.blue,
          }));

        resolve(sortedColors);
      } catch (err) {
        console.error("Error extracting colors:", err);
        reject(err);
      }
    };

    img.onerror = (e) => {
      console.error("Error loading image:", e);
      reject(new Error(`Failed to load image from ${imageUrl}`));
    };

    // Set src after setting up event handlers
    img.src = imageUrl;
  });

  // Race the extraction against the timeout
  try {
    return await Promise.race([extractionPromise, timeoutPromise]);
  } catch (error) {
    console.warn("Using default color palette due to error:", error);
    return defaultColorPalette();
  }
};

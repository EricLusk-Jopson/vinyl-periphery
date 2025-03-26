import React, { useRef, useEffect, useState, useCallback } from "react";

// Color interface
interface Color {
  r: number;
  g: number;
  b: number;
}

// Default color palette
const defaultColorPalette: Color[] = [
  // White (original grayscale)
  { r: 1, g: 1, b: 1 },
  { r: 240, g: 240, b: 240 },
  // #D9325E (pink/red)
  { r: 217, g: 50, b: 94 },
  // #6865BF (purple)
  { r: 104, g: 101, b: 191 },
  // #AAA7F2 (light purple)
  { r: 170, g: 167, b: 242 },
  // #F2695C (coral/orange)
  { r: 242, g: 105, b: 92 },
];

interface TVStaticEffectProps {
  className?: string;
  scaleFactor?: number;
  sampleCount?: number;
  fps?: number;
  colorIntensity?: number;
  colorPalette?: Color[];
  paused?: boolean;
}

const TVStaticEffect: React.FC<TVStaticEffectProps> = ({
  className = "",
  scaleFactor = 2.5,
  sampleCount = 4,
  fps = 30,
  colorIntensity = 0.0005,
  colorPalette,
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number>(0);
  const samplesRef = useRef<ImageData[]>([]);
  const currentFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const isGeneratingRef = useRef<boolean>(false);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibleHeightRef = useRef<number>(0);
  const windowSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Make sure palette is valid
  const ensureValidPalette = useCallback(
    (palette: Color[] | undefined): Color[] => {
      // Start with grayscale colors
      const safePalette = [
        { r: 1, g: 1, b: 1 },
        { r: 240, g: 240, b: 240 },
      ];

      // Add valid colors from the provided palette
      if (Array.isArray(palette)) {
        palette.forEach((color) => {
          if (
            color &&
            typeof color.r === "number" &&
            typeof color.g === "number" &&
            typeof color.b === "number"
          ) {
            safePalette.push(color);
          }
        });
      }

      // If we only have grayscale, add some default colors
      if (safePalette.length <= 2) {
        return defaultColorPalette;
      }

      return safePalette;
    },
    []
  );

  // Active palette with grayscale included
  const [activePalette, setActivePalette] = useState<Color[]>(() =>
    ensureValidPalette(colorPalette)
  );

  // Generate a sample with the given palette
  const generateSample = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      palette: Color[]
    ): ImageData => {
      // Ensure palette is valid
      const safePalette = ensureValidPalette(palette);

      const intensity: number[] = [];
      const factor = height / 30;
      const trans = 1 - Math.random() * 0.05;
      const intensityCurve: number[] = [];

      // Generate intensity curve
      for (let i = 0; i < Math.floor(height / factor) + factor; i++) {
        intensityCurve.push(Math.floor(Math.random() * 15));
      }

      // Interpolate intensity values
      for (let i = 0; i < height; i++) {
        const index = Math.floor(i / factor);
        const nextIndex = Math.min(index + 1, intensityCurve.length - 1);
        const value =
          intensityCurve[index] +
            (intensityCurve[nextIndex] - intensityCurve[index]) *
              (i / factor - index) || 0;
        intensity.push(value);
      }

      // Create noise texture
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // Process noise data
      for (let y = 0; y < height; y++) {
        const rowIntensity = intensity[y];
        const rowOffset = y * width * 4;

        for (let x = 0; x < width; x++) {
          const i = rowOffset + x * 4;
          const intensity_value = Math.floor(36 * Math.random()) + rowIntensity;

          // Choose a color based on intensity (with bounds checking)
          const colorIndex =
            Math.random() < 1 - colorIntensity
              ? 0
              : Math.min(
                  Math.floor(1 + Math.random() * (safePalette.length - 1)),
                  safePalette.length - 1
                );

          const selectedColor = safePalette[colorIndex];

          if (colorIndex === 0) {
            // Grayscale
            data[i] = data[i + 1] = data[i + 2] = intensity_value;
          } else {
            // Colored noise
            const brightness = intensity_value / 36;
            data[i] = Math.floor(selectedColor.r * brightness);
            data[i + 1] = Math.floor(selectedColor.g * brightness);
            data[i + 2] = Math.floor(selectedColor.b * brightness);
          }

          data[i + 3] = Math.round(255 * trans);
        }
      }

      return imageData;
    },
    [colorIntensity, ensureValidPalette]
  );

  // Generate all frames in a non-blocking way
  const generateFrames = useCallback(
    async (
      canvas: HTMLCanvasElement,
      count: number,
      palette: Color[]
    ): Promise<ImageData[]> => {
      // Mark as generating
      isGeneratingRef.current = true;

      // Store the current animation frame
      const currentAnimationFrame = currentFrameRef.current;

      return new Promise((resolve) => {
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          isGeneratingRef.current = false;
          return resolve([]);
        }

        // If we have existing frames, draw the current one while generating
        if (samplesRef.current.length > 0 && paused) {
          try {
            context.putImageData(
              samplesRef.current[currentAnimationFrame],
              0,
              0
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            // Handle potential errors with existing frame
            console.warn(
              "Could not draw existing frame while generating new ones"
            );
          }
        }

        const frames: ImageData[] = [];
        let framesDone = 0;

        // Use setTimeout to make this non-blocking
        const generateNextFrame = () => {
          try {
            frames.push(
              generateSample(context, canvas.width, canvas.height, palette)
            );
            framesDone++;

            if (framesDone < count) {
              // Schedule next frame generation
              setTimeout(generateNextFrame, 0);
            } else {
              // All done
              isGeneratingRef.current = false;
              resolve(frames);
            }
          } catch (e) {
            console.error("Error generating frame:", e);
            isGeneratingRef.current = false;
            // Return whatever frames we have so far
            resolve(frames);
          }
        };

        // Start the generation process
        generateNextFrame();
      });
    },
    [generateSample, paused]
  );

  // Animation frame handler
  const animate = useCallback(
    (timestamp: number) => {
      if (paused) {
        animationFrameIdRef.current = 0;
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      // Handle timing
      const now = timestamp || performance.now();
      const elapsed = now - lastFrameTimeRef.current;

      if (elapsed >= 1000 / fps && samplesRef.current.length > 0) {
        lastFrameTimeRef.current = now;

        try {
          // Draw the current frame
          context.putImageData(
            samplesRef.current[currentFrameRef.current],
            0,
            0
          );

          // Move to next frame
          currentFrameRef.current =
            (currentFrameRef.current + 1) % samplesRef.current.length;
        } catch (e) {
          console.warn("Error drawing frame:", e);
          // Try to recover by regenerating frames
          if (!isGeneratingRef.current) {
            initializeFrames();
          }
        }
      }

      // Continue animation
      animationFrameIdRef.current = requestAnimationFrame(animate);
    },
    [fps, paused]
  );

  // Initialize or update frames when needed
  const initializeFrames = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    // If already generating frames, don't start another generation
    if (isGeneratingRef.current) return;

    // Generate new frames in a non-blocking way
    const newFrames = await generateFrames(canvas, sampleCount, activePalette);

    if (newFrames.length > 0) {
      // Remember current position in animation cycle
      const currentPosition =
        samplesRef.current.length > 0
          ? currentFrameRef.current % samplesRef.current.length
          : 0;

      samplesRef.current = newFrames;

      // Maintain same relative position in new frames
      if (newFrames.length > 0) {
        currentFrameRef.current = currentPosition % newFrames.length;
      } else {
        currentFrameRef.current = 0;
      }

      // If paused, display current frame
      if (paused && context) {
        try {
          context.putImageData(newFrames[currentFrameRef.current], 0, 0);
        } catch (e) {
          console.warn("Error displaying initial frame:", e);
        }
      }
    }
  }, [generateFrames, sampleCount, activePalette, paused]);

  // Get real visual viewport size (handles mobile browser bars)
  const getVisualViewport = useCallback(() => {
    // Use Visual Viewport API if available
    if (window.visualViewport) {
      return {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
      };
    }

    // Fallback to window inner dimensions
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }, []);

  // Check if resize is significant enough to regenerate frames
  const isSignificantResize = useCallback(
    (
      oldSize: { width: number; height: number },
      newSize: { width: number; height: number }
    ) => {
      // Always regenerate on first time (oldSize will be zeros)
      if (oldSize.width === 0 || oldSize.height === 0) return true;

      // Calculate change percentages
      const widthChange =
        Math.abs(newSize.width - oldSize.width) / oldSize.width;
      const heightChange =
        Math.abs(newSize.height - oldSize.height) / oldSize.height;

      // Only regenerate if change is significant (more than 5%)
      return widthChange > 0.05 || heightChange > 0.05;
    },
    []
  );

  // Update canvas size to match window dimensions
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    // Get real visual dimensions
    const viewport = getVisualViewport();
    const windowWidth = viewport.width;
    const windowHeight = viewport.height;

    // Only update if significant change in size
    const sizeChanged = isSignificantResize(windowSizeRef.current, {
      width: windowWidth,
      height: windowHeight,
    });

    if (!sizeChanged) {
      return false;
    }

    // Update stored window size
    windowSizeRef.current = { width: windowWidth, height: windowHeight };

    // Set canvas dimensions based on window size and scale factor
    const canvasWidth = Math.ceil(windowWidth / scaleFactor);
    const canvasHeight = Math.ceil(windowHeight / scaleFactor);

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      return true;
    }

    return false;
  }, [scaleFactor, getVisualViewport, isSignificantResize]);

  // Handle resize
  const handleResize = useCallback(() => {
    // Clear any existing timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // Get current viewport height
    const currentHeight = window.visualViewport?.height || window.innerHeight;

    // Check if this is likely an address bar show/hide
    // (typical mobile browser behavior on scroll)
    const heightDiff = Math.abs(currentHeight - lastVisibleHeightRef.current);
    const isAddressBarChange = heightDiff < 150; // Typical address bar height is less than 150px

    // Update last height
    lastVisibleHeightRef.current = currentHeight;

    // For address bar changes, use longer debounce to avoid unnecessary updates
    const debounceTime = isAddressBarChange ? 500 : 200;

    // Debounce resize event
    resizeTimeoutRef.current = setTimeout(() => {
      const sizeChanged = updateCanvasSize();

      if (sizeChanged) {
        initializeFrames();
      }

      resizeTimeoutRef.current = null;
    }, debounceTime);
  }, [updateCanvasSize, initializeFrames]);

  // Handle orientation change specifically
  const handleOrientationChange = useCallback(() => {
    // Clear any existing timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // Use a longer delay for orientation changes
    resizeTimeoutRef.current = setTimeout(() => {
      const sizeChanged = updateCanvasSize();

      if (sizeChanged) {
        // For orientation change, we always want to regenerate
        initializeFrames();
      }

      resizeTimeoutRef.current = null;
    }, 300);
  }, [updateCanvasSize, initializeFrames]);

  // Handle window resize and orientation changes
  useEffect(() => {
    // Initialize viewport height
    lastVisibleHeightRef.current =
      window.visualViewport?.height || window.innerHeight;

    // Set up event listeners
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    // Initial setup
    updateCanvasSize();
    initializeFrames();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);

      // Clear any pending resize timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [
    updateCanvasSize,
    initializeFrames,
    handleResize,
    handleOrientationChange,
  ]);

  // Update when palette changes
  useEffect(() => {
    if (colorPalette) {
      const newPalette = ensureValidPalette(colorPalette);
      setActivePalette(newPalette);
    }
  }, [colorPalette, ensureValidPalette]);

  // Start/stop animation based on paused state
  useEffect(() => {
    if (!paused && !animationFrameIdRef.current) {
      lastFrameTimeRef.current = performance.now();
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else if (paused && animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = 0;
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = 0;
      }
    };
  }, [paused, animate]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed top-0 left-0 w-screen h-screen ${className}`}
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        objectFit: "cover",
      }}
    />
  );
};

export default TVStaticEffect;

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
  const windowSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Active palette with grayscale included
  const [activePalette, setActivePalette] = useState<Color[]>(() => {
    if (colorPalette) {
      return [
        { r: 1, g: 1, b: 1 },
        { r: 240, g: 240, b: 240 },
        ...colorPalette,
      ];
    }
    return defaultColorPalette;
  });

  // Generate a sample with the given palette
  const generateSample = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      palette: Color[]
    ): ImageData => {
      const intensity: number[] = [];
      const factor = height / 50;
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

          // Choose a color based on intensity
          const colorIndex =
            Math.random() < 1 - colorIntensity
              ? 0
              : Math.floor(1 + Math.random() * (palette.length - 1));
          const selectedColor = palette[colorIndex];

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
    [colorIntensity]
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

      return new Promise((resolve) => {
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          isGeneratingRef.current = false;
          return resolve([]);
        }

        const frames: ImageData[] = [];
        let framesDone = 0;

        // Use setTimeout to make this non-blocking
        const generateNextFrame = () => {
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
        };

        // Start the generation process
        generateNextFrame();
      });
    },
    [generateSample]
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

        // Draw the current frame
        context.putImageData(samplesRef.current[currentFrameRef.current], 0, 0);

        // Move to next frame
        currentFrameRef.current =
          (currentFrameRef.current + 1) % samplesRef.current.length;
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
      samplesRef.current = newFrames;
      currentFrameRef.current = 0;

      // If paused, display first frame
      if (paused && context) {
        context.putImageData(newFrames[0], 0, 0);
      }
    }
  }, [generateFrames, sampleCount, activePalette, paused]);

  // Update canvas size to match window dimensions
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Check if window size has changed
    if (
      windowWidth === windowSizeRef.current.width &&
      windowHeight === windowSizeRef.current.height
    ) {
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
  }, [scaleFactor]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const sizeChanged = updateCanvasSize();
      if (sizeChanged) {
        // Size changed, regenerate frames
        initializeFrames();
      }
    };

    // Set up resize handler
    window.addEventListener("resize", handleResize);

    // Initial setup
    updateCanvasSize();
    initializeFrames();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateCanvasSize, initializeFrames]);

  // Update when palette changes
  useEffect(() => {
    if (colorPalette) {
      const newPalette = [
        { r: 1, g: 1, b: 1 },
        { r: 240, g: 240, b: 240 },
        ...colorPalette,
      ];

      setActivePalette(newPalette);

      // Don't regenerate frames here - we'll do it in the next effect
    }
  }, [colorPalette]);

  // Regenerate frames when active palette changes
  useEffect(() => {
    initializeFrames();
  }, [activePalette, initializeFrames]);

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

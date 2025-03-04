import React, { useRef, useEffect, useState } from "react";

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
  scanSpeed?: number;
  colorIntensity?: number;
  colorPalette?: Color[];
  paused?: boolean; // New prop to pause animation
}

const TVStaticEffect: React.FC<TVStaticEffectProps> = ({
  className = "",
  scaleFactor = 2.5,
  sampleCount = 4,
  fps = 30,
  scanSpeed = 0,
  colorIntensity = 0.0005,
  colorPalette,
  paused = false, // Default to animation running
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number>(0);
  const samplesRef = useRef<ImageData[]>([]);
  const sampleIndexRef = useRef<number>(0);
  const scanOffsetYRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Active palette reference with grayscale included
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

  // Update active palette when colorPalette prop changes
  useEffect(() => {
    if (!colorPalette) return;

    const newPalette = [
      { r: 1, g: 1, b: 1 },
      { r: 240, g: 240, b: 240 },
      ...colorPalette,
    ];

    setActivePalette(newPalette);
  }, [colorPalette]);

  // Generate a sample with the current palette
  const generateSample = (
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
  };

  // Handling animation frame
  const animate = (timestamp: number) => {
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

    if (elapsed >= 1000 / fps) {
      lastFrameTimeRef.current = now;

      if (samplesRef.current.length) {
        // Draw the current sample
        const currentSampleIndex =
          Math.floor(sampleIndexRef.current) % samplesRef.current.length;
        context.putImageData(samplesRef.current[currentSampleIndex], 0, 0);

        // Update sample index
        sampleIndexRef.current += 15 / fps;
        if (sampleIndexRef.current >= samplesRef.current.length) {
          sampleIndexRef.current = 0;

          // Each time we complete a cycle, regenerate one sample with the current palette
          const sampleToRegenerate = Math.floor(
            Math.random() * samplesRef.current.length
          );
          samplesRef.current[sampleToRegenerate] = generateSample(
            context,
            canvas.width,
            canvas.height,
            activePalette
          );
        }

        // Draw scan line if enabled
        if (scanSpeed > 0) {
          const scanSize = canvas.height / scaleFactor / 3;

          const grd = context.createLinearGradient(
            0,
            scanOffsetYRef.current,
            0,
            scanSize + scanOffsetYRef.current
          );
          grd.addColorStop(0, "rgba(255,255,255,0)");
          grd.addColorStop(0.1, "rgba(255,255,255,0)");
          grd.addColorStop(0.2, "rgba(255,255,255,0.2)");
          grd.addColorStop(0.3, "rgba(255,255,255,0.0)");
          grd.addColorStop(0.45, "rgba(255,255,255,0.1)");
          grd.addColorStop(0.5, "rgba(255,255,255,1.0)");
          grd.addColorStop(0.55, "rgba(255,255,255,0.55)");
          grd.addColorStop(0.6, "rgba(255,255,255,0.25)");
          grd.addColorStop(1, "rgba(255,255,255,0)");

          context.fillStyle = grd;
          context.fillRect(
            0,
            scanOffsetYRef.current,
            canvas.width,
            scanSize + scanOffsetYRef.current
          );
          context.globalCompositeOperation = "lighter";

          // Move scan line
          scanOffsetYRef.current += canvas.height / (scanSpeed * fps);
          if (scanOffsetYRef.current > canvas.height) {
            scanOffsetYRef.current = -(scanSize / 2);
          }
        }
      }
    }

    // Continue animation
    animationFrameIdRef.current = requestAnimationFrame(animate);
  };

  // Start animation
  useEffect(() => {
    // Initialize animation
    if (!paused && !animationFrameIdRef.current) {
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
  }, [paused]);

  // Handle resize and initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const handleResize = () => {
      if (!canvas || !context) return;

      const canvasWidth = canvas.offsetWidth / scaleFactor;
      const canvasHeight =
        canvasWidth / (canvas.offsetWidth / canvas.offsetHeight);

      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Generate new samples
        samplesRef.current = [];
        for (let i = 0; i < sampleCount; i++) {
          samplesRef.current.push(
            generateSample(context, canvas.width, canvas.height, activePalette)
          );
        }

        // If paused, display first frame
        if (paused && samplesRef.current.length > 0) {
          context.putImageData(samplesRef.current[0], 0, 0);
        }
      }
    };

    // Set up resize handler
    window.addEventListener("resize", handleResize);

    // Initial setup
    handleResize();
    sampleIndexRef.current = 0;
    lastFrameTimeRef.current = performance.now();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [scaleFactor, sampleCount, activePalette]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full transform translate-x-0 translate-y-0 backface-visibility-hidden perspective-1000 ${className}`}
    />
  );
};

export default TVStaticEffect;

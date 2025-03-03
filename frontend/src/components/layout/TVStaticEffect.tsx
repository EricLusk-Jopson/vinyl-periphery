import React, { useRef, useEffect } from "react";

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
}

const TVStaticEffect: React.FC<TVStaticEffectProps> = ({
  className = "",
  scaleFactor = 2.5,
  sampleCount = 4,
  fps = 30,
  scanSpeed = 0,
  colorIntensity = 0.0005,
  colorPalette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<ImageData[]>([]);

  // Queue for storing pending palettes
  const pendingPalettesRef = useRef<Color[][]>([]);

  // Keep track of when each sample was last regenerated
  const lastRegenerationTimesRef = useRef<number[]>([]);

  // Counter for tracking which sample to regenerate next
  const nextSampleToRegenerateRef = useRef<number>(0);

  // Current active palette
  const activePaletteRef = useRef<Color[]>(colorPalette || defaultColorPalette);

  // Effect to handle colorPalette changes
  useEffect(() => {
    if (!colorPalette) return;

    const newPalette = [
      { r: 1, g: 1, b: 1 },
      { r: 240, g: 240, b: 240 },
      ...colorPalette,
    ];

    // Check if the palette has actually changed
    if (
      JSON.stringify(activePaletteRef.current) !== JSON.stringify(newPalette)
    ) {
      // Queue the new palette for gradual application
      pendingPalettesRef.current.push(newPalette);
      console.log("New palette queued for transition");
    }
  }, [colorPalette]);

  // Generate a sample with a specific palette
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

  // Main animation effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let sampleIndex = 0;
    let scanOffsetY = 0;
    let scanSize = 0;
    let animationFrameId: number;
    let lastFrameTime = 0;
    let lastPaletteUpdateTime = 0;

    // Initialize regeneration times
    lastRegenerationTimesRef.current = Array(sampleCount).fill(0);

    // Regenerate a single sample with the current palette
    const regenerateSample = (index: number) => {
      if (samplesRef.current.length > index) {
        samplesRef.current[index] = generateSample(
          context!,
          canvas.width,
          canvas.height,
          activePaletteRef.current
        );
        lastRegenerationTimesRef.current[index] = performance.now();

        // Update the next sample index
        nextSampleToRegenerateRef.current = (index + 1) % sampleCount;
      }
    };

    // Render function for animation
    const render = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTime;

      if (elapsed >= 1000 / fps) {
        lastFrameTime = timestamp;

        if (samplesRef.current.length && context) {
          // Draw current sample
          const currentSampleIndex =
            Math.floor(sampleIndex) % samplesRef.current.length;
          context.putImageData(samplesRef.current[currentSampleIndex], 0, 0);

          // Update sample index
          sampleIndex += 20 / fps;
          if (sampleIndex >= samplesRef.current.length * 100) {
            sampleIndex = 0;
          }

          // Check for palette updates every 200ms
          if (timestamp - lastPaletteUpdateTime > 200) {
            lastPaletteUpdateTime = timestamp;

            // If there's a pending palette, activate it
            if (pendingPalettesRef.current.length > 0) {
              activePaletteRef.current = pendingPalettesRef.current.shift()!;
              console.log("Activated new palette for gradual transition");

              // Reset regeneration times to speed up transition
              lastRegenerationTimesRef.current = Array(sampleCount).fill(0);
            }
          }

          // Regenerate samples gradually with the current active palette
          // Only regenerate one sample every ~100ms to maintain performance
          if (
            timestamp -
              lastRegenerationTimesRef.current[
                nextSampleToRegenerateRef.current
              ] >
            100
          ) {
            regenerateSample(nextSampleToRegenerateRef.current);
          }

          // Process scan line if enabled
          if (scanSpeed > 0) {
            const grd = context.createLinearGradient(
              0,
              scanOffsetY,
              0,
              scanSize + scanOffsetY
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
              scanOffsetY,
              canvas.width,
              scanSize + scanOffsetY
            );
            context.globalCompositeOperation = "lighter";

            scanOffsetY += canvas.height / (scanSpeed * fps);
            if (scanOffsetY > canvas.height) scanOffsetY = -(scanSize / 2);
          }
        }
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    // Handle resize
    const handleResize = () => {
      if (canvas && context) {
        const canvasWidth = canvas.offsetWidth / scaleFactor;
        const canvasHeight =
          canvasWidth / (canvas.offsetWidth / canvas.offsetHeight);

        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          scanSize = canvas.offsetHeight / scaleFactor / 3;

          // Generate initial samples with current palette
          samplesRef.current = [];
          for (let i = 0; i < sampleCount; i++) {
            samplesRef.current.push(
              generateSample(
                context,
                canvas.width,
                canvas.height,
                activePaletteRef.current
              )
            );
            lastRegenerationTimesRef.current[i] = performance.now();
          }
        }
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    lastFrameTime = performance.now();
    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [scaleFactor, sampleCount, fps, scanSpeed, colorIntensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full transform translate-x-0 translate-y-0 backface-visibility-hidden perspective-1000 ${className}`}
    />
  );
};

export default TVStaticEffect;

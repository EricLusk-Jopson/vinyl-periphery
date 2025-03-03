import React, { useRef, useEffect } from "react";

interface TVStaticEffectProps {
  className?: string;
  scaleFactor?: number;
  sampleCount?: number;
  fps?: number;
  scanSpeed?: number;
  colorIntensity?: number; // Controls how much color vs grayscale (0-1)
}

const TVStaticEffect: React.FC<TVStaticEffectProps> = ({
  className = "",
  scaleFactor = 2.5,
  sampleCount = 4,
  fps = 30,
  scanSpeed = 0, // seconds from top to bottom
  colorIntensity = 0.0005, // Very subtle color by default
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    // Pre-define color palette to reduce object creation during rendering
    const colorPalette = [
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

    let samples: ImageData[] = [];
    let sampleIndex = 0;
    let scanOffsetY = 0;
    let scanSize = 0;
    let animationFrameId: number;
    let lastFrameTime = 0;

    // Function to interpolate values - kept simple and efficient
    const interpolate = (
      x: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number
    ) => {
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    };

    // Generate random noise sample - optimized for fewer calculations
    const generateRandomSample = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number
    ) => {
      const intensity: number[] = [];
      const factor = h / 50;
      const trans = 1 - Math.random() * 0.05;
      const intensityCurve: number[] = [];

      // Generate random intensity curve - keep calculation simple
      for (let i = 0; i < Math.floor(h / factor) + factor; i++) {
        intensityCurve.push(Math.floor(Math.random() * 15));
      }

      // Interpolate intensity values - precompute for each row
      for (let i = 0; i < h; i++) {
        const index = Math.floor(i / factor);
        const nextIndex = Math.min(index + 1, intensityCurve.length - 1);
        const value = interpolate(
          i / factor,
          index,
          intensityCurve[index],
          nextIndex,
          intensityCurve[nextIndex]
        );
        intensity.push(value);
      }

      // Create noise texture
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;

      // Process by row to better utilize cache locality
      for (let y = 0; y < h; y++) {
        const rowIntensity = intensity[y];
        const rowOffset = y * w * 4;

        for (let x = 0; x < w; x++) {
          const i = rowOffset + x * 4;

          // Determine base intensity
          let intensity_value = Math.floor(36 * Math.random()) + rowIntensity;

          // Choose a color from the palette (weighted based on colorIntensity)
          const colorIndex =
            Math.random() < 1 - colorIntensity
              ? 0
              : Math.floor(1 + Math.random() * 4);
          const selectedColor = colorPalette[colorIndex];

          if (colorIndex === 0) {
            // Original grayscale mode - single assignment is faster
            data[i] = data[i + 1] = data[i + 2] = intensity_value;
          } else {
            // Colored noise - apply the intensity to the selected color
            const brightness = intensity_value / 36; // Normalize to 0-1 range
            data[i] = Math.floor(selectedColor.r * brightness);
            data[i + 1] = Math.floor(selectedColor.g * brightness);
            data[i + 2] = Math.floor(selectedColor.b * brightness);
          }

          data[i + 3] = Math.round(255 * trans);
        }
      }

      return imageData;
    };

    // Render function - simplified with minimal overhead
    const render = (timestamp: number) => {
      // Skip frames if needed to maintain target fps
      const elapsed = timestamp - lastFrameTime;

      if (elapsed >= 1000 / fps) {
        // Only render if enough time has passed
        lastFrameTime = timestamp;

        if (samples.length && context) {
          // Draw current noise sample
          context.putImageData(samples[Math.floor(sampleIndex)], 0, 0);

          // Update sample index - simple counter
          sampleIndex += 20 / fps;
          if (sampleIndex >= samples.length) sampleIndex = 0;

          // Only process scan line if speed > 0
          if (scanSpeed > 0) {
            // Create scan line gradient
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

            // Draw scan line
            context.fillStyle = grd;
            context.fillRect(
              0,
              scanOffsetY,
              canvas.width,
              scanSize + scanOffsetY
            );
            context.globalCompositeOperation = "lighter";

            // Move scan line
            scanOffsetY += canvas.height / (scanSpeed * fps);
            if (scanOffsetY > canvas.height) scanOffsetY = -(scanSize / 2);
          }
        }
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    // Simple resize handler without debouncing - most browsers throttle resize events
    const handleResize = () => {
      if (canvas && context) {
        const canvasWidth = canvas.offsetWidth / scaleFactor;
        const canvasHeight =
          canvasWidth / (canvas.offsetWidth / canvas.offsetHeight);

        // Only resize if dimensions actually changed
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          scanSize = canvas.offsetHeight / scaleFactor / 3;

          // Generate new samples
          samples = [];
          for (let i = 0; i < sampleCount; i++) {
            samples.push(
              generateRandomSample(context, canvas.width, canvas.height)
            );
          }
        }
      }
    };

    // Set up event listeners
    window.addEventListener("resize", handleResize);

    // Initialize
    handleResize();
    lastFrameTime = performance.now();
    animationFrameId = window.requestAnimationFrame(render);

    // Cleanup
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

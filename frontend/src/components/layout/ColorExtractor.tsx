import React, { useState, useEffect } from "react";
import { Color, extractColorPalette } from "@/lib/colors/paletteExtractor";

type ColorExtractorProps = {
  imagePath?: string;
  externalUrl?: string;
};

const ColorExtractor: React.FC<ColorExtractorProps> = ({
  externalUrl = "https://i.discogs.com/AORxa04UkzfLXCXQcYajls6RWw42rc-UVK5vukJlQnQ/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTYwNTY0/NTQtMTQwOTk0MTg2/NC0zMTcwLmpwZWc.jpeg",
}) => {
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>("");

  // Function to create a proxy URL if needed
  const getProxiedUrl = (url: string): string => {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    const generateColors = async () => {
      const urlToUse = getProxiedUrl(externalUrl);
      setImageUrl(urlToUse);
      const extractedColors = await extractColorPalette(externalUrl);
      setColors(extractedColors);
      setLoading(false);
    };

    generateColors();
  }, [externalUrl]);

  // Component for rendering a color square
  const ColorSquare = ({ color }: { color: Color }) => (
    <div className="flex flex-col items-center">
      <div
        className="w-24 h-24 rounded shadow-md"
        style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
      />
      <div className="mt-2 text-sm">
        <div>{`rgb(${color.r}, ${color.g}, ${color.b})`}</div>
      </div>
    </div>
  );

  // URL input for testing different images
  const [inputUrl, setInputUrl] = useState<string>(externalUrl || "");
  const [_, setCurrentUrl] = useState<string>(externalUrl || "");

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUrl(inputUrl);
  };

  if (loading) {
    return <div className="text-center p-4">Loading colors...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Extracted Colors</h2>

      <URLForm
        inputUrl={inputUrl}
        setInputUrl={setInputUrl}
        handleUrlSubmit={handleUrlSubmit}
      />

      <div className="flex flex-wrap gap-4 my-6">
        {colors.map((color, index) => (
          <ColorSquare key={index} color={color} />
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">Original Image</h3>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Source image"
            className="max-w-md rounded shadow-md"
          />
        )}
      </div>
    </div>
  );
};

// URL input form component
interface URLFormProps {
  inputUrl: string;
  setInputUrl: React.Dispatch<React.SetStateAction<string>>;
  handleUrlSubmit: (e: React.FormEvent) => void;
}

const URLForm: React.FC<URLFormProps> = ({
  inputUrl,
  setInputUrl,
  handleUrlSubmit,
}) => (
  <form onSubmit={handleUrlSubmit} className="mb-4">
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        placeholder="Enter image URL"
        className="flex-grow p-2 border rounded"
      />
      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
      >
        Extract Colors
      </button>
    </div>
  </form>
);

export default ColorExtractor;

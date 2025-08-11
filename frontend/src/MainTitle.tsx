import appleImage from "./applev2.png";

interface MainTitleProps {
  name: string;
}

export default function MainTitle({ name }: MainTitleProps) {
  return (
    <>
      {/* Home Button fixed to top left */}
      <button
        onClick={() => window.location.reload()}
        className="fixed top-4 left-4 z-50 p-4 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors duration-200 group flex items-center justify-center shadow w-16 h-16"
        title="Go to Home"
      >
        {/* Home Icon SVG */}
        <svg 
          className="w-8 h-8" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 9.75L12 4l9 5.75M4.5 10.75V19a1 1 0 001 1h3.5a1 1 0 001-1v-4.25a1 1 0 011-1h2a1 1 0 011 1V19a1 1 0 001 1h3.5a1 1 0 001-1v-8.25" 
          />
        </svg>
      </button>

      <div className="mb-6 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <img
            src={appleImage}
            alt="Apple"
            className="w-20 h-20"
          />
          <h1 className="text-7xl font-bold text-red-500 drop-shadow-lg font-[Pacifico]">
            Fruitbox
          </h1>
          <h1 className="text-7xl font-bold text-green-500 drop-shadow-lg font-[Pacifico]">
            FSG
          </h1>
        </div>
        <p className="text-lg text-green-700 font-medium font-[Space Mono]">
          someone stop us 🙏
        </p>
      </div>

      {/* Player Name Display */}
      <div className="mb-6 text-center">
        <div className="inline-block bg-white px-6 py-3 rounded-full shadow-lg border-2 border-green-300">
          <p className="text-lg font-bold text-green-800">
            Hi, <span className="text-red-600">{name}</span>
          </p>
        </div>
      </div>
    </>
  );
} 
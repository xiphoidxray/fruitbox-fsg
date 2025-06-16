import appleImage from "./applev2.png";

interface MainTitleProps {
  name: string;
}

export default function MainTitle({ name }: MainTitleProps) {
  return (
    <>
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
            Multiplayer
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
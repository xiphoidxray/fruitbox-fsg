import appleImage from "./applev2.png"; // adjust path as needed
export default function GameEndPopup({ isOpen, onClose, myScore }: any) {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="rounded-3xl p-8 max-w-md w-full mx-4  text-center relative">
        {/* Apple with score on top */}
        <div className="relative">
          <img 
            src={appleImage} 
            alt="Apple" 
            className="w-64 h-64 mx-auto drop-shadow-lg"
          />
          {/* Score positioned on top of apple */}
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="text-8xl mt-6 font-bold text-white drop-shadow-lg">
              {myScore}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
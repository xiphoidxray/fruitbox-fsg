import { useState, useRef, useEffect } from "react";

interface ChatProps {
  chatMessages: { playerId: string; name: string; text: string }[];
  sendChatMessage: (text: string) => void;
}

export default function Chat({ chatMessages, sendChatMessage }: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleSend() {
    if (input.trim() === "") return;
    sendChatMessage(input.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p>No messages yet...</p>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="flex flex-col">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:bg-gray-100 transition-colors duration-150">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-blue-600">
                    {msg.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date().toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed break-words">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm transition-all duration-200"
            maxLength={200}
          />
          <button
            onClick={handleSend}
            disabled={input.trim() === ""}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200 text-sm min-w-[60px]"
          >
            Send
          </button>
        </div>
        
        {/* Character counter */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>Press Enter to send</span>
          <span>{input.length}/200</span>
        </div>
      </div>
    </div>
  );
}
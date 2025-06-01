import { useState } from "react";

interface ChatProps {
  chatMessages: { playerId: string; name: string; text: string }[];
  sendChatMessage: (text: string) => void;
}

export default function Chat({ chatMessages, sendChatMessage }: ChatProps) {
  const [input, setInput] = useState("");

  function handleSend() {
    if (input.trim() === "") return;
    sendChatMessage(input.trim());
    setInput("");
  }

  return (
    <div className="chat-container" style={{ border: "1px solid #ccc", padding: "10px", maxHeight: "200px", overflowY: "auto" }}>
      <div className="messages" style={{ marginBottom: "10px" }}>
        {chatMessages.map((msg, i) => (
          <div key={i}>
            <b>{msg.name}:</b> {msg.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSend()}
        placeholder="Type your message"
        style={{ width: "80%" }}
      />
      <button onClick={handleSend} style={{ width: "18%" }}>Send</button>
    </div>
  );
}

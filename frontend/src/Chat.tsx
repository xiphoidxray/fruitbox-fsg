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
    <div
      className="chat-container"
      style={{
        border: "1px solid #ccc",
        padding: "10px",
        width: "100%",
        height: "300px", // Fixed height
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="messages"
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: "10px",
        }}
      >
        {chatMessages.map((msg, i) => (
          <div key={i}>
            <b>{msg.name}:</b> {msg.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "4px" }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Type your message"
          style={{ flex: 1 }}
        />
        <button onClick={handleSend} style={{ width: "80px" }}>
          Send
        </button>
      </div>
    </div>
  );
}

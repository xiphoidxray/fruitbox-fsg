import { useEffect, useRef, useState } from "react";
import type {
  WsClientMsg,
  WsServerMsg,
  Player,
} from "./types/ws";
import toast from "react-hot-toast";

/**
 * Custom hook that:
 * - opens a WebSocket to ws://<host>/ws
 * - sends CreateRoom/JoinRoom/StartGame/ScoreUpdate/ReadyUp
 * - listens for RoomCreated, JoinedRoom, RoomPlayersUpdate, GameStarted,
 *   TimerTick, LeaderboardUpdate, Error
 */
export function useGameSocket(displayName: string) {
  const wsRef = useRef<WebSocket | null>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [board, setBoard] = useState<number[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [timer, setTimer] = useState(0);
  const [myId] = useState<string>(() => crypto.randomUUID());
  const [chatMessages, setChatMessages] = useState<
    { playerId: string; name: string; text: string }[]
  >([]);
  const [top10Scores, setTop10Scores] = useState<{ name: string; score: number }[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

useEffect(() => {
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsProtocol}://backend-fruitbox-fsg.onrender.com/ws`;

  const globalAny = window as any;

  // Create the global socket if it doesn't exist or is closed.
  if (!globalAny.__FRUITBOX_WS || globalAny.__FRUITBOX_WS.readyState === WebSocket.CLOSED) {
    const sock = new WebSocket(wsUrl);

    sock.addEventListener("open", () => {
      console.log("Global WebSocket connected");
    });

    sock.addEventListener("close", (ev) => {
      console.log("Global WebSocket closed", ev.code, ev.reason);
      globalAny.__FRUITBOX_WS = null;
    });

    sock.addEventListener("error", (ev) => {
      console.error("Global WebSocket error", ev);
    });

    globalAny.__FRUITBOX_WS = sock;
  }

  // Point our ref at the global socket
  wsRef.current = globalAny.__FRUITBOX_WS as WebSocket | null;

  // per-hook handlers (so multiple components/hooks won't step on each other)
  const onMessage = (ev: MessageEvent) => {
    try {
      const msg: WsServerMsg = JSON.parse(ev.data);
      console.log("Received message:", msg);

      switch (msg.type) {
        case "RoomCreated":
          setRoomId(msg.data.room_id);
          break;

        case "RoomPlayersUpdate":
          setRoomId(msg.data.room_id);
          setPlayers(msg.data.players);
          setOwnerId(msg.data.owner_id);
          break;

        case "GameStarted":
          setBoard(msg.data.board);
          setTimer(Number(msg.data.duration_secs));
          setScores({}); // keep previous behaviour: reset
          break;

        case "TimerTick":
          setTimer(Number(msg.data.remaining_secs));
          break;

        case "LeaderboardUpdate": {
          const newScores: Record<string, number> = {};
          msg.data.scores.forEach(([pid, sc]: [string, number]) => {
            newScores[pid] = sc;
          });
          setScores(newScores);
          break;
        }

        case "ChatBroadcast": {
          const { player, message } = msg.data;
          setChatMessages((prev) => [
            ...prev,
            { playerId: player.player_id, name: player.name, text: message },
          ]);
          break;
        }

        case "Error":
          toast.error(msg.data.msg);
          break;

        case "Top10Scores":
          setTop10Scores(
            msg.data.scores.map(([score, name]: [number, string]) => ({ name, score })),
          );
          break;

        default:
          console.warn("Unhandled server message type:", (msg as any).type);
      }
    } catch (e) {
      console.warn("Non-JSON message from server:", ev.data);
    }
  };

  const onOpen = () => {
    console.log("WebSocket connected (hook)");
  };
  const onClose = (ev: CloseEvent) => {
    console.log("WebSocket disconnected (hook)", ev.code, ev.reason);
  };

  if (wsRef.current) {
    wsRef.current.addEventListener("message", onMessage);
    wsRef.current.addEventListener("open", onOpen);
    wsRef.current.addEventListener("close", onClose);
  } else {
    console.warn("WebSocket not available when attaching handlers");
  }

  return () => {
    if (wsRef.current) {
      wsRef.current.removeEventListener("message", onMessage);
      wsRef.current.removeEventListener("open", onOpen);
      wsRef.current.removeEventListener("close", onClose);
    }
    wsRef.current = null;
  };
}, [displayName]);


  /** Send CreateRoom */
  function createRoom() {
    console.log("hook: createRoom() called, wsRef:", wsRef.current);
    if (!wsRef.current) { console.warn("hook: no wsRef.current"); return; }
    console.log("hook: readyState", wsRef.current.readyState);
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("hook: websocket not open, state:", wsRef.current.readyState);
      return;
    }

  const player: Player = { player_id: myId, name: displayName, ready: true };
  const m: WsClientMsg = { type: "CreateRoom", data: { player } };
  console.log("hook: sending CreateRoom", m);
  wsRef.current.send(JSON.stringify(m));
  }

  /** Send JoinRoom */
  function joinRoom(rid: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const player: Player = { player_id: myId, name: displayName, ready: false };
    const m: WsClientMsg = { type: "JoinRoom", data: { room_id: rid, player } };
    wsRef.current.send(JSON.stringify(m));
  }

  /** Send ReadyUp */
  function readyUp(ready: boolean) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const m: WsClientMsg = { type: "ReadyUp", data: { ready } };
    wsRef.current.send(JSON.stringify(m));
  }

  /** Send StartGame */
  function startGame() {
    if (!wsRef.current || !roomId) return;
    const m: WsClientMsg = { type: "StartGame", data: {} };
    wsRef.current.send(JSON.stringify(m));
  }

  /** Send ScoreUpdate */
  function reportScore(cleared: number) {
    console.log("Reporting score:", cleared);
    if (!wsRef.current || !roomId || !myId) return;
    const m: WsClientMsg = {
      type: "ScoreUpdate",
      data: {
        cleared_count: cleared,
      },
    };
    wsRef.current.send(JSON.stringify(m));
  }

  function sendChatMessage(text: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId) return;
    const m: WsClientMsg = {
      type: "ChatMessage",
      data: {
        message: text,
      },
    };
    wsRef.current.send(JSON.stringify(m));
  }

  return {
    roomId,
    players,
    board,
    scores,
    timer,
    myId,
    createRoom,
    joinRoom,
    readyUp, // Add readyUp to the returned object
    startGame,
    reportScore,
    chatMessages,
    sendChatMessage,
    top10Scores,
    ownerId,
  };
}
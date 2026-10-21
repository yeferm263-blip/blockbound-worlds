import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Plugin, ViteDevServer } from "vite";

interface RoomPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  swing: number;
  held: string | null;
  hp: number;
}

interface Room {
  code: string;
  seed: number;
  players: Map<string, RoomPlayer>;
  blockChanges: { x: number; y: number; z: number; id: number }[];
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(code: string, seed?: number): Room {
  const cleanCode = code.toUpperCase().trim();
  let r = rooms.get(cleanCode);
  if (!r) {
    r = {
      code: cleanCode,
      seed: seed ?? Math.floor(Math.random() * 1000000),
      players: new Map(),
      blockChanges: [],
    };
    rooms.set(cleanCode, r);
  }
  return r;
}

export function createMultiplayerWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    let currentRoom: Room | null = null;
    let playerId: string | null = null;
    let playerName = "Steve";

    ws.on("message", (raw: string | Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "join") {
          const roomCode = String(msg.room || "MAIN").toUpperCase().trim().slice(0, 10);
          playerName = String(msg.name || "Jugador").slice(0, 16);
          playerId = "p_" + Math.random().toString(36).slice(2, 8);

          currentRoom = getOrCreateRoom(roomCode, msg.seed);

          const player: RoomPlayer = {
            ws,
            id: playerId,
            name: playerName,
            pos: msg.pos || [0, 40, 0],
            yaw: msg.yaw || 0,
            pitch: msg.pitch || 0,
            swing: 0,
            held: null,
            hp: 20,
          };

          currentRoom.players.set(playerId, player);

          // Send confirmation + initial state
          const existingPlayers = Array.from(currentRoom.players.values())
            .filter((p) => p.id !== playerId)
            .map((p) => ({
              id: p.id,
              name: p.name,
              pos: p.pos,
              yaw: p.yaw,
              pitch: p.pitch,
              held: p.held,
              hp: p.hp,
            }));

          ws.send(
            JSON.stringify({
              type: "joined",
              id: playerId,
              room: currentRoom.code,
              seed: currentRoom.seed,
              blockChanges: currentRoom.blockChanges,
              players: existingPlayers,
            }),
          );

          // Broadcast join to others in the room
          const joinBroadcast = JSON.stringify({
            type: "player_joined",
            player: {
              id: playerId,
              name: playerName,
              pos: player.pos,
              yaw: player.yaw,
              pitch: player.pitch,
              held: null,
              hp: 20,
            },
          });

          for (const [otherId, other] of currentRoom.players) {
            if (otherId !== playerId && other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(joinBroadcast);
            }
          }
          return;
        }

        if (!currentRoom || !playerId) return;

        if (msg.type === "state") {
          const p = currentRoom.players.get(playerId);
          if (p) {
            p.pos = msg.pos;
            p.yaw = msg.yaw;
            p.pitch = msg.pitch;
            p.swing = msg.swing ?? 0;
            p.held = msg.held ?? null;
            p.hp = msg.hp ?? 20;

            const update = JSON.stringify({
              type: "player_update",
              id: playerId,
              pos: p.pos,
              yaw: p.yaw,
              pitch: p.pitch,
              swing: p.swing,
              held: p.held,
              hp: p.hp,
            });

            for (const [otherId, other] of currentRoom.players) {
              if (otherId !== playerId && other.ws.readyState === WebSocket.OPEN) {
                other.ws.send(update);
              }
            }
          }
        } else if (msg.type === "block_change") {
          currentRoom.blockChanges.push({
            x: msg.x,
            y: msg.y,
            z: msg.z,
            id: msg.id,
          });
          // Cap history at 5000 changes
          if (currentRoom.blockChanges.length > 5000) {
            currentRoom.blockChanges.shift();
          }

          const blockBroadcast = JSON.stringify({
            type: "block_change",
            x: msg.x,
            y: msg.y,
            z: msg.z,
            id: msg.id,
            by: playerId,
          });

          for (const [otherId, other] of currentRoom.players) {
            if (otherId !== playerId && other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(blockBroadcast);
            }
          }
        } else if (msg.type === "chat") {
          const chatBroadcast = JSON.stringify({
            type: "chat",
            from: playerName,
            text: msg.text,
          });

          for (const other of currentRoom.players.values()) {
            if (other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(chatBroadcast);
            }
          }
        }
      } catch (err) {
        console.error("Error handling multiplayer message:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoom && playerId) {
        currentRoom.players.delete(playerId);
        const leaveBroadcast = JSON.stringify({
          type: "player_left",
          id: playerId,
          name: playerName,
        });
        for (const other of currentRoom.players.values()) {
          if (other.ws.readyState === WebSocket.OPEN) {
            other.ws.send(leaveBroadcast);
          }
        }
        if (currentRoom.players.size === 0) {
          // Keep room for 15 minutes before cleanup
          setTimeout(() => {
            if (currentRoom && currentRoom.players.size === 0) {
              rooms.delete(currentRoom.code);
            }
          }, 900_000);
        }
      }
    });
  });

  return wss;
}

export function multiplayerPlugin(): Plugin {
  return {
    name: "voxelcraft-multiplayer",
    configureServer(server: ViteDevServer) {
      const wss = createMultiplayerWss();

      server.httpServer?.on("upgrade", (req: IncomingMessage, socket, head) => {
        if (req.url?.startsWith("/ws/multiplayer")) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
      });
    },
  };
}

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin, ViteDevServer, PreviewServer } from "vite";

interface RoomPlayer {
  ws?: WebSocket;
  id: string;
  name: string;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  swing: number;
  held: string | null;
  hp: number;
  lastSeen: number;
}

interface RoomEvent {
  id: number;
  type: "player_joined" | "player_left" | "block_change" | "chat";
  data: unknown;
}

interface Room {
  code: string;
  seed: number;
  players: Map<string, RoomPlayer>;
  blockChanges: { x: number; y: number; z: number; id: number; by?: string }[];
  events: RoomEvent[];
  eventCounter: number;
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
      events: [],
      eventCounter: 0,
    };
    rooms.set(cleanCode, r);
  }
  return r;
}

function pushRoomEvent(room: Room, type: RoomEvent["type"], data: unknown) {
  room.eventCounter++;
  const ev: RoomEvent = { id: room.eventCounter, type, data };
  room.events.push(ev);
  if (room.events.length > 500) {
    room.events.splice(0, room.events.length - 500);
  }
  return ev;
}

function broadcastToWsPlayers(room: Room, message: string, excludeId?: string) {
  for (const [id, p] of room.players) {
    if (id !== excludeId && p.ws && p.ws.readyState === WebSocket.OPEN) {
      try {
        p.ws.send(message);
      } catch {
        // Ignore WS send error
      }
    }
  }
}

export function createMultiplayerWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoom: Room | null = null;
    let playerId: string | null = null;
    let playerName = "Steve";

    ws.on("message", (raw: string | Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "join") {
          const roomCode = String(msg.room || "MAIN")
            .toUpperCase()
            .trim()
            .slice(0, 10);
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
            lastSeen: Date.now(),
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
          const joinPayload = {
            id: playerId,
            name: playerName,
            pos: player.pos,
            yaw: player.yaw,
            pitch: player.pitch,
            held: null,
            hp: 20,
          };
          pushRoomEvent(currentRoom, "player_joined", { player: joinPayload });
          broadcastToWsPlayers(
            currentRoom,
            JSON.stringify({ type: "player_joined", player: joinPayload }),
            playerId,
          );
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
            p.lastSeen = Date.now();

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

            broadcastToWsPlayers(currentRoom, update, playerId);
          }
        } else if (msg.type === "block_change") {
          const change = {
            x: msg.x,
            y: msg.y,
            z: msg.z,
            id: msg.id,
            by: playerId,
          };
          currentRoom.blockChanges.push(change);
          if (currentRoom.blockChanges.length > 5000) {
            currentRoom.blockChanges.splice(0, currentRoom.blockChanges.length - 5000);
          }

          pushRoomEvent(currentRoom, "block_change", change);
          broadcastToWsPlayers(
            currentRoom,
            JSON.stringify({
              type: "block_change",
              x: msg.x,
              y: msg.y,
              z: msg.z,
              id: msg.id,
              by: playerId,
            }),
            playerId,
          );
        } else if (msg.type === "chat") {
          const text = String(msg.text || "").slice(0, 120);
          pushRoomEvent(currentRoom, "chat", { from: playerName, text });
          broadcastToWsPlayers(
            currentRoom,
            JSON.stringify({
              type: "chat",
              from: playerName,
              text,
            }),
          );
        }
      } catch (err) {
        console.error("Error handling multiplayer message:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoom && playerId) {
        currentRoom.players.delete(playerId);
        pushRoomEvent(currentRoom, "player_left", { id: playerId, name: playerName });
        broadcastToWsPlayers(
          currentRoom,
          JSON.stringify({
            type: "player_left",
            id: playerId,
            name: playerName,
          }),
        );
        if (currentRoom.players.size === 0) {
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

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

export function attachHttpApi(middlewares: {
  use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
}) {
  middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || "";
    if (!url.startsWith("/api/multiplayer")) {
      return next();
    }

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (url === "/api/multiplayer/join" && req.method === "POST") {
        const body = await parseBody(req);
        const roomCode = String(body.room || "MAIN")
          .toUpperCase()
          .trim()
          .slice(0, 10);
        const playerName = String(body.name || "Jugador").slice(0, 16);
        const playerId = "p_" + Math.random().toString(36).slice(2, 8);

        const currentRoom = getOrCreateRoom(roomCode, body.seed);

        const player: RoomPlayer = {
          id: playerId,
          name: playerName,
          pos: body.pos || [0, 40, 0],
          yaw: body.yaw || 0,
          pitch: body.pitch || 0,
          swing: 0,
          held: null,
          hp: 20,
          lastSeen: Date.now(),
        };

        currentRoom.players.set(playerId, player);

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

        const joinPayload = {
          id: playerId,
          name: playerName,
          pos: player.pos,
          yaw: player.yaw,
          pitch: player.pitch,
          held: null,
          hp: 20,
        };
        pushRoomEvent(currentRoom, "player_joined", { player: joinPayload });
        broadcastToWsPlayers(
          currentRoom,
          JSON.stringify({ type: "player_joined", player: joinPayload }),
          playerId,
        );

        sendJson(res, 200, {
          ok: true,
          id: playerId,
          room: currentRoom.code,
          seed: currentRoom.seed,
          blockChanges: currentRoom.blockChanges,
          players: existingPlayers,
          lastEventId: currentRoom.eventCounter,
        });
        return;
      }

      if (url === "/api/multiplayer/sync" && req.method === "POST") {
        const body = await parseBody(req);
        const roomCode = String(body.room || "")
          .toUpperCase()
          .trim();
        const playerId = String(body.playerId || "");
        const currentRoom = rooms.get(roomCode);

        if (!currentRoom) {
          sendJson(res, 404, { ok: false, error: "room_not_found" });
          return;
        }

        let player = currentRoom.players.get(playerId);
        if (!player) {
          player = {
            id: playerId,
            name: String(body.name || "Jugador").slice(0, 16),
            pos: body.pos || [0, 40, 0],
            yaw: body.yaw || 0,
            pitch: body.pitch || 0,
            swing: body.swing ?? 0,
            held: body.held ?? null,
            hp: body.hp ?? 20,
            lastSeen: Date.now(),
          };
          currentRoom.players.set(playerId, player);
        } else {
          if (body.pos) player.pos = body.pos;
          if (body.yaw !== undefined) player.yaw = body.yaw;
          if (body.pitch !== undefined) player.pitch = body.pitch;
          player.swing = body.swing ?? 0;
          player.held = body.held ?? null;
          player.hp = body.hp ?? 20;
          player.lastSeen = Date.now();
        }

        // Apply any block changes submitted by this player
        if (Array.isArray(body.blockChanges)) {
          for (const bc of body.blockChanges) {
            const change = {
              x: bc.x,
              y: bc.y,
              z: bc.z,
              id: bc.id,
              by: playerId,
            };
            currentRoom.blockChanges.push(change);
            pushRoomEvent(currentRoom, "block_change", change);
            broadcastToWsPlayers(
              currentRoom,
              JSON.stringify({ type: "block_change", ...change }),
              playerId,
            );
          }
          if (currentRoom.blockChanges.length > 5000) {
            currentRoom.blockChanges.splice(0, currentRoom.blockChanges.length - 5000);
          }
        }

        // Apply any chat messages submitted by this player
        if (Array.isArray(body.chats)) {
          for (const text of body.chats) {
            const cleanText = String(text || "").slice(0, 120);
            pushRoomEvent(currentRoom, "chat", { from: player.name, text: cleanText });
            broadcastToWsPlayers(
              currentRoom,
              JSON.stringify({ type: "chat", from: player.name, text: cleanText }),
            );
          }
        }

        // Cleanup stale players (inactive for > 15 seconds)
        const now = Date.now();
        for (const [id, p] of currentRoom.players) {
          if (!p.ws && now - p.lastSeen > 15000) {
            currentRoom.players.delete(id);
            pushRoomEvent(currentRoom, "player_left", { id, name: p.name });
            broadcastToWsPlayers(
              currentRoom,
              JSON.stringify({ type: "player_left", id, name: p.name }),
            );
          }
        }

        const otherPlayers = Array.from(currentRoom.players.values())
          .filter((p) => p.id !== playerId)
          .map((p) => ({
            id: p.id,
            name: p.name,
            pos: p.pos,
            yaw: p.yaw,
            pitch: p.pitch,
            swing: p.swing,
            held: p.held,
            hp: p.hp,
          }));

        const lastEv = Number(body.lastEventId ?? 0);
        const newEvents = currentRoom.events.filter((e) => e.id > lastEv);

        sendJson(res, 200, {
          ok: true,
          players: otherPlayers,
          events: newEvents,
          lastEventId: currentRoom.eventCounter,
        });
        return;
      }

      if (url === "/api/multiplayer/leave" && req.method === "POST") {
        const body = await parseBody(req);
        const roomCode = String(body.room || "")
          .toUpperCase()
          .trim();
        const playerId = String(body.playerId || "");
        const currentRoom = rooms.get(roomCode);

        if (currentRoom) {
          const p = currentRoom.players.get(playerId);
          const name = p?.name || "Jugador";
          currentRoom.players.delete(playerId);
          pushRoomEvent(currentRoom, "player_left", { id: playerId, name });
          broadcastToWsPlayers(
            currentRoom,
            JSON.stringify({ type: "player_left", id: playerId, name }),
          );
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { ok: false, error: "endpoint_not_found" });
    } catch (err: unknown) {
      console.error("Multiplayer API error:", err);
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : "internal_error",
      });
    }
  });
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

      attachHttpApi(server.middlewares);
    },
    configurePreviewServer(server: PreviewServer) {
      const wss = createMultiplayerWss();

      server.httpServer?.on("upgrade", (req: IncomingMessage, socket, head) => {
        if (req.url?.startsWith("/ws/multiplayer")) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
      });

      attachHttpApi(server.middlewares);
    },
  };
}

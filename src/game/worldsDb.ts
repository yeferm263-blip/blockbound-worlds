import type { Slot } from "./engine";

export interface WorldRecord {
  id: string;
  name: string;
  seed: number;
  gameMode: "survival" | "creative";
  lastPlayed: number;
  created: number;
  size: string;
  thumbnailDataUrl?: string;
  worldData: {
    playerPos: [number, number, number];
    playerYaw: number;
    playerPitch: number;
    inventory: Slot[];
    hp: number;
    food: number;
    time: number;
    day: number;
    modifiedBlocks: { x: number; y: number; z: number; id: number }[];
  };
}

const DB_NAME = "voxelcraft_db";
const DB_VERSION = 1;
const STORE_NAME = "worlds";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function calculateSize(record: WorldRecord): string {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(record)).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return "12 KB";
  }
}

export async function getAllWorlds(): Promise<WorldRecord[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: WorldRecord[] = req.result || [];
        list.sort((a, b) => b.lastPlayed - a.lastPlayed);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to get worlds from IndexedDB:", err);
    return [];
  }
}

export async function getWorld(id: string): Promise<WorldRecord | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to get world:", err);
    return undefined;
  }
}

export async function saveWorld(world: WorldRecord): Promise<void> {
  try {
    world.size = calculateSize(world);
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(world);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to save world:", err);
  }
}

export async function deleteWorld(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete world:", err);
  }
}

export function createNewWorldRecord(
  name: string,
  gameMode: "survival" | "creative" = "survival",
  customSeed?: number,
): WorldRecord {
  const now = Date.now();
  const seed =
    customSeed !== undefined && !isNaN(customSeed) ? customSeed : Math.floor(Math.random() * 1e9);

  const initialInventory: Slot[] = Array(36).fill(null);
  if (gameMode === "creative") {
    initialInventory[0] = { id: "wooden_pickaxe", count: 1 };
    initialInventory[1] = { id: "wooden_sword", count: 1 };
    initialInventory[2] = { id: "b1", count: 64 }; // Stone
    initialInventory[3] = { id: "b2", count: 64 }; // Dirt
    initialInventory[4] = { id: "b4", count: 64 }; // Wood Planks
    initialInventory[5] = { id: "b5", count: 64 }; // Wood Log
    initialInventory[6] = { id: "b7", count: 64 }; // Glass
  } else {
    // Survival starter item
    initialInventory[0] = { id: "wooden_pickaxe", count: 1, durability: 59 };
    initialInventory[1] = { id: "apple", count: 4 };
  }

  const record: WorldRecord = {
    id: `world_${now}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "Mi mundo",
    seed,
    gameMode,
    lastPlayed: now,
    created: now,
    size: "8 KB",
    worldData: {
      playerPos: [0, 0, 0],
      playerYaw: 0,
      playerPitch: 0,
      inventory: initialInventory,
      hp: 20,
      food: 20,
      time: 0.3,
      day: 1,
      modifiedBlocks: [],
    },
  };

  record.size = calculateSize(record);
  return record;
}

export async function ensureDefaultWorld(): Promise<WorldRecord> {
  const worlds = await getAllWorlds();
  if (worlds.length > 0) {
    return worlds[0];
  }
  const defaultWorld = createNewWorldRecord("Mundo de Supervivencia", "survival", 123456);
  await saveWorld(defaultWorld);
  return defaultWorld;
}

export function exportWorldJson(world: WorldRecord) {
  const json = JSON.stringify(world, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${world.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_backup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importWorldJson(jsonString: string): Promise<WorldRecord> {
  const parsed = JSON.parse(jsonString) as Partial<WorldRecord>;
  if (!parsed.name || parsed.seed === undefined) {
    throw new Error("El archivo no tiene el formato de mundo de VoxelCraft válido.");
  }
  const now = Date.now();
  const world: WorldRecord = {
    id: `world_${now}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${parsed.name} (Importado)`,
    seed: Number(parsed.seed) || Math.floor(Math.random() * 1e9),
    gameMode: parsed.gameMode === "creative" ? "creative" : "survival",
    lastPlayed: now,
    created: now,
    size: "10 KB",
    thumbnailDataUrl: parsed.thumbnailDataUrl,
    worldData: {
      playerPos: parsed.worldData?.playerPos || [0, 0, 0],
      playerYaw: parsed.worldData?.playerYaw || 0,
      playerPitch: parsed.worldData?.playerPitch || 0,
      inventory: parsed.worldData?.inventory || Array(36).fill(null),
      hp: parsed.worldData?.hp ?? 20,
      food: parsed.worldData?.food ?? 20,
      time: parsed.worldData?.time ?? 0.3,
      day: parsed.worldData?.day ?? 1,
      modifiedBlocks: parsed.worldData?.modifiedBlocks || [],
    },
  };
  await saveWorld(world);
  return world;
}

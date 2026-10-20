// Block + item definitions. Texture indices refer to public/textures/atlas.png (8x4 grid of 32px tiles, built from the user-supplied Faithful 32x pack; unused slots keep Kenney CC0 tiles).
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 16; // rows 0-3 Kenney atlas, rows 4+ custom tiles (see textures.ts)

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6, PLANKS: 7, SAND: 8,
  COAL_ORE: 9, IRON_ORE: 10, GOLD_ORE: 11, DIAMOND_ORE: 12, GLASS: 13, BRICK: 14, TABLE: 15,
  FURNACE: 16, WATER: 17, BEDROCK: 18, SNOW: 19, CACTUS: 20, GRAVEL: 21, BIRCH_LOG: 22, WOOL: 23, ICE: 24,
} as const;

export type Tool = "pickaxe" | "axe" | "shovel" | "sword" | null;

export interface BlockDef {
  name: string;
  tex: [number, number, number]; // top, side, bottom
  hardness: number; // seconds by hand
  tool: Tool;
  minTier?: number; // required pickaxe tier (1 wood, 2 stone, 3 iron)
  drop?: string | null; // item id dropped, null = nothing
  transparent?: boolean;
  liquid?: boolean;
  solid?: boolean;
}

export const BLOCKS: Record<number, BlockDef> = {
  1: { name: "Bloque de césped", tex: [0, 1, 2], hardness: 0.9, tool: "shovel", drop: "b2" },
  2: { name: "Tierra", tex: [2, 2, 2], hardness: 0.75, tool: "shovel" },
  3: { name: "Piedra", tex: [3, 3, 3], hardness: 3, tool: "pickaxe", minTier: 1, drop: "b4" },
  4: { name: "Roca", tex: [4, 4, 4], hardness: 3.5, tool: "pickaxe", minTier: 1 },
  5: { name: "Tronco de roble", tex: [5, 6, 5], hardness: 2.5, tool: "axe" },
  6: { name: "Hojas", tex: [7, 7, 7], hardness: 0.3, tool: null, drop: null, transparent: true },
  7: { name: "Tablones", tex: [8, 8, 8], hardness: 2, tool: "axe" },
  8: { name: "Arena", tex: [9, 9, 9], hardness: 0.75, tool: "shovel" },
  9: { name: "Mena de carbón", tex: [10, 10, 10], hardness: 4, tool: "pickaxe", minTier: 1, drop: "coal" },
  10: { name: "Mena de hierro", tex: [11, 11, 11], hardness: 4.5, tool: "pickaxe", minTier: 2 },
  11: { name: "Mena de oro", tex: [12, 12, 12], hardness: 4.5, tool: "pickaxe", minTier: 3 },
  12: { name: "Mena de diamante", tex: [13, 13, 13], hardness: 5, tool: "pickaxe", minTier: 3, drop: "diamond" },
  13: { name: "Cristal", tex: [14, 14, 14], hardness: 0.4, tool: null, drop: null, transparent: true },
  14: { name: "Ladrillos", tex: [15, 15, 15], hardness: 4, tool: "pickaxe", minTier: 1 },
  15: { name: "Mesa de trabajo", tex: [8, 16, 8], hardness: 2.5, tool: "axe" },
  16: { name: "Horno", tex: [4, 17, 4], hardness: 3.5, tool: "pickaxe", minTier: 1 },
  17: { name: "Agua", tex: [18, 18, 18], hardness: Infinity, tool: null, drop: null, transparent: true, liquid: true },
  18: { name: "Lecho de roca", tex: [19, 19, 19], hardness: Infinity, tool: null, drop: null },
  19: { name: "Nieve", tex: [20, 21, 2], hardness: 0.9, tool: "shovel", drop: "b2" },
  20: { name: "Cactus", tex: [22, 23, 22], hardness: 0.6, tool: null },
  21: { name: "Grava", tex: [24, 24, 24], hardness: 0.9, tool: "shovel" },
  22: { name: "Tronco de abedul", tex: [27, 26, 27], hardness: 2.5, tool: "axe" },
  23: { name: "Lana", tex: [28, 28, 28], hardness: 1.2, tool: null },
  24: { name: "Hielo", tex: [30, 30, 30], hardness: 0.7, tool: "pickaxe", drop: null, transparent: true },
};

export interface ItemDef {
  name: string;
  block?: number; // placeable block
  icon?: string; // emoji/pixel icon for non-block items
  color?: string;
  tool?: Tool;
  tier?: number;
  damage?: number;
  food?: number;
  stack?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  stick: { name: "Palo", icon: "stick", color: "#8a5a2b" },
  coal: { name: "Carbón", icon: "gem", color: "#222" },
  iron_ingot: { name: "Lingote de hierro", icon: "ingot", color: "#d8d8d8" },
  gold_ingot: { name: "Lingote de oro", icon: "ingot", color: "#f5c542" },
  diamond: { name: "Diamante", icon: "gem", color: "#4ee6e0" },
  wood_pickaxe: { name: "Pico de madera", icon: "pickaxe", color: "#a0723c", tool: "pickaxe", tier: 1, damage: 2, stack: 1 },
  stone_pickaxe: { name: "Pico de piedra", icon: "pickaxe", color: "#8d8d8d", tool: "pickaxe", tier: 2, damage: 3, stack: 1 },
  iron_pickaxe: { name: "Pico de hierro", icon: "pickaxe", color: "#e6e6e6", tool: "pickaxe", tier: 3, damage: 4, stack: 1 },
  diamond_pickaxe: { name: "Pico de diamante", icon: "pickaxe", color: "#4ee6e0", tool: "pickaxe", tier: 4, damage: 5, stack: 1 },
  wood_axe: { name: "Hacha de madera", icon: "axe", color: "#a0723c", tool: "axe", tier: 1, damage: 3, stack: 1 },
  stone_axe: { name: "Hacha de piedra", icon: "axe", color: "#8d8d8d", tool: "axe", tier: 2, damage: 4, stack: 1 },
  wood_shovel: { name: "Pala de madera", icon: "shovel", color: "#a0723c", tool: "shovel", tier: 1, damage: 1, stack: 1 },
  stone_shovel: { name: "Pala de piedra", icon: "shovel", color: "#8d8d8d", tool: "shovel", tier: 2, damage: 2, stack: 1 },
  wood_sword: { name: "Espada de madera", icon: "sword", color: "#a0723c", tool: "sword", tier: 1, damage: 4, stack: 1 },
  stone_sword: { name: "Espada de piedra", icon: "sword", color: "#8d8d8d", tool: "sword", tier: 2, damage: 5, stack: 1 },
  iron_sword: { name: "Espada de hierro", icon: "sword", color: "#e6e6e6", tool: "sword", tier: 3, damage: 6, stack: 1 },
  diamond_sword: { name: "Espada de diamante", icon: "sword", color: "#4ee6e0", tool: "sword", tier: 4, damage: 7, stack: 1 },
  raw_pork: { name: "Chuleta cruda", icon: "meat", color: "#f19aa0", food: 3 },
  cooked_pork: { name: "Chuleta cocinada", icon: "meat", color: "#b5651d", food: 8 },
  raw_beef: { name: "Filete crudo", icon: "meat", color: "#d0453a", food: 3 },
  steak: { name: "Filete", icon: "meat", color: "#7a3b1a", food: 8 },
  raw_chicken: { name: "Pollo crudo", icon: "meat", color: "#f5d0b5", food: 2 },
  cooked_chicken: { name: "Pollo asado", icon: "meat", color: "#c98a3a", food: 6 },
  leather: { name: "Cuero", icon: "sheet", color: "#8b4a24" },
  feather: { name: "Pluma", icon: "stick", color: "#ffffff" },
  rotten_flesh: { name: "Carne podrida", icon: "meat", color: "#6b7d2e", food: 2 },
  bone: { name: "Hueso", icon: "stick", color: "#eeeadb" },
  gunpowder: { name: "Pólvora", icon: "dust", color: "#555" },
  string: { name: "Hilo", icon: "stick", color: "#f0f0f0" },
  apple: { name: "Manzana", icon: "gem", color: "#d22", food: 4 },
};
// Every block is also an item "b<ID>"
for (const [id, def] of Object.entries(BLOCKS)) ITEMS["b" + id] = { name: def.name, block: Number(id) };

export const blockDrop = (id: number): string | null => {
  const d = BLOCKS[id];
  if (!d) return null;
  if (d.drop === null) return null;
  return d.drop ?? "b" + id;
};

export const isSolid = (id: number) => id !== 0 && !BLOCKS[id]?.liquid;
export const isOpaque = (id: number) => id !== 0 && !BLOCKS[id]?.transparent;

export interface Recipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  station?: "table" | "furnace";
}

export const RECIPES: Recipe[] = [
  { out: "b7", count: 4, needs: { b5: 1 } },
  { out: "b7", count: 4, needs: { b22: 1 } },
  { out: "stick", count: 4, needs: { b7: 2 } },
  { out: "b15", count: 1, needs: { b7: 4 } },
  { out: "wood_pickaxe", count: 1, needs: { b7: 3, stick: 2 }, station: "table" },
  { out: "wood_axe", count: 1, needs: { b7: 3, stick: 2 }, station: "table" },
  { out: "wood_shovel", count: 1, needs: { b7: 1, stick: 2 }, station: "table" },
  { out: "wood_sword", count: 1, needs: { b7: 2, stick: 1 }, station: "table" },
  { out: "stone_pickaxe", count: 1, needs: { b4: 3, stick: 2 }, station: "table" },
  { out: "stone_axe", count: 1, needs: { b4: 3, stick: 2 }, station: "table" },
  { out: "stone_shovel", count: 1, needs: { b4: 1, stick: 2 }, station: "table" },
  { out: "stone_sword", count: 1, needs: { b4: 2, stick: 1 }, station: "table" },
  { out: "b16", count: 1, needs: { b4: 8 }, station: "table" },
  { out: "iron_pickaxe", count: 1, needs: { iron_ingot: 3, stick: 2 }, station: "table" },
  { out: "iron_sword", count: 1, needs: { iron_ingot: 2, stick: 1 }, station: "table" },
  { out: "diamond_pickaxe", count: 1, needs: { diamond: 3, stick: 2 }, station: "table" },
  { out: "diamond_sword", count: 1, needs: { diamond: 2, stick: 1 }, station: "table" },
  { out: "b23", count: 1, needs: { string: 4 }, station: "table" },
  { out: "b14", count: 1, needs: { b4: 2, b2: 2 }, station: "table" },
  { out: "iron_ingot", count: 1, needs: { b10: 1, coal: 1 }, station: "furnace" },
  { out: "gold_ingot", count: 1, needs: { b11: 1, coal: 1 }, station: "furnace" },
  { out: "b13", count: 1, needs: { b8: 1, coal: 1 }, station: "furnace" },
  { out: "b3", count: 1, needs: { b4: 1, coal: 1 }, station: "furnace" },
  { out: "cooked_pork", count: 1, needs: { raw_pork: 1, coal: 1 }, station: "furnace" },
  { out: "steak", count: 1, needs: { raw_beef: 1, coal: 1 }, station: "furnace" },
  { out: "cooked_chicken", count: 1, needs: { raw_chicken: 1, coal: 1 }, station: "furnace" },
];

/** Seconds to break a block with the given held item, or Infinity when impossible. Returns also if it drops. */
export function breakInfo(blockId: number, held: string | null): { time: number; drops: boolean } {
  const b = BLOCKS[blockId];
  if (!b || b.hardness === Infinity) return { time: Infinity, drops: false };
  const it = held ? ITEMS[held] : undefined;
  const rightTool = !!b.tool && it?.tool === b.tool;
  const tier = rightTool ? it?.tier ?? 0 : 0;
  const speed = rightTool ? 1 + tier * 1.5 : 1;
  let time = b.hardness / speed;
  let drops = true;
  if (b.minTier) {
    if (b.tool === "pickaxe" && tier < b.minTier) { drops = false; time = b.hardness * 2.5; }
  }
  return { time: Math.max(0.05, time), drops };
}

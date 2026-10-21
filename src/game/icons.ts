// Pixel-art icons for non-block items, drawn procedurally to a canvas (no external assets).
import { ITEMS } from "./blocks";

const P: Record<string, string[]> = {
  stick: [
    ".......c",
    "......c.",
    ".....c..",
    "....c...",
    "...c....",
    "..c.....",
    ".c......",
    "c.......",
  ],
  pickaxe: [
    ".cccccc.",
    "cdc..cdc",
    "c..hh..c",
    "...hh...",
    "...hh...",
    "...hh...",
    "...hh...",
    "...hh...",
  ],
  sword: [
    "......cc",
    ".....cdc",
    "....cdc.",
    "...cdc..",
    "h.cdc...",
    ".hc.....",
    ".hh.....",
    "h..h....",
  ],
  axe: [
    "...cc...",
    "..ccccc.",
    "..cdch..",
    "....h...",
    "...h....",
    "..h.....",
    ".h......",
    "h.......",
  ],
  shovel: [
    "......cc",
    ".....cdc",
    "....hcc.",
    "...h....",
    "..h.....",
    ".h......",
    "h.......",
    "........",
  ],
  gem: [
    "........",
    "..cccc..",
    ".cddddc.",
    "cddccddc",
    ".cddddc.",
    "..cddc..",
    "...cc...",
    "........",
  ],
  ingot: [
    "........",
    "........",
    "..cccccc",
    ".cddddcc",
    "cddddcc.",
    "ccccccc.",
    "........",
    "........",
  ],
  meat: [
    "........",
    "..cccc..",
    ".cccccc.",
    "cccddccw",
    ".cccccw.",
    "..ccc.ww",
    "........",
    "........",
  ],
  sheet: [
    ".cccccc.",
    "cddddddc",
    "cdcdcdcc",
    "cddddddc",
    "cdcdcdcc",
    "cddddddc",
    ".cccccc.",
    "........",
  ],
  dust: [
    "........",
    "...c....",
    "..cdc.c.",
    ".cdddcdc",
    "cdddddc.",
    "........",
    "........",
    "........",
  ],
};

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1).padEnd(6, hex.slice(1)), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k),
    g = Math.min(255, ((n >> 8) & 255) * k),
    b = Math.min(255, (n & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const cache = new Map<string, HTMLCanvasElement>();
export function itemCanvas(id: string): HTMLCanvasElement {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = ITEMS[id];
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const pat = P[def?.icon ?? "gem"] ?? P["gem"];
  const col = def?.color ?? "#888";
  const full =
    col.length === 4
      ? "#" +
        col
          .slice(1)
          .split("")
          .map((x) => x + x)
          .join("")
      : col;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const ch = pat[y][x];
      if (ch === ".") continue;
      g.fillStyle =
        ch === "h" ? "#6b4423" : ch === "w" ? "#f2efe6" : ch === "d" ? shade(full, 0.7) : full;
      g.fillRect(x * 4, y * 4, 4, 4);
    }
  cache.set(id, c);
  return c;
}

export function itemIconURL(id: string) {
  return itemCanvas(id).toDataURL();
}

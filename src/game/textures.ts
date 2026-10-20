// Custom block textures uploaded by the player (/admin). Stored in localStorage as 16x16 PNG data URLs.
// The runtime atlas = original Kenney atlas (rows 0-3) + custom tiles in rows 4+ (slot 32 + id*2 top, +1 side).
import { BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./blocks";

export interface CustomTex { top?: string; side?: string }
const KEY = "voxelcraft.customTextures";
const BASE_ROWS = 4;
const ORIG: Record<number, [number, number, number]> = {};
for (const [id, d] of Object.entries(BLOCKS)) ORIG[Number(id)] = [...d.tex] as [number, number, number];

export function loadCustom(): Record<number, CustomTex> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function saveCustom(id: number, t: CustomTex | null) {
  const all = loadCustom();
  if (!t || (!t.top && !t.side)) delete all[id]; else all[id] = t;
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function originalTex(id: number) { return ORIG[id]; }

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/** Resize any uploaded image to a 16x16 pixel-art tile data URL. */
export async function fileToTile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const c = document.createElement("canvas"); c.width = c.height = 16;
    const g = c.getContext("2d")!; g.imageSmoothingEnabled = img.width > 64;
    const s = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 16, 16);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

let baseImg: HTMLImageElement | null = null;
/** Build the atlas canvas and rewrite BLOCKS[*].tex to point at custom slots. */
export async function buildAtlas(): Promise<HTMLCanvasElement> {
  baseImg ??= await loadImg("/textures/atlas.png");
  const T = Math.round(baseImg.width / ATLAS_COLS);
  const c = document.createElement("canvas");
  c.width = T * ATLAS_COLS; c.height = T * ATLAS_ROWS;
  const g = c.getContext("2d")!; g.imageSmoothingEnabled = false;
  g.drawImage(baseImg, 0, 0, T * ATLAS_COLS, T * BASE_ROWS);
  const custom = loadCustom();
  for (const idStr of Object.keys(BLOCKS)) {
    const id = Number(idStr);
    const o = ORIG[id], t = custom[id];
    const tex: [number, number, number] = [...o];
    if (t) {
      const slotTop = BASE_ROWS * ATLAS_COLS + id * 2, slotSide = slotTop + 1;
      const draw = async (src: string, slot: number) => {
        const im = await loadImg(src);
        g.drawImage(im, (slot % ATLAS_COLS) * T, Math.floor(slot / ATLAS_COLS) * T, T, T);
      };
      if (t.side) { await draw(t.side, slotSide); tex[1] = slotSide; tex[2] = slotSide; }
      if (t.top) { await draw(t.top, slotTop); tex[0] = slotTop; }
      else if (t.side) tex[0] = slotSide;
    }
    BLOCKS[id].tex = tex;
  }
  document.documentElement.style.setProperty("--atlas-url", `url(${c.toDataURL()})`);
  return c;
}

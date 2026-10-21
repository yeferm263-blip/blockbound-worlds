import type { CSSProperties } from "react";
import atlas from "@/assets/faithful.png.asset.json";
import pack from "@/game/packs/faithful.json";

const rects: Record<string, number[]> = pack.rects;

/** Crop a packed sprite without stretching neighbouring atlas tiles. */
export function PackSprite({ name, width, height, className = "" }: { name: string; width?: number; height?: number; className?: string }) {
  const rect = rects[name];
  if (!rect) return null;
  const [x, y, w, h] = rect;
  const sx = (width ?? w) / w, sy = (height ?? h) / h;
  const style: CSSProperties = {
    width: width ?? w, height: height ?? h,
    backgroundImage: `url(${atlas.url})`,
    backgroundSize: `${pack.width * sx}px ${pack.height * sy}px`,
    backgroundPosition: `${-x * sx}px ${-y * sy}px`,
  };
  return <span aria-hidden="true" className={`mc-pack-sprite ${className}`} style={style} />;
}

export function packItemName(id: string) {
  const aliases: Record<string, string> = { raw_pork: "porkchop", cooked_pork: "cooked_porkchop", raw_beef: "beef", steak: "cooked_beef", raw_chicken: "chicken" };
  const name = `item/${aliases[id] ?? id.replace(/^wood_/, "wooden_")}`;
  return rects[name] ? name : null;
}
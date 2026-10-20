import { describe, it, expect } from "vitest";
import { breakInfo, blockDrop, B } from "../blocks";

describe("block rules", () => {
  it("stone mined by hand drops nothing", () => expect(breakInfo(B.STONE, null).drops).toBe(false));
  it("stone mined with wooden pickaxe drops cobblestone", () => {
    expect(breakInfo(B.STONE, "wood_pickaxe").drops).toBe(true);
    expect(blockDrop(B.STONE)).toBe("b4");
  });
  it("iron ore needs stone pickaxe", () => {
    expect(breakInfo(B.IRON_ORE, "wood_pickaxe").drops).toBe(false);
    expect(breakInfo(B.IRON_ORE, "stone_pickaxe").drops).toBe(true);
  });
  it("diamond ore needs iron pickaxe and drops diamond", () => {
    expect(breakInfo(B.DIAMOND_ORE, "stone_pickaxe").drops).toBe(false);
    expect(breakInfo(B.DIAMOND_ORE, "iron_pickaxe").drops).toBe(true);
    expect(blockDrop(B.DIAMOND_ORE)).toBe("diamond");
  });
  it("bedrock is unbreakable", () => expect(breakInfo(B.BEDROCK, "diamond_pickaxe").time).toBe(Infinity));
});

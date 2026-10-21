import { describe, expect, it } from "vitest";
import { matchGrid } from "../engine";

const put = (ids: (string | null)[]) => ids.map((id) => (id ? { id, count: 1 } : null));

describe("crafting grid", () => {
  it("4 planks in the 2x2 inventory grid make a crafting table", () => {
    expect(matchGrid(put(["b7", "b7", "b7", "b7", null, null, null, null, null]), null)?.out).toBe(
      "b15",
    );
  });
  it("a pickaxe needs the 3x3 crafting table", () => {
    const g = put(["b7", "b7", "b7", null, "stick", null, null, "stick", null]);
    expect(matchGrid(g, null)).toBeNull();
    expect(matchGrid(g, "table")?.out).toBe("wood_pickaxe");
  });
  it("furnace needs coal as fuel", () => {
    expect(matchGrid(put(["b10", "coal"]), "furnace")?.out).toBe("iron_ingot");
    expect(matchGrid(put(["b10", "stick"]), "furnace")).toBeNull();
  });
});

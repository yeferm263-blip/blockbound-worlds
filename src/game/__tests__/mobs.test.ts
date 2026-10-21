import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { animateMobGait, buildMob, type MobType } from "../mobs";

vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());

describe("attached animal limbs", () => {
  for (const type of [
    "pig",
    "cow",
    "sheep",
    "chicken",
    "creeper",
    "zombie",
    "skeleton",
  ] as MobType[]) {
    it(`${type} hip joints remain inside its torso throughout walking`, () => {
      const model = buildMob(type);
      if (!model.body) throw new Error("Missing body");
      for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        model.root.position.y = animateMobGait(model, type, phase, 1, phase);
        model.root.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(model.body).expandByScalar(0.00001);
        for (const leg of model.legs)
          expect(bounds.containsPoint(leg.getWorldPosition(new THREE.Vector3()))).toBe(true);
      }
    });
  }
  for (const type of ["pig", "cow", "sheep", "creeper"] as MobType[]) {
    it(`${type} legs overlap into the torso so no gap shows at the hip`, () => {
      const model = buildMob(type);
      model.root.updateWorldMatrix(true, true);
      const body = new THREE.Box3().setFromObject(model.body!);
      for (const leg of model.legs) {
        const legBox = new THREE.Box3().setFromObject(leg.children[0]);
        expect(legBox.max.y).toBeGreaterThan(body.min.y + 1 / 16);
      }
    });
  }
  it("pig walks with opposite diagonal pairs without moving its torso independently", () => {
    const model = buildMob("pig");
    const y = model.body?.position.y;
    animateMobGait(model, "pig", Math.PI / 2, 1, 0);
    expect(model.legs.map((leg) => leg.rotation.x)).toEqual([0.5, -0.5, -0.5, 0.5]);
    expect(model.body?.position.y).toBe(y);
  });
});

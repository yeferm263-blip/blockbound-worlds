import { useEffect, useMemo, useRef, useState } from "react";
import { Engine, type GameState, type Slot } from "@/game/engine";
import { BLOCKS, ITEMS, ATLAS_COLS, ATLAS_ROWS, type Recipe } from "@/game/blocks";
import { itemIconURL } from "@/game/icons";

function Face({ tile, cls }: { tile: number; cls: string }) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  return (
    <div
      className={`mc-face ${cls}`}
      style={{
        backgroundPosition: `${(col / (ATLAS_COLS - 1)) * 100}% ${(row / (ATLAS_ROWS - 1)) * 100}%`,
      }}
    />
  );
}

export function ItemIcon({ id }: { id: string }) {
  const it = ITEMS[id];
  const url = useMemo(() => (it?.block ? null : itemIconURL(id)), [id, it]);
  if (it?.block) {
    const t = BLOCKS[it.block].tex;
    return (
      <div className="mc-cube-wrap">
        <div className="mc-cube">
          <Face tile={t[0]} cls="mc-top" />
          <Face tile={t[1]} cls="mc-front" />
          <Face tile={t[1]} cls="mc-right" />
        </div>
      </div>
    );
  }
  return <img src={url!} alt={it?.name} className="mc-item-img" draggable={false} />;
}

function SlotView({ slot, active, onClick }: { slot: Slot; active?: boolean; onClick?: (right: boolean) => void }) {
  return (
    <div
      className={`mc-slot ${active ? "mc-slot-active" : ""}`}
      title={slot ? ITEMS[slot.id]?.name : undefined}
      onMouseDown={(e) => { e.preventDefault(); onClick?.(e.button === 2); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {slot && <ItemIcon id={slot.id} />}
      {slot && slot.count > 1 && <span className="mc-count">{slot.count}</span>}
    </div>
  );
}

function Bar({ value, kind }: { value: number; kind: "heart" | "food" }) {
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: 10 }, (_, i) => {
        const v = value - i * 2;
        const state = v >= 2 ? "full" : v === 1 ? "half" : "empty";
        return <span key={i} className={`mc-${kind} mc-${state}`} />;
      })}
    </div>
  );
}

export function Game() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [s, setS] = useState<GameState | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const e = new Engine(ref.current!);
    let unsub = () => {};
    e.init().then(() => { unsub = e.subscribe(setS); setEngine(e); });
    const iv = setInterval(() => e.emit(), 500);
    return () => { clearInterval(iv); unsub(); e.dispose(); };
  }, []);

  const hour = s ? Math.floor(((s.time * 24 + 6) % 24)) : 0;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background font-pixel" onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}>
      <canvas ref={ref} className="block h-full w-full" />
      {!s && <div className="mc-overlay"><p className="mc-title">Generando mundo…</p></div>}
      {s && (
        <>
          <div className="mc-hurt" style={{ opacity: s.hurt * 0.5 }} />
          {s.locked && <div className="mc-crosshair">+</div>}
          <div className="mc-info">
            <div>Día {s.day} · {String(hour).padStart(2, "0")}:00</div>
            <div>XYZ {s.pos.join(" / ")}</div>
            {s.target && <div className="opacity-80">{s.target}</div>}
          </div>
          {s.message && <div className="mc-toast">{s.message}</div>}

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
            {s.slots[s.selected] && <div className="mc-held-name">{ITEMS[s.slots[s.selected]!.id]?.name}</div>}
            <div className="flex w-full justify-between gap-6 px-1">
              <Bar value={s.hp} kind="heart" />
              <Bar value={s.food} kind="food" />
            </div>
            <div className="mc-hotbar">
              {s.slots.slice(0, 9).map((sl, i) => <SlotView key={i} slot={sl} active={i === s.selected} onClick={() => engine?.select(i)} />)}
            </div>
          </div>

          {s.ui === "inventory" && engine && <InventoryUI s={s} engine={engine} />}
          {s.cursor && (
            <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 22, top: mouse.y - 22 }}>
              <SlotView slot={s.cursor} />
            </div>
          )}

          {!s.locked && s.ui === "none" && !s.dead && (
            <div className="mc-overlay cursor-pointer" onClick={() => ref.current?.requestPointerLock()}>
              <h1 className="mc-title">VOXELCRAFT</h1>
              <button className="mc-button">Jugar</button>
              <div className="mc-help">
                <p>WASD mover · Espacio saltar/nadar · Ctrl correr · Shift agacharse</p>
                <p>Clic izq. (mantener) picar / talar / atacar · Clic der. colocar / comer / usar mesa y horno</p>
                <p>E inventario y crafteo · 1-9 / rueda elegir · Q soltar objeto</p>
                <p className="opacity-70">Texturas: Kenney Voxel Pack (CC0, dominio público)</p>
              </div>
            </div>
          )}
          {s.dead && (
            <div className="mc-overlay mc-overlay-dead">
              <h1 className="mc-title">¡Has muerto!</h1>
              <button className="mc-button" onClick={() => engine?.respawn()}>Reaparecer</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InventoryUI({ s, engine }: { s: GameState; engine: Engine }) {
  const recipes = engine.recipes().filter((r) => !r.station || r.station === s.station);
  const title = s.station === "table" ? "Mesa de trabajo" : s.station === "furnace" ? "Horno" : "Inventario";
  return (
    <div className="mc-overlay mc-overlay-soft" onMouseDown={(e) => { if (e.target === e.currentTarget) engine.closeUI(); }}>
      <div className="mc-panel" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex gap-6">
          <div>
            <h2 className="mc-panel-title">{title}</h2>
            <div className="mc-grid">
              {s.slots.slice(9).map((sl, i) => <SlotView key={i} slot={sl} onClick={(r) => engine.clickSlot(i + 9, r)} />)}
            </div>
            <div className="mc-grid mt-3">
              {s.slots.slice(0, 9).map((sl, i) => <SlotView key={i} slot={sl} onClick={(r) => engine.clickSlot(i, r)} />)}
            </div>
          </div>
          <div className="w-72">
            <h2 className="mc-panel-title">{s.station === "furnace" ? "Fundir (usa carbón)" : "Crafteo"}</h2>
            <div className="mc-recipes">
              {recipes.map((r: Recipe, i) => {
                const ok = engine.canCraft(r, s.station);
                return (
                  <button key={i} className={`mc-recipe ${ok ? "" : "mc-recipe-off"}`} disabled={!ok} onClick={() => engine.craft(r)}>
                    <SlotView slot={{ id: r.out, count: r.count }} />
                    <div className="text-left leading-tight">
                      <div>{ITEMS[r.out]?.name}</div>
                      <div className="opacity-70">{Object.entries(r.needs).map(([id, n]) => `${n}× ${ITEMS[id]?.name}`).join(", ")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!s.station && <p className="mt-2 opacity-70">Coloca una Mesa de trabajo o un Horno y haz clic derecho para más recetas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

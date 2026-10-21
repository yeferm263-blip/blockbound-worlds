import { useEffect, useMemo, useRef, useState } from "react";
import { Engine, type GameState, type Slot } from "@/game/engine";
import { BLOCKS, ITEMS, ATLAS_COLS, ATLAS_ROWS } from "@/game/blocks";
import { itemIconURL } from "@/game/icons";
import { AdminPanel, Chat, ChatFeed } from "./AdminTools";
import { PackSprite, packItemName } from "./PackSprite";
import { Button } from "./ui/button";
import guiInventory from "@/assets/gui_inventory.png.asset.json";
import guiTable from "@/assets/gui_crafting_table.png.asset.json";
import guiFurnace from "@/assets/gui_furnace.png.asset.json";

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
  const sprite = packItemName(id);
  const url = useMemo(() => (it?.block || sprite ? null : itemIconURL(id)), [id, it, sprite]);
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
  if (sprite) return <PackSprite name={sprite} width={32} height={32} />;
  return url ? <img src={url} alt={it?.name} className="mc-item-img" draggable={false} /> : null;
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
    <div className="mc-status-bar" role="img" aria-label={`${kind === "heart" ? "Salud" : "Comida"}: ${value}/20`}>
      {Array.from({ length: 10 }, (_, i) => {
        const v = value - i * 2;
        const state = v >= 2 ? "full" : v === 1 ? "half" : "empty";
        const empty = kind === "heart" ? "gui/sprites/hud/heart/container.png" : "gui/sprites/hud/food_empty.png";
        const filled = kind === "heart" ? `gui/sprites/hud/heart/${state}.png` : `gui/sprites/hud/food_${state}.png`;
        return <span key={i} className="mc-status-icon"><PackSprite name={empty} />{state !== "empty" && <PackSprite name={filled} className="mc-sprite-layer" />}</span>;
      })}
    </div>
  );
}

export function Game() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [s, setS] = useState<GameState | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [chat, setChat] = useState<{ m: string; t: number }[]>([]);
  const addLog = (m: string) => setChat((c) => [...c.slice(-50), { m, t: Date.now() }]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const e = new Engine(canvas);
    let unsub = () => {};
    e.init().then(() => { unsub = e.subscribe(setS); setEngine(e); });
    const iv = setInterval(() => e.emit(), 500);
    return () => { clearInterval(iv); unsub(); e.dispose(); };
  }, []);

  const hour = s ? Math.floor(((s.time * 24 + 6) % 24)) : 0;
  const held = s?.slots[s.selected];

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
            {held && <div className="mc-held-name">{ITEMS[held.id]?.name}</div>}
            <div className="flex w-full justify-between">
              <Bar value={s.hp} kind="heart" />
              <Bar value={s.food} kind="food" />
            </div>
            <div className="mc-hotbar">
              <PackSprite name="gui/sprites/hud/hotbar.png" className="mc-hotbar-texture" />
              <div className="mc-hotbar-selection" style={{ left: s.selected * 40 - 2 }}><PackSprite name="gui/sprites/hud/hotbar_selection.png" /></div>
              {s.slots.slice(0, 9).map((sl, i) => <SlotView key={i} slot={sl} active={i === s.selected} onClick={() => engine?.select(i)} />)}
            </div>
          </div>

          {s.ui === "inventory" && engine && <InventoryUI s={s} engine={engine} />}
          {s.ui === "chat" && engine ? <Chat engine={engine} log={chat.map((c) => c.m)} onLog={addLog} /> : <ChatFeed log={chat} />}
          {s.ui === "admin" && engine && <AdminPanel engine={engine} onLog={addLog} />}
          {s.cursor && (
            <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 22, top: mouse.y - 22 }}>
              <SlotView slot={s.cursor} />
            </div>
          )}

          {!s.locked && s.ui === "none" && !s.dead && (
            <div className="mc-overlay cursor-pointer" onClick={() => ref.current?.requestPointerLock()}>
              <h1 className="mc-title">VOXELCRAFT</h1>
              <Button variant="ghost" className="mc-button">Jugar</Button>
              <div className="mc-help">
                <p>WASD mover · Espacio saltar/nadar · Ctrl correr · Shift agacharse</p>
                <p>Clic izq. (mantener) picar / talar / atacar · Clic der. colocar / comer / usar mesa y horno</p>
                <p>E inventario y crafteo · 1-9 / rueda elegir · Q soltar objeto</p>
                <p>T chat · /admin cambiar texturas de bloques</p>
                <p className="opacity-70">Texturas: Kenney Voxel Pack (CC0, dominio público)</p>
              </div>
            </div>
          )}
          {s.dead && (
            <div className="mc-overlay mc-overlay-dead">
              <h1 className="mc-title">¡Has muerto!</h1>
              <Button variant="ghost" className="mc-button" onClick={() => engine?.respawn()}>Reaparecer</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const S = 3; // GUI scale (vanilla GUI pixels -> screen px)
const GUI_BG = { inventory: guiInventory.url, table: guiTable.url, furnace: guiFurnace.url };

function GuiSlot({ x, y, slot, onClick, big }: { x: number; y: number; slot: Slot; onClick: (right: boolean) => void; big?: boolean }) {
  const size = (big ? 24 : 16) * S, off = big ? -4 * S : 0;
  return (
    <div
      className="mc-gui-slot"
      style={{ left: x * S + off, top: y * S + off, width: size, height: size }}
      title={slot ? ITEMS[slot.id]?.name : undefined}
      onMouseDown={(e) => { e.preventDefault(); onClick(e.button === 2); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {slot && <span className="mc-gui-icon"><ItemIcon id={slot.id} /></span>}
      {slot && slot.count > 1 && <span className="mc-count">{slot.count}</span>}
    </div>
  );
}

function InventoryUI({ s, engine }: { s: GameState; engine: Engine }) {
  const kind = s.station ?? "inventory";
  const result = engine.gridResult();
  const take = () => engine.takeResult();
  const gridCells: { x: number; y: number; i: number }[] = [];
  if (kind === "table") for (let i = 0; i < 9; i++) gridCells.push({ x: 30 + (i % 3) * 18, y: 17 + Math.floor(i / 3) * 18, i });
  else if (kind === "inventory") for (let i = 0; i < 4; i++) gridCells.push({ x: 98 + (i % 2) * 18, y: 18 + Math.floor(i / 2) * 18, i });
  else gridCells.push({ x: 56, y: 17, i: 0 }, { x: 56, y: 53, i: 1 });
  const out = kind === "table" ? { x: 124, y: 35 } : kind === "inventory" ? { x: 154, y: 28 } : { x: 116, y: 35 };
  const title = kind === "table" ? "Mesa de trabajo" : kind === "furnace" ? "Horno" : "Creación";
  const titlePos = kind === "inventory" ? { x: 97, y: 6 } : { x: 8, y: 6 };
  return (
    <div className="mc-overlay mc-overlay-soft" onMouseDown={(e) => { if (e.target === e.currentTarget) engine.closeUI(); }}>
      <div className="mc-gui" style={{ width: 176 * S, height: 166 * S, backgroundImage: `url(${GUI_BG[kind]})`, backgroundSize: `${256 * S}px ${256 * S}px` }} onContextMenu={(e) => e.preventDefault()}>
        <span className="mc-gui-label" style={{ left: titlePos.x * S, top: titlePos.y * S - 4 }}>{title}</span>
        {kind !== "inventory" && <span className="mc-gui-label" style={{ left: 8 * S, top: 72 * S - 4 }}>Inventario</span>}
        {gridCells.map((c) => <GuiSlot key={c.i} x={c.x} y={c.y} slot={s.grid[c.i]} onClick={(r) => engine.clickGrid(c.i, r)} />)}
        <GuiSlot x={out.x} y={out.y} slot={result ? { id: result.out, count: result.count } : null} onClick={take} />
        {s.slots.slice(9).map((sl, i) => <GuiSlot key={"m" + i} x={8 + (i % 9) * 18} y={84 + Math.floor(i / 9) * 18} slot={sl} onClick={(r) => engine.clickSlot(i + 9, r)} />)}
        {s.slots.slice(0, 9).map((sl, i) => <GuiSlot key={"h" + i} x={8 + i * 18} y={142} slot={sl} onClick={(r) => engine.clickSlot(i, r)} />)}
      </div>
    </div>
  );
}

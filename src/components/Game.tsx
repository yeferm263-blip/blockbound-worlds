import { useEffect, useMemo, useRef, useState } from "react";
import { Engine, type GameState, type Slot } from "@/game/engine";
import { BLOCKS, ITEMS, ATLAS_COLS, ATLAS_ROWS } from "@/game/blocks";
import { itemIconURL } from "@/game/icons";
import { AdminPanel, Chat, ChatFeed } from "./AdminTools";
import { PackSprite, packItemName } from "./PackSprite";
import { PlayerPreview } from "./PlayerPreview";
import { Button } from "./ui/button";
import guiInventory from "@/assets/gui_inventory.png.asset.json";
import guiTable from "@/assets/gui_crafting_table.png.asset.json";
import guiFurnace from "@/assets/gui_furnace.png.asset.json";

function Face({ tile, cls }: { tile: number; cls: string }) {
  const col = tile % ATLAS_COLS,
    row = Math.floor(tile / ATLAS_COLS);
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
          <Face tile={t[1]} cls="mc-left" />
          <Face tile={t[1]} cls="mc-front" />
        </div>
      </div>
    );
  }
  if (sprite) return <PackSprite name={sprite} width={32} height={32} />;
  return url ? <img src={url} alt={it?.name} className="mc-item-img" draggable={false} /> : null;
}

function DurabilityBar({ slot }: { slot: Slot }) {
  if (!slot) return null;
  const it = ITEMS[slot.id];
  if (!it?.durability) return null;
  const max = it.durability;
  const cur = slot.durability ?? max;
  if (cur >= max) return null;
  const pct = Math.max(0, Math.min(1, cur / max));
  const hue = pct * 120; // 0 red -> 60 yellow -> 120 green
  return (
    <div className="mc-durability-track">
      <div
        className="mc-durability-fill"
        style={{
          width: `${Math.max(6, pct * 100)}%`,
          backgroundColor: `hsl(${hue}, 100%, 45%)`,
        }}
      />
    </div>
  );
}

function SlotView({
  slot,
  active,
  onClick,
}: {
  slot: Slot;
  active?: boolean;
  onClick?: (right: boolean) => void;
}) {
  return (
    <div
      className={`mc-slot ${active ? "mc-slot-active" : ""}`}
      title={
        slot
          ? `${ITEMS[slot.id]?.name ?? slot.id}${
              slot.durability !== undefined && ITEMS[slot.id]?.durability
                ? ` (${slot.durability}/${ITEMS[slot.id]?.durability})`
                : ""
            }`
          : undefined
      }
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.(e.button === 2);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {slot && <ItemIcon id={slot.id} />}
      {slot && slot.count > 1 && <span className="mc-count">{slot.count}</span>}
      <DurabilityBar slot={slot} />
    </div>
  );
}

function Bar({ value, kind }: { value: number; kind: "heart" | "food" }) {
  return (
    <div
      className="mc-status-bar"
      role="img"
      aria-label={`${kind === "heart" ? "Salud" : "Comida"}: ${value}/20`}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const v = value - i * 2;
        const state = v >= 2 ? "full" : v === 1 ? "half" : "empty";
        const empty =
          kind === "heart"
            ? "gui/sprites/hud/heart/container.png"
            : "gui/sprites/hud/food_empty.png";
        const filled =
          kind === "heart"
            ? `gui/sprites/hud/heart/${state}.png`
            : `gui/sprites/hud/food_${state}.png`;
        return (
          <span key={i} className="mc-status-icon">
            <PackSprite name={empty} />
            {state !== "empty" && <PackSprite name={filled} className="mc-sprite-layer" />}
          </span>
        );
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
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const addLog = (m: string) => setChat((c) => [...c.slice(-50), { m, t: Date.now() }]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const e = new Engine(canvas);
    let unsub = () => {};
    e.init().then(() => {
      unsub = e.subscribe(setS);
      setEngine(e);
      e.onChatMessage = addLog;
    });
    const iv = setInterval(() => e.emit(), 500);
    return () => {
      clearInterval(iv);
      unsub();
      e.dispose();
    };
  }, []);

  const hour = s ? Math.floor((s.time * 24 + 6) % 24) : 0;
  const held = s?.slots[s.selected];

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-background font-pixel"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
    >
      <canvas ref={ref} className="block h-full w-full" />
      {!s && (
        <div className="mc-overlay">
          <p className="mc-title">Generando mundo…</p>
        </div>
      )}
      {s && (
        <>
          <div className="mc-hurt" style={{ opacity: s.hurt * 0.5 }} />
          {s.locked && <div className="mc-crosshair">+</div>}
          <div className="mc-info">
            <div>
              Día {s.day} · {String(hour).padStart(2, "0")}:00
            </div>
            <div>XYZ {s.pos.join(" / ")}</div>
            {s.target && <div className="opacity-80">{s.target}</div>}
          </div>

          {/* Top-right multiplayer status & room button */}
          <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
            {s.multiplayer?.connected ? (
              <div className="flex items-center gap-2 bg-black/65 px-3 py-1.5 text-white border-2 border-black text-[1.15rem] shadow-lg">
                <span className="text-emerald-400 font-bold">● ONLINE</span>
                <span>
                  Sala:{" "}
                  <span className="text-yellow-300 font-mono font-bold tracking-wider">
                    {s.multiplayer.room}
                  </span>
                </span>
                <span className="opacity-75">({s.multiplayer.playerCount} jug.)</span>
                <button
                  type="button"
                  className="mc-badge-btn ml-1"
                  onClick={() => {
                    navigator.clipboard.writeText(s.multiplayer?.room || "");
                    engine?.toast("¡Código copiado al portapapeles!");
                  }}
                  title="Copiar código de sala"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  className="mc-badge-btn"
                  onClick={() => {
                    if (engine) engine.safeExitLock();
                    setShowMultiplayerModal(true);
                  }}
                  title="Ajustes de sala"
                >
                  Sala
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mc-badge-btn"
                onClick={() => {
                  if (engine) engine.safeExitLock();
                  setShowMultiplayerModal(true);
                }}
              >
                🌐 Multijugador
              </button>
            )}
          </div>

          {s.message && <div className="mc-toast">{s.message}</div>}

          <div
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5"
            style={{ transform: "translateX(-50%) scale(1.18)", transformOrigin: "bottom center" }}
          >
            {held && <div className="mc-held-name">{ITEMS[held.id]?.name}</div>}
            <div className="flex w-full items-center justify-between px-1" style={{ gap: "24px" }}>
              <Bar value={s.hp} kind="heart" />
              <Bar value={s.food} kind="food" />
            </div>
            <div className="mc-hotbar">
              <PackSprite name="gui/sprites/hud/hotbar.png" className="mc-hotbar-texture" />
              <div className="mc-hotbar-selection" style={{ left: s.selected * 40 - 2 }}>
                <PackSprite name="gui/sprites/hud/hotbar_selection.png" />
              </div>
              {s.slots.slice(0, 9).map((sl, i) => (
                <SlotView
                  key={i}
                  slot={sl}
                  active={i === s.selected}
                  onClick={() => engine?.select(i)}
                />
              ))}
            </div>
          </div>

          {s.ui === "inventory" && engine && <InventoryUI s={s} engine={engine} mouse={mouse} />}
          {s.ui === "chat" && engine ? (
            <Chat engine={engine} log={chat.map((c) => c.m)} onLog={addLog} />
          ) : (
            <ChatFeed log={chat} />
          )}
          {s.ui === "admin" && engine && <AdminPanel engine={engine} onLog={addLog} />}
          {s.cursor && (
            <div
              className="pointer-events-none fixed z-50 flex items-center justify-center"
              style={{
                left: mouse.x - 18,
                top: mouse.y - 18,
                width: 36,
                height: 36,
                filter: "drop-shadow(2px 2px 0 var(--mc-shadow))",
              }}
            >
              <ItemIcon id={s.cursor.id} />
              {s.cursor.count > 1 && (
                <span className="mc-count" style={{ bottom: -2, right: -2 }}>
                  {s.cursor.count}
                </span>
              )}
              <DurabilityBar slot={s.cursor} />
            </div>
          )}

          {!s.locked && s.ui === "none" && !s.dead && !showMultiplayerModal && (
            <div
              className="mc-overlay"
              onClick={() => {
                if (engine) engine.requestLock();
              }}
            >
              <h1 className="mc-title">VOXELCRAFT</h1>
              <div
                className="flex flex-col gap-3 items-center my-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" className="mc-button" onClick={() => engine?.requestLock()}>
                  Jugar
                </Button>
                <Button
                  variant="ghost"
                  className="mc-button"
                  style={{ fontSize: "1.45rem", minWidth: "18rem" }}
                  onClick={() => setShowMultiplayerModal(true)}
                >
                  🌐 Multijugador (Salas)
                </Button>
              </div>
              <div className="mc-help">
                <p>WASD mover · Espacio saltar/nadar · Ctrl correr · Shift agacharse</p>
                <p>
                  Clic izq. (mantener) picar / talar / atacar · Clic der. colocar / comer / usar
                  mesa y horno
                </p>
                <p>E inventario y crafteo · 1-9 / rueda elegir · Q soltar objeto</p>
                <p>T chat · /admin cambiar texturas de bloques</p>
                <p className="opacity-70">Texturas: Kenney Voxel Pack (CC0, dominio público)</p>
              </div>
            </div>
          )}

          {showMultiplayerModal && engine && (
            <MultiplayerModal
              engine={engine}
              s={s}
              onClose={() => setShowMultiplayerModal(false)}
            />
          )}

          {s.dead && (
            <div className="mc-overlay mc-overlay-dead">
              <h1 className="mc-title">¡Has muerto!</h1>
              <Button variant="ghost" className="mc-button" onClick={() => engine?.respawn()}>
                Reaparecer
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const S = 3; // GUI scale (vanilla GUI pixels -> screen px)
const GUI_BG = { inventory: guiInventory.url, table: guiTable.url, furnace: guiFurnace.url };

function GuiSlot({
  x,
  y,
  slot,
  onClick,
  big,
}: {
  x: number;
  y: number;
  slot: Slot;
  onClick: (right: boolean) => void;
  big?: boolean;
}) {
  const size = (big ? 24 : 16) * S,
    off = big ? -4 * S : 0;
  return (
    <div
      className="mc-gui-slot"
      style={{ left: x * S + off, top: y * S + off, width: size, height: size }}
      title={
        slot
          ? `${ITEMS[slot.id]?.name ?? slot.id}${
              slot.durability !== undefined && ITEMS[slot.id]?.durability
                ? ` (${slot.durability}/${ITEMS[slot.id]?.durability})`
                : ""
            }`
          : undefined
      }
      onMouseDown={(e) => {
        e.preventDefault();
        onClick(e.button === 2);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {slot && (
        <span className="mc-gui-icon">
          <ItemIcon id={slot.id} />
        </span>
      )}
      {slot && slot.count > 1 && <span className="mc-count">{slot.count}</span>}
      <DurabilityBar slot={slot} />
    </div>
  );
}

function InventoryUI({
  s,
  engine,
  mouse,
}: {
  s: GameState;
  engine: Engine;
  mouse: { x: number; y: number };
}) {
  const kind = s.station ?? "inventory";
  const result = engine.gridResult();
  const take = () => engine.takeResult();
  const gridCells: { x: number; y: number; i: number }[] = [];
  if (kind === "table")
    for (let i = 0; i < 9; i++)
      gridCells.push({ x: 30 + (i % 3) * 18, y: 17 + Math.floor(i / 3) * 18, i });
  else if (kind === "inventory")
    for (let i = 0; i < 4; i++)
      gridCells.push({ x: 98 + (i % 2) * 18, y: 18 + Math.floor(i / 2) * 18, i });
  else gridCells.push({ x: 56, y: 17, i: 0 }, { x: 56, y: 53, i: 1 });
  const out =
    kind === "table"
      ? { x: 124, y: 35 }
      : kind === "inventory"
        ? { x: 154, y: 28 }
        : { x: 116, y: 35 };
  const title = kind === "table" ? "Mesa de trabajo" : kind === "furnace" ? "Horno" : "Creación";
  const titlePos = kind === "inventory" ? { x: 97, y: 6 } : { x: 8, y: 6 };
  return (
    <div
      className="mc-overlay mc-overlay-soft"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) engine.closeUI();
      }}
    >
      <div
        className="mc-gui"
        style={{
          width: 176 * S,
          height: 166 * S,
          backgroundImage: `url(${GUI_BG[kind]})`,
          backgroundSize: `${256 * S}px ${256 * S}px`,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="mc-gui-label" style={{ left: titlePos.x * S, top: titlePos.y * S - 4 }}>
          {title}
        </span>
        {kind !== "inventory" && (
          <span className="mc-gui-label" style={{ left: 8 * S, top: 72 * S - 4 }}>
            Inventario
          </span>
        )}
        {kind === "inventory" && (
          <div
            style={{
              position: "absolute",
              left: 26 * S,
              top: 8 * S,
              width: 51 * S,
              height: 72 * S,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <PlayerPreview mouse={mouse} />
          </div>
        )}
        {gridCells.map((c) => (
          <GuiSlot
            key={c.i}
            x={c.x}
            y={c.y}
            slot={s.grid[c.i]}
            onClick={(r) => engine.clickGrid(c.i, r)}
          />
        ))}
        <GuiSlot
          x={out.x}
          y={out.y}
          slot={result ? { id: result.out, count: result.count } : null}
          onClick={take}
        />
        {s.slots.slice(9).map((sl, i) => (
          <GuiSlot
            key={"m" + i}
            x={8 + (i % 9) * 18}
            y={84 + Math.floor(i / 9) * 18}
            slot={sl}
            onClick={(r) => engine.clickSlot(i + 9, r)}
          />
        ))}
        {s.slots.slice(0, 9).map((sl, i) => (
          <GuiSlot
            key={"h" + i}
            x={8 + i * 18}
            y={142}
            slot={sl}
            onClick={(r) => engine.clickSlot(i, r)}
          />
        ))}
      </div>
    </div>
  );
}

function MultiplayerModal({
  engine,
  s,
  onClose,
}: {
  engine: Engine;
  s: GameState;
  onClose: () => void;
}) {
  const [roomInput, setRoomInput] = useState("");
  const [nameInput, setNameInput] = useState(
    () => localStorage.getItem("mc_player_name") || "Steve",
  );
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRoomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let res = "CRAFT-";
    for (let i = 0; i < 4; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  };

  const handleConnect = async (codeToUse: string) => {
    const cleanCode = codeToUse.trim().toUpperCase();
    if (!cleanCode) {
      setError("Introduce un código de sala");
      return;
    }
    const cleanName = nameInput.trim() || "Steve";
    localStorage.setItem("mc_player_name", cleanName);
    setError(null);
    setConnecting(true);

    const ok = await engine.connectMultiplayer(cleanCode, cleanName);
    setConnecting(false);
    if (!ok) {
      setError("No se pudo conectar al servidor de juego");
    } else {
      onClose();
    }
  };

  const handleCreateRoom = () => {
    const newCode = generateRoomCode();
    setRoomInput(newCode);
    handleConnect(newCode);
  };

  const handleCopy = () => {
    if (s.multiplayer?.room) {
      navigator.clipboard.writeText(s.multiplayer.room);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      engine.toast("¡Código copiado al portapapeles!");
    }
  };

  return (
    <div
      className="mc-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mc-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b-2 border-black/40 pb-2 mb-4">
          <h2 className="text-2xl font-bold text-black tracking-wide flex items-center gap-2">
            <span>🌐</span> MULTIJUGADOR POR CÓDIGO
          </h2>
          <button type="button" className="mc-badge-btn text-base px-2 py-0.5" onClick={onClose}>
            ✕
          </button>
        </div>

        {s.multiplayer?.connected ? (
          <div className="space-y-4">
            <div className="p-3 bg-black/10 border-2 border-black/20 text-center">
              <p className="text-lg opacity-80 mb-1">¡Estás conectado a la sala!</p>
              <div className="text-3xl font-mono font-bold tracking-widest text-emerald-800 bg-white/60 py-2 px-4 border border-black/30 rounded inline-block my-1">
                {s.multiplayer.room}
              </div>
              <p className="text-base text-black/70 mt-1">
                Jugadores conectados:{" "}
                <span className="font-bold text-black">{s.multiplayer.playerCount}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="mc-button flex-1 text-xl py-2"
                onClick={handleCopy}
              >
                {copied ? "✓ ¡Copiado!" : "📋 Copiar código"}
              </Button>
              <Button
                variant="ghost"
                className="mc-button flex-1 text-xl py-2 bg-red-800 hover:bg-red-700 text-white"
                onClick={() => {
                  engine.disconnectMultiplayer();
                  engine.toast("Desconectado del multijugador");
                }}
              >
                🔌 Salir de la sala
              </Button>
            </div>

            <p className="text-sm text-black/70 text-center italic">
              Pasa este código a tus amigos. Al unirse, ambos verán sus personajes, bloques rotos,
              colocados y chat en tiempo real.
            </p>

            <Button
              variant="ghost"
              className="mc-button w-full text-xl py-2 mt-2"
              onClick={onClose}
            >
              Volver a jugar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-base font-bold text-black/80 mb-1">
                Tu nombre en el juego:
              </label>
              <input
                type="text"
                className="mc-input-field"
                value={nameInput}
                maxLength={16}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Steve"
              />
            </div>

            {error && (
              <div className="p-2 bg-red-500/20 border border-red-600 text-red-900 text-base font-bold">
                ⚠️ {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-black/5 border-2 border-black/15 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg text-black mb-1">Crear nueva sala</h3>
                  <p className="text-sm text-black/70 mb-3">
                    Genera un código único para que tus amigos se unan a tu mundo.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="mc-button w-full text-lg py-2"
                  disabled={connecting}
                  onClick={handleCreateRoom}
                >
                  {connecting ? "Creando…" : "🎲 Crear y Hospedar"}
                </Button>
              </div>

              <div className="p-3 bg-black/5 border-2 border-black/15 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg text-black mb-1">Unirse con código</h3>
                  <p className="text-sm text-black/70 mb-2">
                    Introduce el código que te dio tu amigo:
                  </p>
                  <input
                    type="text"
                    className="mc-input-field mb-3 uppercase tracking-wider font-mono text-center"
                    placeholder="Ej: CRAFT-9A2"
                    value={roomInput}
                    maxLength={12}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConnect(roomInput);
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  className="mc-button w-full text-lg py-2"
                  disabled={connecting || !roomInput.trim()}
                  onClick={() => handleConnect(roomInput)}
                >
                  {connecting ? "Conectando…" : "➡️ Unirse a la sala"}
                </Button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="ghost"
                className="mc-button text-base py-1 px-4 min-w-0"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

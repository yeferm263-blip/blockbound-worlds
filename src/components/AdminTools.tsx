import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Engine } from "@/game/engine";
import { BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "@/game/blocks";
import { fileToTile, loadCustom, saveCustom, type CustomTex } from "@/game/textures";

export function Chat({
  engine,
  log,
  onLog,
}: {
  engine: Engine;
  log: string[];
  onLog: (m: string) => void;
}) {
  const [v, setV] = useState(engine.chatPrefix);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 0);
  }, []);
  const submit = () => {
    const t = v.trim();
    if (!t) {
      engine.closeUI();
      return;
    }
    if (t.startsWith("/")) {
      const parts = t.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = parts[1]?.toLowerCase();

      if (
        cmd === "creative" ||
        (cmd === "gamemode" && (arg === "creative" || arg === "c" || arg === "1"))
      ) {
        engine.setGameMode("creative");
        onLog("Tu modo de juego se ha cambiado a Modo Creativo");
        engine.closeUI();
        return;
      }
      if (
        cmd === "survival" ||
        (cmd === "gamemode" && (arg === "survival" || arg === "s" || arg === "0"))
      ) {
        engine.setGameMode("survival");
        onLog("Tu modo de juego se ha cambiado a Modo Supervivencia");
        engine.closeUI();
        return;
      }
      if (cmd === "fly") {
        if (engine.state.mode === "creative") {
          engine.flying = !engine.flying;
          onLog(engine.flying ? "Vuelo activado" : "Vuelo desactivado");
        } else {
          onLog("El vuelo solo está disponible en Modo Creativo (/creative)");
        }
        engine.closeUI();
        return;
      }
      if (cmd === "admin") {
        onLog("Abriendo panel de texturas…");
        engine.openAdmin();
        return;
      }
      if (cmd === "clear") {
        engine.state.slots = Array(36).fill(null);
        engine.emit();
        onLog("Inventario vaciado.");
        engine.closeUI();
        return;
      }
      if (cmd === "help") {
        onLog("Comandos disponibles:");
        onLog("  /creative o /gamemode creative (acceso a todos los bloques, volar)");
        onLog("  /survival o /gamemode survival (modo supervivencia clásico)");
        onLog("  /fly (activar/desactivar vuelo en creativo)");
        onLog("  /admin (personalizar texturas de bloques)");
        onLog("  /clear (vaciar inventario)");
      } else {
        onLog(`Comando desconocido: /${cmd}. Escribe /help para ver comandos.`);
      }
    } else {
      const author = engine.playerName || "Jugador";
      onLog(`<${author}> ${t}`);
      engine.sendChat(t);
    }
    engine.closeUI();
  };
  return (
    <div className="absolute bottom-24 left-2 z-40 w-[min(40rem,90vw)]">
      <div className="mb-1 flex flex-col gap-0.5">
        {log.slice(-10).map((m, i) => (
          <div key={i} className="mc-chat-line">
            {m}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") submit();
          if (e.key === "Escape") engine.closeUI();
        }}
        className="mc-chat-input"
        placeholder="Escribe un mensaje o /admin"
        maxLength={200}
      />
    </div>
  );
}

export function ChatFeed({ log }: { log: { m: string; t: number }[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const recent = log.filter((l) => now - l.t < 8000).slice(-6);
  return (
    <div className="pointer-events-none absolute bottom-24 left-2 z-30 flex flex-col gap-0.5">
      {recent.map((l, i) => (
        <div key={i} className="mc-chat-line">
          {l.m}
        </div>
      ))}
    </div>
  );
}

function tileStyle(tile: number) {
  const col = tile % ATLAS_COLS,
    row = Math.floor(tile / ATLAS_COLS);
  return {
    backgroundImage: "var(--atlas-url, url(/textures/atlas.png))",
    backgroundSize: `${ATLAS_COLS * 100}% ${ATLAS_ROWS * 100}%`,
    backgroundPosition: `${(col / (ATLAS_COLS - 1)) * 100}% ${(row / (ATLAS_ROWS - 1)) * 100}%`,
    imageRendering: "pixelated" as const,
  };
}

function Preview({ top, side }: { top: string; side: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mats = useRef<THREE.MeshLambertMaterial[]>([]);
  useEffect(() => {
    const canvas = ref.current!;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setSize(220, 220, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    cam.position.set(2.2, 1.8, 2.2);
    cam.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4);
    dl.position.set(3, 5, 2);
    scene.add(dl);
    mats.current = Array.from(
      { length: 6 },
      () => new THREE.MeshLambertMaterial({ alphaTest: 0.5 }),
    );
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mats.current);
    scene.add(cube);
    let raf = 0,
      drag = false,
      lx = 0,
      ly = 0,
      vy = 0.6;
    const down = (e: PointerEvent) => {
      drag = true;
      lx = e.clientX;
      ly = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      cube.rotation.y += (e.clientX - lx) * 0.01;
      cube.rotation.x = Math.max(-1.2, Math.min(1.2, cube.rotation.x + (e.clientY - ly) * 0.01));
      lx = e.clientX;
      ly = e.clientY;
    };
    const up = () => {
      drag = false;
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (!drag) cube.rotation.y += dt * vy;
      r.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      vy = 0;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      r.dispose();
    };
  }, []);
  useEffect(() => {
    const ld = new THREE.TextureLoader();
    const mk = (src: string) => {
      const t = ld.load(src);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const ts = mk(top),
      ss = mk(side);
    // box faces: +x, -x, +y(top), -y, +z, -z
    mats.current.forEach((m, i) => {
      m.map = i === 2 ? ts : ss;
      m.needsUpdate = true;
    });
    return () => {
      ts.dispose();
      ss.dispose();
    };
  }, [top, side]);
  return (
    <canvas ref={ref} width={220} height={220} className="mc-preview" title="Arrastra para girar" />
  );
}

function tileDataURL(tile: number): Promise<string> {
  // crop a tile from the current atlas
  const css = getComputedStyle(document.documentElement).getPropertyValue("--atlas-url");
  const src = css.match(/url\((.*)\)/)?.[1]?.replace(/["']/g, "") || "/textures/atlas.png";
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const T = img.width / ATLAS_COLS;
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const g = c.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.drawImage(
        img,
        (tile % ATLAS_COLS) * T,
        Math.floor(tile / ATLAS_COLS) * T,
        T,
        T,
        0,
        0,
        16,
        16,
      );
      res(c.toDataURL());
    };
    img.src = src;
  });
}

export function AdminPanel({ engine, onLog }: { engine: Engine; onLog: (m: string) => void }) {
  const ids = Object.keys(BLOCKS)
    .map(Number)
    .filter((id) => !BLOCKS[id].liquid);
  const [sel, setSel] = useState(ids[0]);
  const [draft, setDraft] = useState<CustomTex>({});
  const [cur, setCur] = useState<{ top: string; side: string } | null>(null);
  const [, force] = useState(0);
  const custom = loadCustom();

  useEffect(() => {
    setDraft(loadCustom()[sel] ?? {});
    const t = BLOCKS[sel].tex;
    Promise.all([tileDataURL(t[0]), tileDataURL(t[1])]).then(([top, side]) =>
      setCur({ top, side }),
    );
  }, [sel]);

  const pick = async (f: File | undefined, part: "top" | "side") => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onLog("El archivo debe ser una imagen.");
      return;
    }
    const url = await fileToTile(f);
    setDraft((d) => ({ ...d, [part]: url }));
  };
  const apply = async (t: CustomTex | null) => {
    saveCustom(sel, t);
    await engine.reloadTextures();
    setDraft(t ?? {});
    const tex = BLOCKS[sel].tex;
    const [top, side] = await Promise.all([tileDataURL(tex[0]), tileDataURL(tex[1])]);
    setCur({ top, side });
    force((n) => n + 1);
    onLog(
      t
        ? `Textura de "${BLOCKS[sel].name}" actualizada.`
        : `Textura de "${BLOCKS[sel].name}" restaurada.`,
    );
  };

  const pTop = draft.top ?? (draft.side && !custom[sel]?.top ? draft.side : cur?.top);
  const pSide = draft.side ?? cur?.side;

  return (
    <div
      className="mc-overlay mc-overlay-soft"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) engine.closeUI();
      }}
    >
      <div
        className="mc-panel flex max-h-[90vh] max-w-[95vw] gap-4"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") engine.closeUI();
        }}
      >
        <div className="flex w-80 flex-col">
          <h2 className="mc-panel-title">Panel admin · Bloques</h2>
          <div className="grid grid-cols-6 gap-1 overflow-y-auto pr-1">
            {ids.map((id) => (
              <button
                key={id}
                title={BLOCKS[id].name}
                onClick={() => setSel(id)}
                className={`mc-slot ${id === sel ? "mc-slot-active" : ""}`}
              >
                <div className="h-8 w-8" style={tileStyle(BLOCKS[id].tex[1])} />
                {custom[id] && <span className="mc-count">★</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-72 flex-col items-center gap-2">
          <h2 className="mc-panel-title">{BLOCKS[sel].name}</h2>
          {pTop && pSide ? <Preview top={pTop} side={pSide} /> : <div className="mc-preview" />}
          <p className="text-sm opacity-70">Arrastra el cubo para girarlo</p>
          <label className="mc-button !min-w-0 w-full cursor-pointer text-center !text-lg">
            Subir lado (todos los lados)
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0], "side");
                e.target.value = "";
              }}
            />
          </label>
          <label className="mc-button !min-w-0 w-full cursor-pointer text-center !text-lg">
            Subir parte de arriba
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0], "top");
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex w-full gap-2">
            <button
              className="mc-button !min-w-0 flex-1 !text-lg"
              disabled={!draft.top && !draft.side}
              onClick={() => apply(draft)}
            >
              Guardar
            </button>
            <button
              className="mc-button !min-w-0 flex-1 !text-lg"
              disabled={!custom[sel]}
              onClick={() => apply(null)}
            >
              Restaurar
            </button>
          </div>
          <button className="mc-button !min-w-0 w-full !text-lg" onClick={() => engine.closeUI()}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { WorldRecord } from "@/game/worldsDb";

interface LoadingScreenProps {
  world: WorldRecord;
  onReady: () => void;
}

const TIPS = [
  "¡No mires fijamente a los ojos de un enderman!",
  "Los creepers le temen a los ocelotes y gatos.",
  "¡Nunca piques directamente hacia abajo!",
  "Coloca antorchas para evitar que los monstruos aparezcan en la oscuridad.",
  "Usa un cubo de agua para amortiguar el daño por caída.",
  "Las camas explotan violentamente si intentas dormir en el Nether o el End.",
  "Cocinar carne en el horno restaura el doble de barra de comida.",
  "Los zombis y esqueletos arden con la luz directa del sol matutino.",
  "La obsidiana se pica únicamente con pico de diamante.",
  "Los aldeanos zombi pueden ser curados con una poción y una manzana dorada.",
  "Presiona F11 o el botón inferior para jugar en pantalla completa.",
];

export function LoadingScreen({ world, onReady }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState("Generando terreno...");
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [fadeComplete, setFadeComplete] = useState(false);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      // Realistic non-linear progress
      const increment = Math.random() * 9 + 4;
      current = Math.min(100, current + increment);
      setProgress(Math.floor(current));

      if (current < 35) {
        setStageText("Generando terreno...");
      } else if (current < 75) {
        setStageText("Cargando recursos y texturas...");
      } else if (current < 100) {
        setStageText("Construyendo terreno...");
      } else {
        setStageText("¡Listo para jugar!");
        clearInterval(interval);
        setTimeout(() => {
          setFadeComplete(true);
          setTimeout(() => {
            onReady();
          }, 350);
        }, 300);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [onReady]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6 select-none font-pixel mc-dirt-bg transition-opacity duration-300 ${
        fadeComplete ? "opacity-0" : "opacity-100"
      }`}
      style={{
        backgroundColor: "#18130e",
      }}
    >
      {/* Top World Header */}
      <div className="w-full max-w-2xl flex flex-col items-center mt-6">
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-wider drop-shadow-[3px_3px_0_#000000]">
          {world.name}
        </h2>
        <p className="text-xl text-neutral-300 drop-shadow-[2px_2px_0_#000000] mt-1">
          Modo: {world.gameMode === "creative" ? "Creativo" : "Supervivencia"} · Semilla:{" "}
          {world.seed}
        </p>
        <div className="mc-header-sep mt-4" />
      </div>

      {/* Center Bedrock Progress Box */}
      <div className="w-full max-w-xl flex flex-col items-center gap-4 px-4">
        <p className="text-3xl text-yellow-300 font-bold tracking-wide animate-pulse drop-shadow-[2px_2px_0_#000000]">
          {stageText}
        </p>

        {/* Authentic Bedrock Progress Bar */}
        <div className="w-full h-8 bg-[#252525] border-3 border-[#121212] p-1 shadow-[inset_2px_2px_0_#000000,2px_2px_0_#404040]">
          <div
            className="h-full bg-gradient-to-r from-[#44dd44] to-[#70ff70] border-t-2 border-l-2 border-[#b5ffb5] transition-all duration-150 ease-out shadow-[0_0_8px_#55ff55]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xl text-neutral-400 font-mono tracking-widest drop-shadow-[1px_1px_0_#000000]">
          {progress}%
        </p>
      </div>

      {/* Bottom Classic Tip Box */}
      <div className="w-full max-w-2xl flex flex-col items-center mb-4">
        <div className="mc-footer-sep mb-4" />
        <div className="w-full text-center px-6 py-3 bg-black/60 border-2 border-neutral-700/80 rounded shadow-lg">
          <p className="text-sm md:text-base text-yellow-400 font-bold uppercase tracking-wider mb-1">
            Consejo:
          </p>
          <p className="text-xl md:text-2xl text-neutral-100 italic leading-relaxed drop-shadow-[2px_2px_0_#000000]">
            "{tip}"
          </p>
        </div>
      </div>
    </div>
  );
}

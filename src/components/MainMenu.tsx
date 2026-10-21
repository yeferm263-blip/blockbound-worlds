import { useState, useEffect } from "react";
import { MenuPanorama } from "./MenuPanorama";
import { BedrockPlayerPreview } from "./BedrockPlayerPreview";
import { WorldsMenu } from "./WorldsMenu";
import { SettingsMenu } from "./SettingsMenu";
import { ProfileModal } from "./ProfileModal";
import { getStoredPlayerName, getStoredCustomSkin } from "@/game/skinStorage";
import { sfx } from "@/game/audio";
import type { WorldRecord } from "@/game/worldsDb";

const SPLASHES = [
  "¡100% libre de bugs!",
  "¡Construye tus sueños!",
  "¡También disponible en la web!",
  "¡Cuidado con los creepers!",
  "¡Three.js + React 19!",
  "¡Pica diamantes!",
  "¡No caves hacia abajo!",
  "¡Totalmente infinito!",
  "¡Ahora con Bedrock UI!",
  "¡Redstone no incluida!",
  "¡VoxelCraft Bedrock Edition!",
  "¡Presiona F11 para pantalla completa!",
  "¡Come pan para regenerar vida!",
];

interface MainMenuProps {
  onStartWorld: (world: WorldRecord) => void;
  onJoinServer?: (roomCode: string, name: string) => void;
}

export function MainMenu({ onStartWorld, onJoinServer }: MainMenuProps) {
  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "worlds" | "settings" | "profile">(
    "none",
  );
  const [playerName, setPlayerName] = useState(getStoredPlayerName);
  const [customSkin, setCustomSkin] = useState<string | null>(getStoredCustomSkin);
  const [splash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    sfx.click();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden font-pixel select-none">
      {/* 1. 3D Panorama Background */}
      <MenuPanorama blurred={activeSubmenu !== "none"} />

      {/* 2. Main Interface when no submenu is active */}
      {activeSubmenu === "none" && (
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 pointer-events-auto">
          {/* Top Logo and Splash */}
          <div className="flex flex-col items-center pt-8 md:pt-12">
            <div className="relative inline-block text-center">
              {/* 3D Voxel Minecraft Style Title */}
              <h1 className="mc-bedrock-title text-6xl sm:text-7xl md:text-8xl tracking-wider select-none font-bold">
                VOXELCRAFT
              </h1>

              {/* Minecraft Edition Badge from Resource Pack */}
              <img
                src="/resourcepack/assets/minecraft/textures/gui/title/edition.png"
                alt="Bedrock Edition"
                className="h-5 sm:h-7 mx-auto mt-1 pointer-events-none drop-shadow-[2px_2px_0_#000000]"
                style={{ imageRendering: "pixelated" }}
              />

              {/* Oscillating Bouncing Splash Text */}
              <div className="absolute -bottom-4 right-0 sm:-right-8 md:-right-12 z-20 mc-splash-text text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-[2px_2px_0_#000000]">
                {splash}
              </div>
            </div>
          </div>

          {/* Center: Column of Main Menu Buttons */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <div className="flex flex-col gap-3 w-full max-w-[22rem]">
              <button
                type="button"
                className="mc-button w-full text-3xl py-3 tracking-wide"
                onClick={() => {
                  sfx.click();
                  setActiveSubmenu("worlds");
                }}
              >
                Jugar
              </button>

              <button
                type="button"
                className="mc-button w-full text-3xl py-3 tracking-wide"
                onClick={() => {
                  sfx.click();
                  setActiveSubmenu("settings");
                }}
              >
                Ajustes
              </button>

              <button
                type="button"
                className="mc-button w-full text-3xl py-3 tracking-wide"
                onClick={() => {
                  sfx.click();
                  setActiveSubmenu("profile");
                }}
              >
                Perfil / Aspecto
              </button>
            </div>
          </div>

          {/* Right Lateral Player Panel (Bedrock Edition Style) */}
          <div className="fixed right-6 bottom-16 z-20 hidden md:flex flex-col items-center pointer-events-auto bg-black/40 backdrop-blur-sm border-2 border-black/40 p-3 shadow-xl">
            {/* Player 3D interactive model */}
            <div className="w-52 h-72">
              <BedrockPlayerPreview
                skinUrl={customSkin}
                interactive={true}
                className="w-full h-full"
              />
            </div>

            {/* Player Name and Vestidor Button */}
            <div className="w-full text-center mt-1">
              <p className="text-2xl font-bold text-white tracking-wide drop-shadow-[2px_2px_0_#000000]">
                {playerName}
              </p>
              <button
                type="button"
                className="mc-button w-full text-lg py-1 mt-2 min-w-0"
                onClick={() => {
                  sfx.click();
                  setActiveSubmenu("profile");
                }}
              >
                Vestidor
              </button>
            </div>
          </div>

          {/* Bottom Bar: Version & Fullscreen */}
          <div className="flex items-center justify-between text-neutral-200 text-lg md:text-xl drop-shadow-[2px_2px_0_#000000] z-20">
            <div>
              <span>v1.0.0 Bedrock Edition Web</span>
              <span className="opacity-70 ml-2">· Faithful 32x</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="mc-badge-btn text-base px-3 py-1 flex items-center gap-1.5"
                onClick={toggleFullscreen}
                title="Alternar pantalla completa"
              >
                <span>{isFullscreen ? "🗗 Salir de pantalla completa" : "⛶ Pantalla completa"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Submenus */}
      {activeSubmenu === "worlds" && (
        <WorldsMenu
          onSelectWorld={(world) => onStartWorld(world)}
          onJoinServer={(room, name) => onJoinServer?.(room, name)}
          onBack={() => setActiveSubmenu("none")}
        />
      )}

      {activeSubmenu === "settings" && <SettingsMenu onClose={() => setActiveSubmenu("none")} />}

      {activeSubmenu === "profile" && (
        <ProfileModal
          onClose={() => setActiveSubmenu("none")}
          onSkinChanged={(skin) => setCustomSkin(skin)}
          onNameChanged={(name) => setPlayerName(name)}
        />
      )}
    </div>
  );
}

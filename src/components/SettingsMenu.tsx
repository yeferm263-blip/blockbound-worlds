import { useState } from "react";
import { getSettings, saveSettings, type GameSettings } from "@/game/settings";
import { setMasterVolume, setMusicVolume, setSfxVolume, sfx } from "@/game/audio";

interface SettingsMenuProps {
  onClose: () => void;
  onSettingsChanged?: (settings: GameSettings) => void;
}

export function SettingsMenu({ onClose, onSettingsChanged }: SettingsMenuProps) {
  const [settings, setSettingsState] = useState<GameSettings>(() => getSettings());
  const [activeTab, setActiveTab] = useState<"audio" | "video" | "controls">("audio");

  const updateSetting = <K extends keyof GameSettings>(key: K, val: GameSettings[K]) => {
    sfx.click();
    const updated = saveSettings({ [key]: val });
    setSettingsState(updated);
    onSettingsChanged?.(updated);

    if (key === "masterVolume") setMasterVolume(val as number);
    if (key === "sfxVolume") setSfxVolume(val as number);
    if (key === "musicVolume") setMusicVolume(val as number);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 font-pixel select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sfx.click();
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl bg-[#282828] border-3 border-[#1a1a1a] shadow-[inset_2px_2px_0_#505050,inset_-2px_-2px_0_#151515,0_10px_30px_rgba(0,0,0,0.85)] p-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black/40 pb-3 mb-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-wider drop-shadow-[2px_2px_0_#000000] flex items-center gap-2">
            <span>⚙️</span> AJUSTES DEL JUEGO
          </h2>
          <button
            type="button"
            className="mc-badge-btn text-xl px-3 py-1 text-white hover:bg-red-700"
            onClick={() => {
              sfx.click();
              onClose();
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <button
            type="button"
            className={`py-2 text-2xl font-bold tracking-wide transition-all border-2 border-black shadow-[2px_2px_0_#000000] ${
              activeTab === "audio"
                ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300"
                : "bg-[#454545] text-neutral-300 hover:bg-[#555555]"
            }`}
            onClick={() => {
              sfx.click();
              setActiveTab("audio");
            }}
          >
            🔊 Sonido
          </button>
          <button
            type="button"
            className={`py-2 text-2xl font-bold tracking-wide transition-all border-2 border-black shadow-[2px_2px_0_#000000] ${
              activeTab === "video"
                ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300"
                : "bg-[#454545] text-neutral-300 hover:bg-[#555555]"
            }`}
            onClick={() => {
              sfx.click();
              setActiveTab("video");
            }}
          >
            📺 Video
          </button>
          <button
            type="button"
            className={`py-2 text-2xl font-bold tracking-wide transition-all border-2 border-black shadow-[2px_2px_0_#000000] ${
              activeTab === "controls"
                ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300"
                : "bg-[#454545] text-neutral-300 hover:bg-[#555555]"
            }`}
            onClick={() => {
              sfx.click();
              setActiveTab("controls");
            }}
          >
            🎮 Controles
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-2">
          {activeTab === "audio" && (
            <div className="space-y-4">
              {/* Master Volume */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl text-white font-bold">Volumen General:</span>
                  <span className="text-2xl text-yellow-300 font-mono font-bold">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.masterVolume}
                  onChange={(e) => updateSetting("masterVolume", parseFloat(e.target.value))}
                  className="w-full accent-[#55ff55] h-3 bg-neutral-700 cursor-pointer"
                />
              </div>

              {/* Music Volume */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl text-white font-bold">Música C418:</span>
                  <span className="text-2xl text-yellow-300 font-mono font-bold">
                    {Math.round(settings.musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.musicVolume}
                  onChange={(e) => updateSetting("musicVolume", parseFloat(e.target.value))}
                  className="w-full accent-[#55ff55] h-3 bg-neutral-700 cursor-pointer"
                />
              </div>

              {/* SFX Volume */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl text-white font-bold">Efectos de sonido (SFX):</span>
                  <span className="text-2xl text-yellow-300 font-mono font-bold">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => updateSetting("sfxVolume", parseFloat(e.target.value))}
                  className="w-full accent-[#55ff55] h-3 bg-neutral-700 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === "video" && (
            <div className="space-y-4">
              {/* Render Distance */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl text-white font-bold">Distancia de Renderizado:</span>
                  <span className="text-2xl text-yellow-300 font-mono font-bold">
                    {settings.renderDistance} Chunks
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[4, 6, 8, 12].map((chunks) => (
                    <button
                      key={chunks}
                      type="button"
                      className={`py-2 text-xl font-bold border-2 border-black ${
                        settings.renderDistance === chunks
                          ? "bg-[#55aa44] text-white"
                          : "bg-[#383838] text-neutral-300 hover:bg-[#484848]"
                      }`}
                      onClick={() => updateSetting("renderDistance", chunks)}
                    >
                      {chunks} Chunks
                    </button>
                  ))}
                </div>
              </div>

              {/* FOV */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl text-white font-bold">Campo de Visión (FOV):</span>
                  <span className="text-2xl text-yellow-300 font-mono font-bold">
                    {settings.fov}° {settings.fov === 75 ? "(Normal)" : ""}
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="105"
                  step="5"
                  value={settings.fov}
                  onChange={(e) => updateSetting("fov", parseInt(e.target.value, 10))}
                  className="w-full accent-[#55ff55] h-3 bg-neutral-700 cursor-pointer"
                />
              </div>

              {/* View Bobbing */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40 flex justify-between items-center">
                <div>
                  <span className="text-2xl text-white font-bold block">Balanceo de cámara:</span>
                  <span className="text-sm text-neutral-400">
                    Movimiento de la mano y cámara al caminar
                  </span>
                </div>
                <button
                  type="button"
                  className={`px-6 py-2 text-xl font-bold border-2 border-black min-w-[8rem] ${
                    settings.viewBobbing
                      ? "bg-[#4a8a3a] text-yellow-200"
                      : "bg-[#555555] text-neutral-400"
                  }`}
                  onClick={() => updateSetting("viewBobbing", !settings.viewBobbing)}
                >
                  {settings.viewBobbing ? "SÍ" : "NO"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "controls" && (
            <div className="space-y-4">
              {/* Mouse Sensitivity */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl text-white font-bold">Sensibilidad del Ratón:</span>
                  <span className="text-2xl text-yellow-300 font-mono font-bold">
                    {Math.round(settings.mouseSensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.1"
                  value={settings.mouseSensitivity}
                  onChange={(e) => updateSetting("mouseSensitivity", parseFloat(e.target.value))}
                  className="w-full accent-[#55ff55] h-3 bg-neutral-700 cursor-pointer"
                />
              </div>

              {/* Invert Y Axis */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40 flex justify-between items-center">
                <div>
                  <span className="text-2xl text-white font-bold block">Invertir Eje Y:</span>
                  <span className="text-sm text-neutral-400">
                    Invierte el movimiento vertical del ratón
                  </span>
                </div>
                <button
                  type="button"
                  className={`px-6 py-2 text-xl font-bold border-2 border-black min-w-[8rem] ${
                    settings.invertY
                      ? "bg-[#4a8a3a] text-yellow-200"
                      : "bg-[#555555] text-neutral-400"
                  }`}
                  onClick={() => updateSetting("invertY", !settings.invertY)}
                >
                  {settings.invertY ? "SÍ" : "NO"}
                </button>
              </div>

              {/* Key bindings summary */}
              <div className="bg-[#181818] p-4 border border-neutral-700 text-neutral-300 text-lg space-y-1">
                <p className="font-bold text-yellow-400 mb-1">Guía de Teclas:</p>
                <p>• WASD: Moverse · Espacio: Saltar · Ctrl: Correr · Shift: Agacharse</p>
                <p>• Clic Izquierdo: Picar / Golpear · Clic Derecho: Colocar / Usar</p>
                <p>• E: Inventario y Crafteo · 1-9: Barra de objetos · Q: Soltar</p>
                <p>• T: Chat · ESC: Menú de Pausa</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Done Button */}
        <div className="pt-4 border-t-2 border-black/30 flex justify-end">
          <button
            type="button"
            className="mc-button min-w-[12rem] py-2 text-2xl"
            onClick={() => {
              sfx.click();
              onClose();
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

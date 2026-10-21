import { useState, useRef } from "react";
import { BedrockPlayerPreview } from "./BedrockPlayerPreview";
import {
  getStoredPlayerName,
  setStoredPlayerName,
  getStoredCustomSkin,
  setStoredCustomSkin,
  resetCustomSkin,
} from "@/game/skinStorage";
import { sfx } from "@/game/audio";

interface ProfileModalProps {
  onClose: () => void;
  onSkinChanged: (newSkin: string | null) => void;
  onNameChanged: (newName: string) => void;
}

export function ProfileModal({ onClose, onSkinChanged, onNameChanged }: ProfileModalProps) {
  const [name, setName] = useState(getStoredPlayerName);
  const [currentSkin, setCurrentSkin] = useState<string | null>(getStoredCustomSkin);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameSave = (val: string) => {
    setName(val);
    setStoredPlayerName(val);
    onNameChanged(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("png")) {
      setStatusMsg("⚠️ El archivo debe ser una imagen PNG.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Minecraft skin standard dimensions
        if ((img.width === 64 && img.height === 64) || (img.width === 64 && img.height === 32)) {
          sfx.click();
          setStoredCustomSkin(dataUrl);
          setCurrentSkin(dataUrl);
          onSkinChanged(dataUrl);
          setStatusMsg("✅ ¡Skin cargada correctamente!");
          setTimeout(() => setStatusMsg(null), 3500);
        } else {
          setStatusMsg(
            `⚠️ Tamaño incompatible: ${img.width}x${img.height}. Debe ser 64x64 o 64x32.`,
          );
        }
      };
      img.onerror = () => {
        setStatusMsg("⚠️ No se pudo procesar la imagen.");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    sfx.click();
    resetCustomSkin();
    setCurrentSkin(null);
    onSkinChanged(null);
    setStatusMsg("Skin restablecida a Steve por defecto.");
    setTimeout(() => setStatusMsg(null), 3000);
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
        className="w-full max-w-3xl mc-dirt-bg border-3 border-[#1a1a1a] shadow-[inset_2px_2px_0_#505050,inset_-2px_-2px_0_#151515,0_10px_30px_rgba(0,0,0,0.85)] p-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-wider drop-shadow-[2px_2px_0_#000000] flex items-center gap-2">
            <span>👕</span> VESTIDOR Y PERFIL
          </h2>
          <button
            type="button"
            className="mc-cross-btn"
            onClick={() => {
              sfx.click();
              onClose();
            }}
            title="Cerrar"
          />
        </div>
        <div className="mc-header-sep mb-4" />

        {/* Content Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto">
          {/* Left: 3D Model Viewer */}
          <div className="flex flex-col items-center justify-center bg-[#1c1c1c] border-2 border-black/50 p-4 relative min-h-[320px]">
            <p className="absolute top-2 left-2 text-xs text-neutral-400 font-mono">
              Vista 3D en tiempo real (arrastra para rotar)
            </p>
            <div className="w-full h-72">
              <BedrockPlayerPreview
                skinUrl={currentSkin}
                interactive={true}
                className="w-full h-full"
              />
            </div>
            <p className="text-xl text-yellow-300 font-bold mt-2 drop-shadow-[1px_1px_0_#000000]">
              {name || "Steve"}
            </p>
          </div>

          {/* Right: Controls & Upload */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Player Name Edit */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40">
                <label className="block text-2xl text-white font-bold mb-1">
                  Nombre del Jugador:
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={name}
                  onChange={(e) => handleNameSave(e.target.value)}
                  placeholder="Steve"
                  className="mc-input-field text-xl"
                />
                <span className="text-xs text-neutral-400 mt-1 block">
                  Se muestra sobre tu personaje en salas multijugador.
                </span>
              </div>

              {/* Skin Upload */}
              <div className="bg-[#1e1e1e] p-4 border-2 border-black/40 space-y-3">
                <label className="block text-2xl text-white font-bold">
                  Personalizar Aspecto / Skin:
                </label>
                <p className="text-sm text-neutral-300">
                  Sube cualquier imagen PNG de skin de Minecraft estándar (formato 64×64 o 64×32).
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="mc-button flex-1 py-2 text-xl min-w-0"
                    onClick={() => {
                      sfx.click();
                      fileInputRef.current?.click();
                    }}
                  >
                    📁 Subir archivo PNG
                  </button>
                  <button
                    type="button"
                    className="mc-button py-2 px-4 text-xl min-w-0 bg-neutral-600 hover:bg-neutral-500"
                    onClick={handleReset}
                    title="Restablecer skin predeterminada"
                  >
                    ↺ Restablecer
                  </button>
                </div>

                {statusMsg && (
                  <div className="p-2 bg-black/60 border border-yellow-500/60 text-yellow-300 text-lg">
                    {statusMsg}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/30 p-3 border border-neutral-700 text-neutral-400 text-sm">
              💡 Tip: Puedes descargar skins gratuitas de sitios como NameMC, Skindex o NovaSkin y
              subirlas directamente aquí.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mc-footer-sep my-3" />
        <div className="flex justify-end">
          <button
            type="button"
            className="mc-button min-w-[12rem] py-2 text-2xl"
            onClick={() => {
              sfx.click();
              onClose();
            }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import {
  getAllWorlds,
  saveWorld,
  deleteWorld,
  createNewWorldRecord,
  exportWorldJson,
  importWorldJson,
  ensureDefaultWorld,
  type WorldRecord,
} from "@/game/worldsDb";
import { sfx } from "@/game/audio";

interface WorldsMenuProps {
  onSelectWorld: (world: WorldRecord) => void;
  onJoinServer?: (roomCode: string, name: string) => void;
  onBack: () => void;
}

export function WorldsMenu({ onSelectWorld, onJoinServer, onBack }: WorldsMenuProps) {
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"worlds" | "friends" | "servers">("worlds");

  // Create world modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("Mi mundo");
  const [newMode, setNewMode] = useState<"survival" | "creative">("survival");
  const [newSeed, setNewSeed] = useState("");

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<WorldRecord | null>(null);

  // Server tab state
  const [serverCode, setServerCode] = useState("");
  const [serverName, setServerName] = useState(
    () => localStorage.getItem("mc_player_name") || "Steve",
  );

  const importFileRef = useRef<HTMLInputElement>(null);

  const loadWorldsList = async () => {
    setLoading(true);
    await ensureDefaultWorld();
    const list = await getAllWorlds();
    setWorlds(list);
    setLoading(false);
  };

  useEffect(() => {
    loadWorldsList();
  }, []);

  const handleCreate = async () => {
    sfx.click();
    const parsedSeed = newSeed.trim() ? parseInt(newSeed.trim(), 10) : undefined;
    const world = createNewWorldRecord(newName, newMode, parsedSeed);
    await saveWorld(world);
    setShowCreateModal(false);
    setNewName("Mi mundo");
    setNewSeed("");
    await loadWorldsList();
  };

  const handleDelete = async (id: string) => {
    sfx.click();
    await deleteWorld(id);
    setDeleteTarget(null);
    await loadWorldsList();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      sfx.click();
      await importWorldJson(text);
      await loadWorldsList();
    } catch (err) {
      alert("Error al importar mundo: archivo JSON no válido.");
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col font-pixel select-none bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Header & Tabs Bar */}
      <div className="bg-[#1f1f1f] border-b-3 border-[#121212] px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="mc-badge-btn text-2xl px-4 py-1 flex items-center gap-1.5 text-white"
            onClick={() => {
              sfx.click();
              onBack();
            }}
          >
            ← Volver
          </button>
          <h1 className="text-4xl text-white font-bold tracking-wider drop-shadow-[2px_2px_0_#000000]">
            JUGAR
          </h1>
        </div>

        {/* Top Tabs (Bedrock layout) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-6 py-1.5 text-2xl font-bold tracking-wide border-2 border-black transition-all ${
              activeTab === "worlds"
                ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300 shadow-[2px_2px_0_#000000]"
                : "bg-[#3c3c3c] text-neutral-300 hover:bg-[#484848]"
            }`}
            onClick={() => {
              sfx.click();
              setActiveTab("worlds");
            }}
          >
            Mundos ({worlds.length})
          </button>
          <button
            type="button"
            className={`px-6 py-1.5 text-2xl font-bold tracking-wide border-2 border-black transition-all opacity-60 cursor-not-allowed ${
              activeTab === "friends"
                ? "bg-[#4a8a3a] text-yellow-200"
                : "bg-[#3c3c3c] text-neutral-400"
            }`}
            onClick={() => sfx.click()}
            title="Próximamente"
          >
            Amigos (0)
          </button>
          <button
            type="button"
            className={`px-6 py-1.5 text-2xl font-bold tracking-wide border-2 border-black transition-all ${
              activeTab === "servers"
                ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300 shadow-[2px_2px_0_#000000]"
                : "bg-[#3c3c3c] text-neutral-300 hover:bg-[#484848]"
            }`}
            onClick={() => {
              sfx.click();
              setActiveTab("servers");
            }}
          >
            Servidores
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
        {activeTab === "worlds" && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#242424] p-4 border-2 border-black/40 shadow-sm">
              <button
                type="button"
                className="mc-button text-2xl py-2 px-6 bg-[#3a752a] hover:bg-[#488e35] text-white border-green-950 font-bold"
                onClick={() => {
                  sfx.click();
                  setShowCreateModal(true);
                }}
              >
                + Crear nuevo mundo
              </button>

              <div className="flex items-center gap-2">
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  className="mc-button text-xl py-2 px-4 min-w-0 bg-[#424242]"
                  onClick={() => {
                    sfx.click();
                    importFileRef.current?.click();
                  }}
                  title="Importar un archivo JSON de mundo"
                >
                  📥 Importar mundo
                </button>
              </div>
            </div>

            {/* World List */}
            {loading ? (
              <div className="text-center py-16 text-3xl text-neutral-400 animate-pulse">
                Cargando mundos guardados...
              </div>
            ) : worlds.length === 0 ? (
              <div className="text-center py-16 bg-[#222222] border-2 border-black/30 p-8">
                <p className="text-3xl text-yellow-300 font-bold mb-2">No tienes mundos creados</p>
                <p className="text-xl text-neutral-400 mb-6">
                  Crea tu primer mundo para comenzar tu aventura en VoxelCraft.
                </p>
                <button
                  type="button"
                  className="mc-button text-2xl py-2 px-8"
                  onClick={() => setShowCreateModal(true)}
                >
                  Crear nuevo mundo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {worlds.map((w) => (
                  <div
                    key={w.id}
                    className="flex flex-col md:flex-row items-stretch justify-between bg-[#2a2a2a] hover:bg-[#323232] border-2 border-black/50 p-3 gap-4 transition-all shadow-[2px_2px_0_#000000]"
                  >
                    {/* Left: Thumbnail & Details */}
                    <div
                      className="flex items-center gap-4 flex-1 cursor-pointer"
                      onClick={() => {
                        sfx.click();
                        onSelectWorld(w);
                      }}
                    >
                      {/* Thumbnail */}
                      <div className="w-24 h-24 bg-[#151515] border-2 border-black flex-shrink-0 flex items-center justify-center overflow-hidden relative shadow-inner">
                        {w.thumbnailDataUrl ? (
                          <img
                            src={w.thumbnailDataUrl}
                            alt={w.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-800 to-amber-950 p-2 text-center text-xs text-white/80">
                            <span className="text-2xl mb-0.5">🌲</span>
                            <span className="truncate w-full font-mono">{w.name}</span>
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-1 text-[10px] bg-black/70 px-1 text-white font-mono">
                          {w.size}
                        </span>
                      </div>

                      {/* Info */}
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white tracking-wide drop-shadow-[2px_2px_0_#000000] hover:text-yellow-300">
                          {w.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-lg">
                          <span
                            className={`px-2 py-0.5 text-base font-bold border border-black/40 ${
                              w.gameMode === "creative"
                                ? "bg-cyan-900/80 text-cyan-200"
                                : "bg-emerald-900/80 text-emerald-200"
                            }`}
                          >
                            {w.gameMode === "creative" ? "Creativo" : "Supervivencia"}
                          </span>
                          <span className="text-neutral-400">· {formatDate(w.lastPlayed)}</span>
                          <span className="text-neutral-500 text-sm">Semilla: {w.seed}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-center md:self-auto">
                      <button
                        type="button"
                        className="mc-button text-2xl py-2 px-6 min-w-0 bg-[#3a752a] hover:bg-[#488e35] text-white"
                        onClick={() => {
                          sfx.click();
                          onSelectWorld(w);
                        }}
                      >
                        ▶ Jugar
                      </button>
                      <button
                        type="button"
                        className="mc-badge-btn text-xl px-3 py-2 text-neutral-300 hover:text-white"
                        onClick={() => {
                          sfx.click();
                          exportWorldJson(w);
                        }}
                        title="Exportar archivo de respaldo"
                      >
                        💾 Exportar
                      </button>
                      <button
                        type="button"
                        className="mc-badge-btn text-xl px-3 py-2 text-red-400 hover:bg-red-900/50 hover:text-red-200"
                        onClick={() => {
                          sfx.click();
                          setDeleteTarget(w);
                        }}
                        title="Eliminar mundo permanentemente"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Servers / Multiplayer Tab */}
        {activeTab === "servers" && (
          <div className="bg-[#242424] border-2 border-black/40 p-6 space-y-6">
            <h2 className="text-3xl font-bold text-white drop-shadow-[2px_2px_0_#000000] flex items-center gap-2">
              <span>🌐</span> UNIRSE A SALA MULTIJUGADOR
            </h2>
            <p className="text-xl text-neutral-300">
              Conéctate a una sala compartida con amigos utilizando el código de sala o crea una
              partida online directamente desde el juego.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="block text-xl text-white font-bold mb-1">Tu nombre:</label>
                <input
                  type="text"
                  maxLength={16}
                  value={serverName}
                  onChange={(e) => {
                    setServerName(e.target.value);
                    localStorage.setItem("mc_player_name", e.target.value);
                  }}
                  className="mc-input-field text-xl"
                  placeholder="Steve"
                />
              </div>

              <div>
                <label className="block text-xl text-white font-bold mb-1">Código de sala:</label>
                <input
                  type="text"
                  maxLength={12}
                  value={serverCode}
                  onChange={(e) => setServerCode(e.target.value.toUpperCase())}
                  className="mc-input-field text-xl uppercase font-mono tracking-wider"
                  placeholder="Ej: CRAFT-9A2"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                className="mc-button text-2xl py-2 px-8 min-w-[16rem]"
                disabled={!serverCode.trim()}
                onClick={() => {
                  sfx.click();
                  if (onJoinServer && serverCode.trim()) {
                    onJoinServer(serverCode.trim(), serverName.trim() || "Steve");
                  }
                }}
              >
                Conectar a la sala
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear Mundo */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg bg-[#282828] border-3 border-[#1a1a1a] shadow-[inset_2px_2px_0_#505050,inset_-2px_-2px_0_#151515,0_10px_30px_rgba(0,0,0,0.85)] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-black/40 pb-2">
              <h3 className="text-3xl font-bold text-white tracking-wide drop-shadow-[2px_2px_0_#000000]">
                CREAR NUEVO MUNDO
              </h3>
              <button
                type="button"
                className="mc-badge-btn text-xl px-2.5 py-0.5"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xl font-bold text-white mb-1">Nombre del mundo:</label>
              <input
                type="text"
                maxLength={30}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mc-input-field text-xl"
                placeholder="Mi nuevo mundo"
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-white mb-1">Modo de juego:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`py-2 text-xl font-bold border-2 border-black ${
                    newMode === "survival"
                      ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300"
                      : "bg-[#3c3c3c] text-neutral-400"
                  }`}
                  onClick={() => {
                    sfx.click();
                    setNewMode("survival");
                  }}
                >
                  ⚔️ Supervivencia
                </button>
                <button
                  type="button"
                  className={`py-2 text-xl font-bold border-2 border-black ${
                    newMode === "creative"
                      ? "bg-[#4a8a3a] text-yellow-200 border-yellow-300"
                      : "bg-[#3c3c3c] text-neutral-400"
                  }`}
                  onClick={() => {
                    sfx.click();
                    setNewMode("creative");
                  }}
                >
                  🧱 Creativo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xl font-bold text-white mb-1">Semilla (opcional):</label>
              <input
                type="number"
                value={newSeed}
                onChange={(e) => setNewSeed(e.target.value)}
                className="mc-input-field text-xl font-mono"
                placeholder="Dejar vacío para semilla aleatoria"
              />
            </div>

            <div className="pt-3 border-t-2 border-black/30 flex justify-end gap-3">
              <button
                type="button"
                className="mc-button text-xl py-2 px-6 min-w-0 bg-[#444444]"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mc-button text-xl py-2 px-8 min-w-0 bg-[#3a752a] text-white"
                onClick={handleCreate}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md bg-[#282828] border-3 border-red-800 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-3xl font-bold text-red-400 tracking-wide">
              ¿Eliminar "{deleteTarget.name}"?
            </h3>
            <p className="text-xl text-neutral-200 leading-relaxed">
              ¿Estás seguro de que deseas eliminar este mundo? Esta acción es irreversible y se
              perderán todas las construcciones.
            </p>
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                className="mc-button text-xl py-2 px-6 min-w-0 bg-[#444444]"
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mc-button text-xl py-2 px-6 min-w-0 bg-red-800 hover:bg-red-700 text-white"
                onClick={() => handleDelete(deleteTarget.id)}
              >
                Eliminar para siempre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

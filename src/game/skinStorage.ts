const SKIN_KEY = "voxelcraft_custom_skin_v1";
const NAME_KEY = "mc_player_name";

export function getStoredPlayerName(): string {
  if (typeof localStorage === "undefined") return "Steve";
  return localStorage.getItem(NAME_KEY) || "Steve";
}

export function setStoredPlayerName(name: string) {
  if (typeof localStorage === "undefined") return;
  const clean = name.trim().slice(0, 16) || "Steve";
  localStorage.setItem(NAME_KEY, clean);
}

export function getStoredCustomSkin(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SKIN_KEY) || null;
}

export function setStoredCustomSkin(dataUrl: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SKIN_KEY, dataUrl);
  } catch (err) {
    console.warn("Could not save custom skin to localStorage:", err);
  }
}

export function resetCustomSkin() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SKIN_KEY);
}

export interface GameSettings {
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  renderDistance: number; // 4, 6, 8, 12
  fov: number; // 60..100 (default 75)
  viewBobbing: boolean;
  mouseSensitivity: number; // 0.2..3.0 (default 1.0)
  invertY: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.9,
  renderDistance: 6,
  fov: 75,
  viewBobbing: true,
  mouseSensitivity: 1.0,
  invertY: false,
};

const SETTINGS_KEY = "voxelcraft_settings_v1";

export function getSettings(): GameSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(partial: Partial<GameSettings>): GameSettings {
  const current = getSettings();
  const updated: GameSettings = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota
  }
  return updated;
}

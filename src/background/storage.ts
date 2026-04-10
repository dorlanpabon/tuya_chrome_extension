import type {
  ActionLogEntry,
  AppConfig,
  ChannelAlias,
  Device,
  DeviceAlias,
  LocalStorageShape,
  SyncStorageShape,
  UiPreferences,
} from "../shared/models";
import { DEFAULT_CONFIG, DEFAULT_UI_PREFERENCES } from "../shared/models";

const SYNC_DEFAULTS: SyncStorageShape = {
  config: null,
  deviceAliases: [],
  channelAliases: [],
  uiPreferences: DEFAULT_UI_PREFERENCES,
};

const LOCAL_DEFAULTS: LocalStorageShape = {
  cachedDevices: [],
  actionLog: [],
};

export async function loadSyncState(): Promise<SyncStorageShape> {
  const result = await chrome.storage.sync.get(
    SYNC_DEFAULTS as unknown as Record<string, unknown>,
  );
  return {
    config: normalizeConfig(result.config),
    deviceAliases: normalizeArray<DeviceAlias>(result.deviceAliases),
    channelAliases: normalizeArray<ChannelAlias>(result.channelAliases),
    uiPreferences: normalizeUiPreferences(result.uiPreferences),
  };
}

export async function loadLocalState(): Promise<LocalStorageShape> {
  const result = await chrome.storage.local.get(
    LOCAL_DEFAULTS as unknown as Record<string, unknown>,
  );
  return {
    cachedDevices: normalizeArray<Device>(result.cachedDevices),
    actionLog: normalizeArray<ActionLogEntry>(result.actionLog),
  };
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const normalized = normalizeConfig(config) ?? { ...DEFAULT_CONFIG };
  await chrome.storage.sync.set({ config: normalized });
  return normalized;
}

export async function saveUiPreferences(
  preferences: UiPreferences,
): Promise<UiPreferences> {
  const normalized = normalizeUiPreferences(preferences);
  await chrome.storage.sync.set({ uiPreferences: normalized });
  return normalized;
}

export async function saveDeviceAlias(entry: DeviceAlias): Promise<void> {
  const state = await loadSyncState();
  const aliases = replaceByKey(
    state.deviceAliases,
    entry,
    (item) => item.deviceId,
  ).filter((item) => item.alias.trim().length > 0);

  await chrome.storage.sync.set({ deviceAliases: aliases });
}

export async function saveChannelAlias(entry: ChannelAlias): Promise<void> {
  const state = await loadSyncState();
  const aliases = replaceByKey(
    state.channelAliases,
    entry,
    (item) => `${item.deviceId}:${item.channelCode}`,
  ).filter((item) => item.alias.trim().length > 0);

  await chrome.storage.sync.set({ channelAliases: aliases });
}

export async function saveCachedDevices(devices: Device[]): Promise<void> {
  await chrome.storage.local.set({ cachedDevices: devices });
}

export async function appendActionLog(entry: ActionLogEntry): Promise<void> {
  const local = await loadLocalState();
  const actionLog = [entry, ...local.actionLog].slice(0, 30);
  await chrome.storage.local.set({ actionLog });
}

function replaceByKey<T>(
  list: T[],
  value: T,
  resolver: (item: T) => string,
): T[] {
  const key = resolver(value);
  const filtered = list.filter((item) => resolver(item) !== key);
  return [...filtered, value];
}

function normalizeUiPreferences(value: unknown): UiPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_UI_PREFERENCES };
  }

  const raw = value as Partial<UiPreferences>;
  return {
    viewMode: raw.viewMode === "developer" ? "developer" : "user",
    deviceOrder: Array.isArray(raw.deviceOrder)
      ? raw.deviceOrder
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          .map((entry) => entry.trim())
      : [],
  };
}

function normalizeConfig(value: unknown): AppConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<AppConfig>;
  return {
    clientId: String(raw.clientId ?? ""),
    clientSecret: String(raw.clientSecret ?? ""),
    baseUrl: String(raw.baseUrl ?? DEFAULT_CONFIG.baseUrl),
    regionLabel: String(raw.regionLabel ?? DEFAULT_CONFIG.regionLabel),
  };
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

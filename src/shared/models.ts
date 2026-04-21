export type UiLocale = "system" | "en" | "es";

export interface AppConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  regionLabel: string;
}

export interface MaskedAppConfig {
  clientId: string;
  clientSecretMasked: string;
  clientSecretPresent: boolean;
  baseUrl: string;
  regionLabel: string;
}

export interface DeviceAlias {
  deviceId: string;
  alias: string;
}

export interface ChannelAlias {
  deviceId: string;
  channelCode: string;
  alias: string;
}

export interface UiPreferences {
  viewMode: "user" | "developer";
  deviceOrder: string[];
  favoriteDeviceIds: string[];
  locale: UiLocale;
  autoRefreshSeconds: 0 | 15 | 30 | 60;
}

export interface TuyaFunction {
  code: string;
  valueType?: string | null;
  values?: unknown;
  mode?: string | null;
  support?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface TuyaStatus {
  code: string;
  value: unknown;
}

export interface DeviceChannel {
  code: string;
  displayName: string;
  index: number;
  currentState: boolean | null;
  controllable: boolean;
  alias?: string | null;
}

export interface Device {
  id: string;
  name: string;
  online: boolean;
  category?: string | null;
  productId?: string | null;
  inferredType: string;
  gangCount: number;
  channels: DeviceChannel[];
  raw: {
    summary: unknown;
    functions: TuyaFunction[];
    status: TuyaStatus[];
    capabilities: TuyaFunction[];
  };
  metadata?: {
    alias?: string | null;
  } | null;
}

export interface ConnectionStatus {
  state: "needs_config" | "connected" | "error";
  message?: string | null;
  lastCheckedAt?: number | null;
}

export interface ActionLogEntry {
  timestampMs: number;
  action: string;
  deviceId?: string | null;
  deviceName?: string | null;
  channelCode?: string | null;
  success: boolean;
  message: string;
}

export interface BootstrapPayload {
  hasConfig: boolean;
  config: MaskedAppConfig | null;
  configDraft: AppConfig;
  uiPreferences: UiPreferences;
  devices: Device[];
  actionLog: ActionLogEntry[];
  connection: ConnectionStatus;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  baseUrl: string;
  regionLabel: string;
  deviceCount: number;
}

export interface ToggleChannelPayload {
  deviceId: string;
  channelCode: string;
  value: boolean;
}

export interface SetDeviceChannelsPayload {
  deviceId: string;
  value: boolean;
}

export interface ToggleChannelResult {
  deviceId: string;
  statuses: TuyaStatus[];
  actionLogEntry: ActionLogEntry;
}

export interface SetDeviceChannelsResult {
  deviceId: string;
  statuses: TuyaStatus[];
  actionLogEntry: ActionLogEntry;
}

export interface SaveDeviceAliasPayload {
  deviceId: string;
  alias: string;
}

export interface SaveChannelAliasPayload {
  deviceId: string;
  channelCode: string;
  alias: string;
}

export interface SyncStorageShape {
  config: AppConfig | null;
  deviceAliases: DeviceAlias[];
  channelAliases: ChannelAlias[];
  uiPreferences: UiPreferences;
}

export interface LocalStorageShape {
  cachedDevices: Device[];
  actionLog: ActionLogEntry[];
}

export type RuntimeRequest =
  | { type: "bootstrap" }
  | { type: "test-connection"; payload: AppConfig }
  | { type: "save-config"; payload: AppConfig }
  | { type: "refresh-devices" }
  | { type: "toggle-channel"; payload: ToggleChannelPayload }
  | { type: "set-device-channels"; payload: SetDeviceChannelsPayload }
  | { type: "save-ui-preferences"; payload: UiPreferences }
  | { type: "save-device-alias"; payload: SaveDeviceAliasPayload }
  | { type: "save-channel-alias"; payload: SaveChannelAliasPayload };

export interface RuntimeErrorPayload {
  code: string;
  message: string;
}

export interface RuntimeEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: RuntimeErrorPayload;
}

export const DEFAULT_CONFIG: AppConfig = {
  clientId: "",
  clientSecret: "",
  baseUrl: "https://openapi.tuyaus.com",
  regionLabel: "Western America Data Center",
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  viewMode: "user",
  deviceOrder: [],
  favoriteDeviceIds: [],
  locale: "system",
  autoRefreshSeconds: 0,
};

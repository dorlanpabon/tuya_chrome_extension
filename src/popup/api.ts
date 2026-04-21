import type {
  AppConfig,
  BootstrapPayload,
  ConnectionTestResult,
  Device,
  RuntimeEnvelope,
  RuntimeRequest,
  SaveChannelAliasPayload,
  SaveDeviceAliasPayload,
  SetDeviceChannelsPayload,
  SetDeviceChannelsResult,
  ToggleChannelPayload,
  ToggleChannelResult,
  UiPreferences,
} from "../shared/models";

async function sendMessage<T>(request: RuntimeRequest): Promise<T> {
  const envelope = (await chrome.runtime.sendMessage(request)) as RuntimeEnvelope<T>;

  if (!envelope?.ok) {
    throw new Error(envelope?.error?.message ?? "Extension request failed.");
  }

  return envelope.data as T;
}

export const extensionApi = {
  bootstrap(): Promise<BootstrapPayload> {
    return sendMessage({ type: "bootstrap" });
  },
  testConnection(payload: AppConfig): Promise<ConnectionTestResult> {
    return sendMessage({ type: "test-connection", payload });
  },
  saveConfig(payload: AppConfig): Promise<AppConfig> {
    return sendMessage({ type: "save-config", payload });
  },
  refreshDevices(): Promise<Device[]> {
    return sendMessage({ type: "refresh-devices" });
  },
  toggleChannel(payload: ToggleChannelPayload): Promise<ToggleChannelResult> {
    return sendMessage({ type: "toggle-channel", payload });
  },
  setDeviceChannels(payload: SetDeviceChannelsPayload): Promise<SetDeviceChannelsResult> {
    return sendMessage({ type: "set-device-channels", payload });
  },
  saveUiPreferences(payload: UiPreferences): Promise<UiPreferences> {
    return sendMessage({ type: "save-ui-preferences", payload });
  },
  saveDeviceAlias(payload: SaveDeviceAliasPayload): Promise<void> {
    return sendMessage({ type: "save-device-alias", payload });
  },
  saveChannelAlias(payload: SaveChannelAliasPayload): Promise<void> {
    return sendMessage({ type: "save-channel-alias", payload });
  },
};

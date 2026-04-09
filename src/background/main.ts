import {
  appendActionLog,
  loadLocalState,
  loadSyncState,
  saveCachedDevices,
  saveChannelAlias,
  saveConfig,
  saveDeviceAlias,
  saveUiPreferences,
} from "./storage";
import { listDevices, testConnection, toggleChannel } from "./tuya";
import type {
  BootstrapPayload,
  ConnectionStatus,
  RuntimeEnvelope,
  RuntimeRequest,
} from "../shared/models";
import { DEFAULT_CONFIG } from "../shared/models";

chrome.runtime.onInstalled.addListener(() => {
  console.info("Tuya Desk extension installed");
});

chrome.runtime.onMessage.addListener((request: RuntimeRequest, _sender, sendResponse) => {
  void handleRequest(request)
    .then((data) => sendResponse({ ok: true, data } satisfies RuntimeEnvelope<unknown>))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: {
          code: "runtime_error",
          message: error instanceof Error ? error.message : "Unexpected extension error.",
        },
      } satisfies RuntimeEnvelope<unknown>),
    );

  return true;
});

async function handleRequest(request: RuntimeRequest): Promise<unknown> {
  switch (request.type) {
    case "bootstrap":
      return bootstrap();
    case "test-connection":
      ensureConfig(request.payload);
      return testConnection(request.payload);
    case "save-config":
      ensureConfig(request.payload);
      return saveConfig(request.payload);
    case "refresh-devices": {
      const syncState = await loadSyncState();
      const config = syncState.config;
      if (!config) {
        throw new Error("Save your Tuya credentials first.");
      }

      const devices = await listDevices(config, syncState);
      await saveCachedDevices(devices);
      return devices;
    }
    case "toggle-channel": {
      const syncState = await loadSyncState();
      const config = syncState.config;
      if (!config) {
        throw new Error("Save your Tuya credentials first.");
      }

      const result = await toggleChannel(config, syncState, request.payload);
      const localState = await loadLocalState();
      const cachedDevices = applyStatusesToDevices(
        localState.cachedDevices,
        result.deviceId,
        result.statuses,
      );

      await saveCachedDevices(cachedDevices);
      await appendActionLog(result.actionLogEntry);
      return result;
    }
    case "save-ui-preferences":
      return saveUiPreferences(request.payload);
    case "save-device-alias":
      return saveDeviceAlias(request.payload);
    case "save-channel-alias":
      return saveChannelAlias(request.payload);
    default:
      throw new Error("Unsupported runtime request.");
  }
}

async function bootstrap(): Promise<BootstrapPayload> {
  const [syncState, localState] = await Promise.all([loadSyncState(), loadLocalState()]);
  const config = syncState.config;

  return {
    hasConfig: Boolean(config),
    config: config ? maskConfig(config) : null,
    configDraft: config ?? { ...DEFAULT_CONFIG },
    uiPreferences: syncState.uiPreferences,
    devices: localState.cachedDevices,
    actionLog: localState.actionLog,
    connection: buildConnectionStatus(Boolean(config), localState.cachedDevices.length > 0),
  };
}

function buildConnectionStatus(hasConfig: boolean, hasCachedDevices: boolean): ConnectionStatus {
  if (!hasConfig) {
    return {
      state: "needs_config",
      message: "Save your Tuya credentials to continue.",
      lastCheckedAt: null,
    };
  }

  return {
    state: "connected",
    message: hasCachedDevices
      ? "Loaded synced settings and cached devices."
      : "Synced settings loaded. Refresh to fetch devices.",
    lastCheckedAt: Date.now(),
  };
}

function maskConfig(config: {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  regionLabel: string;
}) {
  const suffix = config.clientSecret.slice(-4);
  return {
    clientId: config.clientId,
    clientSecretMasked: config.clientSecret ? `****${suffix}` : "",
    clientSecretPresent: config.clientSecret.length > 0,
    baseUrl: config.baseUrl,
    regionLabel: config.regionLabel,
  };
}

function ensureConfig(config: {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  regionLabel: string;
}) {
  if (
    !config.clientId.trim() ||
    !config.clientSecret.trim() ||
    !config.baseUrl.trim() ||
    !config.regionLabel.trim()
  ) {
    throw new Error("Client id, client secret, base URL and region label are required.");
  }
}

function applyStatusesToDevices(
  devices: BootstrapPayload["devices"],
  deviceId: string,
  statuses: { code: string; value: unknown }[],
) {
  return devices.map((device) => {
    if (device.id !== deviceId) {
      return device;
    }

    return {
      ...device,
      channels: device.channels.map((channel) => {
        const status = statuses.find((entry) => entry.code === channel.code);
        return {
          ...channel,
          currentState:
            typeof status?.value === "boolean"
              ? status.value
              : channel.currentState,
        };
      }),
      raw: {
        ...device.raw,
        status: statuses,
      },
    };
  });
}

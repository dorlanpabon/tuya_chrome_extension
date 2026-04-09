import { useEffect, useMemo, useState } from "preact/hooks";

import { extensionApi } from "./api";
import { filterDevices } from "../shared/filter";
import {
  buildDefaultChannelName,
  formatActionTime,
  formatConnectionState,
  formatDeviceSubtitle,
} from "../shared/format";
import type {
  ActionLogEntry,
  AppConfig,
  BootstrapPayload,
  Device,
  ToggleChannelResult,
  UiPreferences,
} from "../shared/models";
import { DEFAULT_CONFIG, DEFAULT_UI_PREFERENCES } from "../shared/models";

type StatusFilter = "all" | "online" | "offline";
type ToastTone = "success" | "error" | "info";

interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

interface AppState {
  bootstrapping: boolean;
  refreshing: boolean;
  testingConnection: boolean;
  savingConfig: boolean;
  hasConfig: boolean;
  configDraft: AppConfig;
  connection: BootstrapPayload["connection"];
  devices: Device[];
  actionLog: ActionLogEntry[];
  uiPreferences: UiPreferences;
  searchQuery: string;
  statusFilter: StatusFilter;
  busyChannels: Record<string, boolean>;
  toasts: Toast[];
}

const INITIAL_STATE: AppState = {
  bootstrapping: true,
  refreshing: false,
  testingConnection: false,
  savingConfig: false,
  hasConfig: false,
  configDraft: { ...DEFAULT_CONFIG },
  connection: {
    state: "needs_config",
    message: "Save your Tuya credentials to continue.",
  },
  devices: [],
  actionLog: [],
  uiPreferences: DEFAULT_UI_PREFERENCES,
  searchQuery: "",
  statusFilter: "all",
  busyChannels: {},
  toasts: [],
};

export function App() {
  const [state, setState] = useState(INITIAL_STATE);

  const visibleDevices = useMemo(
    () => filterDevices(state.devices, state.searchQuery, state.statusFilter),
    [state.devices, state.searchQuery, state.statusFilter],
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const payload = await extensionApi.bootstrap();
      setState((current) => ({
        ...current,
        bootstrapping: false,
        hasConfig: payload.hasConfig,
        configDraft: payload.configDraft,
        devices: payload.devices,
        actionLog: payload.actionLog,
        uiPreferences: payload.uiPreferences,
        connection: payload.connection,
      }));

      if (payload.hasConfig) {
        void refreshDevices(true);
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        bootstrapping: false,
        connection: {
          state: "error",
          message: toMessage(error),
          lastCheckedAt: Date.now(),
        },
      }));
      pushToast("error", toMessage(error));
    }
  }

  async function refreshDevices(silent = false) {
    setState((current) => ({ ...current, refreshing: true }));
    try {
      const devices = await extensionApi.refreshDevices();
      setState((current) => ({
        ...current,
        refreshing: false,
        hasConfig: true,
        devices,
        connection: {
          state: "connected",
          message: silent ? "Tuya Cloud synced." : "Devices refreshed from Tuya Cloud.",
          lastCheckedAt: Date.now(),
        },
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        refreshing: false,
        connection: {
          state: "error",
          message: toMessage(error),
          lastCheckedAt: Date.now(),
        },
      }));

      if (!silent) {
        pushToast("error", toMessage(error));
      }
    }
  }

  async function testConnection() {
    setState((current) => ({ ...current, testingConnection: true }));
    try {
      const result = await extensionApi.testConnection(state.configDraft);
      setState((current) => ({
        ...current,
        testingConnection: false,
        connection: {
          state: "connected",
          message: `${result.message} ${result.deviceCount} device(s) visible.`,
          lastCheckedAt: Date.now(),
        },
      }));
      pushToast("success", `Connection successful. ${result.deviceCount} device(s) visible.`);
    } catch (error) {
      setState((current) => ({
        ...current,
        testingConnection: false,
        connection: {
          state: "error",
          message: toMessage(error),
          lastCheckedAt: Date.now(),
        },
      }));
      pushToast("error", toMessage(error));
    }
  }

  async function persistConfig() {
    setState((current) => ({ ...current, savingConfig: true }));
    try {
      await extensionApi.saveConfig(state.configDraft);
      setState((current) => ({
        ...current,
        savingConfig: false,
        hasConfig: true,
      }));
      pushToast("success", "Configuration synced with Chrome.");
      await refreshDevices();
    } catch (error) {
      setState((current) => ({ ...current, savingConfig: false }));
      pushToast("error", toMessage(error));
    }
  }

  async function setViewMode(viewMode: UiPreferences["viewMode"]) {
    setState((current) => ({
      ...current,
      uiPreferences: { viewMode },
    }));

    try {
      await extensionApi.saveUiPreferences({ viewMode });
    } catch (error) {
      pushToast("error", toMessage(error));
    }
  }

  async function handleToggle(deviceId: string, channelCode: string, value: boolean) {
    const busyKey = `${deviceId}:${channelCode}`;
    const previousDevices = state.devices;

    setState((current) => ({
      ...current,
      devices: applyOptimisticChannelState(current.devices, deviceId, channelCode, value),
      busyChannels: {
        ...current.busyChannels,
        [busyKey]: true,
      },
    }));

    try {
      const result = await extensionApi.toggleChannel({
        deviceId,
        channelCode,
        value,
      });

      setState((current) => ({
        ...current,
        devices: applyStatusesToDevices(current.devices, result),
        actionLog: [result.actionLogEntry, ...current.actionLog].slice(0, 30),
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        devices: previousDevices,
      }));
      pushToast("error", toMessage(error));
    } finally {
      setState((current) => {
        const busyChannels = { ...current.busyChannels };
        delete busyChannels[busyKey];
        return {
          ...current,
          busyChannels,
        };
      });
    }
  }

  async function handleDeviceAlias(deviceId: string, alias: string) {
    try {
      await extensionApi.saveDeviceAlias({ deviceId, alias });
      setState((current) => ({
        ...current,
        devices: current.devices.map((device) =>
          device.id === deviceId
            ? {
                ...device,
                name: alias.trim() || getCloudName(device),
                metadata: { alias: alias.trim() || null },
              }
            : device,
        ),
      }));
      pushToast("success", "Device alias saved.");
    } catch (error) {
      pushToast("error", toMessage(error));
    }
  }

  async function handleChannelAlias(deviceId: string, channelCode: string, alias: string) {
    try {
      await extensionApi.saveChannelAlias({ deviceId, channelCode, alias });
      setState((current) => ({
        ...current,
        devices: current.devices.map((device) =>
          device.id === deviceId
            ? {
                ...device,
                channels: device.channels.map((channel) =>
                  channel.code === channelCode
                    ? {
                        ...channel,
                        alias: alias.trim() || null,
                        displayName: alias.trim() || buildDefaultChannelName(channel),
                      }
                    : channel,
                ),
              }
            : device,
        ),
      }));
      pushToast("success", "Channel alias saved.");
    } catch (error) {
      pushToast("error", toMessage(error));
    }
  }

  function updateConfig(field: keyof AppConfig, value: string) {
    setState((current) => ({
      ...current,
      configDraft: {
        ...current.configDraft,
        [field]: value,
      },
    }));
  }

  function pushToast(tone: ToastTone, message: string) {
    const id = `${Date.now()}-${Math.random()}`;
    setState((current) => ({
      ...current,
      toasts: [...current.toasts, { id, tone, message }].slice(-3),
    }));

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        toasts: current.toasts.filter((toast) => toast.id !== id),
      }));
    }, 2500);
  }

  return (
    <div class="app-shell">
      <header class={`topbar topbar--${state.uiPreferences.viewMode}`}>
        <div class="topbar__row">
          <div class="brand">
            <div class="brand__mark">{renderSwitchIcon()}</div>
            <div>
              <p class="eyebrow">Chrome sync</p>
              <h1>Tuya Desk</h1>
            </div>
          </div>

          <div class="topbar__actions">
            <div class="segmented">
              <button
                class={state.uiPreferences.viewMode === "user" ? "is-active" : ""}
                onClick={() => void setViewMode("user")}
              >
                User
              </button>
              <button
                class={state.uiPreferences.viewMode === "developer" ? "is-active" : ""}
                onClick={() => void setViewMode("developer")}
              >
                Dev
              </button>
            </div>
            <button class="icon-button" onClick={() => void refreshDevices()}>
              {renderRefreshIcon()}
            </button>
          </div>
        </div>

        <div class="topbar__row topbar__row--lower">
          <div class={`connection-pill connection-pill--${state.connection.state}`}>
            <span class="connection-pill__dot" />
            <span>{formatConnectionState(state.connection.state)}</span>
          </div>

          <label class="search">
            <input
              type="search"
              value={state.searchQuery}
              onInput={(event) =>
                setState((current) => ({
                  ...current,
                  searchQuery: (event.currentTarget as HTMLInputElement).value,
                }))
              }
              placeholder="Search"
            />
          </label>

          <div class="segmented">
            {(["all", "online", "offline"] as const).map((filter) => (
              <button
                class={state.statusFilter === filter ? "is-active" : ""}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    statusFilter: filter,
                  }))
                }
              >
                {filter === "all" ? "All" : filter === "online" ? "On" : "Off"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {state.uiPreferences.viewMode === "developer" && (
        <section class="panel">
          <div class="panel__header">
            <div>
              <h2>Configuration</h2>
              <p>Saved in chrome sync so it follows your signed-in browser.</p>
            </div>
            <span class="sync-pill">{state.hasConfig ? "Synced" : "Not configured"}</span>
          </div>
          <div class="form-grid">
            <label>
              <span>Client ID</span>
              <input
                value={state.configDraft.clientId}
                onInput={(event) =>
                  updateConfig("clientId", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>Client Secret</span>
              <input
                type="password"
                value={state.configDraft.clientSecret}
                onInput={(event) =>
                  updateConfig("clientSecret", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>Base URL</span>
              <input
                value={state.configDraft.baseUrl}
                onInput={(event) =>
                  updateConfig("baseUrl", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>Region</span>
              <input
                value={state.configDraft.regionLabel}
                onInput={(event) =>
                  updateConfig("regionLabel", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
          </div>
          <div class="panel__actions">
            <button
              class="button button--secondary"
              disabled={state.testingConnection}
              onClick={() => void testConnection()}
            >
              {state.testingConnection ? "Testing..." : "Test connection"}
            </button>
            <button
              class="button button--primary"
              disabled={state.savingConfig}
              onClick={() => void persistConfig()}
            >
              {state.savingConfig ? "Saving..." : "Save sync config"}
            </button>
          </div>
        </section>
      )}

      {state.bootstrapping ? (
        <section class="empty-state">
          <strong>Loading extension...</strong>
          <p>Preparing synced config and cached Tuya devices.</p>
        </section>
      ) : !state.hasConfig && state.uiPreferences.viewMode === "user" ? (
        <section class="empty-state">
          <strong>Setup required</strong>
          <p>Switch to Dev mode, save your Tuya credentials, then refresh.</p>
        </section>
      ) : visibleDevices.length === 0 ? (
        <section class="empty-state">
          <strong>No devices</strong>
          <p>{state.refreshing ? "Refreshing devices from Tuya Cloud..." : "No devices match the current view."}</p>
        </section>
      ) : (
        <section class={`device-grid device-grid--${state.uiPreferences.viewMode}`}>
          {visibleDevices.map((device) =>
            state.uiPreferences.viewMode === "user" ? (
              <article class="device-card device-card--user" key={device.id}>
                <div class="device-card__head">
                  <div class="device-card__title">
                    <div class="device-card__icon">{renderSwitchIcon()}</div>
                    <div>
                      <h3>{device.name}</h3>
                      <p>{device.gangCount} ch</p>
                    </div>
                  </div>
                  <span class={`status-chip ${device.online ? "is-online" : "is-offline"}`}>
                    {device.online ? "Online" : "Offline"}
                  </span>
                </div>

                <div class="channel-grid">
                  {device.channels.map((channel) => {
                    const busyKey = `${device.id}:${channel.code}`;
                    const isBusy = Boolean(state.busyChannels[busyKey]);
                    const active = channel.currentState === true;
                    const unknown = channel.currentState === null;
                    return (
                      <button
                        key={channel.code}
                        class={`channel-tile ${active ? "is-on" : "is-off"} ${unknown ? "is-unknown" : ""}`}
                        disabled={isBusy || !device.online || !channel.controllable}
                        onClick={() => void handleToggle(device.id, channel.code, !active)}
                      >
                        <span class="channel-tile__icon">{renderBulbIcon(active)}</span>
                        <span class="channel-tile__label">{channel.displayName}</span>
                        <span class="channel-tile__state">
                          {isBusy ? "..." : unknown ? "?" : active ? "ON" : "OFF"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ) : (
              <article class="device-card device-card--developer" key={device.id}>
                <div class="device-card__head">
                  <div>
                    <h3>{device.name}</h3>
                    <p>{formatDeviceSubtitle(device)}</p>
                  </div>
                  <span class={`status-chip ${device.online ? "is-online" : "is-offline"}`}>
                    {device.online ? "Online" : "Offline"}
                  </span>
                </div>

                <div class="meta-grid">
                  <span><strong>ID</strong> {device.id}</span>
                  <span><strong>Channels</strong> {device.gangCount}</span>
                  <span><strong>Product</strong> {device.productId ?? "n/a"}</span>
                </div>

                <div class="developer-channels">
                  {device.channels.map((channel) => {
                    const busyKey = `${device.id}:${channel.code}`;
                    const isBusy = Boolean(state.busyChannels[busyKey]);
                    const active = channel.currentState === true;
                    const unknown = channel.currentState === null;
                    return (
                      <section class="channel-row" key={channel.code}>
                        <div class="channel-row__copy">
                          <span class="channel-row__glyph">{renderPowerIcon(active)}</span>
                          <div>
                            <strong>{channel.displayName}</strong>
                            <p>{channel.code}{channel.controllable ? "" : " - read only"}</p>
                          </div>
                        </div>
                        <button
                          class={`button ${active ? "button--danger" : "button--primary"}`}
                          disabled={isBusy || !device.online || !channel.controllable}
                          onClick={() => void handleToggle(device.id, channel.code, !active)}
                        >
                          {isBusy ? "Sending..." : unknown ? "Set" : active ? "Turn off" : "Turn on"}
                        </button>
                      </section>
                    );
                  })}
                </div>

                <div class="alias-box">
                  <AliasForm
                    label="Device alias"
                    value={device.metadata?.alias ?? ""}
                    onSave={(value) => handleDeviceAlias(device.id, value)}
                  />
                  {device.channels.map((channel) => (
                    <AliasForm
                      key={channel.code}
                      label={channel.code}
                      value={channel.alias ?? ""}
                      onSave={(value) => handleChannelAlias(device.id, channel.code, value)}
                    />
                  ))}
                </div>
              </article>
            ),
          )}
        </section>
      )}

      {state.uiPreferences.viewMode === "developer" && state.actionLog.length > 0 && (
        <section class="panel">
          <div class="panel__header">
            <div>
              <h2>Recent actions</h2>
              <p>Local developer log.</p>
            </div>
          </div>
          <div class="action-log">
            {state.actionLog.map((entry) => (
              <div class="action-log__item" key={`${entry.timestampMs}-${entry.message}`}>
                <div>
                  <strong>{entry.message}</strong>
                  <p>
                    {entry.deviceId ?? "n/a"}
                    {entry.channelCode ? ` - ${entry.channelCode}` : ""}
                  </p>
                </div>
                <span>{formatActionTime(entry)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div class="toast-stack">
        {state.toasts.map((toast) => (
          <div class={`toast toast--${toast.tone}`} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function AliasForm(props: {
  label: string;
  value: string;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(props.value);

  useEffect(() => {
    setValue(props.value);
  }, [props.value]);

  return (
    <form
      class="alias-form"
      onSubmit={(event) => {
        event.preventDefault();
        void props.onSave(value);
      }}
    >
      <label>
        <span>{props.label}</span>
        <div class="alias-form__row">
          <input
            value={value}
            onInput={(event) => setValue((event.currentTarget as HTMLInputElement).value)}
            placeholder="Optional alias"
          />
          <button class="button button--secondary" type="submit">
            Save
          </button>
        </div>
      </label>
    </form>
  );
}

function applyOptimisticChannelState(
  devices: Device[],
  deviceId: string,
  channelCode: string,
  value: boolean,
): Device[] {
  return devices.map((device) =>
    device.id === deviceId
      ? {
          ...device,
          channels: device.channels.map((channel) =>
            channel.code === channelCode
              ? { ...channel, currentState: value }
              : channel,
          ),
        }
      : device,
  );
}

function applyStatusesToDevices(
  devices: Device[],
  result: ToggleChannelResult,
): Device[] {
  return devices.map((device) =>
    device.id === result.deviceId
      ? {
          ...device,
          channels: device.channels.map((channel) => {
            const status = result.statuses.find((entry) => entry.code === channel.code);
            return {
              ...channel,
              currentState:
                typeof status?.value === "boolean"
                  ? status.value
                  : channel.currentState,
            };
          }),
        }
      : device,
  );
}

function getCloudName(device: Device): string {
  const summary = device.raw.summary as { name?: unknown } | undefined;
  return typeof summary?.name === "string" && summary.name.trim().length > 0
    ? summary.name
    : device.name;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected extension error.";
}

function renderSwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="3.5" width="12" height="17" rx="2.8" />
      <path d="M12 7v10" />
      <circle cx="9" cy="18" r="0.7" />
      <circle cx="15" cy="18" r="0.7" />
    </svg>
  );
}

function renderBulbIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8.8 14.5c-.9-.8-1.8-2-1.8-4a5 5 0 1 1 10 0c0 2-1 3.2-1.8 4" />
      <path d="M10 14.8h4" />
      <circle cx="12" cy="10.5" r={active ? "1.2" : "0.7"} />
    </svg>
  );
}

function renderPowerIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v7" />
      <path d="M7.8 5.8A8 8 0 1 0 16.2 5.8" />
      {active ? <circle cx="12" cy="14" r="1.1" /> : null}
    </svg>
  );
}

function renderRefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.8-4" />
      <path d="M4 5v4h4" />
      <path d="M4 13a8 8 0 0 0 14.8 4" />
      <path d="M20 19v-4h-4" />
    </svg>
  );
}

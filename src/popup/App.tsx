import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { extensionApi } from "./api";
import { filterDevices, orderDevices } from "../shared/filter";
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

const TUYA_PLATFORM_URL = "https://platform.tuya.com/";
const TUYA_KEYS_DOCS_URL =
  "https://developer.tuya.com/en/docs/iot/device-control-best-practice-nodejs?_source=751e806efb9d0a8cb3793945cccdc47e&id=Kaunfr776vomb";
const TUYA_LINK_DEVICES_URL =
  "https://developer.tuya.com/en/docs/iot/link-devices?_source=0d3f09cd9c61de21759f60ac3a058d51&id=Ka471nu1sfmkl";

interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

interface AppState {
  bootstrapping: boolean;
  refreshing: boolean;
  showingCachedState: boolean;
  orderEditorOpen: boolean;
  settingsOpen: boolean;
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
  showingCachedState: false,
  orderEditorOpen: false,
  settingsOpen: false,
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

const SILENT_REFRESH_COOLDOWN_MS = 1_500;

export function App() {
  const [state, setState] = useState(INITIAL_STATE);
  const lastSilentRefreshAtRef = useRef(0);
  const silentRefreshInFlightRef = useRef(false);
  const showSetup = !state.bootstrapping && !state.hasConfig;
  const showConfigPanel =
    !state.bootstrapping &&
    (showSetup || state.settingsOpen || state.uiPreferences.viewMode === "developer");
  const orderedDevices = useMemo(
    () => orderDevices(state.devices, state.uiPreferences.deviceOrder),
    [state.devices, state.uiPreferences.deviceOrder],
  );

  const visibleDevices = useMemo(
    () => filterDevices(orderedDevices, state.searchQuery, state.statusFilter),
    [orderedDevices, state.searchQuery, state.statusFilter],
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!state.hasConfig || state.bootstrapping) {
      return undefined;
    }

    const syncVisibleState = () => {
      if (document.visibilityState === "visible") {
        void requestSilentRefresh();
      }
    };

    window.addEventListener("focus", syncVisibleState);
    document.addEventListener("visibilitychange", syncVisibleState);
    return () => {
      window.removeEventListener("focus", syncVisibleState);
      document.removeEventListener("visibilitychange", syncVisibleState);
    };
  }, [state.hasConfig, state.bootstrapping]);

  async function bootstrap() {
    try {
      const payload = await extensionApi.bootstrap();
      const hasCachedDevices = payload.devices.length > 0;
      const shouldSyncLiveState = payload.hasConfig;
      setState((current) => ({
        ...current,
        bootstrapping: false,
        refreshing: shouldSyncLiveState,
        showingCachedState: shouldSyncLiveState && hasCachedDevices,
        hasConfig: payload.hasConfig,
        configDraft: payload.configDraft,
        devices: payload.devices,
        actionLog: payload.actionLog,
        uiPreferences: payload.uiPreferences,
        connection: shouldSyncLiveState
          ? {
              state: "connected",
              message: hasCachedDevices
                ? "Showing cached state while checking Tuya Cloud."
                : "Connecting to Tuya Cloud...",
              lastCheckedAt: payload.connection.lastCheckedAt,
            }
          : payload.connection,
      }));

      if (shouldSyncLiveState) {
        void requestSilentRefresh(true);
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

  async function requestSilentRefresh(force = false) {
    if (silentRefreshInFlightRef.current || state.refreshing) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastSilentRefreshAtRef.current < SILENT_REFRESH_COOLDOWN_MS) {
      return;
    }

    silentRefreshInFlightRef.current = true;
    lastSilentRefreshAtRef.current = now;

    try {
      await refreshDevices(true);
    } finally {
      silentRefreshInFlightRef.current = false;
    }
  }

  async function refreshDevices(silent = false) {
    setState((current) => ({
      ...current,
      refreshing: true,
      showingCachedState: silent && current.devices.length > 0,
      connection:
        silent && current.hasConfig
          ? {
              state: "connected",
              message:
                current.devices.length > 0
                  ? "Showing cached state while checking Tuya Cloud."
                  : "Loading devices from Tuya Cloud...",
              lastCheckedAt: current.connection.lastCheckedAt ?? null,
            }
          : current.connection,
    }));
    try {
      const devices = await extensionApi.refreshDevices();
      setState((current) => ({
        ...current,
        refreshing: false,
        showingCachedState: false,
        hasConfig: true,
        devices,
        connection: {
          state: "connected",
          message: silent ? "Live state synced." : "Devices refreshed from Tuya Cloud.",
          lastCheckedAt: Date.now(),
        },
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        refreshing: false,
        showingCachedState: silent && current.devices.length > 0,
        connection: {
          state: "error",
          message:
            silent && current.devices.length > 0
              ? "Unable to refresh live state. Showing cached devices."
              : toMessage(error),
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
        settingsOpen: false,
      }));
      pushToast("success", "Configuration synced with Chrome.");
      await refreshDevices();
    } catch (error) {
      setState((current) => ({ ...current, savingConfig: false }));
      pushToast("error", toMessage(error));
    }
  }

  async function setViewMode(viewMode: UiPreferences["viewMode"]) {
    const nextPreferences = {
      ...state.uiPreferences,
      viewMode,
    };
    setState((current) => ({
      ...current,
      uiPreferences: nextPreferences,
    }));

    try {
      await extensionApi.saveUiPreferences(nextPreferences);
    } catch (error) {
      pushToast("error", toMessage(error));
    }
  }

  async function moveDevice(deviceId: string, direction: -1 | 1) {
    const currentOrder = deriveDeviceOrder(orderedDevices);
    const index = currentOrder.indexOf(deviceId);
    if (index < 0) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(index, 1);
    nextOrder.splice(nextIndex, 0, moved);

    const previousPreferences = state.uiPreferences;
    const nextPreferences = {
      ...state.uiPreferences,
      deviceOrder: nextOrder,
    };

    setState((current) => ({
      ...current,
      uiPreferences: nextPreferences,
    }));

    try {
      await extensionApi.saveUiPreferences(nextPreferences);
    } catch (error) {
      setState((current) => ({
        ...current,
        uiPreferences: previousPreferences,
      }));
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
            <button
              class={`icon-button ${showConfigPanel && !showSetup ? "is-active" : ""}`}
              disabled={state.bootstrapping}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  settingsOpen: !current.settingsOpen,
                  orderEditorOpen: false,
                }))
              }
              title="Configuration"
            >
              {renderSettingsIcon()}
            </button>
            <button
              class={`icon-button ${state.orderEditorOpen ? "is-active" : ""}`}
              disabled={!state.hasConfig || orderedDevices.length < 2}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  settingsOpen: false,
                  orderEditorOpen: !current.orderEditorOpen,
                }))
              }
              title="Organize devices"
            >
              {renderSortIcon()}
            </button>
            <button class="icon-button" disabled={state.refreshing} onClick={() => void refreshDevices()}>
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

      {state.hasConfig && (state.refreshing || state.showingCachedState) && (
        <section class={`sync-banner ${state.refreshing ? "is-active" : ""}`}>
          <span class="sync-banner__dot" />
          <p>
            {state.refreshing
              ? "Checking latest device state in Tuya Cloud..."
              : "Showing cached device state."}
          </p>
        </section>
      )}

      {state.orderEditorOpen && orderedDevices.length > 1 && (
        <section class="panel order-panel">
          <div class="panel__header">
            <div>
              <h2>Device order</h2>
              <p>Move devices and the order is saved to Chrome sync.</p>
            </div>
            <button
              class="icon-button"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  orderEditorOpen: false,
                }))
              }
              title="Close ordering"
            >
              {renderCloseIcon()}
            </button>
          </div>
          <div class="order-list">
            {orderedDevices.map((device, index) => (
              <div class="order-item" key={`order-${device.id}`}>
                <div class="order-item__copy">
                  <strong>{device.name}</strong>
                  <p>{device.gangCount} ch</p>
                </div>
                <div class="order-item__actions">
                  <button
                    class="icon-button"
                    disabled={index === 0}
                    onClick={() => void moveDevice(device.id, -1)}
                    title="Move up"
                  >
                    {renderArrowUpIcon()}
                  </button>
                  <button
                    class="icon-button"
                    disabled={index === orderedDevices.length - 1}
                    onClick={() => void moveDevice(device.id, 1)}
                    title="Move down"
                  >
                    {renderArrowDownIcon()}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showConfigPanel && (
        <section class="panel">
          <div class="panel__header">
            <div>
              <h2>{showSetup ? "First setup" : "Configuration"}</h2>
              <p>
                {showSetup
                  ? "Add your Tuya Cloud credentials to start loading devices."
                  : "Saved in chrome sync so it follows your signed-in browser."}
              </p>
            </div>
            <span class="sync-pill">{state.hasConfig ? "Synced" : "Not configured"}</span>
          </div>
          {showSetup && (
            <div class="setup-links">
              <a class="button button--link" href={TUYA_PLATFORM_URL} target="_blank" rel="noreferrer">
                Open Tuya Platform
              </a>
              <a class="button button--link" href={TUYA_KEYS_DOCS_URL} target="_blank" rel="noreferrer">
                How to get Access ID / Secret
              </a>
              <a class="button button--link" href={TUYA_LINK_DEVICES_URL} target="_blank" rel="noreferrer">
                How to link devices
              </a>
            </div>
          )}
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
      ) : showSetup ? (
        <section class="empty-state">
          <strong>Configure Tuya Cloud first</strong>
          <p>
            Open the Tuya Developer Platform, copy the Access ID and Access Secret from your cloud
            project Overview page, link your Tuya or Smart Life account to the project, and then
            save the credentials here.
          </p>
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

function deriveDeviceOrder(devices: Device[]): string[] {
  return devices.map((device) => device.id);
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

function renderSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
      <path d="M19.4 13.1v-2.2l-2-.5a5.9 5.9 0 0 0-.5-1.2l1.1-1.7-1.6-1.6-1.7 1.1a5.9 5.9 0 0 0-1.2-.5l-.5-2h-2.2l-.5 2a5.9 5.9 0 0 0-1.2.5L7.4 5.9 5.8 7.5l1.1 1.7a5.9 5.9 0 0 0-.5 1.2l-2 .5v2.2l2 .5a5.9 5.9 0 0 0 .5 1.2l-1.1 1.7 1.6 1.6 1.7-1.1a5.9 5.9 0 0 0 1.2.5l.5 2h2.2l.5-2a5.9 5.9 0 0 0 1.2-.5l1.7 1.1 1.6-1.6-1.1-1.7a5.9 5.9 0 0 0 .5-1.2Z" />
    </svg>
  );
}

function renderSortIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10" />
      <path d="M7 12h7" />
      <path d="M7 18h4" />
      <path d="M17 10V5" />
      <path d="M15 7l2-2 2 2" />
    </svg>
  );
}

function renderArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 17V7" />
      <path d="M8 11l4-4 4 4" />
    </svg>
  );
}

function renderArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7v10" />
      <path d="M8 13l4 4 4-4" />
    </svg>
  );
}

function renderCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10" />
      <path d="M17 7L7 17" />
    </svg>
  );
}

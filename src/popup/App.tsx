import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { extensionApi } from "./api";
import { filterDevices, orderDevices } from "../shared/filter";
import {
  buildDefaultChannelName,
  formatActionTime,
  formatConnectionState,
  formatDeviceSubtitle,
} from "../shared/format";
import { resolveLocale, t, type ResolvedLocale } from "../shared/i18n";
import type {
  ActionLogEntry,
  AppConfig,
  BootstrapPayload,
  Device,
  SetDeviceChannelsResult,
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
const AUTO_REFRESH_OPTIONS = [0, 15, 30] as const;

export function App() {
  const [state, setState] = useState(INITIAL_STATE);
  const lastSilentRefreshAtRef = useRef(0);
  const silentRefreshInFlightRef = useRef(false);
  const showSetup = !state.bootstrapping && !state.hasConfig;
  const showConfigPanel =
    !state.bootstrapping &&
    (showSetup || state.settingsOpen || state.uiPreferences.viewMode === "developer");
  const locale = useMemo<ResolvedLocale>(
    () => resolveLocale(state.uiPreferences.locale),
    [state.uiPreferences.locale],
  );
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

  useEffect(() => {
    if (
      !state.hasConfig ||
      state.bootstrapping ||
      state.uiPreferences.autoRefreshSeconds === 0
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void requestSilentRefresh();
      }
    }, state.uiPreferences.autoRefreshSeconds * 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.hasConfig, state.bootstrapping, state.uiPreferences.autoRefreshSeconds, state.refreshing]);

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
                ? t(locale, "cachedCheckingMessage")
                : t(locale, "connectingCloudMessage"),
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
                  ? t(locale, "cachedCheckingMessage")
                  : t(locale, "loadingCloudMessage"),
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
          message: silent ? t(locale, "liveSyncedMessage") : t(locale, "refreshedMessage"),
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
              ? t(locale, "cachedFallbackMessage")
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
          message: t(locale, "connectionSuccess", { count: result.deviceCount }),
          lastCheckedAt: Date.now(),
        },
      }));
      pushToast("success", t(locale, "connectionSuccess", { count: result.deviceCount }));
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
      pushToast("success", t(locale, "configSyncedToast"));
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

  async function setAutoRefreshSeconds(
    autoRefreshSeconds: UiPreferences["autoRefreshSeconds"],
  ) {
    const nextPreferences = {
      ...state.uiPreferences,
      autoRefreshSeconds,
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
        uiPreferences: state.uiPreferences,
      }));
      pushToast("error", toMessage(error));
    }
  }

  async function setLocalePreference(localePreference: UiPreferences["locale"]) {
    const previousPreferences = state.uiPreferences;
    const nextPreferences = {
      ...state.uiPreferences,
      locale: localePreference,
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

  async function handleDeviceChannels(deviceId: string, value: boolean) {
    const device = state.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      return;
    }

    const channelCodes = getControllableChannelCodes(device);
    if (channelCodes.length === 0) {
      return;
    }

    const previousDevices = state.devices;

    setState((current) => {
      const busyChannels = { ...current.busyChannels };
      for (const channelCode of channelCodes) {
        busyChannels[`${deviceId}:${channelCode}`] = true;
      }

      return {
        ...current,
        devices: applyOptimisticDeviceState(current.devices, deviceId, channelCodes, value),
        busyChannels,
      };
    });

    try {
      const result = await extensionApi.setDeviceChannels({
        deviceId,
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
        for (const channelCode of channelCodes) {
          delete busyChannels[`${deviceId}:${channelCode}`];
        }
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
      pushToast("success", t(locale, "deviceAliasSaved"));
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
                        displayName:
                          alias.trim() || buildDefaultChannelName(channel, state.uiPreferences.locale),
                      }
                    : channel,
                ),
              }
            : device,
        ),
      }));
      pushToast("success", t(locale, "channelAliasSaved"));
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
              <p class="eyebrow">{t(locale, "chromeSync")}</p>
              <h1>{t(locale, "appTitle")}</h1>
            </div>
          </div>

          <div class="topbar__actions">
            <div class="segmented">
              <button
                class={state.uiPreferences.viewMode === "user" ? "is-active" : ""}
                onClick={() => void setViewMode("user")}
              >
                {t(locale, "viewUser")}
              </button>
              <button
                class={state.uiPreferences.viewMode === "developer" ? "is-active" : ""}
                onClick={() => void setViewMode("developer")}
              >
                {t(locale, "viewDeveloper")}
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
              title={t(locale, "configTitle")}
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
              title={t(locale, "organizeDevices")}
            >
              {renderSortIcon()}
            </button>
            <button
              class="icon-button"
              disabled={state.refreshing}
              onClick={() => void refreshDevices()}
              title={t(locale, "refreshDevices")}
            >
              {renderRefreshIcon()}
            </button>
          </div>
        </div>

        <div class="topbar__row topbar__row--lower">
          <div class={`connection-pill connection-pill--${state.connection.state}`}>
            <span class="connection-pill__dot" />
            <span>{formatConnectionState(state.connection.state, state.uiPreferences.locale)}</span>
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
              placeholder={t(locale, "searchPlaceholder")}
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
                {filter === "all"
                  ? t(locale, "filterAll")
                  : filter === "online"
                    ? t(locale, "filterOnline")
                    : t(locale, "filterOffline")}
              </button>
            ))}
          </div>
          <div class="segmented segmented--compact" aria-label={t(locale, "autoRefreshTitle")}>
            {AUTO_REFRESH_OPTIONS.map((seconds) => (
              <button
                class={state.uiPreferences.autoRefreshSeconds === seconds ? "is-active" : ""}
                disabled={!state.hasConfig || state.bootstrapping}
                onClick={() => void setAutoRefreshSeconds(seconds)}
                title={t(locale, "autoRefreshTitle")}
              >
                {seconds === 0 ? t(locale, "autoRefreshOff") : `${seconds}s`}
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
              ? t(locale, "syncChecking")
              : t(locale, "syncCached")}
          </p>
        </section>
      )}

      {state.orderEditorOpen && orderedDevices.length > 1 && (
        <section class="panel order-panel">
          <div class="panel__header">
            <div>
              <h2>{t(locale, "deviceOrderTitle")}</h2>
              <p>{t(locale, "deviceOrderCopy")}</p>
            </div>
            <button
              class="icon-button"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  orderEditorOpen: false,
                }))
              }
              title={t(locale, "close")}
            >
              {renderCloseIcon()}
            </button>
          </div>
          <div class="order-list">
            {orderedDevices.map((device, index) => (
              <div class="order-item" key={`order-${device.id}`}>
                <div class="order-item__copy">
                  <strong>{device.name}</strong>
                  <p>{device.gangCount} {t(locale, "channelShort")}</p>
                </div>
                <div class="order-item__actions">
                  <button
                    class="icon-button"
                    disabled={index === 0}
                    onClick={() => void moveDevice(device.id, -1)}
                    title={t(locale, "moveUp")}
                  >
                    {renderArrowUpIcon()}
                  </button>
                  <button
                    class="icon-button"
                    disabled={index === orderedDevices.length - 1}
                    onClick={() => void moveDevice(device.id, 1)}
                    title={t(locale, "moveDown")}
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
              <h2>{showSetup ? t(locale, "setupTitle") : t(locale, "configTitle")}</h2>
              <p>
                {showSetup
                  ? t(locale, "setupDescription")
                  : t(locale, "configDescription")}
              </p>
            </div>
            <span class="sync-pill">{state.hasConfig ? t(locale, "synced") : t(locale, "notConfigured")}</span>
          </div>
          {showSetup && (
            <div class="setup-links">
              <a class="button button--link" href={TUYA_PLATFORM_URL} target="_blank" rel="noreferrer">
                {t(locale, "openTuyaPlatform")}
              </a>
              <a class="button button--link" href={TUYA_KEYS_DOCS_URL} target="_blank" rel="noreferrer">
                {t(locale, "howToGetKeys")}
              </a>
              <a class="button button--link" href={TUYA_LINK_DEVICES_URL} target="_blank" rel="noreferrer">
                {t(locale, "howToLinkDevices")}
              </a>
            </div>
          )}
          <div class="form-grid">
            <label>
              <span>{t(locale, "clientId")}</span>
              <input
                value={state.configDraft.clientId}
                onInput={(event) =>
                  updateConfig("clientId", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>{t(locale, "clientSecret")}</span>
              <input
                type="password"
                value={state.configDraft.clientSecret}
                onInput={(event) =>
                  updateConfig("clientSecret", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>{t(locale, "baseUrl")}</span>
              <input
                value={state.configDraft.baseUrl}
                onInput={(event) =>
                  updateConfig("baseUrl", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>{t(locale, "region")}</span>
              <input
                value={state.configDraft.regionLabel}
                onInput={(event) =>
                  updateConfig("regionLabel", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label>
              <span>{t(locale, "language")}</span>
              <div class="segmented segmented--field">
                {(["system", "es", "en"] as const).map((localeOption) => (
                  <button
                    type="button"
                    class={state.uiPreferences.locale === localeOption ? "is-active" : ""}
                    onClick={() => void setLocalePreference(localeOption)}
                  >
                    {localeOption === "system"
                      ? t(locale, "languageSystem")
                      : localeOption === "es"
                        ? t(locale, "languageSpanish")
                        : t(locale, "languageEnglish")}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <div class="panel__actions">
            <button
              class="button button--secondary"
              disabled={state.testingConnection}
              onClick={() => void testConnection()}
            >
              {state.testingConnection ? t(locale, "testing") : t(locale, "testConnection")}
            </button>
            <button
              class="button button--primary"
              disabled={state.savingConfig}
              onClick={() => void persistConfig()}
            >
              {state.savingConfig ? t(locale, "saving") : t(locale, "saveSyncConfig")}
            </button>
          </div>
        </section>
      )}

      {state.bootstrapping ? (
        <section class="empty-state">
          <strong>{t(locale, "loadingExtension")}</strong>
          <p>{t(locale, "loadingExtensionCopy")}</p>
        </section>
      ) : showSetup ? (
        <section class="empty-state">
          <strong>{t(locale, "configureFirst")}</strong>
          <p>{t(locale, "configureFirstCopy")}</p>
        </section>
      ) : visibleDevices.length === 0 ? (
        <section class="empty-state">
          <strong>{t(locale, "noDevices")}</strong>
          <p>{state.refreshing ? t(locale, "refreshingDevices") : t(locale, "noDevicesMatch")}</p>
        </section>
      ) : (
        <section class={`device-grid device-grid--${state.uiPreferences.viewMode}`}>
          {visibleDevices.map((device) => {
            const controllableChannels = getControllableChannelCodes(device);
            const showBulkActions = controllableChannels.length > 1;
            const deviceBusy = hasBusyChannel(state.busyChannels, device.id, controllableChannels);

            return state.uiPreferences.viewMode === "user" ? (
              <article class="device-card device-card--user" key={device.id}>
                <div class="device-card__head">
                  <div class="device-card__title">
                    <div class="device-card__icon">{renderSwitchIcon()}</div>
                    <div>
                      <h3>{device.name}</h3>
                      <p>{device.gangCount} {t(locale, "channelShort")}</p>
                    </div>
                  </div>
                  <span class={`status-chip ${device.online ? "is-online" : "is-offline"}`}>
                    {device.online ? t(locale, "online") : t(locale, "offline")}
                  </span>
                </div>

                {showBulkActions && (
                  <div class="device-card__bulk-actions">
                    <button
                      class="button button--secondary device-card__bulk-button"
                      disabled={deviceBusy || !device.online}
                      onClick={() => void handleDeviceChannels(device.id, true)}
                    >
                      {deviceBusy ? t(locale, "sending") : t(locale, "allOn")}
                    </button>
                    <button
                      class="button button--secondary device-card__bulk-button"
                      disabled={deviceBusy || !device.online}
                      onClick={() => void handleDeviceChannels(device.id, false)}
                    >
                      {deviceBusy ? t(locale, "sending") : t(locale, "allOff")}
                    </button>
                  </div>
                )}

                <div class="channel-grid">
                  {device.channels.map((channel) => {
                    const busyKey = `${device.id}:${channel.code}`;
                    const isBusy = Boolean(state.busyChannels[busyKey]);
                    const active = channel.currentState === true;
                    const unknown = channel.currentState === null;
                    const channelLabel =
                      channel.alias?.trim() || buildDefaultChannelName(channel, state.uiPreferences.locale);
                    return (
                      <button
                        key={channel.code}
                        class={`channel-tile ${active ? "is-on" : "is-off"} ${unknown ? "is-unknown" : ""}`}
                        disabled={isBusy || !device.online || !channel.controllable}
                        onClick={() => void handleToggle(device.id, channel.code, !active)}
                      >
                        <span class="channel-tile__icon">{renderBulbIcon(active)}</span>
                        <span class="channel-tile__label">{channelLabel}</span>
                        <span class="channel-tile__state">
                          {isBusy
                            ? "..."
                            : unknown
                              ? t(locale, "unknown")
                              : active
                                ? t(locale, "on")
                                : t(locale, "off")}
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
                    <p>{formatDeviceSubtitle(device, state.uiPreferences.locale)}</p>
                  </div>
                  <span class={`status-chip ${device.online ? "is-online" : "is-offline"}`}>
                    {device.online ? t(locale, "online") : t(locale, "offline")}
                  </span>
                </div>

                {showBulkActions && (
                  <div class="device-card__bulk-actions">
                    <button
                      class="button button--secondary device-card__bulk-button"
                      disabled={deviceBusy || !device.online}
                      onClick={() => void handleDeviceChannels(device.id, true)}
                    >
                      {deviceBusy ? t(locale, "sending") : t(locale, "allOn")}
                    </button>
                    <button
                      class="button button--secondary device-card__bulk-button"
                      disabled={deviceBusy || !device.online}
                      onClick={() => void handleDeviceChannels(device.id, false)}
                    >
                      {deviceBusy ? t(locale, "sending") : t(locale, "allOff")}
                    </button>
                  </div>
                )}

                <div class="meta-grid">
                  <span><strong>{t(locale, "deviceId")}</strong> {device.id}</span>
                  <span><strong>{t(locale, "channels")}</strong> {device.gangCount}</span>
                  <span><strong>{t(locale, "product")}</strong> {device.productId ?? t(locale, "notAvailable")}</span>
                </div>

                <div class="developer-channels">
                  {device.channels.map((channel) => {
                    const busyKey = `${device.id}:${channel.code}`;
                    const isBusy = Boolean(state.busyChannels[busyKey]);
                    const active = channel.currentState === true;
                    const unknown = channel.currentState === null;
                    const channelLabel =
                      channel.alias?.trim() || buildDefaultChannelName(channel, state.uiPreferences.locale);
                    return (
                      <section class="channel-row" key={channel.code}>
                        <div class="channel-row__copy">
                          <span class="channel-row__glyph">{renderPowerIcon(active)}</span>
                          <div>
                            <strong>{channelLabel}</strong>
                            <p>{channel.code}{channel.controllable ? "" : ` - ${t(locale, "readOnly")}`}</p>
                          </div>
                        </div>
                        <button
                          class={`button ${active ? "button--danger" : "button--primary"}`}
                          disabled={isBusy || !device.online || !channel.controllable}
                          onClick={() => void handleToggle(device.id, channel.code, !active)}
                        >
                          {isBusy
                            ? t(locale, "sending")
                            : unknown
                              ? t(locale, "set")
                              : active
                                ? t(locale, "turnOff")
                                : t(locale, "turnOn")}
                        </button>
                      </section>
                    );
                  })}
                </div>

                <div class="alias-box">
                  <AliasForm
                    label={t(locale, "deviceAlias")}
                    value={device.metadata?.alias ?? ""}
                    onSave={(value) => handleDeviceAlias(device.id, value)}
                    locale={locale}
                  />
                  {device.channels.map((channel) => (
                    <AliasForm
                      key={channel.code}
                      label={channel.code}
                      value={channel.alias ?? ""}
                      onSave={(value) => handleChannelAlias(device.id, channel.code, value)}
                      locale={locale}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {state.uiPreferences.viewMode === "developer" && state.actionLog.length > 0 && (
        <section class="panel">
          <div class="panel__header">
            <div>
              <h2>{t(locale, "recentActions")}</h2>
              <p>{t(locale, "localDeveloperLog")}</p>
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
  locale: ResolvedLocale;
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
            placeholder={t(props.locale, "optionalAlias")}
          />
          <button class="button button--secondary" type="submit">
            {t(props.locale, "save")}
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
  return applyOptimisticDeviceState(devices, deviceId, [channelCode], value);
}

function applyOptimisticDeviceState(
  devices: Device[],
  deviceId: string,
  channelCodes: string[],
  value: boolean,
): Device[] {
  const channelCodeSet = new Set(channelCodes);
  return devices.map((device) =>
    device.id === deviceId
      ? {
          ...device,
          channels: device.channels.map((channel) =>
            channelCodeSet.has(channel.code)
              ? { ...channel, currentState: value }
              : channel,
          ),
        }
      : device,
  );
}

function applyStatusesToDevices(
  devices: Device[],
  result: ToggleChannelResult | SetDeviceChannelsResult,
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

function getControllableChannelCodes(device: Device): string[] {
  return device.channels
    .filter((channel) => channel.controllable)
    .map((channel) => channel.code);
}

function hasBusyChannel(
  busyChannels: Record<string, boolean>,
  deviceId: string,
  channelCodes: string[],
): boolean {
  return channelCodes.some((channelCode) => busyChannels[`${deviceId}:${channelCode}`]);
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

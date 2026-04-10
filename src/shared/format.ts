import type {
  ActionLogEntry,
  Device,
  DeviceChannel,
  UiLocale,
} from "./models";
import {
  localizeChannelName,
  localizeConnectionState,
  resolveLocale,
  t,
} from "./i18n";

export function formatConnectionState(
  state: "needs_config" | "connected" | "error",
  localePreference: UiLocale,
): string {
  return localizeConnectionState(resolveLocale(localePreference), state);
}

export function formatDeviceSubtitle(device: Device, localePreference: UiLocale): string {
  const locale = resolveLocale(localePreference);
  const parts = [device.inferredType];
  if (device.category) {
    parts.push(t(locale, "category", { value: device.category }));
  }
  return parts.join(" - ");
}

export function formatActionTime(entry: ActionLogEntry): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(entry.timestampMs);
}

export function buildDefaultChannelName(
  channel: DeviceChannel,
  localePreference: UiLocale,
): string {
  return localizeChannelName(resolveLocale(localePreference), channel);
}

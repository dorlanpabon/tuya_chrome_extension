import type {
  ActionLogEntry,
  ConnectionStatus,
  Device,
  DeviceChannel,
} from "./models";

export function formatConnectionState(state: ConnectionStatus["state"]): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "error":
      return "Error";
    case "needs_config":
    default:
      return "Setup";
  }
}

export function formatDeviceSubtitle(device: Device): string {
  const parts = [device.inferredType];
  if (device.category) {
    parts.push(`Category ${device.category}`);
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

export function buildDefaultChannelName(channel: DeviceChannel): string {
  if (channel.code === "switch") {
    return "Main";
  }
  if (channel.code === "switch_led") {
    return "Backlight";
  }
  if (channel.code.startsWith("switch_")) {
    return `Switch ${channel.index}`;
  }
  return channel.displayName;
}

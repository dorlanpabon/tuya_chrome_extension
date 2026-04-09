import type {
  ChannelAlias,
  Device,
  DeviceChannel,
  DeviceAlias,
  TuyaFunction,
  TuyaStatus,
} from "../shared/models";

interface MetadataShape {
  deviceAliases: DeviceAlias[];
  channelAliases: ChannelAlias[];
}

export function normalizeDevice(
  summary: unknown,
  functions: TuyaFunction[],
  status: TuyaStatus[],
  capabilities: TuyaFunction[],
  metadata: MetadataShape,
): Device {
  const summaryRecord = asRecord(summary);
  const id =
    readString(summaryRecord.id) ||
    readString(summaryRecord.device_id) ||
    "unknown-device";
  const cloudName = readString(summaryRecord.name) || "Unnamed device";
  const alias = metadata.deviceAliases.find((entry) => entry.deviceId === id)?.alias?.trim();
  const channels = inferDeviceChannels(id, functions, status, capabilities, metadata);

  return {
    id,
    name: alias || cloudName,
    online: readBoolean(summaryRecord.online) ?? false,
    category: readString(summaryRecord.category) || null,
    productId: readString(summaryRecord.product_id) || null,
    inferredType: inferDeviceType(readString(summaryRecord.category), channels.length),
    gangCount: channels.length,
    channels,
    raw: {
      summary,
      functions,
      status,
      capabilities,
    },
    metadata: {
      alias: alias || null,
    },
  };
}

export function inferDeviceChannels(
  deviceId: string,
  functions: TuyaFunction[],
  status: TuyaStatus[],
  capabilities: TuyaFunction[],
  metadata: MetadataShape,
): DeviceChannel[] {
  const statusMap = new Map(status.map((entry) => [entry.code, entry.value]));
  const functionCodes = new Set(functions.map((entry) => entry.code));
  const capabilityCodes = new Set(capabilities.map((entry) => entry.code));

  const multiGangCodes = ["switch_1", "switch_2", "switch_3", "switch_4"].filter(
    (code) => functionCodes.has(code) || capabilityCodes.has(code) || statusMap.has(code),
  );

  const selectedCodes =
    multiGangCodes.length > 0
      ? multiGangCodes
      : functionCodes.has("switch") || capabilityCodes.has("switch") || statusMap.has("switch")
        ? ["switch"]
        : functionCodes.has("switch_led") ||
            capabilityCodes.has("switch_led") ||
            statusMap.has("switch_led")
          ? ["switch_led"]
          : Array.from(
              new Set(
                [...functions, ...capabilities]
                  .map((entry) => entry.code)
                  .concat(status.map((entry) => entry.code))
                  .filter(looksLikeSwitchCode),
              ),
            );

  return selectedCodes.map((code, index) => {
    const alias = metadata.channelAliases.find(
      (entry) => entry.deviceId === deviceId && entry.channelCode === code,
    )?.alias;

    return {
      code,
      index: index + 1,
      displayName: alias?.trim() || defaultChannelName(code, index + 1),
      currentState: parseBoolean(statusMap.get(code)),
      controllable: functionCodes.has(code) || capabilityCodes.has(code),
      alias: alias?.trim() || null,
    };
  });
}

function inferDeviceType(category: string | null, gangCount: number): string {
  if (gangCount > 0) {
    return gangCount === 1
      ? "Single-channel light switch"
      : `${gangCount}-gang light switch`;
  }

  switch (category) {
    case "kg":
    case "cjkg":
    case "cz":
    case "tdq":
      return "Light switch";
    case null:
    case "":
      return "Unknown device";
    default:
      return `${category} device`;
  }
}

function defaultChannelName(code: string, index: number): string {
  if (code === "switch") {
    return "Main";
  }
  if (code === "switch_led") {
    return "Backlight";
  }
  if (code.startsWith("switch_")) {
    return `Switch ${index}`;
  }
  return code
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function looksLikeSwitchCode(code: string): boolean {
  const lower = code.toLowerCase();
  return (
    lower === "switch" ||
    lower === "switch_led" ||
    lower.startsWith("switch_") ||
    lower.includes("switch")
  );
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

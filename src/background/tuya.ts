import type {
  AppConfig,
  ChannelAlias,
  ConnectionTestResult,
  Device,
  DeviceAlias,
  ToggleChannelPayload,
  ToggleChannelResult,
  TuyaFunction,
  TuyaStatus,
} from "../shared/models";
import { normalizeDevice } from "./channels";

interface TokenCache {
  accessToken: string;
  expiresAtMs: number;
  configKey: string;
}

let tokenCache: TokenCache | null = null;

const SUPPORTED_TUYA_HOSTS = new Set([
  "openapi.tuyaus.com",
  "openapi-ueaz.tuyaus.com",
  "openapi.tuyaeu.com",
  "openapi-weaz.tuyaeu.com",
  "openapi.tuyacn.com",
  "openapi.tuyain.com",
]);

export async function testConnection(config: AppConfig): Promise<ConnectionTestResult> {
  const accessToken = await getToken(config, false);
  if (!accessToken) {
    throw new Error("Unable to obtain Tuya access token.");
  }

  const devices = await fetchDeviceSummaries(config);
  return {
    success: true,
    message: "Connection successful.",
    baseUrl: config.baseUrl,
    regionLabel: config.regionLabel,
    deviceCount: devices.length,
  };
}

export async function listDevices(
  config: AppConfig,
  metadata: { deviceAliases: DeviceAlias[]; channelAliases: ChannelAlias[] },
): Promise<Device[]> {
  const summaries = await fetchDeviceSummaries(config);
  const devices = await Promise.all(
    summaries.map(async (summary) => {
      const summaryRecord = asRecord(summary);
      const id =
        readString(summaryRecord.id) ||
        readString(summaryRecord.device_id) ||
        "unknown-device";

      const [status, functions] = await Promise.all([
        fetchDeviceStatus(config, id).catch(() => []),
        fetchDeviceFunctions(config, id).catch(() => []),
      ]);

      const capabilities =
        functions.length > 0
          ? []
          : await fetchDeviceCapabilities(config, id).catch(() => []);

      return normalizeDevice(summary, functions, status, capabilities, metadata);
    }),
  );

  return devices.sort((left, right) => left.name.localeCompare(right.name));
}

export async function toggleChannel(
  config: AppConfig,
  metadata: { deviceAliases: DeviceAlias[] },
  payload: ToggleChannelPayload,
): Promise<ToggleChannelResult> {
  const commandBody = {
    commands: [{ code: payload.channelCode, value: payload.value }],
  };

  const endpoints = [
    `/v1.0/devices/${payload.deviceId}/commands`,
    `/v1.0/iot-03/devices/${payload.deviceId}/commands`,
  ];

  let accepted = false;
  for (const path of endpoints) {
    try {
      await authorizedRequest(config, "POST", path, {}, commandBody);
      accepted = true;
      break;
    } catch {
      continue;
    }
  }

  if (!accepted) {
    throw new Error("None of the Tuya command endpoints accepted the request.");
  }

  const statuses = await fetchConfirmedChannelStatus(
    config,
    payload.deviceId,
    payload.channelCode,
    payload.value,
  );

  return {
    deviceId: payload.deviceId,
    statuses,
    actionLogEntry: {
      timestampMs: Date.now(),
      action: payload.value ? "channel_on" : "channel_off",
      deviceId: payload.deviceId,
      deviceName:
        metadata.deviceAliases.find((entry) => entry.deviceId === payload.deviceId)?.alias ??
        null,
      channelCode: payload.channelCode,
      success: true,
      message: `${payload.channelCode} ${payload.value ? "turned on" : "turned off"}`,
    },
  };
}

async function fetchConfirmedChannelStatus(
  config: AppConfig,
  deviceId: string,
  channelCode: string,
  expectedValue: boolean,
): Promise<TuyaStatus[]> {
  let lastStatuses: TuyaStatus[] = [];

  for (const delay of [0, 120, 250, 450]) {
    if (delay > 0) {
      await wait(delay);
    }

    try {
      const statuses = await fetchDeviceStatus(config, deviceId);
      lastStatuses = statuses;
      const match = statuses.find((entry) => entry.code === channelCode);
      if (parseBoolean(match?.value) === expectedValue) {
        return statuses;
      }
    } catch {
      continue;
    }
  }

  const existing = lastStatuses.find((entry) => entry.code === channelCode);
  if (existing) {
    existing.value = expectedValue;
    return lastStatuses;
  }

  return [...lastStatuses, { code: channelCode, value: expectedValue }];
}

async function fetchDeviceSummaries(config: AppConfig): Promise<unknown[]> {
  const endpoints: Array<{ path: string; query: Record<string, string> }> = [
    { path: "/v1.0/devices", query: {} },
    { path: "/v1.3/iot-03/devices", query: { page_no: "1", page_size: "200" } },
    { path: "/v1.0/iot-01/associated-users/devices", query: { size: "200" } },
  ];

  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const result = await authorizedRequest(config, "GET", endpoint.path, endpoint.query);
      const parsed = extractDeviceList(result);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load devices from Tuya Cloud.");
}

async function fetchDeviceStatus(
  config: AppConfig,
  deviceId: string,
): Promise<TuyaStatus[]> {
  const result = await authorizedRequest(
    config,
    "GET",
    `/v1.0/devices/${deviceId}/status`,
  );

  const record = asRecord(result);
  const source = Array.isArray(result)
    ? result
    : Array.isArray(record.status)
      ? record.status
      : [];

  return source
    .map((entry) => ({
      code: readString(asRecord(entry).code) || "",
      value: asRecord(entry).value ?? null,
    }))
    .filter((entry) => entry.code.length > 0);
}

async function fetchDeviceFunctions(
  config: AppConfig,
  deviceId: string,
): Promise<TuyaFunction[]> {
  for (const path of [
    `/v1.0/iot-03/devices/${deviceId}/functions`,
    `/v1.0/devices/${deviceId}/functions`,
  ]) {
    try {
      const result = await authorizedRequest(config, "GET", path);
      const parsed = extractFunctionsList(result);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function fetchDeviceCapabilities(
  config: AppConfig,
  deviceId: string,
): Promise<TuyaFunction[]> {
  for (const path of [
    `/v1.0/iot-03/devices/${deviceId}/capabilities-definition`,
    `/v1.0/devices/${deviceId}/capabilities`,
  ]) {
    try {
      const result = await authorizedRequest(config, "GET", path);
      const parsed = extractFunctionsList(result);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function authorizedRequest(
  config: AppConfig,
  method: string,
  path: string,
  query: Record<string, string> = {},
  body?: unknown,
): Promise<unknown> {
  let accessToken = await getToken(config, false);

  try {
    return await requestJson(config, method, path, query, body, accessToken);
  } catch (error) {
    if (!isTokenError(error)) {
      throw error;
    }
  }

  tokenCache = null;
  accessToken = await getToken(config, true);
  return requestJson(config, method, path, query, body, accessToken);
}

async function getToken(config: AppConfig, forceRefresh: boolean): Promise<string> {
  const configKey = `${config.clientId}:${config.baseUrl}`;
  if (
    !forceRefresh &&
    tokenCache &&
    tokenCache.configKey === configKey &&
    tokenCache.expiresAtMs > Date.now()
  ) {
    return tokenCache.accessToken;
  }

  const result = await requestJson(
    config,
    "GET",
    "/v1.0/token",
    { grant_type: "1" },
    undefined,
    undefined,
  );

  const record = asRecord(result);
  const accessToken = readString(record.access_token);
  const expireTime = Number(record.expire_time ?? 3600);

  if (!accessToken) {
    throw new Error("Tuya token response did not include access_token.");
  }

  tokenCache = {
    accessToken,
    configKey,
    expiresAtMs: Date.now() + Math.max(expireTime - 60, 60) * 1_000,
  };

  return accessToken;
}

async function requestJson(
  config: AppConfig,
  method: string,
  path: string,
  query: Record<string, string>,
  body?: unknown,
  accessToken?: string,
): Promise<unknown> {
  const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
  const canonicalUrl = buildCanonicalUrl(path, query);
  const url = `${normalizedBaseUrl}${canonicalUrl}`;
  const bodyString = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = await signRequest(
    config.clientId,
    config.clientSecret,
    accessToken,
    timestamp,
    nonce,
    method,
    bodyString,
    canonicalUrl,
  );

  const response = await fetch(url, {
    method,
    headers: {
      client_id: config.clientId,
      sign: signature,
      t: timestamp,
      nonce,
      sign_method: "HMAC-SHA256",
      "Content-Type": "application/json",
      ...(accessToken ? { access_token: accessToken } : {}),
    },
    body: body === undefined ? undefined : bodyString,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.success === true) {
    return payload.result ?? null;
  }

  const code = String(payload.code ?? "unknown");
  const message = String(payload.msg ?? payload.message ?? "Unknown Tuya API error");
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  throw error;
}

function normalizeBaseUrl(baseUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("Base URL is not a valid HTTPS URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Base URL must use HTTPS.");
  }

  if (!SUPPORTED_TUYA_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Unsupported Tuya host. Use one of: ${Array.from(SUPPORTED_TUYA_HOSTS).join(", ")}`,
    );
  }

  return parsed.origin.replace(/\/+$/, "");
}

async function signRequest(
  clientId: string,
  clientSecret: string,
  accessToken: string | undefined,
  timestamp: string,
  nonce: string,
  method: string,
  body: string,
  canonicalUrl: string,
): Promise<string> {
  const stringToSign = `${method.toUpperCase()}\n${await sha256Hex(body)}\n\n${canonicalUrl}`;
  const payload = `${clientId}${accessToken ?? ""}${timestamp}${nonce}${stringToSign}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toHex(signature).toUpperCase();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toHex(digest);
}

function buildCanonicalUrl(path: string, query: Record<string, string>): string {
  const entries = Object.entries(query);
  if (entries.length === 0) {
    return path;
  }
  const search = entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${path}?${search}`;
}

function extractDeviceList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  if (Array.isArray(record.list)) {
    return record.list;
  }
  if (Array.isArray(record.devices)) {
    return record.devices;
  }
  if (Array.isArray(record.result)) {
    return record.result;
  }
  return [];
}

function extractFunctionsList(value: unknown): TuyaFunction[] {
  const record = asRecord(value);
  const source = Array.isArray(value)
    ? value
    : Array.isArray(record.functions)
      ? record.functions
      : Array.isArray(record.status)
        ? record.status
        : Array.isArray(record.capabilities)
          ? record.capabilities
          : [];

  return source
    .map((entry) => {
      const item = asRecord(entry);
      return {
        code: readString(item.code) || "",
        valueType: readString(item.type) || readString(item.valueType),
        values: item.values,
        mode: readString(item.mode),
        support: readString(item.support),
        name: readString(item.name) || readString(item.display_name),
        description: readString(item.desc) || readString(item.description),
      } satisfies TuyaFunction;
    })
    .filter((entry) => entry.code.length > 0);
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

function isTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = String((error as Error & { code?: string }).code ?? "");
  return (
    ["1010", "1011", "1012", "1013", "1014"].includes(code) ||
    error.message.toLowerCase().includes("token")
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

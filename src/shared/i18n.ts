import type { ConnectionStatus, DeviceChannel, UiLocale } from "./models";

export type ResolvedLocale = "en" | "es";

type TranslationValue = string | ((params?: Record<string, string | number>) => string);

const translations: Record<ResolvedLocale, Record<string, TranslationValue>> = {
  en: {
    chromeSync: "Chrome sync",
    appTitle: "Tuya Desk",
    viewUser: "User",
    viewDeveloper: "Dev",
    configTitle: "Configuration",
    organizeDevices: "Organize devices",
    refreshDevices: "Refresh devices",
    autoRefreshOff: "Live off",
    autoRefreshTitle: "Auto refresh",
    searchPlaceholder: "Search",
    filterAll: "All",
    filterOnline: "On",
    filterOffline: "Off",
    connectionConnected: "Connected",
    connectionError: "Error",
    connectionNeedsConfig: "Setup",
    syncChecking: "Checking latest device state in Tuya Cloud...",
    syncCached: "Showing cached device state.",
    setupTitle: "First setup",
    setupDescription: "Add your Tuya Cloud credentials to start loading devices.",
    configDescription: "Saved in Chrome sync so it follows your signed-in browser.",
    synced: "Synced",
    notConfigured: "Not configured",
    openTuyaPlatform: "Open Tuya Platform",
    howToGetKeys: "How to get Access ID / Secret",
    howToLinkDevices: "How to link devices",
    clientId: "Client ID",
    clientSecret: "Client Secret",
    baseUrl: "Base URL",
    region: "Region",
    language: "Language",
    languageSystem: "System",
    languageEnglish: "English",
    languageSpanish: "Spanish",
    testing: "Testing...",
    testConnection: "Test connection",
    saving: "Saving...",
    saveSyncConfig: "Save sync config",
    loadingExtension: "Loading extension...",
    loadingExtensionCopy: "Preparing synced config and cached Tuya devices.",
    configureFirst: "Configure Tuya Cloud first",
    configureFirstCopy:
      "Open the Tuya Developer Platform, copy the Access ID and Access Secret from your cloud project Overview page, link your Tuya or Smart Life account to the project, and then save the credentials here.",
    noDevices: "No devices",
    refreshingDevices: "Refreshing devices from Tuya Cloud...",
    noDevicesMatch: "No devices match the current view.",
    channelShort: "ch",
    online: "Online",
    offline: "Offline",
    on: "ON",
    off: "OFF",
    unknown: "?",
    sending: "Sending...",
    set: "Set",
    turnOn: "Turn on",
    turnOff: "Turn off",
    readOnly: "read only",
    deviceOrderTitle: "Device order",
    deviceOrderCopy: "Move devices and the order is saved to Chrome sync.",
    moveUp: "Move up",
    moveDown: "Move down",
    close: "Close",
    deviceAlias: "Device alias",
    optionalAlias: "Optional alias",
    save: "Save",
    recentActions: "Recent actions",
    localDeveloperLog: "Local developer log.",
    product: "Product",
    channels: "Channels",
    deviceId: "ID",
    notAvailable: "n/a",
    configSyncedToast: "Configuration synced with Chrome.",
    deviceAliasSaved: "Device alias saved.",
    channelAliasSaved: "Channel alias saved.",
    connectionSuccess: (params = {}) =>
      `Connection successful. ${params.count ?? 0} device(s) visible.`,
    connectionMessage: (params = {}) =>
      `${params.message ?? ""} ${params.count ?? 0} device(s) visible.`.trim(),
    cachedCheckingMessage: "Showing cached state while checking Tuya Cloud.",
    connectingCloudMessage: "Connecting to Tuya Cloud...",
    loadingCloudMessage: "Loading devices from Tuya Cloud...",
    liveSyncedMessage: "Live state synced.",
    refreshedMessage: "Devices refreshed from Tuya Cloud.",
    cachedFallbackMessage: "Unable to refresh live state. Showing cached devices.",
    category: (params = {}) => `Category ${params.value ?? ""}`.trim(),
    mainChannel: "Main",
    backlightChannel: "Backlight",
    switchChannel: (params = {}) => `Switch ${params.index ?? ""}`.trim(),
  },
  es: {
    chromeSync: "Chrome sync",
    appTitle: "Tuya Desk",
    viewUser: "Usuario",
    viewDeveloper: "Dev",
    configTitle: "Configuracion",
    organizeDevices: "Organizar dispositivos",
    refreshDevices: "Refrescar dispositivos",
    autoRefreshOff: "Sin auto",
    autoRefreshTitle: "Refresco automatico",
    searchPlaceholder: "Buscar",
    filterAll: "Todos",
    filterOnline: "On",
    filterOffline: "Off",
    connectionConnected: "Conectado",
    connectionError: "Error",
    connectionNeedsConfig: "Configurar",
    syncChecking: "Verificando el estado mas reciente en Tuya Cloud...",
    syncCached: "Mostrando el estado en cache.",
    setupTitle: "Configuracion inicial",
    setupDescription: "Agrega tus credenciales de Tuya Cloud para empezar a cargar dispositivos.",
    configDescription: "Se guarda en Chrome sync para seguirte en tu navegador conectado.",
    synced: "Sincronizado",
    notConfigured: "Sin configurar",
    openTuyaPlatform: "Abrir Tuya Platform",
    howToGetKeys: "Como obtener Access ID / Secret",
    howToLinkDevices: "Como vincular dispositivos",
    clientId: "Client ID",
    clientSecret: "Client Secret",
    baseUrl: "Base URL",
    region: "Region",
    language: "Idioma",
    languageSystem: "Sistema",
    languageEnglish: "Ingles",
    languageSpanish: "Espanol",
    testing: "Probando...",
    testConnection: "Probar conexion",
    saving: "Guardando...",
    saveSyncConfig: "Guardar configuracion",
    loadingExtension: "Cargando extension...",
    loadingExtensionCopy: "Preparando la configuracion sincronizada y los dispositivos en cache.",
    configureFirst: "Configura Tuya Cloud primero",
    configureFirstCopy:
      "Abre Tuya Developer Platform, copia el Access ID y el Access Secret desde la pagina Overview de tu cloud project, vincula tu cuenta Tuya o Smart Life al proyecto y luego guarda aqui las credenciales.",
    noDevices: "Sin dispositivos",
    refreshingDevices: "Refrescando dispositivos desde Tuya Cloud...",
    noDevicesMatch: "No hay dispositivos para la vista actual.",
    channelShort: "can",
    online: "Online",
    offline: "Offline",
    on: "ON",
    off: "OFF",
    unknown: "?",
    sending: "Enviando...",
    set: "Aplicar",
    turnOn: "Encender",
    turnOff: "Apagar",
    readOnly: "solo lectura",
    deviceOrderTitle: "Orden de dispositivos",
    deviceOrderCopy: "Mueve los dispositivos y el orden queda guardado en Chrome sync.",
    moveUp: "Subir",
    moveDown: "Bajar",
    close: "Cerrar",
    deviceAlias: "Alias del dispositivo",
    optionalAlias: "Alias opcional",
    save: "Guardar",
    recentActions: "Acciones recientes",
    localDeveloperLog: "Log local para desarrollador.",
    product: "Producto",
    channels: "Canales",
    deviceId: "ID",
    notAvailable: "n/d",
    configSyncedToast: "Configuracion sincronizada con Chrome.",
    deviceAliasSaved: "Alias del dispositivo guardado.",
    channelAliasSaved: "Alias del canal guardado.",
    connectionSuccess: (params = {}) =>
      `Conexion correcta. ${params.count ?? 0} dispositivo(s) visibles.`,
    connectionMessage: (params = {}) =>
      `${params.message ?? ""} ${params.count ?? 0} dispositivo(s) visibles.`.trim(),
    cachedCheckingMessage: "Mostrando el estado en cache mientras se consulta Tuya Cloud.",
    connectingCloudMessage: "Conectando con Tuya Cloud...",
    loadingCloudMessage: "Cargando dispositivos desde Tuya Cloud...",
    liveSyncedMessage: "Estado real sincronizado.",
    refreshedMessage: "Dispositivos actualizados desde Tuya Cloud.",
    cachedFallbackMessage: "No fue posible refrescar el estado real. Se mantiene la cache.",
    category: (params = {}) => `Categoria ${params.value ?? ""}`.trim(),
    mainChannel: "Principal",
    backlightChannel: "Retroiluminacion",
    switchChannel: (params = {}) => `Switch ${params.index ?? ""}`.trim(),
  },
};

export function resolveLocale(preference: UiLocale, hint?: string | null): ResolvedLocale {
  if (preference === "en" || preference === "es") {
    return preference;
  }

  const source =
    hint ??
    (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : navigator.language);

  return source.toLowerCase().startsWith("es") ? "es" : "en";
}

export function t(
  locale: ResolvedLocale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const entry = translations[locale][key] ?? translations.en[key];
  if (typeof entry === "function") {
    return entry(params);
  }
  return entry ?? key;
}

export function localizeConnectionState(
  locale: ResolvedLocale,
  state: ConnectionStatus["state"],
): string {
  switch (state) {
    case "connected":
      return t(locale, "connectionConnected");
    case "error":
      return t(locale, "connectionError");
    case "needs_config":
    default:
      return t(locale, "connectionNeedsConfig");
  }
}

export function localizeChannelName(
  locale: ResolvedLocale,
  channel: DeviceChannel,
): string {
  if (channel.code === "switch") {
    return t(locale, "mainChannel");
  }
  if (channel.code === "switch_led") {
    return t(locale, "backlightChannel");
  }
  if (channel.code.startsWith("switch_")) {
    return t(locale, "switchChannel", { index: channel.index });
  }
  return channel.displayName;
}

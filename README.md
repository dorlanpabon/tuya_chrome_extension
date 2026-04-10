# Tuya Desk Chrome Extension

Extension Chrome MV3 para controlar switches Tuya/Tuya Smart por canal, con configuracion sincronizada por `chrome.storage.sync`.

## Por que va en otra carpeta

Este proyecto vive separado del repo Tauri para no mezclar:

- app de escritorio
- extension del navegador
- pipelines y empaquetado distintos

Ruta local:

- `D:\xampp\htdocs\tuya_chrome_extension`

## Stack

- Chrome Extension Manifest V3
- Vite
- Preact
- TypeScript
- Background service worker para Tuya Cloud

## Features del MVP

- Configurar `TUYA_CLIENT_ID`
- Configurar `TUYA_CLIENT_SECRET`
- Configurar `TUYA_BASE_URL`
- Validar `TUYA_BASE_URL` contra endpoints oficiales soportados de Tuya Cloud
- Guardar configuracion en `chrome.storage.sync`
- Reusar esa configuracion al cambiar de PC si Chrome sincroniza extensiones y storage
- Probar conexion
- Listar dispositivos
- Detectar `switch`, `switch_led`, `switch_1` a `switch_4`
- Control ON/OFF por canal
- Modo `User` compacto
- Modo `Developer` con alias, ids y log local
- Interfaz bilingue con `English` y `Spanish`
- Orden manual de dispositivos guardado en `chrome.storage.sync`

## Obtener Access ID y Access Secret

Pasos recomendados en Tuya Developer Platform:

1. Entra a [Tuya Developer Platform](https://platform.tuya.com/).
2. Crea o abre tu cloud project en `Cloud > Development`.
3. Abre la pestana `Overview`.
4. Copia la `Access ID` y la `Access Secret` desde la seccion `Cloud Application Authorization Key`.
5. Si tus dispositivos no aparecen, vincula tu app Tuya Smart o Smart Life al proyecto y luego enlaza los dispositivos al cloud project.

Guias oficiales:

- [Cloud development overview](https://developer.tuya.com/en/docs/cloud)
- [How to get Access ID / Access Secret](https://developer.tuya.com/en/docs/iot/device-control-best-practice-nodejs?_source=751e806efb9d0a8cb3793945cccdc47e&id=Kaunfr776vomb)
- [Link devices to your cloud project](https://developer.tuya.com/en/docs/iot/link-devices?_source=0d3f09cd9c61de21759f60ac3a058d51&id=Ka471nu1sfmkl)

Datos que normalmente pondras en la extension:

- `Client ID`: tu `Access ID`
- `Client Secret`: tu `Access Secret`
- `Base URL`: por ejemplo `https://openapi.tuyaus.com` para Western America
- `Region`: una etiqueta descriptiva, por ejemplo `Western America Data Center`

Hosts oficiales soportados en esta build:

- `https://openapi.tuyaus.com`
- `https://openapi-ueaz.tuyaus.com`
- `https://openapi.tuyaeu.com`
- `https://openapi-weaz.tuyaeu.com`
- `https://openapi.tuyacn.com`
- `https://openapi.tuyain.com`

La extension rechaza `baseUrl` fuera de esa lista para reducir permisos de host y simplificar la revision en Chrome Web Store.

## Seguridad

La configuracion se guarda en `chrome.storage.sync` para que viaje con tu Chrome. Eso mejora portabilidad, pero implica que el secreto queda sincronizado en tu cuenta de navegador.

Si luego quieres endurecer esto, el siguiente paso correcto es:

- cifrar `clientSecret` con una passphrase
- guardar solo el blob cifrado en sync
- desbloquearlo por sesion en la extension

## Scripts

```bash
npm install
npm run build
npm run package:webstore
```

## Cargar en Chrome

1. Ejecuta `npm run build`
2. Abre `chrome://extensions`
3. Activa `Developer mode`
4. Pulsa `Load unpacked`
5. Selecciona la carpeta `dist`

## Arquitectura

- `src/background`
  - cliente Tuya
  - firma HMAC-SHA256
  - storage sync/local
  - runtime message handlers
- `src/popup`
  - UI compacta
  - modo usuario
  - modo desarrollador
- `src/shared`
  - modelos
  - filtros
  - formateo

## Notas

- `chrome.storage.sync` guarda configuracion y alias.
- `chrome.storage.sync` tambien guarda preferencias UI y orden manual de dispositivos.
- `chrome.storage.local` guarda cache de dispositivos y action log para que el popup abra rapido.
- El popup usa cache inmediata y luego refresca el estado real desde Tuya Cloud sin bloquear la UI.
- Al abrir el popup o al recuperar foco, la extension intenta resincronizar el estado para corregir cambios hechos desde el telefono o desde otra app.

## Chrome Web Store

- Scripts:
  - `npm run build:assets` genera iconos y piezas visuales para la tienda.
  - `npm run package:webstore` construye `dist` y crea `webstore-package.zip`.
- Assets generados:
  - `public/icons`
  - `store-assets/chrome-web-store`
- Documentacion para publicar:
  - `docs/chrome-web-store.md`
  - `docs/chrome-web-store-submission-es.md`
  - `docs/privacy-policy.md`

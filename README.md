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
- Guardar configuracion en `chrome.storage.sync`
- Reusar esa configuracion al cambiar de PC si Chrome sincroniza extensiones y storage
- Probar conexion
- Listar dispositivos
- Detectar `switch`, `switch_led`, `switch_1` a `switch_4`
- Control ON/OFF por canal
- Modo `User` compacto
- Modo `Developer` con alias, ids y log local

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
- `chrome.storage.local` guarda cache de dispositivos y action log para que el popup abra rapido.
- El popup usa cache inmediata y luego refresca desde Tuya Cloud.

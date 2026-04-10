# Chrome Web Store Submission Answers

Textos sugeridos para diligenciar la ficha y privacidad en Chrome Web Store.

## Ficha del producto

Titulo del paquete:

- `Tuya Desk`

Resumen del paquete:

- `Compact Chrome extension to control Tuya light switches by channel.`

Descripcion:

```text
Tuya Desk is a compact Chrome extension for controlling Tuya and Tuya Smart light switches by channel.

Use it to:
- sign in once with your Tuya Cloud Access ID and Access Secret
- sync that setup across Chrome on your signed-in computers
- load linked devices from the correct Tuya region
- detect 1, 2, 3 and 4 gang switches automatically
- switch each channel on or off independently
- refresh live device state without blocking the popup
- rename devices and channels locally
- save the display order of your devices across Chrome sync
- inspect IDs and raw details in developer mode

Tuya Desk is designed for people who already use Tuya Cloud and want fast desktop access to their wall switches without opening the mobile app.
```

Categoria:

- `Productividad`

Idioma recomendado para la primera ficha:

- `English`

Idioma adicional recomendado:

- `Spanish`

## Privacidad

Descripcion de la finalidad unica:

```text
Tuya Desk permite ver y controlar canales de interruptores Tuya desde un popup compacto de Chrome usando las credenciales y la region configuradas por el usuario.
```

Justificacion de storage:

```text
La extension usa storage para guardar la configuracion de Tuya Cloud, alias locales, preferencias de interfaz, orden de dispositivos y cache del ultimo estado conocido para abrir el popup mas rapido.
```

Justificacion de Permiso de host:

```text
La extension solo necesita acceso a una lista fija de hosts oficiales de Tuya OpenAPI para autenticar al usuario, listar dispositivos, leer el estado de cada canal y enviar comandos on/off. No accede a sitios arbitrarios ni interactua con paginas web del usuario.
```

Usas codigo remoto:

- `No, no estoy usando codigo remoto`

Justificacion de codigo remoto:

- dejar vacio

## Uso de datos

Marca:

- `Informacion de autenticacion`

No marques:

- `Informacion de identificacion personal`
- `Informacion sanitaria`
- `Datos financieros y de pagos`
- `Comunicaciones personales`
- `Ubicacion`
- `Historial web`
- `Actividad del usuario`
- `Contenido del sitio web`

Motivo:

- La extension almacena credenciales de Tuya Cloud y configuracion local para autenticar y controlar dispositivos.

Certificaciones:

- `No vendo ni transfiero datos de usuario a terceros`
- `No uso ni transfiero datos de usuario para fines no relacionados con la finalidad unica de mi elemento`
- `No uso ni transfiero datos de usuarios para determinar su situacion crediticia ni para ofrecer prestamos`

## Politica de privacidad

Debes poner una URL publica por HTTPS. El archivo local no sirve para Chrome Web Store.

Opciones recomendadas:

1. Publicar en GitHub Pages: `https://dorlanpabon.github.io/tuya_chrome_extension/privacy-policy.html`
2. Publicarlo en una pagina simple del repo si ya tienes dominio o Pages.
3. Como solucion rapida, usar una URL publica estable del repo si ya esta publicada en web.

Texto base:

- [privacy-policy.md](/D:/xampp/htdocs/tuya_chrome_extension/docs/privacy-policy.md)
- Version HTML lista para publicar: [privacy-policy.html](/D:/xampp/htdocs/tuya_chrome_extension/docs/privacy-policy.html)

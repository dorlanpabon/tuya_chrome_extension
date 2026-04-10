# Chrome Web Store Listing

Material de publicacion para `Tuya Desk`.

## Official references

- Chrome Web Store publish overview: [developer.chrome.com/docs/webstore/publish](https://developer.chrome.com/docs/webstore/publish/)
- Troubleshooting listing issues: [developer.chrome.com/docs/webstore/troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting/)
- User privacy guidance: [developer.chrome.com/docs/extensions/mv3/user_privacy](https://developer.chrome.com/docs/extensions/mv3/user_privacy/)

## Suggested store metadata

Product name:

- `Tuya Desk`

Category:

- `Productivity`

Language:

- `English`

Short description:

- `Control Tuya light switches by channel from a compact Chrome popup with synced setup across your Chrome profile.`

Single purpose statement:

- `Tuya Desk lets you view and control Tuya light-switch channels from a compact Chrome extension popup.`

Detailed description:

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

## Permissions and reviewer notes

`storage`

- Used to save Tuya credentials, aliases, UI preferences and cached device state.

Host access

- The extension calls only these official Tuya Cloud HTTPS endpoints:
- `https://openapi.tuyaus.com/*`
- `https://openapi-ueaz.tuyaus.com/*`
- `https://openapi.tuyaeu.com/*`
- `https://openapi-weaz.tuyaeu.com/*`
- `https://openapi.tuyacn.com/*`
- `https://openapi.tuyain.com/*`

Reviewer note:

- `The extension only connects to a fixed allowlist of official Tuya OpenAPI hosts needed for authentication, device listing, status refresh and channel control. It does not access arbitrary websites, scrape the Tuya mobile app or inject scripts into pages.`

## Privacy disclosure draft

Data handled by the extension:

- Tuya Access ID
- Tuya Access Secret
- Tuya base URL and region label
- Device IDs, aliases and channel aliases
- Cached device state and local action log

Data use summary:

- Data is used only to authenticate with Tuya Cloud and control the user's devices.
- No analytics, ads, tracking pixels or third-party marketing SDKs are included.
- Data is stored in `chrome.storage.sync` and `chrome.storage.local`.

Privacy policy source:

- [privacy-policy.md](/D:/xampp/htdocs/tuya_chrome_extension/docs/privacy-policy.md)

## Required assets prepared in this repo

Icons:

- [icon-16.png](/D:/xampp/htdocs/tuya_chrome_extension/public/icons/icon-16.png)
- [icon-32.png](/D:/xampp/htdocs/tuya_chrome_extension/public/icons/icon-32.png)
- [icon-48.png](/D:/xampp/htdocs/tuya_chrome_extension/public/icons/icon-48.png)
- [icon-128.png](/D:/xampp/htdocs/tuya_chrome_extension/public/icons/icon-128.png)

Store images:

- [screenshot-1-user.png](/D:/xampp/htdocs/tuya_chrome_extension/store-assets/chrome-web-store/screenshot-1-user.png)
- [screenshot-2-developer.png](/D:/xampp/htdocs/tuya_chrome_extension/store-assets/chrome-web-store/screenshot-2-developer.png)
- [small-promo-tile.png](/D:/xampp/htdocs/tuya_chrome_extension/store-assets/chrome-web-store/small-promo-tile.png)
- [large-promo-tile.png](/D:/xampp/htdocs/tuya_chrome_extension/store-assets/chrome-web-store/large-promo-tile.png)

## Packaging

Build the extension and generate the store assets:

```powershell
npm run build
```

Create a zip ready to upload:

```powershell
npm run package:webstore
```

Upload file:

- [webstore-package.zip](/D:/xampp/htdocs/tuya_chrome_extension/webstore-package.zip)

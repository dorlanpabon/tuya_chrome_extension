# Contributing

Thanks for taking an interest in Tuya Desk Chrome Extension.

This project is focused on a compact, practical browser UX for Tuya switch control. Contributions are most useful when they improve speed, clarity, reliability, or review readiness.

## Good contribution areas

- popup density and compact UX improvements
- better state refresh behavior
- Chrome Web Store compliance and packaging
- Tuya device/channel detection edge cases
- optional security hardening for synced credentials
- bilingual UX and localization improvements

## Development

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

Create the Chrome Web Store package:

```bash
npm run package:webstore
```

## Code expectations

- Keep the popup fast and compact.
- Keep Tuya cloud communication in the background layer.
- Avoid broad architectural churn unless it clearly improves maintainability.
- Prefer user-mode simplicity over adding diagnostics everywhere.

## Pull requests

Pull requests should ideally explain:

- what user problem is being solved
- what changed in user mode vs developer mode
- whether storage, permissions, or Web Store review surface changed
- how the change was validated

## Reporting issues

Useful issue details include:

- Chrome version
- whether the issue happens in user mode or developer mode
- Tuya region/base URL
- whether the issue happens after popup open, refresh, or channel toggle
- whether the state mismatch originated from a phone app change or physical switch action

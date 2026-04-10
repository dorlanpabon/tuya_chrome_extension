# Tuya Desk Privacy Policy

Last updated: 2026-04-10

## Overview

Tuya Desk is a Chrome extension that lets users control Tuya light switches and other supported Tuya switch channels from a compact popup.

This extension does not sell data, does not run advertising and does not include analytics trackers.

## Data we process

The extension may store and process:

- Tuya Access ID
- Tuya Access Secret
- Tuya base URL and region label
- Tuya device IDs and channel codes
- Local aliases for devices and channels
- Cached device state
- Local action log entries

## Why we process this data

We use this data only to:

- authenticate against Tuya Cloud
- load the user's linked devices
- send on and off commands to device channels
- remember UI preferences and device order
- make the popup open faster by caching the latest known device state

## Where data is stored

The extension stores data in:

- `chrome.storage.sync` for credentials, aliases and UI preferences
- `chrome.storage.local` for cached device state and local action log

## Network usage

The extension sends requests only to Tuya Cloud HTTPS endpoints needed to authenticate and control the user's devices.

The extension does not scrape websites, does not inject ads and does not collect unrelated browsing data.

## Data sharing

We do not sell or rent user data.

We do not share data with third-party advertisers or analytics vendors.

Data is only sent to Tuya Cloud when required for the extension feature set requested by the user.

## Data retention

Stored data remains in the user's browser profile until the user:

- changes or removes the saved configuration
- clears the extension storage
- uninstalls the extension

## Security note

Tuya credentials are stored in Chrome extension storage so they can be reused across the user's synced Chrome profile. If stronger protection is needed, the next hardening step is encrypting the secret before storing it in sync storage.

## Contact

For support or privacy questions, publish a maintainer contact email on the Chrome Web Store listing before submitting the extension.

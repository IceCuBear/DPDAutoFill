# DPD Auto‑Fill

Automatically fill the parcel number and (optionally) the verification ZIP code on DPD MyDPD pages. Includes a lightweight settings UI to enable/disable the script, toggle ZIP auto‑fill, set a default ZIP, and manage exact per‑tracking ZIP rules.

Current version: 2025.12.11.3

Repository: https://github.com/IceCuBear/DPDAutoFill

Issue tracker: https://github.com/IceCuBear/DPDAutoFill/issues

## Features

- One‑click convenience
  - Auto‑fills the parcel number from the `?parcelNumber=...` URL parameter and submits the form
  - Optionally auto‑fills the verification ZIP field
- Simple rule model
  - Exact mapping: `Tracking number` → `ZIP`
  - Optional Default ZIP used when no exact rule matches
  - Add/remove and edit rules in the UI
- Compact UI
  - Small gear icon inserted as the leftmost item of the header’s icon menu (`#icon-menu > ul`)
  - If the site layout differs, a floating gear appears at the top‑left as a fallback
- Broader site support
  - Works on common DPD hostnames/locales for MyDPD and My Parcels
- Efficient & resilient
  - MutationObserver‑based element detection (no hot loops)
  - Safe input/change event dispatching

## 🖥 Supported DPD pages

The script matches the following URL patterns (from the userscript header):

- `https://www.dpdgroup.com/*/mydpd/*`
- `https://www.dpdgroup.com/*/mydpd/my-parcels/*`
- `https://www.dpd.com/*/mydpd/*`
- `https://www.dpd.com/*/mydpd/my-parcels/*`

If you encounter a MyDPD page that isn’t matched, please open an issue with the URL.

## Installation

You need a userscript manager extension:

- Violentmonkey (recommended): https://violentmonkey.github.io/
- Tampermonkey: https://www.tampermonkey.net/
- Greasemonkey: https://www.greasespot.net/

Then install the script:

1) One‑click (Raw URL)

- https://raw.githubusercontent.com/IceCuBear/DPDAutoFill/refs/heads/main/DPDAutoFill.user.js

2) Manual

- Create a new userscript and paste the contents of `DPDAutoFill.user.js`.

## Usage

1. Open a supported DPD MyDPD/My Parcels page.
2. If your link contains `?parcelNumber=...`, the script will fill the parcel number and submit automatically (when enabled).
3. Click the gear in the header’s icon menu to open settings. If no header menu is found, a floating gear is shown in the top‑left.
4. Configure the toggles and add exact rules as `Tracking number` → `ZIP` pairs.
5. When the verification step asks for a ZIP, the script will:
   - Use the ZIP from the first exact matching rule for the current tracking number; or
   - Use the Default ZIP if set; otherwise do nothing.

## Settings explained

- Enable script: Master on/off switch for all automation.
- Auto‑fill verification ZIP: When enabled, fills the ZIP on the verification step using your rules/default.
- Default ZIP: Fallback ZIP used when no rule matches.
- Rules: A list of exact mappings. Each row has two fields:
  - Tracking number: The full tracking/parcel number.
  - ZIP: The verification ZIP to use for that tracking number.

Notes:
- Rules are exact matches (no prefixes/regex). Keep one entry per tracking number.
- Previously saved rules from older versions are auto‑normalized when editing/saving.

## Permissions

The userscript requests minimal permissions in its header:

- `@match` for the DPD MyDPD pages listed above
- `@grant GM_setValue`, `@grant GM_getValue` for storing settings
- `@run-at document-idle`, `@noframes`

No tracking/analytics or external network access is used.

## How it works (under the hood)

1. Reads `parcelNumber` from the URL (if present) and remembers it in session storage to reuse across steps.
2. Waits for the parcel input, fills it (if empty), and clicks the submit button.
3. On the verification step, resolves the ZIP by exact rule match (or Default ZIP) and fills it, then clicks confirm.
4. A MutationObserver powers `waitFor(...)` to efficiently detect when relevant elements appear.
5. A small gear is injected into the page header’s icon menu; clicking it shows a simple settings panel.

## FAQ / Troubleshooting

- I don’t see the gear icon
  - Some locales or layouts may not have `#icon-menu`. The script shows a floating gear at the top‑left as a fallback.
- The script didn’t fill my parcel number
  - Ensure the page URL includes `?parcelNumber=...` or that the parcel number is present in the input field.
- ZIP wasn’t filled
  - Check that “Auto‑fill verification ZIP” is enabled, and that a matching exact rule or Default ZIP exists.
- I need a new domain/path covered
  - Open an issue with the exact URL so the `@match` list can be extended if necessary.

## License

Licensed under the GNU AGPLv3.

You are free to use, modify, and share this software under the terms of the AGPLv3. If you run a modified version as a network service, the AGPL requires that you make your modified source code available to users interacting with that service. Contributions and pull requests are welcome.

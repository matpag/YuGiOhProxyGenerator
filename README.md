# YuGiOh Proxy Maker

YuGiOh Proxy Maker is a local-first English/Italian card-rendering prototype based on YGOProxyGenerator and cardmaker.

## Initial release scope

- TCG languages: English and Italian
- OCG languages: postponed
- Data source under evaluation: YGOProDeck API
- Rendering references under evaluation: YGOProxyGenerator and yemachu/cardmaker

## Guiding approach

The first milestone is deliberately narrow: verify the available localized data, establish a canonical internal card model, and render one representative card accurately in both English and Italian. Static labels such as attributes, races, and card types will use local versioned translations if the API does not return reliable localized values.

## Status

The first local prototype is implemented: decklists, EN/IT reconstruction, PNG previews, PDF printing, local editing and JSON project import/export. Eleven card pairs cover the initial TCG layouts. Visual fidelity is still being refined.

See `docs/decisions/0001-initial-scope.md` for the first recorded project decision.

## Initial research completed (2026-10-08)

Reference source/license review and live EN/IT API comparison are documented:

- [Reference projects and license constraints](docs/research/references-and-licenses.md)
- [YGOProDeck localization evidence](docs/research/ygoprodeck-localization.md)
- [Proposed architecture direction](docs/decisions/0002-data-and-rendering-direction.md)

Nine TCG card pairs were compared field by field. Static labels remain English; the sampled Italian Pendulum card has an untranslated Pendulum section. No external code or assets have been adopted. Stack selection, canonical schema implementation and visual validation remain the next phase.

Reproduce the saved comparison without network access with `python scripts/audit_localization.py --offline`.

## Development direction (2026-10-09)

Use YGOProxyGenerator as the local application base and integrate cardmaker rendering behind an adapter. Names and card text come from localized API data; static labels use local JSON dictionaries, with explicit corrections for incomplete card text.

See the [development plan](docs/plans/0001-development-plan.md) and [updated decision](docs/decisions/0003-upstream-base-and-integration.md). The plan starts with a validated Dark Magician / Mago Nero pair, followed by PDF integration and progressive TCG layout support. The upstream sources have now been imported; see the implementation and validation below.


## Run locally

Requirements: Python 3 and a current browser. Node.js is only needed for the automated unit tests.

```powershell
python scripts/serve.py
```

Open [the local app](http://127.0.0.1:8765/html/index.html). The server binds only to localhost. The original generator is preserved at `/baseline/html/index.html` as a historical interface snapshot. Dueling Nexus (https://duelingnexus.com/yugioh-card-maker/) is the visual source of truth for geometry, typography and spacing; YGOProDeck card/deck images calibrate frame background brightness by explicit user instruction.

1. Enter exact English card names or passcodes; quantities and `[artwork index]` are supported. Import/drop a `.ydk` file if preferred. The selected card language controls the printed names and text, independently of the lookup name: `Dark Magician` prints as `Mago Nero` in Italian. Italian names must not be used in the decklist; the supported lookup inputs are exact English names or passcodes.
2. Select the card language, generate previews, and download the PDF. Scale 1 uses 59 × 86 mm; print at 100% without page fitting.
3. Use **Modifica carta** to edit a copy, then **Salva progetto** / **Apri progetto JSON** to save and reload it. Regenerating the decklist restores API data and the versioned corrections.

The eleven sample cards, fonts, first artworks and Nexus TCG template assets are local. Other cards/artwork variants require network access on their first use. Missing translations and unsupported card combinations are reported instead of silently falling back to English.

## Verification

```powershell
node --test tests/core.test.js
```

Browser checks use Playwright and Edge. Run `npm install` to install the pinned development dependency, or set `PLAYWRIGHT_MODULE` to an existing package. `npm run test:browser` runs the browser checks, including real font loading and missing-font handling. Run `scripts/check-prototype.cjs`, `scripts/check-layouts.cjs`, `scripts/check-editor.cjs` and `scripts/check-edge-cases.cjs` with Node while the server is running.

- [First EN/IT pair and visual limitations](docs/validation/phase-3/README.md)
- [TCG layout samples](docs/validation/phase-5/README.md)
- [Editor and project checks](docs/validation/phase-6/README.md)
- [Historical attribute-label research (superseded visual baseline)](docs/validation/attributes/README.md)
- [TCG font families and visual comparison](docs/validation/fonts/README.md)
- [Dueling Nexus title sizing and compact type-line punctuation](docs/validation/typography/README.md)
- [Local Nexus frames, updated layout and comparisons](docs/validation/nexus-frames/README.md)
- [Frame brightness calibration against YGOProDeck](docs/validation/frame-colors/README.md)
- [Implemented architecture](docs/decisions/0004-prototype-implementation.md)
- [Imported revisions, downloads and file hashes](docs/research/import-manifest.json)

The prototype is not yet visually identical to every original printing. The card font families now follow the referenced TCG guide and load from local files. Native raster resolution, typographic positioning and printing-specific template details remain fidelity limits. Set codes are not fabricated; OCG languages remain outside scope.

## GitHub Pages

Published app: https://matpag.github.io/YuGiOhProxyGenerator/

The Pages workflow runs the core tests and publishes only `app/` on every push to `main` or `master`. Repository Settings → Pages uses GitHub Actions. No backend or build step is required: rendering, editing and PDF generation run in the browser. Non-sample cards still require access to YGOProDeck. Asset URLs resolve relative to the application root, so both localhost and repository subpaths work.

Run `node scripts/check-pages.cjs` to verify the repository subpath, root entry point, EN/IT sample rendering and PDF downloads in Edge without external requests.

The app is served directly at `/YuGiOhProxyGenerator/`; the old `/html/index.html` URL redirects to the root for existing bookmarks.

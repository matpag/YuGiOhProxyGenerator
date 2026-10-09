# YuGiOh Proxy Maker

Create printable Yu-Gi-Oh! proxy cards in English, Italian, German or French from a decklist. Preview cards, edit their text or artwork, and download a PDF for printing.

[Open YuGiOh Proxy Maker](https://matpag.github.io/YuGiOhProxyGenerator/)

## Features

- Import `.ydk` or `.txt` decklists, or enter cards manually.
- Choose English, Italian, German or French card text.
- Switch the interface between Italian, English, German, Spanish and French using the flags. The first visit uses your browser language; subsequent visits remember your choice.
- Review a compact card grid or a paginated print-sheet preview, with card zoom.
- Edit card text and artwork with a live preview and fields tailored to the card type.
- Use the responsive interface on mobile, including portrait and landscape editors.
- Export printable PDFs with adjustable paper size, margins and card scale.

## How to use

1. Enter one card per line using its exact **English name** or numeric card ID. Add a quantity before the name:

   ```text
   3 Dark Magician
   2 Cyber Dragon
   46986414
   ```

2. Choose the language for the printed cards. For example, `Dark Magician` prints as `Mago Nero` in Italian. Use English names in the decklist even when printing in Italian.
3. Generate the preview, review the cards or print sheets, then download the PDF. Interface language and card language are independent.
4. Print at **100% scale**, without fitting to the page. At card scale 100%, cards measure **59 × 86 mm**.

Advanced print settings use percentages for card scale and millimeters for margins and spacing. Changing the list or printed language marks the preview as outdated until you regenerate it. Importing a file replaces the current list.

To select another illustration, append its index, such as `Dark Magician [1]`. Use the edit button below a preview to customize a copy. Project save/load controls are currently hidden. Generating the decklist again replaces your edits with the card data.

## Run locally

Requires Python 3 and a modern browser. Download or clone this repository, then run:

```sh
python scripts/serve.py
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/). Keep the terminal open while using the app.

## Availability and limitations

English, Italian, German and French TCG card text is supported when the translation is available from YGOProDeck. Spanish is available for the interface only. Some localized sections, including Pendulum effects, are incomplete in the API; these are reported rather than silently printed in English. The included sample cards can be generated without external requests; other cards and artwork variants require an internet connection on first use. On GitHub Pages, additional artwork is downloaded through [wsrv.nl](https://wsrv.nl/) to avoid browser CORS restrictions, then cached for offline reuse. The first download requires both YGOProDeck and the image service to be available. The local server downloads artwork directly from YGOProDeck.

This is a prototype: visual fidelity is still being refined, and not every card combination has been validated. Missing translations and unsupported combinations are reported. OCG languages are not currently supported.

Card data is provided by [YGOProDeck](https://ygoprodeck.com/).

## Development checks

Run `node --test tests/*.test.js` for the model, localization and PDF layout checks. Browser checks use Playwright and Microsoft Edge: run `node scripts/check-ui-usability.cjs` and `node scripts/check-ui-languages.cjs` against the local server. Set `PLAYWRIGHT_MODULE` to the installed Playwright module path if necessary. These cover stale previews, file import, print geometry, zoom, editing, PDFs and all five UI languages on narrow mobile screens and in landscape.

# YuGiOh Proxy Maker

Create printable Yu-Gi-Oh! proxy cards in English or Italian from a decklist. Preview cards, edit their text or artwork, and download a PDF for printing.

[Open YuGiOh Proxy Maker](https://matpag.github.io/YuGiOhProxyGenerator/)

## Features

- Import `.ydk` or `.txt` decklists, or enter cards manually.
- Choose English or Italian card text.
- Preview cards and customize individual copies.
- Save and reopen projects as JSON files.
- Export printable PDFs with adjustable paper size, margins and card scale.

## How to use

1. Enter one card per line using its exact **English name** or numeric card ID. Add a quantity before the name:

   ```text
   3 Dark Magician
   2 Cyber Dragon
   46986414
   ```

2. Choose the language for the printed cards. For example, `Dark Magician` prints as `Mago Nero` in Italian. Use English names in the decklist even when printing in Italian.
3. Click **Genera anteprima**, then **Scarica PDF**.
4. Print at **100% scale**, without fitting to the page. At card scale 1, cards measure **59 × 86 mm**.

To select another illustration, append its index, such as `Dark Magician [1]`. Use **Modifica carta** to customize a copy and **Salva progetto** / **Apri progetto JSON** to save or reload your work. Generating the decklist again replaces your edits with the card data.

## Run locally

Requires Python 3 and a modern browser. Download or clone this repository, then run:

```sh
python scripts/serve.py
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/). Keep the terminal open while using the app.

## Availability and limitations

English and Italian TCG cards are supported. The included sample cards can be generated without external requests; other cards and artwork variants require an internet connection on first use. The local server supports downloading additional artwork when browser restrictions prevent it on the hosted site.

This is a prototype: visual fidelity is still being refined, and not every card combination has been validated. Missing translations and unsupported combinations are reported. OCG languages are not currently supported.

Card data is provided by [YGOProDeck](https://ygoprodeck.com/).

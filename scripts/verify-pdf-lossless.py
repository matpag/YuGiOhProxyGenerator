"""Extract a saved deck for offline export tests, or verify exact PDF image bytes."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

DIRECTORY = Path('docs/validation/pdf-lossless')

def placements(reader):
    result = []
    for page in reader.pages:
        copies = []
        matrix = None
        for operands, operator in ContentStream(page.get_contents(), reader).operations:
            if operator == b'cm':
                matrix = tuple(float(value) for value in operands)
            elif operator == b'Do':
                image = page['/Resources']['/XObject'][operands[0]]
                copies.append((image, matrix))
        result.append(copies)
    return result

def channels(image):
    size = (int(image['/Width']), int(image['/Height']))
    assert image['/BitsPerComponent'] == 8
    mode = {'/DeviceRGB': 'RGB', '/DeviceGray': 'L'}[image['/ColorSpace']]
    color = image.get_data()
    alpha = image['/SMask'].get_data() if '/SMask' in image else bytes([255]) * (size[0] * size[1])
    return size, mode, color, alpha

def prepare(source):
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(source)
    entries, files = [], {}
    for page in placements(reader):
        for image, _ in page:
            size, mode, color, alpha = channels(image)
            digest = hashlib.sha256(color + alpha).hexdigest()
            if digest not in files:
                filename = f'card-{len(files)}.png'
                bitmap = Image.frombytes(mode, size, color).convert('RGB')
                bitmap.putalpha(Image.frombytes('L', size, alpha))
                bitmap.save(DIRECTORY / filename)
                files[digest] = filename
            entries.append({'file': files[digest], 'quantity': 1})
    (DIRECTORY / 'deck.json').write_text(json.dumps(entries, indent=2), encoding='utf-8')
    print(f'Prepared {len(entries)} copies, {len(files)} unique PNGs from {source}')

def verify():
    results = []
    for source in sorted(DIRECTORY.glob('*-before.pdf')):
        target = source.with_name(source.name.replace('-before.pdf', '-after.pdf'))
        before, after = PdfReader(source), PdfReader(target)
        old_pages, new_pages = placements(before), placements(after)
        assert len(old_pages) == len(new_pages)
        old_objects, new_objects = set(), set()
        for index, (old, new) in enumerate(zip(old_pages, new_pages)):
            assert list(before.pages[index].mediabox) == list(after.pages[index].mediabox)
            assert len(old) == len(new)
            for (original, original_matrix), (optimized, optimized_matrix) in zip(old, new):
                assert original_matrix == optimized_matrix
                assert abs(abs(optimized_matrix[0]) - 59 * 72 / 25.4) < .001
                assert abs(abs(optimized_matrix[3]) - 86 * 72 / 25.4) < .001
                assert channels(original) == channels(optimized), (source.name, index)
                old_objects.add(original.indirect_reference.idnum)
                new_objects.add(optimized.indirect_reference.idnum)
        record = {'case': source.stem.replace('-before', ''), 'pages': len(new_pages),
                  'copies': sum(map(len, new_pages)), 'before_bytes': source.stat().st_size,
                  'after_bytes': target.stat().st_size, 'before_images': len(old_objects),
                  'after_images': len(new_objects), 'pixels_identical': True, 'card_mm': [59, 86]}
        results.append(record)
        print(json.dumps(record))
    assert results, 'No PDF comparisons found'
    (DIRECTORY / 'verification.json').write_text(json.dumps(results, indent=2), encoding='utf-8')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', type=Path)
    args = parser.parse_args()
    prepare(args.prepare) if args.prepare else verify()

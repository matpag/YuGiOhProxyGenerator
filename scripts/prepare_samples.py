"""Prepare additional TCG fixtures and local images, fetching each resource once."""
import json,hashlib,re,html
from pathlib import Path
from datetime import datetime,timezone
from urllib.request import urlopen,Request
ROOT=Path(__file__).resolve().parents[1];APP=ROOT/'app';OUT=ROOT/'docs/research/evidence/extended-samples';OUT.mkdir(parents=True,exist_ok=True)
manifest_path=ROOT/'docs/research/import-manifest.json';manifest=json.loads(manifest_path.read_text())
def get(url):
    with urlopen(Request(url,headers={'User-Agent':'YuGiOh-Proxy-Maker-sample-preparation/1.0'}),timeout=30) as response:
        raw=response.read()
        return raw,{'url':url,'retrieved_at_utc':datetime.now(timezone.utc).isoformat(),'status':response.status,'sha256':hashlib.sha256(raw).hexdigest()}
requests=[]
for lang in ['en','it']:
    target=OUT/f'additional-{lang}.json'
    if not target.exists():
        url='https://db.ygoprodeck.com/api/v7/cardinfo.php?id=23995346,30634223&misc=yes'+('&language=it' if lang=='it' else '')
        raw,meta=get(url);target.write_bytes(raw);requests.append(meta)
    extras=json.loads(target.read_text(encoding='utf-8'))['data']
    ritual_target=OUT/f'ritual-{lang}.json'
    if not ritual_target.exists():
        if lang=='en': ritual_url='https://db.ygoprodeck.com/api/v7/cardinfo.php?name=Black%20Luster%20Soldier&misc=yes'
        else:
            ritual_id=json.loads((OUT/'ritual-en.json').read_text())['data'][0]['id']
            ritual_url=f'https://db.ygoprodeck.com/api/v7/cardinfo.php?id={ritual_id}&misc=yes&language=it'
        raw,meta=get(ritual_url);ritual_target.write_bytes(raw);requests.append(meta)
    extras+=json.loads(ritual_target.read_text(encoding='utf-8'))['data']
    fixture=APP/f'fixtures/cards-{lang}.json';cards=json.loads(fixture.read_text(encoding='utf-8'))
    byid={c['id']:c for c in cards};byid.update({c['id']:c for c in extras});fixture.write_text(json.dumps(list(byid.values()),ensure_ascii=False,indent=2),encoding='utf-8')
    if lang=='en':
        for card in byid.values():
            image=card['card_images'][0]
            for folder,key in [('artwork','image_url_cropped'),('reference','image_url')]:
                dest=APP/f"assets/{folder}/{image['id']}.jpg"
                if not dest.exists():
                    raw,meta=get(image[key]);dest.write_bytes(raw)
                    manifest['downloads'].append({'file':str(dest.relative_to(APP)),'url':meta['url'],'sha256':meta['sha256']})
if requests:
    old_requests=json.loads((OUT/'requests.json').read_text()) if (OUT/'requests.json').exists() else []
    (OUT/'requests.json').write_text(json.dumps(old_requests+requests,indent=2),encoding='utf-8')
overrides_path=APP/'text-overrides/cards.json';overrides=json.loads(overrides_path.read_text(encoding='utf-8'))
if '16178681' not in overrides['cards']:
    url='https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid=11213&request_locale=it'
    raw,meta=get(url);source=raw.decode('utf-8');match=re.search(r'<div class="frame pen_effect">.*?<div class="text_linebreak">(.*?)</div>',source,re.S)
    if not match:raise RuntimeError('Official Pendulum section not found')
    text=html.unescape(re.sub('<[^>]+>','',match.group(1))).strip()
    if not text.startswith('Puoi ridurre'):raise RuntimeError('Unexpected localized section')
    overrides['version']+=1;overrides['cards']['16178681']={'it':{'pendulumEffect':{'value':text,'source':url,'reviewedAt':'2026-10-09'}}}
    overrides_path.write_text(json.dumps(overrides,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'pendulum-it-source.json').write_text(json.dumps({**meta,'section':'pendulumEffect','text':text},ensure_ascii=False,indent=2),encoding='utf-8')
manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Prepared 11 TCG sample pairs, first-artwork images and verified Italian Pendulum override.')

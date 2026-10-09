"""Compare digital frame brightness. Run with Python + Pillow + NumPy.

Existing local references are sufficient for the eleven rendered card pairs.
Extra public-deck samples are cached only in ignored _upstream/research/brightness.
Use --fetch-extra to reacquire the recorded YGOProDeck images and verify their hashes.
No application asset is rewritten by this analysis.
"""
from pathlib import Path
import argparse, hashlib, json, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/validation/frame-colors'
PROFILE = json.loads((ROOT / 'docs/research/evidence/frame-color-profile.json').read_text(encoding='utf-8'))
ROIS = PROFILE['measurement_regions']

def normalized(path):
    return np.asarray(Image.open(path).convert('RGB').resize((421, 614), Image.Resampling.LANCZOS), dtype=float)

def luminance(rgb):
    srgb = rgb / 255.
    linear = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
    y = linear @ np.array([.2126, .7152, .0722])
    return np.where(y > 216/24389, 116*np.cbrt(y)-16, (24389/27)*y)

def measure(array):
    regions = {name: luminance(array[y1:y2, x1:x2].reshape(-1, 3))
               for name, (x1, y1, x2, y2) in ROIS.items()}
    values = {name: float(v.mean()) for name, v in regions.items()}
    values['body'] = float(np.concatenate([v for k,v in regions.items() if k != 'header']).mean())
    return values

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def error(a,b):
    return float(np.mean([abs(a[k]-b[k]) for k in ROIS]))

def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fetch-extra',action='store_true');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    fixture = json.loads((ROOT/'app/fixtures/cards-en.json').read_text(encoding='utf-8'))
    records=[]
    for raw in fixture:
        cid=str(raw['id']).zfill(8);frame=raw['frameType'].replace('_pendulum','.pendulum').capitalize()
        paths={'reference':ROOT/f"app/assets/reference/{raw['id']}.jpg",'before':OUT/f'before/{cid}-en.png',
               'after':OUT/f'after/{cid}-en.png','legacy':ROOT/f'app/vendor/cardmaker/res/tcg/ygo/border/{frame}.png'}
        data={k:measure(normalized(p)) for k,p in paths.items()}
        records.append({'id':cid,'name':raw['name'],'frame':frame,'source':raw['card_images'][0]['image_url'],
                        'paths':{k:p.relative_to(ROOT).as_posix() for k,p in paths.items()},'hashes':{k:sha(p) for k,p in paths.items()},
                        'measurements':data,'mean_absolute_error_before':error(data['before'],data['reference']),
                        'mean_absolute_error_after':error(data['after'],data['reference'])})
    extras=[]
    for group in PROFILE['extra_samples'].values():
        for sample in group:
            path=ROOT/sample['path'].replace('\\','/')
            if not path.exists() and args.fetch_extra:
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_bytes(urllib.request.urlopen(sample['url'],timeout=20).read())
            if not path.exists():
                raise FileNotFoundError(f'{path}: run again with --fetch-extra')
            assert sha(path)==sample['sha256'],f'Reference changed upstream: {sample["url"]}'
            extras.append({**sample,'measurements':measure(normalized(path))})
    adjusted=[r for r in records if r['frame'] in PROFILE['brightness']]
    for r in adjusted:
        assert r['mean_absolute_error_after']<1.6,r['name']
        assert r['mean_absolute_error_after']<r['mean_absolute_error_before']*.6,r['name']
    metrics={'method':PROFILE['method'],'normalization':[421,614],'measurement_regions':ROIS,
             'samples':records,'extra_samples':extras,'unique_reference_cards':len({r['id'].lstrip('0') for r in records+extras})}
    (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n',encoding='utf-8')
    # Same-size, neutral-background comparisons; every triplet uses the same card.
    selected=['55144522','44095762','44508094','46986414','84013237','16178681']
    width,height=220,321;cell_width=720;cell_height=395
    sheet=Image.new('RGB',(cell_width*2,cell_height*3+80),'#e6e6e6');draw=ImageDraw.Draw(sheet)
    draw.text((20,12),'Luminosita dei frame: YGOProDeck / prima / dopo',font=font(26),fill='#111')
    draw.text((20,47),'Solo Magie, Trappole e Synchro ricevono la correzione dello sfondo.',font=font(18),fill='#333')
    for i,cid in enumerate(selected):
        row=next(r for r in records if r['id']==cid);x=(i%2)*cell_width+15;y=(i//2)*cell_height+85
        draw.text((x,y),row['name'],font=font(20),fill='#111')
        for j,label in enumerate(['YGOProDeck','Prima','Dopo']):
            key=['reference','before','after'][j];im=Image.open(ROOT/row['paths'][key]).convert('RGB').resize((width,height),Image.Resampling.LANCZOS)
            xx=x+j*235;draw.text((xx,y+28),label,font=font(17),fill='#333');sheet.paste(im,(xx,y+52))
    sheet.save(OUT/'comparison.png')
    # Magnified strips make small color differences visible without artwork influence.
    strip=Image.new('RGB',(1000,390),'#e6e6e6');sd=ImageDraw.Draw(strip)
    sd.text((15,10),'Zone laterali del frame - dettaglio senza artwork e testo',font=font(22),fill='#111')
    for i,cid in enumerate(selected[:3]):
        row=next(r for r in records if r['id']==cid);y=55+i*105;sd.text((15,y),row['frame'],font=font(18),fill='#111')
        for j,key in enumerate(['reference','before','after']):
            xx=165+j*270;sd.text((xx,y),['YGOProDeck','Prima','Dopo'][j],font=font(17),fill='#333')
            im=Image.open(ROOT/row['paths'][key]).convert('RGB').resize((421,614),Image.Resampling.LANCZOS).crop((18,150,22,205)).resize((240,60),Image.Resampling.NEAREST)
            strip.paste(im,(xx,y+25))
    strip.save(OUT/'frame-strips.png')
    print('Unique reference cards:',metrics['unique_reference_cards'])
    for r in records:
        print(r['frame'], 'L* body delta',round(r['measurements']['before']['body']-r['measurements']['reference']['body'],2),
              '->',round(r['measurements']['after']['body']-r['measurements']['reference']['body'],2),
              'mean error',round(r['mean_absolute_error_before'],2),'->',round(r['mean_absolute_error_after'],2))

if __name__=='__main__':main()

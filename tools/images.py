"""Оптимизация картинок сайта.

  python tools/images.py

Что делает (повторный запуск безопасен — уже готовое пропускается):
  1. удаляет из assets/img файлы, на которые не ссылается ни одна страница;
  2. фото в PNG (без прозрачности) переводит в JPG и правит ссылки;
  3. пережимает JPG тяжелее нужного (до 1600 px по длинной стороне, q80);
  4. рядом кладёт WebP-копии шириной 600 / 1000 / 1600 px;
  5. проставляет <img> атрибуты srcset (WebP) и sizes — браузер сам берёт
     нужный размер, а src остаётся JPG на случай старого браузера;
     всё, что ниже первого экрана, грузится лениво (loading="lazy").

Иконки, логотипы и картинки уже́ 700 px не трогаем.
"""
import glob, os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

IMG = 'assets/img/'
WIDTHS = (600, 1000, 1600)
MAX = 1600            # длинная сторона JPG-оригинала
JPG_Q, WEBP_Q = 80, 78
MIN_SRCSET = 700      # картинкам уже этого srcset не нужен
VARIANT = re.compile(r'-(%s)\.webp$' % '|'.join(map(str, WIDTHS)))

# sizes по контейнеру, в котором стоит картинка (ищем ближайший сверху)
SIZES = [
    ('hero__slide',          '100vw'),
    ('prj-head__cover--wide', '100vw'),
    ('prj-head__cover',      '(max-width: 899px) 100vw, 50vw'),
    ('article__cover--portrait', '(max-width: 899px) 100vw, 50vw'),
    ('article__cover',       '100vw'),
    ('prj-next__media',      '(max-width: 599px) 40vw, 260px'),
    ('pf-item__media',       '(max-width: 599px) 100vw, 50vw'),
    ('news-card__media',     '(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw'),
    ('pf-card__media',       '(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw'),
    ('tile',                 '(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw'),
    ('sci-photos',           '(max-width: 1199px) 50vw, 25vw'),
    ('sci-block__cover',     '260px'),
    ('cmp-structure__photos', '(max-width: 1199px) 50vw, 33vw'),
    ('cmp-science__photos',  '(max-width: 1199px) 50vw, 33vw'),
    ('prj-stages',           '(max-width: 599px) 100vw, 60vw'),
]
DEFAULT_SIZES = '(max-width: 899px) 100vw, 50vw'

# первый экран — грузим сразу
EAGER = ('hero__slide', 'prj-head__cover', 'article__cover')

PAGES = [f for f in glob.glob('*.html')] + glob.glob('partials/*.html')
TEXTS = PAGES + glob.glob('assets/css/*.css') + glob.glob('assets/js/*.js')


def read(p): return open(p, encoding='utf-8').read()
def write(p, s): open(p, 'w', encoding='utf-8').write(s)


def referenced():
    refs = set()
    for p in TEXTS:
        refs |= set(re.findall(r'assets/img/[^"\'\)\s?,]+', read(p)))
    return refs


def is_raster(p): return p.lower().endswith(('.jpg', '.jpeg', '.png'))


def has_alpha(im):
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        return im.convert('RGBA').getextrema()[3][0] < 250
    return False


def stem(p): return os.path.splitext(p)[0]


def main():
    refs = referenced()

    # 1. неиспользуемые
    removed = 0
    for p in glob.glob(IMG + '**/*', recursive=True):
        if os.path.isfile(p) and is_raster(p) and p not in refs and not p.endswith('.webp'):
            os.remove(p); removed += 1
    # осиротевшие webp (их оригинал удалён)
    for p in glob.glob(IMG + '**/*.webp', recursive=True):
        base = VARIANT.sub('', p)
        if not any(os.path.exists(base + e) for e in ('.jpg', '.jpeg', '.png')):
            os.remove(p)
    print('удалено неиспользуемых:', removed)

    # 2. PNG-фото -> JPG
    renames = {}
    for p in sorted(refs):
        if not p.lower().endswith('.png') or not os.path.exists(p):
            continue
        im = Image.open(p)
        if has_alpha(im) or max(im.size) < 400:
            continue                       # иконки и картинки с прозрачностью
        new = stem(p) + '.jpg'
        if os.path.exists(new):
            new = stem(p) + '-photo.jpg'
        im.convert('RGB').save(new, quality=JPG_Q, optimize=True, progressive=True)
        os.remove(p)
        renames[p] = new
    if renames:
        for t in TEXTS + ['README.md']:
            s = read(t); s2 = s
            for a, b in renames.items():
                s2 = s2.replace(a, b)
            if s2 != s: write(t, s2)
    print('PNG -> JPG:', len(renames))

    # 3–4. пережать JPG и сделать WebP
    refs = referenced()
    variants = {}
    saved = 0
    for p in sorted(refs):
        if not os.path.exists(p) or not p.lower().endswith(('.jpg', '.jpeg')):
            continue
        before = os.path.getsize(p)
        im = ImageOps.exif_transpose(Image.open(p)).convert('RGB')
        if max(im.size) > MAX or before > 350 * 1024:
            im.thumbnail((MAX, MAX), Image.LANCZOS)
            tmp = p + '.tmp.jpg'
            im.save(tmp, quality=JPG_Q, optimize=True, progressive=True)
            if os.path.getsize(tmp) < before * 0.9:
                os.replace(tmp, p); saved += before - os.path.getsize(p)
            else:
                os.remove(tmp)
            im = Image.open(p).convert('RGB')
        w = im.width
        if w < MIN_SRCSET:
            continue
        ws = [x for x in WIDTHS if x < w] + ([w] if w <= WIDTHS[-1] else [])
        ws = sorted(set(min(x, w) for x in ws))
        out = []
        for x in ws:
            v = f'{stem(p)}-{x}.webp'
            if not os.path.exists(v) or os.path.getmtime(v) < os.path.getmtime(p):
                r = im if x == w else im.resize((x, round(im.height * x / w)), Image.LANCZOS)
                r.save(v, 'WEBP', quality=WEBP_Q, method=6)
            out.append((v, x))
        variants[p] = out
    print('сэкономлено на JPG: %.1f МБ' % (saved / 1e6))

    # 5. srcset/sizes
    tag = re.compile(r'<img\b[^>]*>', re.S)
    n = 0
    for page in PAGES:
        s = read(page)
        res = []; last = 0
        for m in tag.finditer(s):
            t = m.group(0)
            src = re.search(r'\ssrc="([^"]+)"', t)
            if not src or src.group(1) not in variants:
                continue
            ctx = s[max(0, m.start() - 2500):m.start()]
            best, sizes = -1, DEFAULT_SIZES
            for key, val in SIZES:
                i = ctx.rfind(key)
                if i > best: best, sizes = i, val
            srcset = ', '.join(f'{v} {x}w' for v, x in variants[src.group(1)])
            near = max(EAGER, key=lambda k: ctx.rfind(k))
            eager = ctx.rfind(near) >= 0 and ctx.rfind(near) >= best
            t2 = re.sub(r'\s(srcset|sizes)="[^"]*"', '', t)
            t2 = t2.replace(src.group(0), f'{src.group(0)} srcset="{srcset}" sizes="{sizes}"', 1)
            if not eager and 'loading=' not in t2:
                t2 = t2.replace('<img', '<img loading="lazy"', 1)
            if t2 != t:
                res.append(s[last:m.start()]); res.append(t2); last = m.end(); n += 1
        if res:
            res.append(s[last:]); write(page, ''.join(res))
    print('img со srcset:', n)


if __name__ == '__main__':
    main()

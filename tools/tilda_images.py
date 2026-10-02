"""Перенос картинок на CDN Тильды.

  python tools/tilda_images.py pack          # собрать архив для загрузки
  python tools/tilda_images.py apply FILE    # подставить ссылки Тильды

pack: все картинки, которые использует сайт (без WebP-копий), кладутся
в tilda/upload/pallada-images.zip под уникальными плоскими именами —
Тильда хранит только имя файла, без папок. Соответствие «имя → путь
на сайте» пишется в tilda/upload/map.json.

apply: FILE — любой текст, где встречаются ссылки static.tildacdn.com
(список, сохранённая страница Тильды и т. п.). Ссылки сопоставляются
с картой по имени файла, результат копится в tilda/upload/urls.json
(повторный apply с другим файлом дополняет его).

Тильда обрезает имя файла до 20 символов. Поэтому сопоставляем по
обрезанному имени и только однозначные совпадения; для остальных
`python tools/tilda_images.py repack` собирает архив pallada-images-2.zip
с короткими уникальными именами (карта map2.json).
"""
import glob, json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = 'tilda/upload'
TEXTS = glob.glob('*.html') + glob.glob('partials/*.html') + \
    glob.glob('assets/css/*.css') + glob.glob('assets/js/*.js')


def used():
    refs = set()
    for f in TEXTS:
        for u in re.findall(r'assets/img/[^"\'\)\s?,]+', open(f, encoding='utf-8').read()):
            if not u.endswith('.webp'):
                refs.add(u)
    return sorted(refs)


def flat(path):
    """assets/img/projects/vichuga/vichuga-04.jpg -> vichuga-04.jpg,
    assets/img/3165316___1_1.jpg -> pallada-3165316-1-1.jpg"""
    rel = path[len('assets/img/'):]
    parts = rel.split('/')
    name, ext = os.path.splitext(parts[-1])
    folder = parts[-2] if len(parts) > 1 else ''
    if not folder:
        name = 'pallada-' + name
    elif not name.lower().startswith(folder.lower()):
        name = folder + '-' + name
    name = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return name + ext.lower().replace('.jpeg', '.jpg')


def pack():
    os.makedirs(OUT, exist_ok=True)
    mapping = {}
    for p in used():
        n = flat(p)
        base, ext = os.path.splitext(n)
        i = 2
        while n in mapping:
            n = f'{base}-{i}{ext}'; i += 1
        mapping[n] = p
    z = os.path.join(OUT, 'pallada-images.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as zf:
        for n, p in mapping.items():
            zf.write(p, n)
    json.dump(mapping, open(os.path.join(OUT, 'map.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('файлов:', len(mapping), ' архив: %.1f МБ' % (os.path.getsize(z) / 1e6))


TILDA_STEM = 20      # столько символов имени Тильда сохраняет


def norm(name):
    stem = os.path.splitext(name.lower())[0][:TILDA_STEM]
    return re.sub(r'[^a-z0-9]', '', stem)


def load(name):
    p = os.path.join(OUT, name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def apply(src):
    maps = {**load('map.json'), **load('map2.json')}
    urls = load('urls.json')
    text = open(src, encoding='utf-8', errors='ignore').read()
    links = set(re.findall(r'https://static\.tildacdn\.(?:com|info)/tild[^\s"\'<>)]+', text))
    groups = {}
    for n in maps:
        groups.setdefault(norm(n), []).append(n)
    unknown, ambiguous = [], 0
    for u in links:
        g = groups.get(norm(u.rsplit('/', 1)[-1]))
        if not g:
            unknown.append(u)
        elif len({maps[n] for n in g}) == 1:
            urls[maps[g[0]]] = u
        else:
            ambiguous += 1
    json.dump(urls, open(os.path.join(OUT, 'urls.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1, sort_keys=True)
    need = sorted(set(maps.values()) - set(urls))
    print('сопоставлено: %d из %d' % (len(urls), len(set(maps.values()))))
    print('неоднозначных ссылок (имя обрезано):', ambiguous)
    if unknown: print('лишние ссылки:', len(unknown))
    if need: print('нет ссылки для %d файлов' % len(need))


def short(path):
    """Короткое (до 20 символов) читаемое имя для Тильды."""
    rel = path[len('assets/img/'):]
    parts = rel.split('/')
    name = os.path.splitext(parts[-1])[0].lower()
    folder = parts[-2].lower() if len(parts) > 1 else 'pallada'
    if name.startswith(folder):
        name = name[len(folder):]
    abbr = ''.join(w[:2] for w in folder.split('-'))
    name = re.sub(r'[^a-z0-9]+', '-', name).strip('-')
    return (abbr + '-' + name)[:TILDA_STEM].strip('-')


def repack():
    urls = load('urls.json')
    need = sorted(set(load('map.json').values()) - set(urls))
    mapping = {}
    for p in need:
        base = short(p); ext = os.path.splitext(p)[1].lower().replace('.jpeg', '.jpg')
        n, i = base, 2
        while n + ext in mapping:
            tail = '-%d' % i
            n = base[:TILDA_STEM - len(tail)] + tail; i += 1
        mapping[n + ext] = p
    z = os.path.join(OUT, 'pallada-images-2.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as zf:
        for n, p in mapping.items():
            zf.write(p, n)
    json.dump(mapping, open(os.path.join(OUT, 'map2.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('файлов:', len(mapping), ' архив: %.1f МБ' % (os.path.getsize(z) / 1e6))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'pack'
    if cmd == 'pack': pack()
    elif cmd == 'repack': repack()
    else: apply(sys.argv[2])

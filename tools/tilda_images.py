"""Перенос картинок на CDN Тильды.

  python tools/tilda_images.py pack          # собрать архив для загрузки
  python tools/tilda_images.py apply FILE    # подставить ссылки Тильды

pack: все картинки, которые использует сайт (без WebP-копий), кладутся
в tilda/upload/pallada-images.zip под уникальными плоскими именами —
Тильда хранит только имя файла, без папок. Соответствие «имя → путь
на сайте» пишется в tilda/upload/map.json.

apply: FILE — любой текст, где встречаются ссылки static.tildacdn.com
(список, сохранённая страница Тильды и т. п.). Ссылки сопоставляются
с картой по имени файла, результат пишется в tilda/upload/urls.json.
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


def norm(name):
    return re.sub(r'[^a-z0-9]', '', os.path.splitext(name.lower())[0])


def apply(src):
    mapping = json.load(open(os.path.join(OUT, 'map.json'), encoding='utf-8'))
    text = open(src, encoding='utf-8', errors='ignore').read()
    links = set(re.findall(r'https://static\.tildacdn\.(?:com|info)/[^\s"\'<>)]+', text))
    by = {norm(n): n for n in mapping}
    urls, unknown = {}, []
    for u in links:
        n = norm(u.rsplit('/', 1)[-1])
        if n in by:
            urls[mapping[by[n]]] = u
        else:
            unknown.append(u)
    json.dump(urls, open(os.path.join(OUT, 'urls.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    missing = sorted(n for n, p in mapping.items() if p not in urls)
    print('сопоставлено:', len(urls), 'из', len(mapping))
    if missing: print('нет ссылок для:', *missing, sep='\n  ')
    if unknown: print('лишние ссылки:', *unknown, sep='\n  ')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'pack'
    pack() if cmd == 'pack' else apply(sys.argv[2])

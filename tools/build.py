# -*- coding: utf-8 -*-
"""Подставляет общие куски (шапку и подвал) во все страницы
и проставляет версии стилям и скриптам.

Использование:  python tools/build.py
Правим partials/header.html или partials/footer.html — и прогоняем скрипт,
он обновит разметку между маркерами во всех html в корне.

Версии: к style.css, pages.css, responsive.css и main.js дописывается
?v=<хеш содержимого>. Без этого браузер и кеш GitHub Pages продолжают
отдавать старый файл по тому же адресу, и правка «не доезжает».
"""
import glob, os, re, io, sys, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PARTS = {
    'header': open(os.path.join(ROOT, 'partials/header.html'), encoding='utf-8').read().strip(),
    'footer': open(os.path.join(ROOT, 'partials/footer.html'), encoding='utf-8').read().strip(),
}

ASSETS = ['assets/css/style.css', 'assets/css/pages.css',
          'assets/css/responsive.css', 'assets/css/home.css', 'assets/js/main.js']

VERSIONS = {}
for rel in ASSETS:
    full = os.path.join(ROOT, rel)
    if not os.path.exists(full):
        continue
    digest = hashlib.sha1(open(full, 'rb').read()).hexdigest()[:8]
    VERSIONS[rel] = digest


def stamp(html):
    """Проставляет ?v=<хеш> ссылкам на стили и скрипты."""
    for rel, digest in VERSIONS.items():
        html = re.sub(
            r'(["\'])' + re.escape(rel) + r'(?:\?v=[0-9a-f]+)?\1',
            lambda m: m.group(1) + rel + '?v=' + digest + m.group(1),
            html)
    return html


for path in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    src = open(path, encoding='utf-8').read()
    out = src
    for name, html in PARTS.items():
        block = '<!--#%s-->\n%s\n<!--#/%s-->' % (name, html, name)
        # первый прогон: одиночный маркер <!--#include name-->
        out = out.replace('<!--#include %s-->' % name, block)
        # последующие: заменяем всё между маркерами
        out = re.sub(r'<!--#%s-->.*?<!--#/%s-->' % (name, name), lambda m: block, out, flags=re.S)
    out = stamp(out)
    if out != src:
        open(path, 'w', encoding='utf-8').write(out)
        print('updated', os.path.basename(path))
print('done')

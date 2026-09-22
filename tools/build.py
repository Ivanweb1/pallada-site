# -*- coding: utf-8 -*-
"""Подставляет общие куски (шапку и подвал) во все страницы.

Использование:  python tools/build.py
Правим partials/header.html или partials/footer.html — и прогоняем скрипт,
он обновит разметку между маркерами во всех html в корне.
"""
import glob, os, re, io, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PARTS = {
    'header': open(os.path.join(ROOT, 'partials/header.html'), encoding='utf-8').read().strip(),
    'footer': open(os.path.join(ROOT, 'partials/footer.html'), encoding='utf-8').read().strip(),
}

for path in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    src = open(path, encoding='utf-8').read()
    out = src
    for name, html in PARTS.items():
        block = '<!--#%s-->\n%s\n<!--#/%s-->' % (name, html, name)
        # первый прогон: одиночный маркер <!--#include name-->
        out = out.replace('<!--#include %s-->' % name, block)
        # последующие: заменяем всё между маркерами
        out = re.sub(r'<!--#%s-->.*?<!--#/%s-->' % (name, name), lambda m: block, out, flags=re.S)
    if out != src:
        open(path, 'w', encoding='utf-8').write(out)
        print('updated', os.path.basename(path))
print('done')

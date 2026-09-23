# -*- coding: utf-8 -*-
"""Готовит код страниц для вайб-блоков Тильды.

Использование:  python tools/tilda.py

Что делает:
  * берёт каждую страницу сайта и вырезает её содержимое (всё между шапкой и подвалом);
  * общие стили и скрипт ужимает под один контейнер .pallada — чтобы код блока
    не ломал остальную страницу Тильды и не ломался сам;
  * пути к картинкам делает абсолютными (файлы остаются на GitHub Pages);
  * складывает всё в tilda/parts/ и пишет опись tilda/pages.json.

Собирает код блока уже сам пульт — tilda/index.html: там галочками
включается шапка, подвал, CSS и JS, и код копируется одной кнопкой.
"""
import glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tilda')
PARTS = os.path.join(OUT, 'parts')

# картинки и прочая статика остаются на GitHub Pages
BASE = 'https://ivanweb1.github.io/pallada-site/'

# контейнер, внутри которого живёт вся вёрстка блока
SCOPE = '.pallada'

FONTS = ("@import url('https://fonts.googleapis.com/css2?family=Manrope:"
         "wght@300;400;500;600;700&display=swap&subset=latin,cyrillic');\n")

# страницы, скрытые с сайта, на Тильду не переносим
SKIP = {'process.html', 'proizvodstvokeramiki.html'}


# ---------------------------------------------------------------- CSS

def iter_blocks(css):
    """Разбирает CSS на узлы верхнего уровня: (прелюдия, тело или None)."""
    i, n, buf = 0, len(css), ''
    while i < n:
        ch = css[i]
        if ch == '/' and css[i + 1:i + 2] == '*':
            end = css.find('*/', i + 2)
            end = n if end == -1 else end + 2
            buf += css[i:end]
            i = end
            continue
        if ch in '"\'':
            j = i + 1
            while j < n:
                if css[j] == '\\':
                    j += 2
                    continue
                if css[j] == ch:
                    j += 1
                    break
                j += 1
            buf += css[i:j]
            i = j
            continue
        if ch == ';' and buf.strip().startswith('@'):
            yield buf + ';', None
            buf = ''
            i += 1
            continue
        if ch == '{':
            depth, j = 1, i + 1
            start = j
            while j < n and depth:
                c = css[j]
                if c == '/' and css[j + 1:j + 2] == '*':
                    e = css.find('*/', j + 2)
                    j = n if e == -1 else e + 2
                    continue
                if c in '"\'':
                    j += 1
                    while j < n:
                        if css[j] == '\\':
                            j += 2
                            continue
                        if css[j] == c:
                            j += 1
                            break
                        j += 1
                    continue
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                j += 1
            yield buf, css[start:j - 1]
            buf = ''
            i = j
            continue
        buf += ch
        i += 1
    if buf.strip():
        yield buf, None


def split_selectors(prelude):
    """Делит список селекторов по запятым верхнего уровня."""
    out, buf, depth = [], '', 0
    for ch in prelude:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(buf)
            buf = ''
        else:
            buf += ch
    out.append(buf)
    return out


def strip_comments(text):
    """Вынимает комментарии: в селекторах они только мешают разбору."""
    found = re.findall(r'/\*.*?\*/', text, re.S)
    return re.sub(r'/\*.*?\*/', ' ', text, flags=re.S), found


def scope_selectors(prelude):
    """Загоняет селекторы внутрь контейнера блока."""
    res = []
    for raw in split_selectors(prelude):
        sel = raw.strip()
        if not sel:
            continue
        if sel in (':root', 'html', 'body'):
            new = [SCOPE]
        elif sel.startswith('body.') or sel.startswith('html.'):
            # блокировка прокрутки страницы — она про настоящий body
            new = [sel]
        elif sel == '*':
            new = [SCOPE, SCOPE + ' *']
        elif sel.startswith('*::') or sel.startswith('*:'):
            new = [SCOPE + ' ' + sel]
        elif sel.startswith('html ') or sel.startswith('body '):
            new = [SCOPE + ' ' + sel.split(' ', 1)[1].strip()]
        else:
            new = [SCOPE + ' ' + sel]
        for s in new:
            if s not in res:
                res.append(s)
    return ',\n'.join(res)


NESTED_AT = ('@media', '@supports', '@container', '@layer')


def scope_css(css):
    out = []
    for prelude, body in iter_blocks(css):
        clean, comments = strip_comments(prelude)
        p = clean.strip()
        out.extend(c for c in comments)          # комментарии сохраняем отдельно
        if body is None:
            if p:
                out.append(p)
            continue
        low = p.lower()
        if low.startswith(NESTED_AT):
            out.append(p + ' {\n' + scope_css(body) + '\n}')
        elif low.startswith('@'):
            out.append(p + ' {' + body + '}')
        else:
            out.append(scope_selectors(p) + ' {' + body + '}')
    return '\n'.join(out)


def absolutize(text):
    """Пути к статике — абсолютные, иначе Тильда будет искать их у себя."""
    text = re.sub(r'(src|href)="assets/', r'\1="' + BASE + 'assets/', text)
    text = re.sub(r'url\((["\']?)assets/', r'url(\1' + BASE + 'assets/', text)
    text = re.sub(r'url\((["\']?)\.\./', r'url(\1' + BASE + 'assets/', text)
    return text


# ---------------------------------------------------------------- JS

def scope_js(js):
    """Привязывает скрипт к своему блоку: на странице их может быть несколько."""
    head = (
        "/* Скрипт работает только внутри своего блока: на странице Тильды\n"
        "   рядом могут стоять другие блоки с этим же кодом. */\n"
        "(function () {\n"
        "  var SCOPE = (document.currentScript && document.currentScript.closest('%s'))\n"
        "    || document.querySelector('%s');\n"
        "  if (!SCOPE) return;\n"
        "  function PL_byId(id) { return SCOPE.querySelector('#' + id); }\n" % (SCOPE, SCOPE)
    )
    body = js
    body = body.replace(
        "document.documentElement.style.setProperty('--zoom', w > 1200 ? (w / 1200) : 1);",
        "SCOPE.style.setProperty('--zoom', w > 1200 ? (w / 1200) : 1);")
    body = body.replace('document.querySelectorAll(', 'SCOPE.querySelectorAll(')
    body = body.replace('document.querySelector(', 'SCOPE.querySelector(')
    body = body.replace('document.getElementById(', 'PL_byId(')
    return head + body + '\n})();\n'


# ---------------------------------------------------------------- страницы

def page_css(src):
    """Какие стили подключала страница — в том же порядке."""
    return re.findall(r'href="assets/css/([a-z]+)\.css', src)


def inner(src):
    """Содержимое страницы: всё между шапкой и подвалом."""
    start = src.index('<!--#/header-->') + len('<!--#/header-->')
    end = src.index('<!--#footer-->')
    return src[start:end].strip()


def title(src):
    t = re.search(r'<title>(.*?)</title>', src, re.S).group(1)
    return t.replace('&laquo;', '«').replace('&raquo;', '»').strip()


def descr(src):
    m = re.search(r'<meta name="description" content="(.*?)">', src, re.S)
    return m.group(1).strip() if m else ''


def short(full, file):
    """Короткое имя — им удобно назвать страницу в Тильде."""
    if file == 'index.html':
        return 'Главная'
    return full.split(' — ')[0].strip()


def main():
    os.makedirs(PARTS, exist_ok=True)
    os.makedirs(os.path.join(PARTS, 'css'), exist_ok=True)

    # общие стили
    for rel in glob.glob(os.path.join(ROOT, 'assets/css/*.css')):
        name = os.path.basename(rel)
        css = scope_css(open(rel, encoding='utf-8').read())
        css = absolutize(css)
        if name == 'style.css':
            css = FONTS + css
        open(os.path.join(PARTS, 'css', name), 'w', encoding='utf-8').write(css)

    # общий скрипт
    js = scope_js(open(os.path.join(ROOT, 'assets/js/main.js'), encoding='utf-8').read())
    open(os.path.join(PARTS, 'main.js'), 'w', encoding='utf-8').write(js)

    # шапка и подвал — их можно вынести в отдельные блоки Тильды
    for part in ('header', 'footer'):
        html = open(os.path.join(ROOT, 'partials', part + '.html'), encoding='utf-8').read()
        open(os.path.join(PARTS, part + '.html'), 'w', encoding='utf-8').write(
            absolutize(html.strip()) + '\n')

    pages = []
    for path in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        file = os.path.basename(path)
        if file in SKIP:
            continue
        src = open(path, encoding='utf-8').read()
        slug = file[:-5]
        open(os.path.join(PARTS, file), 'w', encoding='utf-8').write(absolutize(inner(src)) + '\n')
        full = title(src)
        pages.append({
            'file': file,
            'slug': 'index' if slug == 'index' else slug,
            'title': short(full, file),
            'seo_title': full,
            'descr': descr(src),
            'url': BASE + ('' if file == 'index.html' else file),
            'css': page_css(src),
        })

    order = ['index.html', 'company.html', 'portfolio.html', 'science.html',
             'news.html', 'contacts.html', 'privacy.html']
    pages.sort(key=lambda p: (order.index(p['file']) if p['file'] in order else len(order),
                              p['file']))

    open(os.path.join(OUT, 'pages.json'), 'w', encoding='utf-8').write(
        json.dumps({'base': BASE, 'scope': SCOPE, 'pages': pages},
                   ensure_ascii=False, indent=2) + '\n')
    print('страниц:', len(pages))


if __name__ == '__main__':
    main()

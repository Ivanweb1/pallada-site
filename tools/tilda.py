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
import glob, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tilda')
PARTS = os.path.join(OUT, 'parts')

# картинки и прочая статика остаются на GitHub Pages
BASE = 'https://ivanweb1.github.io/pallada-site/'

# контейнер, внутри которого живёт вся вёрстка блока
SCOPE = '.pallada'

FONTS = ("@import url('https://fonts.googleapis.com/css2?family=Manrope:"
         "wght@300;400;500;600;700&display=swap&subset=latin,cyrillic');\n")

# обёртка скрипта: %(body)s подставляется внутрь init(SCOPE)
JS_WRAPPER = open(os.path.join(ROOT, 'tools/tilda-wrapper.js'), encoding='utf-8').read()

# Классы <body> прототипа (сейчас это .inner на внутренних страницах).
# На Тильде <body> чужой, поэтому такие классы переезжают на контейнер блока,
# а селекторы вроде «.inner .header__inner» склеиваются со скоупом.
BODY_CLASSES = set()

# Тильда не сохраняет вайб-блок тяжелее этого (байт)
LIMIT = 100 * 1024

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
        first = re.match(r'^((?:\.[A-Za-z0-9_-]+)+)(\s|$)', sel)
        if sel in (':root', 'html', 'body'):
            new = [SCOPE]
        elif first and all(c in BODY_CLASSES for c in first.group(1).split('.')[1:]):
            # «.inner .header__inner» → «.pallada.inner .header__inner»
            new = [SCOPE + first.group(1) + sel[len(first.group(1)):]]
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


def body_rules(scoped, cls):
    """Выбирает из готового CSS правила, висящие на классе <body>.

    Их кладём отдельным куском и вставляем прямо в блок: тогда линии в
    шапке не зависят от того, обновлён ли общий CSS в HEAD сайта.
    """
    needle = SCOPE + '.' + cls
    out = []
    for prelude, body in iter_blocks(scoped):
        clean, _ = strip_comments(prelude)
        p = clean.strip()
        if body is None:
            continue
        if p.lower().startswith(NESTED_AT):
            inner_rules = body_rules(body, cls)
            if inner_rules:
                out.append(p + ' {\n' + inner_rules + '\n}')
        elif needle in p:
            out.append(p + ' {' + body + '}')
    return '\n'.join(out)


def absolutize(text):
    """Пути к статике — абсолютные, иначе Тильда будет искать их у себя."""
    # не только src/href: у сканов лицензий полный размер лежит в data-full
    text = re.sub(r'([a-zA-Z-]+)="assets/', r'\1="' + BASE + 'assets/', text)
    text = re.sub(r'url\((["\']?)assets/', r'url(\1' + BASE + 'assets/', text)
    text = re.sub(r'url\((["\']?)\.\./', r'url(\1' + BASE + 'assets/', text)
    return text


# ---------------------------------------------------------------- JS

def scope_js(js):
    """Привязывает скрипт к блоку.

    Скрипт работает в двух режимах: внутри блока (заводит свой .pallada)
    и подключённый в HTML-код в HEAD сайта — тогда заводит все блоки
    страницы. Второй режим нужен, чтобы вайб-блок остался лёгким:
    Тильда не сохраняет блок тяжелее 100 КБ.
    """
    body = js
    body = body.replace(
        "document.documentElement.style.setProperty('--zoom', w > 1200 ? (w / 1200) : 1);",
        "SCOPE.style.setProperty('--zoom', w > 1200 ? (w / 1200) : 1);")
    body = body.replace('var OVERLAY_HOST = document.body;', 'var OVERLAY_HOST = SCOPE;')
    body = body.replace('document.querySelectorAll(', 'SCOPE.querySelectorAll(')
    body = body.replace('document.querySelector(', 'SCOPE.querySelector(')
    body = body.replace('document.getElementById(', 'PL_byId(')
    body = '\n'.join('  ' + line if line.strip() else line for line in body.split('\n'))
    return JS_WRAPPER % {'scope': SCOPE, 'body': body}


def minify(path, loader):
    """Сжимает файл esbuild'ом. Нет esbuild — сжатая версия просто не обновится."""
    out = os.path.join(PARTS, 'min', os.path.relpath(path, PARTS))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    try:
        res = subprocess.run(['npx', '--yes', 'esbuild@0.24.0',
                              '--minify', '--loader=' + loader, '--charset=utf8'],
                             stdin=open(path, 'rb'), capture_output=True, timeout=300)
    except Exception as err:
        print('esbuild недоступен (%s) — сжатые версии оставлены как есть' % err)
        return False
    if res.returncode != 0:
        print('esbuild не справился с', path, res.stderr.decode()[:200])
        return False
    open(out, 'wb').write(res.stdout)
    return True


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


def body_class(src):
    m = re.search(r'<body(?:\s+class="([^"]*)")?\s*>', src)
    return (m.group(1) or '').strip() if m else ''


def main():
    os.makedirs(PARTS, exist_ok=True)
    os.makedirs(os.path.join(PARTS, 'css'), exist_ok=True)

    # классы <body> нужны раньше стилей — селекторы с ними склеиваются со скоупом
    for path in glob.glob(os.path.join(ROOT, '*.html')):
        BODY_CLASSES.update(body_class(open(path, encoding='utf-8').read()).split())

    # общие стили
    for rel in glob.glob(os.path.join(ROOT, 'assets/css/*.css')):
        name = os.path.basename(rel)
        css = scope_css(open(rel, encoding='utf-8').read())
        css = absolutize(css)
        if name == 'style.css':
            css = FONTS + css
        out = os.path.join(PARTS, 'css', name)
        open(out, 'w', encoding='utf-8').write(css)
        minify(out, 'css')

    # правила на классах <body> — отдельным куском для вставки в сам блок
    for cls in sorted(BODY_CLASSES):
        chunk = []
        for name in ('style.css', 'pages.css', 'home.css', 'responsive.css'):
            path = os.path.join(PARTS, 'css', name)
            if not os.path.exists(path):
                continue
            rules = body_rules(open(path, encoding='utf-8').read(), cls)
            if rules:
                chunk.append(rules)
        if chunk:
            out = os.path.join(PARTS, 'css', 'body-' + cls + '.css')
            open(out, 'w', encoding='utf-8').write('\n'.join(chunk) + '\n')
            minify(out, 'css')

    # общий скрипт
    js = scope_js(open(os.path.join(ROOT, 'assets/js/main.js'), encoding='utf-8').read())
    out = os.path.join(PARTS, 'main.js')
    open(out, 'w', encoding='utf-8').write(js)
    minify(out, 'js')

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
            'body_class': body_class(src),
            'body_css': bool(body_class(src)) and os.path.exists(
                os.path.join(PARTS, 'css', 'body-' + body_class(src).split()[0] + '.css')),
            'url': BASE + ('' if file == 'index.html' else file),
            'css': page_css(src),
        })

    order = ['index.html', 'company.html', 'portfolio.html', 'science.html',
             'news.html', 'contacts.html', 'privacy.html']
    pages.sort(key=lambda p: (order.index(p['file']) if p['file'] in order else len(order),
                              p['file']))

    open(os.path.join(OUT, 'pages.json'), 'w', encoding='utf-8').write(
        json.dumps({'base': BASE, 'scope': SCOPE, 'limit': LIMIT, 'pages': pages},
                   ensure_ascii=False, indent=2) + '\n')
    print('страниц:', len(pages))


if __name__ == '__main__':
    main()

import re, sys
src, out = sys.argv[1], sys.argv[2]
html = open(src).read()
css = html[html.index('<style>')+7: html.index('</style>')]
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
R = '.paspor'
# keyframe names
kf = set(re.findall(r'@keyframes\s+([\w-]+)', css))
def rename_anim(decls):
    def rep(m):
        val = m.group(2)
        for k in sorted(kf, key=len, reverse=True):
            val = re.sub(r'(?<![\w-])%s(?![\w-])' % re.escape(k), 'pp-' + k, val)
        return m.group(1) + val
    return re.sub(r'(animation(?:-name)?\s*:)([^;}]*)', rep, decls)
def scope_sel(sel):
    sel = sel.strip()
    if sel.startswith(':root'): return R + sel[5:]
    if sel.startswith('html'): return 'html.paspor-html' + sel[4:]
    if sel.startswith('body'): return R + sel[4:]
    if sel.startswith('.paused'): return R + sel   # .paspor.paused *
    if sel.startswith('.tv '): return R + '.tv ' + sel[4:]
    if sel.startswith('.tv'): return R + sel
    if sel == '*': return R + ', ' + R + ' *'
    if sel.startswith('*'): return R + ' ' + sel
    return R + ' ' + sel
def walk(s, i, depth):
    res = []
    while i < len(s):
        j = s.find('{', i); k = s.find('}', i)
        if k != -1 and (j == -1 or k < j):
            return ''.join(res), k + 1
        if j == -1: break
        head = s[i:j].strip()
        if head.startswith('@keyframes'):
            name = head.split()[1]
            # find matching close
            d, p = 1, j + 1
            while d:
                if s[p] == '{': d += 1
                elif s[p] == '}': d -= 1
                p += 1
            res.append('@keyframes pp-%s{%s}\n' % (name, s[j+1:p-1].strip()))
            i = p; continue
        if head.startswith('@media') or head.startswith('@container') or head.startswith('@supports'):
            inner, p = walk(s, j + 1, depth + 1)
            res.append('%s{\n%s}\n' % (head, inner)); i = p; continue
        k = s.find('}', j)
        body = rename_anim(s[j+1:k].strip())
        sels = [x for x in head.split(',') if x.strip()]
        res.append('%s{%s}\n' % (','.join(scope_sel(x) for x in sels), body))
        i = k + 1
    return ''.join(res), i
body, _ = walk(css, 0, 0)
hdr = ("/*\n * Halaman publik \"Paspor & cap\". DIBANGKITKAN dari docs/design/halaman-publik/rujukan-paspor-v3.html\n"
       " * (rujukan yang disetujui pemilik 12 Nov 2026): setiap pemilih dilingkupkan ke .paspor dan nama keyframes diberi\n"
       " * awalan pp- supaya tidak menimpa gaya back office (Tailwind juga punya spin/pulse). Ubah rujukannya, lalu\n"
       " * bangkitkan ulang dengan scripts/publik-css.py; tambahan khusus aplikasi ada di paspor-app.css.\n */\n")
open(out, 'w').write(hdr + body)
print(len(body), sorted(kf))

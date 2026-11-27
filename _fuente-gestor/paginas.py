# Arma una página pública por proyecto (docs/p/<id>/index.html) con las etiquetas og:
# para que WhatsApp muestre la vista previa (foto + nombre) al mandar el link.
# La imagen la sube el gestor a Supabase: bucket público "publico", proyectos/<id>.jpg
# Uso: python3 _fuente-gestor/paginas.py  -> después commit + push de docs/p
import os, re, json, html, urllib.request
B = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(B)
src = open(os.path.join(B, "armar.py")).read()
SB_URL = re.search(r'SB_URL = "([^"]+)"', src).group(1); SB_KEY = re.search(r'SB_KEY = "([^"]+)"', src).group(1)
SITIO = "https://pturdera.github.io/gestor-desarrollos"
req = urllib.request.Request(SB_URL + "/rest/v1/rpc/proyectos_publicos", data=b"{}", method="POST",
  headers={"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json"})
proys = json.load(urllib.request.urlopen(req, timeout=30))
TIPOS = {"edificio": "Edificio de departamentos", "barrio": "Barrio cerrado", "condominio": "Condominio", "comercial": "Centro comercial / locales", "otro": "Desarrollo"}
carpeta = os.path.join(RAIZ, "docs", "p"); os.makedirs(carpeta, exist_ok=True)
e = lambda v: html.escape(str(v or ""), quote=True)
for p in proys:
    img = f"{SB_URL}/storage/v1/object/public/publico/proyectos/{p['id']}.jpg"
    url = f"{SITIO}/p/{p['id']}/"
    sub = " · ".join(x for x in [p.get("localidad"), p.get("desarrolladora")] if x) or TIPOS.get(p.get("tipo"), "")
    desc = (p.get("descripcion") or "").strip() or f"{TIPOS.get(p.get('tipo'), 'Desarrollo')}{' en ' + p['localidad'] if p.get('localidad') else ''}. Coldwell Banker."
    pag = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(p['nombre'])} · Coldwell Banker</title>
<meta name="description" content="{e(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Coldwell Banker">
<meta property="og:title" content="{e(p['nombre'])} · {e(sub)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(img)}">
<meta property="og:image:secure_url" content="{e(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<style>
:root{{--bg:#f3f4f6;--panel:#fff;--ink:#15171a;--muted:#5d6470}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0f1114;--panel:#181b20;--ink:#e8eaee;--muted:#9aa1ad}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
main{{max-width:760px;margin:0 auto;padding:24px 16px}}
.card{{background:var(--panel);border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.08)}}
img{{display:block;width:100%;height:auto;background:#15171a}}
.txt{{padding:16px 20px 20px}} h1{{font-size:24px;margin:0 0 4px}} p{{margin:0;color:var(--muted)}}
</style></head>
<body><main><div class="card"><img src="{e(img)}" alt="{e(p['nombre'])}" width="1200" height="630">
<div class="txt"><h1>{e(p['nombre'])}</h1><p>{e(sub)}</p><p style="margin-top:10px">{e(desc)}</p>
<p style="margin-top:14px">Consultá disponibilidad, precios y formas de pago con tu asesor de Coldwell Banker.</p></div></div></main></body></html>
"""
    d = os.path.join(carpeta, p["id"]); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w").write(pag)
print(len(proys), "páginas")

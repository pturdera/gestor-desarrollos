# Arma los archivos para Mariana: python3 armar.py <carpeta con export/ y logo.jpg>
import json,glob,os,base64,sys
S=sys.argv[1]; B=os.path.dirname(os.path.abspath(__file__)); CB=os.path.dirname(B)
locs=[]
for f in glob.glob(S+'/export/locales/*.json'):
  d=json.load(open(f)); d['id']=os.path.basename(f)[:-5]; locs.append(d)
locs.sort(key=lambda l:l['orden'])
pres=[]
for f in sorted(glob.glob(S+'/export/presupuestos/*.json')):
  d=json.load(open(f)); d['id']=os.path.basename(f)[:-5]; pres.append(d)
seed={"locales":[{k:l[k] for k in ('id','codigo','planta','nave','m2','usdM2','estado','cliente','rubro','notas','orden')} for l in locs],"presupuestos":pres}
gs=open(B+"/Codigo.gs").read().replace("__SEED__",json.dumps(seed,ensure_ascii=False))
src=open(CB+"/reservas-cb.html").read().split("\n")
css="\n".join(src[4:111])
logo="data:image/jpeg;base64,"+base64.b64encode(open(S+"/logo.jpg","rb").read()).decode()
head='<!DOCTYPE html>\n<html lang="es">\n<head>\n<base target="_top">\n<meta charset="utf-8">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap">\n'
idx=head+css+"\n"+open(B+"/cuerpo.html").read().replace("__LOGO__",logo)
out=CB+"/para-mariana/"
open(out+"1 - Codigo.txt","w").write(gs)
api=sys.argv[2] if len(sys.argv)>2 else "__API__"
headw='<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>Locales Black · Coldwell Banker</title>\n<meta name="robots" content="noindex, nofollow">\n<meta name="theme-color" content="#15171a">\n<meta name="apple-mobile-web-app-title" content="Locales Black">\n<link rel="icon" href="'+logo+'">\n<link rel="apple-touch-icon" href="'+logo+'">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Carlito:wght@400;700&display=swap">\n'
membrete="data:image/jpeg;base64,"+base64.b64encode(open(S+"/membrete.jpg","rb").read()).decode()
web=headw+css+"\n"+open(B+"/cuerpo-web.html").read().replace("__LOGO__",logo).replace("__API__",api).replace("__MEMBRETE__",membrete)
open(out+"Locales Black.html","w").write(web)
os.makedirs(CB+"/web",exist_ok=True); open(CB+"/web/index.html","w").write(web)
viejo=out+"2 - Index.txt"
if os.path.exists(viejo): os.remove(viejo)
print("ok",len(gs),len(idx))

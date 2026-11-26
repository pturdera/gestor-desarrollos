# Arma la copia con Supabase: python3 armar.py <carpeta con logo.jpg>  -> CB/web/v2/index.html
import os, sys, base64
S = sys.argv[1]; B = os.path.dirname(os.path.abspath(__file__)); CB = os.path.dirname(B)
SB_URL = "https://itxitqxblobjvlutneae.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eGl0cXhibG9ianZsdXRuZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2NDk2NzksImV4cCI6MjExMTIyNTY3OX0.Yx0OlBPWjbng7NaYdLsIWzl7ibwSVZeW84eQTdAGEl0"
logo = "data:image/jpeg;base64," + base64.b64encode(open(S + "/logo.jpg", "rb").read()).decode()
memb = "data:image/jpeg;base64," + base64.b64encode(open(B + "/membrete.jpg", "rb").read()).decode()
css = "\n".join(open(CB + "/reservas-cb.html").read().split("\n")[4:111])
head = ('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  '<title>Locales Black · Coldwell Banker</title>\n<meta name="robots" content="noindex, nofollow">\n'
  '<meta name="theme-color" content="#15171a">\n<meta name="apple-mobile-web-app-title" content="Locales Black">\n'
  '<link rel="icon" href="' + logo + '">\n<link rel="apple-touch-icon" href="' + logo + '">\n'
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Carlito:wght@400;700&display=swap">\n')
cuerpo = open(B + "/cuerpo.html").read().replace("__LOGO__", logo).replace("__MEMBRETE__", memb).replace("__SB_URL__", SB_URL).replace("__SB_KEY__", SB_KEY)
os.makedirs(CB + "/web/v2", exist_ok=True)
open(CB + "/web/v2/index.html", "w").write(head + css + "\n" + cuerpo)
print("ok", len(head + css + cuerpo))

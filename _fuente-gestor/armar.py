# Arma el gestor: python3 armar.py <carpeta con logo.jpg> -> docs/v2/index.html (GitHub Pages)
import os, sys, base64
S = sys.argv[1]; B = os.path.dirname(os.path.abspath(__file__)); CB = os.path.dirname(B)
SB_URL = "https://tfnaacvzjtamjgkzofeh.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmbmFhY3Z6anRhbWpna3pvZmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU3MjY3NTIsImV4cCI6MjExMTMwMjc1Mn0.ctnOCcYGADcNfES-BHCunCnN08r0wdh1_vVhD14_3J8"
logo = "data:image/jpeg;base64," + base64.b64encode(open(S + "/logo.jpg", "rb").read()).decode()
memb = "data:image/jpeg;base64," + base64.b64encode(open(B + "/membrete.jpg", "rb").read()).decode()
css = "\n".join(open(CB + "/reservas-cb.html").read().split("\n")[4:111])
head = ('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  '<title>Gestor de desarrollos · Coldwell Banker</title>\n<meta name="robots" content="noindex, nofollow">\n'
  '<meta name="theme-color" content="#15171a">\n<meta name="apple-mobile-web-app-title" content="Desarrollos CB">\n'
  '<link rel="icon" href="' + logo + '">\n<link rel="apple-touch-icon" href="' + logo + '">\n'
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Carlito:wght@400;700&display=swap">\n')
cuerpo = open(B + "/cuerpo.html").read().replace("__LOGO__", logo).replace("__MEMBRETE__", memb).replace("__SB_URL__", SB_URL).replace("__SB_KEY__", SB_KEY)
open(CB + "/docs/v2/index.html", "w").write(head + css + "\n" + cuerpo)
print("ok", len(head + css + cuerpo))

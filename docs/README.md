# Locales Black · Coldwell Banker

Control de los locales del Paseo de Compras Black (Escobar, Zona Puertos): disponibilidad, presupuestos, reservas e historial.

- **Página:** `index.html`. Se publica con GitHub Pages (Settings → Pages → rama `main`, carpeta `/`). Se entra con nombre y clave, desde la computadora o el celular.
- **Datos:** viven en la planilla de Google "Locales Black CB". La página les habla a través del Apps Script de esa planilla (dirección `/exec` escrita en `index.html`, constante `API_FIJA`).
- **Código de Google:** `google/Codigo.gs`. Se pega en Extensiones → Apps Script de la planilla. Después de cambiarlo: Implementar → Gestionar implementaciones → lápiz → Versión: **Nueva versión** → Implementar.
- **Clave:** se cambia desde la planilla, menú **Locales Black → Cambiar clave**.
- **Instalación desde cero:** `Instrucciones para instalar.pdf`.

## Versión nueva (copia con Supabase) · `v2/`

- **Página:** `v2/index.html` → https://marianaramoscb-prog.github.io/locales-black/v2/
- **Datos:** base de datos Supabase (proyecto "Gestion", organización Coldwell Banker). Usuarios propios por agente, permisos por rol (admin / agente), comentarios internos y archivos (planos, fotos, documentos) por local.
- La primera cuenta que se crea queda como administradora. Las siguientes quedan pendientes hasta que un admin las habilita en **Mis datos → Equipo**.
- La versión anterior (Google Sheets, en la raíz) sigue funcionando mientras se prueba esta.

/* ==============================================================
   LOCALES BLACK · COLDWELL BANKER
   Sistema de locales, presupuestos y reservas del Paseo Black (Escobar).
   Los datos viven en esta planilla. La app es el archivo "Locales Black.html",
   que se comunica con este script (publicado como aplicación web).

   Se entra con clave (menú de la planilla: Locales Black → Cambiar clave).
   Primera vez: elegí la función "instalar" arriba y tocá Ejecutar.
   No vuelvas a ejecutar "instalar" después: no borra nada, pero
   avisa si la planilla ya tiene datos y no hace nada.
   ============================================================== */

const HOJAS = {
  Locales: [
    ["id", "ID"], ["codigo", "Código"], ["planta", "Planta"], ["nave", "Nave"], ["m2", "m²"],
    ["usdM2", "USD/m²"], ["precio", "Precio USD"], ["estado", "Estado"], ["cliente", "Cliente"],
    ["rubro", "Rubro"], ["notas", "Notas"], ["orden", "Orden"], ["actualizado", "Actualizado"]
  ],
  Presupuestos: [
    ["id", "ID"], ["numero", "N°"], ["fecha", "Fecha"], ["cliente", "Cliente"], ["contacto", "Contacto"],
    ["vigencia", "Vigente hasta"], ["estado", "Estado"], ["locales", "Locales"], ["total", "Total USD"],
    ["anticipoPct", "Anticipo %"], ["cuotas", "Cuotas"], ["honorariosPct", "Honorarios %"],
    ["certificacionArs", "Certificación $"], ["notas", "Notas"], ["detalle", "Detalle (no tocar)"], ["asesor", "Asesor"]
  ],
  Reservas: [
    ["id", "ID"], ["fecha", "Fecha"], ["codigo", "Local"], ["cliente", "Cliente"], ["contacto", "Contacto"],
    ["precio", "Precio USD"], ["sena", "Seña USD"], ["vence", "Vence"], ["estado", "Estado"],
    ["presupuesto", "Presupuesto"], ["notas", "Notas"], ["cerrada", "Cerrada"], ["localId", "ID local"], ["asesor", "Asesor"]
  ],
  Asesores: [["nombre", "Nombre"], ["telefono", "Teléfono"], ["email", "Email"], ["actualizado", "Actualizado"]],
  Historial: [["ts", "Fecha y hora"], ["texto", "Movimiento"], ["localId", "Local"], ["por", "Usuario"]],
  Config: [["clave", "Clave"], ["valor", "Valor"]]
};
const FECHAS = ["fecha", "vigencia", "vence", "cerrada"];
const FECHAS_HORA = ["ts", "actualizado"];
const ESTADOS = { disponible: "Disponible", reservado: "Reservado", vendido: "Vendido", no_disponible: "No disponible" };

/* ---------------- página web ---------------- */
/* La app es el archivo "Locales Black.html". Este script solo guarda y lee los datos:
   la página le manda cada pedido por doPost con la clave o la sesión. */
function doGet() {
  return HtmlService.createHtmlOutput('<p style="font:15px Arial;padding:24px">Este es el servidor de <b>Locales Black</b>. Para usar el sistema abrí la página Locales Black.</p>')
    .setTitle("Locales Black · servidor");
}
const API_ = {
  entrar: (a) => entrar(a[0], a[1]),
  salir: (a) => salir(a[0]),
  getDatos: (a) => getDatos(a[0]),
  guardarLocal: (a) => guardarLocal(a[0], a[1], a[2]),
  crearPresupuesto: (a) => crearPresupuesto(a[0], a[1]),
  estadoPresupuesto: (a) => estadoPresupuesto(a[0], a[1], a[2]),
  reservar: (a) => reservar(a[0], a[1], a[2], a[3]),
  cerrarReserva: (a) => cerrarReserva(a[0], a[1], a[2]),
  guardarPdf: (a) => guardarPdf(a[0], a[1], a[2]),
  guardarPerfil: (a) => guardarPerfil(a[0], a[1])
};
function doPost(e) {
  let r;
  try {
    const q = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!Object.prototype.hasOwnProperty.call(API_, q.fn)) throw new Error("Pedido desconocido.");
    r = { ok: true, data: API_[q.fn](Array.isArray(q.args) ? q.args : []) };
  } catch (err) {
    r = { ok: false, error: String((err && err.message) || err).replace(/^Error:\s*/, "") };
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- acceso a hojas ---------------- */
// La planilla, sus hojas y la zona horaria se abren una sola vez por pedido.
let LIBRO_ = null, TZ_ = null;
const HOJAS_ = {}, COLS_ = {};
function libro_() {
  if (LIBRO_) return LIBRO_;
  const id = PropertiesService.getScriptProperties().getProperty("PLANILLA_ID");
  LIBRO_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return LIBRO_;
}
function hoja_(nombre) {
  if (HOJAS_[nombre]) return HOJAS_[nombre];
  let h = libro_().getSheetByName(nombre);
  if (!h && nombre === "Asesores") {
    // Hoja nueva (agregada después de la instalación): se crea sola la primera vez
    h = libro_().insertSheet(nombre);
    const t = HOJAS[nombre].map(c => c[1]);
    h.getRange(1, 1, 1, t.length).setValues([t]).setFontWeight("bold").setBackground("#15171a").setFontColor("#ffffff");
    h.setFrozenRows(1);
  }
  if (!h) throw new Error("Falta la hoja " + nombre + ". ¿Se ejecutó la función instalar?");
  HOJAS_[nombre] = h;
  return h;
}
function tz_() { return TZ_ || (TZ_ = libro_().getSpreadsheetTimeZone() || "America/Argentina/Buenos_Aires"); }
function aISO_(v, conHora) {
  if (!(v instanceof Date)) return v === null || v === undefined ? "" : String(v);
  return Utilities.formatDate(v, tz_(), conHora ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd");
}
function aFecha_(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return s;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}
function columnas_(nombre, h) {
  if (COLS_[nombre]) return COLS_[nombre];
  const titulos = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getValues()[0].map(String);
  // Si a la hoja le falta una columna nueva (por ejemplo "Asesor"), se agrega al final
  const faltan = HOJAS[nombre].filter(([k, t]) => titulos.indexOf(t) < 0).map(c => c[1]);
  if (faltan.length) {
    const desde = titulos.filter(x => x !== "").length;
    h.getRange(1, desde + 1, 1, faltan.length).setValues([faltan]).setFontWeight("bold").setBackground("#15171a").setFontColor("#ffffff");
    faltan.forEach((t, j) => { titulos[desde + j] = t; });
  }
  const col = {};
  HOJAS[nombre].forEach(([k, t]) => { const i = titulos.indexOf(t); if (i >= 0) col[k] = i; });
  COLS_[nombre] = col;
  return col;
}
function leer_(nombre) {
  const h = hoja_(nombre), n = h.getLastRow();
  if (n < 2) return [];
  const col = columnas_(nombre, h);
  const filas = h.getRange(2, 1, n - 1, h.getLastColumn()).getValues();
  return filas.filter(f => f.some(v => v !== "")).map(f => {
    const o = {};
    Object.keys(col).forEach(k => {
      let v = f[col[k]];
      if (FECHAS.includes(k)) v = aISO_(v, false);
      else if (FECHAS_HORA.includes(k)) v = aISO_(v, true);
      o[k] = v;
    });
    return o;
  });
}
function filaDe_(nombre, o) {
  return HOJAS[nombre].map(([k]) => {
    let v = o[k];
    if (v === undefined || v === null) return "";
    if (FECHAS.includes(k) || FECHAS_HORA.includes(k)) return aFecha_(v);
    return v;
  });
}
function agregar_(nombre, o) {
  const h = hoja_(nombre), col = columnas_(nombre, h);
  const fila = new Array(Math.max(...Object.values(col)) + 1).fill("");
  Object.keys(col).forEach(k => {
    let v = o[k];
    if (v === undefined || v === null) return;
    if (FECHAS.includes(k) || FECHAS_HORA.includes(k)) v = aFecha_(v);
    fila[col[k]] = v;
  });
  h.appendRow(fila);
  borrarCache_();
}

/* Copia rápida de los datos: se guarda unos minutos y se borra con cada cambio */
const CACHE_PARTES_ = 12;
function borrarCache_() {
  try { const c = CacheService.getScriptCache(); const k = ["datos_n"]; for (let i = 0; i < CACHE_PARTES_; i++) k.push("datos_" + i); c.removeAll(k); } catch (e) {}
}
function leerCache_() {
  try {
    const c = CacheService.getScriptCache(), n = +(c.get("datos_n") || 0);
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push("datos_" + i);
    const partes = c.getAll(keys); let t = "";
    for (let i = 0; i < n; i++) { if (partes["datos_" + i] == null) return null; t += partes["datos_" + i]; }
    return t;
  } catch (e) { return null; }
}
function guardarCache_(t) {
  try {
    const tam = 90000, n = Math.ceil(t.length / tam);
    if (n > CACHE_PARTES_) return;
    const o = { datos_n: String(n) };
    for (let i = 0; i < n; i++) o["datos_" + i] = t.slice(i * tam, (i + 1) * tam);
    CacheService.getScriptCache().putAll(o, 600);
  } catch (e) {}
}
// Si alguien edita la planilla a mano, la app toma el cambio al instante
function onEdit() { borrarCache_(); }
function actualizar_(nombre, id, campos) {
  const h = hoja_(nombre), col = columnas_(nombre, h), n = h.getLastRow();
  if (n < 2) throw new Error("No se encontró " + id);
  const ids = h.getRange(2, col.id + 1, n - 1, 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(String(id));
  if (i < 0) throw new Error("No se encontró " + id + " en " + nombre);
  // Lee y escribe la fila entera de una vez (mucho más rápido que celda por celda)
  const ancho = h.getLastColumn();
  const rango = h.getRange(i + 2, 1, 1, ancho);
  const fila = rango.getValues()[0];
  Object.keys(campos).forEach(k => {
    if (col[k] === undefined) return;
    let v = campos[k];
    if (FECHAS.includes(k) || FECHAS_HORA.includes(k)) v = aFecha_(v);
    fila[col[k]] = v === null || v === undefined ? "" : v;
  });
  rango.setValues([fila]);
  borrarCache_();
}
let QUIEN_ = "";
function usuario_() {
  if (QUIEN_) return QUIEN_;
  try { return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || ""; } catch (e) { return ""; }
}

/* ---------------- acceso con clave ---------------- */
function hash_(texto, sal) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + "|" + texto, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}
function entrar(clave, nombre) {
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty("CLAVE_HASH"), sal = props.getProperty("CLAVE_SAL");
  if (!guardada) throw new Error("Todavía no hay clave. En la planilla: menú Locales Black → Cambiar clave.");
  const cache = CacheService.getScriptCache();
  const fallos = +(cache.get("fallos") || 0);
  if (fallos >= 8) throw new Error("Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.");
  if (hash_(String(clave || ""), sal) !== guardada) {
    cache.put("fallos", String(fallos + 1), 900);
    throw new Error("Clave incorrecta.");
  }
  cache.remove("fallos");
  nombre = String(nombre || "").trim().slice(0, 40) || "Sin nombre";
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
  const ahora = Date.now();
  const todas = props.getProperties();
  Object.keys(todas).forEach(k => { if (k.indexOf("tok_") === 0) { try { if (JSON.parse(todas[k]).vence < ahora) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } } });
  const perfil = perfilDe_(nombre);
  if (perfil) nombre = perfil.nombre; // mismo nombre aunque lo escriban con otras mayúsculas o espacios
  props.setProperty("tok_" + token, JSON.stringify({ nombre: nombre, vence: ahora + 60 * 24 * 3600 * 1000 }));
  return JSON.stringify({ token: token, nombre: nombre, perfil: perfil || { nombre: nombre, telefono: "", email: "" } });
}
function salir(token) { if (token) PropertiesService.getScriptProperties().deleteProperty("tok_" + token); return true; }
function sesion_(token) {
  const v = token && PropertiesService.getScriptProperties().getProperty("tok_" + token);
  if (!v) throw new Error("SESION: Tu sesión venció. Entrá de nuevo con la clave.");
  const s = JSON.parse(v);
  if (s.vence < Date.now()) throw new Error("SESION: Tu sesión venció. Entrá de nuevo con la clave.");
  QUIEN_ = s.nombre;
  return s.nombre;
}
function cambiarClave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Clave de Locales Black", "Escribí la clave nueva (mínimo 6 caracteres). Al cambiarla se cierran todas las sesiones abiertas, también en los celulares.", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const clave = r.getResponseText().trim();
  if (clave.length < 6) { ui.alert("La clave tiene que tener al menos 6 caracteres. No cambié nada."); return; }
  const props = PropertiesService.getScriptProperties();
  const sal = Utilities.getUuid();
  props.setProperty("CLAVE_SAL", sal);
  props.setProperty("CLAVE_HASH", hash_(clave, sal));
  Object.keys(props.getProperties()).forEach(k => { if (k.indexOf("tok_") === 0) props.deleteProperty(k); });
  log_("Se cambió la clave de acceso");
  ui.alert("Clave guardada. Ya podés entrar a la app con esa clave.");
}
/* ---------------- datos de contacto de cada asesor ---------------- */
function clavePersona_(n) { return String(n || "").trim().toLowerCase().replace(/\s+/g, " "); }
function perfilDe_(nombre) {
  const k = clavePersona_(nombre);
  const p = leer_("Asesores").find(a => clavePersona_(a.nombre) === k);
  return p ? { nombre: String(p.nombre), telefono: String(p.telefono || ""), email: String(p.email || "") } : null;
}
function guardarPerfil(token, d) {
  const nombre = sesion_(token);
  return conLock_(() => {
    const tel = String((d && d.telefono) || "").trim().slice(0, 40);
    const mail = String((d && d.email) || "").trim().slice(0, 80);
    const h = hoja_("Asesores"), col = columnas_("Asesores", h);
    const n = h.getLastRow();
    const nombres = n > 1 ? h.getRange(2, col.nombre + 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = nombres.findIndex(x => clavePersona_(x) === clavePersona_(nombre));
    if (i < 0) agregar_("Asesores", { nombre: nombre, telefono: tel, email: mail, actualizado: new Date() });
    else {
      const r = h.getRange(i + 2, 1, 1, h.getLastColumn()), f = r.getValues()[0];
      f[col.telefono] = tel; f[col.email] = mail; f[col.actualizado] = new Date();
      r.setValues([f]); borrarCache_();
    }
    log_("Datos de contacto actualizados: " + nombre);
    return JSON.stringify({ perfil: { nombre: i < 0 ? nombre : nombres[i], telefono: tel, email: mail }, datos: JSON.parse(datos_()) });
  });
}

function log_(texto, localId) {
  agregar_("Historial", { ts: new Date(), texto: texto, localId: localId || "", por: usuario_() });
}
function conLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error("Otra persona está guardando. Probá de nuevo en unos segundos.");
  try { const r = fn(); SpreadsheetApp.flush(); return r; } finally { lock.releaseLock(); }
}
function precio_(l) { return (+l.m2 && +l.usdM2) ? (+l.m2) * (+l.usdM2) : ""; }

/* ---------------- lo que llama la página ---------------- */
function getDatos(token) {
  sesion_(token);
  const c = leerCache_();
  if (c) return c.replace('"usuario":"__QUIEN__"', '"usuario":' + JSON.stringify(QUIEN_));
  return datos_();
}
function datos_() {
  const locales = leer_("Locales").map(l => Object.assign(l, {
    nave: +l.nave || 0, m2: +l.m2 || 0, usdM2: l.usdM2 === "" ? null : +l.usdM2, orden: +l.orden || 0,
    planta: String(l.planta), estado: String(l.estado || "disponible").trim().toLowerCase().replace(" ", "_")
  }));
  const presus = leer_("Presupuestos").map(p => {
    let d = {}; try { d = JSON.parse(p.detalle || "{}"); } catch (e) {}
    return {
      id: String(p.id), numero: p.numero, fecha: p.fecha, cliente: p.cliente, contacto: p.contacto,
      vigencia: p.vigencia, estado: p.estado || "abierto", notas: p.notas, items: d.items || [],
      asesor: d.asesor || (p.asesor ? { nombre: String(p.asesor) } : null),
      cond: { anticipoPct: +p.anticipoPct || 0, cuotas: +p.cuotas || 0, honorariosPct: +p.honorariosPct || 0, certificacionArs: +p.certificacionArs || 0 }
    };
  });
  const reservas = leer_("Reservas").map(r => Object.assign(r, { id: String(r.id), precio: +r.precio || 0, sena: +r.sena || 0 }));
  const hist = leer_("Historial").reverse().slice(0, 300);
  const cond = { anticipoPct: 30, cuotas: 36, honorariosPct: 4, certificacionArs: 160000, vigenciaDias: 30 };
  leer_("Config").forEach(c => { if (c.clave in cond) cond[c.clave] = +c.valor; });
  const asesores = leer_("Asesores").map(a => ({ nombre: String(a.nombre), telefono: String(a.telefono || ""), email: String(a.email || "") }));
  const t = JSON.stringify({ locales: locales, presus: presus, reservas: reservas, hist: hist, cond: cond, asesores: asesores, usuario: "__QUIEN__" });
  guardarCache_(t);
  return t.replace('"usuario":"__QUIEN__"', '"usuario":' + JSON.stringify(QUIEN_));
}

function guardarLocal(token, id, campos) {
  sesion_(token);
  return conLock_(() => {
    const l = leer_("Locales").find(x => String(x.id) === String(id));
    if (!l) throw new Error("No existe el local " + id);
    const cambios = [];
    if (campos.estado && campos.estado !== l.estado) cambios.push("estado " + (ESTADOS[l.estado] || l.estado) + " → " + (ESTADOS[campos.estado] || campos.estado));
    if ("usdM2" in campos && String(campos.usdM2 ?? "") !== String(l.usdM2 ?? "")) cambios.push("USD/m² " + (l.usdM2 || "—") + " → " + (campos.usdM2 ?? "—"));
    if ("cliente" in campos && (campos.cliente || "") !== (l.cliente || "")) cambios.push("cliente: " + (campos.cliente || "(vacío)"));
    if ("rubro" in campos && (campos.rubro || "") !== (l.rubro || "")) cambios.push("rubro: " + (campos.rubro || "(vacío)"));
    const nuevo = Object.assign({}, campos, { actualizado: new Date() });
    nuevo.precio = precio_({ m2: campos.m2 ?? l.m2, usdM2: "usdM2" in campos ? campos.usdM2 : l.usdM2 });
    actualizar_("Locales", id, nuevo);
    if (cambios.length) log_("Local " + l.codigo + ": " + cambios.join(", "), l.codigo);
    return datos_();
  });
}

function crearPresupuesto(token, p) {
  sesion_(token);
  return conLock_(() => {
    const todos = leer_("Presupuestos");
    const n = todos.reduce((m, x) => Math.max(m, parseInt(String(x.numero).replace(/\D/g, "")) || 0), 0) + 1;
    const id = "p" + Date.now();
    const numero = "CB-" + ("000" + n).slice(-4);
    agregar_("Presupuestos", {
      id: id, numero: numero, fecha: p.fecha, cliente: p.cliente, contacto: p.contacto, vigencia: p.vigencia,
      estado: "abierto", locales: p.items.map(i => i.codigo).join(", "),
      total: p.items.reduce((s, i) => s + (+i.precio || 0), 0),
      anticipoPct: p.cond.anticipoPct, cuotas: p.cond.cuotas, honorariosPct: p.cond.honorariosPct,
      certificacionArs: p.cond.certificacionArs, notas: p.notas, asesor: QUIEN_,
      detalle: JSON.stringify({ items: p.items, asesor: perfilDe_(QUIEN_) || { nombre: QUIEN_, telefono: "", email: "" } })
    });
    log_("Presupuesto " + numero + " para " + (p.cliente || "sin cliente") + ": " + p.items.map(i => i.codigo).join(", "));
    return JSON.stringify({ id: id, numero: numero, datos: JSON.parse(datos_()) });
  });
}

function estadoPresupuesto(token, id, estado) {
  sesion_(token);
  return conLock_(() => {
    const p = leer_("Presupuestos").find(x => String(x.id) === String(id));
    if (!p) throw new Error("No existe el presupuesto");
    actualizar_("Presupuestos", id, { estado: estado });
    log_("Presupuesto " + p.numero + " (" + (p.cliente || "sin cliente") + ") marcado como " + estado);
    return datos_();
  });
}

function reservar(token, ids, d, presuId) {
  sesion_(token);
  return conLock_(() => {
    const locales = leer_("Locales");
    const presu = presuId ? leer_("Presupuestos").find(x => String(x.id) === String(presuId)) : null;
    ids.forEach(id => {
      const l = locales.find(x => String(x.id) === String(id));
      if (!l) throw new Error("No existe el local " + id);
      if (String(l.estado) !== "disponible") throw new Error("El local " + l.codigo + " ya no está disponible");
    });
    ids.forEach(id => {
      const l = locales.find(x => String(x.id) === String(id));
      agregar_("Reservas", {
        id: "r" + Date.now() + "-" + id, fecha: d.fecha, codigo: l.codigo, cliente: d.cliente, contacto: d.contacto,
        precio: precio_(l), sena: +d.sena || 0, vence: d.vence, estado: "activa",
        presupuesto: presu ? presu.numero : "", notas: d.notas, localId: id, asesor: QUIEN_
      });
      actualizar_("Locales", id, { estado: "reservado", cliente: d.cliente, actualizado: new Date() });
      log_("Reserva del local " + l.codigo + " para " + d.cliente + (presu ? " (presupuesto " + presu.numero + ")" : ""), l.codigo);
    });
    if (presu) actualizar_("Presupuestos", presuId, { estado: "aceptado" });
    return datos_();
  });
}

function cerrarReserva(token, id, tipo) {
  sesion_(token);
  return conLock_(() => {
    const r = leer_("Reservas").find(x => String(x.id) === String(id));
    if (!r) throw new Error("No existe la reserva");
    const hoy = new Date();
    if (tipo === "firmada") {
      actualizar_("Reservas", id, { estado: "firmada", cerrada: hoy });
      actualizar_("Locales", r.localId, { estado: "vendido", cliente: r.cliente, actualizado: hoy });
      log_("Local " + r.codigo + " vendido a " + r.cliente + " (boleto firmado)", r.codigo);
    } else {
      actualizar_("Reservas", id, { estado: "caida", cerrada: hoy });
      actualizar_("Locales", r.localId, { estado: "disponible", cliente: "", actualizado: hoy });
      log_("Se cayó la reserva del local " + r.codigo + " (" + r.cliente + "). Vuelve a estar disponible", r.codigo);
    }
    return datos_();
  });
}

/* Guarda el presupuesto como PDF en la carpeta "Presupuestos Coldwell Banker" de tu Drive */
function guardarPdf(token, html, nombre) {
  sesion_(token);
  const carpetas = DriveApp.getFoldersByName("Presupuestos Coldwell Banker");
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder("Presupuestos Coldwell Banker");
  const pdf = Utilities.newBlob(html, "text/html", "p.html").getAs("application/pdf").setName(nombre + ".pdf");
  const f = carpeta.createFile(pdf);
  return f.getUrl();
}

/* ---------------- menú en la planilla ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Locales Black")
    .addItem("Abrir la app", "abrirApp")
    .addItem("Cambiar clave", "cambiarClave")
    .addItem("Instalar datos iniciales (solo la primera vez)", "instalar")
    .addToUi();
}
function abrirApp() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (!url) { ui.alert("Todavía no publicaste la app web: Extensiones → Apps Script → Implementar → Nueva implementación."); return; }
  const html = HtmlService.createHtmlOutput('<p style="font:14px Arial">Abrí la app en una pestaña nueva:</p><p><a href="' + url + '" target="_blank" style="font:600 15px Arial">Abrir Locales Black</a></p><p style="font:12px Arial;color:#666">Guardá ese link en favoritos.</p>').setWidth(340).setHeight(150);
  ui.showModalDialog(html, "Locales Black");
}
function aviso_(t) {
  console.log(t);
  try { SpreadsheetApp.getUi().alert(t); } catch (e) { /* se ejecutó desde el editor: el mensaje queda en el registro */ }
}

/* ---------------- instalación (una sola vez) ---------------- */
function instalar() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  if (!libro) throw new Error("Abrí el editor desde la planilla: Extensiones → Apps Script.");
  PropertiesService.getScriptProperties().setProperty("PLANILLA_ID", libro.getId());
  const loc = libro.getSheetByName("Locales");
  if (loc && loc.getLastRow() > 1) {
    aviso_("La planilla ya tiene locales cargados. No cambié nada.");
    return;
  }
  libro.setSpreadsheetTimeZone("America/Argentina/Buenos_Aires");
  Object.keys(HOJAS).forEach(nombre => {
    let h = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
    h.clear();
    const t = HOJAS[nombre].map(c => c[1]);
    h.getRange(1, 1, 1, t.length).setValues([t]).setFontWeight("bold").setBackground("#15171a").setFontColor("#ffffff");
    h.setFrozenRows(1);
  });
  libro.getSheets().forEach(h => { if (!HOJAS[h.getName()] && h.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(h); });

  if (!SEED.locales.length) { aviso_("Esta copia del código no trae los datos iniciales de los locales. Pedí el archivo completo para instalar desde cero."); return; }
  const L = SEED.locales.map(l => filaDe_("Locales", Object.assign({}, l, { precio: precio_(l), actualizado: new Date() })));
  hoja_("Locales").getRange(2, 1, L.length, L[0].length).setValues(L);
  const P = SEED.presupuestos.map(p => filaDe_("Presupuestos", {
    id: p.id, numero: p.numero, fecha: p.fecha, cliente: p.cliente, contacto: p.contacto, vigencia: p.vigencia,
    estado: p.estado, locales: p.items.map(i => i.codigo).join(", "), total: p.items.reduce((s, i) => s + i.precio, 0),
    anticipoPct: p.cond.anticipoPct, cuotas: p.cond.cuotas, honorariosPct: p.cond.honorariosPct,
    certificacionArs: p.cond.certificacionArs, notas: p.notas, detalle: JSON.stringify({ items: p.items })
  }));
  hoja_("Presupuestos").getRange(2, 1, P.length, P[0].length).setValues(P);
  const C = [["anticipoPct", 30], ["cuotas", 36], ["honorariosPct", 4], ["certificacionArs", 160000], ["vigenciaDias", 30]];
  hoja_("Config").getRange(2, 1, C.length, 2).setValues(C);
  agregar_("Historial", { ts: new Date(), texto: "Instalación: " + L.length + " locales de la lista de precios de noviembre 2026 y " + P.length + " presupuestos anteriores", localId: "", por: usuario_() });

  // Formato de la hoja Locales: lista desplegable y colores por estado
  const hl = hoja_("Locales"), col = columnas_("Locales", hl), n = L.length;
  const rEst = hl.getRange(2, col.estado + 1, 300, 1);
  rEst.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(ESTADOS), true).build());
  const reglas = [["disponible", "#e2f3e9", "#1d7a46"], ["reservado", "#fdf0d2", "#9a6500"], ["vendido", "#f6e1e0", "#8b2f2c"], ["no_disponible", "#eceef1", "#6b7280"]]
    .map(([v, bg, fg]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(v).setBackground(bg).setFontColor(fg).setRanges([rEst]).build());
  hl.setConditionalFormatRules(reglas);
  hl.getRange(2, col.precio + 1, 300, 1).setNumberFormat("#,##0");
  hoja_("Presupuestos").getRange(2, 9, 300, 1).setNumberFormat("#,##0");
  hoja_("Reservas").getRange(2, 6, 300, 2).setNumberFormat("#,##0");
  hoja_("Historial").getRange(2, 1, 1000, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  hoja_("Presupuestos").hideColumns(15);
  Object.keys(HOJAS).forEach(nm => hoja_(nm).autoResizeColumns(1, HOJAS[nm].length - (nm === "Presupuestos" ? 1 : 0)));
  libro.setActiveSheet(hl);
  aviso_("Listo: " + n + " locales y " + P.length + " presupuestos cargados. Ahora recargá la planilla y poné la clave: menú Locales Black → Cambiar clave.");
}

/* Datos iniciales (lista de precios interna, noviembre 2026) */
// Los datos iniciales (lista de precios interna) no se publican en este repositorio.
// La planilla de Mariana ya los tiene cargados. Para instalar desde cero, pedir el archivo completo.
const SEED = { locales: [], presupuestos: [] };

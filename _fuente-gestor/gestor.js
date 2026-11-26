/* ---------- proyectos y tipos ---------- */
const TIPOS_PROY = { edificio: "Edificio de departamentos", barrio: "Barrio cerrado", condominio: "Condominio", comercial: "Centro comercial / locales", otro: "Otro" };
const NIVELES_DEF = { edificio: { grupo: "Torre", subgrupo: "Piso", unidad: "Departamento" }, barrio: { grupo: "Etapa", subgrupo: "Manzana", unidad: "Lote" },
  condominio: { grupo: "Sector", subgrupo: "Bloque", unidad: "Casa" }, comercial: { grupo: "Planta", subgrupo: "Nave", unidad: "Local" }, otro: { grupo: "Sector", subgrupo: "Grupo", unidad: "Unidad" } };
const CAMPOS_TIPO = { edificio: ["ambientes", "dormitorios", "banos", "m2Cub", "m2Semi", "orientacion", "cochera"], barrio: ["frente", "fondo", "orientacion"],
  condominio: ["m2Ter", "m2Cub", "dormitorios", "banos", "cochera"], comercial: ["rubro"], otro: ["ambientes", "m2Cub", "m2Ter", "rubro"] };
const CAMPO = { ambientes: ["Ambientes", "ambientes", "int"], dormitorios: ["Dormitorios", "dormitorios", "int"], banos: ["Baños", "banos", "int"], m2Cub: ["m² cubiertos", "m2_cubiertos", "num"],
  m2Semi: ["m² semicubiertos", "m2_semicubiertos", "num"], m2Ter: ["m² de terreno", "m2_terreno", "num"], frente: ["Frente (m)", "frente", "num"], fondo: ["Fondo (m)", "fondo", "num"],
  orientacion: ["Orientación", "orientacion", "txt"], cochera: ["Cochera", "cochera", "txt"], rubro: ["Rubro / destino", "rubro", "txt"] };
const P = () => (S.proyectos || []).find(p => p.id === S.pid) || null;
const NIV = () => ({ ...(NIVELES_DEF[(P() || {}).tipo] || NIVELES_DEF.otro), ...((P() || {}).niveles || {}) });
const unidadLbl = () => NIV().unidad || "Unidad";
const nombreGrupo = g => (NIV().nombres || {})[g] || (g === "" ? "Sin " + NIV().grupo.toLowerCase() : `${NIV().grupo} ${g}`);
const ubicTxt = l => [l.planta !== "" ? nombreGrupo(l.planta) : "", l.nave !== "" && l.nave != null ? `${NIV().subgrupo} ${l.nave}` : ""].filter(Boolean).join(" · ");
const ubicCorta = l => [l.planta, l.nave !== "" && l.nave != null ? NIV().subgrupo[0] + l.nave : ""].filter(Boolean).join(" ");
const cmpNat = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true });
let PLANTAS = [];
function calcularPlantas(){
  const ls = Object.values(S.locales).sort(ordenLoc); const vistos = [];
  ls.forEach(l => { if (!vistos.includes(l.planta)) vistos.push(l.planta); });
  PLANTAS = vistos.map(k => ({ k, n: nombreGrupo(k) }));
  if (S.fPlanta !== "todas" && !vistos.includes(S.fPlanta)) S.fPlanta = "todas";
}

/* ---------- vistas ---------- */
const VISTAS = ["proyectos", "locales", "presupuestos", "reservas", "clientes", "cobranzas", "historial", "proyecto"];
function ir(v, pid){
  if (pid !== undefined && pid !== S.pid) { S.pid = pid; S.fPlanta = "todas"; S.fEstado = "todos"; filtrarProyecto(); renderTodo(); }
  if (v !== "proyectos" && !S.pid) v = "proyectos";
  S.vista = v;
  VISTAS.forEach(x => { $("#v-" + x).hidden = x !== v; const b = document.querySelector(`nav.tabs button[data-v="${x}"]`); if (b) { if (x === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); } });
  const enProy = v !== "proyectos";
  $("nav.tabs").hidden = !enProy; $("#volver").hidden = !enProy; $("#resumen").hidden = !enProy || !["locales", "presupuestos", "reservas"].includes(v);
  const p = P();
  $("#tit").textContent = enProy && p ? p.nombre : "Gestor de desarrollos";
  $("#sub").textContent = enProy && p ? [TIPOS_PROY[p.tipo], p.localidad].filter(Boolean).join(" · ") : "Coldwell Banker";
  document.querySelector('nav.tabs button[data-v="locales"]').textContent = (NIV().unidad || "Unidad") + "es".replace(/^es$/, "") && plural(unidadLbl());
  try { history.replaceState(null, "", enProy ? `#${S.pid}/${v}` : "#"); } catch (e) {}
  window.scrollTo(0, 0);
}
const plural = w => /[aeiouáéó]$/i.test(w) ? w + "s" : w + "es";
function irDesdeHash(){ const m = location.hash.match(/^#([0-9a-f-]{36})\/(\w+)$/); if (m && (S.proyectos || []).some(p => p.id === m[1])) ir(m[2], m[1]); else ir(S.pid ? S.vista || "locales" : "proyectos"); }
document.querySelector("nav.tabs").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) ir(b.dataset.v); });
$("#volver").onclick = () => { S.pid = null; filtrarProyecto(); ir("proyectos"); renderProyectos(); };

/* ---------- pantalla de proyectos ---------- */
function statsProyecto(pid){
  const d = S.todo || { unidades: [], reservas: [], cuotas: [] };
  const us = d.unidades.filter(u => u.pid === pid); const g = { disponible: [], reservado: [], vendido: [], no_disponible: [] };
  us.forEach(u => (g[u.estado] || g.no_disponible).push(u));
  const tot = a => a.reduce((s, u) => s + (u.precio || 0), 0);
  const hoy = hoyISO(); const venc = (d.cuotas || []).filter(c => c.proyecto_id === pid && c.vencimiento < hoy && c.pagado < c.monto);
  const cli = (d.clientes || []).filter(c => c.proyecto_id === pid && !["compro", "perdido"].includes(c.estado)).length;
  return { n: us.length, g, tot, venc, cli, resAct: d.reservas.filter(r => r.pid === pid && r.estado === "activa").length };
}
function renderProyectos(){
  const caja = $("#proy-lista"); if (!caja) return;
  if (!S.uid || !(S.perfil && S.perfil.activo)) return;
  $("#btn-nuevo-proy").hidden = !esAdmin();
  const lista = (S.proyectos || []).filter(p => S.verArchivados || p.estado !== "archivado");
  if (!S.cargado) { caja.innerHTML = `<div class="vacio">Cargando proyectos…</div>`; return; }
  if (!lista.length) { caja.innerHTML = `<div class="vacio">Todavía no hay proyectos.${esAdmin() ? " Tocá “Nuevo proyecto” para cargar el primero." : ""}</div>`; return; }
  caja.innerHTML = lista.map(p => { const s = statsProyecto(p.id); const pct = s.n ? Math.round((s.g.vendido.length + s.g.reservado.length) / s.n * 100) : 0;
    return `<button class="pcard" data-pid="${esc(p.id)}">
      <div class="pcard-cab"><span class="pill p-no_disponible">${esc(TIPOS_PROY[p.tipo] || p.tipo)}</span>${p.estado === "archivado" ? `<span class="pill p-vencido">Archivado</span>` : ""}</div>
      <h3>${esc(p.nombre)}</h3><div class="muted">${esc([p.localidad, p.desarrolladora].filter(Boolean).join(" · ") || "—")}</div>
      <div class="pbar" title="${pct}% vendido o reservado"><i class="v" style="width:${s.n ? s.g.vendido.length / s.n * 100 : 0}%"></i><i class="r" style="width:${s.n ? s.g.reservado.length / s.n * 100 : 0}%"></i></div>
      <div class="pnums"><div><b class="c-disp">${s.g.disponible.length}</b><span>disponibles</span></div><div><b class="c-res">${s.g.reservado.length}</b><span>reservadas</span></div><div><b class="c-ven">${s.g.vendido.length}</b><span>vendidas</span></div><div><b>${s.n}</b><span>${esc(plural((p.niveles && p.niveles.unidad) || (NIVELES_DEF[p.tipo] || NIVELES_DEF.otro).unidad).toLowerCase())}</span></div></div>
      <div class="muted pfoot">${usd(s.tot(s.g.disponible))} disponible${s.cli ? ` · ${s.cli} clientes en curso` : ""}${s.venc.length ? ` · <span class="aviso">${s.venc.length} cuotas vencidas</span>` : ""}</div>
    </button>`; }).join("");
}
$("#proy-lista").addEventListener("click", e => { const b = e.target.closest(".pcard"); if (b) ir("locales", b.dataset.pid); });
$("#btn-nuevo-proy").onclick = () => editorProyecto(null);
$("#ver-archivados").onchange = e => { S.verArchivados = e.target.checked; renderProyectos(); };

/* ---------- resumen del proyecto ---------- */
function renderResumen(){
  const ls = Object.values(S.locales); const g = { disponible: [], reservado: [], vendido: [], no_disponible: [] };
  ls.forEach(l => (g[l.estado] || g.no_disponible).push(l));
  const tot = a => a.reduce((s, l) => s + (precioDe(l) || 0), 0), m2 = a => a.reduce((s, l) => s + (l.m2 || 0), 0);
  const presVig = S.presus.filter(p => estadoPresu(p) === "abierto").length; const U = plural(unidadLbl());
  $("#resumen").innerHTML = ls.length ? `
   <div class="kpi disp"><div class="l">Disponibles</div><div class="n">${g.disponible.length}</div><div class="s">${usd(tot(g.disponible))} · ${num(m2(g.disponible))} m²</div></div>
   <div class="kpi res"><div class="l">Reservad${/a$/i.test(unidadLbl()) ? "a" : "o"}s</div><div class="n">${g.reservado.length}</div><div class="s">${usd(tot(g.reservado))}</div></div>
   <div class="kpi ven"><div class="l">Vendid${/a$/i.test(unidadLbl()) ? "a" : "o"}s</div><div class="n">${g.vendido.length}</div><div class="s">${usd(tot(g.vendido))} · ${ls.length ? Math.round(g.vendido.length / ls.length * 100) : 0}% de ${esc(U.toLowerCase())}</div></div>
   <div class="kpi"><div class="l">Presupuestos vigentes</div><div class="n">${presVig}</div><div class="s">${S.reservas.filter(r => r.estado === "activa").length} reservas activas</div></div>` : "";
}

/* ---------- tablero ---------- */
function renderFiltros(){
  $("#f-planta").innerHTML = PLANTAS.length > 1 ? [["todas", "Todas"], ...PLANTAS.map(p => [p.k, p.n])].map(([k, n]) => `<button data-k="${esc(k)}" aria-pressed="${S.fPlanta === k}">${esc(n)}</button>`).join("") : "";
  $("#f-estado").innerHTML = [["todos", "Todos"], ["disponible", "Disponibles"], ["reservado", "Reservados"], ["vendido", "Vendidos"]].map(([k, n]) => `<button data-k="${k}" aria-pressed="${S.fEstado === k}">${n}</button>`).join("");
  $("#btn-nueva-unidad").hidden = !esAdmin(); $("#btn-nueva-unidad").textContent = "Nuevo " + unidadLbl().toLowerCase();
  $("#t-unidades").textContent = "Disponibilidad";
}
$("#f-planta").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.fPlanta = b.dataset.k; renderFiltros(); renderTablero(); });
$("#f-estado").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.fEstado = b.dataset.k; renderFiltros(); renderTablero(); });
function datoTile(l){
  const t = (P() || {}).tipo;
  if (t === "edificio") return [l.ambientes ? l.ambientes + " amb" : "", num(l.m2) + " m²"].filter(Boolean).join(" · ");
  if (t === "barrio") return num(l.m2Ter || l.m2) + " m²";
  if (t === "condominio") return [l.dormitorios ? l.dormitorios + " dorm" : "", num(l.m2Cub || l.m2) + " m²"].filter(Boolean).join(" · ");
  return num(l.m2) + " m²";
}
function renderTablero(){
  renderFiltros();
  const ls = Object.values(S.locales);
  if (!ls.length) { $("#tablero").innerHTML = `<div class="vacio">${S.cargado ? `Este proyecto todavía no tiene ${esc(plural(unidadLbl()).toLowerCase())}.${esAdmin() ? ` Cargalas una por una con “Nuevo ${esc(unidadLbl().toLowerCase())}” o importalas desde un Excel en la pestaña <b>Proyecto</b>.` : ""}` : "Cargando…"}</div>`; return; }
  let h = "";
  for (const p of PLANTAS) {
    if (S.fPlanta !== "todas" && S.fPlanta !== p.k) continue;
    const dePlanta = ls.filter(l => l.planta === p.k).sort(ordenLoc); if (!dePlanta.length) continue;
    const naves = [...new Set(dePlanta.map(l => l.nave))].sort(cmpNat);
    h += `<div class="planta">${PLANTAS.length > 1 || p.k !== "" ? `<h3>${esc(p.n)}</h3>` : ""}<div class="naves">`;
    for (const n of naves) {
      const enNave = dePlanta.filter(l => l.nave === n); const vis = enNave.filter(l => S.fEstado === "todos" || l.estado === S.fEstado);
      if (!vis.length) continue;
      const disp = enNave.filter(l => l.estado === "disponible").length;
      h += `<div class="nave"><div class="t"><span>${n !== "" && n != null ? esc(NIV().subgrupo + " " + n) : "&nbsp;"}</span><span>${disp}/${enNave.length} libres</span></div><div class="locs">` +
        vis.map(l => `<button class="loc ${esc(l.estado)}" data-id="${esc(l.id)}" title="${esc(l.codigo + " · " + (ESTADOS[l.estado] || l.estado) + (l.cliente ? " · " + l.cliente : ""))}"><b>${esc(l.codigo)}</b><span>${esc(datoTile(l))}</span><span>${precioDe(l) ? "$" + Math.round(precioDe(l) / 1000) + "k" : "s/precio"}</span></button>`).join("") + `</div></div>`;
    }
    h += `</div></div>`;
  }
  $("#tablero").innerHTML = h || `<div class="vacio">No hay ${esc(plural(unidadLbl()).toLowerCase())} con ese filtro.</div>`;
}
$("#tablero").addEventListener("click", e => { const b = e.target.closest(".loc"); if (b) abrirLocal(b.dataset.id); });
$("#btn-nueva-unidad").onclick = () => abrirLocal(null);

/* ---------- ficha de la unidad ---------- */
function abrirDrawer(html, ancho){ const d = $("#drawer"); d.style.width = ancho || ""; d.innerHTML = html; d.hidden = false; $("#velo").hidden = false; }
function cerrarDrawer(){ $("#drawer").hidden = true; $("#velo").hidden = true; S.fichaAbierta = null; S.clienteAbierto = null; }
$("#velo").addEventListener("click", cerrarDrawer);
addEventListener("keydown", e => { if (e.key === "Escape") cerrarDrawer(); });
function abrirLocal(id){
  const nueva = !id; const l = nueva ? { codigo: "", planta: PLANTAS[0] ? PLANTAS[0].k : "", nave: "", m2: "", usdM2: null, precioLista: null, estado: "disponible", cliente: "", rubro: "", notas: "" } : S.locales[id];
  if (!l) return;
  const tipo = (P() || {}).tipo || "otro"; const N = NIV(); const U = unidadLbl();
  const presus = nueva ? [] : S.presus.filter(p => (p.items || []).some(i => i.id === id));
  const res = nueva ? [] : S.reservas.filter(r => String(r.localId) === String(id));
  const hist = nueva ? [] : S.hist.filter(h => h.localId === l.id).slice(0, 8);
  const campo = k => { const [lab, , t] = CAMPO[k]; const v = l[k] ?? ""; return `<div><label for="d-${k}">${lab}</label><input id="d-${k}" ${t === "txt" ? "" : `type="number" step="${t === "int" ? 1 : 0.01}"`} value="${esc(v)}"></div>`; };
  abrirDrawer(`<div class="cab"><div><h3>${nueva ? "Nuevo " + esc(U.toLowerCase()) : esc(U) + " " + esc(l.codigo)}</h3><div class="muted">${nueva ? esc(P().nombre) : esc(ubicTxt(l))}</div></div><button id="d-x">Cerrar</button></div>
   <div class="tres"><div><label for="d-codigo">Código</label><input id="d-codigo" value="${esc(l.codigo)}"></div><div><label for="d-grupo">${esc(N.grupo)}</label><input id="d-grupo" value="${esc(l.planta)}" list="d-grupos"><datalist id="d-grupos">${PLANTAS.map(p => `<option value="${esc(p.k)}">`).join("")}</datalist></div><div><label for="d-sub">${esc(N.subgrupo)}</label><input id="d-sub" value="${esc(l.nave ?? "")}"></div></div>
   <div class="tres"><div><label for="d-m2">${tipo === "barrio" ? "Superficie m²" : "Sup. total m²"}</label><input id="d-m2" type="number" step="0.01" value="${esc(l.m2)}"></div><div><label for="d-usd">USD por m²</label><input id="d-usd" type="number" step="50" value="${esc(l.usdM2 ?? "")}"></div><div><label for="d-pl">Precio fijo USD</label><input id="d-pl" type="number" step="1000" value="${esc(l.precioLista ?? "")}" placeholder="opcional"></div></div>
   <div class="muted" style="font-size:12px;margin-top:4px">Precio: <b id="d-precio">${usd(precioDe(l))}</b> · si cargás precio fijo, se usa ese en lugar de m² × USD/m².</div>
   <div class="tres">${(CAMPOS_TIPO[tipo] || []).map(campo).join("")}</div>
   <div class="dos"><div><label for="d-estado">Estado</label><select id="d-estado">${Object.entries(ESTADOS).map(([k, n]) => `<option value="${k}" ${l.estado === k ? "selected" : ""}>${n}</option>`).join("")}</select></div><div><label for="d-cliente">Cliente</label><input id="d-cliente" value="${esc(l.cliente)}"></div></div>
   <label for="d-notas">Notas</label><textarea id="d-notas" rows="2">${esc(l.notas)}</textarea>
   <div class="pie"><button class="prim" id="d-guardar">${nueva ? "Crear " + esc(U.toLowerCase()) : "Guardar cambios"}</button>${!nueva && l.estado === "disponible" ? `<button id="d-reservar">Reservar</button>` : ""}${!nueva && esAdmin() ? `<button class="peligro" id="d-borrar">Borrar</button>` : ""}</div>
   ${nueva ? "" : `<h4 style="margin:22px 0 6px">Presupuestos donde aparece</h4>${presus.length ? presus.map(p => `<div>${esc(p.numero)} · ${esc(p.cliente || "sin cliente")} <span class="pill p-${estadoPresu(p)}">${EST_PRESU[estadoPresu(p)]}</span></div>`).join("") : `<div class="muted">Ninguno</div>`}
   <h4 style="margin:16px 0 6px">Reservas</h4>${res.length ? res.map(r => `<div>${fmtF(r.fecha)} · ${esc(r.cliente)}${r.asesor ? ` · <span class="muted">${esc(r.asesor)}</span>` : ""} <span class="pill p-${esc(r.estado)}">${EST_RES[r.estado] || esc(r.estado)}</span></div>`).join("") : `<div class="muted">Ninguna</div>`}
   <div id="d-extras"><div class="muted" style="margin-top:18px">Cargando planos, fotos y comentarios…</div></div>
   <h4 style="margin:22px 0 6px">Movimientos</h4>${hist.length ? hist.map(h => `<div class="muted">${fmtF((h.ts || "").slice(0, 10))} · ${esc(h.texto)}${h.por ? ` · ${esc(h.por)}` : ""}</div>`).join("") : `<div class="muted">Sin movimientos</div>`}`}`);
  if (!nueva) { S.fichaAbierta = l.id; cargarExtrasLocal(l.id); }
  const upd = () => { const pl = +$("#d-pl").value; const v = pl || (+$("#d-m2").value) * (+$("#d-usd").value); $("#d-precio").textContent = v ? usd(v) : "—"; };
  ["#d-m2", "#d-usd", "#d-pl"].forEach(s => $(s).oninput = upd);
  $("#d-x").onclick = cerrarDrawer;
  $("#d-guardar").onclick = async e => {
    const val = s => $(s).value.trim();
    const c = { codigo: val("#d-codigo"), grupo: val("#d-grupo"), subgrupo: val("#d-sub"), m2: val("#d-m2"), usd_m2: val("#d-usd"), precio_lista: val("#d-pl"), estado: $("#d-estado").value, cliente: val("#d-cliente"), notas: val("#d-notas") };
    (CAMPOS_TIPO[tipo] || []).forEach(k => c[CAMPO[k][1]] = val("#d-" + k));
    if (!c.codigo) { toast("Poné el código"); return; }
    if (nueva) {
      const fila = { codigo: c.codigo, grupo: c.grupo, subgrupo: c.subgrupo, m2: +c.m2 || 0, usd_m2: c.usd_m2 === "" ? null : +c.usd_m2, precio_lista: c.precio_lista === "" ? null : +c.precio_lista, estado: c.estado, cliente: c.cliente, notas: c.notas, rubro: c.rubro || "", orden: Object.keys(S.locales).length + 1 };
      (CAMPOS_TIPO[tipo] || []).forEach(k => { const [, col, t] = CAMPO[k]; const v = c[col]; fila[col] = t === "txt" ? (v || "") : (v === "" ? null : +v); });
      if (await guardar("nuevaUnidad", [fila], U + " creado", e.target)) cerrarDrawer();
    } else if (await guardar("guardarLocal", [l.id, c], U + " actualizado", e.target)) cerrarDrawer();
  };
  const r = $("#d-reservar"); if (r) r.onclick = () => { cerrarDrawer(); generadorReserva({ ids: [l.id] }); };
  const b = $("#d-borrar"); if (b) b.onclick = async () => { if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Borrar? Tocá de nuevo"; return; } if (await guardar("borrarUnidad", [l.id], U + " borrado", b)) cerrarDrawer(); };
}

/* ---------- pestaña Proyecto: datos, condiciones, datos legales, archivos e importación ---------- */
function editorProyecto(id){
  const p = id ? S.proyectos.find(x => x.id === id) : { nombre: "", tipo: "edificio", direccion: "", localidad: "", desarrolladora: "", descripcion: "", niveles: {}, cond: { anticipoPct: 30, cuotas: 36, honorariosPct: 4, certificacionArs: 0, vigenciaDias: 30 }, doc: {}, estado: "activo" };
  const nv = { ...(NIVELES_DEF[p.tipo] || NIVELES_DEF.otro), ...(p.niveles || {}) }; const c = { anticipoPct: 30, cuotas: 36, honorariosPct: 4, certificacionArs: 0, vigenciaDias: 30, ...(p.cond || {}) }; const d = p.doc || {};
  const cont = id ? $("#proy-form") : null;
  const html = `<div class="form proy-form">
    <h3>${id ? "Datos del proyecto" : "Nuevo proyecto"}</h3>
    <div class="dos"><div><label for="pf-nom">Nombre</label><input id="pf-nom" value="${esc(p.nombre)}" placeholder="Ej: Torres del Lago"></div><div><label for="pf-tipo">Tipo</label><select id="pf-tipo">${Object.entries(TIPOS_PROY).map(([k, n]) => `<option value="${k}" ${p.tipo === k ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>
    <div class="dos"><div><label for="pf-dir">Dirección</label><input id="pf-dir" value="${esc(p.direccion)}"></div><div><label for="pf-loc">Localidad / zona</label><input id="pf-loc" value="${esc(p.localidad)}"></div></div>
    <div class="dos"><div><label for="pf-des">Desarrolladora</label><input id="pf-des" value="${esc(p.desarrolladora)}"></div><div><label for="pf-est">Estado</label><select id="pf-est"><option value="activo">Activo</option><option value="archivado" ${p.estado === "archivado" ? "selected" : ""}>Archivado</option></select></div></div>
    <label for="pf-desc">Descripción</label><textarea id="pf-desc" rows="2">${esc(p.descripcion)}</textarea>
    <h4>Cómo se organizan las unidades</h4>
    <div class="tres"><div><label for="pf-g">Agrupación mayor</label><input id="pf-g" value="${esc(nv.grupo)}"></div><div><label for="pf-s">Agrupación menor</label><input id="pf-s" value="${esc(nv.subgrupo)}"></div><div><label for="pf-u">Cada unidad es un</label><input id="pf-u" value="${esc(nv.unidad)}"></div></div>
    <div class="muted" style="font-size:12px;margin-top:4px">Ej.: Torre / Piso / Departamento · Etapa / Manzana / Lote · Planta / Nave / Local.</div>
    <h4>Condiciones de pago por defecto</h4>
    <div class="tres"><div><label for="pf-ant">Anticipo %</label><input id="pf-ant" type="number" value="${esc(c.anticipoPct)}"></div><div><label for="pf-cuo">Cuotas</label><input id="pf-cuo" type="number" value="${esc(c.cuotas)}"></div><div><label for="pf-hon">Honorarios % (presupuesto)</label><input id="pf-hon" type="number" step="0.5" value="${esc(c.honorariosPct)}"></div></div>
    <div class="dos"><div><label for="pf-cert">Certificación $ por unidad</label><input id="pf-cert" type="number" step="1000" value="${esc(c.certificacionArs)}"></div><div><label for="pf-vig">Vigencia del presupuesto (días)</label><input id="pf-vig" type="number" value="${esc(c.vigenciaDias)}"></div></div>
    <details class="fijos" ${id ? "" : "open"}><summary>Datos legales para el documento de reserva</summary>
      <div class="dos"><div><label for="pf-fid">Fideicomiso / vendedora</label><input id="pf-fid" value="${esc(d.fideicomiso || "")}" placeholder="FIDEICOMISO INMOBILIARIO …"></div><div><label for="pf-cuit">CUIT</label><input id="pf-cuit" value="${esc(d.cuit || "")}"></div></div>
      <div class="dos"><div><label for="pf-const">Constituido el</label><input id="pf-const" value="${esc(d.constituido || "")}" placeholder="5 de marzo de 2024"></div><div><label for="pf-emp">Nombre del emprendimiento</label><input id="pf-emp" value="${esc(d.emprendimiento || "")}"></div></div>
      <label for="pf-ubi">Ubicación y datos catastrales</label><textarea id="pf-ubi" rows="3" placeholder="ubicado en la calle … designado según su título como Lote … Nomenclatura catastral: …">${esc(d.ubicacion || "")}</textarea>
      <label for="pf-esc">Escribano (nombre, registro, domicilio, contacto)</label><textarea id="pf-esc" rows="2" placeholder="el escribano …">${esc(d.escribano || "")}</textarea>
      <label for="pf-ban">Lugar de firma del boleto</label><input id="pf-ban" value="${esc(d.banco || "")}" placeholder="la Sucursal del Banco …">
      <label for="pf-domv">Domicilio de la vendedora</label><input id="pf-domv" value="${esc(d.domicilioVendedora || "")}" placeholder="la calle …">
      <div class="tres"><div><label for="pf-mres">Reserva USD</label><input id="pf-mres" type="number" value="${esc(d.montoReserva ?? 10000)}"></div><div><label for="pf-dias">Días para el boleto</label><input id="pf-dias" type="number" value="${esc(d.diasBoleto ?? 10)}"></div><div><label for="pf-hres">Honorarios % reserva</label><input id="pf-hres" type="number" step="0.5" value="${esc(d.honorarios ?? 3)}"></div></div>
    </details>
    <div class="pie"><button class="prim" id="pf-ok">${id ? "Guardar proyecto" : "Crear proyecto"}</button>${id ? "" : `<button id="pf-x">Cancelar</button>`}</div></div>`;
  if (cont) cont.innerHTML = html; else abrirDrawer(html, "min(720px,100%)");
  const sel = $("#pf-tipo"); sel.onchange = () => { const n = NIVELES_DEF[sel.value]; $("#pf-g").value = n.grupo; $("#pf-s").value = n.subgrupo; $("#pf-u").value = n.unidad; };
  const x = $("#pf-x"); if (x) x.onclick = cerrarDrawer;
  $("#pf-ok").onclick = async e => {
    const v = s => $(s).value.trim(); if (!v("#pf-nom")) { toast("Poné el nombre del proyecto"); return; }
    const campos = { nombre: v("#pf-nom"), tipo: v("#pf-tipo"), direccion: v("#pf-dir"), localidad: v("#pf-loc"), desarrolladora: v("#pf-des"), descripcion: v("#pf-desc"), estado: v("#pf-est"),
      niveles: { ...(p.niveles || {}), grupo: v("#pf-g") || "Sector", subgrupo: v("#pf-s") || "Grupo", unidad: v("#pf-u") || "Unidad" },
      cond: { anticipoPct: +v("#pf-ant") || 0, cuotas: +v("#pf-cuo") || 0, honorariosPct: +v("#pf-hon") || 0, certificacionArs: +v("#pf-cert") || 0, vigenciaDias: +v("#pf-vig") || 30 },
      doc: { ...(p.doc || {}), fideicomiso: v("#pf-fid"), cuit: v("#pf-cuit"), constituido: v("#pf-const"), emprendimiento: v("#pf-emp"), emprendimientoCorto: (p.doc || {}).emprendimientoCorto && v("#pf-emp") === (p.doc || {}).emprendimiento ? p.doc.emprendimientoCorto : v("#pf-emp"),
        ubicacion: v("#pf-ubi"), escribano: v("#pf-esc"), banco: v("#pf-ban"), domicilioVendedora: v("#pf-domv"), montoReserva: +v("#pf-mres") || 0, diasBoleto: +v("#pf-dias") || 10, honorarios: +v("#pf-hres") || 0 } };
    const r = await guardar("guardarProyecto", [id, campos], id ? "Proyecto guardado" : "Proyecto creado", e.target);
    if (r && !id) { cerrarDrawer(); ir("proyecto", r.id); }
  };
}
function renderProyectoTab(){
  if (!P()) return;
  if (esAdmin()) editorProyecto(P().id);
  else $("#proy-form").innerHTML = `<div class="form"><h3>${esc(P().nombre)}</h3><p>${esc(TIPOS_PROY[P().tipo] || "")} · ${esc([P().direccion, P().localidad].filter(Boolean).join(", "))}</p><p class="muted">${esc(P().descripcion || "")}</p><p class="muted">Solo un administrador puede cambiar los datos del proyecto.</p></div>`;
  $("#imp-caja").hidden = !esAdmin();
  cargarArchivosProyecto();
}
async function cargarArchivosProyecto(){
  const caja = $("#proy-arch"); if (!caja || !S.pid) return; const pid = S.pid;
  const { data, error } = await sb.from("archivos").select("*").eq("proyecto_id", pid).is("unidad_id", null).order("creado", { ascending: false });
  if (S.pid !== pid) return;
  if (error) { caja.innerHTML = `<p class="aviso">${esc(errTxt(error))}</p>`; return; }
  let urls = {}; if (data.length) { const r = await sb.storage.from("archivos").createSignedUrls(data.map(a => a.ruta), 3600); (r.data || []).forEach(u => { if (u.signedUrl) urls[u.path] = u.signedUrl; }); }
  caja.innerHTML = `<div class="arch-subir"><select id="pa-tipo">${Object.entries(TIPOS_ARCH).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select><label class="btn" for="pa-file">Subir planos, brochure o fotos</label><input id="pa-file" type="file" multiple accept="image/*,application/pdf" hidden><span class="muted" id="pa-prog"></span></div>
    ${data.length ? `<div class="arch-grid">${data.map(a => { const u = urls[a.ruta]; const img = /\.(jpe?g|png|webp)$/i.test(a.ruta);
      return `<figure class="arch"><a href="${u ? esc(u) : "#"}" target="_blank" rel="noopener">${img && u ? `<img src="${esc(u)}" alt="${esc(a.nombre)}" loading="lazy">` : `<div class="arch-doc">PDF</div>`}</a><figcaption><span class="arch-nom">${esc(a.nombre)}</span><span class="muted">${esc(TIPOS_ARCH[a.tipo] || "")} · ${pesoTxt(a.bytes)}</span>${esAdmin() || a.subido_por === S.uid ? `<button class="pa-borrar" data-id="${esc(a.id)}" data-ruta="${esc(a.ruta)}">Borrar</button>` : ""}</figcaption></figure>`; }).join("")}</div>` : `<div class="muted">Todavía no hay archivos generales del proyecto.</div>`}`;
  $("#pa-file").onchange = async e => { const files = [...e.target.files]; e.target.value = ""; let ok = 0;
    for (const f of files) { $("#pa-prog").textContent = `Subiendo ${ok + 1} de ${files.length}…`;
      try { const { blob, ext, mime } = await prepararArchivo(f); const ruta = `proyectos/${pid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const up = await sb.storage.from("archivos").upload(ruta, blob, { contentType: mime }); if (up.error) throw up.error;
        const ins = await sb.from("archivos").insert({ proyecto_id: pid, unidad_id: null, tipo: $("#pa-tipo").value, nombre: f.name, ruta, bytes: blob.size }); if (ins.error) { await sb.storage.from("archivos").remove([ruta]); throw ins.error; } ok++;
      } catch (err) { toast(`No se pudo subir ${f.name}: ${errTxt(err)}`); } }
    $("#pa-prog").textContent = ""; if (ok) { toast("Archivos subidos"); cargarArchivosProyecto(); } };
  caja.querySelectorAll(".pa-borrar").forEach(b => b.onclick = async () => { if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Borrar?"; return; }
    await sb.storage.from("archivos").remove([b.dataset.ruta]); const { error } = await sb.from("archivos").delete().eq("id", b.dataset.id); if (error) toast(errTxt(error)); else cargarArchivosProyecto(); });
}

/* Importar unidades desde Excel o CSV */
const IMP_CAMPOS = [["codigo", "Código", /c[oó]d|unidad|local|lote|depto|dpto|^uf$|n[uú]mero/i], ["grupo", NIV_LBL("grupo"), /torre|planta|etapa|sector|edificio|nivel/i], ["subgrupo", NIV_LBL("subgrupo"), /piso|nave|manzana|bloque|mza/i],
  ["m2", "m² (superficie)", /m2|m²|sup|superficie|metros/i], ["usd_m2", "USD por m²", /x\s*m2|por\s*m|usd\s*\/?\s*m|valor\s*m/i], ["precio_lista", "Precio USD", /precio|valor|costo|total|usd/i],
  ["estado", "Estado", /estado|disponib/i], ["ambientes", "Ambientes", /amb/i], ["dormitorios", "Dormitorios", /dorm/i], ["banos", "Baños", /ba[ñn]o/i], ["m2_cubiertos", "m² cubiertos", /cub/i],
  ["m2_semicubiertos", "m² semicubiertos", /semi/i], ["m2_terreno", "m² terreno", /terreno|lote\s*m/i], ["frente", "Frente", /frente/i], ["fondo", "Fondo", /fondo/i], ["orientacion", "Orientación", /orient/i], ["cochera", "Cochera", /coch/i], ["rubro", "Rubro / destino", /rubro|destino|uso/i], ["notas", "Notas", /nota|obs/i]];
function NIV_LBL(k){ return k === "grupo" ? "Agrupación mayor (torre, planta…)" : "Agrupación menor (piso, nave…)"; }
const numAR = v => { if (v == null || v === "") return null; if (typeof v === "number") return v; let s = String(v).replace(/[^\d.,-]/g, ""); if (!s) return null; if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); else s = s.replace(/[.,](?=\d{3}(\D|$))/g, ""); const n = parseFloat(s); return isNaN(n) ? null : n; };
const estadoDe = v => { const s = String(v || "").toLowerCase(); return /vend/.test(s) ? "vendido" : /reserv/.test(s) ? "reservado" : /no\s*disp|bloq/.test(s) ? "no_disponible" : "disponible"; };
async function cargarXLSX(){ if (window.XLSX) return; await new Promise((ok, mal) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar el lector de Excel")); document.head.appendChild(s); }); }
$("#imp-file").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    await cargarXLSX(); const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    S.imp = { wb, hoja: wb.SheetNames[0], nombre: f.name }; pintarImport();
  } catch (err) { toast(errTxt(err)); }
};
function pintarImport(){
  const { wb } = S.imp; const filas = XLSX.utils.sheet_to_json(wb.Sheets[S.imp.hoja], { header: 1, defval: "", raw: true }).filter(r => r.some(c => String(c).trim() !== ""));
  let hi = filas.findIndex(r => r.some(c => IMP_CAMPOS[0][2].test(String(c)))); if (hi < 0) hi = 0; if (S.imp.hi != null) hi = S.imp.hi;
  const cab = (filas[hi] || []).map((c, i) => String(c).trim() || `Columna ${i + 1}`);
  const mapa = S.imp.mapa || {}; if (!S.imp.mapa) { const usadas = new Set(); IMP_CAMPOS.forEach(([k, , re]) => { const i = cab.findIndex((c, j) => !usadas.has(j) && re.test(c)); if (i >= 0) { mapa[k] = i; usadas.add(i); } }); S.imp.mapa = mapa; }
  const datos = filas.slice(hi + 1); S.imp.filas = datos; S.imp.hi = hi;
  const conv = r => { const o = { orden: 0 }; IMP_CAMPOS.forEach(([k]) => { if (mapa[k] == null) return; const v = r[mapa[k]];
    if (k === "estado") o.estado = estadoDe(v); else if (["codigo", "grupo", "subgrupo", "orientacion", "cochera", "rubro", "notas"].includes(k)) o[k] = String(v ?? "").trim(); else { const n = numAR(v); o[k] = ["ambientes", "dormitorios", "banos"].includes(k) ? (n == null ? null : Math.round(n)) : n; } });
    if (o.m2 == null) o.m2 = 0; return o; };
  const validas = datos.map(conv).filter(o => o.codigo); validas.forEach((o, i) => o.orden = i + 1); S.imp.validas = validas;
  const existen = validas.filter(o => Object.values(S.locales).some(l => l.codigo === o.codigo)).length;
  $("#imp-mapa").innerHTML = `<div class="dos"><div><label for="imp-hoja">Hoja</label><select id="imp-hoja">${wb.SheetNames.map(n => `<option ${n === S.imp.hoja ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div><div><label for="imp-hi">Fila de títulos</label><input id="imp-hi" type="number" min="1" value="${hi + 1}"></div></div>
    <p class="muted" style="font-size:12px">Indicá qué columna del archivo corresponde a cada dato. Solo el código es obligatorio.</p>
    <div class="imp-grid">${IMP_CAMPOS.map(([k, lab]) => `<label>${esc(k === "grupo" ? NIV().grupo : k === "subgrupo" ? NIV().subgrupo : lab)}<select data-k="${k}"><option value="">—</option>${cab.map((c, i) => `<option value="${i}" ${mapa[k] === i ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>`).join("")}</div>
    <div class="tabla" style="margin-top:12px"><table><thead><tr><th>Código</th><th>${esc(NIV().grupo)}</th><th>${esc(NIV().subgrupo)}</th><th class="num">m²</th><th class="num">USD/m²</th><th class="num">Precio</th><th>Estado</th></tr></thead><tbody>${validas.slice(0, 8).map(o => `<tr><td>${esc(o.codigo)}</td><td>${esc(o.grupo || "")}</td><td>${esc(o.subgrupo || "")}</td><td class="num">${num(o.m2, 2)}</td><td class="num">${o.usd_m2 ?? "—"}</td><td class="num">${usd(o.precio_lista ?? (o.usd_m2 ? o.m2 * o.usd_m2 : null))}</td><td>${ESTADOS[o.estado || "disponible"]}</td></tr>`).join("")}</tbody></table></div>
    <div class="pie"><button class="prim" id="imp-ok" ${validas.length ? "" : "disabled"}>Importar ${validas.length} unidades</button><span class="muted">${existen ? `${existen} ya existen con ese código y se van a actualizar.` : ""}</span></div>`;
  $("#imp-hoja").onchange = e => { S.imp.hoja = e.target.value; S.imp.hi = null; S.imp.mapa = null; pintarImport(); };
  $("#imp-hi").onchange = e => { S.imp.hi = Math.max(0, (+e.target.value || 1) - 1); S.imp.mapa = null; pintarImport(); };
  $("#imp-mapa").querySelectorAll("select[data-k]").forEach(s => s.onchange = () => { S.imp.mapa[s.dataset.k] = s.value === "" ? null : +s.value; pintarImport(); });
  $("#imp-ok").onclick = async e => { const filas = S.imp.validas.map(o => { const f = { ...o }; Object.keys(f).forEach(k => { if (f[k] === undefined) delete f[k]; }); if (f.estado == null) f.estado = "disponible"; return f; });
    const dup = filas.map(f => f.codigo).filter((c, i, a) => a.indexOf(c) !== i); if (dup.length) { toast("Hay códigos repetidos en el archivo: " + [...new Set(dup)].slice(0, 5).join(", ")); return; }
    if (await guardar("importarUnidades", [filas], `${filas.length} unidades importadas`, e.target)) { S.imp = null; $("#imp-mapa").innerHTML = ""; ir("locales"); } };
}

/* ---------- clientes interesados ---------- */
const EST_CLI = { nuevo: "Nuevo", contactado: "Contactado", visita: "Visitó", negociacion: "Negociando", reservo: "Reservó", compro: "Compró", perdido: "Perdido" };
const PILL_CLI = { nuevo: "no_disponible", contactado: "abierto", visita: "abierto", negociacion: "reservado", reservo: "aceptado", compro: "vendido", perdido: "vencido" };
const TIPOS_SEG = { nota: "Nota", llamada: "Llamada", whatsapp: "WhatsApp", email: "Email", visita: "Visita", reunion: "Reunión" };
function renderClientes(){
  const caja = $("#cli-lista"); if (!caja) return;
  const q = ($("#cli-buscar").value || "").toLowerCase().trim(), f = S.fCli || "activos", mios = $("#cli-mios").checked, hoy = hoyISO();
  $("#f-cli").innerHTML = [["activos", "En curso"], ["todos", "Todos"], ...Object.entries(EST_CLI)].map(([k, n]) => `<button data-k="${k}" aria-pressed="${f === k}">${n}</button>`).join("");
  let cs = S.clientes.filter(c => (f === "todos" || (f === "activos" ? !["compro", "perdido"].includes(c.estado) : c.estado === f)) && (!mios || c.asesor_id === S.uid)
    && (!q || [c.nombre, c.telefono, c.email, c.interes, c.notas].join(" ").toLowerCase().includes(q)));
  cs.sort((a, b) => (a.proximo || "9999") < (b.proximo || "9999") ? -1 : (a.proximo || "9999") > (b.proximo || "9999") ? 1 : String(b.actualizado).localeCompare(String(a.actualizado)));
  const vencidos = S.clientes.filter(c => c.proximo && c.proximo <= hoy && !["compro", "perdido"].includes(c.estado)).length;
  $("#cli-aviso").innerHTML = vencidos ? `<span class="aviso">${vencidos} cliente${vencidos > 1 ? "s" : ""} con contacto pendiente para hoy o antes</span>` : "";
  caja.innerHTML = cs.length ? `<table><thead><tr><th>Cliente</th><th>Estado</th><th>Interés</th><th>Próximo contacto</th><th>Asesor</th><th></th></tr></thead><tbody>${cs.map(c => `<tr>
    <td><b>${esc(c.nombre)}</b><div class="muted">${esc([c.telefono, c.email].filter(Boolean).join(" · "))}</div></td>
    <td><span class="pill p-${PILL_CLI[c.estado]}">${EST_CLI[c.estado]}</span></td><td>${esc(c.interes || "—")}${c.presupuesto_max ? `<div class="muted">hasta ${usd(c.presupuesto_max)}</div>` : ""}</td>
    <td>${c.proximo ? `${fmtF(c.proximo)}${c.proximo <= hoy && !["compro", "perdido"].includes(c.estado) ? `<div class="aviso">Pendiente</div>` : ""}` : "—"}</td><td>${esc(c.asesor || "—")}</td>
    <td><button data-cli="${esc(c.id)}">Abrir</button></td></tr>`).join("")}</tbody></table>` : `<div class="vacio">No hay clientes con ese filtro. Cargá el primero con “Nuevo cliente”.</div>`;
}
$("#f-cli").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { S.fCli = b.dataset.k; renderClientes(); } });
$("#cli-buscar").addEventListener("input", renderClientes); $("#cli-mios").onchange = renderClientes;
$("#cli-lista").addEventListener("click", e => { const b = e.target.closest("[data-cli]"); if (b) abrirCliente(b.dataset.cli); });
$("#btn-nuevo-cli").onclick = () => abrirCliente(null);
function abrirCliente(id){
  const c = id ? S.clientes.find(x => x.id === id) : { nombre: "", telefono: "", email: "", documento: "", origen: "", estado: "nuevo", interes: "", presupuesto_max: null, proximo: "", notas: "" };
  if (!c) return;
  const pres = id ? S.presus.filter(p => p.clienteId === id) : [], res = id ? S.reservas.filter(r => r.clienteId === id) : [];
  abrirDrawer(`<div class="cab"><div><h3>${id ? esc(c.nombre) : "Nuevo cliente"}</h3><div class="muted">${esc(P().nombre)}${c.asesor ? " · asesor: " + esc(c.asesor) : ""}</div></div><button id="d-x">Cerrar</button></div>
    <label for="c-nom">Nombre y apellido</label><input id="c-nom" value="${esc(c.nombre)}">
    <div class="dos"><div><label for="c-tel">Teléfono / WhatsApp</label><input id="c-tel" type="tel" value="${esc(c.telefono)}"></div><div><label for="c-mail">Email</label><input id="c-mail" type="email" value="${esc(c.email)}"></div></div>
    <div class="dos"><div><label for="c-doc">DNI / CUIT</label><input id="c-doc" value="${esc(c.documento)}"></div><div><label for="c-ori">Cómo llegó</label><input id="c-ori" list="c-oris" value="${esc(c.origen)}" placeholder="Instagram, cartel, referido…"><datalist id="c-oris"><option>Instagram</option><option>Facebook</option><option>Zonaprop</option><option>Argenprop</option><option>Cartel en obra</option><option>Referido</option><option>Web</option><option>Llamada</option></datalist></div></div>
    <div class="dos"><div><label for="c-est">Estado</label><select id="c-est">${Object.entries(EST_CLI).map(([k, n]) => `<option value="${k}" ${c.estado === k ? "selected" : ""}>${n}</option>`).join("")}</select></div><div><label for="c-prox">Próximo contacto</label><input id="c-prox" type="date" value="${esc(c.proximo || "")}"></div></div>
    <div class="dos"><div><label for="c-int">Qué busca</label><input id="c-int" value="${esc(c.interes)}" placeholder="2 amb con balcón, lote esquina…"></div><div><label for="c-max">Presupuesto hasta USD</label><input id="c-max" type="number" step="1000" value="${esc(c.presupuesto_max ?? "")}"></div></div>
    <label for="c-not">Notas</label><textarea id="c-not" rows="2">${esc(c.notas)}</textarea>
    <div class="pie"><button class="prim" id="c-ok">${id ? "Guardar" : "Crear cliente"}</button>${id ? `<button id="c-presu">Armar presupuesto</button><button id="c-res">Reservar</button>${c.telefono ? `<a class="btn" href="https://wa.me/${esc(String(c.telefono).replace(/\D/g, "").replace(/^0/, "549").replace(/^(?!54)/, "549"))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${esAdmin() || c.asesor_id === S.uid ? `<button class="peligro" id="c-borrar">Borrar</button>` : ""}` : ""}</div>
    ${id ? `${pres.length || res.length ? `<h4 style="margin:18px 0 6px">Operaciones</h4>${pres.map(p => `<div>${esc(p.numero)} · ${(p.items || []).map(i => esc(i.codigo)).join(", ")} <span class="pill p-${estadoPresu(p)}">${EST_PRESU[estadoPresu(p)]}</span></div>`).join("")}${res.map(r => `<div>Reserva ${esc(r.codigo)} · ${fmtF(r.fecha)} <span class="pill p-${esc(r.estado)}">${EST_RES[r.estado]}</span></div>`).join("")}` : ""}
    <h4 style="margin:22px 0 6px">Seguimiento</h4>
    <div class="dos"><select id="s-tipo">${Object.entries(TIPOS_SEG).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select><button id="s-ok">Agregar</button></div>
    <textarea id="s-txt" rows="2" placeholder="Qué se habló, qué quedó pendiente…" style="margin-top:6px"></textarea>
    <div id="s-lista"><div class="muted">Cargando…</div></div>` : ""}`, "min(560px,100%)");
  $("#d-x").onclick = cerrarDrawer;
  $("#c-ok").onclick = async e => { const v = s => $(s).value.trim(); if (!v("#c-nom")) { toast("Poné el nombre"); return; }
    const campos = { nombre: v("#c-nom"), telefono: v("#c-tel"), email: v("#c-mail"), documento: v("#c-doc"), origen: v("#c-ori"), estado: v("#c-est"), proximo: v("#c-prox") || null, interes: v("#c-int"), presupuesto_max: v("#c-max") === "" ? null : +v("#c-max"), notas: v("#c-not") };
    const r = await guardar("guardarCliente", [id, campos], id ? "Cliente guardado" : "Cliente creado", e.target); if (r) abrirCliente(r.id); };
  if (!id) return;
  S.clienteAbierto = id; cargarSeguimientos(id);
  $("#c-presu").onclick = () => { cerrarDrawer(); ir("presupuestos"); editorPresu({ cliente: c.nombre, contacto: [c.telefono, c.email].filter(Boolean).join(" · "), clienteId: c.id }); };
  $("#c-res").onclick = () => { cerrarDrawer(); generadorReserva({ cliente: c.nombre, contacto: c.email || c.telefono, clienteId: c.id }); };
  const b = $("#c-borrar"); if (b) b.onclick = async () => { if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Borrar? Tocá de nuevo"; return; } if (await guardar("borrarCliente", [id], "Cliente borrado", b)) cerrarDrawer(); };
  $("#s-ok").onclick = async e => { const t = $("#s-txt").value.trim(); if (!t) { toast("Escribí el seguimiento"); return; } e.target.disabled = true;
    const { error } = await sb.from("seguimientos").insert({ cliente_id: id, tipo: $("#s-tipo").value, texto: t });
    if (!error && c.estado === "nuevo") await sb.from("clientes").update({ estado: "contactado", actualizado: new Date().toISOString() }).eq("id", id);
    else if (!error) await sb.from("clientes").update({ actualizado: new Date().toISOString() }).eq("id", id);
    e.target.disabled = false; if (error) toast(errTxt(error)); else { $("#s-txt").value = ""; toast("Seguimiento agregado"); cargarSeguimientos(id); } };
}
async function cargarSeguimientos(id){
  const { data, error } = await sb.from("seguimientos").select("*").eq("cliente_id", id).order("creado", { ascending: false });
  const caja = $("#s-lista"); if (!caja || S.clienteAbierto !== id) return;
  if (error) { caja.innerHTML = `<p class="aviso">${esc(errTxt(error))}</p>`; return; }
  caja.innerHTML = data.length ? data.map(s => `<div class="coment"><div class="coment-cab"><span class="pill p-no_disponible">${TIPOS_SEG[s.tipo] || s.tipo}</span><b>${esc(s.autor)}</b><span class="muted">${fechaHora(s.creado)}</span>${s.autor_id === S.uid || esAdmin() ? `<button data-seg="${esc(s.id)}">Borrar</button>` : ""}</div><div class="coment-txt">${esc(s.texto)}</div></div>`).join("") : `<div class="muted" style="margin-top:8px">Sin seguimientos todavía.</div>`;
  caja.querySelectorAll("[data-seg]").forEach(b => b.onclick = async () => { const { error } = await sb.from("seguimientos").delete().eq("id", b.dataset.seg); if (error) toast(errTxt(error)); else cargarSeguimientos(id); });
}

/* ---------- plan de pagos y cobranzas ---------- */
const estadoCuota = (c, hoy) => c.pagado >= c.monto - 0.005 ? "pagada" : c.vencimiento < hoy ? "vencida" : c.pagado > 0 ? "parcial" : "pendiente";
const EST_CUO = { pagada: ["Pagada", "aceptado"], parcial: ["Pago parcial", "reservado"], vencida: ["Vencida", "vendido"], pendiente: ["Pendiente", "no_disponible"] };
function planPagos(r){
  const plan = S.cuotas.filter(c => c.reserva_id === r.id).sort((a, b) => a.numero - b.numero);
  const doc = r.documento || {}; const precio = doc.precio || r.precio || 0; const ant = doc.anticipo ?? Math.round(precio * (S.cond.anticipoPct || 30) / 100); const n = doc.cuotas ?? S.cond.cuotas ?? 36;
  const hayPagos = plan.some(c => c.pagado > 0);
  abrirDrawer(`<div class="cab"><div><h3>Plan de pagos · ${esc(r.codigo)}</h3><div class="muted">${esc(r.cliente)} · precio ${usd(precio)}</div></div><button id="d-x">Cerrar</button></div>
    ${plan.length ? `<div class="calc">${plan.length} pagos · total ${usd(plan.reduce((s, c) => s + c.monto, 0))} · cobrado ${usd(plan.reduce((s, c) => s + c.pagado, 0))}</div>
      <div class="tabla" style="margin-top:10px"><table><thead><tr><th>Concepto</th><th>Vence</th><th class="num">Monto</th><th class="num">Pagado</th><th>Estado</th></tr></thead><tbody>${plan.map(c => { const e = estadoCuota(c, hoyISO()); return `<tr><td>${esc(c.concepto)}</td><td>${fmtF(c.vencimiento)}</td><td class="num">${usd(c.monto)}</td><td class="num">${c.pagado ? usd(c.pagado) : "—"}</td><td><span class="pill p-${EST_CUO[e][1]}">${EST_CUO[e][0]}</span></td></tr>`; }).join("")}</tbody></table></div>` : ""}
    ${hayPagos ? `<p class="muted">El plan ya tiene pagos registrados, por eso no se puede rehacer. Los pagos se cargan en la pestaña Cobranzas.</p>` : `
    <h4>${plan.length ? "Rehacer el plan" : "Armar el plan"}</h4>
    <div class="dos"><div><label for="pp-ant">Anticipo USD</label><input id="pp-ant" type="number" step="100" value="${esc(ant)}"></div><div><label for="pp-vant">Vence el anticipo</label><input id="pp-vant" type="date" value="${esc(r.cerrada || hoyISO())}"></div></div>
    <div class="tres"><div><label for="pp-n">Cuotas</label><input id="pp-n" type="number" value="${esc(n)}"></div><div><label for="pp-m">Monto de cada cuota USD</label><input id="pp-m" type="number" step="1" value="${esc(n ? Math.round((precio - ant) / n * 100) / 100 : 0)}"></div><div><label for="pp-1">Primera cuota vence</label><input id="pp-1" type="date" value="${esc(masDias(r.cerrada || hoyISO(), 30))}"></div></div>
    <div class="calc" id="pp-tot"></div>
    <div class="pie"><button class="prim" id="pp-ok">${plan.length ? "Rehacer plan" : "Crear plan"}</button></div>`}`, "min(640px,100%)");
  $("#d-x").onclick = cerrarDrawer;
  const ok = $("#pp-ok"); if (!ok) return;
  const tot = () => { const a = +$("#pp-ant").value || 0, k = +$("#pp-n").value || 0, m = +$("#pp-m").value || 0; const t = a + k * m; $("#pp-tot").innerHTML = `Total del plan ${usd(t)}${Math.abs(t - precio) > 1 ? ` · <span class="aviso">difiere del precio en ${usd(t - precio)}</span>` : ""}`; };
  ["#pp-ant", "#pp-n", "#pp-m"].forEach(s => $(s).oninput = tot); $("#pp-n").addEventListener("input", () => { const k = +$("#pp-n").value || 0; if (k) $("#pp-m").value = Math.round((precio - (+$("#pp-ant").value || 0)) / k * 100) / 100; tot(); }); tot();
  ok.onclick = async e => { if (!$("#pp-1").value && (+$("#pp-n").value || 0) > 0) { toast("Poné la fecha de la primera cuota"); return; }
    if (await guardar("generarPlan", [r.id, +$("#pp-ant").value || 0, $("#pp-vant").value, +$("#pp-n").value || 0, +$("#pp-m").value || 0, $("#pp-1").value || hoyISO()], "Plan de pagos creado", e.target)) planPagos(S.reservas.find(x => x.id === r.id) || r); };
}
function renderCobranzas(){
  const caja = $("#cob-lista"); if (!caja) return; const hoy = hoyISO(), en30 = masDias(hoy, 30), f = S.fCob || "proximas", q = ($("#cob-buscar").value || "").toLowerCase().trim();
  const cs = S.cuotas.map(c => ({ ...c, est: estadoCuota(c, hoy), codigo: (S.locales[c.unidad_id] || {}).codigo || "" }));
  const sum = a => a.reduce((s, c) => s + c.monto, 0), pag = a => a.reduce((s, c) => s + c.pagado, 0);
  const venc = cs.filter(c => c.est === "vencida"), prox = cs.filter(c => c.est !== "pagada" && c.vencimiento >= hoy && c.vencimiento <= en30);
  $("#cob-kpi").innerHTML = cs.length ? `<div class="kpi"><div class="l">Total en planes</div><div class="n">${usd(sum(cs)).replace("USD ", "")}</div><div class="s">USD · ${new Set(cs.map(c => c.reserva_id)).size} ventas</div></div>
    <div class="kpi disp"><div class="l">Cobrado</div><div class="n">${usd(pag(cs)).replace("USD ", "")}</div><div class="s">${sum(cs) ? Math.round(pag(cs) / sum(cs) * 100) : 0}% del total</div></div>
    <div class="kpi ven"><div class="l">Vencido sin cobrar</div><div class="n">${usd(sum(venc) - pag(venc)).replace("USD ", "")}</div><div class="s">${venc.length} cuotas</div></div>
    <div class="kpi res"><div class="l">Vence en 30 días</div><div class="n">${usd(sum(prox) - pag(prox)).replace("USD ", "")}</div><div class="s">${prox.length} cuotas</div></div>` : "";
  $("#f-cob").innerHTML = [["proximas", "Vencidas y próximas"], ["vencidas", "Vencidas"], ["pendientes", "Pendientes"], ["pagadas", "Pagadas"], ["todas", "Todas"]].map(([k, n]) => `<button data-k="${k}" aria-pressed="${f === k}">${n}</button>`).join("");
  let lista = cs.filter(c => f === "todas" || (f === "vencidas" ? c.est === "vencida" : f === "pagadas" ? c.est === "pagada" : f === "pendientes" ? c.est !== "pagada" : c.est === "vencida" || (c.est !== "pagada" && c.vencimiento <= en30)));
  if (q) lista = lista.filter(c => (c.cliente + " " + c.codigo + " " + c.concepto).toLowerCase().includes(q));
  caja.innerHTML = !cs.length ? `<div class="vacio">Todavía no hay planes de pago. Se arman desde <b>Reservas</b>, con el botón “Plan de pagos” de cada boleto firmado.</div>`
    : lista.length ? `<table><thead><tr><th>Vence</th><th>${esc(unidadLbl())}</th><th>Cliente</th><th>Concepto</th><th class="num">Monto</th><th class="num">Pagado</th><th>Estado</th><th></th></tr></thead><tbody>${lista.map(c => `<tr>
      <td>${fmtF(c.vencimiento)}</td><td><b>${esc(c.codigo)}</b></td><td>${esc(c.cliente)}</td><td>${esc(c.concepto)}${c.notas ? `<div class="muted">${esc(c.notas)}</div>` : ""}</td><td class="num">${usd(c.monto)}</td><td class="num">${c.pagado ? usd(c.pagado) : "—"}${c.fecha_pago ? `<div class="muted">${fmtF(c.fecha_pago)}</div>` : ""}</td>
      <td><span class="pill p-${EST_CUO[c.est][1]}">${EST_CUO[c.est][0]}</span></td><td>${c.est !== "pagada" ? `<button data-pagar="${esc(c.id)}">Registrar pago</button>` : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="vacio">No hay cuotas con ese filtro.</div>`;
}
$("#f-cob").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { S.fCob = b.dataset.k; renderCobranzas(); } });
$("#cob-buscar").addEventListener("input", renderCobranzas);
$("#cob-lista").addEventListener("click", e => { const b = e.target.closest("[data-pagar]"); if (!b) return; const c = S.cuotas.find(x => x.id === b.dataset.pagar); if (!c) return;
  abrirDrawer(`<div class="cab"><div><h3>Registrar pago</h3><div class="muted">${esc(c.concepto)} · ${esc(c.cliente)} · vence ${fmtF(c.vencimiento)}</div></div><button id="d-x">Cerrar</button></div>
    <div class="dos"><div><label for="pg-m">Monto pagado USD</label><input id="pg-m" type="number" step="0.01" value="${esc(Math.round((c.monto - c.pagado) * 100) / 100)}"></div><div><label for="pg-f">Fecha de pago</label><input id="pg-f" type="date" value="${hoyISO()}"></div></div>
    <label for="pg-n">Nota (forma de pago, recibo…)</label><input id="pg-n" placeholder="Transferencia, recibo N°…">
    <div class="pie"><button class="prim" id="pg-ok">Registrar pago</button></div>`);
  $("#d-x").onclick = cerrarDrawer;
  $("#pg-ok").onclick = async e => { const m = +$("#pg-m").value; if (!m) { toast("Poné el monto"); return; } if (await guardar("registrarPago", [c.id, m, $("#pg-f").value, $("#pg-n").value.trim()], "Pago registrado", e.target)) cerrarDrawer(); };
});

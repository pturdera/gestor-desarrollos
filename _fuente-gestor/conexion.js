/* ---------- conexión con Supabase ---------- */
const SB_URL = "__SB_URL__";
const SB_KEY = "__SB_KEY__";
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const nroTxt = n => "CB-" + String(n||0).padStart(4,"0");
const errTxt = e => { const m = String((e && (e.message || e.error_description)) || e || "Error");
  if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Tu cuenta está pendiente: un administrador tiene que habilitarla.";
  if (/User already registered/i.test(m)) return "Ya existe una cuenta con ese email. Entrá con tu contraseña.";
  if (/Password should be at least/i.test(m)) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.";
  if (/duplicate key.*codigo|unidades_proyecto_codigo/i.test(m)) return "Ya hay una unidad con ese código en este proyecto.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "No hay conexión. Revisá internet.";
  return m; };

/* Pantalla de entrada */
function modoLogin(m, msg){
  S.modoLogin = m;
  document.querySelectorAll("#f-login [data-modo]").forEach(el => el.hidden = !el.dataset.modo.split(" ").includes(m));
  $("#l-pass").autocomplete = m==="entrar" ? "current-password" : "new-password";
  $("#l-ok").textContent = {entrar:"Entrar", crear:"Crear mi cuenta", olvide:"Enviarme el link", nueva:"Guardar contraseña"}[m];
  $("#l-err").textContent = msg || ""; $("#l-err").className = "error";
}
function mostrarLogin(msg, modo){ $("#login").hidden = false; modoLogin(modo || S.modoLogin || "entrar", msg); setTimeout(()=>($("#l-mail").value ? $("#l-pass") : $("#l-mail")).focus(), 50); }
function avisoLogin(t){ $("#l-err").textContent = t; $("#l-err").className = "ok-msg"; }
$("#f-login").addEventListener("click", e => { const b = e.target.closest("[data-ir]"); if (b){ e.preventDefault(); modoLogin(b.dataset.ir); } });
$("#f-login").addEventListener("submit", async e => {
  e.preventDefault(); const b = $("#l-ok"), m = S.modoLogin || "entrar";
  const email = $("#l-mail").value.trim(), pass = $("#l-pass").value;
  b.disabled = true; $("#l-err").textContent = "";
  try {
    if (m === "entrar") { const { error } = await sb.auth.signInWithPassword({ email, password: pass }); if (error) throw error; }
    else if (m === "crear") {
      if (!$("#l-nombre").value.trim()) throw new Error("Poné tu nombre y apellido.");
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { nombre: $("#l-nombre").value.trim(), telefono: $("#l-tel").value.trim() }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (!(data && data.session)) { modoLogin("entrar"); avisoLogin("Listo. Tu cuenta quedó pendiente: avisale a un administrador para que la habilite y después entrá con tu email y contraseña."); }
    } else if (m === "olvide") {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error;
      modoLogin("entrar"); avisoLogin("Si el email está registrado, te llega un link para elegir una contraseña nueva. Si no llega, pedile a un administrador una contraseña temporal.");
    } else if (m === "nueva") { const { error } = await sb.auth.updateUser({ password: pass }); if (error) throw error; $("#login").hidden = true; toast("Contraseña cambiada"); iniciarSesion(); }
  } catch (err) { $("#l-err").className = "error"; $("#l-err").textContent = errTxt(err); }
  b.disabled = false;
});
$("#salir").onclick = async () => {
  try { localStorage.removeItem("gd-datos"); } catch (e) {}
  await sb.auth.signOut();
  S.cargado = false; S.perfil = null; S.uid = null; S.proyectos = []; S.locales = {}; S.presus = []; S.reservas = []; S.hist = []; S.clientes = []; S.cuotas = [];
  pintarYo(); renderTodo(); mostrarLogin("", "entrar");
};

/* Datos: se leen todos los proyectos activos de una vez (el sistema filtra por el proyecto elegido) */
const mapUnidad = l => ({ id: l.id, pid: l.proyecto_id, codigo: l.codigo, planta: l.grupo, nave: l.subgrupo, tipo: l.tipo, m2: +l.m2 || 0, usdM2: l.usd_m2 == null ? null : +l.usd_m2, precioLista: l.precio_lista == null ? null : +l.precio_lista, precio: l.precio == null ? null : +l.precio,
  estado: l.estado, cliente: l.cliente, rubro: l.rubro, notas: l.notas, orden: l.orden, ambientes: l.ambientes, dormitorios: l.dormitorios, banos: l.banos, m2Cub: l.m2_cubiertos, m2Semi: l.m2_semicubiertos, m2Ter: l.m2_terreno, frente: l.frente, fondo: l.fondo, orientacion: l.orientacion, cochera: l.cochera });
async function leerTodo(){
  const q = await Promise.all([
    sb.from("proyectos").select("*").order("orden").order("creado"),
    sb.from("unidades").select("*").order("orden"),
    sb.from("presupuestos").select("*").order("nro", { ascending: false }),
    sb.from("reservas").select("*").order("fecha", { ascending: false }),
    sb.from("historial").select("ts,texto,unidad_id,proyecto_id,usuario").order("id", { ascending: false }).limit(600),
    sb.from("perfiles").select("id,nombre,telefono,email,rol,activo,creado").order("creado"),
    sb.from("clientes").select("*").order("actualizado", { ascending: false }),
    sb.from("cuotas").select("*").order("vencimiento")
  ]);
  const err = q.find(r => r.error); if (err) throw err.error;
  const [pr, un, pre, re, hi, pe, cl, cu] = q.map(r => r.data);
  return {
    proyectos: pr,
    unidades: un.map(mapUnidad),
    presus: pre.map(p => ({ id: p.id, pid: p.proyecto_id, clienteId: p.cliente_id, numero: nroTxt(p.nro), fecha: p.fecha || "", cliente: p.cliente, contacto: p.contacto, vigencia: p.vigencia || "", estado: p.estado, notas: p.notas, items: p.items || [], cond: { anticipoPct: 30, cuotas: 36, honorariosPct: 4, certificacionArs: 0, ...(p.cond || {}) }, asesor: p.asesor })),
    reservas: re.map(r => ({ id: r.id, pid: r.proyecto_id, clienteId: r.cliente_id, fecha: r.fecha, localId: r.unidad_id, codigo: r.codigo, cliente: r.cliente, contacto: r.contacto, precio: +r.precio || 0, sena: +r.sena || 0, vence: r.vence || "", estado: r.estado, presupuesto: r.presupuesto_nro, notas: r.notas, cerrada: r.cerrada || "", asesor: r.asesor, documento: r.documento })),
    hist: hi.map(h => ({ ts: new Date(h.ts).toLocaleString("sv-SE").replace(" ", "T"), texto: h.texto, localId: h.unidad_id, pid: h.proyecto_id, por: h.usuario })),
    equipo: pe, clientes: cl, cuotas: cu.map(c => ({ ...c, monto: +c.monto, pagado: +c.pagado }))
  };
}
function aplicar(d, deCopia){
  if (!deCopia) { try { localStorage.setItem("gd-datos", JSON.stringify(d)); } catch (e) {} }
  S.todo = d; S.proyectos = d.proyectos; S.equipo = d.equipo || [];
  S.asesores = S.equipo.filter(p => p.activo).map(p => ({ id: p.id, nombre: p.nombre || p.email, telefono: p.telefono, email: p.email }));
  const mio = S.equipo.find(p => p.id === S.uid); if (mio) S.perfil = mio;
  S.cargado = true;
  if (S.pid && !S.proyectos.find(p => p.id === S.pid)) S.pid = null;
  filtrarProyecto(); pintarYo();
  $("#conn").textContent = deCopia ? "Mostrando los últimos datos de este dispositivo · actualizando…" : "Datos al día · " + new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + (S.perfil ? " · " + (S.perfil.nombre || S.perfil.email) : "");
  renderTodo();
}
/* Deja en S.locales, S.presus, etc. solo lo del proyecto abierto */
function filtrarProyecto(){
  const d = S.todo || { unidades: [], presus: [], reservas: [], hist: [], clientes: [], cuotas: [] }, pid = S.pid;
  S.locales = {}; d.unidades.filter(u => u.pid === pid).forEach(u => S.locales[u.id] = u);
  S.presus = d.presus.filter(x => x.pid === pid); S.reservas = d.reservas.filter(x => x.pid === pid);
  S.hist = d.hist.filter(x => x.pid === pid); S.clientes = (d.clientes || []).filter(x => x.proyecto_id === pid);
  S.cuotas = (d.cuotas || []).filter(x => x.proyecto_id === pid);
  const p = P(); S.cond = { anticipoPct: 30, cuotas: 36, honorariosPct: 4, certificacionArs: 0, vigenciaDias: 30, ...((p && p.cond) || {}) };
  calcularPlantas();
}
async function cargar(){
  if (!S.uid) return;
  try { aplicar(await leerTodo()); }
  catch (e) { $("#conn").textContent = "No se pudieron leer los datos: " + errTxt(e); }
}
let recargaPend = null;
function recargarPronto(){ clearTimeout(recargaPend); recargaPend = setTimeout(() => { if ($("#presu-editor").hidden && $("#gen").hidden) cargar(); else recargarPronto(); }, 700); }
function suscribir(){
  if (S.canal) return;
  S.canal = sb.channel("cambios");
  ["proyectos", "unidades", "presupuestos", "reservas", "historial", "perfiles", "clientes", "cuotas"].forEach(t => S.canal.on("postgres_changes", { event: "*", schema: "public", table: t }, recargarPronto));
  ["comentarios", "archivos"].forEach(t => S.canal.on("postgres_changes", { event: "*", schema: "public", table: t }, p => { const id = (p.new && p.new.unidad_id) || (p.old && p.old.unidad_id); if (S.fichaAbierta && S.fichaAbierta === id) cargarExtrasLocal(id); }));
  S.canal.on("postgres_changes", { event: "*", schema: "public", table: "seguimientos" }, p => { const id = (p.new && p.new.cliente_id) || (p.old && p.old.cliente_id); if (S.clienteAbierto && S.clienteAbierto === id) cargarSeguimientos(id); });
  S.canal.subscribe();
}

/* Operaciones */
const aNull = v => v === "" || v == null || Number.isNaN(v) ? "" : v;
const OPS = {
  async guardarLocal(id, c){ const { error } = await sb.rpc("guardar_unidad", { p_id: id, c }); if (error) throw error; return {}; },
  async crearPresupuesto(p){ const { data, error } = await sb.rpc("crear_presupuesto", { p: { ...p, proyecto_id: S.pid, cliente_id: p.clienteId || null } }); if (error) throw error; return { id: data.id, numero: nroTxt(data.nro) }; },
  async estadoPresupuesto(id, estado){ const { error } = await sb.rpc("estado_presupuesto", { p_id: id, p_estado: estado }); if (error) throw error; return {}; },
  async reservar(ids, d, presuId){ const { error } = await sb.rpc("reservar", { p_ids: ids, d, p_presu: presuId || null }); if (error) throw error; return {}; },
  async cerrarReserva(id, tipo){ const { error } = await sb.rpc("cerrar_reserva", { p_id: id, p_tipo: tipo }); if (error) throw error; return {}; },
  async guardarPerfil(d){ const { data, error } = await sb.from("perfiles").update({ nombre: d.nombre, telefono: d.telefono }).eq("id", S.uid).select().single(); if (error) throw error; return { perfil: data }; },
  async cambiarPerfil(id, campos){ const { error } = await sb.from("perfiles").update(campos).eq("id", id); if (error) throw error; return {}; },
  async guardarProyecto(id, campos){ const q = id ? sb.from("proyectos").update(campos).eq("id", id).select().single() : sb.from("proyectos").insert(campos).select().single(); const { data, error } = await q; if (error) throw error; await sb.rpc("registrar", { p_texto: (id ? "Proyecto actualizado: " : "Proyecto nuevo: ") + data.nombre, p_unidad: null, p_proyecto: data.id }); return { id: data.id }; },
  async nuevaUnidad(campos){ const { data, error } = await sb.from("unidades").insert({ ...campos, proyecto_id: S.pid }).select().single(); if (error) throw error; await sb.rpc("registrar", { p_texto: "Unidad nueva: " + data.codigo, p_unidad: data.id, p_proyecto: S.pid }); return { id: data.id }; },
  async borrarUnidad(id){ const u = S.locales[id]; const { error } = await sb.from("unidades").delete().eq("id", id); if (error) throw error; await sb.rpc("registrar", { p_texto: "Unidad borrada: " + (u ? u.codigo : id), p_unidad: null, p_proyecto: S.pid }); return {}; },
  async importarUnidades(filas){ for (let i = 0; i < filas.length; i += 200) { const { error } = await sb.from("unidades").upsert(filas.slice(i, i + 200).map(f => ({ ...f, proyecto_id: S.pid })), { onConflict: "proyecto_id,codigo" }); if (error) throw error; } await sb.rpc("registrar", { p_texto: `Importación de ${filas.length} unidades desde planilla`, p_unidad: null, p_proyecto: S.pid }); return {}; },
  async guardarCliente(id, campos){ const q = id ? sb.from("clientes").update({ ...campos, actualizado: new Date().toISOString() }).eq("id", id).select().single() : sb.from("clientes").insert({ ...campos, proyecto_id: S.pid }).select().single(); const { data, error } = await q; if (error) throw error; return { id: data.id }; },
  async borrarCliente(id){ const { error } = await sb.from("clientes").delete().eq("id", id); if (error) throw error; return {}; },
  async generarPlan(resId, ant, vAnt, n, monto, primer){ const { error } = await sb.rpc("generar_plan", { p_reserva: resId, p_anticipo: ant || 0, p_venc_anticipo: vAnt || null, p_cuotas: n || 0, p_monto_cuota: monto || 0, p_primer: primer }); if (error) throw error; return {}; },
  async registrarPago(cuotaId, monto, fecha, nota){ const { error } = await sb.rpc("registrar_pago", { p_cuota: cuotaId, p_monto: monto, p_fecha: fecha, p_nota: nota || "" }); if (error) throw error; return {}; }
};
async function guardar(fn, args, msg, boton){
  if (boton) boton.disabled = true; document.body.classList.add("cargando"); toast("Guardando…");
  try { const r = await OPS[fn](...args); await cargar(); if (msg) toast(msg); return r || {}; }
  catch (e) { toast(errTxt(e)); if (boton) boton.disabled = false; return null; }
  finally { document.body.classList.remove("cargando"); }
}
$("#btn-act").onclick = () => { $("#conn").textContent = "Actualizando…"; cargar(); };
setInterval(() => { if (S.uid && !document.hidden && $("#drawer").hidden && $("#presu-editor").hidden && $("#gen").hidden) cargar(); }, 120000);

/* Sesión */
async function iniciarSesion(){
  const { data } = await sb.auth.getSession(); const s = data && data.session;
  if (!s) { S.uid = null; mostrarLogin(); $("#conn").textContent = "Entrá con tu email y contraseña."; return; }
  S.uid = s.user.id;
  const { data: yo } = await sb.from("perfiles").select("*").eq("id", S.uid).maybeSingle();
  S.perfil = yo || { nombre: "", email: s.user.email, telefono: "", activo: false, rol: "agente" };
  pintarYo();
  if (!S.perfil.activo) {
    $("#login").hidden = true; ir("proyectos");
    $("#proy-lista").innerHTML = `<div class="vacio"><b>Tu cuenta está pendiente de habilitación.</b><br>Avisale a un administrador del equipo para que la habilite desde “Mis datos → Equipo”. Después recargá esta página.</div>`;
    $("#conn").textContent = "Cuenta pendiente de habilitación · " + (S.perfil.email || ""); return;
  }
  $("#login").hidden = true;
  try { const c = localStorage.getItem("gd-datos"); if (c && !S.cargado) aplicar(JSON.parse(c), true); } catch (e) {}
  await cargar(); suscribir();
  irDesdeHash();
  if (!S.perfil.telefono) setTimeout(() => misDatos("Completá tu nombre y teléfono: van a salir en los presupuestos y reservas que hagas."), 800);
}
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === "PASSWORD_RECOVERY") { mostrarLogin("Elegí tu contraseña nueva.", "nueva"); return; }
  if (ev === "SIGNED_IN" && session && session.user.id !== S.uid) iniciarSesion();
});

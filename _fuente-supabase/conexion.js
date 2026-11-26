/* ---------- conexión con Supabase ---------- */
const SB_URL = "__SB_URL__";
const SB_KEY = "__SB_KEY__";
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const nroTxt = n => "CB-" + String(n||0).padStart(4,"0");
const errTxt = e => { const m = String((e && (e.message || e.error_description)) || e || "Error");
  if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Tu cuenta está pendiente: un administrador tiene que habilitarla.";
  if (/User already registered/i.test(m)) return "Ya existe una cuenta con ese email. Entrá con tu contraseña o usá “Olvidé mi contraseña”.";
  if (/Password should be at least/i.test(m)) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "No hay conexión. Revisá internet.";
  return m; };

/* Pantalla de entrada: entrar, crear cuenta, olvidé mi contraseña, contraseña nueva */
function modoLogin(m, msg){
  S.modoLogin = m;
  document.querySelectorAll("#f-login [data-modo]").forEach(el => el.hidden = !el.dataset.modo.split(" ").includes(m));
  $("#l-pass").required = m==="entrar" || m==="crear" || m==="nueva";
  $("#l-mail").required = m!=="nueva";
  $("#l-nombre").required = m==="crear";
  $("#l-pass").autocomplete = m==="entrar" ? "current-password" : "new-password";
  $("#l-ok").textContent = {entrar:"Entrar", crear:"Crear mi cuenta", olvide:"Enviarme el link", nueva:"Guardar contraseña"}[m];
  $("#l-err").textContent = msg || ""; $("#l-err").className = "error";
}
function mostrarLogin(msg, modo){
  $("#login").hidden = false; modoLogin(modo || S.modoLogin || "entrar", msg);
  setTimeout(()=>($("#l-mail").value ? $("#l-pass") : $("#l-mail")).focus(), 50);
}
function avisoLogin(t){ $("#l-err").textContent = t; $("#l-err").className = "ok-msg"; }
$("#f-login").addEventListener("click", e => { const b = e.target.closest("[data-ir]"); if (b){ e.preventDefault(); modoLogin(b.dataset.ir); } });
$("#f-login").addEventListener("submit", async e => {
  e.preventDefault(); const b = $("#l-ok"), m = S.modoLogin || "entrar";
  const email = $("#l-mail").value.trim(), pass = $("#l-pass").value;
  b.disabled = true; $("#l-err").textContent = "";
  try {
    if (m === "entrar") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass }); if (error) throw error;
    } else if (m === "crear") {
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { nombre: $("#l-nombre").value.trim(), telefono: $("#l-tel").value.trim() }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (data && data.session) { /* quedó adentro (primera cuenta del sistema) */ }
      else { modoLogin("entrar"); avisoLogin("Listo. Tu cuenta quedó pendiente: avisale a un administrador para que la habilite y después entrá con tu email y contraseña."); }
    } else if (m === "olvide") {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error;
      modoLogin("entrar"); avisoLogin("Te mandamos un mail con un link para elegir una contraseña nueva. Revisá también Spam.");
    } else if (m === "nueva") {
      const { error } = await sb.auth.updateUser({ password: pass }); if (error) throw error;
      $("#login").hidden = true; toast("Contraseña cambiada"); iniciarSesion();
    }
  } catch (err) { $("#l-err").className = "error"; $("#l-err").textContent = errTxt(err); }
  b.disabled = false;
});
$("#salir").onclick = async () => {
  try { localStorage.removeItem("lb2-datos"); } catch (e) {}
  await sb.auth.signOut();
  S.cargado = false; S.perfil = null; S.asesores = []; S.locales = {}; S.presus = []; S.reservas = []; S.hist = []; pintarYo(); renderTodo(); mostrarLogin("", "entrar");
};

/* Datos: todo junto, en paralelo */
function aplicar(d, deCopia){
  if (!deCopia) { try { localStorage.setItem("lb2-datos", JSON.stringify(d)); } catch (e) {} }
  S.locales = {}; d.locales.forEach(l => S.locales[l.id] = l);
  S.presus = d.presus; S.reservas = d.reservas; S.hist = d.hist; S.cond = { ...S.cond, ...(d.cond || {}) }; S.cargado = true;
  S.asesores = d.asesores || []; S.equipo = d.equipo || [];
  const mio = (d.equipo || []).find(p => p.id === S.uid); if (mio) S.perfil = mio;
  pintarYo();
  $("#conn").textContent = deCopia ? "Mostrando los últimos datos de este dispositivo · actualizando…" : "Datos al día · " + new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + (S.perfil ? " · " + (S.perfil.nombre || S.perfil.email) : "");
  renderTodo();
}
async function leerTodo(){
  const q = await Promise.all([
    sb.from("locales").select("id,codigo,planta,nave,m2,usd_m2,estado,cliente,rubro,notas,orden").order("orden"),
    sb.from("presupuestos").select("*").order("nro", { ascending: false }),
    sb.from("reservas").select("*").order("fecha", { ascending: false }),
    sb.from("historial").select("ts,texto,local_id,usuario").order("id", { ascending: false }).limit(300),
    sb.from("perfiles").select("id,nombre,telefono,email,rol,activo,creado").order("creado"),
    sb.from("config").select("clave,valor")
  ]);
  const err = q.find(r => r.error); if (err) throw err.error;
  const [lo, pr, re, hi, pe, co] = q.map(r => r.data);
  const cond = (co.find(c => c.clave === "condiciones") || {}).valor || {};
  return {
    locales: lo.map(l => ({ id: l.id, codigo: l.codigo, planta: l.planta, nave: l.nave, m2: +l.m2, usdM2: l.usd_m2 == null ? null : +l.usd_m2, estado: l.estado, cliente: l.cliente, rubro: l.rubro, notas: l.notas, orden: l.orden })),
    presus: pr.map(p => ({ id: p.id, numero: nroTxt(p.nro), fecha: p.fecha || "", cliente: p.cliente, contacto: p.contacto, vigencia: p.vigencia || "", estado: p.estado, notas: p.notas, items: p.items || [], cond: { anticipoPct: 30, cuotas: 36, honorariosPct: 4, certificacionArs: 160000, ...(p.cond || {}) }, asesor: p.asesor })),
    reservas: re.map(r => ({ id: r.id, fecha: r.fecha, localId: r.local_id, codigo: r.codigo, cliente: r.cliente, contacto: r.contacto, precio: +r.precio || 0, sena: +r.sena || 0, vence: r.vence || "", estado: r.estado, presupuesto: r.presupuesto_nro, notas: r.notas, cerrada: r.cerrada || "", asesor: r.asesor, documento: r.documento })),
    hist: hi.map(h => ({ ts: new Date(h.ts).toLocaleString("sv-SE").replace(" ", "T"), texto: h.texto, localId: h.local_id, por: h.usuario })),
    asesores: pe.filter(p => p.activo).map(p => ({ id: p.id, nombre: p.nombre || p.email, telefono: p.telefono, email: p.email })),
    equipo: pe, cond
  };
}
async function cargar(){
  if (!S.uid) return;
  try { aplicar(await leerTodo()); }
  catch (e) { $("#conn").textContent = "No se pudieron leer los datos: " + errTxt(e); if (!S.cargado) $("#tablero").innerHTML = `<div class="vacio">Sin acceso a los datos.</div>`; }
}
let recargaPend = null;
function recargarPronto(){ clearTimeout(recargaPend); recargaPend = setTimeout(() => { if ($("#presu-editor").hidden && $("#gen").hidden) cargar(); else recargarPronto(); }, 700); }
function suscribir(){
  if (S.canal) return;
  S.canal = sb.channel("cambios");
  ["locales", "presupuestos", "reservas", "historial", "perfiles"].forEach(t => S.canal.on("postgres_changes", { event: "*", schema: "public", table: t }, recargarPronto));
  S.canal.on("postgres_changes", { event: "*", schema: "public", table: "comentarios" }, p => { const id = (p.new && p.new.local_id) || (p.old && p.old.local_id); if (S.fichaAbierta && S.fichaAbierta === id) cargarExtrasLocal(id); });
  S.canal.on("postgres_changes", { event: "*", schema: "public", table: "archivos" }, p => { const id = (p.new && p.new.local_id) || (p.old && p.old.local_id); if (S.fichaAbierta && S.fichaAbierta === id) cargarExtrasLocal(id); });
  S.canal.subscribe();
}

/* Operaciones: cada una es una función de la base que deja el movimiento en el historial */
const OPS = {
  async guardarLocal(id, c){ const { error } = await sb.rpc("guardar_local", { p_id: id, c: { m2: c.m2, usd_m2: c.usdM2 == null ? "" : c.usdM2, estado: c.estado, cliente: c.cliente, rubro: c.rubro, notas: c.notas } }); if (error) throw error; return {}; },
  async crearPresupuesto(p){ const { data, error } = await sb.rpc("crear_presupuesto", { p }); if (error) throw error; return { id: data.id, numero: nroTxt(data.nro) }; },
  async estadoPresupuesto(id, estado){ const { error } = await sb.rpc("estado_presupuesto", { p_id: id, p_estado: estado }); if (error) throw error; return {}; },
  async reservar(ids, d, presuId){ const { error } = await sb.rpc("reservar", { p_ids: ids, d, p_presu: presuId || null }); if (error) throw error; return {}; },
  async cerrarReserva(id, tipo){ const { error } = await sb.rpc("cerrar_reserva", { p_id: id, p_tipo: tipo }); if (error) throw error; return {}; },
  async guardarPerfil(d){ const { data, error } = await sb.from("perfiles").update({ nombre: d.nombre, telefono: d.telefono }).eq("id", S.uid).select().single(); if (error) throw error; return { perfil: data }; },
  async cambiarPerfil(id, campos){ const { error } = await sb.from("perfiles").update(campos).eq("id", id); if (error) throw error; return {}; }
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
    $("#login").hidden = true;
    $("#tablero").innerHTML = `<div class="vacio"><b>Tu cuenta está pendiente de habilitación.</b><br>Avisale a un administrador del equipo para que la habilite desde “Mis datos → Equipo”. Después recargá esta página.</div>`;
    $("#conn").textContent = "Cuenta pendiente de habilitación · " + (S.perfil.email || ""); return;
  }
  $("#login").hidden = true;
  try { const c = localStorage.getItem("lb2-datos"); if (c && !S.cargado) aplicar(JSON.parse(c), true); } catch (e) {}
  await cargar(); suscribir();
  if (!S.perfil.telefono) setTimeout(() => misDatos("Completá tu nombre y teléfono: van a salir en los presupuestos y reservas que hagas."), 800);
}
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === "PASSWORD_RECOVERY") { mostrarLogin("Elegí tu contraseña nueva.", "nueva"); return; }
  if (ev === "SIGNED_IN" && session && session.user.id !== S.uid) iniciarSesion();
  if (ev === "SIGNED_OUT") { S.uid = null; }
});

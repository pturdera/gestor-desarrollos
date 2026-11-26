/* ---------- ficha del local: planos, fotos y comentarios internos ---------- */
const TIPOS_ARCH = { foto: "Foto", plano: "Plano", documento: "Documento" };
const esAdmin = () => !!(S.perfil && S.perfil.rol === "admin" && S.perfil.activo);
const fechaHora = ts => { const d = new Date(ts); return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); };
const pesoTxt = b => b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";

async function cargarExtrasLocal(id){
  const caja = $("#d-extras"); if (!caja || S.fichaAbierta !== id) return;
  const [co, ar] = await Promise.all([
    sb.from("comentarios").select("*").eq("local_id", id).order("creado", { ascending: false }),
    sb.from("archivos").select("*").eq("local_id", id).order("creado", { ascending: false })
  ]);
  if (S.fichaAbierta !== id || !$("#d-extras")) return;
  if (co.error || ar.error) { caja.innerHTML = `<p class="aviso">No se pudieron leer los comentarios o archivos: ${esc(errTxt(co.error || ar.error))}</p>`; return; }
  const arch = ar.data || [];
  let urls = {};
  if (arch.length) {
    const { data } = await sb.storage.from("archivos").createSignedUrls(arch.map(a => a.ruta), 3600);
    (data || []).forEach(u => { if (u.signedUrl) urls[u.path] = u.signedUrl; });
  }
  const puedoBorrar = x => esAdmin() || x === S.uid;
  caja.innerHTML = `
    <h4 style="margin:22px 0 6px">Planos y fotos <span class="muted" style="font-weight:400">(${arch.length})</span></h4>
    <div class="arch-subir">
      <select id="x-tipo" aria-label="Tipo de archivo">${Object.entries(TIPOS_ARCH).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
      <label class="btn" for="x-file">Subir archivos</label><input id="x-file" type="file" multiple accept="image/*,application/pdf" hidden>
      <span class="muted" id="x-prog" style="font-size:12px"></span>
    </div>
    ${arch.length ? `<div class="arch-grid">${arch.map(a => {
      const u = urls[a.ruta]; const img = /\.(jpe?g|png|webp)$/i.test(a.ruta) || a.tipo === "foto";
      return `<figure class="arch">
        <a href="${u ? esc(u) : "#"}" target="_blank" rel="noopener">${img && u ? `<img src="${esc(u)}" alt="${esc(a.nombre)}" loading="lazy">` : `<div class="arch-doc">${a.ruta.toLowerCase().endsWith(".pdf") ? "PDF" : "Archivo"}</div>`}</a>
        <figcaption><span class="pill p-${a.tipo === "plano" ? "reservado" : a.tipo === "foto" ? "disponible" : "no_disponible"}">${TIPOS_ARCH[a.tipo] || a.tipo}</span> <span class="arch-nom" title="${esc(a.nombre)}">${esc(a.nombre)}</span>
        <span class="muted">${esc(a.autor || "")} · ${pesoTxt(a.bytes)}</span>${puedoBorrar(a.subido_por) ? `<button class="x-borrar-arch" data-id="${esc(a.id)}" data-ruta="${esc(a.ruta)}">Borrar</button>` : ""}</figcaption></figure>`; }).join("")}</div>`
      : `<div class="muted">Todavía no hay planos ni fotos de este local.</div>`}
    <h4 style="margin:22px 0 6px">Comentarios internos <span class="muted" style="font-weight:400">· solo los ve el equipo</span></h4>
    <textarea id="x-com" rows="2" placeholder="Ej: El cliente pidió el plano con medidas; vuelve el jueves."></textarea>
    <div class="pie" style="margin-top:6px"><button id="x-com-ok">Agregar comentario</button></div>
    ${(co.data || []).map(c => `<div class="coment"><div class="coment-cab"><b>${esc(c.autor || "—")}</b> <span class="muted">${fechaHora(c.creado)}</span>${puedoBorrar(c.autor_id) ? `<button class="x-borrar-com" data-id="${esc(c.id)}">Borrar</button>` : ""}</div><div class="coment-txt">${esc(c.texto)}</div></div>`).join("") || `<div class="muted" style="margin-top:6px">Sin comentarios todavía.</div>`}`;

  $("#x-com-ok").onclick = async e => {
    const t = $("#x-com").value.trim(); if (!t) { toast("Escribí el comentario"); return; }
    e.target.disabled = true;
    const { error } = await sb.from("comentarios").insert({ local_id: id, texto: t });
    if (error) { toast(errTxt(error)); e.target.disabled = false; return; }
    toast("Comentario agregado"); cargarExtrasLocal(id);
  };
  caja.querySelectorAll(".x-borrar-com").forEach(b => b.onclick = async () => {
    if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Borrar? Tocá de nuevo"; return; }
    const { error } = await sb.from("comentarios").delete().eq("id", b.dataset.id);
    if (error) toast(errTxt(error)); else { toast("Comentario borrado"); cargarExtrasLocal(id); }
  });
  caja.querySelectorAll(".x-borrar-arch").forEach(b => b.onclick = async () => {
    if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Borrar? Tocá de nuevo"; return; }
    const r1 = await sb.storage.from("archivos").remove([b.dataset.ruta]);
    const r2 = await sb.from("archivos").delete().eq("id", b.dataset.id);
    if (r1.error || r2.error) toast(errTxt(r1.error || r2.error)); else { toast("Archivo borrado"); cargarExtrasLocal(id); }
  });
  $("#x-file").onchange = async e => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
    const tipo = $("#x-tipo").value; let hechos = 0;
    for (const f of files) {
      $("#x-prog").textContent = `Subiendo ${hechos + 1} de ${files.length}…`;
      try {
        const { blob, ext, mime } = await prepararArchivo(f);
        if (blob.size > 15 * 1048576) throw new Error(`${f.name} pesa más de 15 MB`);
        const ruta = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${f.name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[^\w-]+/g, "_").slice(0, 60)}.${ext}`;
        const up = await sb.storage.from("archivos").upload(ruta, blob, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        const ins = await sb.from("archivos").insert({ local_id: id, tipo, nombre: f.name, ruta, bytes: blob.size });
        if (ins.error) { await sb.storage.from("archivos").remove([ruta]); throw ins.error; }
        hechos++;
      } catch (err) { toast(`No se pudo subir ${f.name}: ${errTxt(err)}`); }
    }
    $("#x-prog").textContent = ""; if (hechos) { toast(hechos > 1 ? `${hechos} archivos subidos` : "Archivo subido"); await sb.rpc("registrar", { p_texto: `Local ${S.locales[id]?.codigo || id}: se ${hechos > 1 ? "subieron " + hechos + " archivos" : "subió 1 archivo"} (${TIPOS_ARCH[tipo]})`, p_local: id }); cargarExtrasLocal(id); }
  };
}
/* Las fotos se achican a 2000 px antes de subirlas (ahorra espacio y se ven igual de bien) */
async function prepararArchivo(f){
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return { blob: f, ext: "pdf", mime: "application/pdf" };
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return { blob: f, ext: (f.name.split(".").pop() || "jpg").toLowerCase(), mime: f.type || "image/jpeg" };
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (k === 1 && f.size < 900000) return { blob: f, ext: f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg", mime: f.type };
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? { blob, ext: "jpg", mime: "image/jpeg" } : { blob: f, ext: "jpg", mime: f.type };
  } catch (e) { return { blob: f, ext: (f.name.split(".").pop() || "jpg").toLowerCase(), mime: f.type || "image/jpeg" }; }
}

/* ---------- mis datos y equipo ---------- */
function misDatos(msg){
  const p = S.perfil || { nombre: "", telefono: "", email: "" };
  const adm = esAdmin();
  const eq = S.equipo || [];
  const pend = eq.filter(x => !x.activo);
  abrirDrawer(`<div class="cab"><div><h3>Mis datos</h3><div class="muted">Salen en los presupuestos y reservas que hagas</div></div><button id="d-x">Cerrar</button></div>
   ${msg ? `<p class="aviso" style="color:var(--res)">${esc(msg)}</p>` : ""}
   <label for="m-nom">Nombre y apellido</label><input id="m-nom" value="${esc(p.nombre)}" autocomplete="name">
   <label for="m-tel">Teléfono / WhatsApp</label><input id="m-tel" type="tel" inputmode="tel" autocomplete="tel" value="${esc(p.telefono)}" placeholder="Ej: 11 5555-5555">
   <label for="m-mail">Email (con el que entrás)</label><input id="m-mail" value="${esc(p.email)}" disabled>
   <div class="pie"><button class="prim" id="m-ok">Guardar mis datos</button></div>
   <h4 style="margin:22px 0 6px">Equipo ${adm && pend.length ? `<span class="pill p-reservado">${pend.length} pendiente${pend.length > 1 ? "s" : ""}</span>` : ""}</h4>
   ${adm ? `<div class="muted" style="font-size:12px;margin-bottom:6px">Cada persona crea su cuenta desde la pantalla de entrada (“Crear cuenta”). Acá la habilitás.</div>` : ""}
   ${eq.filter(x => adm || x.activo).map(x => `<div class="eq">
      <div><b>${esc(x.nombre || x.email)}</b>${x.rol === "admin" ? ` <span class="pill p-aceptado">Admin</span>` : ""}${x.activo ? "" : ` <span class="pill p-reservado">Pendiente</span>`}
      <div class="muted">${esc([x.telefono, x.email].filter(Boolean).join(" · "))}</div></div>
      ${adm && x.id !== S.uid ? `<div class="acc">${x.activo ? `<button data-eq="desactivar" data-id="${esc(x.id)}">Deshabilitar</button>` : `<button class="prim" data-eq="activar" data-id="${esc(x.id)}">Habilitar</button>`}${x.activo ? (x.rol === "admin" ? `<button data-eq="agente" data-id="${esc(x.id)}">Quitar admin</button>` : `<button data-eq="admin" data-id="${esc(x.id)}">Hacer admin</button>`) : ""}</div>` : ""}
    </div>`).join("")}`);
  $("#d-x").onclick = cerrarDrawer;
  $("#m-ok").onclick = async e => {
    const nombre = $("#m-nom").value.trim(); if (!nombre) { toast("Poné tu nombre"); return; }
    const r = await guardar("guardarPerfil", [{ nombre, telefono: $("#m-tel").value.trim() }], "Tus datos quedaron guardados", e.target);
    if (r && r.perfil) { S.perfil = r.perfil; pintarYo(); cerrarDrawer(); }
  };
  $("#drawer").querySelectorAll("[data-eq]").forEach(b => b.onclick = async () => {
    const campos = { activar: { activo: true }, desactivar: { activo: false }, admin: { rol: "admin" }, agente: { rol: "agente" } }[b.dataset.eq];
    if (await guardar("cambiarPerfil", [b.dataset.id, campos], "Equipo actualizado", b)) misDatos();
  });
}
function pintarYo(){ const n = (S.perfil && (S.perfil.nombre || S.perfil.email)) || ""; const pend = esAdmin() ? (S.equipo || []).filter(x => !x.activo).length : 0; $("#yo").textContent = (n ? n.split(" ")[0] + " · " : "") + "Mis datos" + (pend ? ` (${pend})` : ""); }
$("#yo").onclick = () => misDatos();

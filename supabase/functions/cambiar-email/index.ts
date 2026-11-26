import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Quién llama (con su propio token)
  const auth = req.headers.get("Authorization") ?? "";
  const yo = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: eu } = await yo.auth.getUser();
  if (eu || !u?.user) return json({ error: "Sesión no válida" }, 401);

  // 2) Tiene que ser administrador activo
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: perfil } = await admin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
  if (!perfil || perfil.rol !== "admin" || !perfil.activo) return json({ error: "Solo un administrador puede cambiar emails" }, 403);

  // 3) Datos
  let body: { id?: string; email?: string };
  try { body = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
  const id = String(body.id ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!id) return json({ error: "Falta la persona" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Ese email no es válido" }, 400);
  if (id === u.user.id) return json({ error: "Para tu propio email usá Mis datos" }, 400);

  // 4) Cambio en Auth (confirmado por el admin) y copia en perfiles
  const { error: ea } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
  if (ea) return json({ error: ea.message }, 400);
  const { error: ep } = await admin.from("perfiles").update({ email }).eq("id", id);
  if (ep) return json({ error: ep.message }, 400);

  return json({ ok: true, email });
});

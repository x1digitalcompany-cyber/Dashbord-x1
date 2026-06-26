/**
 * Cria ou redefine senha de um usuário do Dashboard X1.
 *
 * Uso:
 *   npm run create-user -- admin@dashboardx1.com MinhaSenha123 "Admin"
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("Arquivo .env.local não encontrado.");
    process.exit(1);
  }
  const env = readFileSync(path, "utf8");
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.+)$`, "m"));
    return m?.[1]?.replace(/^"|"$/g, "") ?? "";
  };
  return {
    url: get("DASHBOARD_SUPABASE_URL"),
    key: get("DASHBOARD_SUPABASE_SERVICE_ROLE_KEY"),
  };
}

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
const name = process.argv[4] ?? "Admin";

if (!email || !password) {
  console.error("Uso: npm run create-user -- <email> <senha> [nome]");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Use uma senha com pelo menos 8 caracteres.");
  process.exit(1);
}

const { url, key } = loadEnv();
if (!url || !key) {
  console.error("Configure DASHBOARD_SUPABASE_URL e DASHBOARD_SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const password_hash = await bcrypt.hash(password, 10);

const { data: existing } = await supabase
  .from("users")
  .select("id")
  .eq("email", email)
  .maybeSingle();

let error;
if (existing?.id) {
  ({ error } = await supabase
    .from("users")
    .update({ password_hash, name, is_active: true, updated_at: new Date().toISOString() })
    .eq("id", existing.id));
  if (!error) console.log(`Senha atualizada para ${email}`);
} else {
  ({ error } = await supabase.from("users").insert({
    email,
    name,
    password_hash,
    role: "admin",
    is_active: true,
  }));
  if (!error) console.log(`Usuário criado: ${email}`);
}

if (error) {
  console.error("Erro:", error.message);
  process.exit(1);
}

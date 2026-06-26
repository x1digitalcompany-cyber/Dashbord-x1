import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local não encontrado");
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
const get = (k) => {
  const m = raw.match(new RegExp(`^${k}=(.+)$`, "m"));
  return m?.[1]?.replace(/^"|"$/g, "") ?? "";
};

const PROD_URL = "https://dashbord-x1.vercel.app";
const PROD_SECRET = process.env.NEXTAUTH_SECRET_PROD ?? get("NEXTAUTH_SECRET") ?? "";

const vars = [
  { key: "DASHBOARD_SUPABASE_URL", value: get("DASHBOARD_SUPABASE_URL"), envs: ["production", "preview", "development"] },
  { key: "DASHBOARD_SUPABASE_SERVICE_ROLE_KEY", value: get("DASHBOARD_SUPABASE_SERVICE_ROLE_KEY"), envs: ["production", "preview", "development"] },
  { key: "NEXTAUTH_SECRET", value: PROD_SECRET, envs: ["production", "preview", "development"] },
  { key: "NEXTAUTH_URL", value: PROD_URL, envs: ["production", "preview"] },
  { key: "NEXTAUTH_URL", value: "http://localhost:3001", envs: ["development"] },
  { key: "FIVE_WEBHOOK_SECRET_ANTECIPADO", value: get("FIVE_WEBHOOK_SECRET_ANTECIPADO"), envs: ["production", "preview", "development"] },
  { key: "FIVE_WEBHOOK_SECRET_AGENDADO", value: get("FIVE_WEBHOOK_SECRET_AGENDADO"), envs: ["production", "preview", "development"] },
  { key: "USD_BRL_FALLBACK_RATE", value: get("USD_BRL_FALLBACK_RATE") || "5.4", envs: ["production", "preview", "development"] },
];

function addEnv(key, value, env) {
  if (!value) {
    console.warn(`SKIP ${key} (${env}): valor vazio`);
    return;
  }
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", key, env, "--force"],
    { input: value, stdio: ["pipe", "inherit", "inherit"], shell: true }
  );
  if (r.status !== 0) {
    console.error(`Falha: ${key} -> ${env}`);
    process.exit(r.status ?? 1);
  }
  console.log(`OK ${key} -> ${env}`);
}

for (const { key, value, envs } of vars) {
  for (const env of envs) {
    addEnv(key, value, env);
  }
}

console.log("\nVariáveis configuradas. Rode: npx vercel env ls");

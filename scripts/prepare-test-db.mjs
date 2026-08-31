#!/usr/bin/env node
/**
 * Prepara o banco usado pelos testes de integração de `apps/api`
 * (ver apps/api/tests/README.md): garante Postgres de pé, migrations aplicadas
 * e o mercado do seed presente.
 *
 * Roda como `pretest` para que `npm test` seja reproduzível em qualquer
 * máquina sem passo manual. É idempotente: rodar de novo não recria nada.
 * Se o Postgres não estiver acessível e o Docker não estiver disponível, o
 * script falha com uma mensagem explicando o que fazer, em vez de deixar a
 * suíte quebrar com erro de conexão.
 */
import { execFileSync } from "node:child_process";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { TEST_DATABASE_URL } from "./test-database-url.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = join(RAIZ, "apps", "api", "prisma", "schema.prisma");
const SEED = join(RAIZ, "apps", "api", "prisma", "seed.mjs");

const DATABASE_URL = TEST_DATABASE_URL;

const url = new URL(DATABASE_URL);
const host = url.hostname;
const porta = Number(url.port || 5432);
const ambiente = { ...process.env, DATABASE_URL };

async function portaAberta(host, porta, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = connect({ host, port: porta });
    const encerrar = (resultado) => {
      socket.destroy();
      resolve(resultado);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => encerrar(true));
    socket.once("timeout", () => encerrar(false));
    socket.once("error", () => encerrar(false));
  });
}

function rodar(comando, argumentos) {
  execFileSync(comando, argumentos, { cwd: RAIZ, env: ambiente, stdio: "inherit" });
}

function dockerDisponivel() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function aguardarPostgres() {
  if (await portaAberta(host, porta)) return;

  const ehLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!ehLocal || !dockerDisponivel()) {
    throw new Error(
      `Postgres não está acessível em ${host}:${porta}.\n` +
        "Suba um Postgres de teste e exporte DATABASE_URL, ou rode `npm run db:up` " +
        "(precisa de Docker). Detalhes em apps/api/tests/README.md.",
    );
  }

  console.log(`[test-db] Postgres não respondeu em ${host}:${porta}; subindo via docker compose`);
  rodar("docker", ["compose", "up", "-d", "db"]);

  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    if (await portaAberta(host, porta)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Postgres não ficou disponível em ${host}:${porta} após 60s.`);
}

await aguardarPostgres();

console.log(`[test-db] usando ${url.pathname.slice(1)} em ${host}:${porta}`);
rodar("npx", ["--no-install", "prisma", "generate", "--schema", SCHEMA]);
rodar("npx", ["--no-install", "prisma", "migrate", "deploy", "--schema", SCHEMA]);
rodar(process.execPath, [SEED]);

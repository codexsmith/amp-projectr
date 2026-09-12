import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
});

if (build.status !== 0) process.exit(build.status ?? 1);

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/_next", { recursive: true });
copyFileSync(".next/server/app/index.html", "dist/index.html");
cpSync(".next/static", "dist/_next/static", { recursive: true });

if (existsSync("public")) cpSync("public", "dist", { recursive: true });
if (existsSync("app/favicon.ico")) copyFileSync("app/favicon.ico", "dist/favicon.ico");

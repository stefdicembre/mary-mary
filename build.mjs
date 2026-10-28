// Builds Mary Mary into the "dist" folder, ready for GitHub Pages.
//   npm run build        → make dist/
//   npm run dev          → build and preview at http://localhost:5173
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const serve = process.argv.includes("--serve");
const out = "dist";

let sha = "local";
try {
  sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {}
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const version = `${stamp}-${sha}`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Copy everything in public/, filling in the version where it's marked.
function copyPublic(from, to) {
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dest = join(to, name);
    if (statSync(src).isDirectory()) {
      mkdirSync(dest, { recursive: true });
      copyPublic(src, dest);
    } else if (/\.(html|js|webmanifest)$/.test(name)) {
      writeFileSync(dest, readFileSync(src, "utf8").replaceAll("__VERSION__", version));
    } else {
      cpSync(src, dest);
    }
  }
}
copyPublic("public", out);

const options = {
  entryPoints: { app: "src/main.tsx" },
  bundle: true,
  outdir: out,
  format: "iife",
  target: ["safari15", "chrome100"],
  jsx: "automatic",
  minify: !serve,
  sourcemap: serve,
  define: {
    "process.env.NODE_ENV": JSON.stringify(serve ? "development" : "production"),
    __APP_VERSION__: JSON.stringify(version),
  },
  logLevel: "info",
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173 });
  console.log(`\nMary Mary preview: http://localhost:${port}\n`);
} else {
  await esbuild.build(options);
  console.log(`Built Mary Mary ${version} into ${out}/`);
}

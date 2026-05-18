import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function copyStaticRuntimeFiles() {
  return {
    name: "copy-static-runtime-files",
    closeBundle() {
      const root = process.cwd();
      const dist = resolve(root, "dist");
      mkdirSync(dist, { recursive: true });

      for (const dir of ["js", "css"]) {
        const from = resolve(root, dir);
        if (existsSync(from)) {
          cpSync(from, resolve(dist, dir), { recursive: true });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [copyStaticRuntimeFiles()],
});

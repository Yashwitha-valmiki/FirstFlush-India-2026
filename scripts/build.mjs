import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const validation = spawnSync(
  process.execPath,
  ["scripts/validate.mjs"],
  {
    stdio: "inherit"
  }
);

if (validation.status !== 0) {
  process.exit(validation.status || 1);
}

fs.rmSync("dist", {
  recursive: true,
  force: true
});

fs.mkdirSync("dist", {
  recursive: true
});

fs.cpSync(
  "public",
  path.join("dist", "public"),
  {
    recursive: true
  }
);

fs.cpSync(
  "data",
  path.join("dist", "data"),
  {
    recursive: true
  }
);

fs.copyFileSync(
  "server.js",
  path.join("dist", "server.js")
);

fs.copyFileSync(
  "package.json",
  path.join("dist", "package.json")
);

console.log("Build completed successfully.");

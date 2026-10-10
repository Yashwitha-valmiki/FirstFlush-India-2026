import fs from "node:fs";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "package.json",
  "server.js",
  "README.md",
  ".env.example",
  ".gitignore",
  "public/index.html",
  "public/app.js",
  "public/styles.css",
  "data/locations.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    console.error(`Missing or empty required file: ${file}`);
    process.exit(1);
  }
}

for (const file of ["server.js", "public/app.js"]) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
}

try {
  JSON.parse(fs.readFileSync("package.json", "utf8"));
  JSON.parse(fs.readFileSync("data/locations.json", "utf8"));
} catch (error) {
  console.error(`Invalid JSON: ${error.message}`);
  process.exit(1);
}

console.log("Validation passed.");

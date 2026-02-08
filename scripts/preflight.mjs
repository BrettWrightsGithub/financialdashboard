import { readFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function fail(message) {
  console.error(`preflight: ${message}`);
  process.exit(1);
}

function parseJsonFile(filePath) {
  const source = readFileSync(filePath, "utf8");
  try {
    JSON.parse(source);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    fail(`invalid JSON in ${filePath}: ${details}`);
  }
}

function checkPackageJson() {
  const candidates = [
    resolve(root, "package.json"),
    resolve(root, "..", "package.json"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }
    parseJsonFile(filePath);
    console.log(`preflight: parsed ${basename(filePath)}`);
  }
}

function checkMergeMarkers() {
  const grep = spawnSync(
    "git",
    ["grep", "-nI", "-E", "^(<<<<<<< |=======|>>>>>>> )", "--", "."],
    { cwd: root, encoding: "utf8" }
  );

  if (grep.status === 0) {
    fail(`merge conflict markers found:\n${grep.stdout.trim()}`);
  }

  if (grep.status !== 1) {
    const stderr = grep.stderr?.trim() || "unknown git grep error";
    fail(`unable to scan for merge markers: ${stderr}`);
  }

  console.log("preflight: no merge conflict markers detected");
}

checkPackageJson();
checkMergeMarkers();
console.log("preflight: OK");

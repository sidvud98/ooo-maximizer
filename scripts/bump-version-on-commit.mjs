import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const EXCLUDED_PATHS = new Set(["package.json", "package-lock.json"]);
const EXCLUDED_PREFIXES = ["dist/", "node_modules/"];

function isExcluded(filePath) {
  if (EXCLUDED_PATHS.has(filePath)) return true;
  return EXCLUDED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function countStagedLines() {
  const output = execSync("git diff --cached --numstat", {
    encoding: "utf8",
  }).trim();

  if (!output) return 0;

  let total = 0;
  for (const line of output.split("\n")) {
    const [added, deleted, filePath] = line.split("\t");
    if (!filePath || added === "-" || deleted === "-") continue;
    if (isExcluded(filePath)) continue;
    total += Number(added) + Number(deleted);
  }
  return total;
}

function hasAnyStagedChanges() {
  const output = execSync("git diff --cached --name-only", {
    encoding: "utf8",
  }).trim();
  return output.length > 0;
}

function bumpKind(lineCount) {
  if (lineCount >= 500) return "major";
  if (lineCount >= 50) return "minor";
  return "patch";
}

function bumpVersion(current, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    throw new Error(`Invalid semver in package.json: ${current}`);
  }

  let [major, minor, patch] = match.slice(1).map(Number);
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function updatePackageLockVersion(nextVersion) {
  const lockPath = "package-lock.json";
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.version = nextVersion;
  if (lock.packages?.[""]) {
    lock.packages[""].version = nextVersion;
  }
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

if (!hasAnyStagedChanges()) {
  process.exit(0);
}

const lineCount = countStagedLines();
const kind = bumpKind(lineCount);
const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const previous = pkg.version;
const next = bumpVersion(previous, kind);

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
updatePackageLockVersion(next);

execSync("git add package.json package-lock.json", { stdio: "inherit" });

console.log(
  `Bumped version: ${previous} → ${next} (${kind}, ${lineCount} lines)`,
);

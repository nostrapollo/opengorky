import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/client/", import.meta.url));
const basePath = process.argv[2] ?? process.env.PAGES_BASE_PATH ?? "/opengorky";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".rsc"]);

if (basePath && (!basePath.startsWith("/") || basePath.endsWith("/"))) {
  throw new Error("The Pages base path must start with / and must not end with /.");
}

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    return textExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

for (const file of await textFiles(outputDirectory)) {
  const original = await readFile(file, "utf8");
  const packaged = original
    .replaceAll("/_next/", `${basePath}/_next/`)
    .replaceAll('href="/"', `href="${basePath}/"`)
    .replaceAll('\\"href\\":\\"/\\"', `\\"href\\":\\"${basePath}/\\"`);
  if (packaged !== original) await writeFile(file, packaged);
}

const privacyDirectory = join(outputDirectory, "privacy");
await mkdir(privacyDirectory, { recursive: true });
await copyFile(join(outputDirectory, "privacy.html"), join(privacyDirectory, "index.html"));

console.log(`Prepared static site for ${basePath || "/"}`);

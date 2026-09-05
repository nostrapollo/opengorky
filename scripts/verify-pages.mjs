import { access, readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/client/", import.meta.url));
const requiredFiles = ["index.html", "404.html", "privacy/index.html"];
const analyticsToken = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();

for (const file of requiredFiles) {
  await access(join(outputDirectory, file));
}

if (analyticsToken) {
  for (const file of requiredFiles) {
    const html = await readFile(join(outputDirectory, file), "utf8");
    if (!html.includes("https://static.cloudflareinsights.com/beacon.min.js")) {
      throw new Error(`Cloudflare Web Analytics beacon is missing from ${file}.`);
    }
    if (!html.includes(analyticsToken)) {
      throw new Error(`Cloudflare Web Analytics token is missing from ${file}.`);
    }
  }
}

async function filesWithExtension(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesWithExtension(path, extension);
    return extname(entry.name) === extension ? [path] : [];
  }));
  return nested.flat();
}

const icons = await filesWithExtension(join(outputDirectory, "gcp-icons"), ".svg");
if (icons.length !== 34) {
  throw new Error(`Expected 34 packaged Google Cloud icons, found ${icons.length}.`);
}

const scripts = await filesWithExtension(join(outputDirectory, "_next", "static", "chunks"), ".js");
const javascript = (await Promise.all(scripts.map((file) => readFile(file, "utf8")))).join("\n");
if (!javascript.includes("gcp-icons/")) {
  throw new Error("The packaged app does not reference Google Cloud icon assets.");
}
if (javascript.includes('`/gcp-icons/') || javascript.includes('"/gcp-icons/') || javascript.includes("'/gcp-icons/")) {
  throw new Error("The packaged app contains a domain-root Google Cloud icon URL.");
}

console.log(`Verified Pages output with ${icons.length} deployable Google Cloud icons.`);

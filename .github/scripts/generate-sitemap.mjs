import fs from "node:fs/promises";

const CONFIG_PATH = "dashboard/supabase-config.js";
const SITEMAP_PATH = "sitemap.xml";
const SITE_URL = "https://visualtechstudio.xyz";

const configSource = await fs.readFile(CONFIG_PATH, "utf8");
const urlMatch = configSource.match(/url:\s*"([^"]+)"/);
const keyMatch = configSource.match(/publishableKey:\s*"([^"]+)"/);

if (!urlMatch || !keyMatch) {
  throw new Error("Could not read Supabase configuration from dashboard/supabase-config.js");
}

const supabaseUrl = urlMatch[1];
const publishableKey = keyMatch[1];

const endpoint = new URL("/rest/v1/products", supabaseUrl);
endpoint.searchParams.set("select", "slug");
endpoint.searchParams.set("status", "eq.published");
endpoint.searchParams.set("order", "created_at.desc");

const response = await fetch(endpoint, {
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`
  }
});

if (!response.ok) {
  throw new Error(`Supabase products request failed: ${response.status} ${await response.text()}`);
}

const products = await response.json();

if (!Array.isArray(products)) {
  throw new Error("Supabase products response was not an array");
}

const urls = [
  "/",
  "/services/",
  "/studio/",
  "/work/",
  "/resources/",
  "/store/",
  "/contact/",
  ...products
    .map(product => product?.slug)
    .filter(Boolean)
    .map(slug => `/store/${encodeURIComponent(slug)}/`)
];

const uniqueUrls = [...new Set(urls)];

const xmlEscape = value =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...uniqueUrls.map(path => `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${path}`)}</loc>\n  </url>`),
  "</urlset>",
  ""
].join("\n");

await fs.writeFile(SITEMAP_PATH, sitemap, "utf8");
console.log(`Generated ${SITEMAP_PATH} with ${uniqueUrls.length} URLs (${products.length} published products).`);

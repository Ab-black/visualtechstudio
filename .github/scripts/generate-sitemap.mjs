import fs from "node:fs/promises";

const CONFIG_PATH = "dashboard/supabase-config.js";
const SITEMAP_PATH = "sitemap.xml";
const TEMPLATE_PATH = ".github/scripts/product-page-template.html";
const STORE_PATH = "store";
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

const template = await fs.readFile(TEMPLATE_PATH, "utf8");

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

const htmlEscape = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const productDescription = product =>
  String(product.description || `${product.title || "Digital product"} from Visual Tech Studio.`)
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 160);

const productImage = product => {
  if (!product.cover_path) return `${SITE_URL}/images/logo.jpg`;
  if (/^https?:\\/\\//i.test(product.cover_path)) return product.cover_path;
  if (product.cover_path.startsWith("images/")) return `${SITE_URL}/${product.cover_path}`;
  return `${supabaseUrl}/storage/v1/object/public/public-assets/${product.cover_path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
};

const publishedSlugs = new Set(products.map(product => product.slug).filter(Boolean));

const storeEntries = await fs.readdir(STORE_PATH, { withFileTypes: true });
for (const entry of storeEntries) {
  if (!entry.isDirectory()) continue;
  const pagePath = `${STORE_PATH}/${entry.name}/index.html`;
  try {
    const existing = await fs.readFile(pagePath, "utf8");
    if (existing.includes("data-product-page")) {
      const currentSlug = entry.name;
      if (!publishedSlugs.has(currentSlug)) {
        await fs.rm(`${STORE_PATH}/${entry.name}`, { recursive: true, force: true });
        console.log(`Removed stale product page: ${currentSlug}`);
      }
    }
  } catch {
    // Ignore non-product directories and directories without an index.html.
  }
}

for (const product of products) {
  if (!product.slug) continue;

  const slug = product.slug;
  const productUrl = `${SITE_URL}/store/${encodeURIComponent(slug)}/`;
  const description = productDescription(product);
  const image = productImage(product);

  const page = template
    .replaceAll("__PRODUCT_SLUG__", htmlEscape(slug))
    .replaceAll("__PRODUCT_TITLE__", htmlEscape(product.title || "Digital Product"))
    .replaceAll("__PRODUCT_DESCRIPTION__", htmlEscape(description))
    .replaceAll("__PRODUCT_URL__", htmlEscape(productUrl))
    .replaceAll("__PRODUCT_IMAGE__", htmlEscape(image));

  const directory = `${STORE_PATH}/${slug}`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(`${directory}/index.html`, page, "utf8");
  console.log(`Generated product page: ${productUrl}`);
}

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

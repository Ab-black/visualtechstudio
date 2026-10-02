(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const page = document.querySelector("[data-product-page]");
    if (!config?.url || !config?.publishableKey || !page) return;

    const slug = page.dataset.productSlug;

    const titleEl = document.getElementById("product-title");
    const descriptionEl = document.getElementById("product-description");
    const priceEl = document.getElementById("product-price");
    const formatEl = document.getElementById("product-format");
    const coverEl = document.getElementById("product-cover");
    const statusEl = document.getElementById("product-status");
    const buyButton = document.getElementById("buy-button");
    const productContent = document.getElementById("product-content");

    const money = (value, currency = "NGN") => {
        try {
            return new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency,
                maximumFractionDigits: 0
            }).format(Number(value || 0));
        } catch {
            return `${currency} ${Number(value || 0).toLocaleString()}`;
        }
    };

    const coverUrl = path => {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith("images/")) return `../../../${path}`;
        return `${config.url}/storage/v1/object/public/public-assets/${path.split("/").map(encodeURIComponent).join("/")}`;
    };

    const showMessage = message => {
        if (productContent) productContent.hidden = true;
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.hidden = false;
        }
    };

    const renderProduct = product => {
        document.title = `${product.title} | Visual Tech Studio`;
        titleEl.textContent = product.title || "Digital Product";
        descriptionEl.textContent = product.description || "No description available.";
        priceEl.textContent = money(product.price, product.currency || "NGN");
        formatEl.textContent = product.format || "DIGITAL PRODUCT";

        if (product.cover_path && coverEl) {
            coverEl.src = coverUrl(product.cover_path);
            coverEl.alt = `${product.title} cover`;
            coverEl.hidden = false;
        }

        buyButton.addEventListener("click", () => {
            window.location.href = `../../../checkout/?product=${encodeURIComponent(product.id)}`;
        });

        productContent.hidden = false;
        statusEl.hidden = true;
    };

    const load = async () => {
        let client;

        if (window.VISUAL_TECH_AUTH_READY) {
            try {
                client = await window.VISUAL_TECH_AUTH_READY;
            } catch {
                client = null;
            }
        }

        if (!client) {
            const supabase = window.supabase || await new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-supabase-client="true"]');
                if (existing) {
                    existing.addEventListener("load", () => resolve(window.supabase), { once: true });
                    existing.addEventListener("error", reject, { once: true });
                    return;
                }
                const script = document.createElement("script");
                script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
                script.dataset.supabaseClient = "true";
                script.onload = () => resolve(window.supabase);
                script.onerror = reject;
                document.head.appendChild(script);
            });
            client = supabase.createClient(config.url, config.publishableKey);
        }

        const { data, error } = await client
            .from("products")
            .select("id,title,description,price,currency,format,resource_count,cover_path,slug,status")
            .eq("slug", slug)
            .eq("status", "published")
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            showMessage("This product is currently unavailable.");
            return;
        }

        renderProduct(data);
    };

    load().catch(error => {
        console.error("Visual Tech Studio product page failed to load:", error);
        showMessage("Unable to load this product right now.");
    });
})();

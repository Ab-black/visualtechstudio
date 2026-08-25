(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    let client;
    let products = [];

    const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const slugify = (value = "") => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const money = (value, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));

    const loadClient = () => new Promise((resolve, reject) => {
        if (window.supabase) return resolve(window.supabase.createClient(config.url, config.publishableKey));
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey));
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const render = () => {
        const list = document.querySelector("#product-list");
        list.innerHTML = products.map((product) => `<article class="panel" style="display:grid;gap:12px"><div style="display:flex;justify-content:space-between;gap:16px"><div><p class="eyebrow">${escapeHtml(product.format || "DIGITAL PRODUCT")}</p><h3>${escapeHtml(product.title)}</h3><p>${escapeHtml(product.description || "No description")}</p></div><span class="status status-${product.status === "published" ? "green" : product.status === "draft" ? "gray" : "amber"}">${escapeHtml(product.status)}</span></div><strong>${money(product.price, product.currency)}</strong><div style="display:flex;gap:8px"><button class="row-action" data-action="edit" data-id="${product.id}">Edit</button><button class="row-action danger" data-action="delete" data-id="${product.id}">Delete</button></div></article>`).join("") || '<div class="panel">No products yet. Add your first product.</div>';
    };

    const reset = () => {
        document.querySelector("#product-form").reset();
        document.querySelector("#product-id").value = "";
        document.querySelector("#editor-title").textContent = "Add Product";
        document.querySelector("#product-message").textContent = "";
    };

    const fill = (product) => {
        const form = document.querySelector("#product-form");
        document.querySelector("#product-id").value = product.id;
        form.title.value = product.title || "";
        form.slug.value = product.slug || "";
        form.price.value = product.price ?? "";
        form.currency.value = product.currency || "NGN";
        form.format.value = product.format || "";
        form.resource_count.value = product.resource_count ?? "";
        form.status.value = product.status || "draft";
        form.cover_path.value = product.cover_path || "";
        form.description.value = product.description || "";
        document.querySelector("#editor-title").textContent = "Edit Product";
        document.querySelector("#product-editor").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const load = async () => {
        const { data, error } = await client.from("products").select("id,title,slug,description,price,currency,format,resource_count,cover_path,status,created_at,updated_at").order("created_at", { ascending: false });
        if (error) throw error;
        products = data || [];
        render();
    };

    const save = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const id = document.querySelector("#product-id").value;
        const status = event.submitter?.dataset.status || form.status.value || "draft";
        const title = form.title.value.trim();
        if (!title) return;
        const payload = {
            title,
            slug: form.slug.value.trim() || slugify(title),
            description: form.description.value.trim() || null,
            price: Number(form.price.value || 0),
            currency: form.currency.value.trim() || "NGN",
            format: form.format.value.trim() || null,
            resource_count: form.resource_count.value ? Number(form.resource_count.value) : null,
            cover_path: form.cover_path.value.trim() || null,
            status,
            updated_at: new Date().toISOString()
        };
        const message = document.querySelector("#product-message");
        message.textContent = id ? "Saving changes…" : "Creating product…";
        const query = id ? client.from("products").update(payload).eq("id", id) : client.from("products").insert(payload);
        const { error } = await query;
        if (error) { message.textContent = error.message; return; }
        message.textContent = status === "published" ? "Product published." : "Draft saved.";
        await load();
        if (!id) reset();
    };

    const actions = async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const product = products.find((item) => item.id === button.dataset.id);
        if (!product) return;
        if (button.dataset.action === "edit") fill(product);
        if (button.dataset.action === "delete") {
            if (!window.confirm(`Delete “${product.title}” permanently?`)) return;
            const { error } = await client.from("products").delete().eq("id", product.id);
            if (error) return window.alert(error.message);
            await load();
        }
    };

    window.addEventListener("DOMContentLoaded", async () => {
        if (!config?.url || !config?.publishableKey) return;
        try {
            client = await loadClient();
            document.querySelector("#product-form")?.addEventListener("submit", save);
            document.querySelector("#product-list")?.addEventListener("click", actions);
            document.querySelector("#clear-product")?.addEventListener("click", reset);
            document.querySelector("#new-product")?.addEventListener("click", reset);
            await load();
        } catch (error) {
            document.querySelector("#product-list").innerHTML = `<div class="panel">Unable to load products: ${escapeHtml(error.message)}</div>`;
        }
    });
})();

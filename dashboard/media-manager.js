(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    let supabaseClient = null;
    let products = [];

    const escapeHtml = (value = "") => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const money = (value, currency = "NGN") => {
        try {
            return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
        } catch {
            return `${currency} ${Number(value || 0).toLocaleString()}`;
        }
    };

    const waitForClient = () => new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
            if (window.VISUAL_TECH_SUPABASE_CLIENT) return resolve(window.VISUAL_TECH_SUPABASE_CLIENT);
            if (Date.now() - started > 15000) return reject(new Error("Dashboard authentication is not ready. Refresh and sign in again."));
            window.setTimeout(check, 100);
        };
        check();
    });

    const ensureAdmin = async () => {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) throw new Error("Your dashboard session has expired. Please sign in again.");
        const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
        if (profileError || profile?.role !== "admin") throw new Error("Administrator access is required.");
    };

    const coverUrl = (product) => {
        if (!product.cover_path) return null;
        return `${config.url}/storage/v1/object/public/public-assets/${product.cover_path.split("/").map(encodeURIComponent).join("/")}`;
    };

    const renderProducts = () => {
        const list = document.querySelector("#asset-list");
        if (!list) return;
        const search = (document.querySelector("#media-search")?.value || "").trim().toLowerCase();
        const filter = document.querySelector("#media-filter")?.value || "all";
        const filtered = products.filter((product) => {
            const matchesSearch = !search || `${product.title} ${product.description || ""} ${product.format || ""}`.toLowerCase().includes(search);
            const matchesFilter = filter === "all" || product.status === filter;
            return matchesSearch && matchesFilter;
        });
        list.innerHTML = filtered.map((product) => {
            const cover = coverUrl(product);
            return `
                <article class="media-card" data-id="${product.id}">
                    <div class="media-preview">${cover ? `<img src="${cover}" alt="${escapeHtml(product.title)}" loading="lazy">` : `<div class="file-preview-generic"><strong>${escapeHtml(product.format || "PRODUCT")}</strong><span>No cover image</span></div>`}</div>
                    <div class="media-meta">
                        <strong title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</strong>
                        <span>${escapeHtml(product.format || "Digital product")} · ${money(product.price, product.currency)}</span>
                        <span>${product.product_file_path ? "Product file attached" : "No product file"}</span>
                        <span class="status status-${product.status === "published" ? "green" : product.status === "draft" ? "gray" : "amber"}">${escapeHtml(product.status || "draft")}</span>
                    </div>
                    <div class="media-actions">
                        <button class="row-action" type="button" data-action="edit" data-id="${product.id}">Edit</button>
                        ${product.status === "published" ? `<button class="row-action" type="button" data-action="unpublish" data-id="${product.id}">Unpublish</button>` : `<button class="row-action" type="button" data-action="publish" data-id="${product.id}">Publish</button>`}
                        <button class="row-action danger" type="button" data-action="delete" data-id="${product.id}">Delete</button>
                    </div>
                </article>
            `;
        }).join("") || '<div class="empty-state">No products match your search.</div>';
    };

    const loadProducts = async () => {
        const { data, error } = await supabaseClient.from("products")
            .select("id,title,slug,description,price,currency,format,resource_count,cover_path,status,product_file_bucket,product_file_path,purchase_count,like_count,created_at,updated_at")
            .order("created_at", { ascending: false });
        if (error) throw error;
        products = data || [];
        renderProducts();
    };

    const closeModal = () => document.querySelector("#media-product-modal")?.remove();

    const openEditModal = (product) => {
        closeModal();
        const modal = document.createElement("div");
        modal.id = "media-product-modal";
        modal.innerHTML = `
            <div class="media-modal-backdrop" data-close="true"></div>
            <section class="media-modal-card" role="dialog" aria-modal="true" aria-labelledby="media-modal-title">
                <div class="media-modal-header"><div><p class="eyebrow">MEDIA LIBRARY</p><h3 id="media-modal-title">Edit product</h3></div><button type="button" class="row-action" data-close="true">Close</button></div>
                <form id="media-edit-form" class="media-edit-form">
                    <label>Product title<input name="title" required value="${escapeHtml(product.title)}"></label>
                    <label>Price<input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(product.price ?? 0)}"></label>
                    <label>Format<select name="format"><option value="PDF" ${product.format === "PDF" ? "selected" : ""}>PDF</option><option value="ZIP" ${product.format === "ZIP" ? "selected" : ""}>ZIP</option><option value="Template" ${product.format === "Template" ? "selected" : ""}>Template</option><option value="Video" ${product.format === "Video" ? "selected" : ""}>Video</option></select></label>
                    <label>Status<select name="status"><option value="draft" ${product.status === "draft" ? "selected" : ""}>Draft</option><option value="published" ${product.status === "published" ? "selected" : ""}>Published</option><option value="archived" ${product.status === "archived" ? "selected" : ""}>Archived</option></select></label>
                    <label class="full">Description<textarea name="description" rows="5">${escapeHtml(product.description || "")}</textarea></label>
                    <label>Replace cover<input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
                    <label>Replace product file<input name="file" type="file" accept=".pdf,.zip,.mp4,.webm,.mov"></label>
                    <div id="media-edit-preview" class="asset-preview full"><span>Choose a replacement file to preview it here.</span></div>
                    <p id="media-edit-message" class="form-message full"></p>
                    <div class="form-actions full"><button type="button" class="button secondary" data-close="true">Cancel</button><button type="submit" class="button primary">Save changes</button></div>
                </form>
            </section>
        `;
        document.body.appendChild(modal);
        const form = modal.querySelector("#media-edit-form");
        const preview = modal.querySelector("#media-edit-preview");
        form.file.addEventListener("change", () => {
            const file = form.file.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            if (file.type.startsWith("video/")) preview.innerHTML = `<video controls preload="metadata" src="${url}" style="width:100%;max-height:360px"></video>`;
            else if (file.type === "application/pdf") preview.innerHTML = `<iframe title="Product PDF preview" src="${url}" style="width:100%;height:360px;border:0"></iframe>`;
            else preview.innerHTML = `<div class="file-preview-generic"><strong>${escapeHtml(file.name)}</strong><span>${file.type || "ZIP archive"}</span></div>`;
        });
        modal.addEventListener("click", (event) => {
            if (event.target.closest("[data-close='true']")) closeModal();
        });
        form.addEventListener("submit", (event) => saveEdits(event, product, modal));
        form.title.focus();
    };

    const saveEdits = async (event, product, modal) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = modal.querySelector("#media-edit-message");
        let newCoverPath = null;
        let newFilePath = null;
        try {
            await ensureAdmin();
            message.textContent = "Saving changes…";
            const payload = {
                title: form.title.value.trim(),
                description: form.description.value.trim() || null,
                price: Number(form.price.value || 0),
                format: form.format.value,
                status: form.status.value,
                updated_at: new Date().toISOString()
            };
            if (!payload.title) throw new Error("Product title is required.");

            const cover = form.cover.files[0];
            if (cover) {
                if (!cover.type.startsWith("image/")) throw new Error("The replacement cover must be an image.");
                if (cover.size > 250 * 1024 * 1024) throw new Error("The replacement cover is too large.");
                const safeName = cover.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
                newCoverPath = `product-covers/${product.id}-${crypto.randomUUID()}-${safeName}`;
                const { error } = await supabaseClient.storage.from("public-assets").upload(newCoverPath, cover, { cacheControl: "3600", upsert: false, contentType: cover.type });
                if (error) throw error;
                payload.cover_path = newCoverPath;
            }

            const file = form.file.files[0];
            if (file) {
                const allowed = ["application/pdf", "application/zip", "application/x-zip-compressed", "video/mp4", "video/webm", "video/quicktime"];
                if (!allowed.includes(file.type)) throw new Error("Product files must be PDF, ZIP, MP4, WebM, or MOV.");
                if (file.size > 250 * 1024 * 1024) throw new Error("The product file must be 250 MB or smaller.");
                const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
                newFilePath = `products/${product.id}/${crypto.randomUUID()}-${safeName}`;
                const { error } = await supabaseClient.storage.from("product-files").upload(newFilePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                if (error) throw error;
                payload.product_file_bucket = "product-files";
                payload.product_file_path = newFilePath;
            }

            const { error } = await supabaseClient.from("products").update(payload).eq("id", product.id);
            if (error) throw error;

            if (file) {
                const { error: fileRowError } = await supabaseClient.from("product_files").insert({ product_id: product.id, file_path: newFilePath, file_name: file.name, mime_type: file.type || "application/octet-stream", file_size: file.size, is_preview: false });
                if (fileRowError) throw fileRowError;
                if (product.product_file_path) {
                    await supabaseClient.storage.from(product.product_file_bucket || "product-files").remove([product.product_file_path]);
                    await supabaseClient.from("product_files").delete().eq("product_id", product.id).eq("file_path", product.product_file_path);
                }
            }
            if (cover && product.cover_path) await supabaseClient.storage.from("public-assets").remove([product.cover_path]);
            closeModal();
            await loadProducts();
        } catch (error) {
            if (newFilePath) await supabaseClient.storage.from("product-files").remove([newFilePath]);
            if (newCoverPath) await supabaseClient.storage.from("public-assets").remove([newCoverPath]);
            message.textContent = error.message;
        }
    };

    const changeStatus = async (product, status) => {
        await ensureAdmin();
        const { error } = await supabaseClient.from("products").update({ status, updated_at: new Date().toISOString() }).eq("id", product.id);
        if (error) throw error;
        await loadProducts();
    };

    const deleteProduct = async (product) => {
        await ensureAdmin();
        if (!window.confirm(`Delete “${product.title}” permanently? This removes the product and its stored files.`)) return;
        const { data: files, error: filesError } = await supabaseClient.from("product_files").select("file_path").eq("product_id", product.id);
        if (filesError) throw filesError;
        const paths = (files || []).map((file) => file.file_path).filter(Boolean);
        if (product.product_file_path && !paths.includes(product.product_file_path)) paths.push(product.product_file_path);
        if (paths.length) {
            const { error } = await supabaseClient.storage.from(product.product_file_bucket || "product-files").remove(paths);
            if (error) throw error;
        }
        if (product.cover_path) {
            const { error } = await supabaseClient.storage.from("public-assets").remove([product.cover_path]);
            if (error) throw error;
        }
        const { error: filesDeleteError } = await supabaseClient.from("product_files").delete().eq("product_id", product.id);
        if (filesDeleteError) throw filesDeleteError;
        const { error: productDeleteError } = await supabaseClient.from("products").delete().eq("id", product.id);
        if (productDeleteError) throw productDeleteError;
        await loadProducts();
    };

    const handleAction = async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const product = products.find((item) => item.id === button.dataset.id);
        if (!product) return;
        button.disabled = true;
        try {
            if (button.dataset.action === "edit") openEditModal(product);
            if (button.dataset.action === "unpublish") await changeStatus(product, "draft");
            if (button.dataset.action === "publish") await changeStatus(product, "published");
            if (button.dataset.action === "delete") await deleteProduct(product);
        } catch (error) {
            window.alert(error.message);
        } finally {
            button.disabled = false;
        }
    };

    window.addEventListener("DOMContentLoaded", async () => {
        const media = document.querySelector("#media");
        if (!media || !config?.url || !config?.publishableKey) return;
        try {
            supabaseClient = await waitForClient();
            await ensureAdmin();
            document.querySelector("#media-search")?.addEventListener("input", renderProducts);
            document.querySelector("#media-filter")?.addEventListener("change", renderProducts);
            document.querySelector("#asset-list")?.addEventListener("click", handleAction);
            await loadProducts();
        } catch (error) {
            const list = document.querySelector("#asset-list");
            if (list) list.innerHTML = `<div class="empty-state">Unable to load products: ${escapeHtml(error.message)}</div>`;
        }
    });
})();
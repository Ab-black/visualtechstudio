(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    let supabaseClient = null;
    let products = [];
    let projects = [];
    let mediaCategory = "all";
    let adminReady = false;

    const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const money = (value, currency = "NGN") => {
        try { return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
        catch { return `${currency} ${Number(value || 0).toLocaleString()}`; }
    };
    const statusLabel = (status) => ({ draft: "Draft", published: "Published", archived: "Archived" }[status] || status || "Draft");

    const waitForAdminReady = () => new Promise((resolve, reject) => {
        if (adminReady && window.VISUAL_TECH_SUPABASE_CLIENT) return resolve(window.VISUAL_TECH_SUPABASE_CLIENT);
        const timeout = window.setTimeout(() => reject(new Error("Dashboard authentication is not ready. Refresh the dashboard and try again.")), 20000);
        const onReady = () => {
            adminReady = true;
            window.clearTimeout(timeout);
            window.removeEventListener("visualtech:admin-ready", onReady);
            if (window.VISUAL_TECH_SUPABASE_CLIENT) resolve(window.VISUAL_TECH_SUPABASE_CLIENT);
            else reject(new Error("Supabase dashboard client is unavailable."));
        };
        window.addEventListener("visualtech:admin-ready", onReady, { once: true });
    });

    const ensureAdmin = async () => {
        if (!adminReady) await waitForAdminReady();
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) throw new Error("Your dashboard session has expired. Please sign in again.");
        const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
        if (profileError || profile?.role !== "admin") throw new Error("Administrator access is required.");
    };

    const coverUrl = (path) => path ? `${config.url}/storage/v1/object/public/public-assets/${String(path).split("/").map(encodeURIComponent).join("/")}` : null;

    const injectMediaStyles = () => {
        if (document.querySelector("#media-library-runtime-styles")) return;
        const style = document.createElement("style");
        style.id = "media-library-runtime-styles";
        style.textContent = `
            #media .media-upload-zone,#media .asset-upload-layout,#media #upload-media-button,#media #asset-file,#media .media-upload-panel { display:none !important; }
            #media .media-category-switch { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 0; }
            #media .media-category-switch button { border:1px solid var(--border); background:transparent; color:var(--text); border-radius:999px; padding:8px 13px; font:inherit; font-size:12px; cursor:pointer; }
            #media .media-category-switch button.active { background:var(--text); color:#fff; border-color:var(--text); }
            #media-product-modal { position:fixed; inset:0; z-index:100000; display:grid; place-items:center; padding:24px; }
            .media-modal-backdrop { position:absolute; inset:0; background:rgba(17,17,17,.58); backdrop-filter:blur(4px); }
            .media-modal-card { position:relative; width:min(800px,100%); max-height:min(90vh,900px); overflow:auto; background:#fff; border:1px solid var(--border); border-radius:14px; box-shadow:0 24px 80px rgba(0,0,0,.2); padding:24px; }
            .media-modal-header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; padding-bottom:18px; margin-bottom:20px; border-bottom:1px solid var(--border); }
            .media-modal-header h3 { margin:0; font-size:20px; }
            .media-detail-grid { display:grid; grid-template-columns:minmax(220px, .85fr) 1.15fr; gap:22px; }
            .media-detail-cover { min-height:250px; background:#f4f4f1; border-radius:10px; overflow:hidden; display:grid; place-items:center; }
            .media-detail-cover img { width:100%; height:100%; max-height:420px; object-fit:cover; display:block; }
            .media-detail-copy { display:grid; gap:12px; align-content:start; }
            .media-detail-copy h4 { margin:0; font-size:24px; }
            .media-detail-copy p { margin:0; color:var(--muted); line-height:1.65; white-space:pre-wrap; }
            .media-detail-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .media-detail-meta div { border:1px solid var(--border); border-radius:9px; padding:10px; }
            .media-detail-meta span { display:block; color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
            .media-edit-form { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
            .media-edit-form label { display:grid; gap:7px; font-size:12px; font-weight:600; }
            .media-edit-form .full { grid-column:1/-1; }
            .media-edit-form .form-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }
            .media-card { overflow:hidden; }
            .media-preview { min-height:170px; background:#f4f4f1; display:grid; place-items:center; overflow:hidden; }
            .media-preview img { display:block; width:100%; height:100%; min-height:170px; max-height:240px; object-fit:cover; }
            .media-meta { display:grid; gap:5px; padding:14px; }
            .media-meta strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .media-meta > span:not(.status) { color:var(--muted); font-size:11px; }
            .media-actions { display:flex; flex-wrap:wrap; gap:7px; padding:0 14px 14px; }
            .media-actions .danger { color:var(--danger); border-color:#efc9c5; }
            .media-type { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
            @media (max-width:700px) { #media-product-modal { padding:12px; } .media-modal-card { padding:18px; max-height:94vh; } .media-edit-form,.media-detail-grid { grid-template-columns:1fr; } .media-edit-form .full { grid-column:auto; } .media-detail-meta { grid-template-columns:1fr; } }
        `;
        document.head.appendChild(style);
    };

    const setupCategorySwitch = () => {
        const toolbar = document.querySelector(".media-toolbar");
        if (!toolbar || document.querySelector("#media-category-switch")) return;
        const switcher = document.createElement("div");
        switcher.id = "media-category-switch";
        switcher.className = "media-category-switch";
        switcher.innerHTML = `<button type="button" class="active" data-category="all">All</button><button type="button" data-category="products">Products</button><button type="button" data-category="projects">Projects</button>`;
        toolbar.insertAdjacentElement("beforebegin", switcher);
        switcher.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-category]");
            if (!button) return;
            mediaCategory = button.dataset.category;
            switcher.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
            const filter = document.querySelector("#media-filter");
            if (filter) {
                filter.innerHTML = `<option value="all">All statuses</option><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option>`;
            }
            renderMedia();
        });
    };

    const cardMarkup = (item, type) => {
        const cover = coverUrl(item.cover_path);
        const isProject = type === "project";
        const details = isProject ? `${escapeHtml(item.category || "Uncategorised")} · Project` : `${escapeHtml(item.format || "Digital product")} · ${money(item.price, item.currency)}`;
        return `<article class="media-card" data-id="${item.id}" data-type="${type}">
            <div class="media-preview">${cover ? `<img src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy">` : `<div class="file-preview-generic"><strong>${isProject ? "PROJECT" : escapeHtml(item.format || "PRODUCT")}</strong><span>No cover image</span></div>`}</div>
            <div class="media-meta"><span class="media-type">${isProject ? "Project" : "Product"}</span><strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong><span>${details}</span><span>${isProject ? escapeHtml(item.description || "No description") : (item.product_file_path ? "Product file attached" : "No product file")}</span><span class="status status-${item.status === "published" ? "green" : item.status === "draft" ? "gray" : "amber"}">${escapeHtml(statusLabel(item.status))}</span></div>
            <div class="media-actions"><button class="row-action" type="button" data-action="edit" data-id="${item.id}" data-type="${type}">Edit</button>${item.status === "published" ? `<button class="row-action" type="button" data-action="unpublish" data-id="${item.id}" data-type="${type}">Unpublish</button>` : `<button class="row-action" type="button" data-action="publish" data-id="${item.id}" data-type="${type}">Publish</button>`}<button class="row-action danger" type="button" data-action="delete" data-id="${item.id}" data-type="${type}">Delete</button><button class="row-action" type="button" data-action="view" data-id="${item.id}" data-type="${type}">View</button></div>
        </article>`;
    };

    const renderMedia = () => {
        const list = document.querySelector("#asset-list"); if (!list) return;
        const search = (document.querySelector("#media-search")?.value || "").trim().toLowerCase();
        const filter = document.querySelector("#media-filter")?.value || "all";
        const matches = (item) => {
            const haystack = `${item.title} ${item.description || ""} ${item.category || ""} ${item.format || ""}`.toLowerCase();
            return (!search || haystack.includes(search)) && (filter === "all" || item.status === filter);
        };
        const productCards = mediaCategory === "projects" ? [] : products.filter(matches).map((item) => cardMarkup(item, "product"));
        const projectCards = mediaCategory === "products" ? [] : projects.filter(matches).map((item) => cardMarkup(item, "project"));
        list.innerHTML = [...productCards, ...projectCards].join("") || '<div class="empty-state">No media items match your search.</div>';
    };

    const loadProducts = async () => {
        const { data, error } = await supabaseClient.from("products").select("id,title,slug,description,price,currency,format,resource_count,cover_path,status,product_file_bucket,product_file_path,purchase_count,like_count,created_at,updated_at").order("created_at", { ascending: false });
        if (error) throw error;
        products = data || [];
    };

    const loadProjects = async () => {
        const { data, error } = await supabaseClient.from("projects").select("id,title,slug,category,description,cover_path,status,created_at,updated_at").order("created_at", { ascending: false });
        if (error) throw error;
        projects = data || [];
    };

    const closeModal = () => document.querySelector("#media-product-modal")?.remove();

    const openViewModal = (item, type) => {
        closeModal();
        const isProject = type === "project";
        const cover = coverUrl(item.cover_path);
        const modal = document.createElement("div"); modal.id = "media-product-modal";
        modal.innerHTML = `<div class="media-modal-backdrop" data-close="true"></div><section class="media-modal-card" role="dialog" aria-modal="true"><div class="media-modal-header"><div><p class="eyebrow">MEDIA LIBRARY · ${isProject ? "PROJECT" : "PRODUCT"}</p><h3>Admin preview</h3></div><button type="button" class="row-action" data-close="true">Close</button></div><div class="media-detail-grid"><div class="media-detail-cover">${cover ? `<img src="${cover}" alt="${escapeHtml(item.title)}">` : `<div class="file-preview-generic"><strong>${isProject ? "PROJECT" : escapeHtml(item.format || "PRODUCT")}</strong><span>No cover image</span></div>`}</div><div class="media-detail-copy"><span class="media-type">${isProject ? "Project" : "Digital Product"}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.description || "No description provided.")}</p><div class="media-detail-meta">${isProject ? `<div><span>Category</span><strong>${escapeHtml(item.category || "Uncategorised")}</strong></div>` : `<div><span>Price</span><strong>${money(item.price, item.currency)}</strong></div><div><span>Format</span><strong>${escapeHtml(item.format || "Digital product")}</strong></div><div><span>Resources</span><strong>${escapeHtml(item.resource_count || 0)}</strong></div><div><span>Purchases</span><strong>${escapeHtml(item.purchase_count || 0)}</strong></div><div><span>Likes</span><strong>${escapeHtml(item.like_count || 0)}</strong></div>`}<div><span>Status</span><strong>${escapeHtml(statusLabel(item.status))}</strong></div></div></div></div></section>`;
        document.body.appendChild(modal); modal.addEventListener("click", (event) => { if (event.target.closest("[data-close='true']")) closeModal(); });
    };

    const openEditModal = (item, type) => {
        closeModal();
        if (type === "project") {
            const form = document.querySelector("#project-form"), editor = document.querySelector("#project-editor"); if (!form || !editor) return;
            const set = (name, value) => { const input = form.querySelector(`[name="${name}"]`); if (input) input.value = value || ""; };
            set("title", item.title); set("slug", item.slug); set("category", item.category); set("description", item.description); set("cover_path", item.cover_path); set("status", item.status);
            const id = document.querySelector("#project-id"); if (id) id.value = item.id;
            const title = document.querySelector("#project-editor-title"); if (title) title.textContent = "Edit Project";
            editor.scrollIntoView({ behavior: "smooth", block: "start" }); return;
        }
        const modal = document.createElement("div"); modal.id = "media-product-modal";
        modal.innerHTML = `<div class="media-modal-backdrop" data-close="true"></div><section class="media-modal-card" role="dialog" aria-modal="true"><div class="media-modal-header"><div><p class="eyebrow">MEDIA LIBRARY</p><h3>Edit product</h3></div><button type="button" class="row-action" data-close="true">Close</button></div><form id="media-edit-form" class="media-edit-form"><label>Product title<input name="title" required value="${escapeHtml(item.title)}"></label><label>Price<input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(item.price ?? 0)}"></label><label>Format<select name="format"><option value="PDF" ${item.format === "PDF" ? "selected" : ""}>PDF</option><option value="ZIP" ${item.format === "ZIP" ? "selected" : ""}>ZIP</option><option value="Template" ${item.format === "Template" ? "selected" : ""}>Template</option><option value="Video" ${item.format === "Video" ? "selected" : ""}>Video</option></select></label><label>Status<select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Draft</option><option value="published" ${item.status === "published" ? "selected" : ""}>Published</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archived</option></select></label><label class="full">Description<textarea name="description" rows="5">${escapeHtml(item.description || "")}</textarea></label><label>Replace cover<input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><label>Replace product file<input name="file" type="file" accept=".pdf,.zip,.mp4,.webm,.mov"></label><div id="media-edit-preview" class="asset-preview full"><span>Choose a replacement file to preview it here.</span></div><p id="media-edit-message" class="form-message full"></p><div class="form-actions full"><button type="button" class="button secondary" data-close="true">Cancel</button><button type="submit" class="button primary">Save changes</button></div></form></section>`;
        document.body.appendChild(modal);
        const form = modal.querySelector("#media-edit-form"), preview = modal.querySelector("#media-edit-preview");
        form.file.addEventListener("change", () => { const file = form.file.files[0]; if (!file) return; const url = URL.createObjectURL(file); if (file.type.startsWith("video/")) preview.innerHTML = `<video controls preload="metadata" src="${url}" style="width:100%;max-height:360px"></video>`; else if (file.type === "application/pdf") preview.innerHTML = `<iframe title="Product PDF preview" src="${url}" style="width:100%;height:360px;border:0"></iframe>`; else preview.innerHTML = `<div class="file-preview-generic"><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type || "ZIP archive")}</span></div>`; });
        modal.addEventListener("click", (event) => { if (event.target.closest("[data-close='true']")) closeModal(); });
        form.addEventListener("submit", (event) => saveProductEdits(event, item, modal)); form.title.focus();
    };

    const saveProductEdits = async (event, item, modal) => {
        event.preventDefault(); const form = event.currentTarget, message = modal.querySelector("#media-edit-message"); let newCoverPath = null, newFilePath = null;
        try {
            await ensureAdmin(); message.textContent = "Saving changes…";
            const payload = { title: form.title.value.trim(), description: form.description.value.trim() || null, price: Number(form.price.value || 0), format: form.format.value, status: form.status.value, updated_at: new Date().toISOString() }; if (!payload.title) throw new Error("Product title is required.");
            const cover = form.cover.files[0];
            if (cover) { if (!cover.type.startsWith("image/")) throw new Error("The replacement cover must be an image."); if (cover.size > 250 * 1024 * 1024) throw new Error("The replacement cover is too large."); const safeName = cover.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"); newCoverPath = `product-covers/${item.id}-${crypto.randomUUID()}-${safeName}`; const { error } = await supabaseClient.storage.from("public-assets").upload(newCoverPath, cover, { cacheControl: "3600", upsert: false, contentType: cover.type }); if (error) throw error; payload.cover_path = newCoverPath; }
            const file = form.file.files[0];
            if (file) { const allowed = ["application/pdf", "application/zip", "application/x-zip-compressed", "video/mp4", "video/webm", "video/quicktime"]; if (!allowed.includes(file.type)) throw new Error("Product files must be PDF, ZIP, MP4, WebM, or MOV."); if (file.size > 250 * 1024 * 1024) throw new Error("The product file must be 250 MB or smaller."); const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"); newFilePath = `products/${item.id}/${crypto.randomUUID()}-${safeName}`; const { error } = await supabaseClient.storage.from("product-files").upload(newFilePath, file, { cacheControl: "3600", upsert: false, contentType: file.type }); if (error) throw error; payload.product_file_bucket = "product-files"; payload.product_file_path = newFilePath; }
            const { error } = await supabaseClient.from("products").update(payload).eq("id", item.id); if (error) throw error;
            if (file) { const { error: rowError } = await supabaseClient.from("product_files").insert({ product_id: item.id, file_path: newFilePath, file_name: file.name, mime_type: file.type || "application/octet-stream", file_size: file.size, is_preview: false }); if (rowError) throw rowError; if (item.product_file_path) { await supabaseClient.storage.from(item.product_file_bucket || "product-files").remove([item.product_file_path]); await supabaseClient.from("product_files").delete().eq("product_id", item.id).eq("file_path", item.product_file_path); } }
            if (cover && item.cover_path) await supabaseClient.storage.from("public-assets").remove([item.cover_path]); closeModal(); await loadProducts(); renderMedia();
        } catch (error) { if (newFilePath) await supabaseClient.storage.from("product-files").remove([newFilePath]); if (newCoverPath) await supabaseClient.storage.from("public-assets").remove([newCoverPath]); message.textContent = error.message; }
    };

    const changeStatus = async (item, type, status) => { await ensureAdmin(); const table = type === "project" ? "projects" : "products"; const { error } = await supabaseClient.from(table).update({ status, updated_at: new Date().toISOString() }).eq("id", item.id); if (error) throw error; if (type === "project") await loadProjects(); else await loadProducts(); renderMedia(); };
    const deleteProduct = async (item) => { await ensureAdmin(); if (!window.confirm(`Delete “${item.title}” permanently? This removes the product and its stored files.`)) return; const { data: files, error: filesError } = await supabaseClient.from("product_files").select("file_path").eq("product_id", item.id); if (filesError) throw filesError; const paths = (files || []).map((file) => file.file_path).filter(Boolean); if (item.product_file_path && !paths.includes(item.product_file_path)) paths.push(item.product_file_path); if (paths.length) { const { error } = await supabaseClient.storage.from(item.product_file_bucket || "product-files").remove(paths); if (error) throw error; } if (item.cover_path) { const { error } = await supabaseClient.storage.from("public-assets").remove([item.cover_path]); if (error) throw error; } const { error: filesDeleteError } = await supabaseClient.from("product_files").delete().eq("product_id", item.id); if (filesDeleteError) throw filesDeleteError; const { error: productDeleteError } = await supabaseClient.from("products").delete().eq("id", item.id); if (productDeleteError) throw productDeleteError; await loadProducts(); renderMedia(); };
    const deleteProject = async (item) => { await ensureAdmin(); if (!window.confirm(`Delete “${item.title}” permanently?`)) return; if (item.cover_path) await supabaseClient.storage.from("public-assets").remove([item.cover_path]); const { error } = await supabaseClient.from("projects").delete().eq("id", item.id); if (error) throw error; await loadProjects(); renderMedia(); };
    const handleAction = async (event) => { const button = event.target.closest("button[data-action]"); if (!button) return; const type = button.dataset.type, id = button.dataset.id, item = type === "project" ? projects.find((entry) => entry.id === id) : products.find((entry) => entry.id === id); if (!item) return; button.disabled = true; try { const action = button.dataset.action; if (action === "view") openViewModal(item, type); if (action === "edit") openEditModal(item, type); if (action === "unpublish") await changeStatus(item, type, "draft"); if (action === "publish") await changeStatus(item, type, "published"); if (action === "delete") type === "project" ? await deleteProject(item) : await deleteProduct(item); } catch (error) { window.alert(error.message); } finally { button.disabled = false; } };

    window.addEventListener("DOMContentLoaded", async () => {
        const media = document.querySelector("#media"); if (!media || !config?.url || !config?.publishableKey) return;
        try {
            injectMediaStyles();
            await waitForAdminReady();
            supabaseClient = window.VISUAL_TECH_SUPABASE_CLIENT;
            setupCategorySwitch();
            document.querySelector("#media-search")?.addEventListener("input", renderMedia);
            document.querySelector("#media-filter")?.addEventListener("change", renderMedia);
            document.querySelector("#asset-list")?.addEventListener("click", handleAction);
            await Promise.all([loadProducts(), loadProjects()]);
            renderMedia();
        } catch (error) {
            const list = document.querySelector("#asset-list"); if (list) list.innerHTML = `<div class="empty-state">Unable to load media: ${escapeHtml(error.message)}</div>`;
        }
    });
})();
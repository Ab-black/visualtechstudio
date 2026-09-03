(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const maxFileSize = 250 * 1024 * 1024;
    const allowedTypes = ["application/pdf", "application/zip", "application/x-zip-compressed", "video/mp4", "video/webm", "video/quicktime"];
    let client = null;

    const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const setMessage = (id, text) => { const el = document.querySelector(id); if (el) el.textContent = text; };
    const slugify = (value) => `${value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    const normalizeUrl = (value = "") => { const url = value.trim(); if (!url) return null; try { const parsed = new URL(url); return /^https?:$/.test(parsed.protocol) ? parsed.href : null; } catch { return null; } };

    const waitForClient = () => new Promise((resolve, reject) => {
        if (window.VISUAL_TECH_SUPABASE_CLIENT) return resolve(window.VISUAL_TECH_SUPABASE_CLIENT);
        const timeout = setTimeout(() => reject(new Error("Dashboard authentication is not ready. Refresh the dashboard and try again.")), 20000);
        window.addEventListener("visualtech:admin-ready", () => {
            clearTimeout(timeout);
            window.VISUAL_TECH_SUPABASE_CLIENT ? resolve(window.VISUAL_TECH_SUPABASE_CLIENT) : reject(new Error("Supabase dashboard client is unavailable."));
        }, { once: true });
    });

    const validateProductFile = (file) => {
        if (!file) return "Choose the product file first.";
        if (file.size > maxFileSize) return "The product file must be 250 MB or smaller.";
        if (!allowedTypes.includes(file.type)) return "Product files must be PDF, ZIP, MP4, WebM, or MOV.";
        return "";
    };

    const previewProduct = (file) => {
        const box = document.querySelector("#product-file-preview");
        if (!box) return;
        if (!file) return void (box.innerHTML = "<span>Select the product file to preview it here.</span>");
        const url = URL.createObjectURL(file);
        if (file.type.startsWith("video/")) box.innerHTML = `<video controls preload="metadata" src="${url}" style="width:100%;max-height:420px"></video>`;
        else if (file.type === "application/pdf") box.innerHTML = `<iframe title="Product PDF preview" src="${url}" style="width:100%;height:420px;border:0"></iframe>`;
        else box.innerHTML = `<div class="file-preview-generic"><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type || "ZIP archive")} · ${(file.size / 1024 / 1024).toFixed(1)} MB</span></div>`;
    };

    const upload = async (bucket, path, file) => {
        const { error } = await client.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream" });
        if (error) throw error;
    };

    const saveProduct = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const title = form.product_title.value.trim();
        const productFile = form.product_file.files[0];
        const cover = form.product_cover.files[0];
        const status = event.submitter?.dataset.status || "draft";
        if (!title) return setMessage("#product-message", "Product title is required.");
        const validationError = validateProductFile(productFile);
        if (validationError) return setMessage("#product-message", validationError);
        if (cover && !cover.type.startsWith("image/")) return setMessage("#product-message", "The cover must be an image.");
        if (cover && cover.size > maxFileSize) return setMessage("#product-message", "The cover image is too large.");
        setMessage("#product-message", "Creating product…");
        const { data: product, error: productError } = await client.from("products").insert({ title, slug: slugify(title), description: form.product_description.value.trim() || null, price: Number(form.product_price.value || 0), currency: "NGN", format: form.product_format.value, status, cover_path: null, product_file_bucket: "product-files", product_file_path: null }).select("id").single();
        if (productError) return setMessage("#product-message", productError.message);
        let coverPath = null, filePath = null;
        try {
            if (cover) { const safe = cover.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"); coverPath = `product-covers/${product.id}-${crypto.randomUUID()}-${safe}`; await upload("public-assets", coverPath, cover); }
            const safeFile = productFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
            filePath = `products/${product.id}/${crypto.randomUUID()}-${safeFile}`;
            await upload("product-files", filePath, productFile);
            const { error: fileError } = await client.from("product_files").insert({ product_id: product.id, file_path: filePath, file_name: productFile.name, mime_type: productFile.type || "application/octet-stream", file_size: productFile.size, is_preview: false });
            if (fileError) throw fileError;
            const { error: updateError } = await client.from("products").update({ cover_path: coverPath, product_file_bucket: "product-files", product_file_path: filePath, updated_at: new Date().toISOString() }).eq("id", product.id);
            if (updateError) throw updateError;
            setMessage("#product-message", status === "published" ? "Product published successfully." : "Product saved as draft.");
            form.reset(); previewProduct(null);
        } catch (error) {
            if (filePath) await client.storage.from("product-files").remove([filePath]);
            if (coverPath) await client.storage.from("public-assets").remove([coverPath]);
            await client.from("products").delete().eq("id", product.id);
            setMessage("#product-message", `Product file setup failed: ${error.message}`);
        }
    };

    const injectProjectForm = () => {
        if (document.querySelector("#commerce-project-form")) return document.querySelector("#commerce-project-form");
        const productSection = document.querySelector("#products-form");
        if (!productSection) return null;
        const section = document.createElement("section");
        section.className = "content-section";
        section.id = "commerce-project-form-section";
        section.innerHTML = `<div class="section-intro"><div><p class="eyebrow">COMMERCE</p><h2>Create project</h2><p class="section-description">Create a project here, upload its cover image, save it as a draft, or publish it to the public Projects page and Media Library.</p></div></div><form class="form-panel" id="commerce-project-form"><input id="commerce-project-id" type="hidden"><div class="form-grid"><label>Project title<input name="project_title" required placeholder="Nervous Realty"></label><label>Category<input name="project_category" placeholder="Brand & Digital"></label><label class="full">Project link <span class="field-hint">Optional · opens when the project title is clicked on the public Projects page.</span><input name="project_url" type="url" inputmode="url" placeholder="https://example.com"></label><label class="full">Description<textarea name="project_description" rows="5" placeholder="Describe the project, challenge, solution, and outcome."></textarea></label><label class="full">Cover image<input name="project_cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><label>Status<select name="project_status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><div class="cover-preview" id="commerce-project-cover-preview"><span>No cover selected</span></div></div><div class="form-actions"><p class="form-message" id="commerce-project-message"></p><button class="button secondary" type="button" id="commerce-project-clear">Clear</button><button class="button secondary" type="submit" data-status="draft">Save Draft</button><button class="button primary" type="submit" data-status="published">Publish</button></div></form>`;
        productSection.insertAdjacentElement("afterend", section);
        const form = section.querySelector("#commerce-project-form");
        const cover = form.project_cover;
        cover.addEventListener("change", () => {
            const file = cover.files[0];
            const preview = section.querySelector("#commerce-project-cover-preview");
            if (!file) return void (preview.innerHTML = "<span>No cover selected</span>");
            if (!file.type.startsWith("image/")) return void (preview.innerHTML = "<span>Cover must be an image.</span>");
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Project cover preview">`;
        });
        form.addEventListener("submit", saveProject);
        section.querySelector("#commerce-project-clear").addEventListener("click", () => clearProjectForm());
        form.querySelectorAll("button[type='submit']").forEach((button) => button.addEventListener("click", () => { form.project_status.value = button.dataset.status; }));
        return form;
    };

    const clearProjectForm = () => {
        const form = document.querySelector("#commerce-project-form"); if (!form) return;
        form.reset(); document.querySelector("#commerce-project-id").value = ""; document.querySelector("#commerce-project-message").textContent = ""; document.querySelector("#commerce-project-cover-preview").innerHTML = "<span>No cover selected</span>";
    };

    const saveProject = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const title = form.project_title.value.trim();
        const category = form.project_category.value.trim() || null;
        const description = form.project_description.value.trim() || null;
        const projectUrlInput = form.project_url.value.trim();
        const projectUrl = normalizeUrl(projectUrlInput);
        const cover = form.project_cover.files[0];
        const status = event.submitter?.dataset.status || form.project_status.value || "draft";
        if (!title) return setMessage("#commerce-project-message", "Project title is required.");
        if (projectUrlInput && !projectUrl) return setMessage("#commerce-project-message", "Project link must be a valid http:// or https:// URL.");
        if (cover && !cover.type.startsWith("image/")) return setMessage("#commerce-project-message", "The cover must be an image.");
        if (cover && cover.size > maxFileSize) return setMessage("#commerce-project-message", "The cover image is too large.");
        setMessage("#commerce-project-message", "Saving project…");
        const projectId = form.querySelector("#commerce-project-id").value;
        let coverPath = null;
        try {
            if (projectId) {
                const { data: current, error: currentError } = await client.from("projects").select("cover_path").eq("id", projectId).single();
                if (currentError) throw currentError;
                coverPath = current.cover_path || null;
            }
            if (cover) {
                const safe = cover.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
                coverPath = `project-covers/${projectId || crypto.randomUUID()}-${crypto.randomUUID()}-${safe}`;
                await upload("public-assets", coverPath, cover);
            }
            const payload = { title, slug: projectId ? undefined : slugify(title), category, description, project_url: projectUrl, status, ...(cover ? { cover_path: coverPath } : {}), updated_at: new Date().toISOString() };
            let result;
            if (projectId) result = await client.from("projects").update(payload).eq("id", projectId);
            else result = await client.from("projects").insert(payload);
            if (result.error) throw result.error;
            setMessage("#commerce-project-message", status === "published" ? "Project published successfully." : "Project saved as draft.");
            clearProjectForm();
        } catch (error) {
            if (cover && coverPath) await client.storage.from("public-assets").remove([coverPath]);
            setMessage("#commerce-project-message", `Project could not be saved: ${error.message}`);
        }
    };

    const patchProjectMediaImages = () => {
        const list = document.querySelector("#asset-list"); if (!list) return;
        list.querySelectorAll("article.media-card[data-type='project'] img").forEach((img) => {
            const src = img.getAttribute("src") || "";
            const marker = "/storage/v1/object/public/public-assets/";
            if (src.includes(marker + "images/")) img.src = `../images/${src.split(marker + "images/")[1].split("?")[0].split("/").map(decodeURIComponent).map(encodeURIComponent).join("/")}`;
        });
    };

    const init = async () => {
        const productForm = document.querySelector("#inline-product-form");
        if (!productForm || !config?.url || !config?.publishableKey) return;
        const accessPanel = document.querySelector(".product-access-panel"); if (accessPanel) accessPanel.remove();
        productForm.hidden = false;
        client = await waitForClient();
        productForm.product_file.addEventListener("change", () => { const file = productForm.product_file.files[0]; const error = validateProductFile(file); if (error) setMessage("#product-message", error); else setMessage("#product-message", `${file.name} selected.`); previewProduct(file); });
        productForm.addEventListener("submit", saveProduct);
        injectProjectForm();
        const list = document.querySelector("#asset-list");
        if (list) new MutationObserver(patchProjectMediaImages).observe(list, { childList: true, subtree: true });
        patchProjectMediaImages();
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init().catch((error) => setMessage("#product-message", error.message)));
    else init().catch((error) => setMessage("#product-message", error.message));
})();

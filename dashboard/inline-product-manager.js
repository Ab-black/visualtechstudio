(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const maxFileSize = 250 * 1024 * 1024;
    const allowedTypes = [
        "application/pdf", "application/zip", "application/x-zip-compressed",
        "video/mp4", "video/webm", "video/quicktime"
    ];
    let client;

    const setMessage = (text) => {
        const node = document.querySelector("#product-message");
        if (node) node.textContent = text;
    };

    const loadClient = () => new Promise((resolve, reject) => {
        if (window.supabase) return resolve(window.supabase.createClient(config.url, config.publishableKey));
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey));
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const validate = (file) => {
        if (!file) return "Choose the digital product file first.";
        if (file.size > maxFileSize) return "The product file must be 250 MB or smaller.";
        if (!allowedTypes.includes(file.type)) return "Product files must be PDF, ZIP, MP4, WebM, or MOV.";
        return "";
    };

    const preview = (file) => {
        const box = document.querySelector("#product-file-preview");
        if (!box) return;
        if (!file) {
            box.innerHTML = "<span>Select the product file to preview it here.</span>";
            return;
        }
        const url = URL.createObjectURL(file);
        if (file.type.startsWith("video/")) box.innerHTML = `<video controls preload="metadata" src="${url}" style="width:100%;max-height:420px"></video>`;
        else if (file.type === "application/pdf") box.innerHTML = `<iframe title="Product PDF preview" src="${url}" style="width:100%;height:420px;border:0"></iframe>`;
        else box.innerHTML = `<div class="file-preview-generic"><strong>${file.name}</strong><span>${file.type || "ZIP archive"} · ${(file.size / 1024 / 1024).toFixed(1)} MB</span></div>`;
    };

    const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const upload = async (bucket, path, file) => {
        const { error } = await client.storage.from(bucket).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });
        if (error) throw error;
    };

    const save = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const title = form.product_title.value.trim();
        const productFile = form.product_file.files[0];
        const cover = form.product_cover.files[0];
        const status = event.submitter?.dataset.status || form.product_status.value || "draft";

        if (!title) return setMessage("Product title is required.");
        const validationError = validate(productFile);
        if (validationError) return setMessage(validationError);
        if (cover && cover.size > maxFileSize) return setMessage("The cover image is too large.");

        setMessage("Creating product…");
        const { data: product, error: productError } = await client.from("products").insert({
            title,
            slug: slugify(title),
            description: form.product_description.value.trim() || null,
            price: Number(form.product_price.value || 0),
            currency: "NGN",
            format: form.product_format.value,
            status,
            cover_path: null,
            product_file_bucket: "product-files",
            product_file_path: null
        }).select("id").single();

        if (productError) return setMessage(productError.message);

        try {
            let coverPath = null;
            if (cover) {
                const safeCover = cover.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
                coverPath = `product-covers/${product.id}-${crypto.randomUUID()}-${safeCover}`;
                await upload("public-assets", coverPath, cover);
            }

            const safeFile = productFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
            const filePath = `products/${product.id}/${crypto.randomUUID()}-${safeFile}`;
            await upload("product-files", filePath, productFile);

            const { error: fileError } = await client.from("product_files").insert({
                product_id: product.id,
                file_path: filePath,
                file_name: productFile.name,
                mime_type: productFile.type || "application/octet-stream",
                file_size: productFile.size,
                is_preview: false
            });
            if (fileError) throw fileError;

            const { error: updateError } = await client.from("products").update({
                cover_path: coverPath,
                product_file_bucket: "product-files",
                product_file_path: filePath,
                updated_at: new Date().toISOString()
            }).eq("id", product.id);
            if (updateError) throw updateError;

            setMessage(status === "published" ? "Product published successfully." : "Product saved as draft.");
            form.reset();
            preview(null);
        } catch (error) {
            await client.from("products").delete().eq("id", product.id);
            setMessage(`Product file setup failed: ${error.message}`);
        }
    };

    const init = async () => {
        const form = document.querySelector("#inline-product-form");
        if (!form || !config?.url || !config?.publishableKey) return;

        const accessPanel = document.querySelector(".product-access-panel");
        if (accessPanel) accessPanel.remove();
        form.hidden = false;

        client = await loadClient();
        form.product_file.addEventListener("change", () => {
            const file = form.product_file.files[0];
            const error = validate(file);
            if (error) setMessage(error);
            else setMessage(`${file.name} selected.`);
            preview(file);
        });
        form.addEventListener("submit", save);
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init().catch((error) => setMessage(error.message)));
    else init().catch((error) => setMessage(error.message));
})();

(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const maxFileSize = 250 * 1024 * 1024;
    const allowedTypes = [
        "application/pdf", "application/zip", "application/x-zip-compressed",
        "video/mp4", "video/webm", "video/quicktime"
    ];
    let client;

    const node = (selector) => document.querySelector(selector);
    const setMessage = (text, error = false) => {
        const element = node("#product-message");
        if (element) {
            element.textContent = text;
            element.dataset.error = error ? "true" : "false";
        }
    };

    const setAuthMessage = (text) => {
        const element = node("#product-auth-message");
        if (element) element.textContent = text;
    };

    const updateAuthUi = async () => {
        const { data } = await client.auth.getSession();
        const session = data.session;
        const form = node("#inline-product-form");
        const login = node("#product-auth-form");
        const user = node("#product-auth-user");
        const logout = node("#product-logout");

        if (session) {
            if (form) form.hidden = false;
            if (login) login.hidden = true;
            if (user) user.textContent = `Signed in as ${session.user.email}`;
            if (logout) logout.hidden = false;
        } else {
            if (form) form.hidden = true;
            if (login) login.hidden = false;
            if (user) user.textContent = "Not signed in";
            if (logout) logout.hidden = true;
        }
    };

    const loadClient = () => new Promise((resolve, reject) => {
        if (!config?.url || !config?.publishableKey) return reject(new Error("Supabase configuration is missing."));
        if (window.supabase) return resolve(window.supabase.createClient(config.url, config.publishableKey));
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey));
        script.onerror = () => reject(new Error("Could not load Supabase."));
        document.head.appendChild(script);
    });

    const validate = (file) => {
        if (!file) return "Choose the digital product file first.";
        if (file.size > maxFileSize) return "The product file must be 250 MB or smaller.";
        if (!allowedTypes.includes(file.type)) return "Product files must be PDF, ZIP, MP4, WebM, or MOV.";
        return "";
    };

    const preview = (file) => {
        const box = node("#product-file-preview");
        if (!box) return;
        if (!file) {
            box.innerHTML = "<span>Select the product file to preview it here.</span>";
            return;
        }
        const url = URL.createObjectURL(file);
        if (file.type.startsWith("video/")) {
            box.innerHTML = `<video controls preload="metadata" src="${url}" style="width:100%;max-height:420px"></video>`;
        } else if (file.type === "application/pdf") {
            box.innerHTML = `<iframe title="Product PDF preview" src="${url}" style="width:100%;height:420px;border:0"></iframe>`;
        } else {
            box.innerHTML = `<div class="file-preview-generic"><strong>${file.name}</strong><span>${file.type || "ZIP archive"} · ${(file.size / 1024 / 1024).toFixed(1)} MB</span></div>`;
        }
    };

    const slugify = (value) => `${value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;

    const upload = async (bucket, path, file) => {
        const { error } = await client.storage.from(bucket).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream"
        });
        if (error) throw error;
    };

    const removeUploaded = async (bucket, path) => {
        if (!path) return;
        await client.storage.from(bucket).remove([path]);
    };

    const signIn = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const email = form.email.value.trim();
        const password = form.password.value;
        if (!email || !password) return setAuthMessage("Enter your admin email and password.");
        setAuthMessage("Signing in…");
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return setAuthMessage(error.message);
        form.reset();
        setAuthMessage("");
        await updateAuthUi();
    };

    const save = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const title = form.product_title.value.trim();
        const productFile = form.product_file.files[0];
        const cover = form.product_cover.files[0];
        const status = event.submitter?.dataset.status || form.product_status.value || "draft";

        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) return setMessage("Please sign in as an admin before creating a product.", true);
        if (!title) return setMessage("Product title is required.", true);

        const validationError = validate(productFile);
        if (validationError) return setMessage(validationError, true);
        if (cover && !cover.type.startsWith("image/")) return setMessage("The cover must be an image.", true);
        if (cover && cover.size > maxFileSize) return setMessage("The cover image is too large.", true);

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

        if (productError) return setMessage(productError.message, true);

        let coverPath = null;
        let filePath = null;
        try {
            if (cover) {
                const safeCover = cover.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
                coverPath = `product-covers/${product.id}-${crypto.randomUUID()}-${safeCover}`;
                await upload("public-assets", coverPath, cover);
            }

            const safeFile = productFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
            filePath = `products/${product.id}/${crypto.randomUUID()}-${safeFile}`;
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
            await removeUploaded("product-files", filePath);
            await removeUploaded("public-assets", coverPath);
            await client.from("products").delete().eq("id", product.id);
            setMessage(`Product could not be completed: ${error.message}`, true);
        }
    };

    const init = async () => {
        const form = node("#inline-product-form");
        const authForm = node("#product-auth-form");
        if (!form || !config?.url || !config?.publishableKey) return;

        client = await loadClient();
        await updateAuthUi();

        authForm?.addEventListener("submit", signIn);
        node("#product-logout")?.addEventListener("click", async () => {
            await client.auth.signOut();
            setAuthMessage("Signed out.");
            await updateAuthUi();
        });

        client.auth.onAuthStateChange(() => updateAuthUi());

        form.product_file.addEventListener("change", () => {
            const file = form.product_file.files[0];
            const error = validate(file);
            if (error) setMessage(error, true);
            else setMessage(`${file.name} selected.`);
            preview(file);
        });
        form.addEventListener("submit", save);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init().catch((error) => setMessage(error.message, true)));
    } else {
        init().catch((error) => setMessage(error.message, true));
    }
})();

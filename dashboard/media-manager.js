(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const allowedTypes = [
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/pdf", "application/zip", "application/x-zip-compressed",
        "video/mp4", "video/webm", "video/quicktime"
    ];
    const maxSize = 250 * 1024 * 1024;
    const bucket = "public-assets";
    let supabaseClient;
    let selectedFile = null;
    let assets = [];

    const escapeHtml = (value = "") => String(value)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

    const formatSize = (bytes = 0) => {
        if (!bytes) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
    };

    const loadSupabase = () => new Promise((resolve, reject) => {
        if (window.supabase) return resolve(window.supabase.createClient(config.url, config.publishableKey));
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey));
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const validate = (file) => {
        if (!allowedTypes.includes(file.type)) return "This file type is not supported.";
        if (file.size > maxSize) return "The maximum file size is 250 MB.";
        return "";
    };

    const previewFile = (file, container) => {
        const url = URL.createObjectURL(file);
        if (file.type.startsWith("image/")) container.innerHTML = `<img src="${url}" alt="Selected file preview">`;
        else if (file.type.startsWith("video/")) container.innerHTML = `<video controls preload="metadata" src="${url}"></video>`;
        else if (file.type === "application/pdf") container.innerHTML = `<iframe title="PDF preview" src="${url}"></iframe>`;
        else container.innerHTML = `<div class="file-preview-generic"><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type || "File")}</span></div>`;
    };

    const publicUrl = (path) => `${config.url}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

    const renderPreview = (asset) => {
        const url = publicUrl(asset.path);
        if (asset.mime_type.startsWith("image/")) return `<img src="${url}" alt="${escapeHtml(asset.alt_text || asset.filename)}" loading="lazy">`;
        if (asset.mime_type.startsWith("video/")) return `<video controls preload="metadata" src="${url}"></video>`;
        if (asset.mime_type === "application/pdf") return `<iframe title="${escapeHtml(asset.filename)}" src="${url}"></iframe>`;
        return `<div class="file-preview-generic"><strong>${escapeHtml(asset.mime_type.split("/").pop()?.toUpperCase() || "FILE")}</strong></div>`;
    };

    const renderAssets = () => {
        const list = document.querySelector("#asset-list");
        if (!list) return;
        const search = (document.querySelector("#media-search")?.value || "").trim().toLowerCase();
        const type = document.querySelector("#media-filter")?.value || "all";
        const filtered = assets.filter((asset) => {
            const matchesSearch = !search || `${asset.filename} ${asset.mime_type}`.toLowerCase().includes(search);
            const matchesType = type === "all" || (type === "images" && asset.mime_type.startsWith("image/")) || (type === "documents" && (asset.mime_type === "application/pdf" || asset.mime_type.includes("zip"))) || (type === "video" && asset.mime_type.startsWith("video/"));
            return matchesSearch && matchesType;
        });
        list.innerHTML = filtered.map((asset) => `
            <article class="media-card" data-id="${asset.id}">
                <div class="media-preview">${renderPreview(asset)}</div>
                <div class="media-meta">
                    <strong title="${escapeHtml(asset.filename)}">${escapeHtml(asset.filename)}</strong>
                    <span>${escapeHtml(asset.mime_type)} · ${formatSize(asset.size_bytes)}</span>
                    <span>${asset.alt_text ? `Alt: ${escapeHtml(asset.alt_text)}` : "No alt text"}</span>
                </div>
                <div class="media-actions">
                    <button class="row-action" type="button" data-action="edit" data-id="${asset.id}">Edit</button>
                    <button class="row-action" type="button" data-action="replace" data-id="${asset.id}">Replace</button>
                    <button class="row-action danger" type="button" data-action="delete" data-id="${asset.id}">Delete</button>
                </div>
            </article>
        `).join("") || '<div class="empty-state">No matching media.</div>';
    };

    const loadAssets = async () => {
        const { data, error } = await supabaseClient.from("media_assets")
            .select("id,bucket,path,filename,mime_type,size_bytes,alt_text,created_at")
            .eq("bucket", bucket).order("created_at", { ascending: false }).limit(100);
        if (error) {
            document.querySelector("#asset-list").innerHTML = `<div class="empty-state">Unable to load media: ${escapeHtml(error.message)}</div>`;
            return;
        }
        assets = data || [];
        renderAssets();
    };

    const setupUi = () => {
        const media = document.querySelector("#media");
        if (!media) return;
        let input = document.querySelector("#asset-file");
        let dropzone = document.querySelector("#asset-dropzone");
        if (!input || !dropzone) {
            const toolbar = media.querySelector(".media-toolbar");
            if (!toolbar) return;
            const panel = document.createElement("div");
            panel.className = "media-upload-panel";
            panel.innerHTML = `<div class="media-dropzone" id="asset-dropzone" tabindex="0" role="button" aria-label="Choose or drop a media file"><strong>Drop an asset here</strong><span>Images, PDF, ZIP and video · up to 250 MB</span><input id="asset-file" type="file" hidden accept="image/*,application/pdf,.zip,video/mp4,video/webm,video/quicktime"></div><div class="media-upload-preview" id="asset-preview"><span>No file selected</span></div><label class="media-alt-label">Alt text (for images)<input id="asset-alt-text" type="text" placeholder="Describe the image for accessibility"></label><div class="media-upload-actions"><span id="asset-upload-status" role="status">Choose a file to begin.</span><button class="button primary" id="asset-upload-button" type="button" disabled>Upload asset</button></div>`;
            toolbar.after(panel);
            input = panel.querySelector("#asset-file");
            dropzone = panel.querySelector("#asset-dropzone");
        }
        const preview = document.querySelector("#asset-preview");
        const status = document.querySelector("#asset-upload-status");
        const uploadButton = document.querySelector("#asset-upload-button");
        const altText = document.querySelector("#asset-alt-text");
        const uploadMediaButton = document.querySelector("#upload-media-button");
        if (uploadMediaButton) uploadMediaButton.addEventListener("click", () => input.click());
        ["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
        ["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
        dropzone.addEventListener("drop", (event) => choose(event.dataTransfer.files[0]));
        dropzone.addEventListener("click", () => input.click());
        dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") input.click(); });
        input.addEventListener("change", () => choose(input.files[0]));
        document.querySelector("#media-search")?.addEventListener("input", renderAssets);
        document.querySelector("#media-filter")?.addEventListener("change", renderAssets);
        document.querySelector("#asset-list")?.addEventListener("click", handleAction);

        function choose(file) {
            if (!file) return;
            const error = validate(file);
            if (error) { selectedFile = null; preview.innerHTML = `<span>${escapeHtml(error)}</span>`; status.textContent = error; uploadButton.disabled = true; return; }
            selectedFile = file;
            previewFile(file, preview);
            status.textContent = `${file.name} · ${formatSize(file.size)}`;
            uploadButton.disabled = false;
        }

        uploadButton.addEventListener("click", uploadSelected);

        async function uploadSelected() {
            if (!selectedFile) return;
            uploadButton.disabled = true; status.textContent = "Uploading…";
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) { status.textContent = "Sign in as an administrator before uploading media."; uploadButton.disabled = false; return; }
            const safeName = selectedFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
            const path = `uploads/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(path, selectedFile, { cacheControl: "3600", upsert: false, contentType: selectedFile.type });
            if (uploadError) { status.textContent = `Upload failed: ${uploadError.message}`; uploadButton.disabled = false; return; }
            const { error: metadataError } = await supabaseClient.from("media_assets").insert({ bucket, path, filename: selectedFile.name, mime_type: selectedFile.type, size_bytes: selectedFile.size, alt_text: altText?.value.trim() || null });
            if (metadataError) { await supabaseClient.storage.from(bucket).remove([path]); status.textContent = `Metadata could not be saved: ${metadataError.message}`; uploadButton.disabled = false; return; }
            selectedFile = null; input.value = ""; altText.value = ""; preview.innerHTML = "<span>No file selected</span>"; status.textContent = "Upload complete."; await loadAssets();
        }

        async function handleAction(event) {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const asset = assets.find((item) => item.id === button.dataset.id);
            if (!asset) return;
            if (button.dataset.action === "edit") {
                const value = window.prompt("Alt text", asset.alt_text || "");
                if (value === null) return;
                const { error } = await supabaseClient.from("media_assets").update({ alt_text: value.trim() || null, updated_at: new Date().toISOString() }).eq("id", asset.id);
                if (error) window.alert(`Could not update metadata: ${error.message}`); else await loadAssets();
            }
            if (button.dataset.action === "replace") {
                const replacement = document.createElement("input"); replacement.type = "file"; replacement.accept = "image/*,application/pdf,.zip,video/mp4,video/webm,video/quicktime";
                replacement.onchange = async () => {
                    const file = replacement.files[0]; if (!file) return;
                    const validationError = validate(file); if (validationError) return window.alert(validationError);
                    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
                    const newPath = `uploads/${crypto.randomUUID()}-${safeName}`;
                    const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(newPath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                    if (uploadError) return window.alert(`Replacement upload failed: ${uploadError.message}`);
                    const { error: metadataError } = await supabaseClient.from("media_assets").update({ path: newPath, filename: file.name, mime_type: file.type, size_bytes: file.size, updated_at: new Date().toISOString() }).eq("id", asset.id);
                    if (metadataError) { await supabaseClient.storage.from(bucket).remove([newPath]); return window.alert(`Could not update metadata: ${metadataError.message}`); }
                    await supabaseClient.storage.from(bucket).remove([asset.path]); await loadAssets();
                };
                replacement.click();
            }
            if (button.dataset.action === "delete") {
                if (!window.confirm(`Delete “${asset.filename}” permanently?`)) return;
                const { error: metadataError } = await supabaseClient.from("media_assets").delete().eq("id", asset.id);
                if (metadataError) return window.alert(`Could not delete metadata: ${metadataError.message}`);
                const { error: storageError } = await supabaseClient.storage.from(bucket).remove([asset.path]);
                if (storageError) return window.alert(`Metadata deleted, but storage cleanup failed: ${storageError.message}`);
                await loadAssets();
            }
        }
    };

    window.addEventListener("DOMContentLoaded", async () => {
        try {
            if (!config?.url || !config?.publishableKey || config.publishableKey.includes("PASTE_YOUR")) return;
            supabaseClient = await loadSupabase();
            setupUi();
            await loadAssets();
        } catch (error) { console.error("Media manager failed to initialize", error); }
    });
})();
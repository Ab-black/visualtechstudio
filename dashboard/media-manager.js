(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "application/zip",
        "application/x-zip-compressed",
        "video/mp4",
        "video/webm",
        "video/quicktime"
    ];
    const maxSize = 250 * 1024 * 1024;

    const escapeHtml = (value = "") => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const formatSize = (bytes) => {
        if (!bytes) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
    };

    const loadSupabase = () => new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve(window.supabase.createClient(config.url, config.publishableKey));
            return;
        }
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
        if (file.type.startsWith("image/")) {
            container.innerHTML = `<img src="${url}" alt="Selected file preview">`;
        } else if (file.type.startsWith("video/")) {
            container.innerHTML = `<video controls preload="metadata" src="${url}"></video>`;
        } else if (file.type === "application/pdf") {
            container.innerHTML = `<iframe title="PDF preview" src="${url}"></iframe>`;
        } else {
            container.innerHTML = `<div class="file-preview-generic"><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type || "Unknown type")}</span></div>`;
        }
    };

    const init = async () => {
        if (!config || !config.url || !config.publishableKey || config.publishableKey.includes("PASTE_YOUR")) return;
        const supabase = await loadSupabase();
        const fileInput = document.querySelector("#asset-file");
        const dropzone = document.querySelector("#asset-dropzone");
        const preview = document.querySelector("#asset-preview");
        const status = document.querySelector("#asset-upload-status");
        const uploadButton = document.querySelector("#asset-upload-button");
        const altText = document.querySelector("#asset-alt-text");
        const assetList = document.querySelector("#asset-list");
        const bucket = "media";
        let selectedFile = null;

        if (!fileInput || !dropzone || !preview || !status || !uploadButton || !assetList) return;

        const choose = (file) => {
            if (!file) return;
            const error = validate(file);
            if (error) {
                selectedFile = null;
                preview.innerHTML = `<span>${escapeHtml(error)}</span>`;
                status.textContent = error;
                uploadButton.disabled = true;
                return;
            }
            selectedFile = file;
            previewFile(file, preview);
            status.textContent = `${file.name} · ${formatSize(file.size)}`;
            uploadButton.disabled = false;
        };

        ["dragenter", "dragover"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.add("is-dragging");
        }));
        ["dragleave", "drop"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.remove("is-dragging");
        }));
        dropzone.addEventListener("drop", (event) => choose(event.dataTransfer.files[0]));
        dropzone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => choose(fileInput.files[0]));

        uploadButton.addEventListener("click", async () => {
            if (!selectedFile) return;
            uploadButton.disabled = true;
            status.textContent = "Uploading…";

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                status.textContent = "Sign in as an administrator before uploading media.";
                uploadButton.disabled = false;
                return;
            }

            const safeName = selectedFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
            const path = `uploads/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await supabase.storage.from(bucket).upload(path, selectedFile, {
                cacheControl: "3600",
                upsert: false,
                contentType: selectedFile.type
            });

            if (uploadError) {
                status.textContent = `Upload failed: ${uploadError.message}`;
                uploadButton.disabled = false;
                return;
            }

            const { error: metadataError } = await supabase.from("media_assets").insert({
                bucket,
                path,
                filename: selectedFile.name,
                mime_type: selectedFile.type,
                size_bytes: selectedFile.size,
                alt_text: altText?.value.trim() || null
            });

            if (metadataError) {
                await supabase.storage.from(bucket).remove([path]);
                status.textContent = `Metadata could not be saved: ${metadataError.message}`;
                uploadButton.disabled = false;
                return;
            }

            status.textContent = "Upload complete.";
            fileInput.value = "";
            selectedFile = null;
            uploadButton.disabled = true;
            if (altText) altText.value = "";
            preview.innerHTML = "<span>No file selected</span>";
        });

        const { data: assets, error } = await supabase
            .from("media_assets")
            .select("id,filename,mime_type,size_bytes,alt_text,created_at")
            .order("created_at", { ascending: false })
            .limit(24);

        if (error) {
            assetList.innerHTML = `<div class="empty-state">Unable to load media: ${escapeHtml(error.message)}</div>`;
            return;
        }

        assetList.innerHTML = (assets || []).map((asset) => `
            <article class="media-card">
                <div class="media-preview image-placeholder">${asset.mime_type.startsWith("image/") ? "IMAGE" : asset.mime_type.startsWith("video/") ? "VIDEO" : asset.mime_type === "application/pdf" ? "PDF" : "FILE"}</div>
                <div class="media-meta">
                    <strong>${escapeHtml(asset.filename)}</strong>
                    <span>${escapeHtml(asset.mime_type)} · ${formatSize(asset.size_bytes)}</span>
                    <span>${asset.alt_text ? "Alt text added" : "Alt text not added"}</span>
                </div>
            </article>
        `).join("") || '<div class="empty-state">No uploaded media yet.</div>';
    };

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => console.error("Media manager failed to initialize", error));
    });
})();

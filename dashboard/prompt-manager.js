(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    if (!config?.url || !config?.publishableKey || config.publishableKey.includes("PASTE_YOUR")) return;

    const BUCKET = "public-assets";
    const FOLDER = "free-prompts";
    const MAX_IMAGES = 8;
    const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
    const MAX_VIDEO_SECONDS = 15.5;
    const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
    const FALLBACK_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_IMAGE_EDGE = 1600;

    // Fixed category list. The public Free Prompts page groups prompts by these names.
    const CATEGORIES = [
        "Website Building",
        "Website Design & Styling",
        "Website Features",
        "E-commerce",
        "Graphic & Image Design",
        "Content & Copywriting",
        "SEO & Marketing",
        "Other"
    ];

    const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const statusLabel = (status) => ({ draft: "Draft", published: "Published", archived: "Archived" }[status] || status);
    const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const uid = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
    const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
    const publicUrl = (path) => `${config.url}/storage/v1/object/public/${BUCKET}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
    const validMedia = (item) => item && (item.type === "image" || item.type === "video") && typeof item.path === "string" && item.path.startsWith(`${FOLDER}/`);
    const extensionOf = (name, fallback) => { const match = /\.([a-z0-9]+)$/i.exec(name || ""); return match ? match[1].toLowerCase() : fallback; };

    const withTimeout = (promise, ms, message) => new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), ms);
        promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
    });

    const readVideoDuration = (file) => withTimeout(new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(file);
        video.preload = "metadata";
        video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
        video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This video could not be read. Use an MP4 or WebM file.")); };
        video.src = url;
    }), 10000, "This video took too long to read. Try a different MP4 or WebM file.");

    const loadImage = (file) => new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
        image.src = url;
    });

    // Resizes and compresses an image in the browser so it uses far less storage.
    const compressImage = async (file) => {
        try {
            const image = await withTimeout(loadImage(file), 10000, "timeout");
            const longest = Math.max(image.naturalWidth, image.naturalHeight);
            const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
            const width = Math.max(1, Math.round(image.naturalWidth * scale));
            const height = Math.max(1, Math.round(image.naturalHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("no canvas");
            context.drawImage(image, 0, 0, width, height);
            const webp = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
            if (webp && webp.type === "image/webp") return { blob: webp, contentType: "image/webp", ext: "webp" };
            const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
            if (jpeg) return { blob: jpeg, contentType: "image/jpeg", ext: "jpg" };
            throw new Error("no blob");
        } catch {
            if (file.size <= FALLBACK_IMAGE_BYTES) return { blob: file, contentType: file.type || "image/jpeg", ext: extensionOf(file.name, "jpg") };
            throw new Error(`${file.name} could not be compressed and is larger than 5 MB. Try a smaller image.`);
        }
    };

    const getClient = () => window.VISUAL_TECH_SUPABASE_CLIENT || null;
    const waitForClient = () => new Promise((resolve, reject) => {
        const existing = getClient();
        if (existing) return resolve(existing);
        const timeout = window.setTimeout(() => reject(new Error("Dashboard authentication is not ready.")), 15000);
        window.addEventListener("visualtech:admin-ready", () => { window.clearTimeout(timeout); const client = getClient(); client ? resolve(client) : reject(new Error("Supabase client is unavailable.")); }, { once: true });
    });

    const renderPrompts = (prompts) => {
        const container = document.querySelector("#prompts-list");
        if (!container) return;
        if (!prompts.length) { container.innerHTML = '<div class="empty-state">No prompts yet. Add your first free prompt.</div>'; return; }
        container.innerHTML = prompts.map((prompt) => {
            const items = (Array.isArray(prompt.media) ? prompt.media : []).filter(validMedia);
            const firstImage = items.find((item) => item.type === "image");
            const hasVideo = items.some((item) => item.type === "video");
            const cover = firstImage ? `<img src="${escapeHtml(publicUrl(firstImage.path))}" alt="" loading="lazy">` : hasVideo ? "VIDEO" : "PROMPT";
            const detail = [prompt.category || "No category", items.length ? `${items.length} file${items.length === 1 ? "" : "s"}` : "No media"].join(" · ");
            return `<article class="cms-project-row">
            <div class="cms-project-cover" aria-hidden="true">${cover}</div>
            <div class="cms-project-main"><div><strong>${escapeHtml(prompt.title || "Untitled prompt")}</strong><span>${escapeHtml(detail)}</span></div><span class="status status-${prompt.status === "published" ? "green" : prompt.status === "draft" ? "gray" : "amber"}">${statusLabel(prompt.status)}</span></div>
            <div class="cms-project-actions"><button class="row-action edit-prompt" data-prompt-id="${prompt.id}" type="button">Edit</button><button class="row-action delete-prompt" data-prompt-id="${prompt.id}" type="button">Delete</button></div>
        </article>`;
        }).join("");
    };

    const init = async () => {
        const supabase = await waitForClient();
        const promptList = document.querySelector("#prompts-list");
        const form = document.querySelector("#prompt-form");
        const message = document.querySelector("#prompt-form-message");
        const promptIdInput = document.querySelector("#prompt-id");
        const editorTitle = document.querySelector("#prompt-editor-title");
        const categorySelect = form?.querySelector('[name="category"]');
        const videoSlot = document.querySelector("#media-video-slot");
        const imageList = document.querySelector("#media-image-list");
        const imageCount = document.querySelector("#image-count");
        const videoInput = document.querySelector("#video-input");
        const imageInput = document.querySelector("#image-input");
        const addImagesButton = document.querySelector("#add-images-button");
        const mediaPanel = document.querySelector("#media-panel");
        const mediaMessage = document.querySelector("#media-message");
        if (!promptList || !form || !categorySelect || !videoSlot || !imageList) return;

        categorySelect.innerHTML = ['<option value="">No category</option>', ...CATEGORIES.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)].join("");
        categorySelect.value = "";

        let media = [];            // [{ key, type, path?, blob?, contentType?, ext?, previewUrl, isNew }]
        let removedPaths = [];     // files that were removed from an existing prompt (deleted from storage after saving)
        let draftId = uid();       // id used for the storage folder (and the row, for new prompts)
        let saving = false;

        const setMediaMessage = (text, isError = false) => { if (mediaMessage) { mediaMessage.textContent = text; mediaMessage.classList.toggle("is-error", Boolean(isError)); } };

        const removeFiles = async (paths) => {
            if (!paths.length) return;
            try { await supabase.storage.from(BUCKET).remove(paths); } catch (error) { console.warn("Could not remove storage files", error); }
        };

        const releasePreviews = () => media.forEach((item) => { if (item.isNew && item.previewUrl) URL.revokeObjectURL(item.previewUrl); });

        const renderMedia = () => {
            const video = media.find((item) => item.type === "video");
            const images = media.filter((item) => item.type === "image");
            videoSlot.innerHTML = video
                ? `<div class="media-item media-item-video"><video src="${escapeHtml(video.previewUrl)}" muted playsinline controls preload="metadata"></video><button class="media-remove" type="button" data-remove="${video.key}" aria-label="Remove video">Remove video</button></div>`
                : '<button class="button secondary" id="add-video-button" type="button">+ Add video</button>';
            imageList.innerHTML = images.map((item, index) => `<div class="media-item"><img src="${escapeHtml(item.previewUrl)}" alt="Image ${index + 1}"><button class="media-remove media-remove-round" type="button" data-remove="${item.key}" aria-label="Remove image ${index + 1}">×</button></div>`).join("");
            imageCount.textContent = `${images.length} / ${MAX_IMAGES}`;
            addImagesButton.disabled = images.length >= MAX_IMAGES || saving;
        };

        const removeItem = (key) => {
            const item = media.find((entry) => entry.key === key);
            if (!item) return;
            if (item.isNew) { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); }
            else removedPaths.push(item.path);
            media = media.filter((entry) => entry.key !== key);
            renderMedia();
        };

        const handleVideo = async (file) => {
            if (!file) return;
            setMediaMessage("Checking video…");
            const okType = /^video\/(mp4|webm)$/.test(file.type) || /\.(mp4|webm)$/i.test(file.name);
            if (!okType) { setMediaMessage("Use an MP4 or WebM video. Phone .mov files are not supported — convert to MP4 first.", true); return; }
            if (file.size > MAX_VIDEO_BYTES) { setMediaMessage(`That video is ${megabytes(file.size)} MB. The limit is 25 MB.`, true); return; }
            let duration;
            try { duration = await readVideoDuration(file); } catch (error) { setMediaMessage(error.message, true); return; }
            if (Number.isFinite(duration) && duration > MAX_VIDEO_SECONDS) { setMediaMessage(`That video is ${Math.round(duration)} seconds long. Keep it to about 15 seconds.`, true); return; }
            const existing = media.find((item) => item.type === "video");
            if (existing) removeItem(existing.key);
            const isWebm = /webm/.test(file.type) || /\.webm$/i.test(file.name);
            media.unshift({ key: uid(), type: "video", blob: file, contentType: file.type || (isWebm ? "video/webm" : "video/mp4"), ext: isWebm ? "webm" : "mp4", previewUrl: URL.createObjectURL(file), isNew: true });
            setMediaMessage(`Video ready (${megabytes(file.size)} MB). It uploads when you save.`);
            renderMedia();
        };

        const handleImages = async (fileList) => {
            const files = Array.from(fileList || []);
            if (!files.length) return;
            const errors = [];
            let added = 0;
            for (const file of files) {
                if (media.filter((item) => item.type === "image").length >= MAX_IMAGES) { errors.push(`Only ${MAX_IMAGES} images are allowed per prompt.`); break; }
                if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { errors.push(`${file.name}: use JPG, PNG or WebP.`); continue; }
                if (file.size > MAX_IMAGE_INPUT_BYTES) { errors.push(`${file.name}: larger than 20 MB.`); continue; }
                setMediaMessage(`Processing ${file.name}…`);
                try {
                    const result = await compressImage(file);
                    media.push({ key: uid(), type: "image", blob: result.blob, contentType: result.contentType, ext: result.ext, previewUrl: URL.createObjectURL(result.blob), isNew: true });
                    added += 1;
                } catch (error) { errors.push(error.message); }
            }
            renderMedia();
            setMediaMessage(errors.length ? errors.join(" ") : `${added} image${added === 1 ? "" : "s"} added. They upload when you save.`, errors.length > 0);
        };

        const resetForm = () => {
            releasePreviews();
            media = []; removedPaths = [];
            form.reset();
            promptIdInput.value = "";
            categorySelect.value = "";
            draftId = uid();
            editorTitle.textContent = "Add Prompt";
            setMediaMessage("");
            renderMedia();
        };

        const loadPrompts = async () => {
            const { data, error } = await supabase.from("free_prompts").select("id,title,slug,category,description,prompt_text,status,media,created_at,updated_at").order("created_at", { ascending: false });
            if (error) { promptList.innerHTML = `<div class="empty-state">Unable to load prompts: ${escapeHtml(error.message)}</div>`; return; }
            renderPrompts(data || []);
        };

        const setSaving = (value) => {
            saving = value;
            form.querySelectorAll("button").forEach((button) => { button.disabled = value; });
            renderMedia();
        };

        // Save Draft / Publish buttons choose the status before the form submits.
        form.querySelectorAll("button[type='submit']").forEach((button) => {
            button.addEventListener("click", () => { form.querySelector('[name="status"]').value = button.dataset.status; });
        });

        mediaPanel.addEventListener("click", (event) => {
            const removeButton = event.target.closest("[data-remove]");
            if (removeButton) { removeItem(removeButton.dataset.remove); setMediaMessage(""); return; }
            if (event.target.closest("#add-video-button")) videoInput.click();
        });
        addImagesButton.addEventListener("click", () => imageInput.click());
        videoInput.addEventListener("change", async () => { const file = videoInput.files[0]; videoInput.value = ""; await handleVideo(file); });
        imageInput.addEventListener("change", async () => { const files = Array.from(imageInput.files); imageInput.value = ""; await handleImages(files); });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (saving) return;
            const formData = new FormData(form);
            const title = String(formData.get("title") || "").trim();
            const promptText = String(formData.get("prompt_text") || "").replace(/\r\n/g, "\n").trim();
            if (!promptText) { message.textContent = "The prompt text is required."; return; }

            const promptId = promptIdInput.value;
            const rowId = promptId || draftId;
            // Internal web address, created automatically (never typed). The short id makes it unique, so titles can repeat.
            const slug = `${slugify(title) || "prompt"}-${rowId.replace(/-/g, "").slice(0, 8)}`;

            setSaving(true);
            const uploaded = [];
            try {
                const pending = media.filter((item) => item.isNew);
                for (let index = 0; index < pending.length; index += 1) {
                    const item = pending[index];
                    message.textContent = `Uploading ${item.type} ${index + 1} of ${pending.length}…`;
                    item.path = `${FOLDER}/${rowId}/${item.type}-${Date.now()}-${index}.${item.ext}`;
                    const { error } = await supabase.storage.from(BUCKET).upload(item.path, item.blob, { contentType: item.contentType, cacheControl: "31536000", upsert: false });
                    if (error) throw error;
                    uploaded.push(item.path);
                }

                message.textContent = "Saving…";
                const ordered = [...media.filter((item) => item.type === "video"), ...media.filter((item) => item.type === "image")];
                const prompt = {
                    title: title || null,
                    category: String(formData.get("category") || "") || null,
                    description: String(formData.get("description") || "").trim() || null,
                    prompt_text: promptText,
                    media: ordered.map((item) => ({ type: item.type, path: item.path })),
                    status: String(formData.get("status") || "draft")
                };
                const request = promptId ? supabase.from("free_prompts").update(prompt).eq("id", promptId) : supabase.from("free_prompts").insert({ id: rowId, slug, ...prompt });
                const { error } = await request;
                if (error) throw error;

                await removeFiles(removedPaths);
                message.textContent = prompt.status === "published" ? "Prompt published." : "Prompt saved as draft.";
                setSaving(false);
                resetForm();
                await loadPrompts();
            } catch (error) {
                await removeFiles(uploaded);
                media.forEach((item) => { if (item.isNew) delete item.path; });
                message.textContent = (error?.message || "Could not save the prompt.");
                setSaving(false);
            }
        });

        promptList.addEventListener("click", async (event) => {
            const editButton = event.target.closest(".edit-prompt");
            const deleteButton = event.target.closest(".delete-prompt");
            if (editButton) {
                const { data, error } = await supabase.from("free_prompts").select("*").eq("id", editButton.dataset.promptId).single();
                if (error) { message.textContent = error.message; return; }
                releasePreviews();
                removedPaths = [];
                promptIdInput.value = data.id;
                draftId = data.id;
                form.querySelector('[name="title"]').value = data.title || "";
                if (data.category && !CATEGORIES.includes(data.category)) {
                    categorySelect.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(data.category)}">${escapeHtml(data.category)}</option>`);
                }
                categorySelect.value = data.category || "";
                form.querySelector('[name="description"]').value = data.description || "";
                form.querySelector('[name="prompt_text"]').value = data.prompt_text || "";
                form.querySelector('[name="status"]').value = data.status || "draft";
                media = (Array.isArray(data.media) ? data.media : []).filter(validMedia).map((item) => ({ key: uid(), type: item.type, path: item.path, previewUrl: publicUrl(item.path), isNew: false }));
                renderMedia();
                setMediaMessage("");
                editorTitle.textContent = "Edit Prompt"; message.textContent = "";
                document.querySelector("#prompt-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); return;
            }
            if (deleteButton) {
                if (!window.confirm("Delete this prompt and its images/video? This cannot be undone.")) return;
                const { data: existing } = await supabase.from("free_prompts").select("media").eq("id", deleteButton.dataset.promptId).single();
                const { error } = await supabase.from("free_prompts").delete().eq("id", deleteButton.dataset.promptId);
                if (error) { message.textContent = error.message; return; }
                await removeFiles((Array.isArray(existing?.media) ? existing.media : []).filter(validMedia).map((item) => item.path));
                message.textContent = "Prompt deleted."; await loadPrompts();
            }
        });

        const clearButton = document.querySelector("#cancel-prompt");
        if (clearButton) clearButton.addEventListener("click", () => { resetForm(); message.textContent = ""; });
        const newPromptButton = document.querySelector("#new-prompt-button");
        if (newPromptButton) newPromptButton.addEventListener("click", () => { resetForm(); message.textContent = ""; document.querySelector("#prompt-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); form.querySelector('[name="title"]').focus(); });

        renderMedia();
        await loadPrompts();
    };

    window.addEventListener("DOMContentLoaded", () => init().catch((error) => console.error("Prompt manager failed to initialize", error)));
})();

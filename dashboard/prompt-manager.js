(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    if (!config?.url || !config?.publishableKey || config.publishableKey.includes("PASTE_YOUR")) return;

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
        container.innerHTML = prompts.map((prompt) => `<article class="cms-project-row">
            <div class="cms-project-cover" aria-hidden="true">PROMPT</div>
            <div class="cms-project-main"><div><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.category || "Other")}</span></div><span class="status status-${prompt.status === "published" ? "green" : prompt.status === "draft" ? "gray" : "amber"}">${statusLabel(prompt.status)}</span></div>
            <div class="cms-project-actions"><button class="row-action edit-prompt" data-prompt-id="${prompt.id}" type="button">Edit</button><button class="row-action delete-prompt" data-prompt-id="${prompt.id}" type="button">Delete</button></div>
        </article>`).join("");
    };

    const init = async () => {
        const supabase = await waitForClient();
        const promptList = document.querySelector("#prompts-list");
        const form = document.querySelector("#prompt-form");
        const message = document.querySelector("#prompt-form-message");
        const promptIdInput = document.querySelector("#prompt-id");
        const editorTitle = document.querySelector("#prompt-editor-title");
        const categorySelect = form?.querySelector('[name="category"]');
        if (!promptList || !form || !categorySelect) return;

        categorySelect.innerHTML = CATEGORIES.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
        categorySelect.value = "Website Building";

        const resetForm = () => {
            form.reset();
            promptIdInput.value = "";
            categorySelect.value = "Website Building";
            editorTitle.textContent = "Add Prompt";
        };

        const loadPrompts = async () => {
            const { data, error } = await supabase.from("free_prompts").select("id,title,slug,category,description,prompt_text,status,created_at,updated_at").order("created_at", { ascending: false });
            if (error) { promptList.innerHTML = `<div class="empty-state">Unable to load prompts: ${escapeHtml(error.message)}</div>`; return; }
            renderPrompts(data || []);
        };

        // Save Draft / Publish buttons choose the status before the form submits.
        form.querySelectorAll("button[type='submit']").forEach((button) => {
            button.addEventListener("click", () => { form.querySelector('[name="status"]').value = button.dataset.status; });
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault(); message.textContent = "Saving…";
            const formData = new FormData(form);
            const title = String(formData.get("title") || "").trim();
            const slug = slugify(formData.get("slug")) || slugify(title);
            const promptText = String(formData.get("prompt_text") || "").replace(/\r\n/g, "\n").trim();
            if (!title) { message.textContent = "Prompt title is required."; return; }
            if (!promptText) { message.textContent = "The prompt text is required."; return; }
            const prompt = {
                title,
                slug,
                category: String(formData.get("category") || "Other"),
                description: String(formData.get("description") || "").trim() || null,
                prompt_text: promptText,
                status: String(formData.get("status") || "draft")
            };
            const promptId = promptIdInput.value;
            const request = promptId ? supabase.from("free_prompts").update(prompt).eq("id", promptId) : supabase.from("free_prompts").insert(prompt);
            const { error } = await request;
            if (error) { message.textContent = error.code === "23505" ? "A prompt with this slug already exists. Change the slug and try again." : error.message; return; }
            message.textContent = prompt.status === "published" ? "Prompt published." : "Prompt saved as draft.";
            resetForm(); await loadPrompts();
        });

        promptList.addEventListener("click", async (event) => {
            const editButton = event.target.closest(".edit-prompt");
            const deleteButton = event.target.closest(".delete-prompt");
            if (editButton) {
                const { data, error } = await supabase.from("free_prompts").select("*").eq("id", editButton.dataset.promptId).single();
                if (error) { message.textContent = error.message; return; }
                promptIdInput.value = data.id;
                form.querySelector('[name="title"]').value = data.title || "";
                form.querySelector('[name="slug"]').value = data.slug || "";
                if (data.category && !CATEGORIES.includes(data.category)) {
                    categorySelect.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(data.category)}">${escapeHtml(data.category)}</option>`);
                }
                categorySelect.value = data.category || "Other";
                form.querySelector('[name="description"]').value = data.description || "";
                form.querySelector('[name="prompt_text"]').value = data.prompt_text || "";
                form.querySelector('[name="status"]').value = data.status || "draft";
                editorTitle.textContent = "Edit Prompt"; message.textContent = "";
                document.querySelector("#prompt-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); return;
            }
            if (deleteButton) {
                if (!window.confirm("Delete this prompt? This cannot be undone.")) return;
                const { error } = await supabase.from("free_prompts").delete().eq("id", deleteButton.dataset.promptId);
                if (error) { message.textContent = error.message; return; }
                message.textContent = "Prompt deleted."; await loadPrompts();
            }
        });

        const clearButton = document.querySelector("#cancel-prompt");
        if (clearButton) clearButton.addEventListener("click", () => { resetForm(); message.textContent = ""; });
        const newPromptButton = document.querySelector("#new-prompt-button");
        if (newPromptButton) newPromptButton.addEventListener("click", () => { resetForm(); message.textContent = ""; document.querySelector("#prompt-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); form.querySelector('[name="title"]').focus(); });
        await loadPrompts();
    };

    window.addEventListener("DOMContentLoaded", () => init().catch((error) => console.error("Prompt manager failed to initialize", error)));
})();

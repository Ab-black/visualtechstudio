(() => {
    const config = window.VISUAL_TECH_SUPABASE;

    if (!config || !config.url || config.publishableKey.includes("PASTE_YOUR")) {
        return;
    }

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

    const statusLabel = (status) => {
        const labels = {
            draft: "Draft",
            published: "Published",
            archived: "Archived"
        };
        return labels[status] || status;
    };

    const escapeHtml = (value = "") => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const renderProjects = (projects) => {
        const container = document.querySelector("#projects-list");
        if (!container) return;

        if (!projects.length) {
            container.innerHTML = '<div class="empty-state">No projects found. Create your first project.</div>';
            return;
        }

        container.innerHTML = projects.map((project) => `
            <article class="cms-project-row">
                <div class="cms-project-cover" aria-hidden="true">${project.cover_path ? "IMAGE" : "PROJECT"}</div>
                <div class="cms-project-main">
                    <div>
                        <strong>${escapeHtml(project.title)}</strong>
                        <span>${escapeHtml(project.category || "Uncategorised")}</span>
                    </div>
                    <span class="status status-${project.status === "published" ? "green" : project.status === "draft" ? "gray" : "amber"}">${statusLabel(project.status)}</span>
                </div>
                <div class="cms-project-actions">
                    <button class="row-action edit-project" data-project-id="${project.id}" type="button">Edit</button>
                    <button class="row-action delete-project" data-project-id="${project.id}" type="button">Delete</button>
                </div>
            </article>
        `).join("");
    };

    const init = async () => {
        const supabase = await loadSupabase();
        const projectList = document.querySelector("#projects-list");
        const form = document.querySelector("#project-form");
        const message = document.querySelector("#project-form-message");
        const projectIdInput = document.querySelector("#project-id");

        if (!projectList || !form) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            projectList.innerHTML = '<div class="empty-state">Sign in as an administrator to manage projects.</div>';
            return;
        }

        const loadProjects = async () => {
            const { data, error } = await supabase
                .from("projects")
                .select("id,title,slug,category,description,cover_path,status,created_at,updated_at")
                .order("created_at", { ascending: false });

            if (error) {
                projectList.innerHTML = `<div class="empty-state">Unable to load projects: ${escapeHtml(error.message)}</div>`;
                return;
            }

            renderProjects(data || []);
        };

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            message.textContent = "Saving…";

            const formData = new FormData(form);
            const title = String(formData.get("title") || "").trim();
            const slug = String(formData.get("slug") || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
            const project = {
                title,
                slug,
                category: String(formData.get("category") || "").trim() || null,
                description: String(formData.get("description") || "").trim() || null,
                cover_path: String(formData.get("cover_path") || "").trim() || null,
                status: String(formData.get("status") || "draft")
            };

            if (!title) {
                message.textContent = "Project title is required.";
                return;
            }

            const projectId = projectIdInput.value;
            const request = projectId
                ? supabase.from("projects").update(project).eq("id", projectId)
                : supabase.from("projects").insert(project);

            const { error } = await request;
            if (error) {
                message.textContent = error.message;
                return;
            }

            message.textContent = project.status === "published" ? "Project published." : "Project saved as draft.";
            form.reset();
            projectIdInput.value = "";
            await loadProjects();
        });

        projectList.addEventListener("click", async (event) => {
            const editButton = event.target.closest(".edit-project");
            const deleteButton = event.target.closest(".delete-project");

            if (editButton) {
                const { data, error } = await supabase
                    .from("projects")
                    .select("*")
                    .eq("id", editButton.dataset.projectId)
                    .single();

                if (error) {
                    message.textContent = error.message;
                    return;
                }

                projectIdInput.value = data.id;
                form.querySelector('[name="title"]').value = data.title || "";
                form.querySelector('[name="slug"]').value = data.slug || "";
                form.querySelector('[name="category"]').value = data.category || "";
                form.querySelector('[name="description"]').value = data.description || "";
                form.querySelector('[name="cover_path"]').value = data.cover_path || "";
                form.querySelector('[name="status"]').value = data.status || "draft";
                form.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            if (deleteButton) {
                if (!window.confirm("Delete this project? This cannot be undone.")) return;

                const { error } = await supabase
                    .from("projects")
                    .delete()
                    .eq("id", deleteButton.dataset.projectId);

                if (error) {
                    message.textContent = error.message;
                    return;
                }

                message.textContent = "Project deleted.";
                await loadProjects();
            }
        });

        await loadProjects();
    };

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => console.error("Project manager failed to initialize", error));
    });
})();

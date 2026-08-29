(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    if (!config?.url || !config?.publishableKey || config.publishableKey.includes("PASTE_YOUR")) return;

    const escapeHtml = (value = "") => String(value)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

    const loadSupabase = () => new Promise((resolve, reject) => {
        if (window.supabase) return resolve(window.supabase.createClient(config.url, config.publishableKey));
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey));
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const publicAssetUrl = (path) => {
        if (!path) return "../images/Design 4.jpeg";
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith("../") || path.startsWith("/")) return path;
        // Existing hardcoded project images live in the repository's images folder.
        if (path.startsWith("images/")) return `../${path}`;
        // Supabase storage paths can be used for newly uploaded project covers.
        return `${config.url}/storage/v1/object/public/public-assets/${path.split("/").map(encodeURIComponent).join("/")}`;
    };

    const renderProjects = (projects) => {
        const grid = document.querySelector("#public-projects-grid");
        if (!grid || !projects.length) return;
        grid.innerHTML = projects.map((project, index) => {
            const featured = index === 0 || index === 3 ? " work-item-featured" : "";
            return `<article class="work-item${featured}">
                <img src="${escapeHtml(publicAssetUrl(project.cover_path))}" alt="${escapeHtml(project.title)}" loading="lazy">
                <div class="work-item-meta">
                    <div>
                        <p class="project-category">${escapeHtml(project.category || "Digital Experience")}</p>
                        <h3>${escapeHtml(project.title)}</h3>
                        <p>${escapeHtml(project.description || "A considered project developed with clarity, intention, and a strong visual system.")}</p>
                    </div>
                    <a href="../contact/" class="text-link">Start a Similar Project →</a>
                </div>
            </article>`;
        }).join("");
    };

    const init = async () => {
        const grid = document.querySelector("#public-projects-grid");
        if (!grid) return;
        try {
            const supabase = await loadSupabase();
            const { data, error } = await supabase.from("projects")
                .select("id,title,slug,category,description,cover_path,status,created_at")
                .eq("status", "published")
                .order("created_at", { ascending: false });
            if (error) throw error;
            // Keep the existing four hardcoded projects visible if the database is empty.
            if (data?.length) renderProjects(data);
        } catch (error) {
            // Never alter the existing public page when the database is unavailable.
            console.error("Unable to load published projects; keeping existing projects", error);
        }
    };

    window.addEventListener("DOMContentLoaded", () => init().catch((error) => console.error("Public projects failed to initialize", error)));
})();
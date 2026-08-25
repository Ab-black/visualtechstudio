(() => {
    const config = window.VISUAL_TECH_SUPABASE;

    if (!config || !config.url || !config.publishableKey || config.publishableKey.includes("PASTE_YOUR")) {
        return;
    }

    const escapeHtml = (value = "") => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

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

    const renderProjects = (projects) => {
        const grid = document.querySelector(".work-grid");
        if (!grid || !projects.length) return;

        grid.innerHTML = projects.map((project, index) => {
            const cover = project.cover_path
                ? project.cover_path.startsWith("http")
                    ? project.cover_path
                    : project.cover_path
                : "../images/Design 4.jpeg";
            const category = project.category || "Digital Experience";
            const description = project.description || "A considered project developed with clarity, intention, and a strong visual system.";
            const featured = index === 0 || index === 3 ? " work-item-featured" : "";

            return `
                <article class="work-item${featured}">
                    <img src="${escapeHtml(cover)}" alt="${escapeHtml(project.title)}" loading="lazy">
                    <div class="work-item-meta">
                        <div>
                            <p class="project-category">${escapeHtml(category)}</p>
                            <h3>${escapeHtml(project.title)}</h3>
                            <p>${escapeHtml(description)}</p>
                        </div>
                        <a href="../contact/" class="text-link">Start a Similar Project →</a>
                    </div>
                </article>
            `;
        }).join("");
    };

    const init = async () => {
        const grid = document.querySelector(".work-grid");
        if (!grid) return;

        const supabase = await loadSupabase();
        const { data, error } = await supabase
            .from("projects")
            .select("id,title,slug,category,description,cover_path,status,created_at")
            .eq("status", "published")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Unable to load published projects", error);
            return;
        }

        renderProjects(data || []);
    };

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => console.error("Public projects failed to initialize", error));
    });
})();

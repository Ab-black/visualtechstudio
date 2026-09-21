(() => {
    const SUPABASE_URL = "https://mzrtktzetgyilwpgppgy.supabase.co";
    const SUPABASE_KEY = "sb_publishable_iA278OPPE-CaPeKIM8Wn4w_guJgSOp7";
    const PROJECT_TABLE = "projects";

    const escapeHtml = (value = "") => String(value).replace(/[&<>\"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&#039;"
    }[char]));

    const resolveImage = (path) => {
        if (!path) return "";
        if (/^(https?:|data:|blob:)/i.test(path)) return path;
        const normalized = String(path).replace(/^\/+/, "");
        if (normalized.startsWith("images/")) {
            return normalized.split("/").map(encodeURIComponent).join("/");
        }
        return `${SUPABASE_URL}/storage/v1/object/public/public-assets/${normalized.split("/").map(encodeURIComponent).join("/")}`;
    };

    const loadSupabase = () => new Promise((resolve, reject) => {
        if (window.supabase?.createClient) {
            resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            }));
            return;
        }
        const existing = document.querySelector('script[data-home-supabase="true"]');
        if (existing) {
            existing.addEventListener("load", () => resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            })), { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.dataset.homeSupabase = "true";
        script.onload = () => resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        }));
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const renderProjects = (track, projects) => {
        track.innerHTML = projects.map((project) => {
            const image = resolveImage(project.cover_path);
            const title = project.title || "Selected project";
            const category = project.category || "Visual Design";
            return `<article class="card" data-project-id="${escapeHtml(project.id)}">
                ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">` : "<div class=\"project-image-placeholder\" aria-hidden=\"true\"></div>"}
                <div class="project-meta">
                    <div>
                        <p class="project-category">${escapeHtml(category)}</p>
                    </div>
                </div>
            </article>`;
        }).join("");
    };

    const init = async () => {
        const slider = document.querySelector(".slider-elite");
        const track = slider?.querySelector(".track");
        const nextBtn = slider?.querySelector(".next");
        const prevBtn = slider?.querySelector(".prev");
        if (!slider || !track || !nextBtn || !prevBtn) return;

        try {
            const supabase = await loadSupabase();
            const { data, error } = await supabase
                .from(PROJECT_TABLE)
                .select("id,title,category,cover_path,status,created_at")
                .eq("status", "published")
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Published projects are the homepage source of truth. If none exist,
            // keep the existing hardcoded cards rather than leaving the section empty.
            if (Array.isArray(data) && data.length > 0) {
                renderProjects(track, data);
            } else {
                return;
            }

            // Initialize a continuous carousel with cloned boundary slides.
            // The clones remove the visible jump when moving from the last project to the first.
            const originalCards = Array.from(track.querySelectorAll(".card"));
            if (originalCards.length < 2) {
                originalCards.forEach((card, cardIndex) => card.classList.toggle("active", cardIndex === 0));
                return;
            }

            const firstClone = originalCards[0].cloneNode(true);
            const lastClone = originalCards[originalCards.length - 1].cloneNode(true);
            firstClone.setAttribute("aria-hidden", "true");
            lastClone.setAttribute("aria-hidden", "true");
            firstClone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
            lastClone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
            track.insertBefore(lastClone, originalCards[0]);
            track.appendChild(firstClone);

            const cards = Array.from(track.querySelectorAll(".card"));
            const realCount = originalCards.length;
            let index = 1;
            let autoPlay = null;
            let startX = 0;
            let startY = 0;
            let pointerStartX = 0;
            let isPointerDown = false;
            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

            const setTransition = (enabled = true) => {
                track.style.transitionDuration = enabled && !reducedMotion.matches ? "" : "0ms";
            };

            const updateSlider = (animate = true) => {
                const width = slider.clientWidth;
                setTransition(animate);
                track.style.transform = `translate3d(-${index * width}px, 0, 0)`;
                cards.forEach((card, cardIndex) => {
                    card.classList.toggle("active", cardIndex === index);
                });
            };

            const normalizeAfterClone = () => {
                if (index === realCount + 1) {
                    index = 1;
                    updateSlider(false);
                } else if (index === 0) {
                    index = realCount;
                    updateSlider(false);
                }
            };

            track.addEventListener("transitionend", (event) => {
                if (event.propertyName !== "transform") return;
                normalizeAfterClone();
            });

            const nextSlide = () => {
                index += 1;
                updateSlider();
            };

            const prevSlide = () => {
                index -= 1;
                updateSlider();
            };

            const startAuto = () => {
                if (reducedMotion.matches || realCount < 2) return;
                autoPlay = window.setInterval(nextSlide, 6000);
            };

            const restartAuto = () => {
                if (autoPlay) window.clearInterval(autoPlay);
                startAuto();
            };

            const pauseAuto = () => {
                if (autoPlay) {
                    window.clearInterval(autoPlay);
                    autoPlay = null;
                }
            };

            const resumeAuto = () => {
                if (!reducedMotion.matches && realCount > 1 && !autoPlay) startAuto();
            };

            nextBtn.onclick = () => { nextSlide(); restartAuto(); };
            prevBtn.onclick = () => { prevSlide(); restartAuto(); };

            slider.addEventListener("mouseenter", () => {
                slider.classList.add("is-interacting");
                pauseAuto();
            });
            slider.addEventListener("mouseleave", () => {
                slider.classList.remove("is-interacting");
                resumeAuto();
            });
            slider.addEventListener("focusin", pauseAuto);
            slider.addEventListener("focusout", (event) => {
                if (!slider.contains(event.relatedTarget)) resumeAuto();
            });

            track.ontouchstart = (event) => {
                startX = event.touches[0].clientX;
                startY = event.touches[0].clientY;
                pauseAuto();
            };
            track.ontouchend = (event) => {
                const deltaX = event.changedTouches[0].clientX - startX;
                const deltaY = event.changedTouches[0].clientY - startY;
                if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) >= Math.abs(deltaY)) {
                    deltaX < 0 ? nextSlide() : prevSlide();
                }
                restartAuto();
            };

            track.onpointerdown = (event) => {
                if (event.pointerType === "mouse") return;
                pointerStartX = event.clientX;
                isPointerDown = true;
            };
            track.onpointerup = (event) => {
                if (!isPointerDown || event.pointerType === "mouse") return;
                const deltaX = event.clientX - pointerStartX;
                isPointerDown = false;
                if (Math.abs(deltaX) >= 50) deltaX < 0 ? nextSlide() : prevSlide();
                restartAuto();
            };
            track.onpointercancel = () => {
                isPointerDown = false;
                restartAuto();
            };

            window.addEventListener("resize", () => updateSlider(false));
            updateSlider(false);
            startAuto();
        } catch (error) {
            // Keep the original hardcoded homepage cards intact if Supabase is
            // temporarily unavailable. The page remains usable instead of blank.
            console.warn("Homepage projects could not be loaded from Supabase:", error);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
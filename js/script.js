document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const siteNav = document.querySelector(".site-nav");
    const track = document.querySelector(".track");
    const cards = Array.from(document.querySelectorAll(".card"));
    const nextBtn = document.querySelector(".next");
    const prevBtn = document.querySelector(".prev");
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* =========================
       ACCESSIBLE MOTION STYLES
       Uses the existing design tokens from style.css.
    ========================= */
    const motionStyle = document.createElement("style");
    motionStyle.textContent = `
        .js-reveal {
            opacity: 0;
            transform: translateY(var(--space-6));
            transition: opacity var(--duration-slow) var(--ease-premium), transform var(--duration-slow) var(--ease-premium);
        }

        .js-reveal.is-visible {
            opacity: 1;
            transform: translateY(0);
        }

        .js-image-reveal {
            overflow: hidden;
            clip-path: inset(0 0 100% 0);
            transition: clip-path var(--duration-major) var(--ease-premium);
        }

        .js-image-reveal.is-visible {
            clip-path: inset(0 0 0 0);
        }

        @media (prefers-reduced-motion: reduce) {
            .js-reveal,
            .js-reveal.is-visible {
                opacity: 1;
                transform: none;
                transition: none;
            }

            .js-image-reveal,
            .js-image-reveal.is-visible {
                clip-path: none;
                transition: none;
            }
        }
    `;
    document.head.appendChild(motionStyle);

    /* =========================
       NAVIGATION ON SCROLL
    ========================= */
    if (siteNav) {
        const updateNavigation = () => {
            siteNav.classList.toggle("is-scrolled", window.scrollY > 24);
        };

        updateNavigation();
        window.addEventListener("scroll", updateNavigation, { passive: true });
    }

    /* =========================
       SCROLL REVEALS
    ========================= */
    const revealElements = document.querySelectorAll(
        ".editorial-section, .services-section, .portfolio-section, .store-preview, .contact-section, .service-card, .project-meta"
    );
    const revealImages = document.querySelectorAll(".card img");

    revealElements.forEach((element) => element.classList.add("js-reveal"));
    revealImages.forEach((image) => image.classList.add("js-image-reveal"));

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
        revealElements.forEach((element) => element.classList.add("is-visible"));
        revealImages.forEach((image) => image.classList.add("is-visible"));
    } else {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

        revealElements.forEach((element) => revealObserver.observe(element));
        revealImages.forEach((image) => revealObserver.observe(image));
    }

    /* =========================
       MOBILE NAVIGATION
    ========================= */
    if (menuToggle && navMenu) {
        const closeMenu = () => {
            navMenu.classList.remove("is-open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");
        };

        menuToggle.addEventListener("click", () => {
            const isOpen = navMenu.classList.toggle("is-open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        });

        navMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeMenu();
        });
    }

    /* =========================
       PROJECT SLIDER
    ========================= */
    if (!track || !cards.length || !nextBtn || !prevBtn) return;

    let index = 0;
    let autoPlay = null;
    let startX = 0;
    let startY = 0;

    function updateSlider(animate = true) {
        const width = track.clientWidth;
        track.style.transitionDuration = animate && !reducedMotion.matches ? "" : "0ms";
        track.style.transform = `translate3d(-${index * width}px, 0, 0)`;

        cards.forEach((card, cardIndex) => {
            card.classList.toggle("active", cardIndex === index);
        });
    }

    function nextSlide() {
        index = (index + 1) % cards.length;
        updateSlider();
    }

    function prevSlide() {
        index = (index - 1 + cards.length) % cards.length;
        updateSlider();
    }

    function startAuto() {
        if (reducedMotion.matches || cards.length < 2) return;
        autoPlay = window.setInterval(nextSlide, 6000);
    }

    function restartAuto() {
        if (autoPlay) window.clearInterval(autoPlay);
        startAuto();
    }

    nextBtn.addEventListener("click", () => {
        nextSlide();
        restartAuto();
    });

    prevBtn.addEventListener("click", () => {
        prevSlide();
        restartAuto();
    });

    track.addEventListener("touchstart", (event) => {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    }, { passive: true });

    track.addEventListener("touchend", (event) => {
        const endX = event.changedTouches[0].clientX;
        const endY = event.changedTouches[0].clientY;
        const deltaX = endX - startX;
        const deltaY = endY - startY;

        if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;

        if (deltaX < 0) nextSlide();
        else prevSlide();

        restartAuto();
    }, { passive: true });

    window.addEventListener("resize", () => updateSlider(false));

    reducedMotion.addEventListener?.("change", () => {
        restartAuto();
        updateSlider(false);
    });

    updateSlider(false);
    startAuto();
});

document.addEventListener("DOMContentLoaded", () => {
    const track = document.querySelector(".track");
    const cards = Array.from(document.querySelectorAll(".card"));
    const nextBtn = document.querySelector(".next");
    const prevBtn = document.querySelector(".prev");
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");

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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

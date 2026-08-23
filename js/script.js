document.addEventListener("DOMContentLoaded", () => {
    const siteNav = document.querySelector(".site-nav");
    const track = document.querySelector(".track");
    const cards = Array.from(document.querySelectorAll(".card"));
    const nextBtn = document.querySelector(".next");
    const prevBtn = document.querySelector(".prev");
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

        @media (prefers-reduced-motion: reduce) {
            .js-reveal,
            .js-reveal.is-visible {
                opacity: 1;
                transform: none;
                transition: none;
            }
        }
    `;

    document.head.appendChild(motionStyle);

    if (siteNav) {
        const updateNavigation = () => {
            siteNav.classList.toggle("is-scrolled", window.scrollY > 24);
        };

        updateNavigation();
        window.addEventListener("scroll", updateNavigation, { passive: true });
    }

    const revealElements = document.querySelectorAll(
        ".editorial-section, .services-section, .portfolio-section, .store-preview, .contact-section, .service-card, .project-meta"
    );

    revealElements.forEach((element) => {
        element.classList.add("js-reveal");
    });

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
        revealElements.forEach((element) => {
            element.classList.add("is-visible");
        });
    } else {
        const revealObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -8% 0px"
            }
        );

        revealElements.forEach((element) => {
            revealObserver.observe(element);
        });
    }

    if (menuToggle && navMenu) {
        const closeMenu = () => {
            navMenu.classList.remove("is-open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");
        };

        menuToggle.addEventListener("click", () => {
            const isOpen = navMenu.classList.toggle("is-open");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation menu" : "Open navigation menu"
            );
        });

        navMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMenu();
            }
        });
    }

    /* =========================
       RESOURCE DETAIL MODALS
    ========================= */
    const resourceModal = document.querySelector("#resource-modal");
    const resourceModalTitle = document.querySelector("#resource-modal-title");
    const resourceModalType = document.querySelector("#resource-modal-type");
    const resourceModalSummary = document.querySelector("#resource-modal-summary");
    const resourceModalBody = document.querySelector("#resource-modal-body");
    const resourceModalClose = document.querySelector(".resource-modal-close");
    const resourceTriggers = document.querySelectorAll(".resource-trigger");

    const resources = {
        "premium-website": {
            type: "INSIGHT",
            title: "What makes a premium website feel premium?",
            summary: "Premium design is less about decoration and more about deliberate decisions.",
            body: "Typography establishes character, spacing creates rhythm, hierarchy tells visitors where to look, and interaction adds confidence. The strongest premium websites also know when to stop. Restraint gives important details room to breathe."
        },
        "homepage-checklist": {
            type: "GUIDE",
            title: "A practical homepage content checklist.",
            summary: "Before visual design begins, make sure the homepage answers the questions that matter most.",
            body: "Clarify who the site is for, what the business offers, why it is different, what action visitors should take, and what proof supports the promise. Then organize the content into a clear sequence: positioning, value, evidence, services or work, and a strong next step."
        },
        "creative-brief": {
            type: "TOOL",
            title: "Creative brief starter.",
            summary: "Use this framework to turn an early idea into a focused project brief.",
            body: "Start with the objective, audience, problem, desired outcome, key message, deliverables, references, constraints, timeline, and success criteria. Keep the brief short enough to use, but specific enough that every major design decision has context."
        },
        "less-decoration": {
            type: "INSIGHT",
            title: "Why good interfaces need less decoration.",
            summary: "Clarity is a design feature. Decoration should support the experience, not compete with it.",
            body: "When hierarchy, spacing, typography, and contrast are doing their jobs, an interface needs fewer visual effects to feel finished. Removing unnecessary elements can make important actions easier to find and the overall experience easier to understand."
        },
        "design-systems": {
            type: "GUIDE · 12 MIN READ",
            title: "Design systems that stay useful as a business grows.",
            summary: "A practical look at structure, consistency, and the decisions that make a design system easier to use.",
            body: "A useful design system starts with foundations such as typography, color, spacing, components, states, and accessibility. The system should make common decisions easier without preventing thoughtful exceptions when the content genuinely requires them."
        }
    };

    let lastFocusedElement = null;

    function openResource(resourceKey) {
        const resource = resources[resourceKey];

        if (!resourceModal || !resource || !resourceModalTitle || !resourceModalType || !resourceModalSummary || !resourceModalBody) {
            return;
        }

        lastFocusedElement = document.activeElement;
        resourceModalType.textContent = resource.type;
        resourceModalTitle.textContent = resource.title;
        resourceModalSummary.textContent = resource.summary;
        resourceModalBody.innerHTML = `<p>${resource.body}</p>`;
        resourceModal.hidden = false;
        document.body.style.overflow = "hidden";
        resourceModalClose?.focus();
    }

    function closeResource() {
        if (!resourceModal) {
            return;
        }

        resourceModal.hidden = true;
        document.body.style.overflow = "";
        lastFocusedElement?.focus();
        lastFocusedElement = null;
    }

    resourceTriggers.forEach((trigger) => {
        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            openResource(trigger.dataset.resource);
        });
    });

    resourceModalClose?.addEventListener("click", closeResource);

    resourceModal?.addEventListener("click", (event) => {
        if (event.target === resourceModal) {
            closeResource();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && resourceModal && !resourceModal.hidden) {
            closeResource();
        }
    });

    if (!track || !cards.length || !nextBtn || !prevBtn) {
        return;
    }

    let index = 0;
    let autoPlay = null;
    let startX = 0;
    let startY = 0;

    function updateSlider(animate = true) {
        const width = track.parentElement.clientWidth;

        track.style.transitionDuration =
            animate && !reducedMotion.matches ? "" : "0ms";
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
        if (reducedMotion.matches || cards.length < 2) {
            return;
        }

        autoPlay = window.setInterval(nextSlide, 6000);
    }

    function restartAuto() {
        if (autoPlay) {
            window.clearInterval(autoPlay);
        }

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

    track.addEventListener(
        "touchstart",
        (event) => {
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
        },
        { passive: true }
    );

    track.addEventListener(
        "touchend",
        (event) => {
            const endX = event.changedTouches[0].clientX;
            const endY = event.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) {
                return;
            }

            if (deltaX < 0) {
                nextSlide();
            } else {
                prevSlide();
            }

            restartAuto();
        },
        { passive: true }
    );

    window.addEventListener("resize", () => {
        updateSlider(false);
    });

    reducedMotion.addEventListener?.("change", () => {
        restartAuto();
        updateSlider(false);
    });

    updateSlider(false);
    startAuto();
});
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
            body: "<p>Typography establishes character, spacing creates rhythm, hierarchy tells visitors where to look, and interaction adds confidence. The strongest premium websites also know when to stop. Restraint gives important details room to breathe.</p>"
        },
        "homepage-checklist": {
            type: "GUIDE",
            title: "A practical homepage content checklist.",
            summary: "Before visual design begins, make sure the homepage answers the questions that matter most.",
            body: "<p>Clarify who the site is for, what the business offers, why it is different, what action visitors should take, and what proof supports the promise. Then organize the content into a clear sequence: positioning, value, evidence, services or work, and a strong next step.</p>"
        },
        "creative-brief": {
            type: "TOOL",
            title: "Creative brief starter.",
            summary: "Use this framework to turn an early idea into a focused project brief.",
            body: "<p>Start with the objective, audience, problem, desired outcome, key message, deliverables, references, constraints, timeline, and success criteria. Keep the brief short enough to use, but specific enough that every major design decision has context.</p>"
        },
        "less-decoration": {
            type: "INSIGHT",
            title: "Why good interfaces need less decoration.",
            summary: "Clarity is a design feature. Decoration should support the experience, not compete with it.",
            body: "<p>When hierarchy, spacing, typography, and contrast are doing their jobs, an interface needs fewer visual effects to feel finished. Removing unnecessary elements can make important actions easier to find and the overall experience easier to understand.</p>"
        },
        "design-systems": {
            type: "GUIDE · 12 MIN READ",
            title: "Design systems that stay useful as a business grows.",
            summary: "A practical guide to building a design system that scales with products, teams, content, and business decisions without becoming a rigid visual rulebook.",
            body: `
                <p>A design system becomes valuable when it reduces repeated decisions without reducing the quality of future decisions. That distinction matters. A growing business does not need a larger pile of components; it needs a reliable way to make consistent choices as more people, products, pages, and channels are introduced.</p>

                <blockquote>A useful design system is not a museum of finished screens. It is an operating system for making the next good decision.</blockquote>

                <h3>1. Start with the decisions that repeat</h3>
                <p>The first mistake in many systems is starting with a component catalogue. Buttons, cards, modals, and navigation are visible, so they are easy to document. But the more durable layer sits underneath them: color roles, typography, spacing, grid behavior, radii, elevation, motion, content rules, and interaction states.</p>
                <p>Begin by identifying decisions that appear repeatedly across the business. If teams repeatedly debate whether a secondary action should be muted, how much space a section needs, or which text style represents supporting information, those are system opportunities.</p>

                <h3>2. Build tokens around meaning, not appearance</h3>
                <p>A scalable system should describe what a value does rather than only what it looks like. A token such as <strong>text-primary</strong> is more resilient than a token named <strong>dark-gray-900</strong>, because its role can remain stable even when the underlying color changes.</p>
                <p>The same principle applies to spacing, surfaces, borders, radii, and motion. Semantic tokens create a layer between design decisions and implementation, making controlled evolution much easier.</p>

                <div class="article-note">
                    <strong>Practical test</strong>
                    <p>If changing your brand color requires searching through dozens of unrelated component files, the system is exposing implementation details instead of managing design decisions.</p>
                </div>

                <h3>3. Treat states as first-class design</h3>
                <p>A component is not finished when its default state looks good. Real products need hover, focus, active, disabled, loading, success, error, empty, and sometimes offline or permission states. These states are where inconsistency becomes most visible to users.</p>
                <p>Document the behavior as well as the appearance. For example, define what happens to a button while a payment is processing, what message appears when a form fails validation, and how keyboard focus is shown. This turns accessibility and interaction quality into system behavior rather than last-minute fixes.</p>

                <h3>4. Design for content change, not just the perfect screenshot</h3>
                <p>Businesses grow by changing. Product names get longer. Pricing changes. New languages are introduced. A short headline becomes a two-line headline. A card that once held three items now needs ten. A useful system is tested against these changes deliberately.</p>
                <p>Stress-test components with long text, missing images, large numbers, short labels, multiple statuses, and mobile widths. If a component only works with the original content, it is a mockup—not a system component.</p>

                <h3>5. Establish contribution rules before the system gets crowded</h3>
                <p>Growth creates a governance problem. Without clear contribution rules, every new project adds another “almost the same” component. The system then becomes harder to understand precisely because it is trying to support everything.</p>
                <p>Create a lightweight path for proposing a new pattern: explain the problem, show where the existing system fails, test the pattern in a real use case, review accessibility and responsive behavior, then decide whether the pattern belongs in the shared system or should remain local.</p>

                <h3>6. Measure the system by business friction</h3>
                <p>A mature design system should be evaluated by outcomes, not by the number of components it contains. Useful signals include reduced design and development duplication, faster delivery of common experiences, fewer accessibility regressions, fewer visual inconsistencies, and less time spent re-solving the same interface problem.</p>
                <p>For a business, the most valuable question is often simple: <strong>What decisions did the system make easier this quarter?</strong></p>

                <h3>7. Keep a healthy boundary between standardization and craft</h3>
                <p>Standardize what benefits from consistency: common interactions, accessibility behavior, layout foundations, recurring content patterns, and brand expression. Leave room for exceptions when the content, audience, or product genuinely requires a different solution.</p>
                <p>Over-standardization can be just as damaging as inconsistency. If every page is forced into the same card, spacing, and interaction pattern, the system starts shaping the product instead of supporting it.</p>

                <h3>8. Documentation should answer “when,” not only “what”</h3>
                <p>Showing a component is not enough. Good documentation explains when to use it, when not to use it, which variant to choose, what content it expects, what happens at smaller widths, and which accessibility requirements apply.</p>
                <p>This is especially important as new designers and developers join the business. The system becomes a shared language only when people can understand the reasoning behind its patterns.</p>

                <h3>A practical growth model</h3>
                <ol>
                    <li><strong>Foundation:</strong> define semantic tokens, typography, color roles, spacing, grid, motion, and accessibility rules.</li>
                    <li><strong>Core patterns:</strong> build the small set of components used across the majority of experiences.</li>
                    <li><strong>Real-world testing:</strong> apply the system to active products and record where it breaks.</li>
                    <li><strong>Governance:</strong> establish contribution, review, deprecation, and ownership rules.</li>
                    <li><strong>Measurement:</strong> track delivery friction, quality issues, reuse, and accessibility—not just component count.</li>
                    <li><strong>Evolution:</strong> remove obsolete patterns and improve the foundations as the business changes.</li>
                </ol>

                <div class="article-note">
                    <strong>Final principle</strong>
                    <p>The best design system is not the one with the most rules. It is the one that makes good work easier, makes poor decisions harder, and can evolve without losing its underlying logic.</p>
                </div>
            `
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
        resourceModalBody.innerHTML = resource.body;
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

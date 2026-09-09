(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const siteRoot = "/visualtechstudio/";

    if (!config?.url || !config?.publishableKey) {
        return;
    }

    const loadSupabase = async () => {
        if (window.supabase) return window.supabase;
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-supabase-client="true"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.supabase), { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
            script.dataset.supabaseClient = "true";
            script.onload = () => resolve(window.supabase);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const safeReturnPath = () => {
        const path = `${window.location.pathname}${window.location.search}`;
        if (!path.startsWith(siteRoot) || path.includes("\\")) return siteRoot;
        return path;
    };

    const accountUrl = (mode = "signin") => {
        const relative = safeReturnPath().replace(siteRoot, "");
        const params = new URLSearchParams();
        if (mode === "signup") params.set("signup", "1");
        if (relative) params.set("return", `../${relative}`);
        const query = params.toString();
        return `${siteRoot}account/${query ? `?${query}` : ""}`;
    };

    const myAccountUrl = () => `${siteRoot}my-account/`;
    const libraryUrl = () => `${siteRoot}library/`;

    const ensureStyles = () => {
        if (document.getElementById("auth-navigation-styles")) return;
        const style = document.createElement("style");
        style.id = "auth-navigation-styles";
        style.textContent = `.site-nav .auth-nav-button{appearance:none;border:1px solid var(--color-accent);background:var(--color-accent);color:#061018;padding:10px 17px;border-radius:var(--radius-control);font:700 .82rem/1 Inter,Arial,sans-serif;cursor:pointer;opacity:1;transition:background var(--duration-standard) ease,color var(--duration-standard) ease,transform var(--duration-standard) var(--ease-premium)}.site-nav .auth-nav-button:hover{background:var(--color-accent-hover);border-color:var(--color-accent-hover);transform:translateY(-2px)}.site-nav .auth-nav-button:active{transform:translateY(1px) scale(.98)}.site-nav .auth-nav-button:disabled{opacity:.5;cursor:wait;transform:none}`;
        document.head.appendChild(style);
    };

    const syncAccountActions = () => {
        const heading = document.getElementById("account-heading");
        const secondaryAction = document.getElementById("signup-button");
        if (!heading || !secondaryAction) return;
        const title = heading.textContent.trim();
        const isAlternateMode = ["Create your account.", "Reset your password.", "Set a new password."].includes(title);
        secondaryAction.textContent = isAlternateMode ? "Back to sign in" : "Create account";
        secondaryAction.setAttribute("aria-label", isAlternateMode ? "Back to sign in" : "Create account");
    };

    const observeAccountActions = () => {
        const heading = document.getElementById("account-heading");
        if (!heading || !document.getElementById("signup-button")) return;
        syncAccountActions();
        const observer = new MutationObserver(syncAccountActions);
        observer.observe(heading, { childList: true, characterData: true, subtree: true });
    };

    const closeMobileMenu = navMenu => {
        const toggle = navMenu.closest(".site-nav")?.querySelector(".menu-toggle");
        navMenu.classList.remove("is-open");
        toggle?.setAttribute("aria-expanded", "false");
        toggle?.setAttribute("aria-label", "Open navigation menu");
    };

    const createNavItem = (href, label, navMenu) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        link.addEventListener("click", () => closeMobileMenu(navMenu));
        li.appendChild(link);
        return li;
    };

    const removeAuthItems = navMenu => navMenu.querySelectorAll("[data-auth-nav]").forEach(item => item.remove());

    const renderNavigation = session => {
        ensureStyles();
        document.querySelectorAll(".site-nav .nav-menu").forEach(navMenu => {
            const list = navMenu.querySelector("ul");
            if (!list) return;
            removeAuthItems(navMenu);

            const home = createNavItem(siteRoot, "Home", navMenu);
            home.dataset.homeNav = "true";
            list.prepend(home);

            if (session?.user) {
                const account = createNavItem(myAccountUrl(), "My Account", navMenu);
                const library = createNavItem(libraryUrl(), "My Library", navMenu);
                account.dataset.authNav = "true";
                library.dataset.authNav = "true";
                list.append(account, library);
                const signOut = document.createElement("li");
                signOut.dataset.authNav = "true";
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = "Sign Out";
                button.className = "auth-nav-button";
                button.addEventListener("click", async () => {
                    if (button.disabled) return;
                    button.disabled = true;
                    closeMobileMenu(navMenu);
                    try {
                        const { error } = await window.VISUAL_TECH_AUTH_CLIENT.auth.signOut();
                        if (error) throw error;
                    } catch (error) {
                        console.error("Visual Tech Studio sign out failed:", error);
                        button.disabled = false;
                    }
                });
                signOut.appendChild(button);
                list.appendChild(signOut);
            } else {
                const login = createNavItem(accountUrl("signin"), "Login", navMenu);
                const signup = createNavItem(accountUrl("signup"), "Create Account", navMenu);
                login.dataset.authNav = "true";
                signup.dataset.authNav = "true";
                list.append(login, signup);
            }
        });
    };

    const initialize = async () => {
        const supabase = await loadSupabase();
        if (!supabase) throw new Error("Supabase client library unavailable");
        const client = supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        window.VISUAL_TECH_AUTH_CLIENT = client;
        const { data } = await client.auth.getSession();
        renderNavigation(data?.session || null);
        observeAccountActions();
        client.auth.onAuthStateChange((_event, session) => {
            renderNavigation(session || null);
            syncAccountActions();
        });
        return client;
    };

    const ready = new Promise((resolve, reject) => {
        const start = () => initialize().then(resolve).catch(error => {
            console.error("Visual Tech Studio authentication navigation failed:", error);
            reject(error);
        });
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
        else start();
    });

    window.VISUAL_TECH_AUTH_READY = ready;
})();

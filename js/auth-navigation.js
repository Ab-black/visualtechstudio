(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const siteRoot = "/visualtechstudio/";

    if (!config?.url || !config?.publishableKey) {
        return;
    }

    const loadSupabase = async () => {
        if (window.supabase) {
            return window.supabase;
        }

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
        if (!path.startsWith(siteRoot) || path.includes("\\")) {
            return `${siteRoot}`;
        }
        return path;
    };

    const accountUrl = (mode = "signin") => {
        const relative = safeReturnPath().replace(siteRoot, "");
        const params = new URLSearchParams();
        if (mode === "signup") {
            params.set("signup", "1");
        }
        if (relative) {
            params.set("return", `../${relative}`);
        }
        const query = params.toString();
        return `${siteRoot}account/${query ? `?${query}` : ""}`;
    };

    const libraryUrl = () => `${siteRoot}library/`;

    const createNavItem = (href, label, className = "") => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        if (className) {
            link.className = className;
        }
        li.appendChild(link);
        return li;
    };

    const removeAuthItems = (navMenu) => {
        navMenu.querySelectorAll("[data-auth-nav]").forEach((item) => item.remove());
    };

    const renderNavigation = (session) => {
        document.querySelectorAll(".site-nav .nav-menu").forEach((navMenu) => {
            const list = navMenu.querySelector("ul");
            if (!list) {
                return;
            }

            removeAuthItems(navMenu);

            if (session?.user) {
                const account = createNavItem(accountUrl("signin"), "My Account");
                const library = createNavItem(libraryUrl(), "My Library");
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
                    if (button.disabled) {
                        return;
                    }
                    button.disabled = true;
                    try {
                        const { error } = await window.VISUAL_TECH_AUTH_CLIENT.auth.signOut();
                        if (error) {
                            throw error;
                        }
                    } catch (error) {
                        console.error("Visual Tech Studio sign out failed:", error);
                        button.disabled = false;
                    }
                });
                signOut.appendChild(button);
                list.appendChild(signOut);
            } else {
                const login = createNavItem(accountUrl("signin"), "Login");
                const signup = createNavItem(accountUrl("signup"), "Create Account");
                login.dataset.authNav = "true";
                signup.dataset.authNav = "true";
                list.append(login, signup);
            }
        });
    };

    const initialize = async () => {
        try {
            const supabase = await loadSupabase();
            if (!supabase) {
                return;
            }

            const client = supabase.createClient(config.url, config.publishableKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });

            window.VISUAL_TECH_AUTH_CLIENT = client;

            const { data } = await client.auth.getSession();
            renderNavigation(data?.session || null);

            client.auth.onAuthStateChange((_event, session) => {
                renderNavigation(session || null);
            });
        } catch (error) {
            console.error("Visual Tech Studio authentication navigation failed:", error);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();

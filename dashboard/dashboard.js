(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    let supabaseClient = null;

    const loadSupabase = () => new Promise((resolve, reject) => {
        if (!config?.url || !config?.publishableKey) return reject(new Error('Supabase configuration is missing.'));
        if (window.supabase) return resolve(window.supabase.createClient(config.url, config.publishableKey));
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey));
        script.onerror = () => reject(new Error('Could not load Supabase.'));
        document.head.appendChild(script);
    });

    const createAuthGate = () => {
        const gate = document.createElement('div');
        gate.id = 'dashboard-auth-gate';
        gate.innerHTML = `
            <div class="dashboard-auth-card">
                <p class="dashboard-auth-eyebrow">VISUAL TECH STUDIO</p>
                <h1>Dashboard access</h1>
                <p>Sign in with your administrator account to manage the dashboard.</p>
                <form id="dashboard-auth-form">
                    <label>Email<input name="email" type="email" autocomplete="username" required></label>
                    <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
                    <button type="submit">Sign in</button>
                    <p id="dashboard-auth-message" role="alert"></p>
                </form>
            </div>
        `;
        Object.assign(gate.style, {
            position: 'fixed', inset: '0', zIndex: '99999', display: 'grid', placeItems: 'center',
            background: 'rgba(248,248,246,.98)', padding: '24px', fontFamily: 'Inter, sans-serif'
        });
        const card = gate.querySelector('.dashboard-auth-card');
        Object.assign(card.style, {
            width: 'min(420px, 100%)', padding: '32px', border: '1px solid #ddd',
            borderRadius: '18px', background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.08)'
        });
        const form = gate.querySelector('form');
        Object.assign(form.style, { display: 'grid', gap: '14px', marginTop: '24px' });
        form.querySelectorAll('label').forEach(label => Object.assign(label.style, { display: 'grid', gap: '7px', fontSize: '14px' }));
        form.querySelectorAll('input').forEach(input => Object.assign(input.style, { padding: '12px', border: '1px solid #ccc', borderRadius: '9px', font: 'inherit' }));
        Object.assign(form.querySelector('button').style, { padding: '12px 16px', border: '0', borderRadius: '9px', background: '#111', color: '#fff', font: 'inherit', fontWeight: '600', cursor: 'pointer' });
        document.body.appendChild(gate);
        return gate;
    };

    const requireAdminSession = async () => {
        const gate = createAuthGate();
        const form = gate.querySelector('#dashboard-auth-form');
        const message = gate.querySelector('#dashboard-auth-message');

        const checkSession = async () => {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error || !session) return false;
            const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
            if (profileError || profile?.role !== 'admin') {
                await supabaseClient.auth.signOut();
                return false;
            }
            gate.remove();
            return true;
        };

        if (await checkSession()) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            message.textContent = 'Signing in…';
            const { error } = await supabaseClient.auth.signInWithPassword({
                email: form.email.value.trim(),
                password: form.password.value
            });
            if (error) {
                message.textContent = error.message;
                return;
            }
            message.textContent = 'Checking administrator access…';
            if (!(await checkSession())) message.textContent = 'This account is not an administrator.';
        });
    };

    const init = async () => {
        const menu = document.querySelector('#mobile-menu');
        const sidebar = document.querySelector('#sidebar');

        if (menu && sidebar) {
            menu.addEventListener('click', () => {
                const open = sidebar.classList.toggle('open');
                menu.setAttribute('aria-expanded', String(open));
            });

            sidebar.querySelectorAll('a').forEach((link) => {
                link.addEventListener('click', () => {
                    sidebar.classList.remove('open');
                    menu.setAttribute('aria-expanded', 'false');
                });
            });
        }

        const contentGroups = document.querySelectorAll('.nav-group');
        const contentGroup = Array.from(contentGroups).find((group) => {
            const label = group.querySelector('.nav-label');
            return label && label.textContent.trim() === 'CONTENT';
        });

        if (contentGroup) {
            const projectsLink = Array.from(contentGroup.querySelectorAll('.nav-item')).find((link) => link.textContent.trim() === 'Projects');
            if (projectsLink) projectsLink.href = 'projects.html';
        }

        supabaseClient = await loadSupabase();
        window.VISUAL_TECH_SUPABASE_CLIENT = supabaseClient;
        await requireAdminSession();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
    else init().catch(console.error);
})();

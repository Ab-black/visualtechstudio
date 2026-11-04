/* Visual Tech Studio — Studio page "Our Creative Work".
   Shows the latest published projects from the same Supabase `projects` table the homepage and Projects page use.
   If none load, the static cards already in the HTML stay in place. */
(() => {
    const grid = document.querySelector('#studio-work');
    if (!grid) return;
    const config = window.VISUAL_TECH_SUPABASE;
    if (!config?.url || !config?.publishableKey) return;

    const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    const resolveImage = (path) => {
        if (!path) return '';
        if (/^(https?:|data:|blob:)/i.test(path)) return path;
        const n = String(path).replace(/^\/+/, '');
        if (n.startsWith('images/')) return '../' + n.split('/').map(encodeURIComponent).join('/');
        return `${config.url}/storage/v1/object/public/public-assets/${n.split('/').map(encodeURIComponent).join('/')}`;
    };

    const loadClient = async () => {
        if (window.VISUAL_TECH_AUTH_READY) {
            try { const c = await window.VISUAL_TECH_AUTH_READY; if (c) return c; } catch { /* fall through */ }
        }
        const lib = window.supabase || await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = () => res(window.supabase); s.onerror = rej;
            document.head.appendChild(s);
        });
        return lib.createClient(config.url, config.publishableKey);
    };

    const init = async () => {
        const client = await loadClient();
        const { data, error } = await client.from('projects')
            .select('id,title,category,cover_path,status,created_at')
            .eq('status', 'published').order('created_at', { ascending: false }).limit(3);
        if (error || !Array.isArray(data) || !data.length) return;
        grid.innerHTML = data.map((p) => {
            const img = resolveImage(p.cover_path);
            return `<a class="s-work" href="../work/">${img ? `<img src="${esc(img)}" alt="${esc(p.title || 'Selected project')}" loading="lazy">` : ''}<span class="s-work-text"><strong>${esc(p.title || 'Selected project')}</strong><span>${esc(p.category || 'Visual Design')}</span></span></a>`;
        }).join('');
    };

    window.addEventListener('DOMContentLoaded', () => init().catch((e) => console.warn('Studio projects could not be loaded', e)));
})();

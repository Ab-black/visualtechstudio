/* Visual Tech Studio — homepage "Best-Selling Prompts".
   Reads real published products from the same Supabase `products` table the Store page uses.
   Nothing is invented: a requested product that is not found is shown as "Not yet available" with no price or link. */
(() => {
    const grid = document.querySelector('#featured-prompts');
    if (!grid) return;
    const config = window.VISUAL_TECH_SUPABASE;

    const wanted = [
        { label: 'E-commerce Website Prompts Pack', test: (p) => /e-?commerce|online[\s-]?store/i.test(`${p.title} ${p.slug}`) },
        { label: 'Portfolio Website Prompts', test: (p) => /portfolio/i.test(`${p.title} ${p.slug}`) },
        { label: 'Business Website Copy Prompts', test: (p) => /(business|website)[\s-]*(website[\s-]*)?copy|copy[\s-]*prompts?/i.test(`${p.title} ${p.slug}`) }
    ];

    const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    const money = (v, c = 'NGN') => {
        try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(Number(v || 0)); }
        catch { return `${c} ${Number(v || 0).toLocaleString()}`; }
    };
    const cover = (path) => {
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith('images/')) return path;
        return `${config.url}/storage/v1/object/public/public-assets/${path.split('/').map(encodeURIComponent).join('/')}`;
    };

    const productCard = (p) => `<article class="prompt-card">
        <div class="prompt-cover">${p.cover_path ? `<img src="${esc(cover(p.cover_path))}" alt="${esc(p.title)} cover" loading="lazy">` : `<span>${esc(p.title)}</span>`}</div>
        <div class="prompt-body">
            <p class="prompt-format">${esc(p.format || 'Prompt pack')}</p>
            <h3>${esc(p.title)}</h3>
            <p class="prompt-desc">${esc(p.description || '')}</p>
            <p class="prompt-price">${money(p.price, p.currency || 'NGN')}</p>
            <a class="btn-primary" href="store/${encodeURIComponent(p.slug)}/">View Product</a>
        </div></article>`;

    const placeholderCard = (label) => `<article class="prompt-card is-placeholder">
        <div class="prompt-cover" role="img" aria-label="Cover image for ${esc(label)} not yet available">Cover coming</div>
        <div class="prompt-body">
            <p class="prompt-format">Prompt pack</p>
            <h3>${esc(label)}</h3>
            <p class="prompt-desc">This product is not available in the store yet.</p>
            <a class="btn-secondary" href="store/" aria-disabled="true" tabindex="-1">Not yet available</a>
        </div></article>`;

    const fallback = () => { grid.innerHTML = '<p>Browse all prompt packs in the <a class="text-link" href="store/">Store</a>.</p>'; };

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
        if (!config?.url || !config?.publishableKey) return fallback();
        const client = await loadClient();
        const { data, error } = await client.from('products')
            .select('id,title,description,price,currency,format,cover_path,slug,status,created_at')
            .eq('status', 'published').order('created_at', { ascending: false });
        if (error) throw error;
        const pool = [...(data || [])];
        const cards = wanted.map((w) => {
            const i = pool.findIndex(w.test);
            if (i === -1) return placeholderCard(w.label);
            return productCard(pool.splice(i, 1)[0]);
        });
        grid.innerHTML = cards.join('');
    };

    window.addEventListener('DOMContentLoaded', () => init().catch((e) => { console.error('Featured prompts failed to load', e); fallback(); }));
})();

/* Visual Tech Studio — homepage "Best-Selling Prompts" (featured: Reliable Web Builder Prompts,
   Website Styling Prompt Pack, Website Functionality Prompt Pack).
   Reads real published products from the same Supabase `products` table the Store page uses.
   Nothing is invented: a featured product that is not found is shown as "Not yet available" with no link or price. */
(() => {
    const grid = document.querySelector('#featured-prompts');
    if (!grid) return;
    const config = window.VISUAL_TECH_SUPABASE;

    const wanted = [
        { label: 'Reliable Web Builder Prompts', test: (p) => /reliable[\s-]*web[\s-]*builder/i.test(`${p.title} ${p.slug}`), glyph: 0 },
        { label: 'Website Styling Prompt Pack', test: (p) => /website[\s-]*styling/i.test(`${p.title} ${p.slug}`), glyph: 1 },
        { label: 'Website Functionality Prompt Pack', test: (p) => /website[\s-]*functionality/i.test(`${p.title} ${p.slug}`), glyph: 2 }
    ];

    /* thumbnail glyphs (lime line icons) drawn on the shared cabinet frame defined in index.html */
    const glyphs = [
        '<rect x="22" y="24" width="36" height="26" rx="3"/><path d="M22 32h36M30 32v18"/>',
        '<path d="M40 22c-10 0-17 7-17 15 0 7 5 11 11 11h3c2 0 3 1 3 3s1 4 3 4c8 0 13-6 13-14 0-11-6-19-16-19z"/><circle cx="32" cy="34" r="2"/><circle cx="40" cy="30" r="2"/><circle cx="48" cy="35" r="2"/>',
        '<circle cx="40" cy="37" r="6"/><path d="M40 22v5M40 47v5M25 37h5M50 37h5M29.5 26.5l3.5 3.5M47 44l3.5 3.5M50.5 26.5L47 30M33 44l-3.5 3.5"/>'
    ];
    const thumb = (g) => `<svg viewBox="0 0 80 90" aria-hidden="true"><use href="#thumb-frame"/><g fill="none" stroke="#b6f23a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${glyphs[g % glyphs.length]}</g></svg>`;

    const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    const cover = (path) => {
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith('images/')) return path;
        return `${config.url}/storage/v1/object/public/public-assets/${path.split('/').map(encodeURIComponent).join('/')}`;
    };

    const productRow = (p, glyph) => `<article class="prompt-row">
        <div class="prompt-thumb">${p.cover_path ? `<img src="${esc(cover(p.cover_path))}" alt="${esc(p.title)} cover" loading="lazy">` : thumb(glyph)}</div>
        <div class="prompt-text"><h3>${esc(p.title)}</h3><p>${esc(p.description || '')}</p></div>
        <a class="btn-primary" href="store/${encodeURIComponent(p.slug)}/">View Product</a></article>`;

    const placeholderRow = (label, glyph) => `<article class="prompt-row is-placeholder">
        <div class="prompt-thumb">${thumb(glyph)}</div>
        <div class="prompt-text"><h3>${esc(label)}</h3><p>This product is not available in the store yet.</p></div>
        <a class="btn-primary" href="store/" aria-disabled="true" tabindex="-1">Not yet available</a></article>`;

    const fallback = () => { grid.innerHTML = '<p>Browse all prompt packs in the <a class="accent" href="store/">Store</a>.</p>'; };

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
        grid.innerHTML = wanted.map((w) => {
            const i = pool.findIndex(w.test);
            return i === -1 ? placeholderRow(w.label, w.glyph) : productRow(pool.splice(i, 1)[0], w.glyph);
        }).join('');
    };

    window.addEventListener('DOMContentLoaded', () => init().catch((e) => { console.error('Featured prompts failed to load', e); fallback(); }));
})();

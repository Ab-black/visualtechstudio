/* Visual Tech Studio — public Free Prompts page.
   Shows published rows from the `free_prompts` table (managed in the dashboard).
   Prompt text is only ever inserted as plain text, is not editable, and is copied with the Copy button. */
(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const list = document.querySelector('#fp-list');
    const filtersEl = document.querySelector('#fp-filters');
    const searchEl = document.querySelector('#fp-search');
    const countEl = document.querySelector('#fp-count');
    const liveEl = document.querySelector('#fp-live');
    if (!list) return;

    // Same fixed list as the dashboard editor; this order is used for the filter buttons.
    const CATEGORY_ORDER = ['Website Building', 'Website Design & Styling', 'Website Features', 'E-commerce', 'Graphic & Image Design', 'Content & Copywriting', 'SEO & Marketing', 'Other'];

    let prompts = [];
    let activeCategory = 'All';
    let query = '';

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const announce = (message) => { if (liveEl) { liveEl.textContent = ''; window.setTimeout(() => { liveEl.textContent = message; }, 30); } };

    const copyText = async (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
        }
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        area.remove();
        return ok;
    };

    const buildCard = (prompt) => {
        const card = el('article', 'fp-card');
        card.appendChild(el('span', 'fp-cat', prompt.category || 'Other'));
        card.appendChild(el('h2', 'fp-title', prompt.title));
        if (prompt.description) card.appendChild(el('p', 'fp-desc', prompt.description));

        const wrap = el('div', 'fp-code-wrap');
        const code = el('pre', 'fp-code', prompt.prompt_text);
        code.setAttribute('tabindex', '0');
        code.setAttribute('aria-label', `Prompt text for ${prompt.title}`);
        wrap.appendChild(code);
        card.appendChild(wrap);

        const actions = el('div', 'fp-actions');
        const copy = el('button', 'btn-primary fp-copy', 'Copy prompt');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
            const ok = await copyText(prompt.prompt_text);
            copy.classList.remove('is-copied', 'is-failed');
            copy.textContent = ok ? 'Copied!' : 'Press and hold the text to copy';
            copy.classList.add(ok ? 'is-copied' : 'is-failed');
            announce(ok ? `Copied ${prompt.title} to your clipboard.` : 'Copy was blocked by your browser. Select the text and copy it manually.');
            window.setTimeout(() => { copy.classList.remove('is-copied', 'is-failed'); copy.textContent = 'Copy prompt'; }, 2200);
        });
        actions.appendChild(copy);

        const toggle = el('button', 'fp-toggle', 'Show full prompt');
        toggle.type = 'button';
        toggle.hidden = true;
        toggle.addEventListener('click', () => {
            const open = card.classList.toggle('is-open');
            toggle.textContent = open ? 'Show less' : 'Show full prompt';
            toggle.setAttribute('aria-expanded', String(open));
        });
        toggle.setAttribute('aria-expanded', 'false');
        actions.appendChild(toggle);
        card.appendChild(actions);

        card._measure = () => {
            const overflowing = code.scrollHeight > code.clientHeight + 4 || card.classList.contains('is-open');
            wrap.classList.toggle('is-clipped', overflowing);
            toggle.hidden = !overflowing;
        };
        return card;
    };

    const matches = (prompt) => {
        if (activeCategory !== 'All' && prompt.category !== activeCategory) return false;
        if (!query) return true;
        const haystack = `${prompt.title} ${prompt.description || ''} ${prompt.category || ''} ${prompt.prompt_text}`.toLowerCase();
        return haystack.includes(query);
    };

    const renderState = (title, body) => {
        list.textContent = '';
        const state = el('div', 'fp-state');
        state.appendChild(el('strong', '', title));
        state.appendChild(document.createTextNode(body));
        list.appendChild(state);
    };

    const render = () => {
        const visible = prompts.filter(matches);
        if (countEl) countEl.textContent = `${visible.length} prompt${visible.length === 1 ? '' : 's'}`;
        if (!prompts.length) { renderState('New prompts are on the way.', 'Free prompts will appear here as soon as they are published. Check back soon.'); return; }
        if (!visible.length) { renderState('No prompts match your search.', 'Try a different word or choose another category.'); return; }
        list.textContent = '';
        const grid = el('div', 'fp-grid');
        const cards = visible.map(buildCard);
        cards.forEach((card) => grid.appendChild(card));
        list.appendChild(grid);
        cards.forEach((card) => card._measure());
    };

    const renderFilters = () => {
        if (!filtersEl) return;
        const present = new Set(prompts.map((prompt) => prompt.category || 'Other'));
        const names = ['All', ...CATEGORY_ORDER.filter((name) => present.has(name)), ...[...present].filter((name) => !CATEGORY_ORDER.includes(name))];
        filtersEl.textContent = '';
        if (names.length <= 2) return;
        names.forEach((name) => {
            const chip = el('button', 'fp-chip' + (name === activeCategory ? ' is-active' : ''), name);
            chip.type = 'button';
            chip.setAttribute('aria-pressed', String(name === activeCategory));
            chip.addEventListener('click', () => { activeCategory = name; renderFilters(); render(); });
            filtersEl.appendChild(chip);
        });
    };

    const loadClient = async () => {
        if (window.VISUAL_TECH_AUTH_READY) {
            try { const c = await window.VISUAL_TECH_AUTH_READY; if (c) return c; } catch { /* fall through */ }
        }
        const lib = window.supabase || await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = () => resolve(window.supabase); s.onerror = reject;
            document.head.appendChild(s);
        });
        return lib.createClient(config.url, config.publishableKey);
    };

    const init = async () => {
        if (!config?.url || !config?.publishableKey) { renderState('Prompts are unavailable.', 'Please try again shortly.'); return; }
        const client = await loadClient();
        const { data, error } = await client.from('free_prompts')
            .select('id,title,slug,category,description,prompt_text,created_at')
            .eq('status', 'published').order('created_at', { ascending: false });
        if (error) throw error;
        prompts = data || [];
        renderFilters();
        render();
    };

    if (searchEl) searchEl.addEventListener('input', () => { query = searchEl.value.trim().toLowerCase(); render(); });
    window.addEventListener('resize', () => { list.querySelectorAll('.fp-card').forEach((card) => card._measure && card._measure()); });
    window.addEventListener('DOMContentLoaded', () => init().catch((e) => { console.error('Free prompts failed to load', e); renderState('Prompts could not be loaded.', 'Please refresh the page or try again shortly.'); }));
})();

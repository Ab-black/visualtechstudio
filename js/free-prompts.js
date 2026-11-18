/* Visual Tech Studio — public Free Prompts page.
   Cards show the outcome image(s) or a looping video; each card has View prompt and Copy prompt buttons.
   Clicking an image opens it full size. Prompt text is only ever inserted as plain text, is not editable,
   and is copied with the Copy button. */
(() => {
    const config = window.VISUAL_TECH_SUPABASE;
    const list = document.querySelector('#fp-list');
    if (!list) return;
    const filtersEl = document.querySelector('#fp-filters');
    const formEl = document.querySelector('#fp-search-form');
    const searchEl = document.querySelector('#fp-search');
    const clearEl = document.querySelector('#fp-clear');
    const countEl = document.querySelector('#fp-count');
    const liveEl = document.querySelector('#fp-live');

    // Same fixed list as the dashboard editor; this order is used for the category buttons.
    const CATEGORY_ORDER = ['Website Building', 'Website Design & Styling', 'Website Features', 'E-commerce', 'Graphic & Image Design', 'Content & Copywriting', 'SEO & Marketing', 'Other'];
    const MEDIA_FOLDER = 'free-prompts/';

    let prompts = [];
    let activeCategory = 'All';
    let query = '';
    let modal = null;
    let lastTrigger = null;

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

    const bindCopy = (button, prompt, idleLabel) => {
        button.addEventListener('click', async () => {
            const ok = await copyText(prompt.prompt_text);
            button.classList.remove('is-copied', 'is-failed');
            button.textContent = ok ? 'Copied!' : 'Use View prompt to copy';
            button.classList.add(ok ? 'is-copied' : 'is-failed');
            announce(ok ? 'Prompt copied to your clipboard.' : 'Copy was blocked by your browser. Open View prompt and select the text to copy it.');
            window.setTimeout(() => { button.classList.remove('is-copied', 'is-failed'); button.textContent = idleLabel; }, 2200);
        });
    };

    const mediaUrl = (path) => `${config.url}/storage/v1/object/public/public-assets/${String(path).split('/').map(encodeURIComponent).join('/')}`;
    const mediaOf = (prompt) => {
        const items = (Array.isArray(prompt.media) ? prompt.media : []).filter((item) => item && (item.type === 'image' || item.type === 'video') && typeof item.path === 'string' && item.path.startsWith(MEDIA_FOLDER));
        return [...items.filter((item) => item.type === 'video').slice(0, 1), ...items.filter((item) => item.type === 'image')];
    };

    /* ---------- looping video with tap-for-sound ---------- */
    const syncSound = (video) => {
        const button = video.parentElement && video.parentElement.querySelector('.fp-sound');
        if (!button) return;
        const on = !video.muted;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-pressed', String(on));
        button.setAttribute('aria-label', on ? 'Mute video' : 'Turn video sound on');
        button.textContent = on ? 'Sound on' : 'Tap for sound';
    };
    const toggleSound = (video) => {
        const turningOn = video.muted;
        document.querySelectorAll('.fp-slide video').forEach((other) => { if (other !== video && !other.muted) { other.muted = true; syncSound(other); } });
        video.muted = !turningOn;
        if (turningOn) { video.volume = 1; const played = video.play(); if (played && played.catch) played.catch(() => {}); }
        syncSound(video);
    };
    const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const video = entry.target;
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { const played = video.play(); if (played && played.catch) played.catch(() => {}); }
            else { video.pause(); if (!video.muted) { video.muted = true; syncSound(video); } }
        });
    }, { threshold: [0, 0.5, 1] }) : null;

    const buildVideoSlide = (item, title) => {
        const slide = el('div', 'fp-slide');
        const video = document.createElement('video');
        video.src = mediaUrl(item.path);
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-label', `${title || 'Prompt'} outcome video`);
        if (!videoObserver) video.autoplay = true;
        video.addEventListener('click', () => toggleSound(video));
        slide.appendChild(video);
        const sound = el('button', 'fp-sound', 'Tap for sound');
        sound.type = 'button';
        sound.setAttribute('aria-pressed', 'false');
        sound.setAttribute('aria-label', 'Turn video sound on');
        sound.addEventListener('click', () => toggleSound(video));
        slide.appendChild(sound);
        if (videoObserver) videoObserver.observe(video);
        return slide;
    };

    const buildImageSlide = (item, title, index, images) => {
        const slide = el('div', 'fp-slide');
        const img = document.createElement('img');
        img.src = mediaUrl(item.path);
        img.alt = `${title || 'Prompt'} outcome ${index + 1}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', `View full image ${index + 1} of ${images.length}`);
        const open = () => openLightbox(images, index, title, img);
        img.addEventListener('click', open);
        img.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
        slide.appendChild(img);
        const zoom = el('button', 'fp-zoom');
        zoom.type = 'button';
        zoom.setAttribute('aria-label', 'View full image');
        zoom.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
        zoom.addEventListener('click', open);
        slide.appendChild(zoom);
        return slide;
    };

    const buildMedia = (prompt) => {
        const items = mediaOf(prompt);
        const wrap = el('div', 'fp-media');
        if (!items.length) {
            const placeholder = el('div', 'fp-placeholder');
            placeholder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15v4M17 17h4"/></svg>';
            placeholder.appendChild(document.createTextNode(prompt.category || 'AI prompt'));
            wrap.appendChild(placeholder);
            return wrap;
        }
        const track = el('div', 'fp-track');
        const images = items.filter((item) => item.type === 'image');
        let imageIndex = 0;
        items.forEach((item) => { track.appendChild(item.type === 'video' ? buildVideoSlide(item, prompt.title) : buildImageSlide(item, prompt.title, imageIndex++, images)); });
        wrap.appendChild(track);
        if (items.length > 1) {
            const prev = el('button', 'fp-nav fp-prev', '\u2039');
            const next = el('button', 'fp-nav fp-next', '\u203A');
            prev.type = next.type = 'button';
            prev.setAttribute('aria-label', 'Previous');
            next.setAttribute('aria-label', 'Next');
            const dots = el('div', 'fp-dots');
            const dotButtons = items.map((_, index) => {
                const dot = el('button', 'fp-dot');
                dot.type = 'button';
                dot.setAttribute('aria-label', `Show item ${index + 1} of ${items.length}`);
                dot.addEventListener('click', () => track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' }));
                dots.appendChild(dot);
                return dot;
            });
            const update = () => {
                const index = Math.min(items.length - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
                dotButtons.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
                prev.hidden = index === 0;
                next.hidden = index === items.length - 1;
            };
            let frame = 0;
            track.addEventListener('scroll', () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(update); }, { passive: true });
            prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }));
            next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }));
            wrap.append(prev, next, dots);
            update();
        }
        return wrap;
    };

    /* ---------- View prompt window ---------- */
    const focusable = () => Array.from(modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hidden);
    const closeModal = () => {
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        document.body.classList.remove('fp-lock');
        if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    };
    const ensureModal = () => {
        if (modal) return modal;
        modal = el('div', 'fp-modal');
        modal.hidden = true;
        const panel = el('div', 'fp-modal-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'fp-modal-title');
        const close = el('button', 'fp-modal-close', '\u00d7');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close prompt');
        close.addEventListener('click', closeModal);
        const cat = el('span', 'fp-cat'); cat.id = 'fp-modal-cat';
        const title = el('h2', 'fp-modal-title'); title.id = 'fp-modal-title';
        const desc = el('p', 'fp-desc'); desc.id = 'fp-modal-desc';
        const code = el('pre', 'fp-code'); code.id = 'fp-modal-code'; code.tabIndex = 0;
        const actions = el('div', 'fp-modal-actions');
        const copy = el('button', 'btn-primary fp-copy', 'Copy prompt'); copy.type = 'button'; copy.id = 'fp-modal-copy';
        actions.appendChild(copy);
        panel.append(close, cat, title, desc, code, actions);
        modal.appendChild(panel);
        modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
        document.addEventListener('keydown', (event) => {
            if (modal.hidden) return;
            if (event.key === 'Escape') { closeModal(); return; }
            if (event.key === 'Tab') {
                const nodes = focusable();
                if (!nodes.length) return;
                const first = nodes[0]; const last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        document.body.appendChild(modal);
        return modal;
    };
    const openModal = (prompt, trigger) => {
        ensureModal();
        lastTrigger = trigger;
        const cat = modal.querySelector('#fp-modal-cat');
        const title = modal.querySelector('#fp-modal-title');
        const desc = modal.querySelector('#fp-modal-desc');
        cat.textContent = prompt.category || ''; cat.hidden = !prompt.category;
        title.textContent = prompt.title || 'Prompt';
        desc.textContent = prompt.description || ''; desc.hidden = !prompt.description;
        modal.querySelector('#fp-modal-code').textContent = prompt.prompt_text;
        const oldCopy = modal.querySelector('#fp-modal-copy');
        const copy = oldCopy.cloneNode(true);
        copy.classList.remove('is-copied', 'is-failed'); copy.textContent = 'Copy prompt';
        oldCopy.replaceWith(copy);
        bindCopy(copy, prompt, 'Copy prompt');
        modal.hidden = false;
        document.body.classList.add('fp-lock');
        modal.querySelector('.fp-modal-close').focus();
    };

    /* ---------- full image viewer (click an image to see all of it) ---------- */
    let lightbox = null;
    let lbItems = [];
    let lbIndex = 0;
    let lbTitle = '';
    let lbTrigger = null;
    const lbRender = () => {
        const img = lightbox.querySelector('.fp-lightbox-img');
        img.src = mediaUrl(lbItems[lbIndex].path);
        img.alt = `${lbTitle || 'Prompt'} outcome ${lbIndex + 1} of ${lbItems.length}`;
        lightbox.querySelector('.fp-lightbox-count').textContent = lbItems.length > 1 ? `${lbIndex + 1} / ${lbItems.length}` : '';
        lightbox.querySelectorAll('.fp-lightbox-nav').forEach((button) => { button.hidden = lbItems.length < 2; });
    };
    const lbStep = (delta) => {
        if (lbItems.length < 2) return;
        lbIndex = (lbIndex + delta + lbItems.length) % lbItems.length;
        lbRender();
    };
    const closeLightbox = () => {
        if (!lightbox || lightbox.hidden) return;
        lightbox.hidden = true;
        document.body.classList.remove('fp-lock');
        if (lbTrigger && lbTrigger.focus) lbTrigger.focus();
    };
    const ensureLightbox = () => {
        if (lightbox) return lightbox;
        lightbox = el('div', 'fp-lightbox');
        lightbox.hidden = true;
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-modal', 'true');
        lightbox.setAttribute('aria-label', 'Full image');
        const img = document.createElement('img');
        img.className = 'fp-lightbox-img';
        img.draggable = false;
        const close = el('button', 'fp-lightbox-close', '\u00d7');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close image');
        close.addEventListener('click', closeLightbox);
        const prev = el('button', 'fp-lightbox-nav fp-lightbox-prev', '\u2039');
        const next = el('button', 'fp-lightbox-nav fp-lightbox-next', '\u203A');
        prev.type = next.type = 'button';
        prev.setAttribute('aria-label', 'Previous image');
        next.setAttribute('aria-label', 'Next image');
        prev.addEventListener('click', () => lbStep(-1));
        next.addEventListener('click', () => lbStep(1));
        const count = el('p', 'fp-lightbox-count');
        lightbox.append(img, close, prev, next, count);
        lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });
        let startX = 0;
        lightbox.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
        lightbox.addEventListener('touchend', (event) => {
            const delta = event.changedTouches[0].clientX - startX;
            if (Math.abs(delta) > 50) lbStep(delta < 0 ? 1 : -1);
        });
        document.addEventListener('keydown', (event) => {
            if (lightbox.hidden) return;
            if (event.key === 'Escape') closeLightbox();
            else if (event.key === 'ArrowLeft') lbStep(-1);
            else if (event.key === 'ArrowRight') lbStep(1);
        });
        document.body.appendChild(lightbox);
        return lightbox;
    };
    const openLightbox = (items, index, title, trigger) => {
        ensureLightbox();
        lbItems = items;
        lbIndex = index;
        lbTitle = title || '';
        lbTrigger = trigger;
        lbRender();
        lightbox.hidden = false;
        document.body.classList.add('fp-lock');
        lightbox.querySelector('.fp-lightbox-close').focus();
    };

    /* ---------- cards ---------- */
    const buildCard = (prompt) => {
        const card = el('article', 'fp-card');
        card.appendChild(buildMedia(prompt));
        const body = el('div', 'fp-body');
        if (prompt.category) body.appendChild(el('span', 'fp-cat', prompt.category));
        if (prompt.title) body.appendChild(el('h2', 'fp-title', prompt.title));
        if (body.childNodes.length) card.appendChild(body);
        const actions = el('div', 'fp-actions');
        const view = el('button', 'btn-secondary fp-view', 'View prompt');
        view.type = 'button';
        view.addEventListener('click', () => openModal(prompt, view));
        const copy = el('button', 'btn-primary fp-copy', 'Copy prompt');
        copy.type = 'button';
        bindCopy(copy, prompt, 'Copy prompt');
        actions.append(view, copy);
        card.appendChild(actions);
        return card;
    };

    const matches = (prompt) => {
        if (activeCategory !== 'All' && prompt.category !== activeCategory) return false;
        const words = query.split(/\s+/).filter(Boolean);
        if (!words.length) return true;
        const haystack = `${prompt.title || ''} ${prompt.category || ''} ${prompt.description || ''}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
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
        if (countEl) countEl.textContent = `${visible.length} prompt${visible.length === 1 ? '' : 's'}${activeCategory !== 'All' ? ` in ${activeCategory}` : ''}`;
        if (!prompts.length) { renderState('New prompts are on the way.', 'Free prompts will appear here as soon as they are published. Check back soon.'); return; }
        if (!visible.length) { renderState('No prompts match your search.', 'Try a different word or choose another category.'); return; }
        list.textContent = '';
        const grid = el('div', 'fp-grid');
        visible.forEach((prompt) => grid.appendChild(buildCard(prompt)));
        list.appendChild(grid);
    };

    const renderFilters = () => {
        if (!filtersEl) return;
        const counts = new Map();
        prompts.forEach((prompt) => { if (prompt.category) counts.set(prompt.category, (counts.get(prompt.category) || 0) + 1); });
        filtersEl.textContent = '';
        if (!counts.size) { const row = filtersEl.closest('.fp-filter-row'); if (row) row.hidden = true; return; }
        const row = filtersEl.closest('.fp-filter-row'); if (row) row.hidden = false;
        const names = ['All', ...CATEGORY_ORDER.filter((name) => counts.has(name)), ...[...counts.keys()].filter((name) => !CATEGORY_ORDER.includes(name))];
        names.forEach((name) => {
            const chip = el('button', 'fp-chip' + (name === activeCategory ? ' is-active' : ''));
            chip.type = 'button';
            chip.appendChild(document.createTextNode(name));
            chip.appendChild(el('small', '', String(name === 'All' ? prompts.length : counts.get(name))));
            chip.setAttribute('aria-pressed', String(name === activeCategory));
            chip.addEventListener('click', () => { activeCategory = name; renderFilters(); render(); announce(`Showing ${name === 'All' ? 'all prompts' : name}.`); });
            filtersEl.appendChild(chip);
        });
    };

    const applySearch = () => {
        query = (searchEl ? searchEl.value : '').trim().toLowerCase();
        if (clearEl) clearEl.hidden = !query;
        render();
    };
    if (formEl) formEl.addEventListener('submit', (event) => { event.preventDefault(); applySearch(); if (searchEl) searchEl.blur(); });
    if (searchEl) searchEl.addEventListener('input', applySearch);
    if (clearEl) clearEl.addEventListener('click', () => { searchEl.value = ''; applySearch(); searchEl.focus(); });

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
            .select('id,title,slug,category,description,prompt_text,media,created_at')
            .eq('status', 'published').order('created_at', { ascending: false });
        if (error) throw error;
        prompts = data || [];
        renderFilters();
        render();
    };

    window.addEventListener('DOMContentLoaded', () => init().catch((e) => { console.error('Free prompts failed to load', e); renderState('Prompts could not be loaded.', 'Please refresh the page or try again shortly.'); }));
})();

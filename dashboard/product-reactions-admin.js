(() => {
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const client = () => window.VISUAL_TECH_SUPABASE_CLIENT;
  const install = () => {
    const form = document.querySelector('#maf-product-form');
    if (!form || form.dataset.reactionsInstalled !== '1') return;
    form.dataset.reactionsInstalled = '1';
    const like = form.querySelector('[name="like_count"]');
    if (!like) return;
    const dislike = document.createElement('label');
    dislike.innerHTML = 'People who disliked it<input name="dislike_count" type="number" min="0" step="1" value="0">';
    like.closest('label')?.insertAdjacentElement('afterend', dislike);
    const id = window.__vtsEditingProductId;
    if (!id) return;
    client().from('products').select('dislike_count').eq('id', id).single().then(({data}) => {
      if (data) dislike.querySelector('input').value = Number(data.dislike_count || 0);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const status = form.querySelector('#maf-status');
      const save = form.querySelector('.maf-save');
      save.disabled = true;
      status.textContent = 'Saving…';
      try {
        const updates = {
          title: form.title.value.trim(),
          price: Number(form.price.value || 0),
          format: form.format.value.trim() || null,
          resource_count: Number(form.resource_count.value || 0),
          purchase_count: Number(form.purchase_count.value || 0),
          like_count: Number(form.like_count.value || 0),
          dislike_count: Number(dislike.querySelector('input').value || 0),
          status: form.status.value,
          description: form.description.value.trim() || null,
          updated_at: new Date().toISOString()
        };
        const file = form.cover.files[0];
        if (file) {
          const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
          const cover = `product-covers/${id}-${crypto.randomUUID()}-${safe}`;
          const up = await client().storage.from('public-assets').upload(cover, file, {upsert:false, contentType:file.type});
          if (up.error) throw up.error;
          updates.cover_path = cover;
        }
        const r = await client().from('products').update(updates).eq('id', id);
        if (r.error) throw r.error;
        status.textContent = 'Saved successfully.';
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        status.textContent = err.message;
        save.disabled = false;
      }
    }, true);
  };
  const observe = () => {
    const observer = new MutationObserver(install);
    observer.observe(document.body, {childList:true, subtree:true});
    install();
  };
  window.addEventListener('vts:editing-product', e => { window.__vtsEditingProductId = e.detail?.id || null; setTimeout(install, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe); else observe();
})();
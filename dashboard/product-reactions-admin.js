(() => {
  const client = () => window.VISUAL_TECH_SUPABASE_CLIENT;
  const install = async () => {
    const form = document.querySelector('#maf-product-form');
    if (!form || form.dataset.reactionEditor === '1') return;
    const like = form.querySelector('[name="like_count"]');
    if (!like) return;
    form.dataset.reactionEditor = '1';
    const label = document.createElement('label');
    label.innerHTML = 'People who disliked it<input name="dislike_count" type="number" min="0" step="1" value="0">';
    like.closest('label').insertAdjacentElement('afterend', label);
    const input = label.querySelector('input');
    const title = form.querySelector('[name="title"]')?.value?.trim();
    try {
      const { data, error } = await client().from('products').select('id,dislike_count').eq('title', title).limit(1).maybeSingle();
      if (!error && data) {
        form.dataset.productId = data.id;
        input.value = Number(data.dislike_count || 0);
      }
    } catch (_) {}
    form.addEventListener('submit', async e => {
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
          like_count: Math.max(0, Number(form.like_count.value || 0)),
          dislike_count: Math.max(0, Number(input.value || 0)),
          status: form.status.value,
          description: form.description.value.trim() || null,
          updated_at: new Date().toISOString()
        };
        const file = form.cover.files[0];
        if (file) {
          const id = form.dataset.productId;
          if (!id) throw new Error('Could not determine the product. Please close and reopen the editor.');
          const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
          const cover = `product-covers/${id}-${crypto.randomUUID()}-${safe}`;
          const up = await client().storage.from('public-assets').upload(cover, file, { upsert: false, contentType: file.type });
          if (up.error) throw up.error;
          updates.cover_path = cover;
        }
        let query = client().from('products').update(updates);
        if (form.dataset.productId) query = query.eq('id', form.dataset.productId);
        else query = query.eq('title', title);
        const result = await query;
        if (result.error) throw result.error;
        status.textContent = 'Saved successfully.';
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        status.textContent = err.message || 'Unable to save product.';
        save.disabled = false;
      }
    }, true);
  };
  const observer = new MutationObserver(() => { install(); });
  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
(() => {
    const form = document.querySelector('#quote-form');
    if (!form) return;

    const upload = document.querySelector('#contact-upload');
    const input = document.querySelector('#quote-documents');
    const list = document.querySelector('#contact-file-list');
    const uploadError = document.querySelector('#contact-upload-error');
    const submit = document.querySelector('#quote-submit');
    const status = document.querySelector('#quote-status');
    const success = document.querySelector('#quote-success');

    const allowedExtensions = new Set(['pdf','doc','docx','xls','xlsx','ppt','pptx','zip']);
    const allowedImageTypes = new Set(['image/jpeg','image/png','image/gif','image/webp']);
    const maxFileSize = 10 * 1024 * 1024;
    const maxTotalSize = 25 * 1024 * 1024;
    const maxFiles = 5;
    const selectedFiles = [];

    const extension = file => file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    const isAllowed = file => allowedExtensions.has(extension(file)) || allowedImageTypes.has(file.type);
    const formatSize = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

    const renderFiles = () => {
        list.innerHTML = selectedFiles.map((file, index) => `<div class="contact-file-item"><span class="contact-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span><span class="contact-file-size">${formatSize(file.size)} · <button type="button" class="text-link" data-remove-file="${index}" style="border:0;background:transparent;padding:0;cursor:pointer">Remove</button></span></div>`).join('');
    };

    const setUploadError = message => {
        uploadError.textContent = message || '';
        uploadError.hidden = !message;
    };

    const addFiles = files => {
        setUploadError('');
        for (const file of files) {
            if (selectedFiles.length >= maxFiles) { setUploadError(`You can attach up to ${maxFiles} files.`); break; }
            if (!isAllowed(file)) { setUploadError(`${file.name} is not a supported file type.`); continue; }
            if (file.size > maxFileSize) { setUploadError(`${file.name} is larger than 10 MB.`); continue; }
            if (selectedFiles.some(existing => existing.name === file.name && existing.size === file.size)) continue;
            if (selectedFiles.reduce((total, item) => total + item.size, 0) + file.size > maxTotalSize) { setUploadError('The total attachment size cannot exceed 25 MB.'); break; }
            selectedFiles.push(file);
        }
        renderFiles();
        input.value = '';
    };

    upload.addEventListener('click', () => input.click());
    upload.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
    input.addEventListener('change', () => addFiles(Array.from(input.files || [])));
    ['dragenter','dragover'].forEach(type => upload.addEventListener(type, event => { event.preventDefault(); upload.classList.add('is-dragging'); }));
    ['dragleave','drop'].forEach(type => upload.addEventListener(type, event => { event.preventDefault(); upload.classList.remove('is-dragging'); }));
    upload.addEventListener('drop', event => addFiles(Array.from(event.dataTransfer.files || [])));
    list.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-file]');
        if (!button) return;
        selectedFiles.splice(Number(button.dataset.removeFile), 1);
        renderFiles();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        setUploadError('');
        status.textContent = '';
        status.classList.remove('error');
        success.classList.remove('is-visible');
        if (!form.checkValidity()) { form.reportValidity(); return; }

        const endpoint = window.VISUAL_TECH_QUOTE_ENDPOINT || 'https://mzrtktzetgyilwpgppgy.supabase.co/functions/v1/submit-service-request';
        const payload = new FormData(form);
        payload.delete('attachments');
        selectedFiles.forEach(file => payload.append('attachments', file, file.name));

        submit.disabled = true;
        submit.textContent = 'Sending…';
        status.textContent = 'Sending your request…';
        try {
            const response = await fetch(endpoint, { method: 'POST', body: payload, headers: { 'Accept': 'application/json' } });
            let result = {};
            try { result = await response.json(); } catch (_) {}
            if (!response.ok) throw new Error(result.error || 'We could not send your request right now. Please try again.');
            form.reset();
            selectedFiles.length = 0;
            renderFiles();
            success.classList.add('is-visible');
            status.textContent = '';
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
            status.textContent = error.message || 'We could not send your request right now. Please try again.';
            status.classList.add('error');
        } finally {
            submit.disabled = false;
            submit.textContent = 'Request a Quote';
        }
    });
})();
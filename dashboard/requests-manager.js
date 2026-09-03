(() => {
    const initRequests = () => {
        const tableBody = document.querySelector('#requests-table-body');
        const count = document.querySelector('#request-count');
        const metric = document.querySelector('#request-metric-count');
        const message = document.querySelector('#request-message');
        const search = document.querySelector('#request-search');
        const statusFilter = document.querySelector('#request-status-filter');
        const refresh = document.querySelector('#request-refresh');

        if (!tableBody || !count || !metric || !message || !search || !statusFilter || !refresh) return;

        let client = null;
        let requests = [];
        let initialized = false;

        const escapeHtml = (value) => String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');

        const statusLabel = (value) => ({
            new: 'New',
            reviewing: 'Reviewing',
            contacted: 'Contacted',
            in_progress: 'In progress',
            completed: 'Completed',
            declined: 'Declined'
        }[value] || value || 'New');

        const statusClass = (value) => ({
            new: 'status-amber',
            reviewing: 'status-amber',
            contacted: 'status-blue',
            in_progress: 'status-blue',
            completed: 'status-green',
            declined: 'status-red'
        }[value] || 'status-gray');

        const formatDate = (value) => {
            if (!value) return '—';
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '—';
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date);
        };

        const setMessage = (text = '', type = '') => {
            message.textContent = text;
            message.className = `request-message ${type}`.trim();
        };

        const filteredRequests = () => {
            const query = search.value.trim().toLowerCase();
            const selectedStatus = statusFilter.value;

            return requests.filter((request) => {
                const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
                const haystack = [
                    request.name,
                    request.email,
                    request.phone,
                    request.company,
                    request.service,
                    request.budget,
                    request.project_details
                ].join(' ').toLowerCase();
                return matchesStatus && (!query || haystack.includes(query));
            });
        };

        const render = () => {
            const visible = filteredRequests();
            count.textContent = `${visible.length} ${visible.length === 1 ? 'request' : 'requests'}`;
            metric.textContent = String(requests.filter((request) => request.status === 'new').length);

            if (!visible.length) {
                tableBody.innerHTML = '<tr><td colspan="6" class="request-empty">No quote requests found.</td></tr>';
                return;
            }

            tableBody.innerHTML = visible.map((request) => `
                <tr data-request-id="${escapeHtml(request.id)}">
                    <td><strong>${escapeHtml(request.name)}</strong><span class="request-company">${escapeHtml(request.company || 'Individual')}</span></td>
                    <td>${escapeHtml(request.service || 'Not specified')}</td>
                    <td><span>${escapeHtml(request.email)}</span>${request.phone ? `<span class="request-phone">${escapeHtml(request.phone)}</span>` : ''}</td>
                    <td><span class="status ${statusClass(request.status)}">${escapeHtml(statusLabel(request.status))}</span></td>
                    <td>${escapeHtml(formatDate(request.created_at))}</td>
                    <td><div class="request-actions"><button class="row-action" type="button" data-request-view="${escapeHtml(request.id)}">View</button><button class="row-action request-delete" type="button" data-request-delete="${escapeHtml(request.id)}">Delete</button></div></td>
                </tr>
            `).join('');
        };

        const load = async () => {
            if (!client) return;
            setMessage('Loading requests…');
            refresh.disabled = true;

            const { data, error } = await client
                .from('service_requests')
                .select('id,name,email,phone,company,service,budget,project_details,status,email_status,email_sent_at,created_at,updated_at,service_request_files(id,file_name,file_path,mime_type,file_size,created_at)')
                .order('created_at', { ascending: false });

            refresh.disabled = false;

            if (error) {
                requests = [];
                render();
                setMessage(`Could not load requests: ${error.message}`, 'error');
                return;
            }

            requests = data || [];
            render();
            setMessage(requests.length ? '' : 'No quote requests have been submitted yet.');
        };

        const getRequest = (id) => requests.find((request) => request.id === id);

        const closeModal = () => document.querySelector('#request-detail-modal')?.remove();

        const showModal = (html) => {
            closeModal();
            const modal = document.createElement('div');
            modal.id = 'request-detail-modal';
            modal.className = 'request-modal';
            modal.innerHTML = `<div class="request-modal-backdrop" data-request-close></div><section class="request-modal-card" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">${html}</section>`;
            document.body.appendChild(modal);
            modal.querySelectorAll('[data-request-close]').forEach((button) => button.addEventListener('click', closeModal));
        };

        const viewRequest = async (id) => {
            const request = getRequest(id);
            if (!request || !client) return;

            let files = request.service_request_files || [];
            if (!files.length) {
                const result = await client.from('service_request_files').select('id,file_name,file_path,mime_type,file_size,created_at').eq('request_id', id).order('created_at');
                if (!result.error) files = result.data || [];
            }

            const attachmentHtml = files.length
                ? files.map((file) => `<button class="request-file" type="button" data-request-file="${escapeHtml(file.file_path)}" data-request-file-name="${escapeHtml(file.file_name)}"><strong>${escapeHtml(file.file_name)}</strong><span>${escapeHtml(file.mime_type || 'File')} · ${file.file_size ? `${Math.round(file.file_size / 1024)} KB` : 'Size unavailable'}</span></button>`).join('')
                : '<p class="request-muted">No attachments.</p>';

            showModal(`
                <header class="request-modal-header"><div><p class="eyebrow">CLIENT REQUEST</p><h2 id="request-modal-title">${escapeHtml(request.name)}</h2><p>${escapeHtml(request.email)}</p></div><button class="row-action" type="button" data-request-close>Close</button></header>
                <div class="request-detail-grid">
                    <div><span class="request-detail-label">Phone</span><strong>${escapeHtml(request.phone || '—')}</strong></div>
                    <div><span class="request-detail-label">Company</span><strong>${escapeHtml(request.company || '—')}</strong></div>
                    <div><span class="request-detail-label">Service</span><strong>${escapeHtml(request.service || '—')}</strong></div>
                    <div><span class="request-detail-label">Budget</span><strong>${escapeHtml(request.budget || '—')}</strong></div>
                    <div class="request-detail-full"><span class="request-detail-label">Project details</span><p>${escapeHtml(request.project_details || 'No project details provided.')}</p></div>
                    <div class="request-detail-full"><span class="request-detail-label">Attachments</span><div class="request-files">${attachmentHtml}</div></div>
                </div>
                <footer class="request-modal-footer"><label>Status<select data-request-modal-status="${escapeHtml(request.id)}"><option value="new" ${request.status === 'new' ? 'selected' : ''}>New</option><option value="reviewing" ${request.status === 'reviewing' ? 'selected' : ''}>Reviewing</option><option value="contacted" ${request.status === 'contacted' ? 'selected' : ''}>Contacted</option><option value="in_progress" ${request.status === 'in_progress' ? 'selected' : ''}>In progress</option><option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option><option value="declined" ${request.status === 'declined' ? 'selected' : ''}>Declined</option></select></label><span class="request-email-status">Email: ${escapeHtml(request.email_status || 'pending')}</span></footer>
            `);

            const modal = document.querySelector('#request-detail-modal');
            modal.querySelector('[data-request-modal-status]')?.addEventListener('change', async (event) => {
                const nextStatus = event.target.value;
                const previousStatus = request.status;
                const { error } = await client.from('service_requests').update({ status: nextStatus }).eq('id', request.id);
                if (error) {
                    event.target.value = previousStatus;
                    window.alert(`Could not update status: ${error.message}`);
                    return;
                }
                request.status = nextStatus;
                render();
            });

            modal.querySelectorAll('[data-request-file]').forEach((button) => {
                button.addEventListener('click', async () => {
                    const { data, error } = await client.storage.from('request-attachments').createSignedUrl(button.dataset.requestFile, 300);
                    if (error || !data?.signedUrl) {
                        window.alert(`Could not open attachment: ${error?.message || 'Signed URL unavailable.'}`);
                        return;
                    }
                    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                });
            });
        };

        const deleteRequest = async (id) => {
            const request = getRequest(id);
            if (!request || !client) return;
            const files = request.service_request_files || [];
            const confirmed = window.confirm(`Delete the request from ${request.name}?\n\nThis permanently removes the request and its stored attachments from Supabase. The email already delivered to Gmail will not be affected.`);
            if (!confirmed) return;

            const filePaths = files.map((file) => file.file_path).filter(Boolean);
            if (filePaths.length) {
                const { error: storageError } = await client.storage.from('request-attachments').remove(filePaths);
                if (storageError) {
                    window.alert(`The attachments could not be deleted, so the request was not deleted.\n\n${storageError.message}`);
                    return;
                }
            }

            const { error } = await client.from('service_requests').delete().eq('id', id);
            if (error) {
                window.alert(`The request could not be deleted: ${error.message}`);
                return;
            }

            requests = requests.filter((item) => item.id !== id);
            closeModal();
            render();
            setMessage('Request deleted from the dashboard and Supabase. The Gmail copy remains unchanged.', 'success');
        };

        tableBody.addEventListener('click', (event) => {
            const viewButton = event.target.closest('[data-request-view]');
            const deleteButton = event.target.closest('[data-request-delete]');
            if (viewButton) viewRequest(viewButton.dataset.requestView);
            if (deleteButton) deleteRequest(deleteButton.dataset.requestDelete);
        });

        search.addEventListener('input', render);
        statusFilter.addEventListener('change', render);
        refresh.addEventListener('click', load);

        const start = () => {
            if (initialized) return;
            client = window.VISUAL_TECH_SUPABASE_CLIENT;
            if (!client) return;
            initialized = true;
            load();
        };

        window.addEventListener('visualtech:admin-ready', start);
        start();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRequests);
    else initRequests();
})();

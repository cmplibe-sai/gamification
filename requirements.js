// ==============================================================
// cMPLiBe CORPORATE REQUIREMENTS - recruiter panel (client side)
// Recruiters post a project requirement (for example "collect data from 50 customers in 10 days").
// Students then see it as a cMPLi-ai / Insight Engine project; when they accept and submit it,
// it lands on their dashboard and their automatic CV. The server side is in server.js (section 4d).
// ==============================================================
(function () {
    const SECTORS = ['General', 'RetailTech', 'E-Commerce', 'Supply Chain Tech', 'Logistics Tech', 'FinTech', 'EdTech',
        'HealthTech', 'PropTech', 'Automotive Tech', 'Generative AI & ML', 'Strategic Intelligence', 'Market Research', 'HR & People'];
    const MILESTONES = [
        { id: 1, label: 'Milestone 1' }, { id: 2, label: 'Milestone 2' }, { id: 3, label: 'Milestone 3' }, { id: 4, label: 'Milestone 4' }
    ];
    const field = 'width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:9px 11px;color:#fff;font-size:12px;';

    function esc(v) {
        return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function questionRow(title, type) {
        return `<div class="reqQRow" style="display:grid;grid-template-columns:1fr 130px 32px;gap:6px;margin-bottom:6px;">
            <input class="reqQTitle" maxlength="200" style="${field}" placeholder="What should the student submit? e.g. Excel sheet with the 50 survey responses" value="${esc(title || '')}">
            <select class="reqQType" style="${field}">
                ${[['doc', 'Document / file'], ['text', 'Written answer'], ['audio', 'Audio'], ['video', 'Video']].map(([v, l]) => `<option value="${v}" ${v === (type || 'doc') ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button type="button" onclick="this.parentElement.remove()" style="border:0;background:transparent;color:#f87171;cursor:pointer;" title="Remove">&times;</button>
        </div>`;
    }

    function statusBadge(r) {
        return r.status === 'open'
            ? '<span class="badge-pill badge-emerald text-[9px]">Open to students</span>'
            : '<span class="badge-pill badge-slate text-[9px]">Closed</span>';
    }

    async function loadList() {
        const box = document.getElementById('reqMyList');
        if (!box) return;
        try {
            const data = await (await apiFetch('/api/recruiter/requirements')).json();
            if (!data.success) throw new Error(data.error || 'Could not load');
            if (!data.requirements.length) {
                box.innerHTML = '<div class="text-xs text-slate-500 p-3">You have not posted any requirement yet.</div>';
                return;
            }
            box.innerHTML = data.requirements.map(r => `
                <div class="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-white truncate">${esc(r.title)}</div>
                        <div class="text-[11px] text-slate-400">${esc(r.module === 'insight_engine' ? 'Insight Engine' : 'cMPLi-ai')} &bull; Milestone ${esc(r.milestoneId)} &bull; ${esc(r.durationDays)} days &bull; ${esc(r.location)}</div>
                        <div class="text-[11px] text-cyan-300 mt-0.5">${r.stats.inProgress} student${r.stats.inProgress === 1 ? '' : 's'} working &bull; ${r.stats.completed} completed</div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        ${statusBadge(r)}
                        <button onclick="toggleCorporateRequirement('${esc(r.id)}', '${r.status === 'open' ? 'closed' : 'open'}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white">${r.status === 'open' ? 'Close' : 'Reopen'}</button>
                    </div>
                </div>`).join('');
        } catch (err) {
            box.innerHTML = `<div class="text-xs text-rose-400 p-3">${esc(err.message)}</div>`;
        }
    }

    async function toggleCorporateRequirement(id, status) {
        try {
            const data = await (await apiFetch(`/api/recruiter/requirements/${encodeURIComponent(id)}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
            })).json();
            if (!data.success) throw new Error(data.error || 'Could not update');
        } catch (err) {
            alert(err.message);
            return;
        }
        loadList();
        if (typeof syncCustomProjectsDBFromServer === 'function') {
            await syncCustomProjectsDBFromServer();
            if (typeof renderAdminProjectsList === 'function' && document.getElementById('adminCheckinDaysList')) renderAdminProjectsList();
        }
    }

    async function submitRequirement() {
        const btn = document.getElementById('reqSubmitBtn');
        const val = id => document.getElementById(id).value;
        const questions = [...document.querySelectorAll('.reqQRow')].map(row => ({
            title: row.querySelector('.reqQTitle').value.trim(), type: row.querySelector('.reqQType').value
        })).filter(q => q.title);
        const moduleKey = val('reqModule');
        const body = {
            title: val('reqTitle'), description: val('reqDescription'), sector: val('reqSector'), location: val('reqLocation'),
            durationDays: parseInt(val('reqDays'), 10), module: moduleKey, milestoneId: parseInt(val('reqMilestone'), 10), questions
        };
        btn.disabled = true;
        btn.textContent = 'Publishing...';
        try {
            const data = await (await apiFetch('/api/recruiter/requirements', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            })).json();
            if (!data.success) throw new Error(data.error || 'Could not publish');
            alert('Published. Students can now see this project in their cMPLiBe dashboard.');
            renderPanel(true);
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.textContent = 'Publish to students';
        }
    }

    function renderPanel(keepOpen) {
        const host = document.getElementById('recruiterRequirementsPanel');
        if (!host) return;
        const open = keepOpen || host.dataset.open === '1';
        host.dataset.open = open ? '1' : '0';
        host.innerHTML = `
            <div class="glass-card p-5 border-emerald-500/30">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 class="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-bullhorn"></i> Post a project for students</h3>
                        <p class="text-xs text-slate-400 mt-1">Need a survey, data collection or analysis done? Post it here and cMPLiBe students can take it up as a project. Their results build their CV.</p>
                    </div>
                    <button onclick="toggleRequirementForm()" class="btn-primary py-2 px-4 text-xs">${open ? 'Hide form' : '+ New requirement'}</button>
                </div>
                <div id="reqForm" style="display:${open ? 'block' : 'none'};margin-top:14px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                        <div style="grid-column:1/-1;"><label class="text-[11px] font-bold text-slate-400">Project title</label>
                            <input id="reqTitle" maxlength="120" style="${field}" placeholder="e.g. Customer survey on EV charging habits"></div>
                        <div style="grid-column:1/-1;"><label class="text-[11px] font-bold text-slate-400">What should students do?</label>
                            <textarea id="reqDescription" rows="4" maxlength="2000" style="${field}" placeholder="Describe the task, who to reach (e.g. 50 random customers aged 18-35), what you want to learn and how you will use it."></textarea></div>
                        <div><label class="text-[11px] font-bold text-slate-400">Sector</label>
                            <select id="reqSector" style="${field}">${SECTORS.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
                        <div><label class="text-[11px] font-bold text-slate-400">Location</label>
                            <input id="reqLocation" maxlength="80" style="${field}" placeholder="e.g. Mangaluru, or Across all campuses"></div>
                        <div><label class="text-[11px] font-bold text-slate-400">Days to complete</label>
                            <input id="reqDays" type="number" min="1" max="90" value="15" style="${field}"></div>
                        <div><label class="text-[11px] font-bold text-slate-400">Project type</label>
                            <select id="reqModule" style="${field}">
                                <option value="cmpli_ai">cMPLi-ai project (hands-on field or AI work)</option>
                                <option value="insight_engine">Insight Engine project (analysis and briefing)</option>
                            </select></div>
                        <div><label class="text-[11px] font-bold text-slate-400">Shown to students at</label>
                            <select id="reqMilestone" style="${field}">${MILESTONES.map(m => `<option value="${m.id}" ${m.id === 2 ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
                    </div>
                    <label class="text-[11px] font-bold text-slate-400" style="display:block;margin:12px 0 4px;">What students must submit</label>
                    <div id="reqQuestions">${questionRow('', 'doc')}${questionRow('', 'text')}</div>
                    <button type="button" onclick="document.getElementById('reqQuestions').insertAdjacentHTML('beforeend', window._reqQuestionRow())" class="text-[11px] font-bold text-cyan-300 hover:text-white">+ Add another item</button>
                    <div style="margin-top:14px;"><button id="reqSubmitBtn" onclick="submitRequirement()" class="btn-primary py-2.5 px-5 text-xs">Publish to students</button></div>
                </div>
                <div style="margin-top:16px;">
                    <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Your posted requirements</h4>
                    <div id="reqMyList" class="space-y-2"><div class="text-xs text-slate-500 p-3">Loading...</div></div>
                </div>
            </div>`;
        loadList();
    }

    window.initRecruiterRequirements = function () { renderPanel(false); };
    window.toggleRequirementForm = function () {
        const host = document.getElementById('recruiterRequirementsPanel');
        host.dataset.open = host.dataset.open === '1' ? '0' : '1';
        renderPanel(host.dataset.open === '1');
    };
    window._reqQuestionRow = () => questionRow('', 'doc');
    window.submitRequirement = submitRequirement;
    window.toggleCorporateRequirement = toggleCorporateRequirement;
})();

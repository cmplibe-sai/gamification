// ==============================================================
// cMPLiBe CORPORATE REQUIREMENTS (client side)
//
// Recruiters describe a project need like a job description (title, description, location, days).
// It goes to the Creator, who approves it and decides the project type, milestone, reward (LCs),
// the deliverables and which campuses can take it. Only students of those campuses see it, as a
// cMPLi-ai / Insight Engine project, and it lands on their dashboard and automatic CV.
// The server side is in server.js (section 4d).
// ==============================================================
(function () {
    const SECTORS = ['General', 'RetailTech', 'E-Commerce', 'Supply Chain Tech', 'Logistics Tech', 'FinTech', 'EdTech',
        'HealthTech', 'PropTech', 'Automotive Tech', 'Generative AI & ML', 'Strategic Intelligence', 'Market Research', 'HR & People'];
    const field = 'width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:9px 11px;color:#fff;font-size:12px;';
    const label = 'display:block;font-size:11px;font-weight:700;color:#94a3b8;margin:0 0 4px;';

    function esc(v) {
        return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    async function api(path, method, body) {
        const res = await apiFetch(path, {
            method: method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Something went wrong');
        return data;
    }

    function statusBadge(r) {
        const map = {
            pending: ['badge-amber', 'Waiting for cMPLiBe approval'],
            approved: ['badge-emerald', 'Live for students'],
            rejected: ['badge-slate', 'Not approved'],
            closed: ['badge-slate', 'Closed']
        };
        const [cls, text] = map[r.status] || ['badge-slate', r.status];
        return `<span class="badge-pill ${cls} text-[9px]">${text}</span>`;
    }

    // ---------------------------------------------------------------
    // RECRUITER PANEL (Talent Arena tab)
    // ---------------------------------------------------------------
    async function loadRecruiterList() {
        const box = document.getElementById('reqMyList');
        if (!box) return;
        try {
            const { requirements } = await api('/api/recruiter/requirements');
            if (!requirements.length) {
                box.innerHTML = '<div class="text-xs text-slate-500 p-3">You have not posted any requirement yet.</div>';
                return;
            }
            box.innerHTML = requirements.map(r => `
                <div class="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-white truncate">${esc(r.title)}</div>
                        <div class="text-[11px] text-slate-400">${esc(r.durationDays)} days &bull; ${esc(r.location)}</div>
                        ${r.status === 'rejected' && r.rejectReason ? `<div class="text-[11px] text-rose-300 mt-0.5">Reason: ${esc(r.rejectReason)}</div>` : ''}
                        ${r.status === 'approved' || r.status === 'closed' ? `<div class="text-[11px] text-cyan-300 mt-0.5">${r.stats.inProgress} student${r.stats.inProgress === 1 ? '' : 's'} working &bull; ${r.stats.completed} completed</div>` : ''}
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        ${statusBadge(r)}
                        ${r.status === 'approved' ? `<button onclick="toggleCorporateRequirement('${esc(r.id)}', 'closed')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white">Close</button>` : ''}
                        ${r.status === 'pending' ? `<button onclick="toggleCorporateRequirement('${esc(r.id)}', 'closed')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white">Withdraw</button>` : ''}
                    </div>
                </div>`).join('');
        } catch (err) {
            box.innerHTML = `<div class="text-xs text-rose-400 p-3">${esc(err.message)}</div>`;
        }
    }

    async function toggleCorporateRequirement(id, status) {
        try {
            await api(`/api/recruiter/requirements/${encodeURIComponent(id)}/status`, 'POST', { status });
        } catch (err) {
            alert(err.message);
            return;
        }
        loadRecruiterList();
        if (document.getElementById('creatorRequestsHost')) renderCreatorRequirements();
        if (typeof syncCustomProjectsDBFromServer === 'function') {
            await syncCustomProjectsDBFromServer();
            if (typeof renderAdminProjectsList === 'function' && document.getElementById('adminCheckinDaysList')) renderAdminProjectsList();
        }
    }

    async function submitRequirement() {
        const btn = document.getElementById('reqSubmitBtn');
        const val = id => document.getElementById(id).value;
        btn.disabled = true;
        btn.textContent = 'Sending...';
        try {
            await api('/api/recruiter/requirements', 'POST', {
                title: val('reqTitle'), description: val('reqDescription'), location: val('reqLocation'), durationDays: parseInt(val('reqDays'), 10)
            });
            alert('Sent to the cMPLiBe team for approval. Once approved, the right students will be able to take up this project.');
            renderRecruiterPanel(false);
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.textContent = 'Send for approval';
        }
    }

    function renderRecruiterPanel(open) {
        const host = document.getElementById('recruiterRequirementsPanel');
        if (!host) return;
        host.dataset.open = open ? '1' : '0';
        host.innerHTML = `
            <div class="glass-card p-5 border-emerald-500/30">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 class="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-bullhorn"></i> Post a project for students</h3>
                        <p class="text-xs text-slate-400 mt-1">Describe the project like a job description. The cMPLiBe team reviews it and offers it to the most suitable campuses. Students' results build their CV.</p>
                    </div>
                    <button id="reqToggleBtn" onclick="toggleRequirementForm()" class="btn-primary py-2 px-4 text-xs">${open ? 'Hide form' : '+ New requirement'}</button>
                </div>
                <div id="reqFormWrap" style="display:${open ? 'block' : 'none'};margin-top:14px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                        <div style="grid-column:1/-1;"><label style="${label}">Project title</label>
                            <input id="reqTitle" maxlength="120" style="${field}" placeholder="e.g. Customer survey on EV charging habits"></div>
                        <div style="grid-column:1/-1;"><label style="${label}">Project description (what should students do, who to reach, what you will learn)</label>
                            <textarea id="reqDescription" rows="5" maxlength="2000" style="${field}" placeholder="e.g. Collect responses from 50 random customers aged 18-35 about EV charging habits and summarise the top 3 pain points."></textarea></div>
                        <div><label style="${label}">Location</label>
                            <input id="reqLocation" maxlength="80" style="${field}" placeholder="e.g. Mangaluru, Karnataka"></div>
                        <div><label style="${label}">Time to complete (days)</label>
                            <input id="reqDays" type="number" min="1" max="90" value="15" style="${field}"></div>
                    </div>
                    <div style="margin-top:14px;"><button id="reqSubmitBtn" onclick="submitRequirement()" class="btn-primary py-2.5 px-5 text-xs">Send for approval</button></div>
                </div>
                <div style="margin-top:16px;">
                    <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Your requirements</h4>
                    <div id="reqMyList" class="space-y-2"><div class="text-xs text-slate-500 p-3">Loading...</div></div>
                </div>
            </div>`;
        loadRecruiterList();
    }

    // ---------------------------------------------------------------
    // CREATOR: Management > Corporate Requests
    // ---------------------------------------------------------------
    let creatorRequirements = [];
    let creatorCampuses = [];

    function optionList(values, selected) {
        return values.map(v => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
    }

    async function renderCreatorRequirements() {
        const host = document.getElementById('creatorRequestsHost');
        if (!host) return;
        host.innerHTML = '<div class="text-xs text-slate-500 p-3">Loading...</div>';
        try {
            const [reqs, camps] = await Promise.all([api('/api/recruiter/requirements'), api('/api/management/campuses')]);
            creatorRequirements = reqs.requirements;
            creatorCampuses = camps.campuses || [];
        } catch (err) {
            host.innerHTML = `<div class="text-xs text-rose-400 p-3">${esc(err.message)}</div>`;
            return;
        }
        const campusName = id => (creatorCampuses.find(c => c.id === id) || {}).name || id;
        const pending = creatorRequirements.filter(r => r.status === 'pending');
        const badge = document.getElementById('mgmtReqCount');
        if (badge) { badge.textContent = pending.length; badge.classList.toggle('hidden', pending.length === 0); }

        const card = r => `
            <div class="p-4 rounded-2xl bg-slate-900/70 border ${r.status === 'pending' ? 'border-amber-500/40' : 'border-slate-800'} space-y-2">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-white">${esc(r.title)}</div>
                        <div class="text-[11px] text-cyan-300"><i class="fas fa-building mr-1"></i>${esc(r.companyName)} &bull; ${esc(r.location)} &bull; ${esc(r.durationDays)} days</div>
                    </div>
                    ${statusBadge(r)}
                </div>
                <p class="text-xs text-slate-300 whitespace-pre-line">${esc(r.description)}</p>
                ${r.status === 'approved' || r.status === 'closed' ? `
                    <div class="text-[11px] text-slate-400">${esc(r.module === 'insight_engine' ? 'Insight Engine' : 'cMPLi-ai')} &bull; ${r.milestoneId === 0 ? 'All milestones' : 'Milestone ' + esc(r.milestoneId)} &bull; ${esc(r.pts)} LCs &bull;
                        ${r.targetAllCampuses ? 'All campuses' : (r.targetCampusIds || []).map(campusName).map(esc).join(', ')}
                        &bull; ${r.stats.inProgress} working, ${r.stats.completed} completed &bull; <span class="${r.audience ? 'text-cyan-300' : 'text-rose-300 font-bold'}">reaches ${esc(r.audience)} student${r.audience === 1 ? '' : 's'}</span></div>` : ''}
                ${r.status === 'rejected' && r.rejectReason ? `<div class="text-[11px] text-rose-300">Reason: ${esc(r.rejectReason)}</div>` : ''}
                <div class="flex flex-wrap gap-2 pt-1">
                    ${r.status === 'pending' ? `<button class="btn-primary py-1.5 px-3 text-[11px]" onclick="openRequirementApproval('${esc(r.id)}')">Review &amp; approve</button>
                        <button class="btn-secondary py-1.5 px-3 text-[11px]" onclick="rejectCorporateRequirement('${esc(r.id)}')">Reject</button>` : ''}
                    ${r.status === 'approved' ? `<button class="btn-secondary py-1.5 px-3 text-[11px]" onclick="openRequirementApproval('${esc(r.id)}')">Edit campuses &amp; LCs</button>
                        <button class="btn-secondary py-1.5 px-3 text-[11px]" onclick="toggleCorporateRequirement('${esc(r.id)}', 'closed')">Close</button>` : ''}
                    ${r.status === 'closed' ? `<button class="btn-secondary py-1.5 px-3 text-[11px]" onclick="toggleCorporateRequirement('${esc(r.id)}', 'open')">Reopen</button>` : ''}
                </div>
            </div>`;

        const section = (title, list) => list.length ? `<h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2">${title} (${list.length})</h4><div class="space-y-3">${list.map(card).join('')}</div>` : '';
        host.innerHTML = creatorRequirements.length
            ? section('Waiting for your approval', pending) + section('Live and closed', creatorRequirements.filter(r => r.status === 'approved' || r.status === 'closed')) + section('Rejected', creatorRequirements.filter(r => r.status === 'rejected'))
            : '<div class="text-xs text-slate-500 p-3">No corporate requirement has been posted yet. When a recruiter posts one, you get a notification here.</div>';
    }

    function questionRow(q) {
        return `<div class="apQRow" style="display:grid;grid-template-columns:1fr 130px 32px;gap:6px;margin-bottom:6px;">
            <input class="apQTitle" maxlength="200" style="${field}" placeholder="What should the student submit?" value="${esc((q && q.title) || '')}">
            <select class="apQType" style="${field}">
                ${[['doc', 'Document / file'], ['text', 'Written answer'], ['audio', 'Audio'], ['video', 'Video']].map(([v, l]) => `<option value="${v}" ${v === ((q && q.type) || 'doc') ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button type="button" onclick="this.parentElement.remove()" style="border:0;background:transparent;color:#f87171;cursor:pointer;" title="Remove">&times;</button>
        </div>`;
    }

    function openRequirementApproval(id) {
        const r = creatorRequirements.find(x => x.id === id);
        if (!r) return;
        closeRequirementApproval();
        const questions = (r.questions && r.questions.length) ? r.questions : [{ title: 'Final project report', type: 'doc' }, { title: 'What did you learn from this project?', type: 'text' }];
        const selected = new Set(r.targetCampusIds || []);
        const byState = {};
        creatorCampuses.forEach(c => { (byState[c.district || c.state || 'Other'] = byState[c.district || c.state || 'Other'] || []).push(c); });
        const modal = document.createElement('div');
        modal.id = 'requirementApprovalModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.9);overflow:auto;padding:16px;';
        modal.innerHTML = `
            <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;color:#e2e8f0;font-family:sans-serif;">
                <div style="font:700 15px sans-serif;">${r.status === 'pending' ? 'Approve corporate project' : 'Edit corporate project'}</div>
                <div style="color:#67e8f9;font-size:12px;margin:2px 0 10px;">${esc(r.companyName)} &bull; ${esc(r.location)}</div>
                <label style="${label}">Title</label><input id="apTitle" maxlength="120" style="${field}" value="${esc(r.title)}">
                <label style="${label};margin-top:8px;">Description</label><textarea id="apDesc" rows="4" maxlength="2000" style="${field}">${esc(r.description)}</textarea>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:8px;">
                    <div><label style="${label}">Project type</label><select id="apModule" style="${field}">
                        <option value="cmpli_ai" ${r.module !== 'insight_engine' ? 'selected' : ''}>cMPLi-ai</option>
                        <option value="insight_engine" ${r.module === 'insight_engine' ? 'selected' : ''}>Insight Engine</option></select></div>
                    <div><label style="${label}">Shown at milestone</label><select id="apMilestone" style="${field}">
                        ${[[0, 'All milestones (recommended)'], [1, 'Milestone 1'], [2, 'Milestone 2'], [3, 'Milestone 3'], [4, 'Milestone 4']].map(([m, t]) => `<option value="${m}" ${m === (r.milestoneId == null ? 0 : r.milestoneId) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                    <div><label style="${label}">Reward (LCs)</label><input id="apPts" type="number" min="0" max="10000" style="${field}" value="${esc(r.pts != null ? r.pts : 1000)}"></div>
                    <div><label style="${label}">Days to complete</label><input id="apDays" type="number" min="1" max="90" style="${field}" value="${esc(r.durationDays)}"></div>
                    <div><label style="${label}">Sector</label><select id="apSector" style="${field}">${optionList(SECTORS, r.sector || 'General')}</select></div>
                </div>
                <label style="${label};margin-top:12px;">Which campuses can take this project?</label>
                <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:6px;"><input type="checkbox" id="apAll" ${r.targetAllCampuses ? 'checked' : ''} onchange="document.getElementById('apCampusList').style.opacity = this.checked ? .4 : 1"> All campuses</label>
                <div id="apCampusList" style="max-height:200px;overflow:auto;border:1px solid #334155;border-radius:12px;padding:8px;opacity:${r.targetAllCampuses ? .4 : 1};">
                    ${Object.keys(byState).sort().map(group => `
                        <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin:6px 0 2px;">${esc(group)}</div>
                        ${byState[group].map(c => `<label style="display:flex;gap:8px;align-items:center;font-size:12px;padding:2px 0;"><input type="checkbox" class="apCampus" value="${esc(c.id)}" ${selected.has(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}`).join('') || '<div style="font-size:12px;color:#94a3b8;">No campuses registered yet.</div>'}
                </div>
                <label style="${label};margin-top:12px;">What students must submit</label>
                <div id="apQuestions">${questions.map(questionRow).join('')}</div>
                <button type="button" onclick="document.getElementById('apQuestions').insertAdjacentHTML('beforeend', window._apQuestionRow())" style="border:0;background:transparent;color:#67e8f9;font-weight:700;font-size:11px;cursor:pointer;">+ Add item</button>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="closeRequirementApproval()">Cancel</button>
                    <button id="apSave" style="padding:8px 16px;border-radius:10px;border:0;background:#059669;color:#fff;font-weight:700;cursor:pointer;" onclick="saveRequirementApproval('${esc(r.id)}')">${r.status === 'pending' ? 'Approve and publish' : 'Save changes'}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    function closeRequirementApproval() {
        const m = document.getElementById('requirementApprovalModal');
        if (m) m.remove();
    }

    async function saveRequirementApproval(id) {
        const btn = document.getElementById('apSave');
        const val = i => document.getElementById(i).value;
        const questions = [...document.querySelectorAll('.apQRow')].map(row => ({
            title: row.querySelector('.apQTitle').value.trim(), type: row.querySelector('.apQType').value
        })).filter(q => q.title);
        btn.disabled = true;
        try {
            await api(`/api/recruiter/requirements/${encodeURIComponent(id)}/approve`, 'POST', {
                title: val('apTitle'), description: val('apDesc'), module: val('apModule'), milestoneId: parseInt(val('apMilestone'), 10),
                pts: parseInt(val('apPts'), 10), durationDays: parseInt(val('apDays'), 10), sector: val('apSector'), questions,
                targetAllCampuses: document.getElementById('apAll').checked,
                targetCampusIds: [...document.querySelectorAll('.apCampus:checked')].map(c => c.value)
            });
            closeRequirementApproval();
            renderCreatorRequirements();
            if (typeof loadCreatorNotifications === 'function') loadCreatorNotifications();
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
        }
    }

    async function rejectCorporateRequirement(id) {
        const reason = prompt('Reason for the recruiter (optional):', '');
        if (reason === null) return;
        try {
            await api(`/api/recruiter/requirements/${encodeURIComponent(id)}/reject`, 'POST', { reason });
        } catch (err) {
            alert(err.message);
            return;
        }
        renderCreatorRequirements();
        if (typeof loadCreatorNotifications === 'function') loadCreatorNotifications();
    }

    window.initRecruiterRequirements = function () { renderRecruiterPanel(false); };
    window.toggleRequirementForm = function () {
        const wrap = document.getElementById('reqFormWrap');
        const btn = document.getElementById('reqToggleBtn');
        const show = wrap.style.display === 'none';
        wrap.style.display = show ? 'block' : 'none';
        btn.textContent = show ? 'Hide form' : '+ New requirement';
    };
    window.submitRequirement = submitRequirement;
    window.toggleCorporateRequirement = toggleCorporateRequirement;
    window.renderCreatorRequirements = renderCreatorRequirements;
    window.openRequirementApproval = openRequirementApproval;
    window.closeRequirementApproval = closeRequirementApproval;
    window.saveRequirementApproval = saveRequirementApproval;
    window.rejectCorporateRequirement = rejectCorporateRequirement;
    window._apQuestionRow = () => questionRow(null);
    window.openCorporateRequestsTab = function () {
        const modal = document.getElementById('adminNotificationsModal');
        if (modal) modal.classList.add('hidden');
        if (typeof switchTab === 'function') switchTab('managementTab');
        if (typeof switchManagementSubTab === 'function') switchManagementSubTab('requests');
    };
})();

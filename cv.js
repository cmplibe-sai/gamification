// ==============================================================
// cMPLiBe AUTOMATIC CV - viewer, editor and PDF download (client side)
// The CV itself is built on the server (cvEngine.js) from the student's project submissions.
// Layout follows the cMPLiBe CV template: name and photo on top, a wide left column
// (intro, project experience) and a narrow right column (badges, competencies, skills, academics).
// ==============================================================
(function () {
    const CV_FONT = "'Times New Roman', Times, serif";

    function esc(value) {
        return (typeof escapeHtml === 'function' ? escapeHtml(value) : String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    }

    function badgeImageFor(milestoneId) {
        const cfg = (window.milestoneConfig || []).find(m => Number(m.id) === Number(milestoneId));
        return cfg ? { src: cfg.badgeImage, name: cfg.name } : null;
    }

    function photoUrlFor(url) {
        if (!url) return '';
        if (/^\/(gamification\/)?uploads\//.test(url) && typeof APP_PATH_PREFIX === 'string' && !url.startsWith('/gamification/')) {
            return APP_PATH_PREFIX + url;
        }
        return url;
    }

    // Returns the CV as a self-contained HTML string with inline styles (works on screen and in the print window).
    function renderAutoCvHtml(cv, options) {
        const forPrint = Boolean(options && options.forPrint);
        const heading = 'font-size:13pt;font-weight:bold;letter-spacing:.5px;margin:16px 0 6px;border-bottom:1.5px solid #222;padding-bottom:2px;';
        const list = (items) => items.map((v, i) => `<div style="margin:3px 0;">${i + 1}. ${esc(v)}</div>`).join('');

        const experiences = cv.experiences.length
            ? cv.experiences.map((e, i) => `
                <div style="margin:0 0 12px;page-break-inside:avoid;">
                    <div style="font-weight:bold;">${i + 1}. ${esc(e.title)} <span style="font-weight:normal;font-size:10.5pt;">- ${esc(e.moduleLabel)}${e.company ? ' for ' + esc(e.company) : ''}, Milestone ${esc(e.milestoneId)}</span></div>
                    <ul style="margin:4px 0 0 22px;padding:0;list-style:disc;">
                        ${e.bullets.map(b => `<li style="margin:3px 0;">${esc(b)}</li>`).join('')}
                    </ul>
                </div>`).join('')
            : `<div style="color:#666;font-style:italic;">Project experience will appear here automatically as soon as projects are submitted.</div>`;

        const badges = (cv.badges || []).map(b => badgeImageFor(b.milestoneId)).filter(Boolean)
            .map(b => `<img src="${esc(b.src)}" alt="${esc(b.name)}" title="${esc(b.name)}" style="width:76px;height:76px;object-fit:contain;border-radius:8px;margin:0 4px 4px 0;">`).join('');

        const academics = (cv.academics || []).map(a => `
            <div style="margin:5px 0;"><strong>${esc(a.degree)}</strong>${a.year ? ' - ' + esc(a.year) : ''}${a.score ? ' - ' + esc(a.score) : ''}${a.institution ? `<br><span style="font-size:10.5pt;">${esc(a.institution)}</span>` : ''}</div>`).join('');

        const competencies = cv.competencies.length ? list(cv.competencies) : '<div style="color:#666;font-style:italic;">Builds up from project work.</div>';
        const languages = (cv.languages || []).length ? `<div style="margin-top:6px;">Languages known: ${esc(cv.languages.join(', '))}</div>` : '';
        const photo = photoUrlFor(cv.photoUrl);

        return `
        <div style="font-family:${CV_FONT};color:#111;background:#fff;font-size:11.5pt;line-height:1.35;padding:28px 30px;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:26pt;font-weight:bold;text-transform:uppercase;line-height:1.1;">${esc(cv.name)}</div>
                    <div style="font-size:13pt;font-weight:bold;margin-top:6px;">${esc(cv.headline)}</div>
                </div>
                ${photo ? `<img src="${esc(photo)}" alt="" style="width:120px;height:130px;object-fit:cover;object-position:top;border-radius:4px;flex:none;" onerror="this.style.display='none'">`
                    : (forPrint ? '' : `<div style="width:120px;height:130px;flex:none;border:2px dashed #999;border-radius:4px;display:flex;align-items:center;justify-content:center;text-align:center;color:#777;font-size:10pt;padding:6px;box-sizing:border-box;">Add your photo<br>(Edit details)</div>`)}
            </div>
            <div style="display:flex;gap:26px;margin-top:6px;">
                <div style="flex:1 1 62%;min-width:0;">
                    <div style="margin-top:8px;">${esc(cv.intro)}</div>
                    <div style="${heading}">PROJECT EXPERIENCE</div>
                    ${experiences}
                </div>
                <div style="flex:1 1 34%;min-width:0;">
                    ${badges ? `<div style="margin-top:10px;">${badges}</div>` : ''}
                    <div style="${heading}">COMPETENCIES</div>
                    ${competencies}${languages}
                    <div style="${heading}">TECHNICAL SKILLS</div>
                    ${cv.technicalSkills.length ? list(cv.technicalSkills) : '<div style="color:#666;font-style:italic;">Builds up from project work.</div>'}
                    ${academics ? `<div style="${heading}">ACADEMICS</div>${academics}` : ''}
                </div>
            </div>
        </div>`;
    }

    async function fetchAutoCv(studentId) {
        const res = await apiFetch(`/api/learner/cv-profile/${encodeURIComponent(studentId)}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Could not load the CV.');
        return data.cv;
    }

    function closeAutoCv() {
        const el = document.getElementById('autoCvOverlay');
        if (el) el.remove();
    }

    function isOwnCv(cv) {
        const me = window.currentUser;
        return Boolean(me && String(me._id || me.id) === String(cv.studentId));
    }

    function isCreatorViewer() {
        return typeof isPlatformCreatorOrAdmin === 'function' && isPlatformCreatorOrAdmin();
    }

    async function openAutoCv(studentId) {
        closeAutoCv();
        const overlay = document.createElement('div');
        overlay.id = 'autoCvOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.86);overflow:auto;padding:16px;';
        overlay.innerHTML = '<div style="color:#e2e8f0;text-align:center;margin-top:20vh;font-family:sans-serif;">Loading CV...</div>';
        document.body.appendChild(overlay);

        try {
            const cv = await fetchAutoCv(studentId);
            window._autoCvCurrent = cv;
            const canEdit = isOwnCv(cv) || isCreatorViewer();
            const btn = 'padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font:600 12px sans-serif;cursor:pointer;';
            overlay.innerHTML = `
                <div style="max-width:860px;margin:0 auto;">
                    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="color:#e2e8f0;font:600 13px sans-serif;">cMPLiBe CV ${cv.pendingTranscripts ? '<span style="color:#fbbf24;font-weight:400;"> - still reading recordings, refresh in a minute</span>' : ''}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;">
                            ${canEdit ? `<button style="${btn}" onclick="rebuildAutoCv('${esc(cv.studentId)}')">Refresh from projects</button>` : ''}
                            ${canEdit ? `<button style="${btn}" onclick="openAutoCvEditor()">Edit details</button>` : ''}
                            <button style="${btn}background:#0891b2;border-color:#0891b2;color:#fff;" onclick="printAutoCv()">Download PDF</button>
                            <button style="${btn}" onclick="closeAutoCv()">Close</button>
                        </div>
                    </div>
                    <div id="autoCvPaper" style="box-shadow:0 10px 40px rgba(0,0,0,.5);border-radius:6px;overflow:hidden;background:#fff;">${renderAutoCvHtml(cv)}</div>
                </div>`;
        } catch (err) {
            overlay.innerHTML = `<div style="max-width:420px;margin:20vh auto 0;background:#0f172a;color:#e2e8f0;padding:20px;border-radius:14px;font:14px sans-serif;text-align:center;">
                ${esc(err.message)}<br><br><button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="closeAutoCv()">Close</button></div>`;
        }
    }

    async function rebuildAutoCv(studentId) {
        try {
            const res = await apiFetch('/api/learner/cv-profile/rebuild', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Refresh failed');
        } catch (err) {
            alert(err.message);
            return;
        }
        openAutoCv(studentId);
    }

    function printAutoCv() {
        const cv = window._autoCvCurrent;
        if (!cv) return;
        const win = window.open('', '_blank');
        if (!win) { alert('Please allow pop-ups to download the CV as PDF.'); return; }
        const base = `${location.origin}${(typeof APP_PATH_PREFIX === 'string' ? APP_PATH_PREFIX : '')}/`;
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${esc(base)}">
            <title>${esc(cv.name)} - cMPLiBe CV</title>
            <style>@page{size:A4;margin:10mm} body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
            </head><body>${renderAutoCvHtml(cv, { forPrint: true })}</body></html>`);
        win.document.close();
        win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 350);
    }

    function openAutoCvEditor() {
        const cv = window._autoCvCurrent;
        if (!cv) return;
        const m = cv.manual || {};
        const field = 'width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid #334155;background:#020617;color:#e2e8f0;font:13px sans-serif;';
        const label = 'display:block;margin:10px 0 4px;color:#94a3b8;font:600 11px sans-serif;text-transform:uppercase;letter-spacing:.5px;';
        const rows = (cv.academics.length ? cv.academics : [{}, {}]).concat([{}]).slice(0, 5);
        const modal = document.createElement('div');
        modal.id = 'autoCvEditor';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.9);overflow:auto;padding:16px;';
        modal.innerHTML = `
            <div style="max-width:620px;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;color:#e2e8f0;font-family:sans-serif;">
                <div style="font:700 15px sans-serif;">Edit CV details</div>
                <div style="color:#94a3b8;font-size:12px;margin-top:2px;">Project experience, competencies and skills are written automatically from your projects. Add the rest here.</div>
                <label style="${label}">Headline (under your name)</label>
                <input id="cvEdHeadline" maxlength="80" style="${field}" value="${esc(m.headline)}" placeholder="${esc(cv.headline)}">
                <label style="${label}">Intro (leave empty to keep the automatic intro)</label>
                <textarea id="cvEdIntro" maxlength="700" rows="4" style="${field}" placeholder="${esc(cv.intro)}">${esc(m.intro)}</textarea>
                <label style="${label}">Languages known (comma separated)</label>
                <input id="cvEdLanguages" style="${field}" value="${esc((cv.languages || []).join(', '))}" placeholder="English, Kannada, Hindi">
                <label style="${label}">Extra competencies (comma separated)</label>
                <input id="cvEdCompetencies" style="${field}" value="${esc((m.extraCompetencies || []).join(', '))}" placeholder="Public speaking, Negotiation">
                <label style="${label}">Extra technical skills (comma separated)</label>
                <input id="cvEdSkills" style="${field}" value="${esc((m.extraSkills || []).join(', '))}" placeholder="Video editing, Tally">
                <label style="${label}">Academics</label>
                ${rows.map((a, i) => `
                    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-bottom:6px;">
                        <input class="cvEdAcDegree" style="${field}" placeholder="Degree e.g. MBA HR" value="${esc(a.degree)}">
                        <input class="cvEdAcYear" style="${field}" placeholder="Year e.g. 2024-26" value="${esc(a.year)}">
                        <input class="cvEdAcScore" style="${field}" placeholder="Score e.g. 79%" value="${esc(a.score)}">
                        <input class="cvEdAcInst" style="${field}grid-column:1 / span 3;" placeholder="Institution (optional)" value="${esc(a.institution)}">
                    </div>`).join('')}
                <label style="${label}">Photo</label>
                <input id="cvEdPhoto" type="file" accept="image/png,image/jpeg" style="color:#94a3b8;font-size:12px;">
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="document.getElementById('autoCvEditor').remove()">Cancel</button>
                    <button id="cvEdSave" style="padding:8px 16px;border-radius:10px;border:0;background:#0891b2;color:#fff;font-weight:700;cursor:pointer;" onclick="saveAutoCvEditor()">Save</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    function splitList(value) {
        return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read the photo.'));
            reader.readAsDataURL(file);
        });
    }

    async function saveAutoCvEditor() {
        const cv = window._autoCvCurrent;
        const saveBtn = document.getElementById('cvEdSave');
        if (!cv || !saveBtn) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            const body = {
                studentId: cv.studentId,
                headline: document.getElementById('cvEdHeadline').value,
                intro: document.getElementById('cvEdIntro').value,
                languages: splitList(document.getElementById('cvEdLanguages').value),
                extraCompetencies: splitList(document.getElementById('cvEdCompetencies').value),
                extraSkills: splitList(document.getElementById('cvEdSkills').value),
                academics: []
            };
            const degrees = document.querySelectorAll('.cvEdAcDegree'), years = document.querySelectorAll('.cvEdAcYear'),
                scores = document.querySelectorAll('.cvEdAcScore'), insts = document.querySelectorAll('.cvEdAcInst');
            degrees.forEach((el, i) => body.academics.push({ degree: el.value, year: years[i].value, score: scores[i].value, institution: insts[i].value }));

            const photoFile = document.getElementById('cvEdPhoto').files[0];
            if (photoFile) {
                if (photoFile.size > 2 * 1024 * 1024) throw new Error('Photo must be smaller than 2 MB.');
                const dataUrl = await readFileAsDataUrl(photoFile);
                const up = await (await apiFetch('/api/upload-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl, prefix: 'cv_photo', filename: `cv_photo_${Date.now()}.${photoFile.type === 'image/png' ? 'png' : 'jpg'}` })
                })).json();
                if (!(up && up.success && up.url)) throw new Error('Photo upload failed. Please try again.');
                body.photoUrl = up.url;
            }

            const data = await (await apiFetch('/api/learner/cv-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })).json();
            if (!data.success) throw new Error(data.error || 'Could not save.');
            document.getElementById('autoCvEditor').remove();
            openAutoCv(cv.studentId);
        } catch (err) {
            alert(err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }

    window.renderAutoCvHtml = renderAutoCvHtml;
    window.openAutoCv = openAutoCv;
    window.closeAutoCv = closeAutoCv;
    window.rebuildAutoCv = rebuildAutoCv;
    window.printAutoCv = printAutoCv;
    window.openAutoCvEditor = openAutoCvEditor;
    window.saveAutoCvEditor = saveAutoCvEditor;
    window.openOwnAutoCv = function () {
        const me = window.currentUser;
        if (me) openAutoCv(me._id || me.id);
    };
})();

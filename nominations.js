// ==============================================================
// cMPLiBe OPPORTUNITIES AND NOMINATIONS (client side)
//
// Student tab "Opportunities": open Rapid XP / Corporate Residency / Final Placement openings with
// the reasons a student is or is not eligible, nominations with consent, the "did you attend your
// interview?" check-in (yes -> questions asked, no -> reason) and a full timeline of every
// nomination, interview round and result.
// Creator: Management > Opportunities to create openings, set the cooldown, and follow or correct
// every student's nominations and interviews. Rules and data are in server.js (section 4e).
// ==============================================================
(function () {
    const TYPES = { rapid_xp: 'Rapid XP Engine', residency: 'Corporate Residency', placement: 'Final Placement' };
    const TYPE_COLORS = { rapid_xp: 'text-amber-300 border-amber-500/40 bg-amber-950/30', residency: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/30', placement: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30' };
    const STATUS = {
        nominated: ['Nominated', 'badge-indigo'], interview_stage: ['In interview process', 'badge-amber'], selected: ['Selected', 'badge-emerald'],
        offer_letter: ['Offer letter issued', 'badge-emerald'], on_hold: ['On hold', 'badge-amber'], final_shortlist: ['Shortlisted', 'badge-emerald'],
        rejected: ['Not selected', 'badge-slate'], withdrawn: ['Withdrawn', 'badge-slate'], no_show: ['Did not attend', 'badge-slate'], completed: ['Completed', 'badge-emerald']
    };
    const OUTCOME = { pending: 'Waiting for result', shortlisted: 'Cleared - moves to the next round', rejected: 'Not selected', selected: 'Selected', offer: 'Offer letter issued',
        on_hold: 'On hold', final_shortlist: 'Shortlisted', no_show: 'Did not attend' };
    const NO_SHOW_REASONS = [['not_interested', 'I am no longer interested in this role'], ['other_offer', 'I got another offer'], ['personal', 'Personal reasons'],
        ['schedule_clash', 'Clash with another commitment'], ['company_cancelled', 'The company cancelled or rescheduled'], ['other', 'Other']];
    const field = 'width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:9px 11px;color:#fff;font-size:12px;';
    const label = 'display:block;font-size:11px;font-weight:700;color:#94a3b8;margin:0 0 4px;';

    function esc(v) {
        return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function when(iso) { return iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }
    function day(iso) { return iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

    async function api(path, method, body) {
        const res = await apiFetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); }
        catch (e) {
            // The server (or a proxy in front of it) answered with a web page instead of data
            console.warn('[cMPLiBe] Unexpected reply from', path, res.status, raw.slice(0, 200));
            throw new Error(`The server sent an unexpected reply (code ${res.status}). Please try again in a minute. If it keeps happening, tell the cMPLiBe team the time and what you were doing.`);
        }
        if (!data.success) throw new Error(data.error || 'Something went wrong');
        return data;
    }

    function myLqZone() {
        try {
            const me = window.currentUser;
            if (!me || typeof computeLqStats !== 'function') return '';
            const id = me._id || me.id;
            const ms = typeof getActualLearnerHighestMilestone === 'function' ? getActualLearnerHighestMilestone(id) : 1;
            return computeLqStats(me, ms, 'all').zone || '';
        } catch (e) { return ''; }
    }

    // Live countdown on every element with data-deadline (nomination close time)
    function formatCountdown(ms) {
        const t = Math.max(0, Math.floor(ms / 1000));
        const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
        const p = n => String(n).padStart(2, '0');
        return (d ? `${d}d ` : '') + `${p(h)}:${p(m)}:${p(sec)}`;
    }
    function tickTimers() {
        document.querySelectorAll('.opp-timer').forEach(el => {
            const left = new Date(el.dataset.deadline).getTime() - Date.now();
            if (left <= 0) { el.textContent = 'Nominations closed'; el.style.color = '#94a3b8'; return; }
            const urgent = left < 86400000;
            el.textContent = (urgent ? 'Hurry! closes in ' : 'Closes in ') + formatCountdown(left);
            el.style.color = urgent ? '#fb7185' : '#fbbf24';
            el.style.fontWeight = urgent ? '800' : '600';
        });
    }
    setInterval(tickTimers, 1000);

    function statusBadge(status) {
        const [text, cls] = STATUS[status] || [status, 'badge-slate'];
        return `<span class="badge-pill ${cls} text-[9px]">${esc(text)}</span>`;
    }

    // ---------------------------------------------------------------
    // Shared timeline of nominations (student view and Creator view)
    // ---------------------------------------------------------------
    function attendanceText(r) {
        if (r.creatorAttended === true) return '<span class="text-emerald-300">Attended (confirmed by cMPLiBe)</span>';
        if (r.creatorAttended === false) return '<span class="text-rose-300">Not attended (marked by cMPLiBe)</span>';
        if (r.studentAttended === true) return '<span class="text-emerald-300">Attended (student says yes)</span>';
        if (r.studentAttended === false) return `<span class="text-rose-300">Did not attend${r.noShowReason ? ': ' + esc(r.noShowReason) : ''}</span>`;
        return new Date(r.scheduledAt) > new Date() ? '<span class="text-slate-400">Upcoming</span>' : '<span class="text-amber-300">Waiting for the student to confirm</span>';
    }

    function timelineHtml(nominations, creator) {
        if (!nominations.length) return '<div class="text-xs text-slate-500 p-4 text-center">No nominations yet.</div>';
        return nominations.map(n => {
            const o = n.opportunity || {};
            const rounds = (n.rounds || []).map(r => `
                <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-1">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="font-bold text-white">Round ${esc(r.number)}${r.label ? ' - ' + esc(r.label) : ''} <span class="font-normal text-slate-400">${esc(when(r.scheduledAt))}</span></span>
                        <span class="text-slate-300">${esc(OUTCOME[r.outcome] || r.outcome)}</span>
                    </div>
                    <div>${attendanceText(r)}</div>
                    ${r.venue ? `<div class="text-slate-300">Where: ${/^https?:\/\//.test(r.venue) ? `<a class="text-cyan-300 underline" target="_blank" rel="noopener" href="${esc(r.venue)}">${esc(r.venue)}</a>` : esc(r.venue)}${r.durationMinutes ? ` &bull; ${esc(r.durationMinutes)} minutes` : ''}</div>` : (r.durationMinutes ? `<div class="text-slate-400">${esc(r.durationMinutes)} minutes</div>` : '')}
                    ${r.note ? `<div class="text-slate-300">Note: ${esc(r.note)}</div>` : ''}
                    ${r.questions && r.questions.length ? `<details><summary class="cursor-pointer text-cyan-300">${r.questions.length} question${r.questions.length === 1 ? '' : 's'} asked</summary><ol class="list-decimal ml-5 mt-1 text-slate-300 space-y-0.5">${r.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol></details>` : ''}
                    ${r.outcomeReason ? `<div class="text-slate-300">Feedback: ${esc(r.outcomeReason)}</div>` : ''}
                    ${creator ? `<div class="flex flex-wrap gap-1.5 pt-1">
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-amber-300" onclick="creatorRescheduleRound('${esc(n.id)}','${esc(r.id)}')">Reschedule</button>
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-300" onclick="creatorMarkRound('${esc(n.id)}','${esc(r.id)}',{attended:true})">Mark attended</button>
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-rose-300" onclick="creatorMarkRound('${esc(n.id)}','${esc(r.id)}',{attended:false})">Mark not attended</button>
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300" onclick="creatorRoundResult('${esc(n.id)}','${esc(r.id)}','shortlisted')">Cleared round</button>
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300" onclick="creatorRoundResult('${esc(n.id)}','${esc(r.id)}','rejected')">Not selected</button>
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-amber-300" onclick="creatorRoundResult('${esc(n.id)}','${esc(r.id)}','on_hold')">On hold</button>
                        <button class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-300" onclick="creatorRoundResult('${esc(n.id)}','${esc(r.id)}','offer')">Offer letter</button>
                    </div>` : ''}
                </div>`).join('');
            return `
            <div class="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-white">${esc(o.title || 'Opportunity')}</div>
                        <div class="text-[11px] text-slate-400">
                            <span class="px-1.5 py-0.5 rounded border ${TYPE_COLORS[o.type] || ''}">${esc(TYPES[o.type] || '')}</span>
                            ${esc(o.company || '')} &bull; Nominated ${esc(day(n.nominatedAt))}
                            ${creator ? ` &bull; <a href="javascript:void(0)" class="text-cyan-300 underline" onclick="openStudentPipeline('${esc(n.studentId)}')">${esc(n.studentName)}</a> (${esc(n.lqZone || 'LQ n/a')})` : ''}
                        </div>
                    </div>
                    ${statusBadge(n.status)}
                </div>
                ${n.statusReason ? `<div class="text-[11px] text-slate-300">Note: ${esc(n.statusReason)}</div>` : ''}
                <div class="space-y-1.5">${rounds || '<div class="text-[11px] text-slate-500">No interview has been scheduled yet. You will be notified when it is.</div>'}</div>
                ${(n.history || []).length ? `<details><summary class="cursor-pointer text-[11px] text-slate-400">History</summary><ul class="text-[11px] text-slate-400 mt-1 space-y-0.5">${n.history.map(h => `<li>${esc(when(h.at))} - ${esc(h.text)}</li>`).join('')}</ul></details>` : ''}
                <div class="flex flex-wrap gap-2 pt-1">
                    ${!creator && !['selected', 'offer_letter', 'rejected', 'withdrawn', 'no_show', 'completed'].includes(n.status) ? `<button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300 hover:text-white" onclick="openReportInterview('${esc(n.id)}')">I had an interview - add details</button>
                        <button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white" onclick="withdrawNomination('${esc(n.id)}')">Withdraw</button>` : ''}
                    ${creator ? `
                        <button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300" onclick="creatorAddRound('${esc(n.id)}')">+ Schedule interview</button>
                        <button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-emerald-300" onclick="creatorSetNominationStatus('${esc(n.id)}','offer_letter')">Offer letter issued</button>
                        <button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-amber-300" onclick="creatorSetNominationStatus('${esc(n.id)}','on_hold')">On hold</button>
                        <button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-emerald-300" onclick="creatorSetNominationStatus('${esc(n.id)}','completed')">Mark internship completed</button>
                        <button class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300" onclick="creatorSetNominationStatus('${esc(n.id)}','rejected')">Mark not selected</button>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    function summaryHtml(s) {
        const cell = (value, text, color) => `<div class="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center"><div class="text-xl font-extrabold ${color} font-mono">${value}</div><div class="text-[10px] text-slate-400 mt-0.5">${text}</div></div>`;
        return `<div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            ${cell(s.nominations, 'Nominations', 'text-white')}${cell(s.interviewsAttended, 'Interviews attended', 'text-cyan-300')}${cell(s.shortlisted, 'Shortlisted', 'text-amber-300')}
            ${cell(s.rejected, 'Not selected', 'text-slate-300')}${cell(s.selected, 'Selected / completed', 'text-emerald-300')}${cell(s.noShows + s.withdrawn, 'Missed or withdrawn', 'text-rose-300')}</div>`;
    }

    // ---------------------------------------------------------------
    // STUDENT TAB
    // ---------------------------------------------------------------
    function checkInHtml(p, nominations) {
        const n = nominations.find(x => x.id === p.nominationId) || {};
        const o = n.opportunity || {};
        const k = `${p.nominationId}_${p.roundId}`;
        return `
        <div class="p-4 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-950/30 to-slate-900/80 space-y-3" id="ci_${esc(k)}">
            <div class="text-sm font-bold text-white"><i class="fas fa-bell text-amber-300 mr-1.5"></i> Did you attend your interview with ${esc(o.company || 'the company')}?</div>
            <div class="text-[11px] text-slate-300">${esc(o.title || '')} &bull; Round ${esc(p.roundNumber)}${p.label ? ' (' + esc(p.label) + ')' : ''} &bull; ${esc(when(p.scheduledAt))}</div>
            <div class="flex gap-2">
                <button class="btn-primary py-1.5 px-4 text-xs" onclick="document.getElementById('ciYes_${esc(k)}').style.display='block';document.getElementById('ciNo_${esc(k)}').style.display='none'">Yes, I attended</button>
                <button class="btn-secondary py-1.5 px-4 text-xs" onclick="document.getElementById('ciNo_${esc(k)}').style.display='block';document.getElementById('ciYes_${esc(k)}').style.display='none'">No, I did not</button>
            </div>
            <div id="ciYes_${esc(k)}" style="display:none;">
                <label style="${label}">Questions you were asked (one per line: self-introduction, technical, scenario-based...)</label>
                <textarea id="ciQ_${esc(k)}" rows="6" style="${field}" placeholder="Tell me about yourself&#10;Why do you want this role?&#10;How would you handle a customer complaint?"></textarea>
                <button class="btn-primary py-1.5 px-4 text-xs mt-2" onclick="submitCheckIn('${esc(p.nominationId)}','${esc(p.roundId)}',true)">Submit</button>
            </div>
            <div id="ciNo_${esc(k)}" style="display:none;">
                <label style="${label}">Why did you not attend?</label>
                <select id="ciR_${esc(k)}" style="${field}">${NO_SHOW_REASONS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
                <input id="ciN_${esc(k)}" maxlength="300" style="${field}margin-top:6px;" placeholder="Anything you want to add (optional)">
                <div class="text-[10px] text-amber-300 mt-1">Note: missing an interview pauses new nominations for a few days.</div>
                <button class="btn-secondary py-1.5 px-4 text-xs mt-2" onclick="submitCheckIn('${esc(p.nominationId)}','${esc(p.roundId)}',false)">Submit</button>
            </div>
        </div>`;
    }

    // One opening as the student sees it: open (nominate), nominated (green line) or closed (missed, kept visible).
    function opportunityCard(o) {
        const ev = o.eligibility;
        const isNominated = o.state === 'nominated';
        const isClosed = Boolean(o.closed);
        const border = isNominated ? 'border-emerald-500/60' : (isClosed ? 'border-slate-800 opacity-80' : (ev.eligible ? 'border-emerald-500/40' : 'border-slate-800'));
        const head = `
            <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                    <div class="text-sm font-bold text-white">${esc(o.title)}</div>
                    <div class="text-[11px] text-slate-400"><span class="px-1.5 py-0.5 rounded border ${TYPE_COLORS[o.type] || ''}">${esc(o.typeLabel)}</span> ${esc(o.company)}${o.location ? ' &bull; ' + esc(o.location) : ''}${o.duration ? ' &bull; ' + esc(o.duration) : ''}${o.compensation ? ' &bull; ' + esc(o.compensation) : ''}</div>
                </div>
                ${isClosed ? '<span class="badge-pill badge-slate text-[10px]">Nominations closed</span>'
                    : (o.nominationDeadline && !isNominated ? `<span class="opp-timer text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-950/70 border border-slate-700" data-deadline="${esc(o.nominationDeadline)}" title="Nominations close ${esc(when(o.nominationDeadline))}"></span>` : '')}
            </div>
            <p class="text-xs text-slate-300 whitespace-pre-line">${esc(o.description)}</p>`;
        let foot;
        if (isNominated) {
            const st = STATUS[o.nominationStatus] ? STATUS[o.nominationStatus][0] : 'Nominated';
            foot = `<div class="text-xs font-bold text-emerald-300 border-t border-emerald-500/40 pt-2"><i class="fas fa-circle-check mr-1.5"></i>You nominated for this opportunity${o.nominatedAt ? ' on ' + esc(day(o.nominatedAt)) : ''} &bull; Status: ${esc(st)}${isClosed ? ' &bull; nominations are now closed' : ''}</div>`;
        } else if (isClosed) {
            foot = '<div class="text-xs text-slate-400 border-t border-slate-800 pt-2"><i class="fas fa-clock-rotate-left mr-1.5"></i>This opportunity is closed. It was presented to you and you did not nominate before it closed.</div>';
        } else {
            foot = `
            ${ev.checks.length ? `<ul class="text-[11px] space-y-0.5">${ev.checks.map(c => `<li class="${c.ok ? 'text-emerald-300' : 'text-slate-400'}"><i class="fas ${c.ok ? 'fa-circle-check' : 'fa-lock'} mr-1"></i>${esc(c.label)}: ${esc(c.have)} / ${esc(c.need)}</li>`).join('')}</ul>` : ''}
            ${ev.blocker ? `<div class="text-[11px] text-rose-300">${esc(ev.blocker)}</div>` : ''}
            <button class="btn-primary py-1.5 px-4 text-xs" ${ev.eligible ? '' : 'disabled style="opacity:.45;cursor:not-allowed;"'} onclick="openNominateDialog('${esc(o.id)}')">${ev.eligible ? 'Nominate' : 'Not available yet'}</button>`;
        }
        return `<div class="p-4 rounded-2xl bg-slate-900/70 border ${border} space-y-2">${head}${foot}</div>`;
    }

    const STAGE_HELP = {
        rapid_xp: 'Paid micro internships of one or two months.',
        residency: 'A dedicated three-month internship.',
        placement: 'Full-time jobs sourced by cMPLiBe from the market.'
    };
    const CLOSED_STATUSES = ['selected', 'offer_letter', 'rejected', 'withdrawn', 'no_show', 'completed'];

    function effective(r) {
        if (r.creatorAttended === true || r.creatorAttended === false) return r.creatorAttended;
        if (r.studentAttended === true || r.studentAttended === false) return r.studentAttended;
        return null;
    }

    function stageTabHtml(type, list, active) {
        const open = list.filter(o => o.state === 'open');
        const canNominate = open.filter(o => o.eligibility.eligible).length;
        const nominated = list.filter(o => o.state === 'nominated').length;
        const missed = list.filter(o => o.state === 'closed').length;
        const line = list.length
            ? `${open.length} open${canNominate ? ` (${canNominate} you can nominate for)` : ''} &bull; ${nominated} nominated &bull; ${missed} missed`
            : 'No opening yet';
        return `<button onclick="setOpportunitiesTab('${type}')" class="text-left p-3 rounded-2xl border transition-all ${active ? 'border-indigo-500 bg-indigo-950/40' : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'}" style="min-width:150px;flex:1;">
            <div class="text-xs font-extrabold text-white">${esc(TYPES[type])}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${esc(STAGE_HELP[type])}</div>
            <div class="text-[11px] mt-1 ${canNominate ? 'text-emerald-300' : 'text-slate-400'}">${line}</div>
        </button>`;
    }

    function statsStripHtml(st) {
        if (!st) return '';
        const cell = (v, t, c) => `<div class="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-center"><span class="text-lg font-extrabold ${c} font-mono">${v}</span> <span class="text-[11px] text-slate-400">${t}</span></div>`;
        return `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${cell(st.presented, 'presented to you', 'text-white')}${cell(st.nominated, 'nominated', 'text-emerald-300')}${cell(st.open, 'open now', 'text-amber-300')}${cell(st.missed, 'missed (closed)', 'text-rose-300')}</div>`;
    }

    function ongoingHtml(nominations) {
        const ongoing = nominations.filter(n => !CLOSED_STATUSES.includes(n.status));
        if (!ongoing.length) return '<div class="text-xs text-slate-500 p-3 border border-dashed border-slate-800 rounded-xl">No process is running right now.</div>';
        return ongoing.map(n => {
            const rounds = n.rounds || [];
            const next = rounds.find(r => new Date(r.scheduledAt) > new Date() && effective(r) === null);
            const last = rounds.filter(r => effective(r) === true).slice(-1)[0];
            let text = 'Nominated. Waiting for cMPLiBe to schedule your interview.';
            if (next) text = `Next: round ${next.number}${next.label ? ' (' + next.label + ')' : ''} on ${when(next.scheduledAt)}.`;
            else if (last) text = `Round ${last.number} attended${last.outcome === 'shortlisted' ? ' and shortlisted. Waiting for the next step.' : '. Waiting for the result.'}`;
            return `<div class="p-3 rounded-xl border border-amber-500/30 bg-amber-950/10 text-xs"><strong class="text-white">${esc((n.opportunity || {}).title)}</strong> <span class="text-slate-400">at ${esc((n.opportunity || {}).company)}</span><div class="text-amber-200 mt-0.5">${esc(text)}</div></div>`;
        }).join('');
    }

    function upcomingHtml(nominations) {
        const list = [];
        nominations.forEach(n => (n.rounds || []).forEach(r => {
            if (!CLOSED_STATUSES.includes(n.status) && effective(r) === null && new Date(r.scheduledAt) > new Date()) list.push({ n, r });
        }));
        return list.sort((a, b) => new Date(a.r.scheduledAt) - new Date(b.r.scheduledAt)).map(({ n, r }) => `
            <div class="p-3 rounded-xl border border-cyan-500/40 bg-cyan-950/20 text-xs text-cyan-100"><i class="fas fa-calendar-check mr-1.5"></i>
                Upcoming interview: <strong>${esc((n.opportunity || {}).company)}</strong> &bull; ${esc((n.opportunity || {}).title)} &bull; Round ${esc(r.number)}${r.label ? ' (' + esc(r.label) + ')' : ''} &bull; <strong>${esc(when(r.scheduledAt))}</strong>${r.note ? ' &bull; ' + esc(r.note) : ''}</div>`).join('');
    }

    window.setOpportunitiesTab = function (tab) {
        window._oppTab = tab;
        renderOpportunitiesTab();
    };
    window.openOpportunitiesMine = function () {
        window._oppTab = 'mine';
        if (typeof switchTab === 'function') switchTab('opportunitiesTab');
    };

    async function renderOpportunitiesTab() {
        const host = document.getElementById('opportunitiesTabContent');
        if (!host) return;
        host.innerHTML = '<div class="text-xs text-slate-500 p-6">Loading...</div>';
        try {
            const zone = myLqZone();
            const [mine, opps] = await Promise.all([api('/api/nominations/mine'), api('/api/opportunities' + (zone ? `?lqZone=${encodeURIComponent(zone)}` : ''))]);
            window._oppList = opps.opportunities;
            window._myNominations = mine.nominations;
            window._oppZone = zone;
            updateBadge(mine.pendingCheckIns.length + (mine.upcoming || []).length);
            const byType = t => opps.opportunities.filter(o => o.type === t);
            const tab = window._oppTab || 'rapid_xp';
            let body;
            if (tab === 'mine') {
                body = `
                    ${summaryHtml(mine.summary)}
                    <h4 class="text-[11px] font-black text-amber-300 uppercase tracking-widest mt-5 mb-2">Ongoing process (${mine.summary.active})</h4>
                    <div class="space-y-2">${ongoingHtml(mine.nominations)}</div>
                    <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-5 mb-2">All nominations, interviews and results</h4>
                    <div class="space-y-3">${timelineHtml(mine.nominations, false)}</div>`;
            } else {
                const list = byType(tab);
                const group = (title, items, color) => items.length ? `<h4 class="text-[11px] font-black ${color} uppercase tracking-widest mt-4 mb-2">${title} (${items.length})</h4><div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${items.map(opportunityCard).join('')}</div>` : '';
                body = `<div class="text-xs text-slate-400 mb-1">${esc(STAGE_HELP[tab])} Openings you have not unlocked yet show what you still need. Closed openings stay here so you can see what was presented to you.</div>` +
                    (list.length
                        ? group('Open now - nominate before the timer ends', list.filter(o => o.state === 'open'), 'text-emerald-300') +
                          group('You nominated', list.filter(o => o.state === 'nominated'), 'text-cyan-300') +
                          group('Closed - not nominated', list.filter(o => o.state === 'closed'), 'text-slate-400')
                        : `<div class="text-xs text-slate-500 p-6 border border-dashed border-slate-800 rounded-2xl text-center">No ${esc(TYPES[tab])} opening has been presented to you yet. New openings will appear here as soon as cMPLiBe publishes them.</div>`);
            }
            host.innerHTML = `
                <div class="space-y-4">
                    <div><h2 class="text-2xl font-extrabold text-white font-heading">Opportunities</h2>
                        <p class="text-xs text-slate-400 mt-1">Rapid XP internships, the 3-month Corporate Residency and final placements. Complete the requirements to unlock each step.</p></div>
                    ${mine.blockedUntil ? `<div class="p-3 rounded-xl border border-rose-500/40 bg-rose-950/20 text-xs text-rose-200"><i class="fas fa-pause-circle mr-1"></i> New nominations are paused for you until <strong>${esc(day(mine.blockedUntil))}</strong> because an interview was missed or a nomination was withdrawn early.</div>` : ''}
                    ${mine.pendingCheckIns.map(p => checkInHtml(p, mine.nominations)).join('')}
                    ${upcomingHtml(mine.nominations)}
                    ${statsStripHtml(mine.opportunityStats)}
                    <div class="flex flex-wrap gap-2">
                        ${['rapid_xp', 'residency', 'placement'].map(t => stageTabHtml(t, byType(t), tab === t)).join('')}
                        <button onclick="setOpportunitiesTab('mine')" class="text-left p-3 rounded-2xl border transition-all ${tab === 'mine' ? 'border-amber-500 bg-amber-950/30' : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'}" style="min-width:150px;flex:1;">
                            <div class="text-xs font-extrabold text-white">My nominations</div>
                            <div class="text-[10px] text-slate-400 mt-0.5">Interviews, results and what is ongoing.</div>
                            <div class="text-[11px] mt-1 text-amber-200">${mine.summary.nominations} nominated &bull; ${mine.summary.active} ongoing &bull; ${mine.summary.interviewsAttended} interviews</div>
                        </button>
                    </div>
                    ${body}
                </div>`;
        } catch (err) {
            host.innerHTML = `<div class="text-xs text-rose-400 p-6">${esc(err.message)}</div>`;
        }
    }

    // Small summary on the student's Home dashboard; opens the "My nominations" view.
    async function renderDashboardNominationsCard() {
        const host = document.getElementById('dashboardNominationsCard');
        if (!host) return;
        try {
            const mine = await api('/api/nominations/mine');
            const s = mine.summary;
            const cell = (v, t, c) => `<div class="text-center"><div class="text-lg font-extrabold ${c} font-mono">${v}</div><div class="text-[10px] text-slate-400">${t}</div></div>`;
            host.innerHTML = `
                <div class="glass-card p-4 sm:p-5 border-amber-500/30 cursor-pointer hover:border-amber-400/60 transition-colors" onclick="openOpportunitiesMine()">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <div class="text-sm font-extrabold text-white"><i class="fas fa-briefcase text-amber-400 mr-2"></i>My nominations and interviews
                            ${s.pendingCheckIns ? `<span class="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-rose-500/30 text-rose-200 border border-rose-500/40">${s.pendingCheckIns} interview${s.pendingCheckIns === 1 ? '' : 's'} to confirm</span>` : ''}</div>
                        <span class="text-[11px] text-cyan-300">Open &rarr;</span>
                    </div>
                    ${mine.opportunityStats ? `<div class="text-[11px] text-slate-400 mt-1">${mine.opportunityStats.presented} opportunities presented to you &bull; ${mine.opportunityStats.nominated} nominated &bull; ${mine.opportunityStats.open} open now &bull; ${mine.opportunityStats.missed} missed</div>` : ''}
                    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                        ${cell(s.nominations, 'Nominated', 'text-white')}${cell(s.active, 'Ongoing', 'text-amber-300')}${cell(s.interviewsAttended, 'Interviews attended', 'text-cyan-300')}
                        ${cell(s.shortlisted, 'Shortlisted', 'text-emerald-300')}${cell(s.rejected, 'Not selected', 'text-slate-300')}${cell(s.selected, 'Selected', 'text-emerald-300')}
                    </div>
                </div>`;
        } catch (err) {
            host.innerHTML = '';
        }
    }
    window.renderDashboardNominationsCard = renderDashboardNominationsCard;

    // An interview that never appeared on the platform: the student reports it with the questions asked.
    function openReportInterview(nominationId) {
        const n = (window._myNominations || []).find(x => x.id === nominationId) || {};
        const modal = document.createElement('div');
        modal.id = 'reportInterviewModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.9);overflow:auto;padding:16px;';
        modal.innerHTML = `
            <div style="max-width:520px;margin:6vh auto 0;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;color:#e2e8f0;font-family:sans-serif;">
                <div style="font:700 15px sans-serif;">Report an interview${n.opportunity ? ' - ' + esc(n.opportunity.company) : ''}</div>
                <label style="${label}margin-top:10px;">When was it?</label><input id="riWhen" type="datetime-local" style="${field}">
                <label style="${label}margin-top:8px;">Round (optional)</label><input id="riLabel" maxlength="60" style="${field}" placeholder="e.g. HR round">
                <label style="${label}margin-top:8px;">Questions you were asked (one per line)</label>
                <textarea id="riQ" rows="6" style="${field}" placeholder="Tell me about yourself&#10;Why do you want this role?"></textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="document.getElementById('reportInterviewModal').remove()">Cancel</button>
                    <button id="riGo" style="padding:8px 16px;border-radius:10px;border:0;background:#059669;color:#fff;font-weight:700;cursor:pointer;" onclick="submitReportInterview('${esc(nominationId)}')">Submit</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    async function submitReportInterview(nominationId) {
        const whenVal = document.getElementById('riWhen').value;
        if (!whenVal) { alert('Please choose when the interview took place.'); return; }
        const btn = document.getElementById('riGo');
        btn.disabled = true;
        try {
            await api(`/api/nominations/${encodeURIComponent(nominationId)}/interviews`, 'POST', {
                scheduledAt: new Date(whenVal).toISOString(), label: document.getElementById('riLabel').value,
                questions: document.getElementById('riQ').value.split('\n').map(x => x.trim()).filter(Boolean)
            });
            document.getElementById('reportInterviewModal').remove();
            alert('Thank you. Your interview details are saved.');
            renderOpportunitiesTab();
        } catch (err) { alert(err.message); btn.disabled = false; }
    }
    window.openReportInterview = openReportInterview;
    window.submitReportInterview = submitReportInterview;

    function updateBadge(count) {
        const b = document.getElementById('opportunitiesBadge');
        if (!b) return;
        b.textContent = count;
        b.classList.toggle('hidden', !count);
    }

    async function refreshBadge() {
        try {
            if (!window.currentUser || window.currentUser.role === 'creator' || window.currentUser.role === 'recruiter') return;
            const mine = await api('/api/nominations/mine');
            updateBadge(mine.pendingCheckIns.length + (mine.upcoming || []).length);
        } catch (e) { /* not signed in as a student */ }
    }

    function openNominateDialog(id) {
        const o = (window._oppList || []).find(x => x.id === id);
        if (!o) return;
        const modal = document.createElement('div');
        modal.id = 'nominateModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.9);overflow:auto;padding:16px;';
        modal.innerHTML = `
            <div style="max-width:480px;margin:10vh auto 0;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;color:#e2e8f0;font-family:sans-serif;">
                <div style="font:700 15px sans-serif;">Nominate for ${esc(o.title)}</div>
                <div style="color:#67e8f9;font-size:12px;margin:2px 0 10px;">${esc(o.company)} &bull; ${esc(o.typeLabel)}</div>
                <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.4;">
                    <input type="checkbox" id="nomConsent" style="margin-top:3px;"> I agree that my name, campus, cMPLiBe CV and learning proof can be shared with ${esc(o.company)} for this opportunity.</label>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="document.getElementById('nominateModal').remove()">Cancel</button>
                    <button id="nomGo" style="padding:8px 16px;border-radius:10px;border:0;background:#059669;color:#fff;font-weight:700;cursor:pointer;" onclick="confirmNomination('${esc(o.id)}')">Confirm nomination</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    async function confirmNomination(id) {
        const consent = document.getElementById('nomConsent').checked;
        if (!consent) { alert('Please tick the consent box to nominate.'); return; }
        const btn = document.getElementById('nomGo');
        btn.disabled = true;
        try {
            await api('/api/nominations', 'POST', { opportunityId: id, consent: true, lqZone: window._oppZone || myLqZone() });
            document.getElementById('nominateModal').remove();
            alert('You are nominated. cMPLiBe will update you here when an interview is scheduled.');
            renderOpportunitiesTab();
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
        }
    }

    async function submitCheckIn(nominationId, roundId, attended) {
        const k = `${nominationId}_${roundId}`;
        const body = { attended };
        if (attended) body.questions = document.getElementById(`ciQ_${k}`).value.split('\n').map(s => s.trim()).filter(Boolean);
        else { body.reasonCode = document.getElementById(`ciR_${k}`).value; body.note = document.getElementById(`ciN_${k}`).value; }
        try {
            await api(`/api/nominations/${encodeURIComponent(nominationId)}/rounds/${encodeURIComponent(roundId)}/check-in`, 'POST', body);
            alert(attended ? 'Thank you. Your interview details are received. Your result will show here soon.' : 'Noted. Your response has been recorded.');
            renderOpportunitiesTab();
        } catch (err) {
            alert(err.message);
        }
    }

    async function withdrawNomination(id) {
        const reason = prompt('Why are you withdrawing? (Withdrawing before your second interview round pauses new nominations for a few days.)', '');
        if (reason === null) return;
        try {
            await api(`/api/nominations/${encodeURIComponent(id)}/withdraw`, 'POST', { reason });
            renderOpportunitiesTab();
        } catch (err) { alert(err.message); }
    }

    // ---------------------------------------------------------------
    // CREATOR: Opportunities tab (openings, nominations table, round board)
    // Every opening has interview rounds (for example Screening, Technical, HR). The board shows, per
    // round, who was scheduled, who attended, the questions they reported, and lets the Creator clear
    // students for the next round, schedule that round for them, and finally decide (offer letter, on hold...).
    // ---------------------------------------------------------------
    let creatorCampuses = [];
    let creatorOpps = [];
    let creatorNoms = [];
    let boardState = { oppId: null, tab: 'nominated' };
    const DEFAULT_ROUNDS = ['Screening round', 'Technical round', 'HR round'];
    const OUT_STATUSES = ['rejected', 'no_show', 'withdrawn'];
    const FINAL_DECISION_STATUSES = ['offer_letter', 'selected', 'completed', 'on_hold', 'final_shortlist'];

    function toLocalInput(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function roundsOf(opp) {
        return opp && opp.rounds && opp.rounds.length ? opp.rounds : DEFAULT_ROUNDS;
    }

    // Where a nomination sits on the board: nominated | r1 | r2 ... | final | out
    function boardStage(n, roundCount) {
        if (OUT_STATUSES.includes(n.status)) return 'out';
        if (FINAL_DECISION_STATUSES.includes(n.status)) return 'final';
        const rounds = n.rounds || [];
        if (!rounds.length) return 'nominated';
        const last = rounds.reduce((m, r) => Math.max(m, r.number), 0);
        const lr = rounds.find(r => r.number === last);
        if (last >= roundCount && lr.outcome === 'shortlisted') return 'final';
        return 'r' + last;
    }

    function stageCounts(oppId) {
        const opp = creatorOpps.find(o => o.id === oppId) || {};
        const R = roundsOf(opp).length;
        const c = { total: 0, nominated: 0, final: 0, out: 0, offer: 0, hold: 0, rejected: 0, missed: 0, rounds: {} };
        creatorNoms.filter(n => n.opportunityId === oppId).forEach(n => {
            c.total += 1;
            const st = boardStage(n, R);
            if (st === 'nominated') c.nominated += 1;
            else if (st === 'final') {
                c.final += 1;
                if (n.status === 'offer_letter' || n.status === 'selected' || n.status === 'completed') c.offer += 1;
                if (n.status === 'on_hold') c.hold += 1;
            } else if (st === 'out') {
                c.out += 1;
                if (n.status === 'rejected') c.rejected += 1; else c.missed += 1;
            } else c.rounds[st] = (c.rounds[st] || 0) + 1;
        });
        return c;
    }

    window.switchCreatorOppSubTab = function (sub) {
        window._creatorOppSub = sub;
        ['requests', 'openings', 'nominations'].forEach(t => {
            const pane = document.getElementById(`creatorOppSub-${t}`);
            const btn = document.getElementById(`creatorOppSubBtn-${t}`);
            if (pane) pane.classList.toggle('hidden', t !== sub);
            if (btn) btn.className = t === sub
                ? 'px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/60';
        });
        if (sub === 'requests' && typeof renderCreatorRequirements === 'function') renderCreatorRequirements();
        if (sub === 'openings') renderCreatorOpportunities();
        if (sub === 'nominations') renderCreatorNominationsTable();
    };

    async function loadCreatorData() {
        const [opps, noms, camps] = await Promise.all([api('/api/creator/opportunities'), api('/api/creator/nominations'), api('/api/management/campuses')]);
        creatorOpps = opps.opportunities;
        creatorNoms = noms.nominations;
        creatorCampuses = camps.campuses || [];
        return opps;
    }

    // ---- Openings (create / edit / open / close) ----
    async function renderCreatorOpportunities() {
        const host = document.getElementById('creatorOpportunitiesHost');
        if (!host) return;
        host.innerHTML = '<div class="text-xs text-slate-500 p-3">Loading...</div>';
        try {
            const opps = await loadCreatorData();
            const campusName = id => (creatorCampuses.find(c => c.id === id) || {}).name || id;
            host.innerHTML = `
                <div class="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
                    <div><label style="${label}">Pause on missed interview (days)</label><input id="cooldownDays" type="number" min="1" max="90" value="${esc(opps.settings.cooldownDays)}" style="${field}width:120px;"></div>
                    <button class="btn-secondary py-2 px-4 text-xs" onclick="saveCooldownDays()">Save</button>
                    <div class="text-[11px] text-slate-400 flex-1 min-w-[200px]">A student who does not attend an interview, or withdraws before the second round, cannot nominate for this many days. You can clear it for a student at any time.</div>
                    <button class="btn-primary py-2 px-4 text-xs" onclick="openOpportunityForm()">+ New opening</button>
                </div>
                <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-5 mb-2">Openings (${creatorOpps.length})</h4>
                <div class="space-y-3">${creatorOpps.map(o => {
                    const c = stageCounts(o.id);
                    return `
                    <div class="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-white">${esc(o.title)}</div>
                                <div class="text-[11px] text-slate-400"><span class="px-1.5 py-0.5 rounded border ${TYPE_COLORS[o.type] || ''}">${esc(TYPES[o.type])}</span> ${esc(o.company)} &bull; ${o.targetAllCampuses ? 'All campuses' : (o.targetCampusIds || []).map(campusName).map(esc).join(', ')} &bull; <span class="${o.audience ? 'text-cyan-300' : 'text-rose-300 font-bold'}">reaches ${esc(o.audience)} student${o.audience === 1 ? '' : 's'}</span>${o.nominationDeadline ? ` &bull; closes ${esc(when(o.nominationDeadline))}` : ''}</div>
                                <div class="text-[11px] text-slate-500 mt-0.5">Interview rounds: ${roundsOf(o).map(esc).join(' &rarr; ')}</div>
                            </div>
                            <span class="badge-pill ${o.status === 'open' ? 'badge-emerald' : 'badge-slate'} text-[9px]">${o.status === 'open' ? 'Open' : (o.status === 'draft' ? 'Draft' : 'Closed')}</span>
                        </div>
                        <div class="text-[11px] text-cyan-300">${c.total} nominated${c.nominated ? ` &bull; ${c.nominated} waiting for the first interview` : ''}</div>
                        <div class="flex flex-wrap gap-2">
                            <button class="btn-primary py-1.5 px-3 text-[11px]" onclick="openBoard('${esc(o.id)}')">Open round board</button>
                            <button class="btn-secondary py-1.5 px-3 text-[11px]" onclick="openOpportunityForm('${esc(o.id)}')">Edit</button>
                            <button class="btn-secondary py-1.5 px-3 text-[11px]" onclick="setOpportunityStatus('${esc(o.id)}','${o.status === 'open' ? 'closed' : 'open'}')">${o.status === 'open' ? 'Close nominations' : 'Open nominations'}</button>
                        </div>
                    </div>`;
                }).join('') || '<div class="text-xs text-slate-500 p-3">No openings yet. Create the first Rapid XP, Residency or Placement opening.</div>'}</div>`;
        } catch (err) {
            host.innerHTML = `<div class="text-xs text-rose-400 p-3">${esc(err.message)}</div>`;
        }
    }

    // ---- Nominations table: company, role, how many nominated, and where each one stands ----
    async function renderCreatorNominationsTable() {
        const host = document.getElementById('creatorNominationsHost');
        if (!host) return;
        host.innerHTML = '<div class="text-xs text-slate-500 p-3">Loading...</div>';
        try {
            await loadCreatorData();
            const th = 'padding:9px 10px;text-align:left;white-space:nowrap;';
            const td = 'padding:9px 10px;vertical-align:top;';
            const num = (n, cls) => n ? `<span class="${cls || 'text-white'} font-bold">${n}</span>` : '<span class="text-slate-600">0</span>';
            const rows = creatorOpps.slice().sort((a, b) => stageCounts(b.id).total - stageCounts(a.id).total).map(o => {
                const c = stageCounts(o.id);
                const names = roundsOf(o);
                const rounds = names.map((nm, i) => c.rounds['r' + (i + 1)] ? `<div class="whitespace-nowrap"><span class="text-slate-400">${esc(nm)}:</span> <strong class="text-cyan-300">${c.rounds['r' + (i + 1)]}</strong></div>` : '').join('') || '<span class="text-slate-600">-</span>';
                return `<tr style="border-top:1px solid #1e293b;">
                    <td style="${td}"><div class="font-bold text-white">${esc(o.company)}</div></td>
                    <td style="${td}"><div class="text-white">${esc(o.title)}</div><div class="text-[10px] text-slate-500">${esc(TYPES[o.type])} &bull; ${o.status === 'open' ? 'open' : o.status}</div></td>
                    <td style="${td}text-align:center;">${num(c.total, 'text-white')}</td>
                    <td style="${td}text-align:center;">${num(c.nominated, 'text-amber-300')}</td>
                    <td style="${td}">${rounds}</td>
                    <td style="${td}text-align:center;">${num(c.final - c.offer - c.hold, 'text-emerald-300')}</td>
                    <td style="${td}text-align:center;">${num(c.offer, 'text-emerald-300')}</td>
                    <td style="${td}text-align:center;">${num(c.hold, 'text-amber-300')}</td>
                    <td style="${td}text-align:center;">${num(c.rejected, 'text-slate-300')}</td>
                    <td style="${td}text-align:center;">${num(c.missed, 'text-rose-300')}</td>
                    <td style="${td}white-space:nowrap;"><button class="btn-primary py-1 px-3 text-[11px]" onclick="openBoard('${esc(o.id)}')">Open board</button></td>
                </tr>`;
            }).join('');
            host.innerHTML = `
                <div style="overflow-x:auto;border:1px solid #334155;border-radius:14px;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead><tr style="background:#111c33;color:#94a3b8;font-size:11px;">
                            <th style="${th}">Company</th><th style="${th}">Role</th><th style="${th}text-align:center;">Nominated</th><th style="${th}text-align:center;">Waiting for 1st interview</th>
                            <th style="${th}">Currently in round</th><th style="${th}text-align:center;">Final decision pending</th><th style="${th}text-align:center;">Offer letter / selected</th>
                            <th style="${th}text-align:center;">On hold</th><th style="${th}text-align:center;">Not selected</th><th style="${th}text-align:center;">Missed / withdrawn</th><th style="${th}"></th>
                        </tr></thead>
                        <tbody>${rows || '<tr><td colspan="11" style="padding:16px;text-align:center;color:#64748b;">No openings yet.</td></tr>'}</tbody>
                    </table>
                </div>`;
        } catch (err) {
            host.innerHTML = `<div class="text-xs text-rose-400 p-3">${esc(err.message)}</div>`;
        }
    }

    async function saveCooldownDays() {
        try { await api('/api/creator/nomination-settings', 'POST', { cooldownDays: parseInt(document.getElementById('cooldownDays').value, 10) }); alert('Saved.'); }
        catch (err) { alert(err.message); }
    }

    async function setOpportunityStatus(id, status) {
        try { await api(`/api/creator/opportunities/${encodeURIComponent(id)}/status`, 'POST', { status }); renderCreatorOpportunities(); }
        catch (err) { alert(err.message); }
    }

    function openOpportunityForm(id) {
        const o = creatorOpps.find(x => x.id === id) || { type: 'rapid_xp', status: 'open', prerequisites: {}, targetCampusIds: [] };
        const p = o.prerequisites || {};
        const selected = new Set(o.targetCampusIds || []);
        const num = (elId, text, value) => `<div><label style="${label}">${text}</label><input id="${elId}" type="number" min="0" style="${field}" value="${esc(value || 0)}"></div>`;
        const modal = document.createElement('div');
        modal.id = 'opportunityFormModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.9);overflow:auto;padding:16px;';
        modal.innerHTML = `
            <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;color:#e2e8f0;font-family:sans-serif;">
                <div style="font:700 15px sans-serif;margin-bottom:10px;">${o.id ? 'Edit opening' : 'New opening'}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
                    <div><label style="${label}">Type</label><select id="opType" style="${field}">${Object.keys(TYPES).map(t => `<option value="${t}" ${t === o.type ? 'selected' : ''}>${TYPES[t]}</option>`).join('')}</select></div>
                    <div><label style="${label}">Company</label><input id="opCompany" maxlength="80" style="${field}" value="${esc(o.company || '')}"></div>
                    <div style="grid-column:1/-1;"><label style="${label}">Role / title</label><input id="opTitle" maxlength="120" style="${field}" value="${esc(o.title || '')}" placeholder="e.g. Key Accounts Manager"></div>
                    <div style="grid-column:1/-1;"><label style="${label}">Description</label><textarea id="opDesc" rows="4" maxlength="3000" style="${field}">${esc(o.description || '')}</textarea></div>
                    <div><label style="${label}">Location</label><input id="opLocation" maxlength="80" style="${field}" value="${esc(o.location || '')}"></div>
                    <div><label style="${label}">Pay / compensation</label><input id="opComp" maxlength="80" style="${field}" value="${esc(o.compensation || '')}" placeholder="e.g. Rs 15,000 per month"></div>
                    <div><label style="${label}">Duration</label><input id="opDuration" maxlength="60" style="${field}" value="${esc(o.duration || '')}" placeholder="e.g. 1 month"></div>
                    <div><label style="${label}">Nominations close on (date and time)</label><input id="opDeadline" type="datetime-local" style="${field}" value="${esc(toLocalInput(o.nominationDeadline))}"></div>
                    <div><label style="${label}">Status</label><select id="opStatus" style="${field}">${['open', 'draft', 'closed'].map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                    <div style="grid-column:1/-1;"><label style="${label}">Interview rounds for this role (one per line, in order)</label>
                        <textarea id="opRounds" rows="4" maxlength="500" style="${field}" placeholder="Screening round&#10;Technical round&#10;HR round">${esc(roundsOf(o).join('\n'))}</textarea>
                        <div style="font-size:10px;color:#64748b;margin-top:2px;">Students clear one round at a time. After the last round you give the final decision (offer letter, on hold...).</div></div>
                </div>
                <div style="${label}margin-top:14px;font-size:12px;color:#67e8f9;">Who can nominate (all must be true)</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
                    ${num('opMs', 'Reached milestone (0 = any)', p.milestoneId)}${num('opAi', 'cMPLi-ai projects done', p.minProjectsAi)}${num('opIns', 'Insight Engine projects done', p.minProjectsInsight)}
                    ${num('opRx', 'Rapid XP completed', p.minRapidXp)}${num('opRes', 'Residency completed', p.minResidency)}
                    <div><label style="${label}">Learn Agility level</label><select id="opLq" style="${field}">
                        <option value="any" ${p.minLqZone !== 'average' && p.minLqZone !== 'strong' ? 'selected' : ''}>Any</option>
                        <option value="average" ${p.minLqZone === 'average' ? 'selected' : ''}>Average (yellow) or better</option>
                        <option value="strong" ${p.minLqZone === 'strong' ? 'selected' : ''}>High (green)</option></select></div>
                </div>
                <div style="${label}margin-top:14px;font-size:12px;color:#67e8f9;">Which campuses</div>
                <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:6px;"><input type="checkbox" id="opAll" ${o.targetAllCampuses ? 'checked' : ''}> All campuses</label>
                <div style="max-height:170px;overflow:auto;border:1px solid #334155;border-radius:12px;padding:8px;">
                    ${creatorCampuses.map(c => `<label style="display:flex;gap:8px;align-items:center;font-size:12px;padding:2px 0;"><input type="checkbox" class="opCampus" value="${esc(c.id)}" ${selected.has(c.id) ? 'checked' : ''}> ${esc(c.name)} <span style="color:#64748b;">${esc(c.district || '')}</span></label>`).join('') || '<div style="font-size:12px;color:#94a3b8;">No campuses registered yet.</div>'}
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="document.getElementById('opportunityFormModal').remove()">Cancel</button>
                    <button id="opSave" style="padding:8px 16px;border-radius:10px;border:0;background:#059669;color:#fff;font-weight:700;cursor:pointer;" onclick="saveOpportunity('${esc(o.id || '')}')">Save</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    async function saveOpportunity(id) {
        const v = i => document.getElementById(i).value;
        const btn = document.getElementById('opSave');
        btn.disabled = true;
        try {
            const deadline = v('opDeadline');
            await api('/api/creator/opportunities', 'POST', {
                id: id || undefined, type: v('opType'), company: v('opCompany'), title: v('opTitle'), description: v('opDesc'), location: v('opLocation'),
                compensation: v('opComp'), duration: v('opDuration'), nominationDeadline: deadline ? new Date(deadline).toISOString() : null, status: v('opStatus'),
                rounds: v('opRounds').split('\n').map(r => r.trim()).filter(Boolean),
                targetAllCampuses: document.getElementById('opAll').checked,
                targetCampusIds: [...document.querySelectorAll('.opCampus:checked')].map(c => c.value),
                prerequisites: { milestoneId: v('opMs'), minProjectsAi: v('opAi'), minProjectsInsight: v('opIns'), minRapidXp: v('opRx'), minResidency: v('opRes'), minLqZone: v('opLq') }
            });
            document.getElementById('opportunityFormModal').remove();
            afterCreatorChange();
        } catch (err) { alert(err.message); btn.disabled = false; }
    }

    // ---- Round board of one opening ----
    async function openBoard(oppId, tab) {
        boardState.oppId = oppId;
        if (tab) boardState.tab = tab;
        const old = document.getElementById('boardModal');
        const scrollTop = old ? old.scrollTop : 0;
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'boardModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9997;background:rgba(2,6,23,.95);overflow:auto;padding:16px;';
        modal.innerHTML = '<div style="color:#e2e8f0;text-align:center;margin-top:20vh;">Loading...</div>';
        document.body.appendChild(modal);
        try {
            if (!creatorOpps.length) await loadCreatorData();
            const d = await api(`/api/creator/nominations?opportunityId=${encodeURIComponent(oppId)}`);
            creatorNoms = creatorNoms.filter(n => n.opportunityId !== oppId).concat(d.nominations);
            const opp = creatorOpps.find(o => o.id === oppId) || {};
            const names = roundsOf(opp);
            const R = names.length;
            const all = d.nominations;
            const stageOf = n => boardStage(n, R);
            const tabs = [{ key: 'nominated', title: 'Nominated' }]
                .concat(names.map((nm, i) => ({ key: 'r' + (i + 1), title: `${i + 1}. ${nm}` })))
                .concat([{ key: 'final', title: 'Final decision' }, { key: 'out', title: 'Not continuing' }]);
            // opening a different opening starts on the first stage that has students in it
            if (boardState.lastOpp !== oppId) {
                const firstBusy = tabs.find(t => all.some(n => stageOf(n) === t.key));
                boardState.tab = firstBusy ? firstBusy.key : 'nominated';
                boardState.lastOpp = oppId;
            }
            if (!tabs.some(t => t.key === boardState.tab)) boardState.tab = 'nominated';
            const tab = boardState.tab;
            const list = all.filter(n => stageOf(n) === tab);
            const btn = 'padding:7px 12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font:600 12px sans-serif;cursor:pointer;';
            const act = (text, fn, color) => `<button style="${btn}${color ? 'color:' + color + ';' : ''}" onclick="${fn}">${text}</button>`;
            const k = tab.startsWith('r') && /^r\d+$/.test(tab) ? parseInt(tab.slice(1), 10) : 0;
            let toolbar = '';
            if (tab === 'nominated') {
                toolbar = act(`Schedule "${esc(names[0])}" for selected`, `boardSchedule('${esc(oppId)}',1)`, '#67e8f9');
            } else if (k) {
                toolbar = act('Mark attended', `boardAttendance('${esc(oppId)}',${k},true)`, '#6ee7b7') + act('Mark not attended', `boardAttendance('${esc(oppId)}',${k},false)`, '#fda4af') +
                    act('Cleared - move to next round', `boardResult('${esc(oppId)}',${k},'shortlisted')`, '#6ee7b7') + act('Not selected', `boardResult('${esc(oppId)}',${k},'rejected')`, '#cbd5e1') +
                    act('On hold', `boardResult('${esc(oppId)}',${k},'on_hold')`, '#fcd34d') +
                    (k < R ? act(`Schedule "${esc(names[k])}" for cleared`, `boardSchedule('${esc(oppId)}',${k + 1})`, '#67e8f9') : '') +
                    act('Reschedule this round for selected', `boardSchedule('${esc(oppId)}',${k})`, '#fcd34d');
            } else if (tab === 'final') {
                toolbar = act('Offer letter issued', `boardResult('${esc(oppId)}',0,'offer')`, '#6ee7b7') + act('Shortlisted', `boardResult('${esc(oppId)}',0,'final_shortlist')`, '#67e8f9') +
                    act('On hold', `boardResult('${esc(oppId)}',0,'on_hold')`, '#fcd34d') + act('Not selected', `boardResult('${esc(oppId)}',0,'rejected')`, '#cbd5e1');
            }
            const cell = 'padding:8px;vertical-align:top;';
            const head = cols => `<thead><tr style="background:#111c33;color:#94a3b8;text-align:left;font-size:11px;"><th style="padding:8px;width:28px;"></th>${cols.map(c => `<th style="padding:8px;">${c}</th>`).join('')}</tr></thead>`;
            const chk = n => `<td style="${cell}"><input type="checkbox" class="boardCheck" value="${esc(n.id)}" onchange="updateBoardCount()" ${tab === 'out' ? 'disabled' : ''}></td>`;
            const studentCell = n => `<td style="${cell}"><a href="javascript:void(0)" style="color:#67e8f9;text-decoration:underline;" onclick="openStudentPipeline('${esc(n.studentId)}')">${esc(n.studentName)}</a><div style="font-size:10px;color:#64748b;">${esc(n.lqZone || '')}</div></td>`;
            let table;
            if (tab === 'nominated') {
                table = `${head(['Student', 'Nominated on', 'Status'])}<tbody>${list.map(n => `<tr style="border-top:1px solid #1e293b;">${chk(n)}${studentCell(n)}<td style="${cell}white-space:nowrap;">${esc(day(n.nominatedAt))}</td><td style="${cell}"><span class="text-amber-300">Waiting for the first interview</span></td></tr>`).join('')}</tbody>`;
            } else if (k) {
                table = `${head(['Student', 'Interview', 'Attendance', 'Questions the student reported', 'Result and feedback'])}<tbody>${list.map(n => {
                    const r = (n.rounds || []).find(x => x.number === k) || {};
                    const cleared = r.outcome === 'shortlisted';
                    const qs = r.questions && r.questions.length ? `<details><summary style="cursor:pointer;color:#67e8f9;">${r.questions.length} question${r.questions.length === 1 ? '' : 's'}</summary><ol style="margin:4px 0 0 18px;color:#cbd5e1;">${r.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol></details>`
                        : (effective(r) === true ? '<span style="color:#fcd34d;">Attended - waiting for the student to write the questions</span>' : '<span style="color:#64748b;">-</span>');
                    const nextTag = cleared && k < R && !(n.rounds || []).some(x => x.number === k + 1) ? `<div style="color:#6ee7b7;font-weight:700;">Cleared - schedule "${esc(names[k])}"</div>` : '';
                    return `<tr style="border-top:1px solid #1e293b;">${chk(n)}${studentCell(n)}
                        <td style="${cell}">${r.scheduledAt ? `${esc(when(r.scheduledAt))}${r.venue ? `<div style="font-size:10px;color:#94a3b8;">${esc(r.venue)}</div>` : ''}` : '-'}</td>
                        <td style="${cell}">${attendanceText(r)}</td><td style="${cell}">${qs}</td>
                        <td style="${cell}">${esc(OUTCOME[r.outcome] || r.outcome || '')}${r.outcomeReason ? `<div style="font-size:11px;color:#cbd5e1;">${esc(r.outcomeReason)}</div>` : ''}${nextTag}</td></tr>`;
                }).join('')}</tbody>`;
            } else if (tab === 'final') {
                table = `${head(['Student', 'Rounds', 'Decision'])}<tbody>${list.map(n => `<tr style="border-top:1px solid #1e293b;">${chk(n)}${studentCell(n)}
                    <td style="${cell}">${(n.rounds || []).map(r => `<div style="font-size:11px;">${esc(r.label || 'Round ' + r.number)}: ${esc(OUTCOME[r.outcome] || r.outcome)}</div>`).join('')}</td>
                    <td style="${cell}">${statusBadge(n.status)}${n.statusReason ? `<div style="font-size:11px;color:#cbd5e1;">${esc(n.statusReason)}</div>` : ''}${FINAL_DECISION_STATUSES.includes(n.status) ? '' : '<div style="color:#fcd34d;font-weight:700;">Decision needed</div>'}</td></tr>`).join('')}</tbody>`;
            } else {
                table = `${head(['Student', 'Status', 'Reason'])}<tbody>${list.map(n => `<tr style="border-top:1px solid #1e293b;">${chk(n)}${studentCell(n)}<td style="${cell}">${statusBadge(n.status)}</td><td style="${cell}">${esc(n.statusReason || '')}</td></tr>`).join('')}</tbody>`;
            }
            modal.innerHTML = `
                <div style="max-width:1100px;margin:0 auto;color:#e2e8f0;font-family:sans-serif;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;">
                        <div><div style="font:700 16px sans-serif;">${esc(opp.title || 'Opening')} <span style="color:#67e8f9;font-weight:400;">at ${esc(opp.company || '')}</span></div>
                            <div style="color:#94a3b8;font-size:12px;">${all.length} nominated &bull; Rounds: ${names.map(esc).join(' &rarr; ')} &rarr; Final decision</div></div>
                        <button style="${btn}" onclick="document.getElementById('boardModal').remove()">Close</button>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                        ${tabs.map(t => `<button style="${btn}${t.key === tab ? 'background:#4f46e5;border-color:#4f46e5;' : ''}" onclick="boardTab('${t.key}')">${esc(t.title)} (${all.filter(n => stageOf(n) === t.key).length})</button>`).join('')}
                    </div>
                    ${tab !== 'out' ? `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px;border:1px solid #334155;border-radius:12px;margin-bottom:10px;background:#0f172a;">
                        <label style="font-size:12px;display:flex;gap:6px;align-items:center;"><input type="checkbox" onchange="toggleBoardAll(this.checked)"> Select all</label>
                        <span id="boardSelCount" style="font-size:12px;color:#94a3b8;">0 selected</span>
                        <span style="width:8px;"></span>${toolbar}
                    </div>` : ''}
                    <div style="overflow-x:auto;border:1px solid #334155;border-radius:12px;">
                        <table style="width:100%;border-collapse:collapse;font-size:12px;">${table}</table>
                        ${list.length ? '' : '<div style="padding:18px;text-align:center;color:#64748b;font-size:12px;">Nobody is at this stage.</div>'}
                    </div>
                </div>`;
            modal.scrollTop = scrollTop;
        } catch (err) {
            modal.innerHTML = `<div style="color:#fca5a5;text-align:center;margin-top:20vh;">${esc(err.message)}<br><br><button onclick="document.getElementById('boardModal').remove()">Close</button></div>`;
        }
    }

    function selectedBoardIds() {
        return [...document.querySelectorAll('.boardCheck:checked')].map(c => c.value);
    }
    window.updateBoardCount = function () {
        const el = document.getElementById('boardSelCount');
        if (el) el.textContent = `${selectedBoardIds().length} selected`;
    };
    window.toggleBoardAll = function (on) {
        document.querySelectorAll('.boardCheck:not(:disabled)').forEach(c => { c.checked = on; });
        window.updateBoardCount();
    };
    window.boardTab = function (tab) { boardState.tab = tab; openBoard(boardState.oppId); };

    function needSelection() {
        const ids = selectedBoardIds();
        if (!ids.length) alert('Tick the students first.');
        return ids;
    }

    window.boardSchedule = function (oppId, roundNumber) {
        const ids = needSelection();
        if (!ids.length) return;
        const opp = creatorOpps.find(o => o.id === oppId) || {};
        const names = roundsOf(opp);
        openScheduleDialog({ oppId, nominationIds: ids, roundNumber, label: names[roundNumber - 1] || `Round ${roundNumber}`, title: `${opp.title || ''} - ${opp.company || ''} - ${names[roundNumber - 1] || 'Round ' + roundNumber}` });
    };

    window.boardAttendance = async function (oppId, roundNumber, attended) {
        const ids = needSelection();
        if (!ids.length) return;
        if (!attended && !confirm('Marking students as not attended pauses their nominations for a few days. Continue?')) return;
        try {
            await api(`/api/creator/opportunities/${encodeURIComponent(oppId)}/attendance`, 'POST', { nominationIds: ids, roundNumber, attended });
            afterCreatorChange();
        } catch (err) { alert(err.message); }
    };

    const RESULT_TEXT = { shortlisted: 'Cleared this round', rejected: 'Not selected', on_hold: 'On hold', offer: 'Offer letter issued', final_shortlist: 'Shortlisted', selected: 'Selected' };
    window.boardResult = async function (oppId, roundNumber, outcome) {
        const ids = needSelection();
        if (!ids.length) return;
        const reason = prompt(`Feedback the student will see for "${RESULT_TEXT[outcome]}" (optional):`, '');
        if (reason === null) return;
        try {
            const res = await api(`/api/creator/opportunities/${encodeURIComponent(oppId)}/result`, 'POST', { nominationIds: ids, roundNumber, outcome, reason });
            if (res.withoutRound && res.withoutRound.length) alert(`${res.withoutRound.length} student(s) have no interview in this round and were skipped.`);
            afterCreatorChange();
        } catch (err) { alert(err.message); }
    };

    // One dialog for scheduling and rescheduling: exact date, time, length, place or link, and a note for the student.
    function openScheduleDialog(cfg) {
        const old = document.getElementById('scheduleDialog');
        if (old) old.remove();
        const bulk = cfg.nominationIds && cfg.nominationIds.length > 1;
        const startLocal = toLocalInput(cfg.scheduledAt || new Date(Date.now() + 86400000).toISOString());
        const modal = document.createElement('div');
        modal.id = 'scheduleDialog';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(2,6,23,.9);overflow:auto;padding:16px;';
        modal.innerHTML = `
            <div style="max-width:520px;margin:6vh auto 0;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;color:#e2e8f0;font-family:sans-serif;">
                <div style="font:700 15px sans-serif;">${cfg.reschedule ? 'Reschedule interview' : (bulk ? `Schedule interviews for ${cfg.nominationIds.length} students` : 'Schedule interview')}</div>
                <div style="color:#94a3b8;font-size:12px;margin:2px 0 10px;">${esc(cfg.title || '')}<br>The students are notified and see the exact date and time on their Opportunities tab.${cfg.roundNumber > 1 ? '<br>Only students who cleared the previous round are scheduled.' : ''}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div style="grid-column:1/-1;"><label style="${label}">${bulk ? 'First interview starts at (date and time)' : 'Date and time'}</label><input id="sdWhen" type="datetime-local" style="${field}" value="${esc(startLocal)}"></div>
                    ${bulk ? `<div><label style="${label}">Gap between students (minutes)</label><input id="sdSlot" type="number" min="0" max="240" value="15" style="${field}"><div style="font-size:10px;color:#64748b;margin-top:2px;">0 = same time for everyone</div></div>` : ''}
                    <div><label style="${label}">Interview length (minutes)</label><input id="sdDur" type="number" min="5" max="480" value="${esc(cfg.durationMinutes || 30)}" style="${field}"></div>
                    <div><label style="${label}">Round name</label><input id="sdLabel" maxlength="60" style="${field}" value="${esc(cfg.label || '')}" placeholder="e.g. HR round"></div>
                    <div><label style="${label}">Where (place or meeting link)</label><input id="sdVenue" maxlength="200" style="${field}" value="${esc(cfg.venue || '')}" placeholder="https://meet..."></div>
                    <div style="grid-column:1/-1;"><label style="${label}">Note for the students (optional)</label><input id="sdNote" maxlength="300" style="${field}" value="${esc(cfg.note || '')}" placeholder="Carry your CV, join 5 minutes early..."></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="document.getElementById('scheduleDialog').remove()">Cancel</button>
                    <button id="sdGo" style="padding:8px 16px;border-radius:10px;border:0;background:#0891b2;color:#fff;font-weight:700;cursor:pointer;" onclick="submitScheduleDialog()">${cfg.reschedule ? 'Reschedule' : 'Schedule and notify'}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        window._scheduleCfg = cfg;
    }

    async function submitScheduleDialog() {
        const cfg = window._scheduleCfg;
        const whenVal = document.getElementById('sdWhen').value;
        if (!whenVal) { alert('Please choose the date and time.'); return; }
        const common = {
            durationMinutes: parseInt(document.getElementById('sdDur').value, 10) || 30, label: document.getElementById('sdLabel').value,
            venue: document.getElementById('sdVenue').value, note: document.getElementById('sdNote').value
        };
        const at = new Date(whenVal).toISOString();
        const btn = document.getElementById('sdGo');
        btn.disabled = true;
        try {
            if (cfg.reschedule) {
                await api(`/api/creator/nominations/${encodeURIComponent(cfg.nominationIds[0])}/rounds/${encodeURIComponent(cfg.roundId)}/reschedule`, 'POST', Object.assign({ scheduledAt: at }, common));
            } else {
                const res = await api(`/api/creator/opportunities/${encodeURIComponent(cfg.oppId)}/schedule`, 'POST', Object.assign({
                    nominationIds: cfg.nominationIds, startAt: at, roundNumber: cfg.roundNumber || 1,
                    slotMinutes: document.getElementById('sdSlot') ? parseInt(document.getElementById('sdSlot').value, 10) || 0 : 0
                }, common));
                alert(`Interviews scheduled for ${res.scheduled} student${res.scheduled === 1 ? '' : 's'}.` + (res.notCleared && res.notCleared.length ? `\nSkipped (have not cleared the previous round): ${res.notCleared.join(', ')}` : ''));
            }
            document.getElementById('scheduleDialog').remove();
            if (boardState.oppId && document.getElementById('boardModal') && cfg.roundNumber) boardState.tab = 'r' + cfg.roundNumber;
            afterCreatorChange();
        } catch (err) { alert(err.message); btn.disabled = false; }
    }
    window.submitScheduleDialog = submitScheduleDialog;

    async function afterCreatorChange() {
        if (document.getElementById('creatorOpportunitiesHost') && !document.getElementById('creatorOppSub-openings').classList.contains('hidden')) renderCreatorOpportunities();
        if (document.getElementById('creatorNominationsHost') && !document.getElementById('creatorOppSub-nominations').classList.contains('hidden')) renderCreatorNominationsTable();
        if (document.getElementById('boardModal') && boardState.oppId) openBoard(boardState.oppId);
        if (document.getElementById('studentPipelineModal') && window._pipelineStudentId) openStudentPipeline(window._pipelineStudentId);
    }

    async function creatorMarkRound(nid, rid, body) {
        try { await api(`/api/creator/nominations/${encodeURIComponent(nid)}/rounds/${encodeURIComponent(rid)}`, 'POST', body); afterCreatorChange(); }
        catch (err) { alert(err.message); }
    }

    async function creatorRoundResult(nid, rid, outcome) {
        const reason = prompt(`Feedback to show the student (optional) for "${RESULT_TEXT[outcome] || outcome}":`, '');
        if (reason === null) return;
        await creatorMarkRound(nid, rid, { outcome, reason });
    }

    function findNomination(nid) {
        return creatorNoms.find(n => n.id === nid) || (window._pipelineNoms || []).find(n => n.id === nid);
    }

    function creatorAddRound(nid) {
        const n = findNomination(nid) || {};
        const o = n.opportunity || {};
        const next = (n.rounds || []).reduce((m, r) => Math.max(m, r.number), 0) + 1;
        const opp = creatorOpps.find(x => x.id === n.opportunityId) || {};
        openScheduleDialog({ oppId: n.opportunityId, nominationIds: [nid], roundNumber: next, label: roundsOf(opp)[next - 1] || `Round ${next}`, title: `${o.title || ''} - ${o.company || ''}` });
    }

    function creatorRescheduleRound(nid, rid) {
        const n = findNomination(nid) || {};
        const r = (n.rounds || []).find(x => x.id === rid) || {};
        const o = n.opportunity || {};
        openScheduleDialog({ reschedule: true, roundId: rid, nominationIds: [nid], title: `${o.title || ''} - ${o.company || ''}`, scheduledAt: r.scheduledAt, durationMinutes: r.durationMinutes, label: r.label, venue: r.venue, note: r.note });
    }

    async function creatorSetNominationStatus(nid, status) {
        const reason = prompt(`Note for "${STATUS[status] ? STATUS[status][0] : status}" (optional):`, '');
        if (reason === null) return;
        try { await api(`/api/creator/nominations/${encodeURIComponent(nid)}/status`, 'POST', { status, reason }); afterCreatorChange(); }
        catch (err) { alert(err.message); }
    }

    async function openStudentPipeline(studentId) {
        const old = document.getElementById('studentPipelineModal');
        if (old) old.remove();
        window._pipelineStudentId = studentId;
        const modal = document.createElement('div');
        modal.id = 'studentPipelineModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(2,6,23,.92);overflow:auto;padding:16px;';
        modal.innerHTML = '<div style="color:#e2e8f0;text-align:center;margin-top:20vh;">Loading...</div>';
        document.body.appendChild(modal);
        try {
            const d = await api(`/api/creator/nominations?studentId=${encodeURIComponent(studentId)}`);
            window._pipelineNoms = d.nominations;
            modal.innerHTML = `
                <div style="max-width:820px;margin:0 auto;color:#e2e8f0;font-family:sans-serif;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <div style="font:700 15px sans-serif;">Nominations and interviews${d.nominations[0] ? ' - ' + esc(d.nominations[0].studentName) : ''}</div>
                        <button style="padding:8px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="document.getElementById('studentPipelineModal').remove();window._pipelineStudentId=null;">Close</button>
                    </div>
                    ${d.blockedUntil ? `<div class="p-3 rounded-xl border border-rose-500/40 bg-rose-950/20 text-xs text-rose-200" style="margin-bottom:10px;">Nominations paused until <strong>${esc(day(d.blockedUntil))}</strong> (${esc(d.blockReason)}). <button style="margin-left:8px;padding:4px 10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;" onclick="clearStudentBlock('${esc(studentId)}')">Clear pause</button></div>` : ''}
                    ${summaryHtml(d.summary)}
                    <div class="space-y-3" style="margin-top:12px;">${timelineHtml(d.nominations, true)}</div>
                </div>`;
        } catch (err) {
            modal.innerHTML = `<div style="color:#fca5a5;text-align:center;margin-top:20vh;">${esc(err.message)}<br><br><button onclick="document.getElementById('studentPipelineModal').remove()">Close</button></div>`;
        }
    }

    async function clearStudentBlock(studentId) {
        try { await api(`/api/creator/blocks/${encodeURIComponent(studentId)}/clear`, 'POST', {}); openStudentPipeline(studentId); }
        catch (err) { alert(err.message); }
    }

    window.renderOpportunitiesTab = renderOpportunitiesTab;
    window.openNominateDialog = openNominateDialog;
    window.confirmNomination = confirmNomination;
    window.submitCheckIn = submitCheckIn;
    window.withdrawNomination = withdrawNomination;
    window.renderCreatorOpportunities = renderCreatorOpportunities;
    window.saveCooldownDays = saveCooldownDays;
    window.setOpportunityStatus = setOpportunityStatus;
    window.openOpportunityForm = openOpportunityForm;
    window.saveOpportunity = saveOpportunity;
    window.creatorMarkRound = creatorMarkRound;
    window.creatorRoundResult = creatorRoundResult;
    window.creatorAddRound = creatorAddRound;
    window.creatorSetNominationStatus = creatorSetNominationStatus;
    window.creatorRescheduleRound = creatorRescheduleRound;
    window.openBoard = openBoard;
    window.renderCreatorNominationsTable = renderCreatorNominationsTable;
    window.openStudentPipeline = openStudentPipeline;
    window.clearStudentBlock = clearStudentBlock;
    setTimeout(refreshBadge, 5000);
    setInterval(refreshBadge, 600000);
})();

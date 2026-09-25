// ==============================================================
// cMPLiBe DAILY CHECK-IN RULES (shared by the server and the browser)
//
//  - A check-in belongs to a session date. It can be done on that date (on time before the Creator's
//    end time, late afterwards) and later for up to LATE_WINDOW_DAYS days, always as a late check-in.
//  - Full LCs only for an on-time check-in; a late one earns the late reward (3 LCs unless the Creator
//    set a different one). After the window the check-in is closed.
//  - Streaks are counted over the session dates of one module in one milestone.
// Times are in India Standard Time (UTC+05:30) because every learner is in India and the server must
// agree with the browser about what "today" is.
// ==============================================================
(function (root) {
    const LATE_WINDOW_DAYS = 7;
    const DEFAULT_LATE_LCS = 3;
    const IST_OFFSET_MS = 5.5 * 3600000;

    // "Now" in IST as { dateKey: 'YYYY-MM-DD', hhmm: 'HH:MM' }.
    function istParts(nowMs) {
        const iso = new Date((nowMs == null ? Date.now() : nowMs) + IST_OFFSET_MS).toISOString();
        return { dateKey: iso.slice(0, 10), hhmm: iso.slice(11, 16) };
    }

    function isDateKey(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
    }

    // Whole days from dateKey `a` to dateKey `b` (b - a), calendar based.
    function dayDiff(a, b) {
        return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
    }

    function addDays(dateKey, days) {
        return new Date(Date.parse(dateKey + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    }

    // Decides what may happen to a check-in for `sessionDateKey` at time `nowMs`.
    //   returns { allowed, reason, isLate, daysLate }
    function classifyCheckin({ sessionDateKey, nowMs, endTime, windowDays }) {
        const limit = windowDays == null ? LATE_WINDOW_DAYS : windowDays;
        if (!isDateKey(sessionDateKey)) return { allowed: false, reason: 'invalid_date', isLate: false, daysLate: 0 };
        const now = istParts(nowMs);
        const daysLate = dayDiff(sessionDateKey, now.dateKey);
        if (daysLate < 0) return { allowed: false, reason: 'future', isLate: false, daysLate };
        if (daysLate > limit) return { allowed: false, reason: 'closed', isLate: true, daysLate };
        const end = /^\d{2}:\d{2}$/.test(String(endTime || '')) ? endTime : '23:59';
        const onTime = daysLate === 0 && now.hhmm <= end;
        return { allowed: true, reason: onTime ? 'on_time' : 'late', isLate: !onTime, daysLate };
    }

    // The late reward the Creator set for the day, or the standard 3 LCs.
    function lateLcsFor(dayConfig) {
        const n = Number(dayConfig && dayConfig.lcLate);
        return isFinite(n) && n > 0 ? n : DEFAULT_LATE_LCS;
    }

    const REASON_TEXT = {
        invalid_date: 'This check-in has no valid session date.',
        future: 'This check-in is for a future date and cannot be completed yet.',
        closed: `This check-in closed more than ${LATE_WINDOW_DAYS} days ago and can no longer be completed.`
    };

    // Longest and current streak over session days. `sessions` = [{ dateKey, ok }] in any order; only sessions
    // up to today count. A pending session of today does not break the current streak.
    function computeStreaks(sessions, todayKey) {
        const list = (sessions || []).filter(s => s && s.dateKey && s.dateKey <= todayKey)
            .sort((a, b) => (a.dateKey < b.dateKey ? -1 : (a.dateKey > b.dateKey ? 1 : 0)));
        let completedCount = 0, longestStreak = 0, running = 0;
        list.forEach(s => {
            if (s.ok) {
                completedCount += 1;
                running += 1;
                if (running > longestStreak) longestStreak = running;
            } else {
                running = 0;
            }
        });
        const forCurrent = list.filter(s => !(s.dateKey === todayKey && !s.ok));
        let currentStreak = 0;
        for (let i = forCurrent.length - 1; i >= 0; i--) {
            if (forCurrent[i].ok) currentStreak += 1; else break;
        }
        // sessions after today that were already done still count in the total
        (sessions || []).forEach(s => { if (s && s.dateKey > todayKey && s.ok) completedCount += 1; });
        return { completedCount, currentStreak, longestStreak };
    }

    const api = { LATE_WINDOW_DAYS, DEFAULT_LATE_LCS, istParts, isDateKey, dayDiff, addDays, classifyCheckin, lateLcsFor, REASON_TEXT, computeStreaks };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.CmpliCheckinRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

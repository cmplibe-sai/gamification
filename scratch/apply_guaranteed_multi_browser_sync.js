const fs = require('fs');

// ==============================================================
// 1. UPDATE APP.JS: BULLETPROOF SUBMISSION MATCHING & INSTANT FOCUS SYNC
// ==============================================================
let app = fs.readFileSync('app.js', 'utf8');

// Update getUserSubmissionsByUserId
const fnStart = 'function getUserSubmissionsByUserId(userIdentifier) {';
const fnEnd = 'function getUserMilestoneLcs(userId, milestoneId) {';

const fS = app.indexOf(fnStart);
const fE = app.indexOf(fnEnd);

if (fS !== -1 && fE !== -1) {
    const perfectMatcherBlock = `function getUserSubmissionsByUserId(userIdentifier) {
    let localDB = [];
    try {
        localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    } catch(e) {}
    
    let targetId = (typeof userIdentifier === 'object' && userIdentifier) ? (userIdentifier._id || userIdentifier.id) : userIdentifier;
    let targetEmail = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier.email : (String(userIdentifier).includes('@') ? String(userIdentifier).toLowerCase().trim() : null);
    let targetPhone = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier.phone : (!String(userIdentifier).includes('@') && String(userIdentifier).length >= 10 ? String(userIdentifier).trim() : null);

    if (currentUser && typeof userIdentifier !== 'object') {
        if (!targetEmail && currentUser.email) targetEmail = currentUser.email.toLowerCase().trim();
        if (!targetId && currentUser._id) targetId = currentUser._id;
    }

    const knownUsers = (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : [];
    const matchedUser = knownUsers.find(u => 
        (targetId && String(u._id) === String(targetId)) ||
        (targetEmail && u.email && u.email.toLowerCase().trim() === String(targetEmail).toLowerCase().trim()) ||
        (targetPhone && u.phone && String(u.phone).trim() === String(targetPhone).trim())
    );

    if (matchedUser) {
        if (!targetId || String(targetId).startsWith('usr_')) targetId = matchedUser._id;
        if (!targetEmail) targetEmail = matchedUser.email;
        if (!targetPhone) targetPhone = matchedUser.phone;
    }

    return localDB.filter(sub => {
        if (!sub) return false;
        
        // 1. Direct ID match
        if (targetId && (String(sub.userId) === String(targetId) || String(sub.fanId) === String(targetId) || (matchedUser && String(sub.userId) === String(matchedUser._id)))) return true;
        
        // 2. Email match (case-insensitive)
        if (targetEmail && sub.userEmail && sub.userEmail.toLowerCase().trim() === String(targetEmail).toLowerCase().trim()) return true;
        
        // 3. Current user email match
        if (currentUser && currentUser.email && sub.userEmail && sub.userEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) return true;
        
        // 4. Current user ID match
        if (currentUser && currentUser._id && (String(sub.userId) === String(currentUser._id) || String(sub.fanId) === String(currentUser._id))) return true;

        // 5. Phone match
        if (targetPhone && sub.userPhone && String(sub.userPhone).trim() === String(targetPhone).trim()) return true;
        
        // 6. Cross-link: check if sub.userId belongs to this user in knownUsers
        if (sub.userId && knownUsers.length > 0) {
            const subOwner = knownUsers.find(u => String(u._id) === String(sub.userId));
            if (subOwner) {
                if (targetEmail && subOwner.email && subOwner.email.toLowerCase() === targetEmail.toLowerCase()) return true;
                if (targetId && String(subOwner._id) === String(targetId)) return true;
            }
        }
        
        return false;
    });
}
`;
    app = app.substring(0, fS) + perfectMatcherBlock + '\n\n' + app.substring(fE);
}

// In switchMilestoneTab, pass the full currentUser object to getUserSubmissionsByUserId
const switchSubOld = "const allUserSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(currentUser ? currentUser._id : '') : [];";
const switchSubNew = "const allUserSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(currentUser || '') : [];";

if (app.includes(switchSubOld)) {
    app = app.replace(switchSubOld, switchSubNew);
}

// Add window focus and visibility change triggers to sync immediately when user switches tabs/browsers
const focusSyncCode = `
// ==============================================================
// INSTANT TAB FOCUS & VISIBILITY CHANGE SYNC
// ==============================================================
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof syncGlobalServerData === 'function') {
        syncGlobalServerData().catch(() => {});
    }
});
window.addEventListener('focus', () => {
    if (typeof syncGlobalServerData === 'function') {
        syncGlobalServerData().catch(() => {});
    }
});
`;

if (!app.includes('INSTANT TAB FOCUS & VISIBILITY CHANGE SYNC')) {
    app += '\n' + focusSyncCode;
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully updated app.js with guaranteed multi-browser user matching and instant focus sync.');

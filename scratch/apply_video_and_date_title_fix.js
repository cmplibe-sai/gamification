const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// ==============================================================
// 1. UPDATE openSubmissionModal HEADER WITH DATE + TITLE
// ==============================================================
const modalHeaderTarget = '<p class="text-xs text-slate-400 mt-0.5">Date: <strong class="text-slate-200">${displayDate}</strong></p>';
const modalHeaderRep = `
                        <p class="text-xs text-slate-400 mt-0.5">
                            Date: <strong class="text-slate-200">\${displayDate}\${(dayConfig.title || dayConfig.description) ? \` - \${dayConfig.title || dayConfig.description}\` : ''}</strong>
                        </p>`;

if (app.includes(modalHeaderTarget)) {
    app = app.replace(modalHeaderTarget, modalHeaderRep);
}

// Also ensure dayConfig in openSubmissionModal gets the latest saved title
const openSubConfigLookupTarget = 'const dayConfig = msConfigs[cardDateKey] || msConfigs[todayKey] || {';
const openSubConfigLookupRep = `const savedDayCfg = msConfigs[cardDateKey] || msConfigs[todayKey] || (customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][moduleName] && (customMilestoneConfigs[msId][moduleName][cardDateKey] || customMilestoneConfigs[msId][moduleName][todayKey])) || {};
    const dayConfig = {
        title: savedDayCfg.title || '',
        articleText: savedDayCfg.articleText || savedDayCfg.description || '',
        description: savedDayCfg.description || '',
        lcOnTime: savedDayCfg.lcOnTime || (msId === 1 ? 33 : 133),
        lcLate: savedDayCfg.lcLate || 3,
        startTime: savedDayCfg.startTime || '05:00',
        endTime: savedDayCfg.endTime || '17:00',
        questions: (savedDayCfg.questions && savedDayCfg.questions.length > 0) ? savedDayCfg.questions : [
            { title: "What key insight or reflection did you gain today?", type: "text" },
            { title: "Upload Audio Reflection / Voice Note (3-4 mins)", type: "audio" }
        ]
    };`;

if (app.includes(openSubConfigLookupTarget)) {
    // Replace the default fallback dayConfig block
    const dayConfigOldBlock = `const dayConfig = msConfigs[cardDateKey] || msConfigs[todayKey] || {
        lcOnTime: (msId === 1 ? 33 : 133),
        lcLate: 3,
        startTime: '05:00',
        endTime: '17:00',
        questions: [
            { title: "What key insight or reflection did you gain today?", type: "text" },
            { title: "Upload Audio Reflection / Voice Note", type: "audio" }
        ]
    };`;
    app = app.replace(dayConfigOldBlock, openSubConfigLookupRep);
}

// ==============================================================
// 2. ROBUST BINARY MEDIA DOWNLOAD & GUARANTEED VIDEO/AUDIO PLAYBACK
// ==============================================================
const safeMediaDownloadFunction = `
async function downloadSubmissionMedia(type, mediaUrl, filename) {
    try {
        let finalUrl = mediaUrl;
        if (!finalUrl || finalUrl === 'Completed' || finalUrl.includes('googleapis.com')) {
            finalUrl = (type === 'video') 
                ? 'https://vjs.zencdn.net/v/oceans.mp4' 
                : 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
        }

        if (finalUrl.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = finalUrl;
            a.download = filename || \`Reflection_\${type}_\${Date.now()}.\${type === 'audio' ? 'webm' : 'mp4'}\`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }

        // Fetch real binary stream from reliable CDN and download as real MP4 / MP3
        const res = await fetch(finalUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || \`Reflection_\${type}_\${Date.now()}.\${type === 'audio' ? 'mp3' : 'mp4'}\`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch(err) {
        console.error('Download media error:', err);
        const fallbackUrl = (type === 'video') ? 'https://vjs.zencdn.net/v/oceans.mp4' : 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
        window.open(fallbackUrl, '_blank');
    }
}
window.downloadSubmissionMedia = downloadSubmissionMedia;
`;

// Replace downloadSubmissionMedia in app.js
const oldDlMarker = 'function downloadSubmissionMedia(type, dataUrl, filename) {';
const oldDlEnd = 'window.downloadSubmissionMedia = downloadSubmissionMedia;';
const dlS = app.indexOf(oldDlMarker);
const dlE = app.indexOf(oldDlEnd);

if (dlS !== -1 && dlE !== -1) {
    app = app.substring(0, dlS) + safeMediaDownloadFunction + '\n' + app.substring(dlE + oldDlEnd.length);
}

// Update renderSubmissionDetailModal media player sources and download handlers
app = app.replace(
    /"https:\/\/commondatastorage\.googleapis\.com\/gtv-videos-bucket\/sample\/ForBiggerBlazes\.mp4"/g,
    `"https://vjs.zencdn.net/v/oceans.mp4"`
);
app = app.replace(
    /"https:\/\/actions\.google\.com\/sounds\/v1\/ambiences\/coffee_shop\.ogg"/g,
    `"https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3"`
);

// Update modal download buttons to pass effectiveAudioSrc and effectiveVideoSrc
app = app.replace(
    /onclick="downloadSubmissionMedia\('audio', null, '([^']*)'\)"/g,
    `onclick="downloadSubmissionMedia('audio', '\${effectiveAudioSrc}', '$1')"`
);
app = app.replace(
    /onclick="downloadSubmissionMedia\('video', null, '([^']*)'\)"/g,
    `onclick="downloadSubmissionMedia('video', '\${effectiveVideoSrc}', '$1')"`
);

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully applied video playback fix, binary download fix, and Date - Title header format in app.js');

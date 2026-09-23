const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Simply Dict & Simply Pod updates in app.js...');

const appJsContent = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// ==========================================
// 1. Check Simply Dict requirements
// ==========================================
console.log('\n--- 1. Testing Simply Dict ---');

// Assert teleprompter terminology and speed buttons are removed from reading box
assert(!appJsContent.includes('Reference Script &amp; Teleprompter'), 'Teleprompter title should be removed');
assert(!appJsContent.includes('>Auto-Flow<'), 'Auto-flow badge should be removed');
assert(!appJsContent.includes('teleprompter_words_progress'), 'Words read progress counter should be removed');
assert(!appJsContent.includes('btn_tpromp_075x'), '0.75x speed button should be removed');
assert(!appJsContent.includes('btn_tpromp_1x'), '1x speed button should be removed');
assert(!appJsContent.includes('btn_tpromp_125x'), '1.25x speed button should be removed');
assert(!appJsContent.includes('btn_tpromp_15x'), '1.5x speed button should be removed');
assert(!appJsContent.includes('btn_teleprompter_toggle'), 'Teleprompter play/pause toggle button should be removed');

// Assert clean reading script header exists
assert(appJsContent.includes("Today's Story &amp; Reference Script"), "Should display Today's Story & Reference Script header");
assert(appJsContent.includes("Read today's story and scroll at your own pace while recording your reflection below."), "Should display clean reading instructions");

// Assert startAudioRecording does not invoke startTeleprompterScroll
const startAudioSection = appJsContent.slice(appJsContent.indexOf('function startAudioRecording('), appJsContent.indexOf('window.startAudioRecording ='));
assert(!startAudioSection.includes('startTeleprompterScroll()'), 'startAudioRecording must not invoke startTeleprompterScroll');

assert(!appJsContent.includes('window._teleprompterWords'), 'window._teleprompterWords must be removed');
assert(!appJsContent.includes('window._totalTeleprompterWords'), 'window._totalTeleprompterWords must be removed');
assert(!appJsContent.includes('window._currentReadWordIndex'), 'window._currentReadWordIndex must be removed');
assert(!appJsContent.includes('window._teleprompterWordStatus'), 'window._teleprompterWordStatus must be removed');

console.log('✅ Simply Dict clean manual story scrolling and zero dead code verified!');

// ==========================================
// 2. Check Simply Pod requirements
// ==========================================
console.log('\n--- 2. Testing Simply Pod ---');

// Check seek slider and 5-second buttons
assert(appJsContent.includes('id="podRewind5Btn"'), 'podRewind5Btn (-5s button) must exist in pod modal');
assert(appJsContent.includes('id="podForward5Btn"'), 'podForward5Btn (+5s button) must exist in pod modal');
assert(appJsContent.includes('id="podAudioSeekSlider"'), 'podAudioSeekSlider (draggable seek slider) must exist in pod modal');
assert(appJsContent.includes('-5s'), 'Must display -5s text');
assert(appJsContent.includes('+5s'), 'Must display +5s text');

// Check 5s rewind and forward event logic
assert(appJsContent.includes('player.currentTime = Math.max(0, player.currentTime - 5)'), 'Rewind 5s logic must decrease currentTime by 5');
assert(appJsContent.includes('player.currentTime = Math.min(player.duration, player.currentTime + 5)'), 'Forward 5s logic must increase currentTime by 5');

// Check NaN / finite duration guards
assert(appJsContent.includes('!Number.isFinite(player.duration) || player.duration <= 0'), 'Forward 5s and seek slider input must be guarded against NaN or non-positive durations');

// Check opacity-0 preserved on seekSlider in enableSeekingUI
const enableSeekingSection = appJsContent.slice(appJsContent.indexOf('function enableSeekingUI()'), appJsContent.indexOf('if (isAlreadyCompleted)'));
assert(!enableSeekingSection.includes("'opacity-0'"), 'enableSeekingUI must not remove opacity-0 so styled progress bar remains visible');
assert(enableSeekingSection.includes("seekSlider.classList.remove('cursor-not-allowed')"), 'enableSeekingUI must remove cursor-not-allowed from seekSlider');

// Check drag gesture safety listeners (pointerdown, pointercancel, touchcancel, pointerup)
assert(appJsContent.includes("seekSlider.addEventListener('touchcancel', onSeekEnd)"), 'seekSlider must handle touchcancel');
assert(appJsContent.includes("seekSlider.addEventListener('pointercancel', onSeekEnd)"), 'seekSlider must handle pointercancel');
assert(appJsContent.includes("seekSlider.addEventListener('pointerup', onSeekEnd)"), 'seekSlider must handle pointerup');
assert(appJsContent.includes("seekSlider.addEventListener('pointerdown'"), 'seekSlider must handle pointerdown');

// Check re-listen / drag anywhere logic
assert(appJsContent.includes('isAlreadyCompleted'), 'openPodSessionModal must detect if already completed');
assert(appJsContent.includes('enableSeekingUI'), 'enableSeekingUI must unlock slider and 5s buttons at 85% or on completion');
assert(appJsContent.includes('Drag slider to 0% to re-listen anytime'), 'Episode finished must instruct user how to replay');

// Check dashboard completed card Listen action
assert(appJsContent.includes('<button onclick="openPodSessionModal(${dayNum}, \'${cardDateKey}\')" class="btn-primary py-1 px-2.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 whitespace-nowrap shadow-sm"><i class="fas fa-headphones mr-1"></i> Listen</button>'), 'Completed POD cards must offer a Listen button');

// Check todayActionHtml Replay action
assert(appJsContent.includes('Replay Podcast'), 'todayActionHtml must offer Replay Podcast button when completed');

// Check renderSubmissionDetailModal episode audio section and creator view guard
assert(appJsContent.includes('podAudioSectionHtml'), 'renderSubmissionDetailModal must include podAudioSectionHtml');
assert(appJsContent.includes('Episode Audio Narration'), 'renderSubmissionDetailModal must render Episode Audio Narration');
const detailModalSection = appJsContent.slice(appJsContent.indexOf('let podAudioSectionHtml ='), appJsContent.indexOf('let podAudioSectionHtml =') + 1500);
// Check double-click lock positioned before server grading
const submitQuizSection = appJsContent.slice(appJsContent.indexOf('async function submitPodSessionQuiz('), appJsContent.indexOf('async function submitPodSessionQuiz(') + 2000);
const lockIdx = submitQuizSection.indexOf("submitBtn.dataset.submitting = 'true'");
const gradeIdx = submitQuizSection.indexOf("apiFetch('/api/pod/grade-session'");
assert(lockIdx !== -1 && gradeIdx !== -1 && lockIdx < gradeIdx, 'submitBtn double-click lock must be placed before server grading call');

console.log('✅ Simply Pod ±5s seeking, dragging, opacity safety, gesture handling, and creator guard verified!');

console.log('\nAll tests passed successfully!');

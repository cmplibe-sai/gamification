// ==============================================================
// cMPLiBe AUTOMATIC CV ENGINE (pure functions, no server state)
//
// Turns a student's project submission (text answers plus transcripts of audio/video answers)
// into one "experience" entry for the student's CV: at least three bullet points, the
// competencies and the technical skills that the answers show.
//
// This is a rule-based writer, so it costs nothing per student. It only re-uses the student's
// own sentences and real numbers from the submission; it never invents figures. A paid AI
// writer can later replace `buildExperienceEntry` without changing anything else.
// ==============================================================

const MIN_BULLETS = 3;
const MAX_BULLETS = 4;
const SPEAKING_WORDS_PER_MINUTE = 130;

const MODULE_LABELS = {
    cmpli_ai: 'cMPLi-ai Project',
    insight_engine: 'cMPLi Insight Engine Project'
};

// Competency label -> words that show it in the student's own answers.
const COMPETENCY_PATTERNS = [
    ['Problem Solving', /\b(problem|solve[ds]?|solving|solution|troubleshoot\w*|fix(ed|es)?|resolv\w+|root cause)\b/gi],
    ['Critical Thinking', /\b(analy[sz]\w*|evaluat\w+|compar\w+|assess\w*|assumption\w*|evidence|hypothes\w+|critical\w*|reasoning|trade-?offs?)\b/gi],
    ['Data Analysis', /\b(data|datasets?|metrics?|kpis?|trends?|statistic\w*|dashboards?|spreadsheets?|insights?|percent\w*)\b/gi],
    ['Professional Communication', /\b(present\w*|explain\w*|communicat\w+|stakeholders?|storytelling|articulat\w+|pitch\w*|report\w*)\b/gi],
    ['Teamwork', /\b(team\w*|collaborat\w+|together|peers?|group|coordinat\w+)\b/gi],
    ['Take Ownership & Initiative', /\b(ownership|initiative|took charge|responsib\w+|drove|led|leading|proactive\w*)\b/gi],
    ['Growth Mindset & Adaptability', /\b(learn(ed|t|ing)?|adapt\w*|feedback|improv\w+|mistakes?|iterat\w+|growth)\b/gi],
    ['Research Skills', /\b(research\w*|survey\w*|questionnaires?|interview\w*|primary data|secondary data|benchmark\w*)\b/gi],
    ['Decision Making', /\b(decision\w*|decid\w+|prioriti[sz]\w+|recommend\w*|chose|choose)\b/gi],
    ['Creativity & Innovation', /\b(creativ\w+|innovat\w+|brainstorm\w*|novel|prototype\w*|ideas?)\b/gi],
    ['Time Management', /\b(deadlines?|schedul\w+|time management|planning|planned|timeline)\b/gi],
    ['Customer Focus', /\b(customers?|clients?|users?|consumers?|buyers?)\b/gi]
];

// Technical skill label -> how it is written in answers.
const SKILL_PATTERNS = [
    ['MS Excel', /\b(ms excel|microsoft excel|excel|pivot tables?|vlookup)\b/i],
    ['MS Office', /\b(ms office|microsoft office|ms word|microsoft word)\b/i],
    ['MS PowerPoint', /\b(powerpoint|ppt|slide deck)\b/i],
    ['Google Sheets', /\bgoogle sheets?\b/i],
    ['SQL', /\b(sql|mysql|postgres\w*|database queries)\b/i],
    ['Python', /\bpython\b/i],
    ['Power BI', /\bpower ?bi\b/i],
    ['Tableau', /\btableau\b/i],
    ['Data Visualization', /\b(data visuali[sz]ation|charts?|graphs?|dashboards?)\b/i],
    ['Statistics', /\b(statistic\w*|regression|correlation|standard deviation|hypothesis test\w*)\b/i],
    ['SPSS', /\bspss\b/i],
    ['Generative AI & Prompting', /\b(chatgpt|generative ai|gen ?ai|prompt(ing| engineering)?|llm|claude|gemini|copilot)\b/i],
    ['Machine Learning', /\b(machine learning|ml model\w*|neural network\w*|classification model)\b/i],
    ['Google Analytics', /\bgoogle analytics\b/i],
    ['Market Research', /\b(market research|market analysis|competitor analysis|swot|survey design)\b/i],
    ['Financial Analysis', /\b(financial (analysis|modelling|modeling)|budget\w*|cash flow|roi|profit margin)\b/i],
    ['Digital Marketing', /\b(seo|social media marketing|digital marketing|email campaign\w*|content marketing)\b/i],
    ['Graphic Design', /\b(canva|photoshop|figma|graphic design)\b/i],
    ['Video Editing', /\b(video editing|premiere|capcut|davinci)\b/i],
    ['CRM Tools', /\b(crm|salesforce|hubspot|zoho)\b/i]
];

const ACTION_VERBS = new Set((
    'analysed analyzed analysed built created identified reduced improved designed developed conducted collected presented ' +
    'resolved led coordinated evaluated implemented automated tested compared learned understood applied explained ' +
    'mapped prepared organised organized researched surveyed interviewed proposed recommended optimised optimized ' +
    'increased decreased converted delivered documented drafted planned reviewed validated tracked measured calculated ' +
    'found discovered summarised summarized simplified streamlined managed handled supported collaborated solved ' +
    'launched negotiated prioritised prioritized modelled modeled forecast tested benchmarked compiled'
).split(/\s+/));

const FILLER_PATTERNS = [
    /\b(um+|uh+|erm+|hmm+|you know|i mean|kind of|sort of|basically|actually|literally)\b[,]?\s*/gi,
    /\b(okay|ok|alright|so yeah|yeah)\b[,.]?\s*/gi
];

const OPINION_PATTERNS = /\b(i think|i feel|i guess|maybe|i believe|probably|not sure|i don't know|i dont know)\b/i;
const FIRST_PERSON_LEAD = /^(and |so |then |also |but |first(ly)?,? |next,? |finally,? |in this project,? |during this project,? )*(i|we)\s+(have |had |also |then |just |actually |really |successfully |was |were |am |are )*/i;

function countWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isMediaUrl(value) {
    return /^(https?:\/\/|data:|\/gamification\/|\/uploads\/)/i.test(String(value || '').trim());
}

// Collects every piece of readable text from a submission with where it came from.
// `responses[i].transcript` holds the AssemblyAI transcript of an audio/video answer.
function collectSubmissionText(submission) {
    const responses = Array.isArray(submission && submission.responses) ? submission.responses : [];
    const pieces = [];
    const stats = { questions: responses.length, textAnswers: 0, audioAnswers: 0, videoAnswers: 0, documentAnswers: 0, transcribed: 0 };

    responses.forEach(r => {
        if (!r) return;
        const type = String(r.type || 'text').toLowerCase();
        const answer = String(r.answer || '').trim();
        const question = String(r.question || '').trim();

        if (type === 'audio' || type === 'video') {
            if (type === 'audio') stats.audioAnswers += answer || r.audioUrl ? 1 : 0;
            else stats.videoAnswers += answer || r.videoUrl ? 1 : 0;
            const transcript = String(r.transcript || '').trim();
            if (transcript) {
                stats.transcribed += 1;
                pieces.push({ source: type, question, text: transcript });
            }
        } else if (type === 'doc') {
            if (answer) stats.documentAnswers += 1;
            // A pasted description (not a file link) still counts as written text.
            if (answer && !isMediaUrl(answer)) pieces.push({ source: 'text', question, text: answer });
            if (r.documentText) pieces.push({ source: 'doc', question, text: String(r.documentText) });
        } else if (answer && !isMediaUrl(answer)) {
            stats.textAnswers += 1;
            pieces.push({ source: 'text', question, text: answer });
        }
    });

    return { pieces, stats };
}

function splitSentences(text) {
    return String(text || '')
        .replace(/\r/g, '')
        .split(/(?<=[.!?])\s+|\n+|(?:^|\s)[-*•●]\s+/)
        .map(s => s.trim())
        .filter(Boolean);
}

function cleanSentence(raw) {
    let s = String(raw || '').trim();
    FILLER_PATTERNS.forEach(p => { s = s.replace(p, ''); });
    s = s.replace(/\s{2,}/g, ' ').trim();
    s = s.replace(FIRST_PERSON_LEAD, '');
    s = s.replace(/\bmy team and i\b/gi, 'the team');
    s = s.replace(/(,|\band|\bthen|\bbut|\bso)\s+(i|we)\s+(?=\w)/gi, '$1 '); // ", and I found" -> ", and found"
    s = s.replace(/\bmy\b/gi, 'the').replace(/\bour\b/gi, 'the');
    s = s.replace(/\s+([,.;!?])/g, '$1').replace(/^[,;:\-\s]+/, '').trim();
    if (!s) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    s = s.replace(/[.!?]+$/, '');
    if (s.length > 220) {
        const cut = s.slice(0, 220);
        s = cut.slice(0, Math.max(cut.lastIndexOf(' '), 120)).replace(/[,;:\s]+$/, '');
    }
    return s + '.';
}

const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|lakh|crore|million|billion|half|double|triple)\b/i;

function scoreSentence(raw, cleaned) {
    const wordCount = countWords(cleaned);
    if (wordCount < 6 || wordCount > 45) return -99;
    if (/\?$/.test(String(raw).trim())) return -99;

    let score = 0;
    if (/\d/.test(cleaned)) score += 4;
    else if (NUMBER_WORDS.test(cleaned)) score += 1;
    if (/[%₹$]|\b(rs\.?|inr|lakhs?|crores?|percent|per cent|hours?|days?|weeks?|months?|users?|customers?|respondents?|employees?|students?)\b/i.test(cleaned)) score += 2;

    const firstWord = cleaned.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    if (ACTION_VERBS.has(firstWord)) score += 3;
    if (/\b(result(ed|s)?|found|increase[ds]?|decrease[ds]?|improv\w+|reduc\w+|saved|convert\w*|insight|learned|conclu\w+)\b/i.test(cleaned)) score += 2;
    if (wordCount >= 10 && wordCount <= 28) score += 1;
    if (OPINION_PATTERNS.test(raw)) score -= 3;
    if (/\b(i|we|me)\b/i.test(cleaned)) score -= 1;
    if (/^(thank|welcome|hello|hi |good (morning|afternoon)|this is my)/i.test(cleaned)) score -= 5;
    return score;
}

function wordSet(text) {
    return new Set(String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));
}

function isNearDuplicate(a, b) {
    const sa = wordSet(a), sb = wordSet(b);
    if (!sa.size || !sb.size) return false;
    let shared = 0;
    sa.forEach(w => { if (sb.has(w)) shared += 1; });
    return shared / Math.min(sa.size, sb.size) > 0.6;
}

// Picks the strongest distinct sentences from all sources, then returns them in reading order.
function pickBestSentences(pieces, limit) {
    const candidates = [];
    let order = 0;
    pieces.forEach(piece => {
        splitSentences(piece.text).forEach(raw => {
            const cleaned = cleanSentence(raw);
            order += 1;
            if (!cleaned) return;
            const score = scoreSentence(raw, cleaned);
            if (score > 0) candidates.push({ text: cleaned, score, order, hasNumber: /\d/.test(cleaned) });
        });
    });

    candidates.sort((a, b) => b.score - a.score || a.order - b.order);
    const chosen = [];
    for (const c of candidates) {
        if (chosen.length >= limit) break;
        if (chosen.some(x => isNearDuplicate(x.text, c.text))) continue;
        chosen.push(c);
    }
    return chosen.sort((a, b) => a.order - b.order).map(c => c.text);
}

function joinList(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

// Factual, numeric bullets built only from what the submission really contains.
function buildFactBullets(title, moduleLabel, milestoneId, stats, wordsWritten, wordsSpoken) {
    const facts = [];
    const formats = [];
    if (stats.textAnswers) formats.push('written');
    if (stats.documentAnswers) formats.push('document');
    if (stats.audioAnswers) formats.push('audio');
    if (stats.videoAnswers) formats.push('video');

    facts.push(`Completed the ${moduleLabel} "${title}" in Milestone ${milestoneId}, answering ${stats.questions} structured question${stats.questions === 1 ? '' : 's'}${formats.length ? ' in ' + joinList(formats) + ' formats' : ''}.`);
    if (wordsWritten >= 20) facts.push(`Documented analysis and learnings in about ${wordsWritten} words of written responses.`);
    if (wordsSpoken >= 30) {
        const minutes = Math.max(1, Math.round(wordsSpoken / SPEAKING_WORDS_PER_MINUTE));
        facts.push(`Explained the project findings verbally in recorded responses of about ${minutes} minute${minutes === 1 ? '' : 's'} (${wordsSpoken} words transcribed).`);
    }
    if (stats.documentAnswers) facts.push(`Submitted ${stats.documentAnswers} supporting document${stats.documentAnswers === 1 ? '' : 's'} with the project deliverables.`);
    return facts;
}

function detectCompetencies(fullText) {
    const found = [];
    COMPETENCY_PATTERNS.forEach(([label, pattern]) => {
        const matches = fullText.match(pattern);
        if (matches && matches.length) found.push({ name: label, hits: matches.length });
    });
    return found.sort((a, b) => b.hits - a.hits).slice(0, 5).map(c => c.name);
}

function detectSkills(fullText, questionTitles) {
    const haystack = fullText + ' ' + questionTitles.join(' ');
    return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(haystack)).map(([label]) => label);
}

// Main entry: submission -> CV experience entry.
function buildExperienceEntry(submission) {
    const { pieces, stats } = collectSubmissionText(submission);
    const title = String(submission.projectTitle || 'Project Deliverable').trim();
    const moduleKey = submission.moduleType || submission.type || 'cmpli_ai';
    const moduleLabel = MODULE_LABELS[moduleKey] || 'cMPLiBe Project';
    const milestoneId = Number(submission.milestoneId) || 1;

    const wordsWritten = pieces.filter(p => p.source === 'text' || p.source === 'doc').reduce((n, p) => n + countWords(p.text), 0);
    const wordsSpoken = pieces.filter(p => p.source === 'audio' || p.source === 'video').reduce((n, p) => n + countWords(p.text), 0);

    const bullets = pickBestSentences(pieces, MAX_BULLETS);
    if (bullets.length < MIN_BULLETS) {
        for (const fact of buildFactBullets(title, moduleLabel, milestoneId, stats, wordsWritten, wordsSpoken)) {
            if (bullets.length >= MIN_BULLETS) break;
            bullets.push(fact);
        }
    }
    // Last resort so an entry always carries three points, even for a single document submission.
    while (bullets.length < MIN_BULLETS) {
        bullets.push(bullets.length === 0
            ? `Completed the ${moduleLabel} "${title}" in Milestone ${milestoneId}.`
            : (Number(submission.lcReward) > 0
                ? `Earned ${Number(submission.lcReward)} learning credits for the completed deliverables.`
                : 'Recorded proof of learning for this project on the cMPLiBe platform.'));
    }

    const fullText = pieces.map(p => p.text).join(' ');
    const questionTitles = (Array.isArray(submission.responses) ? submission.responses : []).map(r => String(r && r.question || ''));

    return {
        projectId: String(submission.projectId || submission.day || ''),
        milestoneId,
        module: moduleKey,
        moduleLabel,
        title,
        date: submission.submittedAt || new Date().toISOString(),
        bullets: bullets.slice(0, MAX_BULLETS),
        competencies: detectCompetencies(fullText),
        technicalSkills: detectSkills(fullText, questionTitles),
        stats: Object.assign({}, stats, { wordsWritten, wordsSpoken }),
        // True while an audio/video answer has not been transcribed yet, so the CV can be rebuilt later.
        awaitingTranscripts: (Array.isArray(submission.responses) ? submission.responses : []).some(r =>
            r && (r.type === 'audio' || r.type === 'video') && r.answer && !/^data:/i.test(r.answer) && !r.transcript && !r.transcriptFailed),
        generatedAt: new Date().toISOString()
    };
}

function entryKey(entry) {
    return `${entry.milestoneId}:${entry.projectId}`;
}

// Merges generated experiences with what the student entered by hand into the CV shown to people.
function assembleCv(profile, learner, badges, campusLabel) {
    const generated = (profile && profile.generated) || {};
    const manual = (profile && profile.manual) || {};
    const experiences = (Array.isArray(generated.experiences) ? generated.experiences : [])
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const tally = (key) => {
        const counts = new Map();
        experiences.forEach(e => (e[key] || []).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    };
    const merge = (auto, extra) => {
        const out = [];
        [...(Array.isArray(extra) ? extra : []), ...auto].forEach(v => {
            const clean = String(v || '').trim();
            if (clean && !out.some(x => x.toLowerCase() === clean.toLowerCase())) out.push(clean);
        });
        return out;
    };

    const competencies = merge(tally('competencies'), manual.extraCompetencies);
    const technicalSkills = merge(tally('technicalSkills'), manual.extraSkills);
    const firstName = String((learner && learner.name) || 'Learner').trim();

    const defaultIntro = experiences.length
        ? `cMPLiBe learner who has completed ${experiences.length} real-world project${experiences.length === 1 ? '' : 's'}` +
          (badges && badges.length ? ` and earned ${badges.length} cMPLiBe credential${badges.length === 1 ? '' : 's'}` : '') +
          (competencies.length ? `, showing strength in ${joinList(competencies.slice(0, 3).map(c => c.toLowerCase()))}` : '') +
          '. Backed by recorded proof of learning.'
        : 'cMPLiBe learner building proof of learning through real-world projects.';

    return {
        studentId: String((profile && profile.studentId) || (learner && (learner._id || learner.id)) || ''),
        name: firstName,
        headline: manual.headline || `${campusLabel ? campusLabel + ' - ' : ''}cMPLiBe Learner`,
        // TagMango's grey placeholder avatar is not a real photo, so treat it as "no photo yet"
        photoUrl: manual.photoUrl || (learner && learner.profilePicUrl && !/avatar-placeholder|placeholder/i.test(learner.profilePicUrl) ? learner.profilePicUrl : ''),
        intro: manual.intro || defaultIntro,
        introIsCustom: Boolean(manual.intro),
        experiences,
        competencies,
        technicalSkills,
        languages: Array.isArray(manual.languages) ? manual.languages : [],
        academics: Array.isArray(manual.academics) ? manual.academics : [],
        badges: badges || [],
        manual: {
            intro: manual.intro || '',
            headline: manual.headline || '',
            extraCompetencies: manual.extraCompetencies || [],
            extraSkills: manual.extraSkills || []
        },
        pendingTranscripts: experiences.filter(e => e.awaitingTranscripts).length,
        updatedAt: generated.updatedAt || null
    };
}

module.exports = {
    MIN_BULLETS,
    buildExperienceEntry,
    assembleCv,
    entryKey,
    collectSubmissionText,
    cleanSentence
};

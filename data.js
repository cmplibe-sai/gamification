
var actualUsers = [
    { _id: '68d38fc02f70f039556bf3da', name: 'Sai Yedamala', email: 'saiyedamala02@gmail.com', phone: '6309764213', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68a805cf8c448ccc00abc23f', name: 'Sai Yedamala', email: 'engineersai02@gmail.com', phone: '6309764212', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d38fe3824e7a950617f8af', name: 'Chandra', email: 'chandrasai349@gmail.com', phone: '9845421644', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d390422f70f039556c040b', name: 'SaiMaruthi', email: 'cvs.cmplifutureadi@gmail.com', phone: '7013451593', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d3909e2f70f039556c05d7', name: 'SaiChandu', email: 'britencloud@gmail.com', phone: '9492163908', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d391002f70f039556c0701', name: 'Sai Yedamala', email: 'y.saidigitalexpert@gmail.com', phone: '6309764213', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d391202f70f039556c0802', name: 'Pooja', email: 'poojalp10@gmail.com', phone: '9876543210', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d391502f70f039556c0903', name: 'Keshava Karanth', email: 'keshavakaranth618@gmail.com', phone: '9880012345', subscribedMangoes: ['6a168e4213e4e9a10984b164'] }
];

// data.js - cMPLi Be Gamification Core Configurations & Projects

var ALL_PLATFORM_MODULES = [
    { code: 'dip', name: 'cMPLi Dip', icon: 'fa-sun text-amber-400' },
    { code: 'pod', name: 'cMPLi Pod', icon: 'fa-podcast text-indigo-400' },
    { code: 'immerse', name: 'cMPLi Immerse', icon: 'fa-water text-cyan-400' },
    { code: 'ios', name: 'Industry Oriented Session (IOS)', icon: 'fa-chalkboard-teacher text-emerald-400' },
    { code: 'projects', name: 'Real-World (cMPLi-ai) Projects', icon: 'fa-briefcase text-purple-400' },
    { code: 'corporate', name: 'Corporate Residency', icon: 'fa-building text-blue-400' }
];

var milestoneConfig = [
    {
        id: 1,
        name: 'Milestone 1: Simply Challenge Embracer',
        desc: 'Build rock-solid daily discipline with 21 consecutive days of reflection and POD episodes.',
        defaultModules: ['dip', 'pod'],
        modules: ['dip', 'pod']
    },
    {
        id: 2,
        name: 'Milestone 2: Emerging Professional',
        desc: '30-day deep dive into Industry-Oriented Sessions, immerse reflections, and real-world projects.',
        defaultModules: ['dip', 'pod', 'immerse', 'ios', 'projects'],
        modules: ['dip', 'pod', 'immerse', 'ios', 'projects']
    },
    {
        id: 3,
        name: 'Milestone 3: Industry Ready Candidate',
        desc: 'Advanced sector projects, mentor coaching reviews, and corporate readiness training.',
        defaultModules: ['dip', 'pod', 'immerse', 'ios', 'projects'],
        modules: ['dip', 'pod', 'immerse', 'ios', 'projects']
    },
    {
        id: 4,
        name: 'Milestone 4: Corporate Residency / Placement',
        desc: 'Full corporate immersion, live client project delivery, and final portfolio defense.',
        defaultModules: ['corporate', 'projects'],
        modules: ['corporate', 'projects']
    }
];

var defaultPodQuestionsPool = [
    {
        id: 'pod_q1',
        title: 'According to today’s POD audio, what is the core driver of long-term habit consistency?',
        type: 'mcq',
        options: ['Intrinsic Identity Shift & Daily Micro-actions', 'External Pressure only', 'Random Motivation Spikes', 'Waiting for perfect conditions'],
        correctOption: 0,
        pts: 11
    },
    {
        id: 'pod_q2',
        title: 'What primary method was recommended for handling unexpected daily schedule disruptions?',
        type: 'mcq',
        options: ['Implementation Intentions (If-Then Planning)', 'Abandoning the week goal', 'Skipping without reflection', 'Immediate panic'],
        correctOption: 0,
        pts: 11
    },
    {
        id: 'pod_q3',
        title: 'Which mindset separates a Challenge Embracer from a passive student?',
        type: 'mcq',
        options: ['Viewing friction & feedback as fuel for growth', 'Avoiding all challenging tasks', 'Seeking quick shortcuts', 'Focusing solely on certificates'],
        correctOption: 0,
        pts: 11
    },
    {
        id: 'pod_q4',
        title: 'In deep focus execution, what is the recommended minimum uninterrupted time block?',
        type: 'mcq',
        options: ['10 minutes', '30 to 45 minutes', '4 hours without water', '2 minutes'],
        correctOption: 1,
        pts: 11
    },
    {
        id: 'pod_q5',
        title: 'How does daily reflection with cMPLi Dip amplify retention & skill compounding?',
        type: 'mcq',
        options: ['Reinforces cognitive synthesis by over 3x', 'Has no measurable outcome', 'Replaces practical action', 'Slows down progress'],
        correctOption: 0,
        pts: 11
    },
    {
        id: 'pod_q6',
        title: 'What is the primary function of cMPLi Learning Currencies (LCs)?',
        type: 'mcq',
        options: ['Quantify consistency, effort compliance, and unlock milestone promotions', 'Only a decorative badge', 'A penalty counter', 'Random rewards'],
        correctOption: 0,
        pts: 11
    },
    {
        id: 'pod_q7',
        title: 'Summarize in 1-2 sentences how today’s podcast theme applies directly to your milestone journey:',
        type: 'text',
        options: [],
        pts: 11
    }
];

var projects = [
    { 
        id: 'SPORT-FIN', sector: 'Sportstech', spec: 'Finance', code: '[SPORT]', 
        title: 'Event Unit-Economics Model: 2,000-participant fitness race', 
        diff: 'Intermediate', duration: '1 week', pts: 400,
        desc: 'Build a unit-economics model in Excel for a 2,000-participant fitness race in a Tier-2 city. Factor in tiered ticket pricing, venue leasing, timing-chip costs, and marketing spend.',
        deliv: 'Completed Excel model (.xlsx), 2-slide PDF executive summary'
    },
    { 
        id: 'SPORT-HR', sector: 'Sportstech', spec: 'HR', code: '[SPORT]', 
        title: 'Trainer Upskilling Plan for Functional Fitness Racing', 
        diff: 'Beginner', duration: '1 week', pts: 500,
        desc: 'Conduct a gap-analysis survey with 10 local gym trainers. Map their existing training capabilities against the specialized coaching skills required for functional racing.',
        deliv: 'Survey Data Summary (PDF) + 4-Week Training Module Document'
    },
    { 
        id: 'SPORT-MKT', sector: 'Sportstech', spec: 'Marketing', code: '[SPORT]', 
        title: 'Local Conversion Campaign for Ticketed Fitness Events', 
        diff: 'Intermediate', duration: '1 week', pts: 300,
        desc: 'Interview 15 regular gym-goers in your city to identify adoption difficulties regarding ticketed sports events and design a conversion-focused digital campaign.',
        deliv: 'Segmentation Model (.xlsx) + Campaign Deck (PDF)'
    },
    { 
        id: 'MARTECH-MKT', sector: 'MarTech', spec: 'Marketing', code: '[MARTECH]', 
        title: 'Retail Gap Analysis: Ingredient Claims vs Consumer Behavior', 
        diff: 'Intermediate', duration: '1 week', pts: 350,
        desc: 'Visit 5 retail outlets to evaluate if consumers verify ingredient claims online via smartphones before purchasing versus relying on physical shelf displays.',
        deliv: 'Field Study Report & Synthesis Deck (PDF)'
    },
    { 
        id: 'FINTECH-DA', sector: 'Fintech', spec: 'Data Analytics', code: '[FINTECH]', 
        title: 'Deposit vs Credit Growth Regional Cluster Analysis', 
        diff: 'Intermediate', duration: '1 week', pts: 400,
        desc: 'Analyze public banking datasets to identify low-deposit, high-credit demand regional clusters using Excel pivot modeling and data synthesis.',
        deliv: 'Excel Analysis Model (.xlsx) + Findings Deck'
    },
    { 
        id: 'AI-EXEC-01', sector: 'AI & Automation', spec: 'General Management', code: '[AI-EXEC]', 
        title: 'Enterprise Workflow Automation & AI Implementation Blueprint', 
        diff: 'Advanced', duration: '2 weeks', pts: 600,
        desc: 'Design an end-to-end AI agent workflow architecture for an SME business to automate customer support triage and data processing.',
        deliv: 'System Architecture Document (PDF) + Video Demo'
    }
];

if (typeof window !== 'undefined') {
    window.ALL_PLATFORM_MODULES = ALL_PLATFORM_MODULES;
    window.milestoneConfig = milestoneConfig;
    window.defaultPodQuestionsPool = defaultPodQuestionsPool;
    window.projects = projects;
}

// data.js
const projects = [
    // --- SPORTSTECH SECTOR ---
    { 
        id: 'SPORT-FIN', sector: 'Sportstech', spec: 'Finance', code: '[SPORT]', 
        title: 'Event Unit-Economics Model: 2,000-participant fitness race[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 400,
        desc: 'Build a unit-economics model in Excel for a 2,000-participant fitness race in a Tier-2 city. Factor in tiered ticket pricing, venue leasing, timing-chip costs, and marketing spend to calculate the break-even point and net profit margin under varying brand sponsorship levels[cite: 1].',
        context: 'Demonstrates commercial viability of experiential fitness events; links pricing, sponsorship and participant acquisition to profitability[cite: 3].',
        prereq: 'Basic Excel skills (SUM, IF, VLOOKUP/PIVOT), familiarity with unit-economics concepts[cite: 3].',
        steps: ['Phase 0 (Setup): Download starter Excel with cost line-items[cite: 3]', 'Phase 1 (Assumptions): Validate venue, timing-chip, and photographer costs[cite: 3]', 'Phase 2 (Modeling): Build per-participant revenue streams and sponsorship scenarios[cite: 3]', 'Phase 3 (Sensitivity): Run 3 scenarios and sensitivity table[cite: 3]', 'Phase 4: Submit executive summary[cite: 3]'],
        tech: 'MS Excel, Financial Modeling, Google Sheets[cite: 3]',
        deliv: 'Completed Excel model (.xlsx), 2-slide PDF executive summary[cite: 3]',
        rubric: 'Problem framing (20), Model correctness (30), Scenario analysis (30), Insight (20)[cite: 3]'
    },
    { 
        id: 'SPORT-HR', sector: 'Sportstech', spec: 'HR', code: '[SPORT]', 
        title: 'Trainer Upskilling Plan for Functional Fitness Racing[cite: 3]', 
        diff: 'Beginner', duration: '1 week', pts: 500,
        desc: 'Conduct a gap-analysis survey with 10 local gym trainers. Map their existing training capabilities against the specialized coaching skills required for functional fitness racing (e.g., Hyrox/Yoddha prep), and design a 4-week trainer upskilling module[cite: 1].',
        context: 'Organizers have successfully converted daily routines into highly social sport-cations, requiring specialized coaching[cite: 1].',
        prereq: 'Understanding of TNA (Training Needs Analysis) and survey design.',
        steps: ['Phase 1: Design gap-analysis questionnaire[cite: 1]', 'Phase 2: Survey 10 local trainers[cite: 1]', 'Phase 3: Identify core skill gaps for functional racing[cite: 1]', 'Phase 4: Draft 4-week module[cite: 1]'],
        tech: 'Google Forms, Excel (Data Analysis), Word',
        deliv: 'Survey Data Summary (PDF) + 4-Week Training Module Document',
        rubric: 'Survey Design (30), Data Synthesis (30), Module Quality (40)'
    },
    { 
        id: 'SPORT-MKT', sector: 'Sportstech', spec: 'Marketing', code: '[SPORT]', 
        title: 'Local Conversion Campaign for Ticketed Fitness Events[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 300,
        desc: 'Interview 15 regular gym-goers in your city to identify adoption difficulties regarding ticketed sports events. Use basic Excel data modeling to segment prospective racers and design a hyper-local, conversion-focused digital campaign[cite: 1].',
        context: 'Consumers pay nearly Rs.9,300 in entry fees, requiring strong localized digital funnels[cite: 1].',
        prereq: 'Basic marketing funnel concepts, interview techniques.',
        steps: ['Phase 1: Conduct 15 user interviews[cite: 1]', 'Phase 2: Data modeling and segmentation in Excel[cite: 1]', 'Phase 3: Design campaign structure[cite: 1]', 'Phase 4: Create hyper-local ad copy[cite: 1]'],
        tech: 'Excel Modeling, Digital Campaign Strategy',
        deliv: 'Segmentation Model (.xlsx) + Campaign Deck (PDF)',
        rubric: 'Interview Quality (20), Segmentation (40), Campaign Strategy (40)'
    },
    {
        id: 'SPORT-SCM', sector: 'Sportstech', spec: 'SCM', code: '[SPORT]', 
        title: 'Equipment Supply Chain for a 8-Station Arena[cite: 3]', 
        diff: 'Intermediate', duration: '2 weeks', pts: 600,
        desc: 'Map out the end-to-end equipment supply chain for setting up an 8-workstation functional fitness arena. Identify potential logistics bottlenecks in moving heavy equipment across non-metro regions and propose a cost-effective regional vendor model[cite: 1].',
        context: 'Logistics bottlenecks can derail events in expanding Tier-2 markets[cite: 1].',
        prereq: 'Process mapping, vendor management basics.',
        steps: ['Phase 1: Itemize 8-station requirements[cite: 1]', 'Phase 2: Map end-to-end transport[cite: 1]', 'Phase 3: Identify Tier-2 bottlenecks[cite: 1]', 'Phase 4: Propose vendor model[cite: 1]'],
        tech: 'Process Mapping Tools, Supply Chain Fundamentals',
        deliv: 'Supply Chain Map (PDF) + Vendor Strategy Report',
        rubric: 'Mapping Accuracy (30), Risk Identification (30), Vendor Strategy (40)'
    },
    {
        id: 'SPORT-DA', sector: 'Sportstech', spec: 'Data Analytics', code: '[SPORT]', 
        title: 'Participant Segmentation from Registration Data[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 200,
        desc: 'Scrape public social media and event registration data from recent regional fitness races. Perform a basic cluster analysis in Excel to profile high-spending participant segments based on age, location, and gear preferences[cite: 1].',
        context: 'Activewear brands capture immense demand through data-driven targeting[cite: 1].',
        prereq: 'Data scraping, Excel cluster analysis, data cleaning.',
        steps: ['Phase 1: Scrape social/registration data[cite: 1]', 'Phase 2: Clean datasets[cite: 1]', 'Phase 3: Perform Excel cluster analysis[cite: 1]', 'Phase 4: Build segment profiles[cite: 1]'],
        tech: 'Python/Octoparse, Excel Pivot Tables, Cluster Analysis',
        deliv: 'Cleaned Dataset (.xlsx) + Segment Dashboard',
        rubric: 'Data Quality (30), Analytical Accuracy (40), Visual Output (30)'
    },
    {
        id: 'SPORT-GM', sector: 'Sportstech', spec: 'General Management', code: '[SPORT]', 
        title: 'Mini-Fitness League Partnership Pitch[cite: 3]', 
        diff: 'Intermediate', duration: '2 weeks', pts: 350,
        desc: 'Visit 3 local independent fitness studios to pitch a co-branded "mini-fitness league." Negotiate partnership terms, structure a profit-sharing model between the gyms and event company, and outline a 30-day execution roadmap[cite: 1].',
        context: 'Partnerships build the ecosystem driving event monetization[cite: 1].',
        prereq: 'B2B Sales strategy, partnership negotiation.',
        steps: ['Phase 1: Identify and pitch 3 studios[cite: 1]', 'Phase 2: Draft partnership terms[cite: 1]', 'Phase 3: Structure profit-sharing[cite: 1]', 'Phase 4: Create 30-day roadmap[cite: 1]'],
        tech: 'Business Development, Financial Structuring, Project Management',
        deliv: 'Pitch Deck (PDF) + Partnership Term Sheet',
        rubric: 'Pitch Quality (30), Financial Model (40), Operational Roadmap (30)'
    },

    // --- MARTECH / CONSUMER INSIGHTS SECTOR ---
    {
        id: 'MARTECH-MKT', sector: 'MarTech', spec: 'Marketing', code: '[MARTECH]', 
        title: 'Retail Gap Analysis: Ingredient Claims vs Behavior[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Visit 5 local retail outlets to interview store managers and 10 shoppers purchasing skincare products; conduct a gap analysis evaluating if consumers check online ingredient claims on smartphones before buying versus physical store shelf displays[cite: 1].',
        context: 'Indian consumers are moving away from impulse-driven browsing toward intent-led, conscious decision-making[cite: 1].',
        prereq: 'Field research skills, qualitative data synthesis.',
        steps: ['Phase 1: Secure retail interviews[cite: 1]', 'Phase 2: Observe and interview 10 shoppers[cite: 1]', 'Phase 3: Compare digital vs physical trust[cite: 1]', 'Phase 4: Formulate gap analysis[cite: 1]'],
        tech: 'Omnichannel Marketing, Field Research',
        deliv: 'Field Study Report (PDF)',
        rubric: 'Research Depth (40), Gap Synthesis (30), Formatting (30)'
    },
    {
        id: 'MARTECH-FIN', sector: 'MarTech', spec: 'Finance', code: '[MARTECH]', 
        title: 'ROI Model for Senior-Citizen Health Program[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Using Excel, build a 3-year ROI and payback period financial model for a local fitness facility introducing a dedicated "Senior Citizen Health & Mobility" program driven by surging regional search intent[cite: 1].',
        context: 'Search intent acts as a real-time demand-sensing mechanism for CapEx investments[cite: 1].',
        prereq: 'ROI formulas, Payback Period calculations, NPV basics.',
        steps: ['Phase 1: Estimate CapEx for new program[cite: 1]', 'Phase 2: Project search-intent driven revenues[cite: 1]', 'Phase 3: Build 3-year model[cite: 1]', 'Phase 4: Calculate payback period[cite: 1]'],
        tech: 'Financial Modeling, Excel',
        deliv: '3-Year Financial Model (.xlsx)',
        rubric: 'Formula Accuracy (40), Assumptions Logic (40), Formatting (20)'
    },
    {
        id: 'MARTECH-HR', sector: 'MarTech', spec: 'HR', code: '[MARTECH]', 
        title: 'Corporate Upskilling vs Burnout Initiative Plan[cite: 3]', 
        diff: 'Beginner', duration: '1 week', pts: 75,
        desc: 'Survey 15 corporate employees across local firms regarding their interest in employer-funded AI upskilling versus burnout-prevention initiatives, evaluating adoption hurdles, training preferences, and budget allocations in Excel[cite: 1].',
        context: 'Employees balance AI upskilling (+49%) with occupational burnout research (+86%)[cite: 1].',
        prereq: 'Survey design, basic HR policy understanding.',
        steps: ['Phase 1: Design dual-focus survey[cite: 1]', 'Phase 2: Deploy to 15 employees[cite: 1]', 'Phase 3: Analyze adoption hurdles[cite: 1]', 'Phase 4: Draft recommendation plan[cite: 1]'],
        tech: 'Survey Tools, Data Synthesis',
        deliv: 'Survey Analysis Deck (PDF)',
        rubric: 'Survey Quality (30), Analysis (40), Recommendations (30)'
    },
    {
        id: 'MARTECH-SCM', sector: 'MarTech', spec: 'SCM', code: '[MARTECH]', 
        title: 'Inventory Response Map to Search Spikes[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Interview 3 regional consumer electronics or packaged goods distributors to analyze how inventory stocking responds to sudden localized search demand spikes (e.g., air purifiers) and map last-mile fulfillment bottlenecks[cite: 1].',
        context: 'Enterprises use demand-sensing to adjust inventory allocation before shifts surface in sales[cite: 1].',
        prereq: 'Inventory management concepts, supply chain mapping.',
        steps: ['Phase 1: Secure distributor interviews[cite: 1]', 'Phase 2: Analyze stocking responses[cite: 1]', 'Phase 3: Map last-mile bottlenecks[cite: 1]', 'Phase 4: Create response framework[cite: 1]'],
        tech: 'Inventory Analytics, Process Mapping',
        deliv: 'Bottleneck Map & Strategy Report (PDF)',
        rubric: 'Interview Depth (30), Process Map Accuracy (40), Solution Logic (30)'
    },
    {
        id: 'MARTECH-DA', sector: 'MarTech', spec: 'Data Analytics', code: '[MARTECH]', 
        title: 'Google Trends Demand Forecast Dashboard[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Extract publicly available Google Trends data for a niche keyword (e.g., "Gita GPT" or "parental control app") over 12 months, clean and query the dataset using Excel, SQL, and visualization tools, and construct a demand forecasting dashboard[cite: 1].',
        context: 'Candidates showcase data literacy by translating search intelligence into strategy[cite: 1].',
        prereq: 'Google Trends API export, SQL, Data Visualization.',
        steps: ['Phase 1: Extract 12-month data[cite: 1]', 'Phase 2: Clean data via SQL/Excel[cite: 1]', 'Phase 3: Build forecast logic[cite: 1]', 'Phase 4: Design dashboard[cite: 1]'],
        tech: 'SQL, Tableau/PowerBI, Excel',
        deliv: 'Forecasting Dashboard (Link/PDF) + SQL Scripts',
        rubric: 'Data Cleanliness (30), Forecast Accuracy (40), Visual UX (30)'
    },
    {
        id: 'MARTECH-GM', sector: 'MarTech', spec: 'General Management', code: '[MARTECH]', 
        title: 'Monetizing Offline Experiences Field Study[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Conduct a field study by interviewing 5 local café owners or event organizers to analyze how they monetize offline social experiences (live music, craft workshops), detailing key operational costs, pricing structures, and customer acquisition strategies[cite: 1].',
        context: 'Digital fatigue drives offline event monetization strategies[cite: 1].',
        prereq: 'Cost-structure analysis, pricing strategies.',
        steps: ['Phase 1: Identify target businesses[cite: 1]', 'Phase 2: Interview regarding ops costs and pricing[cite: 1]', 'Phase 3: Analyze CAC (Customer Acquisition Cost)[cite: 1]', 'Phase 4: Synthesize operational model[cite: 1]'],
        tech: 'Business Operations, Financial Analysis',
        deliv: 'Operational Synthesis Report (PDF)',
        rubric: 'Field Data Quality (30), Financial Synthesis (40), Business Insight (30)'
    },

    // --- FINTECH & BANKING SECTOR ---
    {
        id: 'FINTECH-FIN', sector: 'Fintech', spec: 'Finance', code: '[FINTECH]', 
        title: 'MSME Credit Preference Comparative Analysis[cite: 3]', 
        diff: 'Beginner', duration: '1 week', pts: 75,
        desc: 'Visit two local MSME business owners and conduct a brief structured interview comparing their preference for bank working capital limits versus NBFC or vendor credit based on processing speed, collateral requirements, and interest rates[cite: 1].',
        context: 'Commercial banking credit is moving decisively toward MSMEs[cite: 1].',
        prereq: 'Understanding of working capital, NBFCs vs Commercial Banks.',
        steps: ['Phase 1: Structure interview matrix[cite: 1]', 'Phase 2: Interview 2 MSMEs[cite: 1]', 'Phase 3: Compare rate vs collateral vs speed[cite: 1]', 'Phase 4: Draft analysis[cite: 1]'],
        tech: 'Credit Analysis, Market Research',
        deliv: 'Comparative Credit Analysis Report (PDF)',
        rubric: 'Data Collection (30), Comparative Logic (40), Presentation (30)'
    },
    {
        id: 'FINTECH-HR', sector: 'Fintech', spec: 'HR', code: '[FINTECH]', 
        title: 'Incentive Plan to Drive CASA Deposits[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Create a 1-page incentive and retention plan designed for entry-level Relationship Officers aimed at reducing frontline turnover while driving local CASA (Current Account Savings Account) deposit mobilization[cite: 1].',
        context: 'Banks face a deposit gap, requiring strong internal incentive structures for field agents[cite: 1].',
        prereq: 'Compensation structuring, HR retention strategies.',
        steps: ['Phase 1: Research RO turnover rates[cite: 1]', 'Phase 2: Design variable incentive tiers[cite: 1]', 'Phase 3: Build retention milestones[cite: 1]', 'Phase 4: Format 1-pager[cite: 1]'],
        tech: 'HR Policy Design, Performance Metrics',
        deliv: '1-Page Incentive Strategy (PDF)',
        rubric: 'Metric Alignment (40), Retention Strategy (30), Clarity (30)'
    },
    {
        id: 'FINTECH-MKT', sector: 'Fintech', spec: 'Marketing', code: '[FINTECH]', 
        title: 'Localized Pitch for Digital Loan Sign-ups[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Survey 5 local retail shopkeepers to identify their main adoption barriers regarding digital MSME loan applications, and draft a 3-step localized promotional pitch to increase digital loan sign-ups[cite: 1].',
        context: 'Digital loan adoption faces localized trust and UX barriers[cite: 1].',
        prereq: 'Customer objection handling, copywriting.',
        steps: ['Phase 1: Survey adoption barriers[cite: 1]', 'Phase 2: Categorize objections[cite: 1]', 'Phase 3: Draft 3-step pitch[cite: 1]', 'Phase 4: Finalize localized messaging[cite: 1]'],
        tech: 'Consumer Psychology, Sales Copywriting',
        deliv: 'Objection Matrix & Pitch Deck (PDF)',
        rubric: 'Barrier Identification (30), Pitch Effectiveness (40), Local Context (30)'
    },
    {
        id: 'FINTECH-SCM', sector: 'Fintech', spec: 'SCM', code: '[FINTECH]', 
        title: 'Supplier Interviews: Working Capital Impact Map[cite: 3]', 
        diff: 'Beginner', duration: '1 week', pts: 75,
        desc: 'Interview 2 export-oriented small business owners or regional suppliers to map out how recent geopolitical uncertainties or shipping input price hikes have impacted their short-term working capital needs[cite: 1].',
        context: 'Macro-supply chain shocks instantly alter MSME working capital demands[cite: 1].',
        prereq: 'Supply chain macro-economics, working capital basics.',
        steps: ['Phase 1: Prepare interview guide[cite: 1]', 'Phase 2: Conduct supplier interviews[cite: 1]', 'Phase 3: Map supply shocks to cash flow[cite: 1]', 'Phase 4: Synthesize findings[cite: 1]'],
        tech: 'Supply Chain Finance, Qualitative Analysis',
        deliv: 'Impact Mapping Report (PDF)',
        rubric: 'Interview Quality (30), Cause-Effect Mapping (40), Clarity (30)'
    },
    {
        id: 'FINTECH-DA', sector: 'Fintech', spec: 'Data Analytics', code: '[FINTECH]', 
        title: 'Deposit vs Credit Growth Cluster Analysis[cite: 3]', 
        diff: 'Intermediate', duration: '1 week', pts: 100,
        desc: 'Using basic Excel functions (VLOOKUP, Pivot Tables), analyze a publicly available bank dataset comparing deposit growth versus credit growth across different regions to identify low-deposit, high-credit demand clusters[cite: 1].',
        context: 'Data drives institutional strategy to plug regional 300 bps deposit gaps[cite: 1].',
        prereq: 'Advanced Excel (VLOOKUP, Pivot, Conditional Formatting).',
        steps: ['Phase 1: Source regional banking data[cite: 1]', 'Phase 2: Use VLOOKUP to merge datasets[cite: 1]', 'Phase 3: Build Pivot Tables[cite: 1]', 'Phase 4: Identify demand clusters[cite: 1]'],
        tech: 'Excel, Data Mining, Financial Data Interpretation',
        deliv: 'Excel Dashboard (.xlsx) + Findings Summary',
        rubric: 'Excel Function Accuracy (40), Cluster Identification (40), Presentation (20)'
    },
    {
        id: 'FINTECH-GM', sector: 'Fintech', spec: 'General Management', code: '[FINTECH]', 
        title: 'Retail Consumer Study: Bank vs NBFC Drivers[cite: 3]', 
        diff: 'Beginner', duration: '1 week', pts: 75,
        desc: 'Survey 10 retail consumers in your city to benchmark their decision drivers when choosing between traditional banks and NBFCs for auto or personal loans[cite: 1].',
        context: 'Understanding consumer drivers dictates go-to-market strategies for lenders[cite: 1].',
        prereq: 'Market research, consumer behavior frameworks.',
        steps: ['Phase 1: Design driver framework[cite: 1]', 'Phase 2: Survey 10 consumers[cite: 1]', 'Phase 3: Benchmark responses[cite: 1]', 'Phase 4: Present strategic insights[cite: 1]'],
        tech: 'Consumer Research, Strategy Formulation',
        deliv: 'Strategic Insights Deck (PDF)',
        rubric: 'Framework Design (30), Benchmarking Quality (40), Strategic Insight (30)'
    },
    {
        id: 'FOODTECH-SCM', sector: 'FoodTech', spec: 'SCM', code: '[FOODTECH]', 
        title: 'Impact of Supply Chain Efficiency on Customer Experience[cite: 3]', 
        diff: 'Beginner', duration: '3 weeks', pts: 900,
        desc: 'This project aims to analyze how supply chain efficiency influences customer experience by examining key supply chain activities such as procurement, inventory management, warehousing, transportation, and order fulfillment. The study focuses on understanding how improvements in these areas affect customer satisfaction, product availability, delivery speed, order accuracy, and overall service quality. \n The project involves collecting and analyzing operational and customer-related data to identify relationships between supply chain performance and customer experience. Based on the findings, recommendations will be provided to improve supply chain efficiency and enhance customer satisfaction.[cite: 1].',
        context: 'In today, competitive business environment, customers expect fast delivery, accurate orders, product availability, and transparent order tracking. Organizations across industries such as retail, e-commerce, manufacturing, and FMCG rely on efficient supply chain operations to meet these expectations.[cite: 1].',
        prereq: 'Excel, SQL, PowerBI, Report Writing.',
        steps: ['Phase 1: Literature Review[cite: 1]', 'Phase 2: Problem Identification[cite: 1]', 'Phase 3: Data Collection[cite: 1]', 'Phase 4: Data Analysis[cite: 1]'],
        tech: 'Google forms, Microsoft Teams, Excel',
        deliv: 'Literature Review Document (.xlsx)',
        rubric: 'Formula Accuracy (40), Assumptions Logic (40), Formatting (20)'
    }
];
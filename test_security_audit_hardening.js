const http = require('http');

const PORT = 3000;

function request(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(body); } catch(e) { parsed = body; }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- STARTING COMPREHENSIVE SECURITY AUDIT & VERIFICATION ---');

    let passedCount = 0;
    let totalCount = 0;

    function assert(desc, condition) {
        totalCount++;
        if (condition) {
            console.log(`  [PASS] ${desc}`);
            passedCount++;
        } else {
            console.error(`  [FAIL] ${desc}`);
        }
    }

    // 1. Self-Registration Isolation
    console.log('\n1. Test Self-Registration Isolation & Pending Status:');
    const regRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/employers/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        companyName: 'Suspicious Corp',
        recruiterName: 'Mallory Malice',
        email: 'mallory@suspiciouscorp.io',
        phone: '9998887776',
        industry: 'Arbitrary'
    });

    assert('Registration succeeds with status: pending', regRes.status === 200 && regRes.body.status === 'pending');
    assert('Registration response does NOT disclose accessKey', regRes.body.accessKey === undefined);

    // Attempt candidate access with unapproved employer ID (if adversary guessed or scraped)
    const unapprovedAccess = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/employer/candidates?employerId=emp_unapproved_test',
        method: 'GET',
        headers: { 'x-employer-id': 'emp_unapproved_test' }
    });
    assert('Unapproved employer blocked from candidates (401 Unauthorized)', unapprovedAccess.status === 401);

    // 2. Pre-Seeded Employer Auth Check (No Header-Spoofing Bypass)
    console.log('\n2. Test Header-Spoofing Prevention on Candidate Discovery:');
    const spoofAttempt = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/employer/candidates',
        method: 'GET',
        headers: { 'x-employer-id': 'emp_blive_01' } // ID without secret key or session
    });
    assert('Mere possession of employerId rejected without session token (401)', spoofAttempt.status === 401);

    // Legitimate Recruiter Login via POST /api/auth/session with Strict Key Requirement
    console.log('\n3. Test Recruiter Strict Key Authentication:');
    
    // Recruiter attempt with bare OTP '1234' and NO employerKey -> MUST FAIL WITH 403!
    const bareOtpRecruiter = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        role: 'recruiter',
        loginId: 'talent@blive.co.in',
        otp: '1234' // No employerKey!
    });
    assert('Recruiter login with bare OTP 1234 rejected without access key (403 Forbidden)', bareOtpRecruiter.status === 403);

    // Recruiter attempt with invalid employerKey -> MUST FAIL WITH 403!
    const wrongKeyRecruiter = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        role: 'recruiter',
        loginId: 'talent@blive.co.in',
        employerKey: 'wrong_unauthorized_key'
    });
    assert('Recruiter login with incorrect key rejected (403 Forbidden)', wrongKeyRecruiter.status === 403);

    // Retrieve active employer key for testing
    const fs = require('fs');
    const storeData = JSON.parse(fs.readFileSync('./server_data/gamification_store.json', 'utf8'));
    const bliveEmp = storeData.employers.find(e => e.id === 'emp_blive_01');
    const validBliveKey = bliveEmp.accessKey;

    // Legitimate recruiter login with valid employerKey
    const recAuth = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        role: 'recruiter',
        loginId: 'talent@blive.co.in',
        employerKey: validBliveKey
    });
    assert('Recruiter login succeeds with valid organization accessKey', recAuth.status === 200 && recAuth.body.token && recAuth.body.token.startsWith('cmpli_sess_rec_'));
    const recToken = recAuth.body.token;

    // Authorized Candidate Query with Recruiter Session
    const candRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/employer/candidates',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${recToken}` }
    });
    assert('Candidate discovery authorized with valid recruiter session (200)', candRes.status === 200 && candRes.body.success);
    assert('Candidates returned in result', Array.isArray(candRes.body.candidates) && candRes.body.candidates.length > 0);

    const firstCand = candRes.body.candidates[0];
    assert('Candidate email is masked', firstCand.maskedEmail && firstCand.maskedEmail.includes('***') && !firstCand.email);
    assert('Candidate phone is masked', firstCand.maskedPhone && firstCand.maskedPhone.includes('***') && !firstCand.phone);
    assert('Candidate has valid Learn Agility Quotient (LQ®)', typeof firstCand.lqScore === 'number' && firstCand.lqScore >= 30);

    // 4. Telemetry Event Injection Prevention
    console.log('\n4. Test Telemetry Event Security:');
    const unauthTelemetry = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/telemetry/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        studentId: firstCand.id,
        action: 'profile_view',
        metadata: { fake: true }
    });
    assert('Unauthenticated profile_view rejected with 403 Forbidden', unauthTelemetry.status === 403);

    // Authorized Telemetry from Verified Recruiter
    const authTelemetry = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/telemetry/event',
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${recToken}`
        }
    }, {
        studentId: firstCand.id,
        campusId: firstCand.campusId,
        action: 'profile_view',
        metadata: { inspectionNote: 'High LQ Score Review' }
    });
    assert('Verified recruiter profile_view accepted (200 OK)', authTelemetry.status === 200 && authTelemetry.body.success);

    // 5. Student Career-Views IDOR Protection
    console.log('\n5. Test Student Career Views IDOR Protection:');
    const unauthCareerViews = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/learner/career-views/${firstCand.id}`,
        method: 'GET'
    });
    assert('Unauthenticated career-views query rejected (403)', unauthCareerViews.status === 403);

    // Query with spoofed query param ?studentId=<id>
    const spoofCareerViews = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/learner/career-views/${firstCand.id}?studentId=${firstCand.id}`,
        method: 'GET'
    });
    assert('Spoofed query param ?studentId rejected (403)', spoofCareerViews.status === 403);

    // Authenticate legitimate student
    const studentAuth = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        role: 'customer',
        loginId: firstCand.id,
        otp: '1234'
    });
    assert('Legitimate student session issued', studentAuth.status === 200 && studentAuth.body.token);
    const studentToken = studentAuth.body.token;

    // Authorized student career-views query
    const studentViewsRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/learner/career-views/${firstCand.id}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert('Student views own career notifications successfully (200)', studentViewsRes.status === 200 && studentViewsRes.body.success);
    assert('Recorded profile view appears in student feed', studentViewsRes.body.data && Array.isArray(studentViewsRes.body.data.profileViews) && studentViewsRes.body.data.profileViews.length >= 1);

    // Student attempting to access another student's career views (IDOR attempt)
    const idorViews = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/learner/career-views/victim_student_999`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert('Student blocked from inspecting another student views (403)', idorViews.status === 403);

    // 6. Campus Placement Activity Protection
    console.log('\n6. Test Campus Placement Activity Protection:');
    const unauthCampusFeed = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/campus/placement-activity/cmp_sjec_mngl?partnerEmail=diana.roche@sjec.ac.in',
        method: 'GET'
    });
    assert('Spoofed query param ?partnerEmail on campus feed rejected (403)', unauthCampusFeed.status === 403);

    // Authenticate Campus Partner
    const partnerAuth = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        role: 'partner',
        loginId: 'diana.roche@sjec.ac.in',
        otp: '1234'
    });
    assert('Campus coordinator session issued', partnerAuth.status === 200 && partnerAuth.body.token);
    const partnerToken = partnerAuth.body.token;

    const authCampusFeed = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/campus/placement-activity/cmp_sjec_mngl',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${partnerToken}` }
    });
    assert('Coordinator views assigned campus placement activity (200)', authCampusFeed.status === 200 && authCampusFeed.body.success);

    // Coordinator attempting to access another campus
    const crossCampusFeed = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/campus/placement-activity/cmp_pes_bengaluru',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${partnerToken}` }
    });
    assert('Coordinator blocked from inspecting unassigned campus (403)', crossCampusFeed.status === 403);

    // 7. Creator Admin Secret Security
    console.log('\n7. Test Creator Admin Security:');
    const unauthCreator = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/management/employers',
        method: 'GET'
    });
    assert('Unauthenticated management/employers query rejected (403)', unauthCreator.status === 403);

    const crtAuth = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        role: 'creator',
        loginId: 'cmplibesai@gmail.com',
        otp: '1234'
    });
    assert('Creator session token issued', crtAuth.status === 200 && crtAuth.body.token);
    const crtToken = crtAuth.body.token;

    // Use creator session token to access creator-gated endpoint
    const creatorAccess = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/management/employers',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${crtToken}` }
    });
    assert('Creator session token grants authorized access to /api/management/employers (200 OK)', creatorAccess.status === 200 && creatorAccess.body.success && Array.isArray(creatorAccess.body.employers));

    console.log(`\n=== SUMMARY: ${passedCount}/${totalCount} ASSERTIONS PASSED ===`);
    if (passedCount === totalCount) {
        console.log('✅ ALL SECURITY HARDENING AND RBAC CONTROLS VERIFIED!');
    } else {
        console.error('❌ SOME CHECKS FAILED');
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});

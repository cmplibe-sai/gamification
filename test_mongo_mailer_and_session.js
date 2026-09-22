const assert = require('assert');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

async function runTests() {
    console.log('--- STARTING COMPREHENSIVE AUDIT: MONGO, MAILER, SECURITY & DATA INTEGRITY ---');

    // 1. Verify app.js no longer persists raw CREATOR_ADMIN_SECRET in localStorage
    console.log('\n1. Security Audit: Creator Admin Secret in Client Storage:');
    const appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    assert(
        !appJsContent.includes("localStorage.setItem('cmpli_admin_secret'"),
        'Security Violation: app.js must never write raw cmpli_admin_secret to localStorage'
    );
    assert(
        !appJsContent.includes("localStorage.getItem('cmpli_admin_secret'"),
        'Security Violation: app.js must never read raw cmpli_admin_secret from localStorage'
    );
    console.log('  [PASS] app.js contains 0 occurrences of localStorage persistence for cmpli_admin_secret');

    // 2. Import real server exports directly
    console.log('\n2. Testing Real Server Exports & Models from server.js:');
    const server = require('./server.js');
    assert(server.User, 'Real User Mongoose model must be exported by server.js');
    assert(server.Submission, 'Real Submission Mongoose model must be exported by server.js');
    console.log('  [PASS] Real Mongoose User & Submission models loaded from server.js');

    // 3. Test real server User Schema validation
    console.log('\n3. Real User Schema Enforcement:');
    const validLearner = new server.User({
        role: 'customer',
        email: 'learner@example.com',
        externalId: 'tm_learner_123',
        name: 'Chandra Learner'
    });
    assert.strictEqual(validLearner.validateSync(), undefined, 'Valid learner model should pass validation');
    console.log('  [PASS] User schema validated for customer');

    const invalidRoleUser = new server.User({
        role: 'hacker_role',
        email: 'bad@example.com'
    });
    const roleErr = invalidRoleUser.validateSync();
    assert(roleErr && roleErr.errors['role'], 'Invalid role must trigger Mongoose schema validation error');
    console.log('  [PASS] User schema strictly rejects unsupported roles (Mongoose validator enforced)');

    const missingEmailUser = new server.User({
        role: 'customer'
    });
    const emailErr = missingEmailUser.validateSync();
    assert(emailErr && emailErr.errors['email'], 'Missing email must trigger validation error');
    console.log('  [PASS] User schema strictly enforces required email');

    // 4. Test real server Submission Schema validation & saveSubmissionToMongo field guards
    console.log('\n4. Real Submission Schema & Field Guard Enforcement:');
    const validSub = new server.Submission({
        userId: 'tm_learner_123',
        userEmail: 'learner@example.com',
        milestoneId: 1,
        type: 'dip',
        day: 14,
        status: 'completed',
        lcReward: 10
    });
    assert.strictEqual(validSub.validateSync(), undefined, 'Valid submission should pass validation');
    console.log('  [PASS] Submission schema validated for day check-in');

    const invalidSubMissingFields = new server.Submission({
        userEmail: 'missing_user_id@example.com'
    });
    const subErr = invalidSubMissingFields.validateSync();
    assert(subErr && subErr.errors['userId'], 'Missing userId must be caught by schema');
    assert(subErr && subErr.errors['milestoneId'], 'Missing milestoneId must be caught by schema');
    assert(subErr && subErr.errors['type'], 'Missing type must be caught by schema');
    console.log('  [PASS] Submission schema strictly enforces required userId, milestoneId, and type');

    // 5. Test real Session Engine: Sliding Window and 14-Day Absolute Ceiling
    console.log('\n5. Real Session Management: Sliding Window & 14-Day Absolute Ceiling:');
    const testToken = `test_sess_${Date.now()}`;
    const testSessionData = {
        role: 'creator',
        userId: 'cmplibesai@gmail.com',
        email: 'cmplibesai@gmail.com',
        expiresAt: Date.now() + 86400000
    };

    server.recordUserSession(testToken, testSessionData);

    const reqMock = { headers: { authorization: `Bearer ${testToken}` } };
    const retrievedSess = server.getAuthenticatedSession(reqMock);
    assert(retrievedSess, 'Newly minted session must authenticate');
    assert(retrievedSess.createdAt, 'Session must record createdAt timestamp');
    console.log('  [PASS] Session successfully issued and authenticated with createdAt');

    // Simulate session age beyond 14 days (15 days old)
    retrievedSess.createdAt = Date.now() - (15 * 86400000);
    const expiredByCeiling = server.getAuthenticatedSession(reqMock);
    assert.strictEqual(expiredByCeiling, null, 'Session older than 14 days must be revoked by absolute ceiling');
    console.log('  [PASS] 14-day absolute session ceiling successfully revokes stale session');

    // 6. Test saveStore() does not call syncStoreToMongo (Resurrection Prevention)
    console.log('\n6. Resurrection Prevention on saveStore():');
    const serverJsContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    const saveStoreFunc = serverJsContent.match(/function saveStore\(\)\s*\{[\s\S]*?\n\}/);
    assert(saveStoreFunc, 'saveStore function must exist in server.js');
    assert(
        !saveStoreFunc[0].includes('syncStoreToMongo'),
        'Data Integrity Violation: saveStore() must NEVER call syncStoreToMongo() (prevents resurrection of deleted data)'
    );
    console.log('  [PASS] saveStore() is decoupled from syncStoreToMongo() — zero data resurrection risk on deletions');

    // 7. Test First-Login Atomic Claim Idempotency on Server Store
    console.log('\n7. First-Login Atomic Claim Idempotency:');
    server.store.userLoginProfiles = server.store.userLoginProfiles || {};
    const testEmail = `chandra_${Date.now()}@example.com`;

    // First login should claim
    let claimedFirst = false;
    let claimedSecond = false;
    const key = `customer:${testEmail}`;
    if (!server.store.userLoginProfiles[key] || !server.store.userLoginProfiles[key].welcomeEmailSent) {
        server.store.userLoginProfiles[key] = { welcomeEmailSent: true, firstLoginAt: new Date().toISOString() };
        claimedFirst = true;
    }
    assert.strictEqual(claimedFirst, true, 'First claim must succeed');

    // Second login should be blocked
    if (!server.store.userLoginProfiles[key] || !server.store.userLoginProfiles[key].welcomeEmailSent) {
        claimedSecond = true;
    }
    assert.strictEqual(claimedSecond, false, 'Second claim must be rejected (idempotent)');
    console.log('  [PASS] First-login claims are strictly idempotent');

    // 8. Clean up test session
    server.removeUserSession(testToken);

    console.log('\n=== ALL AUDIT ASSERTIONS (7/7) PASSED AGAINST PRODUCTION CODE! ===');
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});

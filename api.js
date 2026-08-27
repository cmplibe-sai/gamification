// api.js

// --- GLOBAL CONFIGURATION (Attached to window so it's readable everywhere) ---
window.APP_CONFIG = {
    tagmangoKey: 'tmk_6a548d2ad99f41ea005cfb8e.2c6260d65f3f09ca4f0a479d15081d98288cc2a6f9e51e191f5249cc0068b8f6',
    hostUrl: 'learn.cmplibe.com',
    baseUrl: 'https://api-prod-new.tagmango.com/api/v1',
    creatorId: '6682734e120c766a6e5af59c'
};

window.ADMIN_EMAILS = [
    'cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', 
    'cmplifutureadi@gmail.com', '6309764212', '9845421644'
];

// --- ENDPOINT REGISTRY ---
window.TagMangoAPI = {
    Gamification: {
        assignPoints: `${window.APP_CONFIG.baseUrl}/external/gamification/points/assign`,
        getLedger: (userId) => `${window.APP_CONFIG.baseUrl}/external/gamification/points/ledger/${userId}`,
        getCollectivePoints: (userId) => `${window.APP_CONFIG.baseUrl}/external/gamification/points/collective/${userId}`,
    },
    Courses: {
        getAll: `${window.APP_CONFIG.baseUrl}/external/courses`,
        getStudentOverview: (userId) => `${window.APP_CONFIG.baseUrl}/external/courses/${userId}/overview`,
        getReporting: (courseId) => `${window.APP_CONFIG.baseUrl}/external/courses/${courseId}/reporting`,
        getReportingStudents: (courseId) => `${window.APP_CONFIG.baseUrl}/external/courses/${courseId}/reporting/students`,
    },
    Users: {
        lookup: `${window.APP_CONFIG.baseUrl}/external/users/lookup`,
        getById: (userId) => `${window.APP_CONFIG.baseUrl}/external/users/${userId}`,
    },
    Mangos: {
        getAll: `${window.APP_CONFIG.baseUrl}/external/mangos`,
    },
    Subscriptions: {
        getByCreator: `${window.APP_CONFIG.baseUrl}/external/subscriptions/subscribers-by-creator/${window.APP_CONFIG.creatorId}`
    }
};

// --- AUTOMATED FETCH WRAPPER ---
window.fetchTagMango = async function(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.APP_CONFIG.tagmangoKey}`,
            'x-whitelabel-host': window.APP_CONFIG.hostUrl
        }
    };
    
    if (body) {
        if (method.toUpperCase() === 'GET') {
            // Browsers block GET requests with bodies. Convert body to query string (e.g. ?email=...)
            const params = new URLSearchParams(body).toString();
            endpoint += `?${params}`;
        } else {
            options.body = JSON.stringify(body);
        }
    }
    
    const response = await fetch(endpoint, options);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    
    return response.json();
};
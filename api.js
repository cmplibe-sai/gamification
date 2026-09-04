// api.js

// --- GLOBAL CONFIGURATION (Attached to window so it's readable everywhere) ---
window.APP_CONFIG = {
    hostUrl: 'learn.cmplibe.com',
    baseUrl: '/api/tagmango',
    creatorId: '6682734e120c766a6e5af59c'
};

window.ADMIN_EMAILS = [
    'cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', 
    'cmplifutureadi@gmail.com', '6309764212', '9845421644'
];

// Asynchronously sync config from backend Web Service if available
(async function syncBackendConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data.hostUrl) window.APP_CONFIG.hostUrl = data.hostUrl;
            if (data.creatorId) window.APP_CONFIG.creatorId = data.creatorId;
            if (Array.isArray(data.adminEmails) && data.adminEmails.length > 0) {
                window.ADMIN_EMAILS = data.adminEmails;
            }
        }
    } catch (e) {
        // Standalone/static fallback
    }
})();

// --- ENDPOINT REGISTRY (Proxied through backend - zero secrets in browser) ---
window.TagMangoAPI = {
    Gamification: {
        getCollectivePoints: (userId) => `/api/tagmango/points/${encodeURIComponent(userId)}`,
    },
    Mangos: {
        getAll: `/api/tagmango/mangos`,
    },
    Subscriptions: {
        getByCreator: `/api/tagmango/subscribers`
    }
};

// --- AUTOMATED FETCH WRAPPER (Calls secure server proxy) ---
window.fetchTagMango = async function(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        if (method.toUpperCase() === 'GET') {
            const params = new URLSearchParams(body).toString();
            endpoint += (endpoint.includes('?') ? '&' : '?') + params;
        } else {
            options.body = JSON.stringify(body);
        }
    }
    
    const response = await fetch(endpoint, options);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    
    return response.json();
};
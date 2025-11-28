

const BASE_URL = 'http://localhost:3009/api';
let token = '';
let userId = '';

async function testAuth() {
    console.log('🧪 Starting Auth Tests...');

    // 1. Signup
    console.log('\n1. Testing Signup...');
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test User',
            email: `test${Date.now()}@example.com`,
            password: 'password123',
            company: 'Test Corp'
        })
    });
    const signupData = await signupRes.json();
    if (signupRes.ok) {
        console.log('✅ Signup successful');
        token = signupData.token;
        userId = signupData.user.id;
    } else {
        console.error('❌ Signup failed:', signupData);
        return;
    }

    // 2. Validate Token
    console.log('\n2. Testing Token Validation...');
    const validateRes = await fetch(`${BASE_URL}/auth/validate`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (validateRes.ok) {
        console.log('✅ Token valid');
    } else {
        console.error('❌ Token validation failed');
    }

    // 3. Sync Push (Create Item)
    console.log('\n3. Testing Sync Push...');
    const pushRes = await fetch(`${BASE_URL}/sync/push`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            items: [{
                id: 'item-123',
                name: 'Test Item',
                price: 100,
                updated_at: new Date().toISOString()
            }]
        })
    });
    const pushData = await pushRes.json();
    if (pushRes.ok) {
        console.log('✅ Sync Push successful:', pushData);
    } else {
        console.error('❌ Sync Push failed:', pushData);
    }

    // 4. Logout
    console.log('\n4. Testing Logout...');
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (logoutRes.ok) {
        console.log('✅ Logout successful');
    } else {
        console.error('❌ Logout failed');
    }

    // 5. Validate Token After Logout (Should Fail)
    console.log('\n5. Testing Token After Logout...');
    const validateAfterRes = await fetch(`${BASE_URL}/auth/validate`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (validateAfterRes.status === 403) {
        console.log('✅ Token correctly invalidated (403 Forbidden)');
    } else {
        console.error('❌ Token still valid or wrong status:', validateAfterRes.status);
    }
}

testAuth().catch(console.error);

// Test script to verify password reset functionality
const testPasswordReset = async () => {
  const API_URL = 'http://localhost:4002';
  
  console.log('Testing password reset functionality...');
  
  try {
    // First, get a list of users to find a test user
    const usersResponse = await fetch(`${API_URL}/api/admin/users`, {
      credentials: 'include'
    });
    
    if (!usersResponse.ok) {
      console.log('❌ Cannot fetch users. Make sure you are logged in as admin.');
      return;
    }
    
    const usersData = await usersResponse.json();
    const testUser = usersData.users?.[0];
    
    if (!testUser) {
      console.log('❌ No users found to test with.');
      return;
    }
    
    console.log(`✅ Found test user: ${testUser.name} (ID: ${testUser.id})`);
    
    // Test password reset
    const resetResponse = await fetch(`${API_URL}/api/admin/users/${testUser.id}/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        new_password: 'TestPassword123!'
      })
    });
    
    if (resetResponse.ok) {
      const resetData = await resetResponse.json();
      console.log('✅ Password reset successful:', resetData.message);
    } else {
      const errorData = await resetResponse.json();
      console.log('❌ Password reset failed:', errorData.error);
      console.log('Response status:', resetResponse.status);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
};

// Run the test
testPasswordReset();
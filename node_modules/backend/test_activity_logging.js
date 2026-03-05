// Test script to verify service user activity logging
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4003/api', // Adjust port if needed
  withCredentials: true
});

async function testActivityLogging() {
  try {
    console.log('Testing Service User Activity Logging...\n');

    // First, try to login or get current user status
    console.log('1. Checking authentication status...');
    try {
      const authCheck = await api.get('/auth/me');
      console.log('✅ Already authenticated as:', authCheck.data.user?.name);
    } catch (error) {
      console.log('❌ Not authenticated. Please login first.');
      console.log('You can test this by:');
      console.log('1. Login to your frontend application');
      console.log('2. Then run this test script');
      return;
    }

    // Test fetching service users (should log a view activity)
    console.log('\n2. Testing GET /api/su/users (should log view activity)...');
    try {
      const response = await api.get('/su/users');
      console.log('✅ Successfully fetched service users:', response.data.length || 0, 'users');
    } catch (error) {
      console.log('❌ Failed to fetch service users:', error.response?.data?.error || error.message);
    }

    // Test fetching activity logs to see if the view was logged
    console.log('\n3. Checking activity logs...');
    try {
      const logsResponse = await api.get('/auth/activity-logs?limit=5');
      const logs = logsResponse.data.logs || [];
      console.log('✅ Recent activity logs:');
      logs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.action} - ${log.description} (${new Date(log.created_at).toLocaleString()})`);
      });
      
      // Check if we have service user related activities
      const suLogs = logs.filter(log => log.resource === 'service_users' || log.action.includes('service_user'));
      if (suLogs.length > 0) {
        console.log('✅ Found service user activities in logs!');
      } else {
        console.log('⚠️  No service user activities found in recent logs');
      }
    } catch (error) {
      console.log('❌ Failed to fetch activity logs:', error.response?.data?.error || error.message);
    }

    console.log('\n✅ Test completed! Check your Activity.jsx page to see the logs.');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testActivityLogging();
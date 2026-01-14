import axios from 'axios';

async function testPropertiesAPI() {
  try {
    console.log('🧪 Testing /api/hotels endpoint...\n');
    
    // Note: This would need actual authentication in real scenario
    // For testing, we'll just check if the endpoint responds
    
    const response = await axios.get('http://localhost:4002/api/hotels', {
      headers: {
        'Cookie': 'token=your-token-here'  // Would need real token
      },
      validateStatus: () => true  // Accept any status
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Response type: ${typeof response.data}`);
    
    if (response.status === 401) {
      console.log('\n⚠️  Need authentication (expected)');
      console.log('Backend is running and responding correctly');
    } else if (response.status === 200) {
      const hotels = response.data?.hotels || response.data;
      console.log(`\n✅ Success! Found ${hotels.length} properties`);
      console.log('\nFirst 5 properties:');
      hotels.slice(0, 5).forEach((h, idx) => {
        console.log(`  [${idx + 1}] ${h.name} (${h.code || 'N/A'})`);
      });
    } else {
      console.log(`\n⚠️  Unexpected status: ${response.status}`);
      console.log(response.data);
    }
    
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('❌ Backend server not running on port 4002');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
}

testPropertiesAPI();

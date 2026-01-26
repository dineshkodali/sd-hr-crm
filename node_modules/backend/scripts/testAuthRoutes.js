// Backend/scripts/testAuthRoutes.js
import express from 'express';

console.log('✅ Checking auth.js routes...\n');

try {
  const authModule = await import('../routes/auth.js');
  const router = authModule.default;
  
  console.log('✅ auth.js imported successfully');
  console.log('✅ Router type:', typeof router);
  
  // Get all routes from the router
  const routes = [];
  router.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      routes.push(`${methods} /api/auth${layer.route.path}`);
    }
  });
  
  console.log('\n📋 Available routes:');
  routes.forEach(route => {
    console.log(`  ${route}`);
  });
  
  // Check for authenticator routes
  const authenticatorRoutes = routes.filter(r => r.includes('authenticator'));
  console.log(`\n🔐 Authenticator routes found: ${authenticatorRoutes.length}`);
  authenticatorRoutes.forEach(route => {
    console.log(`  ✅ ${route}`);
  });
  
  if (authenticatorRoutes.length === 4) {
    console.log('\n✅ All authenticator routes are properly registered!');
  } else {
    console.log('\n⚠️  Expected 4 authenticator routes, found', authenticatorRoutes.length);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

process.exit(0);

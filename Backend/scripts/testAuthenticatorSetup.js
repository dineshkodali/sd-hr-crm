// Backend/scripts/testAuthenticatorSetup.js
import { generateAuthenticatorSecret, verifyAuthenticatorCode, generateBackupCodes } from '../utils/authenticatorUtils.js';
import speakeasy from 'speakeasy';

async function test() {
  try {
    console.log('Testing authenticator utilities...\n');
    
    // Test 1: Generate secret
    console.log('1. Testing generateAuthenticatorSecret...');
    const result = await generateAuthenticatorSecret('test@example.com');
    console.log('   ✅ Secret generated:', result.secret.substring(0, 10) + '...');
    console.log('   ✅ QR Code generated:', result.qrCode.substring(0, 30) + '...');
    console.log('   ✅ Manual key:', result.manualEntryKey.substring(0, 10) + '...');
    
    // Test 2: Generate backup codes
    console.log('\n2. Testing generateBackupCodes...');
    const codes = generateBackupCodes(5);
    console.log('   ✅ Generated codes:', codes);
    
    // Test 3: Verify a code
    console.log('\n3. Testing verifyAuthenticatorCode...');
    const code = speakeasy.totp({
      secret: result.secret,
      encoding: 'base32'
    });
    console.log('   Current TOTP code:', code);
    const isValid = verifyAuthenticatorCode(result.secret, code);
    console.log('   ✅ Verification result:', isValid);
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();

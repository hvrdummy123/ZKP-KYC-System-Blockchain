// Simulate what the frontend does
const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function debugFrontendHash() {
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;
    
    // Load userData from frontend's perspective
    const userData = JSON.parse(fs.readFileSync('./frontend/public/userData.json', 'utf-8'));
    const alice = userData.alice;
    
    console.log('===== FRONTEND SIMULATION =====');
    console.log('Raw data from JSON:');
    console.log('  aadhaarNumber:', alice.aadhaarNumber, '(type:', typeof alice.aadhaarNumber, ')');
    console.log('  birthYear:', alice.birthYear, '(type:', typeof alice.birthYear, ')');
    console.log('  birthMonth:', alice.birthMonth, '(type:', typeof alice.birthMonth, ')');
    console.log('  birthDay:', alice.birthDay, '(type:', typeof alice.birthDay, ')');
    console.log('  salt:', alice.salt, '(type:', typeof alice.salt, ')');
    
    // Simulate frontend's generateAadhaarHash function
    const hash1 = poseidon([
        BigInt(alice.aadhaarNumber),
        BigInt(alice.birthYear),
        BigInt(alice.birthMonth),
        BigInt(alice.birthDay),
        BigInt(alice.salt)
    ]);
    const frontendHash = F.toObject(hash1);
    
    console.log('\n===== HASH CALCULATION =====');
    console.log('BigInt conversions:');
    console.log('  BigInt(aadhaarNumber):', BigInt(alice.aadhaarNumber).toString());
    console.log('  BigInt(birthYear):', BigInt(alice.birthYear).toString());
    console.log('  BigInt(birthMonth):', BigInt(alice.birthMonth).toString());
    console.log('  BigInt(birthDay):', BigInt(alice.birthDay).toString());
    console.log('  BigInt(salt):', BigInt(alice.salt).toString());
    
    console.log('\nCalculated hash:', frontendHash.toString());
    
    // Expected hash from blockchain
    const expectedHash = '17339163881561796920924095202263300754820250546618423561400176550353894364893';
    console.log('Expected hash:  ', expectedHash);
    console.log('Match?', frontendHash.toString() === expectedHash);
}

debugFrontendHash().catch(console.error);

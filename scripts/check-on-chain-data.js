const hre = require("hardhat");
const fs = require('fs');
const { buildPoseidon } = require('circomlibjs');

async function main() {
  const [deployer, alice] = await hre.ethers.getSigners();
  
  // Load deployments
  const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
  
  // Load user data
  const userData = JSON.parse(fs.readFileSync('userData.json', 'utf8'));
  
  // Get AttesterContract
  const AttesterContract = await hre.ethers.getContractFactory("AttesterContract");
  const attester = AttesterContract.attach(deployments.attesterContract);
  
  console.log('\n=== Checking Alice\'s On-Chain Data ===');
  console.log('Alice address:', alice.address);
  
  // Get on-chain commitments
  const [aadhaarHash, secretHash, stateCommitment, genderCommitment] = 
    await attester.getPublicCommitments(alice.address);
  
  console.log('\n📋 On-Chain Commitments:');
  console.log('  Aadhaar Hash:', aadhaarHash.toString());
  console.log('  Secret Hash:', secretHash.toString());
  console.log('  State Commitment:', stateCommitment.toString());
  console.log('  Gender Commitment:', genderCommitment.toString());
  
  // Calculate what the commitments SHOULD be based on current userData.json
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  
  const aliceData = userData.alice;
  
  const calculatedGenderCommitment = poseidon([
    BigInt(aliceData.userGender),
    BigInt(aliceData.genderSalt)
  ]);
  
  const calculatedStateCommitment = poseidon([
    BigInt(aliceData.userState),
    BigInt(aliceData.stateSalt)
  ]);
  
  const calculatedSecretHash = poseidon([BigInt(aliceData.secret)]);
  
  console.log('\n🧮 Calculated from userData.json:');
  console.log('  Gender Commitment:', F.toString(calculatedGenderCommitment));
  console.log('  State Commitment:', F.toString(calculatedStateCommitment));
  console.log('  Secret Hash:', F.toString(calculatedSecretHash));
  
  console.log('\n✓ Matches:');
  console.log('  Gender:', F.toString(calculatedGenderCommitment) === genderCommitment.toString() ? '✅' : '❌');
  console.log('  State:', F.toString(calculatedStateCommitment) === stateCommitment.toString() ? '✅' : '❌');
  console.log('  Secret:', F.toString(calculatedSecretHash) === secretHash.toString() ? '✅' : '❌');
  
  console.log('\n📊 Alice\'s Data from userData.json:');
  console.log('  userGender:', aliceData.userGender);
  console.log('  genderSalt:', aliceData.genderSalt);
  console.log('  userState:', aliceData.userState);
  console.log('  stateSalt:', aliceData.stateSalt);
  console.log('  secret:', aliceData.secret);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

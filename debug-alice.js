const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deployments = JSON.parse(fs.readFileSync('./deployments.json', 'utf-8'));
    const attester = await ethers.getContractAt('AttesterContract', deployments.attesterContract);
    
    const alice = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    
    console.log('📋 Checking Alice\'s on-chain data:');
    console.log('Address:', alice);
    
    const card = await attester.aadhaarCards(alice);
    console.log('\nAadhaar Card:');
    console.log('  aadhaarHash:', card.aadhaarHash.toString());
    console.log('  secretHash:', card.secretHash.toString());
    console.log('  stateCommitment:', card.stateCommitment.toString());
    console.log('  genderCommitment:', card.genderCommitment.toString());
    console.log('  isActive:', card.isActive);
    console.log('  cardId:', card.cardId);
    
    const commitments = await attester.getPublicCommitments(alice);
    console.log('\nFrom getPublicCommitments():');
    console.log('  [0] aadhaarHash:', commitments[0].toString());
    console.log('  [1] secretHash:', commitments[1].toString());
    console.log('  [2] stateCommitment:', commitments[2].toString());
    console.log('  [3] genderCommitment:', commitments[3].toString());
    
    console.log('\n🔍 Expected (from proof):');
    console.log('  aadhaarHash: 17339163881561796920924095202263300754820250546618423561400176550353894364893');
    console.log('  secretHash: 8346004519189336520714884063015443145945024283667552552353334972680292096');
    
    console.log('\n✅ Match Analysis:');
    console.log('  aadhaarHash:', commitments[0].toString() === '17339163881561796920924095202263300754820250546618423561400176550353894364893' ? '✅ MATCH' : '❌ MISMATCH');
    console.log('  secretHash:', commitments[1].toString() === '8346004519189336520714884063015443145945024283667552552353334972680292096' ? '✅ MATCH' : '❌ MISMATCH');
}

main().catch(console.error);

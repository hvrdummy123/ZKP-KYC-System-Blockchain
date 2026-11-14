const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deployments = JSON.parse(fs.readFileSync('./deployments.json', 'utf-8'));
    const over18Verifier = await ethers.getContractAt('Over18Verifier', deployments.over18Verifier);
    
    const requestId = 2;
    const request = await over18Verifier.verificationRequests(requestId);
    
    console.log('📋 Verification Request #' + requestId + ':');
    console.log('  requester:', request.requester);
    console.log('  user:', request.user);
    console.log('  requestTimestamp:', request.requestTimestamp.toString());
    console.log('  isCompleted:', request.isCompleted);
    console.log('  result:', request.result);
    console.log('  fee:', ethers.formatEther(request.fee));
    
    console.log('\n🔍 Transaction sender: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Alice)');
    console.log('Match?', request.user.toLowerCase() === '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase() ? '✅ YES' : '❌ NO');
}

main().catch(console.error);

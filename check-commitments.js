const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deployments = JSON.parse(fs.readFileSync('./deployments.json', 'utf-8'));
    const attester = await ethers.getContractAt('AttesterContract', deployments.attesterContract);
    
    const alice = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const commitments = await attester.getPublicCommitments(alice);
    
    console.log('Alice commitments from contract:');
    console.log('  aadhaarHash:', commitments[0].toString());
    console.log('  secretHash:', commitments[1].toString());
    console.log('  stateCommitment:', commitments[2].toString());
    console.log('  genderCommitment:', commitments[3].toString());
    
    console.log('\nFrom transaction (public signals):');
    console.log('  [5] aadhaarHash:', '2075065735191062505285277019529394055644676577439248560099108226204746752975');
    console.log('  [6] secretHash:', '15610276349772874306403267300197137942430065535479283804412989421072242760833');
    
    console.log('\nMatch aadhaarHash?', commitments[0].toString() === '2075065735191062505285277019529394055644676577439248560099108226204746752975');
    console.log('Match secretHash?', commitments[1].toString() === '15610276349772874306403267300197137942430065535479283804412989421072242760833');
}

main().catch(console.error);

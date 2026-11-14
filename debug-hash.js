const ProofGenerator = require("./src/ProofGenerator");
const fs = require("fs");
const path = require("path");

async function debugHash() {
    const proofGenerator = new ProofGenerator();
    await proofGenerator.init();
    
    // Load userData.json
    const userData = JSON.parse(fs.readFileSync(path.join(__dirname, 'userData.json'), 'utf-8'));
    
    console.log("===== ALICE'S DATA =====");
    console.log("aadhaarNumber:", userData.alice.aadhaarNumber, typeof userData.alice.aadhaarNumber);
    console.log("birthYear:", userData.alice.birthYear, typeof userData.alice.birthYear);
    console.log("birthMonth:", userData.alice.birthMonth, typeof userData.alice.birthMonth);
    console.log("birthDay:", userData.alice.birthDay, typeof userData.alice.birthDay);
    console.log("salt:", userData.alice.salt, typeof userData.alice.salt);
    
    // Calculate hash the way backend does it
    const backendHash = proofGenerator.generateAadhaarHash(
        userData.alice.aadhaarNumber,
        userData.alice.birthYear,
        userData.alice.birthMonth,
        userData.alice.birthDay,
        parseInt(userData.alice.salt)  // Backend uses number
    );
    
    // Calculate hash the way frontend does it (with string salt)
    const frontendHash1 = proofGenerator.generateAadhaarHash(
        userData.alice.aadhaarNumber,
        userData.alice.birthYear,
        userData.alice.birthMonth,
        userData.alice.birthDay,
        userData.alice.salt  // Frontend might use string
    );
    
    console.log("\n===== HASH COMPARISON =====");
    console.log("Backend hash (with parseInt):", backendHash.toString());
    console.log("Frontend hash (with string):", frontendHash1.toString());
    console.log("Hashes match?", backendHash.toString() === frontendHash1.toString());
    
    // Now let's check what's on-chain
    const { ethers } = require("hardhat");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, 'deployments.json'), 'utf-8'));
    
    const AttesterABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/contracts/AttesterContract.sol/AttesterContract.json'), 'utf-8'));
    
    const [aadhaarOrg, alice] = await ethers.getSigners();
    
    const attesterContract = new ethers.Contract(
        deployments.attesterContract,
        AttesterABI.abi,
        alice
    );
    
    const [onChainAadhaarHash, onChainSecretHash, onChainStateCommitment, onChainGenderCommitment] = 
        await attesterContract.getPublicCommitments(alice.address);
    
    console.log("\n===== ON-CHAIN DATA =====");
    console.log("On-chain aadhaarHash:", onChainAadhaarHash.toString());
    console.log("Backend calculated hash:", backendHash.toString());
    console.log("Match?", onChainAadhaarHash.toString() === backendHash.toString());
}

debugHash().catch(console.error);

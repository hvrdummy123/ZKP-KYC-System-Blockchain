const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function completeGenderVerifications() {
    console.log("Users: Completing Gender Verifications with ZK Proofs\n");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
    const userData = JSON.parse(fs.readFileSync(path.join(__dirname, '../userData.json'), 'utf-8'));
    const requestData = JSON.parse(fs.readFileSync(path.join(__dirname, '../genderRequestData.json'), 'utf-8'));
    const [, alice, bob, company, charlie] = await ethers.getSigners();
     
    // Get the GenderVerifier contract instance
    const { genderVerifier } = await Utils.getContracts(deployments);

    const proofGenerator = new ProofGenerator();
    await proofGenerator.init();

    // --- Alice completes verification (SUCCESS - Female) ---
    console.log("Alice generating proof for gender verification...");
    const aliceGenderData = { userGender: userData.alice.userGender, genderSalt: userData.alice.genderSalt };
    const aliceResult = await proofGenerator.generateGenderProof(
        aliceGenderData, 
        userData.alice.secret, 
        requestData.alice.requestId, 
        requestData.alice.requester, 
        requestData.alice.requiredGender
    );
    
    if (!aliceResult.success) {
        console.error(" Failed to generate proof for Alice:", aliceResult.error);
        return;
    }
    
    const aliceFormattedProof = Utils.formatProofForSolidity(aliceResult.proof);
    const alicePublicSignals = aliceResult.publicSignals.map(p => p.toString());
    
    await genderVerifier.connect(alice).completeGenderVerification(
        requestData.alice.requestId, 
        aliceFormattedProof.pA, 
        aliceFormattedProof.pB, 
        aliceFormattedProof.pC, 
        alicePublicSignals
    );
    console.log(" Alice submitted her proof.");

    // --- Bob completes verification (SUCCESS - Male) ---
    console.log("\nBob generating proof for gender verification...");
    const bobGenderData = { userGender: userData.bob.userGender, genderSalt: userData.bob.genderSalt };
    const bobResult = await proofGenerator.generateGenderProof(
        bobGenderData, 
        userData.bob.secret, 
        requestData.bob.requestId, 
        requestData.bob.requester, 
        requestData.bob.requiredGender
    );
    
    if (!bobResult.success) {
        console.error(" Failed to generate proof for Bob:", bobResult.error);
        return;
    }
    
    const bobFormattedProof = Utils.formatProofForSolidity(bobResult.proof);
    const bobPublicSignals = bobResult.publicSignals.map(p => p.toString());
    
    await genderVerifier.connect(bob).completeGenderVerification(
        requestData.bob.requestId, 
        bobFormattedProof.pA, 
        bobFormattedProof.pB, 
        bobFormattedProof.pC, 
        bobPublicSignals
    );
    console.log(" Bob submitted his proof.");

    // --- Charlie completes verification (SUCCESS - Transgender) ---
    console.log("\nCharlie generating proof for gender verification...");
    const charlieGenderData = { userGender: userData.charlie.userGender, genderSalt: userData.charlie.genderSalt };
    const charlieResult = await proofGenerator.generateGenderProof(
        charlieGenderData, 
        userData.charlie.secret, 
        requestData.charlie.requestId, 
        requestData.charlie.requester, 
        requestData.charlie.requiredGender
    );
    
    if (!charlieResult.success) {
        console.error(" Failed to generate proof for Charlie:", charlieResult.error);
        return;
    }
    
    const charlieFormattedProof = Utils.formatProofForSolidity(charlieResult.proof);
    const charliePublicSignals = charlieResult.publicSignals.map(p => p.toString());
    
    await genderVerifier.connect(charlie).completeGenderVerification(
        requestData.charlie.requestId, 
        charlieFormattedProof.pA, 
        charlieFormattedProof.pB, 
        charlieFormattedProof.pC, 
        charliePublicSignals
    );
    console.log(" Charlie submitted their proof.");

    // --- Check results ---
    console.log("\nCompany checking verification results...");
    
    const aliceRequest = await genderVerifier.connect(company).getGenderVerificationRequest(requestData.alice.requestId);
    console.log(`Alice's result for Female: ${aliceRequest.result} (Completed: ${aliceRequest.isCompleted}, Expected: true)`);
    
    const bobRequest = await genderVerifier.connect(company).getGenderVerificationRequest(requestData.bob.requestId);
    console.log(`Bob's result for Male: ${bobRequest.result} (Completed: ${bobRequest.isCompleted}, Expected: true)`);
    
    const charlieRequest = await genderVerifier.connect(company).getGenderVerificationRequest(requestData.charlie.requestId);
    console.log(`Charlie's result for Transgender: ${charlieRequest.result} (Completed: ${charlieRequest.isCompleted}, Expected: true)`);
}

if (require.main === module) {
    completeGenderVerifications().catch(console.error);
}

const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

// Simple mapping for demo purposes. In reality, these would be official codes.
const stateMapping = { "Maharashtra": 27, "Karnataka": 29, "Delhi": 7 };

async function issueAadhaarCards() {
    console.log("Aadhaar Org: Issuing credentials with age and state data\n");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
    const [aadhaarOrg, alice, bob, company, charlie] = await ethers.getSigners();
    const { attesterContract } = await Utils.getContracts(deployments);
    const proofGenerator = new ProofGenerator();
    await proofGenerator.init();

    // --- Alice (Over 18, Maharashtra) ---
    const aliceData = Utils.generateMockAadhaarData("Alice", true);
    aliceData.userState = stateMapping["Maharashtra"];
    aliceData.stateSalt = proofGenerator.generateSalt();
    aliceData.userGender = 2; // Female
    aliceData.genderSalt = proofGenerator.generateSalt();
    const aliceSalt = proofGenerator.generateSalt();
    const aliceSecret = proofGenerator.generateSecret();
    const aliceAadhaarHash = proofGenerator.generateAadhaarHash(aliceData.aadhaarNumber, aliceData.birthYear, aliceData.birthMonth, aliceData.birthDay, aliceSalt);
    const aliceSecretHash = proofGenerator.generateSecretHash(aliceSecret);
    const aliceStateCommitment = proofGenerator.generateStateCommitment(aliceData.userState, aliceData.stateSalt);
    const aliceGenderCommitment = proofGenerator.generateGenderCommitment(aliceData.userGender, aliceData.genderSalt);

    await attesterContract.issueAadhaarCard(alice.address, `AADHAAR_${aliceData.aadhaarNumber}`, aliceAadhaarHash, aliceSecretHash, aliceStateCommitment, aliceGenderCommitment);
    console.log(` Issued card for Alice (State: Maharashtra, Gender: Female)`);

    // --- Bob (Under 18, Karnataka) ---
    const bobData = Utils.generateMockAadhaarData("Bob", false);
    bobData.userState = stateMapping["Karnataka"];
    bobData.stateSalt = proofGenerator.generateSalt();
    bobData.userGender = 1; // Male
    bobData.genderSalt = proofGenerator.generateSalt();
    const bobSalt = proofGenerator.generateSalt();
    const bobSecret = proofGenerator.generateSecret();
    const bobAadhaarHash = proofGenerator.generateAadhaarHash(bobData.aadhaarNumber, bobData.birthYear, bobData.birthMonth, bobData.birthDay, bobSalt);
    const bobSecretHash = proofGenerator.generateSecretHash(bobSecret);
    const bobStateCommitment = proofGenerator.generateStateCommitment(bobData.userState, bobData.stateSalt);
    const bobGenderCommitment = proofGenerator.generateGenderCommitment(bobData.userGender, bobData.genderSalt);

    await attesterContract.issueAadhaarCard(bob.address, `AADHAAR_${bobData.aadhaarNumber}`, bobAadhaarHash, bobSecretHash, bobStateCommitment, bobGenderCommitment);
    console.log(` Issued card for Bob (State: Karnataka, Gender: Male)`);

    // --- Charlie (Over 18, Delhi, Transgender) ---
    const charlieData = Utils.generateMockAadhaarData("Charlie", true);
    charlieData.userState = stateMapping["Delhi"];
    charlieData.stateSalt = proofGenerator.generateSalt();
    charlieData.userGender = 3; // Transgender
    charlieData.genderSalt = proofGenerator.generateSalt();
    const charlieSalt = proofGenerator.generateSalt();
    const charlieSecret = proofGenerator.generateSecret();
    const charlieAadhaarHash = proofGenerator.generateAadhaarHash(charlieData.aadhaarNumber, charlieData.birthYear, charlieData.birthMonth, charlieData.birthDay, charlieSalt);
    const charlieSecretHash = proofGenerator.generateSecretHash(charlieSecret);
    const charlieStateCommitment = proofGenerator.generateStateCommitment(charlieData.userState, charlieData.stateSalt);
    const charlieGenderCommitment = proofGenerator.generateGenderCommitment(charlieData.userGender, charlieData.genderSalt);

    await attesterContract.issueAadhaarCard(charlie.address, `AADHAAR_${charlieData.aadhaarNumber}`, charlieAadhaarHash, charlieSecretHash, charlieStateCommitment, charlieGenderCommitment);
    console.log(` Issued card for Charlie (State: Delhi, Gender: Transgender)`);

    // Save user data
    const userData = {
        alice: { address: alice.address, ...aliceData, salt: aliceSalt.toString(), secret: aliceSecret.toString() },
        bob: { address: bob.address, ...bobData, salt: bobSalt.toString(), secret: bobSecret.toString() },
        charlie: { address: charlie.address, ...charlieData, salt: charlieSalt.toString(), secret: charlieSecret.toString() },
        company: { address: company.address },
        stateMapping
    };
    fs.writeFileSync(path.join(__dirname, '../userData.json'), JSON.stringify(userData, null, 2));
    console.log("\nUser data saved to userData.json");
}

if (require.main === module) {
    issueAadhaarCards().catch(console.error);
}
const { ethers } = require("hardhat");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function revokeAadhaar() {
    console.log("Aadhaar Organization: Revoking an Aadhaar Card\n");

    try {
        const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
        const userData = JSON.parse(fs.readFileSync(path.join(__dirname, '../userData.json'), 'utf-8'));

        // The first account is the deployer/Aadhaar Org
        const [aadhaarOrg] = await ethers.getSigners();
        
        const { attesterContract } = await Utils.getContracts(deployments);

        const userToRevoke = userData.bob; // Let's revoke Bob's card
        console.log(`Attempting to revoke card for Bob (${userToRevoke.address})...`);

        // Check status before revocation
        let hasValidCardBefore = await attesterContract.hasValidCard(userToRevoke.address);
        console.log(`  - Status before: Valid Card = ${hasValidCardBefore}`);

        // Perform the revocation
        const tx = await attesterContract.connect(aadhaarOrg).revokeAadhaarCard(userToRevoke.address);
        await Utils.waitForTransaction(tx, "Bob's Aadhaar revocation");
        console.log(" Revocation transaction confirmed.");

        // Check status after revocation
        let isRevokedAfter = await attesterContract.isSecretHashRevoked(userToRevoke.secretHash);
        let hasValidCardAfter = await attesterContract.hasValidCard(userToRevoke.address);
        console.log(`  - Status after:  Valid Card = ${hasValidCardAfter}, Secret Revoked = ${isRevokedAfter}`);

        if (isRevokedAfter && !hasValidCardAfter) {
            console.log("\n🎉 Successfully revoked Bob's Aadhaar card. His secret hash is now on the revocation list.");
        } else {
            console.error("\nRevocation failed. Status did not update correctly.");
        }

    } catch (error) {
        console.error("Error during revocation:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    revokeAadhaar().catch(console.error);
}
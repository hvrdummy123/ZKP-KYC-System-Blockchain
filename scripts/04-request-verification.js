const { ethers } = require("hardhat");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function requestVerifications() {
    console.log("🏢 Company: Requesting Age Verifications\n");

    try {
        // Load deployment and user data
        const deploymentsPath = path.join(__dirname, '../deployments.json');
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));
        
        const userDataPath = path.join(__dirname, '../userData.json');
        const userData = JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));

        const [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
        
        // Get BOTH contract instances
        const { attesterContract, over18Verifier } = await Utils.getContracts(deployments);

        // --- Prerequisite Checks ---
        console.log("Verifying prerequisites...");
        const aliceHasCard = await attesterContract.hasValidCard(alice.address);
        const bobHasCard = await attesterContract.hasValidCard(bob.address);

        console.log(`   Does Alice have a valid card? ---> ${aliceHasCard}`);
        console.log(`   Does Bob have a valid card?   ---> ${bobHasCard}`);

        if (!aliceHasCard || !bobHasCard) {
            throw new Error("PREREQUISITE FAILED: Not all users have a valid Aadhaar card issued.");
        }
        console.log(" Prerequisites met. Proceeding with verification requests.\n");
        
        console.log("Company requesting verifications from users...\n");

        // --- Request verification for Alice ---
        console.log("Requesting verification for Alice...");
        console.log(`   Company: ${Utils.formatAddress(company.address)}`);
        console.log(`   User: ${Utils.formatAddress(alice.address)}`);
        
        const verificationFee = ethers.parseEther("0.001");        
        const aliceRequestTx = await over18Verifier.connect(company).requestVerification(
            alice.address,
            { value: verificationFee }
        );
        
        const aliceReceipt = await Utils.waitForTransaction(aliceRequestTx, "Alice verification request");
        
        if (aliceReceipt.status === 0) {
            throw new Error("Alice's verification request transaction FAILED and was reverted.");
        }
        
        // --- Manual Event Parsing for Alice ---
        console.log(" Transaction succeeded. Manually parsing event from raw logs...");
        let aliceRequestId;
        const eventSignature = "VerificationRequested(uint256,address,address,uint256)";
        const expectedTopic = ethers.id(eventSignature);

        for (const log of aliceReceipt.logs) {
            if (log.address === deployments.over18Verifier && log.topics[0] === expectedTopic) {
                const parsedLog = over18Verifier.interface.parseLog(log);
                aliceRequestId = parsedLog.args.requestId;
                break;
            }
        }

        if (!aliceRequestId) {
            throw new Error("Manual parsing FAILED to find the VerificationRequested event for Alice.");
        }
        console.log(` Alice verification request ID: ${aliceRequestId}`);

        // --- Request verification for Bob ---
        console.log("\nRequesting verification for Bob...");
        const bobRequestTx = await over18Verifier.connect(company).requestVerification(
            bob.address,
            { value: verificationFee }
        );
        const bobReceipt = await Utils.waitForTransaction(bobRequestTx, "Bob verification request");

        if (bobReceipt.status === 0) {
            throw new Error("Bob's verification request transaction FAILED and was reverted.");
        }

        // --- Manual Event Parsing for Bob ---
        console.log(" Transaction succeeded. Manually parsing event from raw logs...");
        let bobRequestId;
        for (const log of bobReceipt.logs) {
            if (log.address === deployments.over18Verifier && log.topics[0] === expectedTopic) {
                const parsedLog = over18Verifier.interface.parseLog(log);
                bobRequestId = parsedLog.args.requestId;
                break;
            }
        }

        if (!bobRequestId) {
            throw new Error("Manual parsing FAILED to find the VerificationRequested event for Bob.");
        }
        console.log(` Bob verification request ID: ${bobRequestId}`);

        // --- Save request IDs ---
        const requestData = {
            alice: { requestId: aliceRequestId.toString(), requester: company.address, user: alice.address },
            bob: { requestId: bobRequestId.toString(), requester: company.address, user: bob.address }
        };
        fs.writeFileSync(path.join(__dirname, '../requestData.json'), JSON.stringify(requestData, null, 2));
        console.log("\nRequest data saved to requestData.json");

        // --- Show pending requests for users ---
        console.log("\nChecking pending requests...");
        const alicePending = await over18Verifier.getPendingRequests(alice.address);
        console.log(`Alice has ${alicePending.length} pending request(s): ${alicePending.join(', ')}`);
        const bobPending = await over18Verifier.getPendingRequests(bob.address);
        console.log(`Bob has ${bobPending.length} pending request(s): ${bobPending.join(', ')}`);

        console.log("\nVerification requests sent successfully!");

    } catch (error) {
        console.error("Error requesting verifications:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    requestVerifications().catch(console.error);
}

module.exports = { requestVerifications };
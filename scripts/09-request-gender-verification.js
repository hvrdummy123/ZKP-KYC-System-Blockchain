const { ethers } = require("hardhat");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function requestGenderVerifications() {
    console.log("Company: Requesting Gender Verifications\n");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
    const userData = JSON.parse(fs.readFileSync(path.join(__dirname, '../userData.json'), 'utf-8'));
    const [, alice, bob, company, charlie] = await ethers.getSigners();
    
    // Get the GenderVerifier contract instance
    const { genderVerifier } = await Utils.getContracts(deployments);

    const verificationFee = ethers.parseEther("0.001");
    
    // Request verification for Alice (Female = 2)
    const requiredGenderAlice = 2; // Female
    console.log(`Requesting verification for Alice: Is gender Female (${requiredGenderAlice})?`);
    const aliceTx = await genderVerifier.connect(company).requestGenderVerification(alice.address, requiredGenderAlice, { value: verificationFee });
    const aliceReceipt = await aliceTx.wait();
    const aliceEvent = aliceReceipt.logs.find(log => { 
        try { 
            return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested'; 
        } catch { 
            return false; 
        } 
    });
    const aliceRequestId = genderVerifier.interface.parseLog(aliceEvent).args.requestId;
    console.log(` Alice request sent. Request ID: ${aliceRequestId}`);

    // Request verification for Bob (Male = 1)
    const requiredGenderBob = 1; // Male
    console.log(`\nRequesting verification for Bob: Is gender Male (${requiredGenderBob})?`);
    const bobTx = await genderVerifier.connect(company).requestGenderVerification(bob.address, requiredGenderBob, { value: verificationFee });
    const bobReceipt = await bobTx.wait();
    const bobEvent = bobReceipt.logs.find(log => { 
        try { 
            return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested'; 
        } catch { 
            return false; 
        } 
    });
    const bobRequestId = genderVerifier.interface.parseLog(bobEvent).args.requestId;
    console.log(` Bob request sent. Request ID: ${bobRequestId}`);

    // Request verification for Charlie (Transgender = 3)
    const requiredGenderCharlie = 3; // Transgender
    console.log(`\nRequesting verification for Charlie: Is gender Transgender (${requiredGenderCharlie})?`);
    const charlieTx = await genderVerifier.connect(company).requestGenderVerification(charlie.address, requiredGenderCharlie, { value: verificationFee });
    const charlieReceipt = await charlieTx.wait();
    const charlieEvent = charlieReceipt.logs.find(log => { 
        try { 
            return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested'; 
        } catch { 
            return false; 
        } 
    });
    const charlieRequestId = genderVerifier.interface.parseLog(charlieEvent).args.requestId;
    console.log(` Charlie request sent. Request ID: ${charlieRequestId}`);

    // Save request data
    const requestData = {
        alice: { 
            requestId: aliceRequestId.toString(), 
            requester: company.address, 
            user: alice.address, 
            requiredGender: requiredGenderAlice 
        },
        bob: { 
            requestId: bobRequestId.toString(), 
            requester: company.address, 
            user: bob.address, 
            requiredGender: requiredGenderBob 
        },
        charlie: { 
            requestId: charlieRequestId.toString(), 
            requester: company.address, 
            user: charlie.address, 
            requiredGender: requiredGenderCharlie 
        }
    };
    fs.writeFileSync(path.join(__dirname, '../genderRequestData.json'), JSON.stringify(requestData, null, 2));
    console.log("\nGender request data saved to genderRequestData.json");
}

if (require.main === module) {
    requestGenderVerifications().catch(console.error);
}

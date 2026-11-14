const { expect } = require("chai");
const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");

describe("ZK-KYC Over18 System", function () {
    let attesterContract, over18Verifier;
    let aadhaarOrg, alice, bob, company;
    let proofGenerator;
    let aliceData, bobData;

    this.timeout(120000);

    before(async function () {
        [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
        proofGenerator = new ProofGenerator();
        await proofGenerator.init();

        const deployed = await Utils.deployContracts();
        attesterContract = deployed.attesterContract;
        over18Verifier = deployed.over18Verifier;
        // Roles: attester fixed; Alice/Bob = User; company = Verifier
        await deployed.roleRegistry.connect(alice).registerAsUser();
        await deployed.roleRegistry.connect(bob).registerAsUser();
        await deployed.roleRegistry.connect(company).registerAsVerifier();
    });

    async function issueCard(user, data) {
        const salt = proofGenerator.generateSalt();
        const secret = proofGenerator.generateSecret();
        const stateSalt = proofGenerator.generateSalt();
        const genderSalt = proofGenerator.generateSalt();
        const userState = 5;
        const userGender = 1;

        const aadhaarHash = proofGenerator.generateAadhaarHash(
            data.aadhaarNumber,
            data.birthYear,
            data.birthMonth,
            data.birthDay,
            salt
        );
        const secretHash = proofGenerator.generateSecretHash(secret);
        const stateCommitment = proofGenerator.generateStateCommitment(userState, stateSalt);
        const genderCommitment = proofGenerator.generateGenderCommitment(userGender, genderSalt);

        data.salt = salt;
        data.secret = secret;
        data.hash = aadhaarHash;
        data.secretHash = secretHash;
        data.userState = userState;
        data.stateSalt = stateSalt;
        data.userGender = userGender;
        data.genderSalt = genderSalt;

        await expect(
            attesterContract.issueAadhaarCard(
                user.address,
                `AADHAAR_${data.aadhaarNumber}`,
                aadhaarHash.toString(),
                secretHash.toString(),
                stateCommitment.toString(),
                genderCommitment.toString()
            )
        ).to.emit(attesterContract, "AadhaarCardIssued");

        return data;
    }

    describe("Contract Deployment", function () {
        it("Should deploy AttesterContract with correct owner", async function () {
            expect(await attesterContract.owner()).to.equal(aadhaarOrg.address);
        });

        it("Should deploy Over18Verifier with correct attester contract", async function () {
            expect(await over18Verifier.attesterContract()).to.equal(await attesterContract.getAddress());
        });
    });

    describe("Aadhaar Card Issuance", function () {
        it("Should issue Aadhaar card for Alice (over 18)", async function () {
            aliceData = Utils.generateMockAadhaarData("Alice", true);
            await issueCard(alice, aliceData);
            const cardDetails = await attesterContract.getCardDetails(alice.address);
            expect(cardDetails.aadhaarHash.toString()).to.equal(aliceData.hash.toString());
            expect(cardDetails.isActive).to.be.true;
        });

        it("Should issue Aadhaar card for Bob (under 18)", async function () {
            bobData = Utils.generateMockAadhaarData("Bob", false);
            await issueCard(bob, bobData);
            const cardDetails = await attesterContract.getCardDetails(bob.address);
            expect(cardDetails.aadhaarHash.toString()).to.equal(bobData.hash.toString());
            expect(cardDetails.isActive).to.be.true;
        });
    });

    describe("Verification Requests", function () {
        let aliceRequestId, bobRequestId;

        it("Should allow company to request verification for Alice", async function () {
            const verificationFee = ethers.parseEther("0.001");
            const tx = await over18Verifier.connect(company).requestVerification(
                alice.address,
                { value: verificationFee }
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find((log) => {
                try {
                    return over18Verifier.interface.parseLog(log).name === "VerificationRequested";
                } catch (e) {
                    return false;
                }
            });
            aliceRequestId = over18Verifier.interface.parseLog(event).args.requestId;
            expect(aliceRequestId).to.be.gt(0);
            aliceData.requestId = aliceRequestId;
        });

        it("Should allow company to request verification for Bob", async function () {
            const verificationFee = ethers.parseEther("0.001");
            const tx = await over18Verifier.connect(company).requestVerification(
                bob.address,
                { value: verificationFee }
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find((log) => {
                try {
                    return over18Verifier.interface.parseLog(log).name === "VerificationRequested";
                } catch (e) {
                    return false;
                }
            });
            bobRequestId = over18Verifier.interface.parseLog(event).args.requestId;
            expect(bobRequestId).to.be.gt(0);
            bobData.requestId = bobRequestId;
        });

        it("Should show pending requests for users", async function () {
            const alicePendingRequests = await over18Verifier.getPendingRequests(alice.address);
            const bobPendingRequests = await over18Verifier.getPendingRequests(bob.address);
            expect(alicePendingRequests.length).to.equal(1);
            expect(bobPendingRequests.length).to.equal(1);
        });
    });

    describe("ZK Proof Generation and Verification", function () {
        it("Should generate valid proof for Alice (over 18)", async function () {
            const aliceAadhaarData = {
                aadhaarNumber: aliceData.aadhaarNumber,
                birthYear: aliceData.birthYear,
                birthMonth: aliceData.birthMonth,
                birthDay: aliceData.birthDay,
                salt: aliceData.salt,
            };
            const verifierId = BigInt(company.address);
            const proofResult = await proofGenerator.generateOver18Proof(
                aliceAadhaarData,
                aliceData.secret,
                aliceData.requestId,
                verifierId
            );
            expect(proofResult.success).to.be.true;
            expect(proofResult.publicSignals[0]).to.equal("1");
        });

        it("Should generate valid proof for Bob (under 18)", async function () {
            const bobAadhaarData = {
                aadhaarNumber: bobData.aadhaarNumber,
                birthYear: bobData.birthYear,
                birthMonth: bobData.birthMonth,
                birthDay: bobData.birthDay,
                salt: bobData.salt,
            };
            const verifierId = BigInt(company.address);
            const proofResult = await proofGenerator.generateOver18Proof(
                bobAadhaarData,
                bobData.secret,
                bobData.requestId,
                verifierId
            );
            expect(proofResult.success).to.be.true;
            expect(proofResult.publicSignals[0]).to.equal("0");
        });
    });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");

describe("Gender Verification System - All Three Gender Types", function () {
    let attesterContract, genderVerifier, groth16Verifier;
    let aadhaarOrg, alice, bob, charlie, company;
    let proofGenerator;
    let aliceData, bobData, charlieData;

    // Increase timeout for proof generation
    this.timeout(120000);

    before(async function () {
        console.log("\n📋 Setting up test environment...\n");
        [aadhaarOrg, alice, bob, charlie, company] = await ethers.getSigners();
        proofGenerator = new ProofGenerator();
        await proofGenerator.init();

        // Deploy AttesterContract
        console.log("  Deploying AttesterContract...");
        const AttesterContract = await ethers.getContractFactory("AttesterContract");
        attesterContract = await AttesterContract.deploy();
        await attesterContract.waitForDeployment();

        // Deploy Groth16 Verifier
        console.log("  Deploying GenderGroth16Verifier...");
        const GenderGroth16Verifier = await ethers.getContractFactory("GenderGroth16Verifier");
        groth16Verifier = await GenderGroth16Verifier.deploy();
        await groth16Verifier.waitForDeployment();

        console.log("  Deploying RoleRegistry...");
        const RoleRegistry = await ethers.getContractFactory("RoleRegistry");
        const roleRegistry = await RoleRegistry.deploy(aadhaarOrg.address);
        await roleRegistry.waitForDeployment();
        await roleRegistry.connect(alice).registerAsUser();
        await roleRegistry.connect(bob).registerAsUser();
        await roleRegistry.connect(charlie).registerAsUser();
        await roleRegistry.connect(company).registerAsVerifier();

        // Deploy Gender Verifier
        console.log("  Deploying GenderVerifier...");
        const GenderVerifier = await ethers.getContractFactory("GenderVerifier");
        genderVerifier = await GenderVerifier.deploy(
            await attesterContract.getAddress(),
            await groth16Verifier.getAddress(),
            await roleRegistry.getAddress()
        );
        await genderVerifier.waitForDeployment();
        console.log("  ✅ All contracts deployed\n");
    });

    describe("Contract Deployment", function () {
        it("Should deploy GenderVerifier with correct attester contract", async function () {
            expect(await genderVerifier.attester()).to.equal(await attesterContract.getAddress());
        });

        it("Should deploy GenderVerifier with correct Groth16 verifier", async function () {
            expect(await genderVerifier.groth16Verifier()).to.equal(await groth16Verifier.getAddress());
        });

        it("Should set correct verification fee", async function () {
            expect(await genderVerifier.genderVerificationFee()).to.equal(ethers.parseEther("0.001"));
        });
    });

    describe("Aadhaar Card Issuance with All Gender Types", function () {
        it("Should issue Aadhaar card for Alice (Female = 2)", async function () {
            aliceData = Utils.generateMockAadhaarData("Alice", true);
            aliceData.userGender = 2; // Female
            aliceData.genderSalt = proofGenerator.generateSalt();
            
            const aliceSalt = proofGenerator.generateSalt();
            const aliceSecret = proofGenerator.generateSecret();
            const aliceAadhaarHash = proofGenerator.generateAadhaarHash(
                aliceData.aadhaarNumber,
                aliceData.birthYear,
                aliceData.birthMonth,
                aliceData.birthDay,
                aliceSalt
            );
            const aliceSecretHash = proofGenerator.generateSecretHash(aliceSecret);
            const aliceGenderCommitment = proofGenerator.generateGenderCommitment(
                aliceData.userGender,
                aliceData.genderSalt
            );

            aliceData.salt = aliceSalt;
            aliceData.secret = aliceSecret;
            aliceData.hash = aliceAadhaarHash;
            aliceData.secretHash = aliceSecretHash;

            const aliceStateCommitment = proofGenerator.generateStateCommitment(5, proofGenerator.generateSalt());

            await expect(
                attesterContract.issueAadhaarCard(
                    alice.address,
                    `AADHAAR_${aliceData.aadhaarNumber}`,
                    aliceAadhaarHash.toString(),
                    aliceSecretHash.toString(),
                    aliceStateCommitment.toString(),
                    aliceGenderCommitment.toString()
                )
            ).to.emit(attesterContract, "AadhaarCardIssued");

            expect(await attesterContract.hasValidCard(alice.address)).to.be.true;
        });

        it("Should issue Aadhaar card for Bob (Male = 1)", async function () {
            bobData = Utils.generateMockAadhaarData("Bob", true);
            bobData.userGender = 1; // Male
            bobData.genderSalt = proofGenerator.generateSalt();
            
            const bobSalt = proofGenerator.generateSalt();
            const bobSecret = proofGenerator.generateSecret();
            const bobAadhaarHash = proofGenerator.generateAadhaarHash(
                bobData.aadhaarNumber,
                bobData.birthYear,
                bobData.birthMonth,
                bobData.birthDay,
                bobSalt
            );
            const bobSecretHash = proofGenerator.generateSecretHash(bobSecret);
            const bobGenderCommitment = proofGenerator.generateGenderCommitment(
                bobData.userGender,
                bobData.genderSalt
            );

            bobData.salt = bobSalt;
            bobData.secret = bobSecret;
            bobData.hash = bobAadhaarHash;
            bobData.secretHash = bobSecretHash;

            const bobStateCommitment = proofGenerator.generateStateCommitment(5, proofGenerator.generateSalt());

            await expect(
                attesterContract.issueAadhaarCard(
                    bob.address,
                    `AADHAAR_${bobData.aadhaarNumber}`,
                    bobAadhaarHash.toString(),
                    bobSecretHash.toString(),
                    bobStateCommitment.toString(),
                    bobGenderCommitment.toString()
                )
            ).to.emit(attesterContract, "AadhaarCardIssued");

            expect(await attesterContract.hasValidCard(bob.address)).to.be.true;
        });

        it("Should issue Aadhaar card for Charlie (Transgender = 3)", async function () {
            charlieData = Utils.generateMockAadhaarData("Charlie", true);
            charlieData.userGender = 3; // Transgender
            charlieData.genderSalt = proofGenerator.generateSalt();
            
            const charlieSalt = proofGenerator.generateSalt();
            const charlieSecret = proofGenerator.generateSecret();
            const charlieAadhaarHash = proofGenerator.generateAadhaarHash(
                charlieData.aadhaarNumber,
                charlieData.birthYear,
                charlieData.birthMonth,
                charlieData.birthDay,
                charlieSalt
            );
            const charlieSecretHash = proofGenerator.generateSecretHash(charlieSecret);
            const charlieGenderCommitment = proofGenerator.generateGenderCommitment(
                charlieData.userGender,
                charlieData.genderSalt
            );

            charlieData.salt = charlieSalt;
            charlieData.secret = charlieSecret;
            charlieData.hash = charlieAadhaarHash;
            charlieData.secretHash = charlieSecretHash;

            const charlieStateCommitment = proofGenerator.generateStateCommitment(5, proofGenerator.generateSalt());

            await expect(
                attesterContract.issueAadhaarCard(
                    charlie.address,
                    `AADHAAR_${charlieData.aadhaarNumber}`,
                    charlieAadhaarHash.toString(),
                    charlieSecretHash.toString(),
                    charlieStateCommitment.toString(),
                    charlieGenderCommitment.toString()
                )
            ).to.emit(attesterContract, "AadhaarCardIssued");

            expect(await attesterContract.hasValidCard(charlie.address)).to.be.true;
        });
    });

    describe("Gender Verification - Invalid Gender Values", function () {
        it("Should reject verification request with gender = 0", async function () {
            const verificationFee = ethers.parseEther("0.001");
            await expect(
                genderVerifier.connect(company).requestGenderVerification(
                    alice.address,
                    0,
                    { value: verificationFee }
                )
            ).to.be.revertedWith("Invalid gender value");
        });

        it("Should reject verification request with gender = 4", async function () {
            const verificationFee = ethers.parseEther("0.001");
            await expect(
                genderVerifier.connect(company).requestGenderVerification(
                    alice.address,
                    4,
                    { value: verificationFee }
                )
            ).to.be.revertedWith("Invalid gender value");
        });
    });

    describe("Gender Verification - Female (Gender = 2)", function () {
        let requestId;

        it("Should allow company to request verification for Alice (Female)", async function () {
            const verificationFee = ethers.parseEther("0.001");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                alice.address,
                2, // Female
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
            const parsedEvent = genderVerifier.interface.parseLog(event);
            requestId = parsedEvent.args.requestId;
            
            expect(parsedEvent.args.user).to.equal(alice.address);
            expect(parsedEvent.args.requiredGender).to.equal(2);
        });

        it("Should allow Alice to complete verification with valid proof (Female)", async function () {
            const genderData = { 
                userGender: aliceData.userGender, 
                genderSalt: aliceData.genderSalt 
            };
            
            console.log("    Generating proof for Alice (Female)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                aliceData.secret,
                requestId.toString(),
                company.address,
                2 // Required gender: Female
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await expect(
                genderVerifier.connect(alice).completeGenderVerification(
                    requestId,
                    formattedProof.pA,
                    formattedProof.pB,
                    formattedProof.pC,
                    publicSignals
                )
            ).to.emit(genderVerifier, "GenderVerificationCompleted");

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.true; // Should match
        });
    });

    describe("Gender Verification - Male (Gender = 1)", function () {
        let requestId;

        it("Should allow company to request verification for Bob (Male)", async function () {
            const verificationFee = ethers.parseEther("0.001");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                bob.address,
                1, // Male
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            const parsedEvent = genderVerifier.interface.parseLog(event);
            requestId = parsedEvent.args.requestId;
            
            expect(parsedEvent.args.user).to.equal(bob.address);
            expect(parsedEvent.args.requiredGender).to.equal(1);
        });

        it("Should allow Bob to complete verification with valid proof (Male)", async function () {
            const genderData = { 
                userGender: bobData.userGender, 
                genderSalt: bobData.genderSalt 
            };
            
            console.log("    Generating proof for Bob (Male)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                bobData.secret,
                requestId.toString(),
                company.address,
                1 // Required gender: Male
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await expect(
                genderVerifier.connect(bob).completeGenderVerification(
                    requestId,
                    formattedProof.pA,
                    formattedProof.pB,
                    formattedProof.pC,
                    publicSignals
                )
            ).to.emit(genderVerifier, "GenderVerificationCompleted");

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.true; // Should match
        });
    });

    describe("Gender Verification - Transgender (Gender = 3)", function () {
        let requestId;

        it("Should allow company to request verification for Charlie (Transgender)", async function () {
            const verificationFee = ethers.parseEther("0.001");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                charlie.address,
                3, // Transgender
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            const parsedEvent = genderVerifier.interface.parseLog(event);
            requestId = parsedEvent.args.requestId;
            
            expect(parsedEvent.args.user).to.equal(charlie.address);
            expect(parsedEvent.args.requiredGender).to.equal(3);
        });

        it("Should allow Charlie to complete verification with valid proof (Transgender)", async function () {
            const genderData = { 
                userGender: charlieData.userGender, 
                genderSalt: charlieData.genderSalt 
            };
            
            console.log("    Generating proof for Charlie (Transgender)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                charlieData.secret,
                requestId.toString(),
                company.address,
                3 // Required gender: Transgender
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await expect(
                genderVerifier.connect(charlie).completeGenderVerification(
                    requestId,
                    formattedProof.pA,
                    formattedProof.pB,
                    formattedProof.pC,
                    publicSignals
                )
            ).to.emit(genderVerifier, "GenderVerificationCompleted");

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.true; // Should match
        });
    });

    describe("Gender Verification - Mismatch Scenarios (Result = False)", function () {
        it("Should return false when Alice (Female) is checked for Male", async function () {
            const verificationFee = ethers.parseEther("0.001");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                alice.address,
                1, // Checking for Male, but Alice is Female
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            const parsedEvent = genderVerifier.interface.parseLog(event);
            const requestId = parsedEvent.args.requestId;

            const genderData = { 
                userGender: aliceData.userGender, 
                genderSalt: aliceData.genderSalt 
            };
            
            console.log("    Generating proof for Alice checked against Male (should not match)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                aliceData.secret,
                requestId.toString(),
                company.address,
                1 // Required: Male, Actual: Female
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await genderVerifier.connect(alice).completeGenderVerification(
                requestId,
                formattedProof.pA,
                formattedProof.pB,
                formattedProof.pC,
                publicSignals
            );

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.false; // Should NOT match
        });

        it("Should return false when Bob (Male) is checked for Female", async function () {
            const verificationFee = ethers.parseEther("0.002");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                bob.address,
                2, // Checking for Female, but Bob is Male
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            const parsedEvent = genderVerifier.interface.parseLog(event);
            const requestId = parsedEvent.args.requestId;

            const genderData = { 
                userGender: bobData.userGender, 
                genderSalt: bobData.genderSalt 
            };
            
            console.log("    Generating proof for Bob checked against Female (should not match)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                bobData.secret,
                requestId.toString(),
                company.address,
                2 // Required: Female, Actual: Male
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await genderVerifier.connect(bob).completeGenderVerification(
                requestId,
                formattedProof.pA,
                formattedProof.pB,
                formattedProof.pC,
                publicSignals
            );

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.false; // Should NOT match
        });

        it("Should return false when Charlie (Transgender) is checked for Male", async function () {
            const verificationFee = ethers.parseEther("0.002");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                charlie.address,
                1, // Checking for Male, but Charlie is Transgender
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            const parsedEvent = genderVerifier.interface.parseLog(event);
            const requestId = parsedEvent.args.requestId;

            const genderData = { 
                userGender: charlieData.userGender, 
                genderSalt: charlieData.genderSalt 
            };
            
            console.log("    Generating proof for Charlie checked against Male (should not match)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                charlieData.secret,
                requestId.toString(),
                company.address,
                1 // Required: Male, Actual: Transgender
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await genderVerifier.connect(charlie).completeGenderVerification(
                requestId,
                formattedProof.pA,
                formattedProof.pB,
                formattedProof.pC,
                publicSignals
            );

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.false; // Should NOT match
        });

        it("Should return false when Alice (Female) is checked for Transgender", async function () {
            const verificationFee = ethers.parseEther("0.002");
            
            const tx = await genderVerifier.connect(company).requestGenderVerification(
                alice.address,
                3, // Checking for Transgender, but Alice is Female
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return genderVerifier.interface.parseLog(log).name === 'GenderVerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            const parsedEvent = genderVerifier.interface.parseLog(event);
            const requestId = parsedEvent.args.requestId;

            const genderData = { 
                userGender: aliceData.userGender, 
                genderSalt: aliceData.genderSalt 
            };
            
            console.log("    Generating proof for Alice checked against Transgender (should not match)...");
            const result = await proofGenerator.generateGenderProof(
                genderData,
                aliceData.secret,
                requestId.toString(),
                company.address,
                3 // Required: Transgender, Actual: Female
            );

            expect(result.success).to.be.true;

            const formattedProof = Utils.formatProofForSolidity(result.proof);
            const publicSignals = result.publicSignals.map(p => p.toString());

            await genderVerifier.connect(alice).completeGenderVerification(
                requestId,
                formattedProof.pA,
                formattedProof.pB,
                formattedProof.pC,
                publicSignals
            );

            const request = await genderVerifier.getGenderVerificationRequest(requestId);
            expect(request.isCompleted).to.be.true;
            expect(request.result).to.be.false; // Should NOT match
        });
    });

    describe("Contract Administration", function () {
        it("Should allow owner to update verification fee", async function () {
            const newFee = ethers.parseEther("0.002");
            await expect(
                genderVerifier.connect(aadhaarOrg).updateGenderVerificationFee(newFee)
            ).to.emit(genderVerifier, "GenderVerificationFeeUpdated")
            .withArgs(newFee);

            expect(await genderVerifier.genderVerificationFee()).to.equal(newFee);
        });

        it("Should not allow non-owner to update verification fee", async function () {
            const newFee = ethers.parseEther("0.003");
            await expect(
                genderVerifier.connect(company).updateGenderVerificationFee(newFee)
            ).to.be.reverted;
        });
    });
});

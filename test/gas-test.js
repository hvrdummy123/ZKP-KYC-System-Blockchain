const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gas Consumption Tests", function () {
  let attesterContract;
  let over18Verifier;
  let stateVerifier;
  let groth16Verifier;
  let stateGroth16Verifier;
  let owner, user, requester;

  beforeEach(async function () {
    [owner, user, requester] = await ethers.getSigners();

    // Deploy Groth16 Verifiers
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    groth16Verifier = await Groth16Verifier.deploy();
    await groth16Verifier.waitForDeployment();

    const StateGroth16Verifier = await ethers.getContractFactory("StateOfResidenceGroth16Verifier");
    stateGroth16Verifier = await StateGroth16Verifier.deploy();
    await stateGroth16Verifier.waitForDeployment();

    // Deploy AttesterContract
    const AttesterContract = await ethers.getContractFactory("AttesterContract");
    attesterContract = await AttesterContract.deploy();
    await attesterContract.waitForDeployment();

    const RoleRegistry = await ethers.getContractFactory("RoleRegistry");
    const roleRegistry = await RoleRegistry.deploy(owner.address);
    await roleRegistry.waitForDeployment();
    await roleRegistry.connect(user).registerAsUser();
    await roleRegistry.connect(requester).registerAsVerifier();

    // Deploy verifiers with proper constructor arguments
    const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
    over18Verifier = await Over18Verifier.deploy(
      await attesterContract.getAddress(),
      await groth16Verifier.getAddress(),
      await roleRegistry.getAddress()
    );
    await over18Verifier.waitForDeployment();

    const StateVerifier = await ethers.getContractFactory("StateOfResidenceVerifier");
    stateVerifier = await StateVerifier.deploy(
      await attesterContract.getAddress(),
      await stateGroth16Verifier.getAddress(),
      await roleRegistry.getAddress()
    );
    await stateVerifier.waitForDeployment();
  });

  describe("AttesterContract Gas Tests", function () {
    it("should measure gas for issuing Aadhaar card", async function () {
      const tx = await attesterContract.issueAadhaarCard(
        user.address,
        "CARD001",
        ethers.keccak256(ethers.toUtf8Bytes("aadhaar123")),
        ethers.keccak256(ethers.toUtf8Bytes("secret123")),
        ethers.keccak256(ethers.toUtf8Bytes("state5")),
        ethers.keccak256(ethers.toUtf8Bytes("gender1"))
      );
      const receipt = await tx.wait();
      console.log(`Gas used for issueAadhaarCard: ${receipt.gasUsed.toString()}`);
    });

    it("should measure gas for revoking Aadhaar card", async function () {
      await attesterContract.issueAadhaarCard(
        user.address,
        "CARD001",
        ethers.keccak256(ethers.toUtf8Bytes("aadhaar123")),
        ethers.keccak256(ethers.toUtf8Bytes("secret123")),
        ethers.keccak256(ethers.toUtf8Bytes("state5")),
        ethers.keccak256(ethers.toUtf8Bytes("gender1"))
      );
      const tx = await attesterContract.revokeAadhaarCard(user.address);
      const receipt = await tx.wait();
      console.log(`Gas used for revokeAadhaarCard: ${receipt.gasUsed.toString()}`);
    });
  });

  describe("Verifier Gas Tests", function () {
    beforeEach(async function () {
      // Issue card to user for verification tests
      await attesterContract.issueAadhaarCard(
        user.address,
        "CARD001",
        ethers.keccak256(ethers.toUtf8Bytes("aadhaar123")),
        ethers.keccak256(ethers.toUtf8Bytes("secret123")),
        ethers.keccak256(ethers.toUtf8Bytes("state5")),
        ethers.keccak256(ethers.toUtf8Bytes("gender1"))
      );
    });

    it("should measure gas for requesting Over18 verification", async function () {
      const fee = await over18Verifier.verificationFee();
      const tx = await over18Verifier.connect(requester).requestVerification(user.address, { value: fee });
      const receipt = await tx.wait();
      console.log(`Gas used for requestVerification: ${receipt.gasUsed.toString()}`);
    });

    it("should measure gas for requesting State verification", async function () {
      const fee = await stateVerifier.stateVerificationFee();
      const tx = await stateVerifier.connect(requester).requestStateVerification(user.address, 5, { value: fee });
      const receipt = await tx.wait();
      console.log(`Gas used for requestStateVerification: ${receipt.gasUsed.toString()}`);
    });
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");

describe("Visitor demo — DemoAttester + DemoAgeGate", function () {
  this.timeout(180000);

  it("any account can self-issue and claim an over-18 pass", async function () {
    const [, visitor] = await ethers.getSigners();
    const DemoAttester = await ethers.getContractFactory("DemoAttester");
    const attester = await DemoAttester.deploy();
    await attester.waitForDeployment();

    const Groth16 = await ethers.getContractFactory("Groth16Verifier");
    const groth = await Groth16.deploy();
    await groth.waitForDeployment();

    const Gate = await ethers.getContractFactory("DemoAgeGate");
    const gate = await Gate.deploy(await attester.getAddress(), await groth.getAddress());
    await gate.waitForDeployment();

    const pg = new ProofGenerator();
    await pg.init();
    const data = Utils.generateMockAadhaarData("Visitor", true);
    const salt = pg.generateSalt();
    const secret = pg.generateSecret();
    const aadhaarHash = pg.generateAadhaarHash(
      data.aadhaarNumber, data.birthYear, data.birthMonth, data.birthDay, salt
    );
    const secretHash = pg.generateSecretHash(secret);
    const stateCommitment = pg.generateStateCommitment(27, pg.generateSalt());
    const genderCommitment = pg.generateGenderCommitment(1, pg.generateSalt());

    await attester.connect(visitor).selfIssue(
      `DEMO_${data.aadhaarNumber}`,
      aadhaarHash.toString(),
      secretHash.toString(),
      stateCommitment.toString(),
      genderCommitment.toString()
    );
    expect(await attester.hasValidCard(visitor.address)).to.equal(true);

    const requestId = await gate.requestIdFor(visitor.address);
    const proofResult = await pg.generateOver18Proof(
      {
        aadhaarNumber: data.aadhaarNumber,
        birthYear: data.birthYear,
        birthMonth: data.birthMonth,
        birthDay: data.birthDay,
        salt,
      },
      secret,
      requestId,
      BigInt(visitor.address)
    );
    expect(proofResult.success).to.equal(true);
    expect(proofResult.publicSignals[0]).to.equal("1");

    const formatted = Utils.formatProofForSolidity(proofResult.proof);
    await gate.connect(visitor).claimPass(
      formatted.pA,
      formatted.pB,
      formatted.pC,
      proofResult.publicSignals
    );
    expect(await gate.hasPass(visitor.address)).to.equal(true);

    // replay by another account fails (sender binding)
    const [, , attacker] = await ethers.getSigners();
    await expect(
      gate.connect(attacker).claimPass(
        formatted.pA,
        formatted.pB,
        formatted.pC,
        proofResult.publicSignals
      )
    ).to.be.reverted;
  });
});

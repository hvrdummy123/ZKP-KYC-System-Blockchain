const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RoleRegistry — fixed attester, User XOR Verifier", function () {
  let registry, attester, alice, bob, company;

  beforeEach(async function () {
    [attester, alice, bob, company] = await ethers.getSigners();
    const RoleRegistry = await ethers.getContractFactory("RoleRegistry");
    registry = await RoleRegistry.deploy(attester.address);
    await registry.waitForDeployment();
  });

  it("locks attester at deploy and rejects attester self-registration", async function () {
    expect(await registry.attester()).to.equal(attester.address);
    expect(await registry.isAttester(attester.address)).to.equal(true);
    await expect(registry.connect(attester).registerAsUser()).to.be.revertedWith("attester is fixed");
    await expect(registry.connect(attester).registerAsVerifier()).to.be.revertedWith("attester is fixed");
  });

  it("lets an account register as User once", async function () {
    await registry.connect(alice).registerAsUser();
    expect(await registry.isUser(alice.address)).to.equal(true);
    expect(await registry.isVerifier(alice.address)).to.equal(false);
    await expect(registry.connect(alice).registerAsVerifier()).to.be.revertedWith("already registered");
    await expect(registry.connect(alice).registerAsUser()).to.be.revertedWith("already registered");
  });

  it("lets an account register as Verifier once (cannot become User)", async function () {
    await registry.connect(company).registerAsVerifier();
    expect(await registry.isVerifier(company.address)).to.equal(true);
    expect(await registry.isUser(company.address)).to.equal(false);
    await expect(registry.connect(company).registerAsUser()).to.be.revertedWith("already registered");
  });

  it("blocks Over18 request unless requester is Verifier and target is User", async function () {
    const Attester = await ethers.getContractFactory("AttesterContract");
    const attesterContract = await Attester.deploy();
    await attesterContract.waitForDeployment();

    const Groth16 = await ethers.getContractFactory("Groth16Verifier");
    const groth = await Groth16.deploy();
    await groth.waitForDeployment();

    const Over18 = await ethers.getContractFactory("Over18Verifier");
    const over18 = await Over18.deploy(
      await attesterContract.getAddress(),
      await groth.getAddress(),
      await registry.getAddress()
    );
    await over18.waitForDeployment();

    await registry.connect(alice).registerAsUser();
    await registry.connect(company).registerAsVerifier();

    // Issue a card so hasValidCard passes after role checks
    await attesterContract.issueAadhaarCard(
      alice.address,
      "CARD_ALICE",
      1n,
      2n,
      3n,
      4n
    );

    const fee = await over18.verificationFee();
    await expect(
      over18.connect(alice).requestVerification(alice.address, { value: fee })
    ).to.be.revertedWith("verifiers only");

    await expect(
      over18.connect(company).requestVerification(bob.address, { value: fee })
    ).to.be.revertedWith("target must be user");

    await expect(
      over18.connect(company).requestVerification(alice.address, { value: fee })
    ).to.not.be.reverted;
  });
});

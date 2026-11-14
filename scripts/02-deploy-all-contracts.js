const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployAllContracts() {
    console.log("🚀 Deploying all contracts...\n");
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    try {
        // --- Fixed Attester + RoleRegistry (User XOR Verifier signup) ---
        console.log(" Deploying AttesterContract + RoleRegistry...");
        const AttesterContract = await ethers.getContractFactory("AttesterContract");
        const attesterContract = await AttesterContract.deploy();
        await attesterContract.waitForDeployment();
        const attesterAddress = await attesterContract.getAddress();
        console.log("   -> AttesterContract:", attesterAddress);
        console.log("   -> Fixed attester wallet:", deployer.address);

        const RoleRegistry = await ethers.getContractFactory("RoleRegistry");
        const roleRegistry = await RoleRegistry.deploy(deployer.address);
        await roleRegistry.waitForDeployment();
        const roleRegistryAddress = await roleRegistry.getAddress();
        console.log("   -> RoleRegistry:", roleRegistryAddress);

        // --- Deploy Over18 System ---
        console.log("\n Deploying Over18 System...");
        const Over18Groth16 = await ethers.getContractFactory("Groth16Verifier");
        const over18Groth16 = await Over18Groth16.deploy();
        await over18Groth16.waitForDeployment();
        const over18Groth16Address = await over18Groth16.getAddress();

        const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
        const over18Verifier = await Over18Verifier.deploy(attesterAddress, over18Groth16Address, roleRegistryAddress);
        await over18Verifier.waitForDeployment();
        const over18ContractAddress = await over18Verifier.getAddress();
        console.log("   -> Over18Verifier:", over18ContractAddress);

        // --- Deploy StateOfResidence System ---
        console.log("\n Deploying StateOfResidence System...");
        const StateOfResidenceGroth16Verifier = await ethers.getContractFactory("StateOfResidenceGroth16Verifier");
        const stateGroth16 = await StateOfResidenceGroth16Verifier.deploy();
        await stateGroth16.waitForDeployment();
        const stateGroth16Address = await stateGroth16.getAddress();

        const StateOfResidenceVerifier = await ethers.getContractFactory("StateOfResidenceVerifier");
        const stateOfResidenceVerifier = await StateOfResidenceVerifier.deploy(attesterAddress, stateGroth16Address, roleRegistryAddress);
        await stateOfResidenceVerifier.waitForDeployment();
        const stateContractAddress = await stateOfResidenceVerifier.getAddress();
        console.log("   -> StateOfResidenceVerifier:", stateContractAddress);

        // --- Deploy Gender Verification System ---
        console.log("\n Deploying Gender Verification System...");
        const GenderGroth16Verifier = await ethers.getContractFactory("GenderGroth16Verifier");
        const genderGroth16 = await GenderGroth16Verifier.deploy();
        await genderGroth16.waitForDeployment();
        const genderGroth16Address = await genderGroth16.getAddress();

        const GenderVerifier = await ethers.getContractFactory("GenderVerifier");
        const genderVerifier = await GenderVerifier.deploy(attesterAddress, genderGroth16Address, roleRegistryAddress);
        await genderVerifier.waitForDeployment();
        const genderContractAddress = await genderVerifier.getAddress();
        console.log("   -> GenderVerifier:", genderContractAddress);

        // --- Demo visitor path (no role required) ---
        console.log("\n Deploying DemoAttester + DemoAgeGate...");
        const DemoAttester = await ethers.getContractFactory("DemoAttester");
        const demoAttester = await DemoAttester.deploy();
        await demoAttester.waitForDeployment();
        const demoAttesterAddress = await demoAttester.getAddress();

        const DemoAgeGate = await ethers.getContractFactory("DemoAgeGate");
        const demoAgeGate = await DemoAgeGate.deploy(demoAttesterAddress, over18Groth16Address);
        await demoAgeGate.waitForDeployment();
        const demoAgeGateAddress = await demoAgeGate.getAddress();
        console.log("   -> DemoAttester:", demoAttesterAddress);
        console.log("   -> DemoAgeGate:", demoAgeGateAddress);

        const network = await ethers.provider.getNetwork();
        const deploymentData = {
            attesterContract: attesterAddress,
            roleRegistry: roleRegistryAddress,
            over18Verifier: over18ContractAddress,
            stateOfResidenceVerifier: stateContractAddress,
            genderVerifier: genderContractAddress,
            demoAttester: demoAttesterAddress,
            demoAgeGate: demoAgeGateAddress,
            over18Groth16: over18Groth16Address,
            deployer: deployer.address,
            attester: deployer.address,
            network: { name: network.name, chainId: network.chainId.toString() },
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(path.join(__dirname, '../deployments.json'), JSON.stringify(deploymentData, null, 2));

        const frontendDeployments = path.join(__dirname, '../frontend/deployments.json');
        const frontendPublic = path.join(__dirname, '../frontend/public/deployments.json');
        fs.writeFileSync(frontendDeployments, JSON.stringify(deploymentData, null, 2));
        fs.writeFileSync(frontendPublic, JSON.stringify(deploymentData, null, 2));

        for (const name of [
            "RoleRegistry", "DemoAttester", "DemoAgeGate", "AttesterContract",
            "Over18Verifier", "GenderVerifier", "StateOfResidenceVerifier"
        ]) {
            const art = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
            if (fs.existsSync(art)) {
                fs.copyFileSync(art, path.join(__dirname, `../frontend/contracts/${name}.json`));
                fs.copyFileSync(art, path.join(__dirname, `../frontend/public/contracts/${name}.json`));
            }
        }

        console.log("\nDeployment info saved to deployments.json (+ frontend sync)");
        console.log("\nAll contracts deployed successfully!");
        console.log("Attester (fixed):", deployer.address);
        console.log("Others: connect wallet → Sign up as User or Verifier (once).");
        console.log("Visitor sandbox (no role): /try");

    } catch (error) {
        console.error("Deployment failed:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    deployAllContracts().catch(console.error);
}

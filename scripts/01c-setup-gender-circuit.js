const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function setupGenderCircuit() {
    const buildDir = path.join(__dirname, '../circuits/build');
    
    // Create build directory
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    const circuitPath = path.join(__dirname, '../circuits/GenderVerification.circom');
    const r1csPath = path.join(buildDir, 'GenderVerification.r1cs');
    const wasmPath = path.join(buildDir, 'GenderVerification_js/GenderVerification.wasm');
    const symPath = path.join(buildDir, 'GenderVerification.sym');

    try {
        console.log('📦 Compiling Gender Verification circuit...');
        
        // Compile circuit
        await execAsync(`circom ${circuitPath} --r1cs --wasm --sym -o ${buildDir} -l node_modules/circomlib/circuits`);
        console.log('✅ Circuit compiled successfully');

        // Download powers of tau file
        const ptauPath = path.join(buildDir, 'powersOfTau28_hez_final_12.ptau');
        
        if (!fs.existsSync(ptauPath)) {
            console.log('Downloading powers of tau file (phase 1)...');
            
            // Use the new, reliable URL
            const ptauURL = "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau";
            
            // Use curl with -L to follow redirects
            await execAsync(`curl -L -o ${ptauPath} ${ptauURL}`);
            
            console.log('Powers of tau downloaded');
        } else {
            console.log('Powers of tau file already exists. Skipping download.');
        }

        // Setup ceremony
        console.log('🔐 Setting up trusted setup for Gender Verification...');
        
        const zkeyPath0 = path.join(buildDir, 'GenderVerification_0000.zkey');
        const zkeyPath1 = path.join(buildDir, 'GenderVerification_0001.zkey');
        const zkeyFinal = path.join(buildDir, 'GenderVerification_final.zkey');
        const vkeyPath = path.join(buildDir, 'verification_key_gender.json');

        // Phase 1
        await execAsync(`snarkjs groth16 setup ${r1csPath} ${ptauPath} ${zkeyPath0}`);
        console.log('Phase 1 setup completed');

        // Phase 2 (contribution)
        await execAsync(`echo "random entropy text for gender" | snarkjs zkey contribute ${zkeyPath0} ${zkeyPath1} --name="First contribution" -v`);
        console.log('Phase 2 contribution completed');

        // Finalize
        await execAsync(`snarkjs zkey beacon ${zkeyPath1} ${zkeyFinal} 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"`);
        console.log('Final setup completed');

        // Export verification key
        await execAsync(`snarkjs zkey export verificationkey ${zkeyFinal} ${vkeyPath}`);
        console.log('Verification key exported');

        // Generate Solidity verifier
        const verifierPath = path.join(__dirname, '../contracts/GenderGroth16Verifier.sol');
        await execAsync(`snarkjs zkey export solidityverifier ${zkeyFinal} ${verifierPath}`);
        console.log('Solidity verifier generated');

        // Rename contract from Groth16Verifier to GenderGroth16Verifier
        let verifierContent = fs.readFileSync(verifierPath, 'utf8');
        verifierContent = verifierContent.replace(/contract Groth16Verifier/g, 'contract GenderGroth16Verifier');
        fs.writeFileSync(verifierPath, verifierContent);
        console.log('Contract renamed to GenderGroth16Verifier');

        console.log('\n✅ Gender Verification Circuit setup completed successfully!');
        console.log('Generated files:');
        console.log(`   - R1CS: ${r1csPath}`);
        console.log(`   - WASM: ${wasmPath}`);
        console.log(`   - Final zKey: ${zkeyFinal}`);
        console.log(`   - Verification Key: ${vkeyPath}`);
        console.log(`   - Solidity Verifier: ${verifierPath}`);

    } catch (error) {
        console.error('Error during Gender Verification circuit setup:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupGenderCircuit();
}

module.exports = { setupGenderCircuit };

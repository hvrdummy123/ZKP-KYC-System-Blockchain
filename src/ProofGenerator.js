const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
const { randomBytes } = require("crypto");

class ProofGenerator {
    constructor() {
        // Over18 paths
        this.over18WasmPath = path.join(__dirname, "../circuits/build/Over18_js/Over18.wasm");
        this.over18ZkeyPath = path.join(__dirname, "../circuits/build/Over18_final.zkey");
        
        // StateOfResidence paths
        this.stateWasmPath = path.join(__dirname, "../circuits/build/StateOfResidence_js/StateOfResidence.wasm");
        this.stateZkeyPath = path.join(__dirname, "../circuits/build/StateOfResidence_final.zkey");

        // GenderVerification paths
        this.genderWasmPath = path.join(__dirname, "../circuits/build/GenderVerification_js/GenderVerification.wasm");
        this.genderZkeyPath = path.join(__dirname, "../circuits/build/GenderVerification_final.zkey");

        this.poseidon = null;
    }

    async init() {
        this.poseidon = await circomlibjs.buildPoseidon();
    }

    // --- HASHING & DATA GENERATION ---

    generateAadhaarHash(aadhaarNumber, birthYear, birthMonth, birthDay, salt) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        const inputs = [ BigInt(aadhaarNumber), BigInt(birthYear), BigInt(birthMonth), BigInt(birthDay), BigInt(salt) ];
        return this.poseidon.F.toObject(this.poseidon(inputs));
    }

    generateStateCommitment(userState, stateSalt) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        const inputs = [ BigInt(userState), BigInt(stateSalt) ];
        return this.poseidon.F.toObject(this.poseidon(inputs));
    }

    generateStateCommitment(userState, stateSalt) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        const inputs = [ BigInt(userState), BigInt(stateSalt) ];
        return this.poseidon.F.toObject(this.poseidon(inputs));
    }

    generateGenderCommitment(userGender, genderSalt) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        const inputs = [ BigInt(userGender), BigInt(genderSalt) ];
        return this.poseidon.F.toObject(this.poseidon(inputs));
    }

    generateSecret() {
        return BigInt("0x" + randomBytes(31).toString("hex"));
    }

    generateSecretHash(secret) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        return this.poseidon.F.toObject(this.poseidon([secret]));
    }

    generateSalt() {
        return Math.floor(Math.random() * 1_000_000_000);
    }

    getCurrentDate() {
        const now = new Date();
        return {
            currentYear: now.getFullYear(),
            currentMonth: now.getMonth() + 1,
            currentDay: now.getDate()
        };
    }

    // --- PROOF GENERATION ---

    async generateOver18Proof(aadhaarData, secret, requestIdentifier, verifierIdentifier) {
        try {
            const { aadhaarNumber, birthYear, birthMonth, birthDay, salt } = aadhaarData;
            const currentDate = this.getCurrentDate();
            const aadhaarHash = this.generateAadhaarHash(aadhaarNumber, birthYear, birthMonth, birthDay, salt);
            const secretHash = this.generateSecretHash(secret);

            const circuitInput = {
                aadhaarNumber: BigInt(aadhaarNumber), birthYear: BigInt(birthYear), birthMonth: BigInt(birthMonth), birthDay: BigInt(birthDay), salt: BigInt(salt), secret: BigInt(secret),
                currentYear: BigInt(currentDate.currentYear), currentMonth: BigInt(currentDate.currentMonth), currentDay: BigInt(currentDate.currentDay), aadhaarHash: BigInt(aadhaarHash), secretHash: BigInt(secretHash), requestIdentifier: BigInt(requestIdentifier), verifierIdentifier: BigInt(verifierIdentifier)
            };

            const tmpDir = path.join(__dirname, "../tmp");
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
            const witnessPath = path.join(tmpDir, `witness_over18_${requestIdentifier}.wtns`);

            await snarkjs.wtns.calculate(circuitInput, this.over18WasmPath, witnessPath);
            const { proof, publicSignals } = await snarkjs.groth16.prove(this.over18ZkeyPath, witnessPath);
            return { proof, publicSignals, success: true };
        } catch (error) {
            console.error("Error generating Over18 proof:", error);
            return { error: error.message, success: false };
        }
    }

    async generateStateProof(stateData, secret, requestIdentifier, verifierIdentifier, requiredState) {
        try {
            if (!this.poseidon) await this.init();
            
            const { userState, stateSalt } = stateData;
            const stateCommitment = this.generateStateCommitment(userState, stateSalt);
            const secretHash = this.generateSecretHash(secret);

            const circuitInput = {
                // Private inputs
                userState: BigInt(userState),
                stateSalt: BigInt(stateSalt),
                secret: BigInt(secret),
                // Public inputs
                requiredState: BigInt(requiredState),
                requestIdentifier: BigInt(requestIdentifier),
                verifierIdentifier: BigInt(verifierIdentifier),
                stateCommitment: BigInt(stateCommitment),
                secretHash: BigInt(secretHash)
            };      

            const tmpDir = path.join(__dirname, "../tmp");
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
            const witnessPath = path.join(tmpDir, `witness_state_${requestIdentifier}.wtns`);

            await snarkjs.wtns.calculate(circuitInput, this.stateWasmPath, witnessPath);
            const { proof, publicSignals } = await snarkjs.groth16.prove(this.stateZkeyPath, witnessPath);
            return { proof, publicSignals, success: true };
        } catch (error) {
            console.error("Error generating State proof:", error);
            return { error: error.message, success: false };
        }
    }

    async generateGenderProof(genderData, secret, requestIdentifier, verifierIdentifier, requiredGender) {
        try {
            if (!this.poseidon) await this.init();
            
            const { userGender, genderSalt } = genderData;
            const genderCommitment = this.generateGenderCommitment(userGender, genderSalt);
            const secretHash = this.generateSecretHash(secret);

            // Generate nullifier from secret, requestId, and verifierId
            const nullifier = this.poseidon.F.toObject(this.poseidon([BigInt(secret), BigInt(requestIdentifier), BigInt(verifierIdentifier)]));

            const circuitInput = {
                // Private inputs
                userGender: BigInt(userGender),
                genderSalt: BigInt(genderSalt),
                secret: BigInt(secret),
                // Public inputs
                requiredGender: BigInt(requiredGender),
                requestIdentifier: BigInt(requestIdentifier),
                verifierIdentifier: BigInt(verifierIdentifier),
                genderCommitment: BigInt(genderCommitment),
                secretHash: BigInt(secretHash)
            };

            const tmpDir = path.join(__dirname, "../tmp");
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
            const witnessPath = path.join(tmpDir, `witness_gender_${requestIdentifier}.wtns`);

            await snarkjs.wtns.calculate(circuitInput, this.genderWasmPath, witnessPath);
            const { proof, publicSignals } = await snarkjs.groth16.prove(this.genderZkeyPath, witnessPath);
            return { proof, publicSignals, success: true };
        } catch (error) {
            console.error("Error generating Gender proof:", error);
            return { error: error.message, success: false };
        }
    }
}

module.exports = ProofGenerator;
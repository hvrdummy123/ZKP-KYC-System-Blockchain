// Browser-compatible proof generator
const snarkjs = require('snarkjs');

export class ProofGenerator {
  constructor() {
    this.poseidon = null;
  }

  async init() {
    // Dynamically import circomlibjs (browser-compatible)
    const { buildPoseidon } = await import('circomlibjs');
    this.poseidon = await buildPoseidon();
  }

  generateSalt() {
    // Generate random salt (BigInt)
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    let salt = 0n;
    for (let i = 0; i < 8; i++) {
      salt = (salt << 8n) | BigInt(randomBytes[i]);
    }
    return salt;
  }

  generateSecret() {
    return this.generateSalt(); // Same logic
  }

  generateAadhaarHash(aadhaarNumber, birthYear, birthMonth, birthDay, salt) {
    if (!this.poseidon) {
      throw new Error('Poseidon not initialized. Call init() first.');
    }

    const F = this.poseidon.F;
    const hash = this.poseidon([
      BigInt(aadhaarNumber),
      BigInt(birthYear),
      BigInt(birthMonth),
      BigInt(birthDay),
      BigInt(salt)
    ]);
    
    return F.toString(hash);
  }

  generateSecretHash(secret) {
    if (!this.poseidon) {
      throw new Error('Poseidon not initialized. Call init() first.');
    }

    const F = this.poseidon.F;
    const hash = this.poseidon([BigInt(secret)]);
    return F.toString(hash);
  }

  generateStateCommitment(stateCode, stateSalt) {
    if (!this.poseidon) {
      throw new Error('Poseidon not initialized. Call init() first.');
    }

    const F = this.poseidon.F;
    const commitment = this.poseidon([BigInt(stateCode), BigInt(stateSalt)]);
    return F.toString(commitment);
  }

  generateGenderCommitment(genderCode, genderSalt) {
    if (!this.poseidon) {
      throw new Error('Poseidon not initialized. Call init() first.');
    }

    const F = this.poseidon.F;
    const commitment = this.poseidon([BigInt(genderCode), BigInt(genderSalt)]);
    return F.toString(commitment);
  }

  // async generateOver18Proof(userData, secret, requestId, verifierAddress) {
  //   try {
  //     const today = new Date();
  //     // Prepare circuit inputs
  //     const input = {
  //       aadhaarNumber: userData.aadhaarNumber.toString(),
  //       birthYear: userData.birthYear.toString(),
  //       birthMonth: userData.birthMonth.toString(),
  //       birthDay: userData.birthDay.toString(),
  //       salt: userData.salt.toString(),
  //       secret: secret.toString(),
  //       // requestId: requestId.toString(),
  //       // verifier: BigInt(verifierAddress).toString()
  //       currentYear: today.getFullYear(),
  // currentMonth: today.getMonth() + 1,
  // currentDay: today.getDate(),
  //     };

  //     console.log('Generating proof with inputs:', input);

  //     // Generate proof using snarkjs
  //     const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  //       input,
  //       '/circuits/over18.wasm',
  //       '/circuits/over18_final.zkey'
  //     );

  //     console.log('Proof generated successfully');
  //     console.log('Public signals:', publicSignals);

  //     return {
  //       success: true,
  //       proof,
  //       publicSignals
  //     };

  //   } catch (error) {
  //     console.error('Proof generation error:', error);
  //     return {
  //       success: false,
  //       error: error.message
  //     };
  //   }
  // }

  async generateOver18Proof(userData, secret, requestId, verifierAddress) {
  try {
    if (!this.poseidon) await this.init();

    const today = new Date();

    // Hashes as per circuit requirements
    const aadhaarHash = this.generateAadhaarHash(
      userData.aadhaarNumber,
      userData.birthYear,
      userData.birthMonth,
      userData.birthDay,
      userData.salt
    );

    const secretHash = this.generateSecretHash(secret);

    // ✅ Match circuit input names EXACTLY
    const input = {
      aadhaarNumber: BigInt(userData.aadhaarNumber).toString(),
      birthYear: BigInt(userData.birthYear).toString(),
      birthMonth: BigInt(userData.birthMonth).toString(),
      birthDay: BigInt(userData.birthDay).toString(),
      salt: BigInt(userData.salt).toString(),
      secret: BigInt(secret).toString(),

      currentYear: BigInt(today.getFullYear()).toString(),
      currentMonth: BigInt(today.getMonth() + 1).toString(),
      currentDay: BigInt(today.getDate()).toString(),

      aadhaarHash: aadhaarHash.toString(),
      secretHash: secretHash.toString(),
      requestIdentifier: BigInt(requestId).toString(),
      verifierIdentifier: BigInt(verifierAddress).toString()
    };

    console.log('Generating proof with inputs:', input);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      '/circuits/Over18.wasm',
      '/circuits/Over18_final.zkey'
    );

    console.log('✅ Proof generated successfully');
    console.log('Public signals:', publicSignals);

    return { success: true, proof, publicSignals };

  } catch (error) {
    console.error('❌ Proof generation error:', error);
    return { success: false, error: error.message };
  }
}

  async generateStateProof(userData, secret, requestId, verifierAddress, requiredState) {
    try {
      if (!this.poseidon) await this.init();

      // Generate state commitment
      const stateCommitment = this.generateStateCommitment(
        userData.userState,
        userData.stateSalt
      );

      const secretHash = this.generateSecretHash(secret);

      // Match circuit input names EXACTLY
      const input = {
        userState: BigInt(userData.userState).toString(),
        stateSalt: BigInt(userData.stateSalt).toString(),
        secret: BigInt(secret).toString(),
        
        requiredState: BigInt(requiredState).toString(),
        requestIdentifier: BigInt(requestId).toString(),
        verifierIdentifier: BigInt(verifierAddress).toString(),
        
        stateCommitment: stateCommitment.toString(),
        secretHash: secretHash.toString()
      };

      console.log('Generating State proof with inputs:', input);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        '/circuits/StateOfResidence.wasm',
        '/circuits/StateOfResidence_final.zkey'
      );

      console.log('✅ State proof generated successfully');
      console.log('Public signals:', publicSignals);

      return { success: true, proof, publicSignals };

    } catch (error) {
      console.error('❌ State proof generation error:', error);
      return { success: false, error: error.message };
    }
  }

  async generateGenderProof(userData, secret, requestId, verifierAddress, requiredGender) {
    try {
      if (!this.poseidon) await this.init();

      // Generate gender commitment
      const F = this.poseidon.F;
      const genderCommitment = this.poseidon([
        BigInt(userData.userGender),
        BigInt(userData.genderSalt)
      ]);

      const secretHash = this.generateSecretHash(secret);

      // Match circuit input names EXACTLY
      const input = {
        userGender: BigInt(userData.userGender).toString(),
        genderSalt: BigInt(userData.genderSalt).toString(),
        secret: BigInt(secret).toString(),
        
        requiredGender: BigInt(requiredGender).toString(),
        requestIdentifier: BigInt(requestId).toString(),
        verifierIdentifier: BigInt(verifierAddress).toString(),
        
        genderCommitment: F.toString(genderCommitment),
        secretHash: secretHash.toString()
      };

      console.log('Generating Gender proof with inputs:', input);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        '/circuits/GenderVerification.wasm',
        '/circuits/GenderVerification_final.zkey'
      );

      console.log('✅ Gender proof generated successfully');
      console.log('Public signals:', publicSignals);

      return { success: true, proof, publicSignals };

    } catch (error) {
      console.error('❌ Gender proof generation error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Utility function to format proof for Solidity
export function formatProofForSolidity(proof) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]]
  };
}
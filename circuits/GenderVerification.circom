pragma circom 2.0.0;

include "poseidon.circom";
include "comparators.circom";

template GenderVerification() {
    // --- Private Inputs ---
    signal input userGender;
    signal input genderSalt;
    signal input secret;

    // --- Public Inputs ---
    signal input requiredGender;
    signal input requestIdentifier;
    signal input verifierIdentifier;
    signal input genderCommitment;
    signal input secretHash;

    // --- Outputs ---
    signal output matchesGender;
    signal output nullifierHash;

    // --- GENDER COMMITMENT VERIFICATION ---
    component genderHasher = Poseidon(2);
    genderHasher.inputs[0] <== userGender;
    genderHasher.inputs[1] <== genderSalt;
    genderHasher.out === genderCommitment;

    // --- SECRET HASH VERIFICATION ---
    component secretHasher = Poseidon(1);
    secretHasher.inputs[0] <== secret;
    secretHasher.out === secretHash;

    // --- NULLIFIER GENERATION ---
    // Create a one-time proof identifier.
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== requestIdentifier;
    nullifierHasher.inputs[2] <== verifierIdentifier;
    nullifierHash <== nullifierHasher.out;

    // --- GENDER MATCH VERIFICATION ---
    // Check if the user's private gender is equal to the public required gender.
    component genderEquals = IsEqual();
    genderEquals.in[0] <== userGender;
    genderEquals.in[1] <== requiredGender;
    matchesGender <== genderEquals.out;

    // --- CONSTRAINT: Ensure userGender is valid (1, 2, or 3) ---
    component isMale = IsEqual();
    isMale.in[0] <== userGender;
    isMale.in[1] <== 1;

    component isFemale = IsEqual();
    isFemale.in[0] <== userGender;
    isFemale.in[1] <== 2;

    component isTransgender = IsEqual();
    isTransgender.in[0] <== userGender;
    isTransgender.in[1] <== 3;
    signal validGender;
    validGender <== isMale.out + isFemale.out + isTransgender.out;
    validGender === 1;
}

// This main component now works because matchesGender and nullifierHash
// are outputs, not public inputs
component main { 
    public [ 
        requiredGender, 
        requestIdentifier, 
        verifierIdentifier, 
        genderCommitment, 
        secretHash 
    ] 
} = GenderVerification();

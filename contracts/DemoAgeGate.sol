// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DemoAttester.sol";
import "./Groth16Verifier.sol";

/**
 * @title DemoAgeGate
 * @notice DEMO ONLY — one-wallet flow: visitor proves "over 18" and claims a non-transferable pass.
 * Binds verifierIdentifier public signal to msg.sender (stops calldata replay by another account).
 */
contract DemoAgeGate {
    /// @dev BN254 scalar field — Circom inputs are reduced mod this; keep request ids in-range.
    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    DemoAttester public immutable attester;
    Groth16Verifier public immutable groth16Verifier;

    mapping(address => bool) public hasPass;
    mapping(uint256 => bool) public usedNullifiers;

    event PassClaimed(address indexed user, uint256 nullifier, bool isOver18);

    constructor(address _attester, address _verifier) {
        attester = DemoAttester(_attester);
        groth16Verifier = Groth16Verifier(_verifier);
    }

    /// @dev Deterministic demo request id for this user on this chain/contract (field-safe).
    function requestIdFor(address user) public view returns (uint256) {
        return uint256(keccak256(abi.encodePacked("demo-age", block.chainid, address(this), user)))
            % SNARK_SCALAR_FIELD;
    }

    function claimPass(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[9] calldata publicSignals
    ) external {
        require(attester.hasValidCard(msg.sender), "issue a mock ID first");
        require(!hasPass[msg.sender], "already claimed");

        uint256 nullifier = publicSignals[1];
        require(!usedNullifiers[nullifier], "nullifier used");

        (uint256 aadhaarHash, uint256 secretHash, , ) = attester.getPublicCommitments(msg.sender);
        require(publicSignals[5] == aadhaarHash, "aadhaar mismatch");
        require(publicSignals[6] == secretHash, "secret mismatch");
        require(publicSignals[7] == requestIdFor(msg.sender), "bad request id");
        require(publicSignals[8] == uint256(uint160(msg.sender)), "sender mismatch");
        require(!attester.isSecretHashRevoked(secretHash), "revoked");

        require(groth16Verifier.verifyProof(pA, pB, pC, publicSignals), "bad proof");

        usedNullifiers[nullifier] = true;
        bool over18 = publicSignals[0] == 1;
        if (over18) {
            hasPass[msg.sender] = true;
        }
        emit PassClaimed(msg.sender, nullifier, over18);
    }
}

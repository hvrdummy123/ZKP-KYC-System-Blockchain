// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GenderGroth16Verifier.sol";
import "./AttesterContract.sol";
import "./RoleRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GenderVerifier is Ownable {
    struct GenderVerificationRequest {
        address requester;
        address user;
        uint256 requiredGender; // 1 = Male, 2 = Female, 3 = Transgender
        uint256 requestTimestamp;
        bool isCompleted;
        bool result;
        uint256 fee;
    }
    
    AttesterContract public immutable attester;
    GenderGroth16Verifier public immutable groth16Verifier;
    RoleRegistry public immutable roleRegistry;
    
    mapping(uint256 => GenderVerificationRequest) public genderVerificationRequests;
    mapping(address => uint256[]) public userGenderRequests;
    mapping(address => uint256[]) public requesterGenderRequests;
    mapping(uint256 => bool) public usedGenderNullifiers;
    
    uint256 public nextGenderRequestId = 1;
    uint256 public genderVerificationFee = 0.001 ether;
    
    event GenderVerificationRequested(uint256 indexed requestId, address indexed requester, address indexed user, uint256 requiredGender, uint256 fee);
    event GenderVerificationCompleted(uint256 indexed requestId, address indexed user, bool result);
    event GenderVerificationRejected(uint256 indexed requestId, address indexed user);
    event GenderVerificationFeeUpdated(uint256 newFee);
    event GenderFeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _attester, address _groth16Verifier, address _roleRegistry) Ownable() {
        attester = AttesterContract(_attester);
        groth16Verifier = GenderGroth16Verifier(_groth16Verifier);
        roleRegistry = RoleRegistry(_roleRegistry);
    }

    /**
     * @dev Request gender verification for a user
     * @param user The address of the user to verify
     * @param gender The required gender (1 = Male, 2 = Female, 3 = Transgender)
     */
    function requestGenderVerification(address user, uint256 gender) public payable returns (uint256) {
        require(roleRegistry.isVerifier(msg.sender), "verifiers only");
        require(roleRegistry.isUser(user), "target must be user");
        require(msg.value >= genderVerificationFee, "Insufficient fee");
        require(attester.hasValidCard(user), "User has no valid Aadhaar card");
        require(gender >= 1 && gender <= 3, "Invalid gender value");
        
        uint256 requestId = nextGenderRequestId++;
        
        genderVerificationRequests[requestId] = GenderVerificationRequest({
            requester: msg.sender,
            user: user,
            requiredGender: gender,
            requestTimestamp: block.timestamp,
            isCompleted: false,
            result: false,
            fee: msg.value
        });
        
        userGenderRequests[user].push(requestId);
        requesterGenderRequests[msg.sender].push(requestId);
        
        emit GenderVerificationRequested(requestId, msg.sender, user, gender, msg.value);
        return requestId;
    }
    
    /**
     * @dev Complete gender verification by submitting ZK proof
     * @param requestId The ID of the verification request
     * @param pA Proof component A
     * @param pB Proof component B
     * @param pC Proof component C
     * @param publicSignals Public signals from the proof
     *        [0]: matchesGender (1 if match, 0 otherwise)
     *        [1]: nullifierHash
     *        [2]: requiredGender
     *        [3]: requestIdentifier
     *        [4]: verifierIdentifier
     *        [5]: genderCommitment (from AttesterContract)
     *        [6]: secretHash (from AttesterContract)
     */
    function completeGenderVerification(
        uint256 requestId,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[7] calldata publicSignals
    ) external {
        GenderVerificationRequest storage request = genderVerificationRequests[requestId];
        
        require(roleRegistry.isUser(msg.sender), "users only");
        require(request.user == msg.sender, "Only user can complete");
        require(!request.isCompleted, "Already completed");
        require(block.timestamp <= request.requestTimestamp + 1 days, "Expired");

        uint256 nullifierHash = publicSignals[1];
        require(!usedGenderNullifiers[nullifierHash], "Proof has already been used");
        
        (, uint256 userSecretHash, , uint256 userGenderCommitment) = attester.getPublicCommitments(msg.sender);
        require(!attester.isSecretHashRevoked(userSecretHash), "Credential has been revoked");
        
        require(publicSignals[2] == request.requiredGender, "Required gender mismatch");
        require(publicSignals[3] == requestId, "Request ID mismatch");
        require(publicSignals[4] == uint256(uint160(request.requester)), "Verifier ID mismatch");
        require(publicSignals[5] == userGenderCommitment, "Gender commitment mismatch");
        require(publicSignals[6] == userSecretHash, "Secret hash mismatch");
        
        bool proofValid = groth16Verifier.verifyProof(pA, pB, pC, publicSignals);
        require(proofValid, "Invalid ZK proof");
        
        usedGenderNullifiers[nullifierHash] = true;
        request.isCompleted = true;
        request.result = (publicSignals[0] == 1);
        
        emit GenderVerificationCompleted(requestId, msg.sender, request.result);
    }
    
    /**
     * @dev Get all gender verification requests for a user
     */
    function getUserGenderRequests(address user) external view returns (uint256[] memory) {
        return userGenderRequests[user];
    }
    
    /**
     * @dev Get all gender verification requests made by a requester
     */
    function getRequesterGenderRequests(address requester) external view returns (uint256[] memory) {
        return requesterGenderRequests[requester];
    }
    
    /**
     * @dev Update the gender verification fee (owner only)
     */
    function updateGenderVerificationFee(uint256 newFee) external onlyOwner {
        genderVerificationFee = newFee;
        emit GenderVerificationFeeUpdated(newFee);
    }
    
    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawGenderFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit GenderFeesWithdrawn(owner(), balance);
    }
    
    /**
     * @dev Get gender verification request details
     */
    function getGenderVerificationRequest(uint256 requestId) external view returns (
        address requester,
        address user,
        uint256 requiredGender,
        uint256 requestTimestamp,
        bool isCompleted,
        bool result,
        uint256 fee
    ) {
        GenderVerificationRequest storage request = genderVerificationRequests[requestId];
        return (
            request.requester,
            request.user,
            request.requiredGender,
            request.requestTimestamp,
            request.isCompleted,
            request.result,
            request.fee
        );
    }
}

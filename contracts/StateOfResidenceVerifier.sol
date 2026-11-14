// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./StateOfResidenceGroth16Verifier.sol";
import "./AttesterContract.sol";
import "./RoleRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StateOfResidenceVerifier is Ownable {
    struct StateVerificationRequest {
        address requester;
        address user;
        uint256 requiredState;
        uint256 requestTimestamp;
        bool isCompleted;
        bool result;
        uint256 fee;
    }
    
    AttesterContract public immutable attester;
    StateOfResidenceGroth16Verifier public immutable groth16Verifier;
    RoleRegistry public immutable roleRegistry;
    
    mapping(uint256 => StateVerificationRequest) public stateVerificationRequests;
    mapping(address => uint256[]) public userStateRequests;
    mapping(address => uint256[]) public requesterStateRequests;
    mapping(uint256 => bool) public usedStateNullifiers;
    
    uint256 public nextStateRequestId = 1;
    uint256 public stateVerificationFee = 0.001 ether;
    
    event StateVerificationRequested(uint256 indexed requestId, address indexed requester, address indexed user, uint256 requiredState, uint256 fee);
    event StateVerificationCompleted(uint256 indexed requestId, address indexed user, bool result);
    event StateVerificationRejected(uint256 indexed requestId, address indexed user);
    event StateVerificationFeeUpdated(uint256 newFee);
    event StateFeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _attester, address _groth16Verifier, address _roleRegistry) Ownable() {
        attester = AttesterContract(_attester);
        groth16Verifier = StateOfResidenceGroth16Verifier(_groth16Verifier);
        roleRegistry = RoleRegistry(_roleRegistry);
    }

    function requestStateVerification(address user, uint256 state) public payable returns (uint256) {
        require(roleRegistry.isVerifier(msg.sender), "verifiers only");
        require(roleRegistry.isUser(user), "target must be user");
        require(msg.value >= stateVerificationFee, "Insufficient fee");
        require(attester.hasValidCard(user), "User has no valid Aadhaar card");
        
        uint256 requestId = nextStateRequestId++;
        
        stateVerificationRequests[requestId] = StateVerificationRequest({
            requester: msg.sender,
            user: user,
            requiredState: state,
            requestTimestamp: block.timestamp,
            isCompleted: false,
            result: false,
            fee: msg.value
        });
        
        userStateRequests[user].push(requestId);
        requesterStateRequests[msg.sender].push(requestId);
        
        emit StateVerificationRequested(requestId, msg.sender, user, state, msg.value);
        return requestId;
    }
    
    function completeStateVerification(
        uint256 requestId,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[7] calldata publicSignals
    ) external {
        StateVerificationRequest storage request = stateVerificationRequests[requestId];
        
        require(roleRegistry.isUser(msg.sender), "users only");
        require(request.user == msg.sender, "Only user can complete");
        require(!request.isCompleted, "Already completed");
        require(block.timestamp <= request.requestTimestamp + 1 days, "Expired");

        uint256 nullifierHash = publicSignals[1];
        require(!usedStateNullifiers[nullifierHash], "Proof has already been used");
        
        (, uint256 userSecretHash, uint256 userStateCommitment, ) = attester.getPublicCommitments(msg.sender);
        require(!attester.isSecretHashRevoked(userSecretHash), "Credential has been revoked");
        
        require(publicSignals[2] == request.requiredState, "Required state mismatch");
        require(publicSignals[3] == requestId, "Request ID mismatch");
        require(publicSignals[4] == uint256(uint160(request.requester)), "Verifier ID mismatch");
        require(publicSignals[5] == userStateCommitment, "State commitment mismatch");
        require(publicSignals[6] == userSecretHash, "Secret hash mismatch");
        
        bool proofValid = groth16Verifier.verifyProof(pA, pB, pC, publicSignals);
        require(proofValid, "Invalid ZK proof");
        
        usedStateNullifiers[nullifierHash] = true;
        request.isCompleted = true;
        request.result = (publicSignals[0] == 1);
        
        emit StateVerificationCompleted(requestId, msg.sender, request.result);
        
        // User reward logic has been removed.
    }
    
    function rejectStateVerification(uint256 requestId) external {
        StateVerificationRequest storage request = stateVerificationRequests[requestId];
        
        require(request.user == msg.sender, "Only user can reject");
        require(!request.isCompleted, "Already completed");
        
        request.isCompleted = true;
        request.result = false;
        
        emit StateVerificationRejected(requestId, msg.sender);
        
        (bool sent, ) = request.requester.call{value: request.fee}("");
        require(sent, "Failed to refund requester");
    }
    
    function getStateVerificationResult(uint256 requestId) 
        external 
        view 
        returns (bool isCompleted, bool result) 
    {
        StateVerificationRequest memory request = stateVerificationRequests[requestId];
        require(
            request.requester == msg.sender || request.user == msg.sender,
            "Not authorized"
        );
        
        return (request.isCompleted, request.result);
    }
    
    function getPendingStateRequests(address user) external view returns (uint256[] memory) {
        uint256[] memory allRequests = userStateRequests[user];
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (!stateVerificationRequests[allRequests[i]].isCompleted) {
                pendingCount++;
            }
        }
        
        uint256[] memory pendingRequests = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (!stateVerificationRequests[allRequests[i]].isCompleted) {
                pendingRequests[index] = allRequests[i];
                index++;
            }
        }
        
        return pendingRequests;
    }
    
    function setStateVerificationFee(uint256 newFee) external onlyOwner {
        stateVerificationFee = newFee;
        emit StateVerificationFeeUpdated(newFee);
    }
    
    function withdrawStateFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool sent, ) = owner().call{value: balance}("");
        require(sent, "Failed to withdraw fees");

        emit StateFeesWithdrawn(owner(), balance);
    }
}
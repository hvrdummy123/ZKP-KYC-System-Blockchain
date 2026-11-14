// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AttesterContract is Ownable {
    
    struct AadhaarCard {
        uint256 aadhaarHash;
        uint256 secretHash;
        uint256 stateCommitment; // Hash(userState, stateSalt)
        uint256 genderCommitment; // Hash(userGender, genderSalt)
        uint256 issueTimestamp;
        bool isActive;
        string cardId;
    }
    
    mapping(address => AadhaarCard) public aadhaarCards;
    mapping(string => address) public cardToUser;
    mapping(uint256 => bool) public isSecretHashRevoked;

    event AadhaarCardIssued(
        address indexed user, 
        string cardId, 
        uint256 aadhaarHash
    );
    
    event AadhaarCardRevoked(address indexed user, string cardId, uint256 secretHash);
    
    constructor() Ownable() {}
    
    /**
     * @dev Issues a new Aadhaar card to a user.
     * @notice This is a privileged function restricted to the contract owner.
     * The security of the system relies on trusting the owner to issue valid credentials.
     * Consider using a multi-sig or DAO for decentralized governance in a production environment.
     */
    function issueAadhaarCard(
        address user,
        string memory cardId,
        uint256 aadhaarHash,
        uint256 secretHash,
        uint256 stateCommitment,
        uint256 genderCommitment
    ) external onlyOwner {
        require(bytes(cardId).length > 0, "Card ID cannot be empty");
        require(aadhaarHash != 0, "Invalid Aadhaar hash");
        require(secretHash != 0, "Invalid secret hash");
        require(stateCommitment != 0, "Invalid state commitment");
        require(genderCommitment != 0, "Invalid gender commitment");
        require(!aadhaarCards[user].isActive, "User already has active card");
        require(cardToUser[cardId] == address(0), "Card ID already exists");
        
        aadhaarCards[user] = AadhaarCard({
            aadhaarHash: aadhaarHash,
            secretHash: secretHash,
            stateCommitment: stateCommitment,
            genderCommitment: genderCommitment,
            issueTimestamp: block.timestamp,
            isActive: true,
            cardId: cardId
        });
        
        cardToUser[cardId] = user;
        
        emit AadhaarCardIssued(user, cardId, aadhaarHash);
    }
    
    /**
     * @dev Revokes a user's Aadhaar card.
     * @notice This is a privileged function restricted to the contract owner.
     * The owner has the power to censor users by revoking their credentials.
     * This trust assumption should be clearly communicated to all system participants.
     */
    function revokeAadhaarCard(address user) external onlyOwner {
        require(aadhaarCards[user].isActive, "User has no active card");
        
        AadhaarCard storage card = aadhaarCards[user];
        string memory cardId = card.cardId;
        uint256 secretHashToRevoke = card.secretHash;

        card.isActive = false;
        isSecretHashRevoked[secretHashToRevoke] = true;
        delete cardToUser[cardId];
        
        emit AadhaarCardRevoked(user, cardId, secretHashToRevoke);
    }
    
    /**
     * @dev A single, unified getter for all public commitments.
     */
    function getPublicCommitments(address user) external view returns (
        uint256 aadhaarHash_,
        uint256 secretHash_,
        uint256 stateCommitment_,
        uint256 genderCommitment_
    ) {
        require(aadhaarCards[user].isActive, "User has no active Aadhaar card");
        AadhaarCard storage card = aadhaarCards[user];
        return (card.aadhaarHash, card.secretHash, card.stateCommitment, card.genderCommitment);
    }
    
    function hasValidCard(address user) external view returns (bool) {
        return aadhaarCards[user].isActive;
    }
    
    function getCardDetails(address user) external view returns (AadhaarCard memory) {
        require(aadhaarCards[user].isActive, "User has no active card");
        return aadhaarCards[user];
    }
}
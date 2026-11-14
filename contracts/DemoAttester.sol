// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DemoAttester
 * @notice DEMO ONLY — anyone can self-issue a mock Government ID commitment.
 * Production would use a trusted issuer (see AttesterContract.onlyOwner).
 */
contract DemoAttester {
    struct Card {
        uint256 aadhaarHash;
        uint256 secretHash;
        uint256 stateCommitment;
        uint256 genderCommitment;
        uint256 issueTimestamp;
        bool isActive;
        string cardId;
    }

    mapping(address => Card) public cards;
    mapping(string => address) public cardToUser;
    mapping(uint256 => bool) public isSecretHashRevoked;

    event MockCredentialIssued(address indexed user, string cardId, uint256 aadhaarHash);
    event MockCredentialRevoked(address indexed user, string cardId);

    function selfIssue(
        string calldata cardId,
        uint256 aadhaarHash,
        uint256 secretHash,
        uint256 stateCommitment,
        uint256 genderCommitment
    ) external {
        require(bytes(cardId).length > 0, "empty card id");
        require(aadhaarHash != 0 && secretHash != 0, "bad hashes");
        require(stateCommitment != 0 && genderCommitment != 0, "bad commitments");
        require(!cards[msg.sender].isActive, "already has card");
        require(cardToUser[cardId] == address(0), "card id taken");

        cards[msg.sender] = Card({
            aadhaarHash: aadhaarHash,
            secretHash: secretHash,
            stateCommitment: stateCommitment,
            genderCommitment: genderCommitment,
            issueTimestamp: block.timestamp,
            isActive: true,
            cardId: cardId
        });
        cardToUser[cardId] = msg.sender;
        emit MockCredentialIssued(msg.sender, cardId, aadhaarHash);
    }

    function selfRevoke() external {
        require(cards[msg.sender].isActive, "no card");
        Card storage c = cards[msg.sender];
        string memory id = c.cardId;
        isSecretHashRevoked[c.secretHash] = true;
        c.isActive = false;
        delete cardToUser[id];
        emit MockCredentialRevoked(msg.sender, id);
    }

    function getPublicCommitments(address user)
        external
        view
        returns (uint256, uint256, uint256, uint256)
    {
        require(cards[user].isActive, "no active card");
        Card storage c = cards[user];
        return (c.aadhaarHash, c.secretHash, c.stateCommitment, c.genderCommitment);
    }

    function hasValidCard(address user) external view returns (bool) {
        return cards[user].isActive;
    }
}

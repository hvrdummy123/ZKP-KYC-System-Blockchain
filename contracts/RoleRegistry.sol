// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title RoleRegistry
 * @notice Single attester fixed at deploy. Everyone else picks User XOR Verifier once.
 *         Verifier = company; User = person — roles cannot be changed or stacked.
 */
contract RoleRegistry {
    enum Role {
        None,
        User,
        Verifier
    }

    address public immutable attester;
    mapping(address => Role) public roleOf;

    event Registered(address indexed account, Role role);

    constructor(address _attester) {
        require(_attester != address(0), "bad attester");
        attester = _attester;
    }

    function registerAsUser() external {
        _register(Role.User);
    }

    function registerAsVerifier() external {
        _register(Role.Verifier);
    }

    function _register(Role role) internal {
        require(msg.sender != attester, "attester is fixed");
        require(roleOf[msg.sender] == Role.None, "already registered");
        roleOf[msg.sender] = role;
        emit Registered(msg.sender, role);
    }

    function isUser(address account) public view returns (bool) {
        return roleOf[account] == Role.User;
    }

    function isVerifier(address account) public view returns (bool) {
        return roleOf[account] == Role.Verifier;
    }

    function isAttester(address account) public view returns (bool) {
        return account == attester;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, ERC20Permit, Ownable {
    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(msg.sender)
    {}

    function mint(address _to, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount should be Positive");
        _mint(_to, amount);
    }

    function burn(address _from, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount should be Positive");
        _burn(_from, amount);
    }
}

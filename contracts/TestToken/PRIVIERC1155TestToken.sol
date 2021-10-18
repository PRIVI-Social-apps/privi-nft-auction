// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PRIVIERC1155TestToken is ERC1155, Ownable {

    constructor() ERC1155("PRIVIERC721TestToken") {
    }

    function safeMint(address _to, uint _tokenId, uint _amount) public onlyOwner {
        _mint(_to, _tokenId, _amount, "");
    }

    function burn(address _owner, uint _tokenId, uint amount) external{
        require(_owner == msg.sender || isApprovedForAll(_owner, msg.sender) == true, "Ownership or approval required");
        _burn(_owner, _tokenId, amount);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PRIVIERC721TestToken is ERC721, Ownable {

    constructor() ERC721("PRIVIERC721TestToken", "PRIVIERC721Test") {
    }

    function safeMint(address _to, uint _tokenId) public onlyOwner {
        _safeMint(_to, _tokenId);
    }

    function burn(uint _tokenId) external{
        require(_isApprovedOrOwner(msg.sender,_tokenId), "Ownership or approval required");
        _burn(_tokenId);
    }
}
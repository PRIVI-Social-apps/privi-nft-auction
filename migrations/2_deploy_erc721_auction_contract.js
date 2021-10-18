const ERC721Auction = artifacts.require("ERC721Auction");
const PRIVIERC721TestToken = artifacts.require("PRIVIERC721TestToken");

module.exports = async function (deployer) {
    await deployer.deploy(
        ERC721Auction,
    );
};
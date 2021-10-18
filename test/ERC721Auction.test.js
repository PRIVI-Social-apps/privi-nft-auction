const ERC721Auction = artifacts.require("ERC721Auction");
const PRIVIERC20TestToken  = artifacts.require("PRIVIERC20TestToken");
const PRIVIERC721TestToken = artifacts.require("PRIVIERC721TestToken");
const PRIVIERC1155TestToken = artifacts.require("PRIVIERC1155TestToken");
const { BN, time } = require("web3-utils");

contract("ERC721Auction for ERC721", (accounts) => {
    var erc721auction_contract;
    var privierc20testtoken_contract;
    var privierc721testtoken_contract;
    const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
    const startBidPrice = new BN('100000000000000000');
    var tokenContractAddress;

    before(async () => {
        privierc20testtoken_contract = await PRIVIERC20TestToken.new({ from: accounts[0] });
        privierc721testtoken_contract = await PRIVIERC721TestToken.new({ from: accounts[0] });

        tokenContractAddress = privierc721testtoken_contract.address;
        erc721auction_contract = await ERC721Auction.new({ from: accounts[0] });
        await privierc721testtoken_contract.safeMint(accounts[1], tokenId);
        await privierc20testtoken_contract.mint(accounts[2], new BN('1000000000000000000'));
    })

    describe("createAuction", () => {
        it("creating auction not working if caller has not approved", async () => {
            let thrownError;
            try {
                await erc721auction_contract.createAuction(
                    1,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '0',
                    '1716922014',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: Owner has not approved',
            )
        })

        it("creating auction not working if caller is not the owner", async () => {
            let thrownError;
            try {
                await privierc721testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[2]}
                );
                await erc721auction_contract.createAuction(
                    1,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '0',
                    '1716922014',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: Caller is not the owner',
            )
        })

        it("creating auction not working if end time is not greater than start", async () => {
            let thrownError;
            try {
                await privierc721testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[1]}
                );
                await erc721auction_contract.createAuction(
                    1,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '1716922014',
                    '0',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time must be greater than start',
            )
        })

        it("creating auction not working if end time is not greater than start", async () => {
            let thrownError;
            try {
                await privierc721testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[1]}
                );
                await erc721auction_contract.createAuction(
                    1,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '1716922014',
                    '0',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time must be greater than start',
            )
        })

        it("creating auction not working if end time passed", async () => {
            let thrownError;
            try {
                await privierc721testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[1]}
                );
                await erc721auction_contract.createAuction(
                    1,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    parseInt(Date.now()/1000) - 1000000,
                    parseInt(Date.now()/1000) - 10000,
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time passed. Nobody can bid',
            )
        })

        it("works well", async () => {
            await privierc721testtoken_contract.setApprovalForAll(
                erc721auction_contract.address, 
                true, 
                {from: accounts[1]}
            );
            await erc721auction_contract.createAuction(
                1,
                tokenContractAddress,
                tokenId,
                startBidPrice,
                parseInt(Date.now()/1000) - 10,
                parseInt(Date.now()/1000) + 10,
                10,
                privierc20testtoken_contract.address,
                { from: accounts[1] }
            );

            const auction = await erc721auction_contract.getAuction(tokenContractAddress, tokenId);
            assert.equal(auction.created, true);
        })
    })

    describe("placeBid", () => {
        it("place bid not working if auction does not exist", async () => {
            let thrownError;
            const bidPrice = startBidPrice.add(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
                    bidPrice,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        })

        it("place bid not working if contracts permitted", async () => {
            let thrownError;
            const bidPrice = startBidPrice.add(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    tokenId,
                    bidPrice.toString(),
                    { from: erc721auction_contract.address }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: No contracts permitted',
            )
        })

        it("place bid not working if Bid amount is not higher than start price", async () => {
            let thrownError;
            const bidPrice = startBidPrice.sub(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    tokenId,
                    bidPrice.toString(),
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: Bid amount should be higher than start price',
            )
        })

        it("works well if first bid", async () => {
            const bidPrice = startBidPrice.add(new BN('10000'));
            await privierc20testtoken_contract.approve(
                erc721auction_contract.address, 
                bidPrice.toString(), 
                {from: accounts[2] }
            );

            await erc721auction_contract.placeBid(
                tokenContractAddress,
                tokenId,
                bidPrice.toString(),
                { from: accounts[2] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(erc721auction_contract.address);
            assert.equal(bidPrice.toString(), balance.toString());
        })

        it("place bid not working if outbid highest bidder", async () => {
            let thrownError;
            const bidPrice = startBidPrice.add(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    tokenId,
                    bidPrice.toString(),
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: Failed to outbid highest bidder',
            )
        })

        it("works well if not first bid", async () => {
            const bidPrice = startBidPrice.add(new BN('20000'));
            await privierc20testtoken_contract.approve(
                erc721auction_contract.address, 
                bidPrice.mul(new BN('2')).toString(), 
                {from: accounts[2] }
            );

            await erc721auction_contract.placeBid(
                tokenContractAddress,
                tokenId,
                bidPrice.toString(),
                { from: accounts[2] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(erc721auction_contract.address);
            assert.equal(bidPrice.toString(), balance.toString());
        })
    })

    describe("withdrawFunds", () => {
        it("withdraw funds not working if auction does not exist", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.withdrawFunds(
                    tokenContractAddress,
                    "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
                    withdrawAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        })

        it("withdraw funds not working if not auction owner", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.withdrawFunds(
                    tokenContractAddress,
                    tokenId,
                    withdrawAmount,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyAuctionOwner: not auction owner',
            )
        })
        
        it("withdraw funds not working if not enough funds", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.mul(new BN('2'));
            try {
                await erc721auction_contract.withdrawFunds(
                    tokenContractAddress,
                    tokenId,
                    withdrawAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.withdrawFunds: not enough funds',
            )
        })

        it("works well", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.add(new BN('20000'));
            await erc721auction_contract.withdrawFunds(
                tokenContractAddress,
                tokenId,
                withdrawAmount,
                { from: accounts[1] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(accounts[1]);
            assert.equal(balance.toString(), withdrawAmount.toString());
        })
    })

    describe("returnFunds", () => {
        it("return funds not working if auction does not exist", async () => {
            let thrownError;
            const returnAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.returnFunds(
                    tokenContractAddress,
                    "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
                    returnAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        })

        it("return funds not working if not auction owner", async () => {
            let thrownError;
            const returnAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.returnFunds(
                    tokenContractAddress,
                    tokenId,
                    returnAmount,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyAuctionOwner: not auction owner',
            )
        })

        it("return funds not working if auction owner has not enough return amount", async () => {
            let thrownError;
            const returnAmount = startBidPrice.mul(new BN('2'));
            try {
                await erc721auction_contract.returnFunds(
                    tokenContractAddress,
                    tokenId,
                    returnAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.returnFunds: auction owner has not enough return amount',
            )
        })

        it("works well", async () => {
            const returnAmount = startBidPrice.add(new BN('10000'));

            await privierc20testtoken_contract.approve(
                erc721auction_contract.address, 
                returnAmount, 
                { from: accounts[1] }
            );

            await erc721auction_contract.returnFunds(
                tokenContractAddress,
                tokenId,
                returnAmount,
                { from: accounts[1] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(accounts[1]);
            assert.equal(balance.toNumber(), new BN('10000'));
        })
    })

    describe("endAuction", () => {
        it("works well", async () => {

            function timeout(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
        
            await timeout(10000);

            await erc721auction_contract.endAuction(
                tokenContractAddress,
                tokenId,
                { from: accounts[1] }
            );

            const owner = await privierc721testtoken_contract.ownerOf(tokenId);
            assert.equal(owner, accounts[2]);
        })
    })
})

contract("ERC721Auction for ERC1155", (accounts) => {
    var erc721auction_contract;
    var privierc20testtoken_contract;
    var privierc1155testtoken_contract;
    const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
    const startBidPrice = new BN('100000000000000000');
    var tokenContractAddress;

    before(async () => {
        privierc20testtoken_contract = await PRIVIERC20TestToken.new({ from: accounts[0] });
        privierc1155testtoken_contract = await PRIVIERC1155TestToken.new({ from: accounts[0] });

        tokenContractAddress = privierc1155testtoken_contract.address;
        erc721auction_contract = await ERC721Auction.new({ from: accounts[0] });
        await privierc1155testtoken_contract.safeMint(accounts[1], tokenId, 1);
        await privierc20testtoken_contract.mint(accounts[2], new BN('1000000000000000000'));
    })

    describe("createAuction", () => {
        it("creating auction not working if caller has not approved", async () => {
            let thrownError;
            try {
                await erc721auction_contract.createAuction(
                    2,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '0',
                    '1716922014',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: Owner has not approved',
            )
        })

        it("creating auction not working if caller is not the owner", async () => {
            let thrownError;
            try {
                await privierc1155testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[2]}
                );
                await erc721auction_contract.createAuction(
                    2,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '0',
                    '1716922014',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: Caller is not the owner',
            )
        })

        it("creating auction not working if end time is not greater than start", async () => {
            let thrownError;
            try {
                await privierc1155testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[1]}
                );
                await erc721auction_contract.createAuction(
                    2,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '1716922014',
                    '0',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time must be greater than start',
            )
        })

        it("creating auction not working if end time is not greater than start", async () => {
            let thrownError;
            try {
                await privierc1155testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[1]}
                );
                await erc721auction_contract.createAuction(
                    2,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    '1716922014',
                    '0',
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time must be greater than start',
            )
        })

        it("creating auction not working if end time passed", async () => {
            let thrownError;
            try {
                await privierc1155testtoken_contract.setApprovalForAll(
                    erc721auction_contract.address, 
                    true, 
                    {from: accounts[1]}
                );
                await erc721auction_contract.createAuction(
                    2,
                    tokenContractAddress,
                    tokenId,
                    startBidPrice,
                    parseInt(Date.now()/1000) - 1000000,
                    parseInt(Date.now()/1000) - 10000,
                    10,
                    privierc20testtoken_contract.address,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time passed. Nobody can bid',
            )
        })

        it("works well", async () => {
            await privierc1155testtoken_contract.setApprovalForAll(
                erc721auction_contract.address, 
                true, 
                {from: accounts[1]}
            );
            await erc721auction_contract.createAuction(
                2,
                tokenContractAddress,
                tokenId,
                startBidPrice,
                parseInt(Date.now()/1000) - 10,
                parseInt(Date.now()/1000) + 10,
                10,
                privierc20testtoken_contract.address,
                { from: accounts[1] }
            );

            const auction = await erc721auction_contract.getAuction(tokenContractAddress, tokenId);
            assert.equal(auction.created, true);
        })
    })

    describe("placeBid", () => {
        it("place bid not working if auction does not exist", async () => {
            let thrownError;
            const bidPrice = startBidPrice.add(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
                    bidPrice,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        })

        it("place bid not working if contracts permitted", async () => {
            let thrownError;
            const bidPrice = startBidPrice.add(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    tokenId,
                    bidPrice.toString(),
                    { from: erc721auction_contract.address }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: No contracts permitted',
            )
        })

        it("place bid not working if Bid amount is not higher than start price", async () => {
            let thrownError;
            const bidPrice = startBidPrice.sub(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    tokenId,
                    bidPrice.toString(),
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: Bid amount should be higher than start price',
            )
        })

        it("works well if first bid", async () => {
            const bidPrice = startBidPrice.add(new BN('10000'));
            await privierc20testtoken_contract.approve(
                erc721auction_contract.address, 
                bidPrice.toString(), 
                {from: accounts[2] }
            );

            await erc721auction_contract.placeBid(
                tokenContractAddress,
                tokenId,
                bidPrice.toString(),
                { from: accounts[2] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(erc721auction_contract.address);
            assert.equal(bidPrice.toString(), balance.toString());
        })

        it("place bid not working if outbid highest bidder", async () => {
            let thrownError;
            const bidPrice = startBidPrice.add(new BN('10000'));
            try {
                await erc721auction_contract.placeBid(
                    tokenContractAddress,
                    tokenId,
                    bidPrice.toString(),
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: Failed to outbid highest bidder',
            )
        })

        it("works well if not first bid", async () => {
            const bidPrice = startBidPrice.add(new BN('20000'));
            await privierc20testtoken_contract.approve(
                erc721auction_contract.address, 
                bidPrice.mul(new BN('2')).toString(), 
                {from: accounts[2] }
            );

            await erc721auction_contract.placeBid(
                tokenContractAddress,
                tokenId,
                bidPrice.toString(),
                { from: accounts[2] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(erc721auction_contract.address);
            assert.equal(bidPrice.toString(), balance.toString());
        })
    })

    describe("withdrawFunds", () => {
        it("withdraw funds not working if auction does not exist", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.withdrawFunds(
                    tokenContractAddress,
                    "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
                    withdrawAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        })

        it("withdraw funds not working if not auction owner", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.withdrawFunds(
                    tokenContractAddress,
                    tokenId,
                    withdrawAmount,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyAuctionOwner: not auction owner',
            )
        })
        
        it("withdraw funds not working if not enough funds", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.mul(new BN('2'));
            try {
                await erc721auction_contract.withdrawFunds(
                    tokenContractAddress,
                    tokenId,
                    withdrawAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.withdrawFunds: not enough funds',
            )
        })

        it("works well", async () => {
            let thrownError;
            const withdrawAmount = startBidPrice.add(new BN('20000'));
            await erc721auction_contract.withdrawFunds(
                tokenContractAddress,
                tokenId,
                withdrawAmount,
                { from: accounts[1] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(accounts[1]);
            assert.equal(balance.toString(), withdrawAmount.toString());
        })
    })

    describe("returnFunds", () => {
        it("return funds not working if auction does not exist", async () => {
            let thrownError;
            const returnAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.returnFunds(
                    tokenContractAddress,
                    "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
                    returnAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        })

        it("return funds not working if not auction owner", async () => {
            let thrownError;
            const returnAmount = startBidPrice.add(new BN('20000'));
            try {
                await erc721auction_contract.returnFunds(
                    tokenContractAddress,
                    tokenId,
                    returnAmount,
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyAuctionOwner: not auction owner',
            )
        })

        it("return funds not working if auction owner has not enough return amount", async () => {
            let thrownError;
            const returnAmount = startBidPrice.mul(new BN('2'));
            try {
                await erc721auction_contract.returnFunds(
                    tokenContractAddress,
                    tokenId,
                    returnAmount,
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.returnFunds: auction owner has not enough return amount',
            )
        })

        it("works well", async () => {
            const returnAmount = startBidPrice.add(new BN('10000'));

            await privierc20testtoken_contract.approve(
                erc721auction_contract.address, 
                returnAmount, 
                { from: accounts[1] }
            );

            await erc721auction_contract.returnFunds(
                tokenContractAddress,
                tokenId,
                returnAmount,
                { from: accounts[1] }
            );

            const balance = await privierc20testtoken_contract.balanceOf(accounts[1]);
            assert.equal(balance.toNumber(), new BN('10000'));
        })
    })

    describe("endAuction", () => {
        it("works well", async () => {

            function timeout(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
        
            await timeout(10000);

            await erc721auction_contract.endAuction(
                tokenContractAddress,
                tokenId,
                { from: accounts[1] }
            );

            const balance = await privierc1155testtoken_contract.balanceOf(accounts[2], tokenId);
            assert.equal(balance.toNumber(), 1);
        })
    })
})
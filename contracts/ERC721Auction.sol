// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract ERC721Auction is Context, IERC721Receiver, IERC1155Receiver, ReentrancyGuard {
    using SafeMath for uint256;
    using Address for address;

    /// @notice Event emitted only on construction. To be used by indexers
    event AuctionCreated(uint tokenType, address indexed tokenContractAddress, uint256 indexed tokenId);
    event AuctionEnded(uint tokenType, address indexed tokenContractAddress, uint256 indexed tokenId);

    event BidPlaced(
        uint tokenType,
        address indexed tokenContractAddress,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 bidAmount
    );

    event FundWithdrawn(
        uint tokenType,
        address indexed tokenContractAddress,
        uint256 indexed tokenId,
        address indexed owner,
        uint256 withdrawAmount
    );

    event FundReturned(
        uint tokenType,
        address indexed tokenContractAddress,
        uint256 indexed tokenId,
        address indexed owner,
        uint256 returnAmount
    );

    /// @notice Parameters of an auction
    struct Auction {
        uint tokenType;
        address owner;
        uint256 startPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 fee; // percent
        address fundTokenAddress;
        bool created;
    }

    /// @notice Information about the sender that placed a bid on an auction
    struct Bid {
        address bidder;
        uint256 bidAmount;
        uint256 actualBidAmount;
        uint256 bidTime;
    }

    /// @notice ERC721 Token Contract Address => Token ID -> Auction Parameters
    mapping(address => mapping(uint256 => Auction)) public auctions;
    mapping(address => mapping(uint256 => uint256)) public availableFunds;

    /// @notice ERC721 Token ID -> bidder info (if a bid has been received)
    mapping(address => mapping(uint256 => Bid[])) public bids;

    modifier onlyCreatedAuction(address _tokenContractAddress, uint256 _tokenId) {
        require(
            auctions[_tokenContractAddress][_tokenId].created == true,
            "Auction.onlyCreatedAuction: Auction does not exist"
        );
        _;
    }

    modifier onlyAuctionOwner(address _tokenContractAddress, uint256 _tokenId) {
        require(
            auctions[_tokenContractAddress][_tokenId].owner == _msgSender(),
            "Auction.onlyAuctionOwner: not auction owner"
        );
        _;
    }

    /**
     * @notice Creates a new auction for a given token
     * @dev Only the owner of a token can create an auction and must have approved the contract
     * @dev End time for the auction must be in the future.
     * @param _tokenId Token ID of the token being auctioned
     * @param _startTimestamp Unix epoch in seconds for the auction start time
     * @param _endTimestamp Unix epoch in seconds for the auction end time.
     * @param _fee percent which will be paid as a fee to the individual who provides the hightest loan amount
     */
    function createAuction(
        uint tokenType,
        address _tokenContractAddress,
        uint256 _tokenId,
        uint256 _startPrice,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _fee,
        address _fundTokenAddress
    ) external {
        // Check owner of the token is the creator and approved
        require((tokenType == 1) || (tokenType == 2), "Auction.createAuction: token type is not valid");
        if(tokenType == 1) {
            require(
                IERC721(_tokenContractAddress).isApprovedForAll(_msgSender(), address(this)),
                "Auction.createAuction: Owner has not approved"
            );
            require(
                IERC721(_tokenContractAddress).ownerOf(_tokenId) == _msgSender(),
                "Auction.createAuction: Caller is not the owner"
            );
        } else {
            require(
                IERC1155(_tokenContractAddress).isApprovedForAll(_msgSender(), address(this)),
                "Auction.createAuction: Owner has not approved"
            );
            require(
                IERC1155(_tokenContractAddress).balanceOf(_msgSender(), _tokenId) != 0,
                "Auction.createAuction: Caller is not the owner"
            );
        }

        _createAuction(tokenType, _tokenContractAddress ,_tokenId, _startPrice,_startTimestamp, _endTimestamp, _fee, _fundTokenAddress);

        emit AuctionCreated(tokenType, _tokenContractAddress, _tokenId);
    }

    /**
     * @notice Places a new bid, out bidding the existing bidder if found and criteria is reached
     * @dev Only callable when the auction is open
     * @dev Bids from smart contracts are prohibited to prevent griefing with always reverting receiver
     * @param _tokenId Token ID of the token being auctioned
     */
    function placeBid(address _tokenContractAddress, uint256 _tokenId, uint256 _bidAmount)
        external
        nonReentrant
        onlyCreatedAuction(_tokenContractAddress, _tokenId)
    {
        require(
            _msgSender().isContract() == false,
            "Auction.placeBid: No contracts permitted"
        );

        // Ensure auction is in flight
        require(
            _getNow() >= auctions[_tokenContractAddress][_tokenId].startTime 
                && _getNow() <= auctions[_tokenContractAddress][_tokenId].endTime,
            "Auction.placeBid: Bidding outside of the auction window"
        );

        _placeBid(_tokenContractAddress, _tokenId, _bidAmount);

        emit BidPlaced(auctions[_tokenContractAddress][_tokenId].tokenType, _tokenContractAddress, _tokenId, _msgSender(), _bidAmount);
    }

    /**
     * @notice withdraw funds which deposit by bidders
     * @dev Only callable when the auction is open
     * @dev Only callable by auction owner
     * @param _tokenId Token ID of the token being auctioned
     * @param _withdrawAmount withdraw amount which owner want to withdraw
     */
    function withdrawFunds(address _tokenContractAddress, uint256 _tokenId, uint256 _withdrawAmount)
        external
        nonReentrant
        onlyCreatedAuction(_tokenContractAddress, _tokenId)
        onlyAuctionOwner(_tokenContractAddress, _tokenId)
    {
        require(
            availableFunds[_tokenContractAddress][_tokenId] >= _withdrawAmount,
            "Auction.withdrawFunds: not enough funds"
        );

        IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress)
            .transfer(auctions[_tokenContractAddress][_tokenId].owner, _withdrawAmount);

        availableFunds[_tokenContractAddress][_tokenId] -= _withdrawAmount;

        emit FundWithdrawn(auctions[_tokenContractAddress][_tokenId].tokenType, _tokenContractAddress, _tokenId, _msgSender(), _withdrawAmount);
    }

    /**
     * @notice return funds which deposit by bidders
     * @dev Only callable when the auction is open
     * @dev Only callable by auction owner
     * @param _tokenId Token ID of the token being auctioned
     * @param _returnAmount return amount which owner want to return
     */
    function returnFunds(address _tokenContractAddress, uint256 _tokenId, uint256 _returnAmount)
        external
        nonReentrant
        onlyCreatedAuction(_tokenContractAddress, _tokenId)
        onlyAuctionOwner(_tokenContractAddress, _tokenId)
    {
        require(
            IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress)
                .balanceOf(auctions[_tokenContractAddress][_tokenId].owner) >= _returnAmount,
            "Auction.returnFunds: auction owner has not enough return amount"
        );

        IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress)
            .transferFrom(auctions[_tokenContractAddress][_tokenId].owner, address(this), _returnAmount);

        availableFunds[_tokenContractAddress][_tokenId] += _returnAmount;

        emit FundReturned(auctions[_tokenContractAddress][_tokenId].tokenType, _tokenContractAddress, _tokenId, _msgSender(), _returnAmount);
    }

    /**
     * @notice end Auction if time is over
     * @param _tokenId Token ID of the token being auctioned
     */
    function endAuction(address _tokenContractAddress, uint256 _tokenId) 
        external 
        nonReentrant
        onlyCreatedAuction(_tokenContractAddress, _tokenId)
    {
        Auction memory auction = auctions[_tokenContractAddress][_tokenId];

        // Check the auction real
        require(
            auction.endTime > 0,
            "Auction.endAuction: Auction does not exist"
        );

        // Check the auction has ended
        require(
            _getNow() > auction.endTime,
            "Auction.endAuction: The auction has not ended"
        );

        // Ensure this contract is approved to move the token
        if(auctions[_tokenContractAddress][_tokenId].tokenType == 1) {
            require(
                IERC721(_tokenContractAddress).isApprovedForAll(auction.owner, address(this)),
                "Auction.endAuction: auction not approved"
            );
        } else {
            require(
                IERC721(_tokenContractAddress).isApprovedForAll(auction.owner, address(this)),
                "Auction.createAuction: Owner has not approved"
            );
        }

        Bid[] storage bidList = bids[_tokenContractAddress][_tokenId];
        require(bidList.length > 0, "Auction.endAuction: no bid exist");

        uint256 benefit;
        benefit = bidList[bidList.length - 1].actualBidAmount.mul(auctions[_tokenContractAddress][_tokenId].fee).div(100)
            .mul(_getNow().sub(auctions[_tokenContractAddress][_tokenId].startTime))
            .div(auctions[_tokenContractAddress][_tokenId].endTime.sub(auctions[_tokenContractAddress][_tokenId].startTime));
        uint256 returnFund = bidList[bidList.length - 1].actualBidAmount + benefit;

        if(availableFunds[_tokenContractAddress][_tokenId] < returnFund) {
            if(auctions[_tokenContractAddress][_tokenId].tokenType == 1) {
                IERC721(_tokenContractAddress).safeTransferFrom(address(this), bidList[bidList.length - 1].bidder, _tokenId);
            } else {
                IERC1155(_tokenContractAddress).safeTransferFrom(address(this), bidList[bidList.length - 1].bidder, _tokenId, 1, "");
            }
            IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress)
                .transfer(auctions[_tokenContractAddress][_tokenId].owner, availableFunds[_tokenContractAddress][_tokenId]);
            availableFunds[_tokenContractAddress][_tokenId] = 0;
        } else {
            IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress)
                .transferFrom(address(this), bidList[bidList.length - 1].bidder, returnFund);
            availableFunds[_tokenContractAddress][_tokenId] -= returnFund;
            if(auctions[_tokenContractAddress][_tokenId].tokenType == 1) {
                IERC721(_tokenContractAddress).safeTransferFrom(address(this), auctions[_tokenContractAddress][_tokenId].owner, _tokenId);
            } else {
                IERC1155(_tokenContractAddress)
                    .safeTransferFrom(address(this), auctions[_tokenContractAddress][_tokenId].owner, _tokenId, 1, "");
            }
            IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress)
                .transfer(auctions[_tokenContractAddress][_tokenId].owner, availableFunds[_tokenContractAddress][_tokenId]);
            availableFunds[_tokenContractAddress][_tokenId] = 0;
        }

        // Clean up the highest bid
        delete bids[_tokenContractAddress][_tokenId];
        delete auctions[_tokenContractAddress][_tokenId];
        delete availableFunds[_tokenContractAddress][_tokenId];
        
        emit AuctionEnded(auctions[_tokenContractAddress][_tokenId].tokenType, _tokenContractAddress, _tokenId);
    }

    /**
     * @notice Method for getting all info about the auction
     * @param _tokenId Token ID of the token being auctioned
     */
    function getAuction(address _tokenContractAddress, uint256 _tokenId)
        external
        view
        onlyCreatedAuction(_tokenContractAddress, _tokenId)
        returns (Auction memory)
    {
        return auctions[_tokenContractAddress][_tokenId];
    }

    /**
     * @notice Method for getting all info about the bids
     * @param _tokenId Token ID of the token being auctioned
     */
    function getBidList(address _tokenContractAddress, uint256 _tokenId) public view returns (Bid[] memory) {
        return bids[_tokenContractAddress][_tokenId];
    }

    /**
     * @notice Method for getting available funds by tokenId
     * @param _tokenId Token ID of the token being auctioned
     */
    function getAvailableFunds(address _tokenContractAddress, uint256 _tokenId) public view returns (uint) {
        return availableFunds[_tokenContractAddress][_tokenId];
    }

    function _getNow() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    function _createAuction(
        uint tokenType,
        address _tokenContractAddress,
        uint256 _tokenId,
        uint256 _startPrice,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _fee,
        address _fundTokenAddress
    ) private {
        // Check the auction alreay created
        require(
            auctions[_tokenContractAddress][_tokenId].created == false,
            "Auction.createAuction: Auction has been already created"
        );
        // Check end time not before start time and that end is in the future
        require(
            _endTimestamp > _startTimestamp,
            "Auction.createAuction: End time must be greater than start"
        );
        require(
            _endTimestamp > _getNow(),
            "Auction.createAuction: End time passed. Nobody can bid"
        );

        // Setup the auction
        auctions[_tokenContractAddress][_tokenId] = Auction({
            tokenType: tokenType,
            owner: _msgSender(),
            startPrice: _startPrice,
            startTime: _startTimestamp,
            endTime: _endTimestamp,
            fee: _fee,
            fundTokenAddress: _fundTokenAddress, 
            created: true
        });
        if(tokenType == 1) {
            IERC721(_tokenContractAddress).safeTransferFrom(_msgSender(), address(this), _tokenId);
        } else {
            IERC1155(_tokenContractAddress).safeTransferFrom(_msgSender(), address(this), _tokenId, 1, "");
        }
    }

    /**
     * @notice Used for placing bid with token id
     * @param _tokenId id of the token
     */
    function _placeBid(address _tokenContractAddress, uint256 _tokenId, uint256 _bidAmount) private {
        Bid[] storage bidList = bids[_tokenContractAddress][_tokenId];
        uint256 bidAmount = _bidAmount;
        uint256 benefit;
        if (bidList.length != 0) {
            benefit = bidList[bidList.length - 1].actualBidAmount.mul(auctions[_tokenContractAddress][_tokenId].fee).div(100)
                .mul(_getNow().sub(auctions[_tokenContractAddress][_tokenId].startTime))
                .div(auctions[_tokenContractAddress][_tokenId].endTime.sub(auctions[_tokenContractAddress][_tokenId].startTime));
        }
        uint256 actualBidAmount = bidAmount + benefit;

        // Ensure bid adheres to outbid increment and threshold

        if (bidList.length != 0) {
            Bid memory prevHighestBid = bidList[bidList.length - 1];
            uint256 minBidRequired = prevHighestBid.actualBidAmount;
            require(
                bidAmount > minBidRequired,
                "Auction.placeBid: Failed to outbid highest bidder"
            );
        } else {
            require(
                actualBidAmount >= auctions[_tokenContractAddress][_tokenId].startPrice,
                "Auction.placeBid: Bid amount should be higher than start price"
            );
        }

        require(
            IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress).balanceOf(_msgSender()) >= actualBidAmount,
            "Auction.placeBid: bidder has not enough balance"
        );

        // assign top bidder and bid time
        Bid memory newHighestBid;
        newHighestBid.bidder = _msgSender();
        newHighestBid.bidAmount = bidAmount;
        newHighestBid.actualBidAmount = actualBidAmount;
        newHighestBid.bidTime = _getNow();
        bidList.push(newHighestBid);

        IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress).transferFrom(_msgSender(), address(this), actualBidAmount);

        availableFunds[_tokenContractAddress][_tokenId] += actualBidAmount;

        if (bidList.length > 1) {
            IERC20(auctions[_tokenContractAddress][_tokenId].fundTokenAddress).transfer(bidList[bidList.length - 2].bidder, 
                bidList[bidList.length - 2].actualBidAmount + benefit);
            availableFunds[_tokenContractAddress][_tokenId] -= (bidList[bidList.length - 2].actualBidAmount + benefit);
        }
    }

    function supportsInterface(bytes4 interfaceId) external view override returns (bool) {}

    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public virtual override returns (bytes4) 
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public virtual override returns(bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }
}
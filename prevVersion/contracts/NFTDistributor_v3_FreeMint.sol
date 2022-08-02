// SPDX-License-Identifier: GPLv3

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./NFT.sol";

contract NFTDistributor_v3_FreeMint is
    Context,
    AccessControlEnumerable,
    Pausable,
    ReentrancyGuard
{
    using Address for address;
    using SafeMath for uint256;

    struct SpotUpdate {
        address position;
        uint256 whitelistContingent;
        uint256 freeMintContingent;
    }

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_ISSUANCE_PER_TX = 20;

    INFT public collection;
    uint256 public collectionSize;
    uint256 public itemPrice;

    uint256 public releaseDate;
    uint256 public wlReleaseDate;
    mapping(address => uint256) public whitelist;
    mapping(address => uint256) public freeMint;

    Counters.Counter private tokenTracker;

    event NewNFTMinted(address minter, uint256 quantity);

    event PriceAdjusted(
        uint256 priceBefore,
        uint256 priceAfter,
        address initiator
    );
    event ContingentIssued(address to, uint256 quantity, address initiator);

    modifier onlyAccess(uint256 quantity) {
        bool isWhitelistSale = block.timestamp > wlReleaseDate &&
            block.timestamp < releaseDate;

        bool isPublicSale = block.timestamp > wlReleaseDate &&
            block.timestamp > releaseDate;

        require(
            isWhitelistSale || isPublicSale,
            "Distributor: Whitelist Sale did not start yet"
        );

        if (isWhitelistSale) {
            require(
                whitelist[_msgSender()] > 0,
                "Distributor: No whitelist spot found or contingent of spot already minted"
            );

            require(
                freeMint[_msgSender()] == 0,
                "Distributor: Have to claim free mint before making use of whitelist spot"
            );

            require(
                whitelist[_msgSender()] >= quantity,
                "Distributor: Quantity is larger than contingent of spot"
            );
        }

        _;

        if (isWhitelistSale) {
            whitelist[_msgSender()] = whitelist[_msgSender()] - quantity;
        }
    }

    modifier onlyFreeMintAccess() {
        bool isWhitelistSale = block.timestamp > wlReleaseDate &&
            block.timestamp < releaseDate;

        bool isPublicSale = block.timestamp > wlReleaseDate &&
            block.timestamp > releaseDate;

        require(
            isWhitelistSale || isPublicSale,
            "Distributor: Cannot claim Free Mint before Whitelist Sale started"
        );

        require(
            freeMint[_msgSender()] > 0,
            "Distributor: No Free Mint to claim"
        );

        _;
    }

    constructor(
        address _collection,
        uint256 _collectionSize,
        uint256 _releaseDate,
        uint256 _wlReleaseDate,
        uint256 _price
    ) {
        collection = INFT(_collection);
        collectionSize = _collectionSize;

        require(
            _releaseDate > _wlReleaseDate,
            "Distributor: Public Sale must start after Whitelist Sale"
        );

        releaseDate = _releaseDate;
        wlReleaseDate = _wlReleaseDate;
        itemPrice = _price;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ISSUER_ROLE, _msgSender());
        _setupRole(PAUSER_ROLE, _msgSender());
    }

    function mintNewNFTs(uint256 quantity)
        external
        payable
        whenNotPaused
        nonReentrant
        onlyAccess(quantity)
    {
        uint256 priceToPay = itemPrice * quantity;
        require(msg.value >= priceToPay, "Distributor: Sent ethers too low");

        require(
            quantity <= MAX_ISSUANCE_PER_TX,
            "Distributor: Not allowed to issue more than MAX_ISSUANCE_PER_TX in a single tx"
        );

        _issuance(_msgSender(), quantity);

        uint256 refund = msg.value.sub(priceToPay);

        if (refund > 0) {
            payable(_msgSender()).transfer(refund);
        }

        emit NewNFTMinted(_msgSender(), quantity);
    }

    function claimFreeMint() external onlyFreeMintAccess nonReentrant {
        uint256 quantity = freeMint[_msgSender()];

        whitelist[_msgSender()] = whitelist[_msgSender()].sub(quantity);
        freeMint[_msgSender()] = 0;

        _issuance(_msgSender(), quantity);
        emit NewNFTMinted(_msgSender(), quantity);
    }

    function adjustPrice(uint256 newPrice)
        external
        whenNotPaused
        onlyRole(ISSUER_ROLE)
    {
        require(newPrice > 0, "Distributor: Price must be greater than 0");

        emit PriceAdjusted(itemPrice, newPrice, _msgSender());

        itemPrice = newPrice;
    }

    function issueContingent(address to, uint256 quantity)
        external
        whenNotPaused
        onlyRole(ISSUER_ROLE)
    {
        emit ContingentIssued(to, quantity, _msgSender());

        _issuance(to, quantity);
    }

    function updateSpots(SpotUpdate[] calldata _spots)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        for (uint256 i = 0; i < _spots.length; i++) {
            SpotUpdate memory spot = _spots[i];
            whitelist[spot.position] = spot.freeMintContingent <
                spot.whitelistContingent
                ? spot.whitelistContingent
                : spot.freeMintContingent;
            freeMint[spot.position] = spot.freeMintContingent;
        }
    }

    function updateReleaseDates(uint256 _releaseDate, uint256 _wlReleaseDate)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        releaseDate = _releaseDate;
        wlReleaseDate = _wlReleaseDate;
    }

    function getCurrentItemPrice() external view returns (uint256) {
        return itemPrice;
    }

    function togglePause() external onlyRole(PAUSER_ROLE) {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    function _issuance(address to, uint256 quantity) private {
        require(
            collection.getCurrentTokenTracker() + quantity <= collectionSize,
            "Distributor: No more items to mint in this collection, Sold out!"
        );

        for (uint256 i = 0; i < quantity; i++) {
            collection.mint(to);
        }
    }

    function call(
        address payable _to,
        uint256 _value,
        bytes calldata _data
    ) external payable onlyRole(DEFAULT_ADMIN_ROLE) returns (bytes memory) {
        require(_to != address(0));
        (bool _success, bytes memory _result) = _to.call{value: _value}(_data);
        require(_success);
        return _result;
    }
}

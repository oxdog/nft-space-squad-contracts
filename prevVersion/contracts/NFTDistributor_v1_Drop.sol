// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";
import "../../contracts/interfaces/INFT.sol";

contract NFTDistributor_v1_Drop is Context, AccessControlEnumerable, Pausable {
    using Address for address;
    using SafeMath for uint256;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    uint256 MAX_ISSUANCE_PER_TX = 5;

    INFT public collection;

    Counters.Counter private tokenTracker;

    uint256 private collectionSize;
    uint256 private releasedItems;
    uint256 private itemPrice;

    event NewNFTMinted(address minter, uint256 quantity);
    event DropRelease(
        uint256 quantity,
        uint256 pricePerPiece,
        address initiator
    );
    event PriceAdjusted(
        uint256 priceBefore,
        uint256 priceAfter,
        address initiator
    );
    event ContingentIssued(address to, uint256 quantity, address initiator);

    constructor(
        address _collection,
        uint256 _collectionSize,
        address payable _liquidityCollector
    ) {
        collection = INFT(_collection);
        collectionSize = _collectionSize;
        releasedItems = 0; // unlock happens seperately

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ISSUER_ROLE, _msgSender());
        _setupRole(EMERGENCY_ROLE, _msgSender());
    }

    function mintNewNFTs(uint256 quantity) external payable whenNotPaused {
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

    function releaseNextDrop(uint256 amount, uint256 pricePerPiece)
        external
        whenNotPaused
        onlyRole(ISSUER_ROLE)
    {
        require(
            releasedItems.add(amount) <= collectionSize,
            "Distributor: Cannot release more items that are in the collection"
        );

        emit DropRelease(amount, pricePerPiece, _msgSender());

        releasedItems = releasedItems.add(amount);
        _adjustPrice(pricePerPiece);
    }

    function adjustPrice(uint256 newPrice)
        external
        whenNotPaused
        onlyRole(ISSUER_ROLE)
    {
        require(newPrice > 0, "Distributor: Price must be greater than 0");
        _adjustPrice(newPrice);
    }

    function issueContingent(address to, uint256 quantity)
        external
        whenNotPaused
        onlyRole(ISSUER_ROLE)
    {
        emit ContingentIssued(to, quantity, _msgSender());

        _issuance(to, quantity);
    }

    function getCurrentItemPrice() external view returns (uint256) {
        return itemPrice;
    }

    function getReleasedItemCount() external view returns (uint256) {
        return releasedItems;
    }

    function emergencySwitch() external whenNotPaused onlyRole(EMERGENCY_ROLE) {
        _pause();
    }

    function releaseEmergencySwitch()
        external
        whenPaused
        onlyRole(EMERGENCY_ROLE)
    {
        _unpause();
    }

    function _issuance(address to, uint256 quantity) private {
        require(
            releasedItems > 0,
            "Distributor: No items have been released for issuance yet"
        );

        uint256 currentMaxIdToMint = releasedItems.sub(1);
        uint256 absoluteMaxIdToMint = collectionSize.sub(1);

        require(
            collection.getCurrentTokenTracker() + quantity - 1 <=
                currentMaxIdToMint,
            "Distributor: No more items to mint in this collection, Sold out!"
        );

        require(
            collection.getCurrentTokenTracker() + quantity - 1 <=
                absoluteMaxIdToMint,
            "Distributor: No more items to mint in this collection, Sold out!"
        );

        for (uint256 i = 0; i < quantity; i++) {
            _mint(to);
        }
    }

    function _adjustPrice(uint256 newPrice) private {
        emit PriceAdjusted(itemPrice, newPrice, _msgSender());

        itemPrice = newPrice;
    }

    function _mint(address to) private {
        collection.mint(to);
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

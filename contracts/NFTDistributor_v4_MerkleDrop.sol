// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/INFT.sol";

contract Distributor is Context, Pausable, ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    struct LeafConfig {
        uint256 whitelist;
        uint256 freeMint;
    }

    uint256 public constant MAX_ISSUANCE_PER_TX = 20;

    INFT public collection;
    uint256 public immutable collectionSize;
    uint256 public itemPrice;
    uint256 public releaseDate;
    uint256 public wlReleaseDate;
    uint256 public freeMintClaimDeadline;
    uint256 public freeMintContingent;

    bytes32 public rootHash;
    // account => count of already claimed
    mapping(address => uint256) public whitelistClaimed;
    mapping(address => uint256) public freeMintClaimed;

    modifier whenSaleStarted() {
        bool isWhitelistSale = block.timestamp > wlReleaseDate &&
            block.timestamp < releaseDate;
        bool isPublicSale = block.timestamp > wlReleaseDate &&
            block.timestamp > releaseDate;

        require(isWhitelistSale || isPublicSale, "D: WL not started");

        _;
    }

    modifier onlyAccessWhitelist(
        uint256 quantity,
        LeafConfig calldata config,
        bytes32[] calldata proof
    ) {
        bool isWhitelistSale = block.timestamp > wlReleaseDate &&
            block.timestamp < releaseDate;
        if (isWhitelistSale) {
            // Validate proof and quantity
            require(
                _verify(
                    _getLeaf(_msgSender(), config.whitelist, config.freeMint),
                    proof
                ),
                "D: IMP"
            );
            require(
                whitelistClaimed[_msgSender()].add(quantity) <=
                    config.whitelist,
                "D: Qunatity > WL Contingent"
            );
        }

        _;

        if (isWhitelistSale) {
            whitelistClaimed[_msgSender()] = whitelistClaimed[_msgSender()].add(
                quantity
            );
        }
    }

    modifier onlyAccessClaim(
        uint256 quantity,
        LeafConfig calldata config,
        bytes32[] calldata proof
    ) {
        require(config.freeMint > 0, "D: No FM");
        require(
            _verify(
                _getLeaf(_msgSender(), config.whitelist, config.freeMint),
                proof
            ),
            "D: IMP"
        );
        require(
            freeMintClaimed[_msgSender()].add(quantity) <= config.freeMint,
            "D: Quantity > FM contingent"
        );

        _;

        freeMintClaimed[_msgSender()] = freeMintClaimed[_msgSender()].add(
            quantity
        );
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

        updateReleaseDates(_releaseDate, _wlReleaseDate);

        itemPrice = _price;
    }

    function mintNewNFTs(
        uint256 quantity,
        LeafConfig calldata config,
        bytes32[] calldata proof
    )
        external
        payable
        whenNotPaused
        nonReentrant
        whenSaleStarted
        onlyAccessWhitelist(quantity, config, proof)
    {
        uint256 priceToPay = itemPrice * quantity;
        require(msg.value >= priceToPay, "D: ETH too low");
        require(quantity <= MAX_ISSUANCE_PER_TX, "D: MAX_ISSUANCE");
        if (block.timestamp <= freeMintClaimDeadline) {
            require(
                collection.getCurrentTokenTracker() + quantity <=
                    collectionSize - freeMintContingent,
                "D: FM Reserve not open"
            );
        }
        _issuance(_msgSender(), quantity);
        uint256 refund = msg.value.sub(priceToPay);
        if (refund > 0) {
            payable(_msgSender()).transfer(refund);
        }
    }

    function claimFreeMint(
        uint256 quantity,
        LeafConfig calldata config,
        bytes32[] calldata proof
    )
        external
        nonReentrant
        whenSaleStarted
        onlyAccessClaim(quantity, config, proof)
    {
        require(
            block.timestamp <= freeMintClaimDeadline,
            "D: FM deadline passed"
        );
        _issuance(_msgSender(), quantity);
    }

    function updateReleaseDates(uint256 _releaseDate, uint256 _wlReleaseDate)
        public
        onlyOwner
    {
        require(_releaseDate >= _wlReleaseDate);
        releaseDate = _releaseDate;
        wlReleaseDate = _wlReleaseDate;
        uint256 one_month = 60 * 60 * 24 * 31;
        freeMintClaimDeadline = releaseDate + one_month;
    }

    function updateFreeMintContingent(uint256 _contingent) external onlyOwner {
        freeMintContingent = _contingent;
    }

    function getCurrentItemPrice() external view returns (uint256) {
        return itemPrice;
    }

    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    function setRootHash(bytes32 _rootHash) external onlyOwner {
        rootHash = _rootHash;
    }

    function _issuance(address to, uint256 quantity) private {
        require(
            collection.getCurrentTokenTracker() + quantity <= collectionSize,
            "D: Sold out!"
        );
        for (uint256 i = 0; i < quantity; i++) {
            collection.mint(to);
        }
    }

    function _getLeaf(
        address _account,
        uint256 _whitelist,
        uint256 _freeMint
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_account, _whitelist, _freeMint));
    }

    function _verify(bytes32 _leaf, bytes32[] calldata _proof)
        private
        view
        returns (bool)
    {
        return MerkleProof.verify(_proof, rootHash, _leaf);
    }

    function call(
        address payable _to,
        uint256 _value,
        bytes calldata _data
    ) external payable onlyOwner returns (bytes memory) {
        require(_to != address(0));
        (bool _success, bytes memory _result) = _to.call{value: _value}(_data);
        require(_success);
        return _result;
    }
}

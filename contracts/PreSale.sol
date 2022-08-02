// SPDX-License-Identifier: GPLv3

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/INFT.sol";
import "./interfaces/IEMC.sol";

contract PreSale is ReentrancyGuard, Ownable {
    INFT public immutable collection;
    IEMC public immutable companycard;
    uint256 public preSaleSize;
    uint256 public itemPrice;
    uint256 public releaseDate;

    constructor(
        INFT _collection,
        IEMC _companycard,
        uint256 _preSaleSize,
        uint256 _releaseDate,
        uint256 _price
    ) {
        collection = _collection;
        companycard = _companycard;
        itemPrice = _price;
        preSaleSize = _preSaleSize;
        releaseDate = _releaseDate;
    }

    function mintNewNFTs(uint256 quantity) external payable nonReentrant {
        require(block.timestamp >= releaseDate, "PS: Not started");
        uint256 priceToPay = itemPrice * quantity;
        require(msg.value >= priceToPay, "PS: Sent ETH too low");
        require(
            collection.getCurrentTokenTracker() + quantity <= preSaleSize,
            "PS: Pre-Sale sold out!"
        );

        for (uint256 i = 0; i < quantity; i++) {
            collection.mint(msg.sender);
            companycard.mint(msg.sender);
        }

        uint256 refund = msg.value - priceToPay;
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }
    }

    function issueContingent(address to, uint256 quantity) external onlyOwner {
        for (uint256 i = 0; i < quantity; i++) {
            collection.mint(to);
        }
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

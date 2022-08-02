// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/INFT.sol";
import "./interfaces/IPill.sol";

contract Pharmacy is Context, Pausable, ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    IPill private pill;
    INFT private NFT;

    uint256 public immutable price;
    uint256 public immutable supplyCap;
    uint256 public claimReserve;
    uint256 public claimDeadline;

    uint256 private constant MAX_PILLS_PER_TX = 20;

    // address => alreadyClaimed
    mapping(address => bool) public claimRegistry;

    constructor(
        address _NFT,
        address _pill,
        uint256 _price,
        uint256 _supplyCap
    ) {
        NFT = INFT(_NFT);
        pill = IPill(_pill);
        price = _price;
        supplyCap = _supplyCap;
    }

    function purchasePills(uint256 quantity)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        uint256 priceToPay = price * quantity;
        require(msg.value >= priceToPay, "P: ETH too low");
        require(quantity <= MAX_PILLS_PER_TX, "P: MAX_TX");

        if (block.timestamp < claimDeadline) {
            require(
                pill.getCurrentTokenTracker() + quantity <=
                    supplyCap - claimReserve,
                "P: Claim Reserve not open"
            );
        } else {
            require(
                pill.getCurrentTokenTracker() + quantity <= supplyCap,
                "P: Sold out!"
            );
        }

        uint256 refund = msg.value.sub(priceToPay);
        if (refund > 0) {
            payable(_msgSender()).transfer(refund);
        }
        for (uint256 i = 0; i < quantity; i++) {
            pill.mint(_msgSender());
        }
    }

    function claimFreePills() external whenNotPaused nonReentrant {
        require(claimRegistry[_msgSender()] == false, "P: Already claimed");
        uint256 quantity = NFT.pcEligible(_msgSender());
        require(quantity > 0, "P: Not eligible");
        require(
            pill.getCurrentTokenTracker() + quantity <= supplyCap,
            "P: Sold Out"
        );

        claimRegistry[_msgSender()] = true;

        for (uint256 i = 0; i < quantity; i++) {
            pill.mint(_msgSender());
        }
    }

    function getCurrentDrug() external view returns (address) {
        return address(pill);
    }

    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
            claimReserve = NFT.pcCount();
        } else {
            _pause();
        }
    }

    function setClaimDeadline(uint256 _deadline) external onlyOwner {
        claimDeadline = _deadline;
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

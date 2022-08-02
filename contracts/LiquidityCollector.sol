// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract LiquidityCollector is Context, AccessControlEnumerable {
    using SafeMath for uint256;

    bytes32 public constant PAYPATROL_ROLE = keccak256("PAYPATROL_ROLE");

    address payable[] public beneficiaries;
    address payable public communityWallet;
    address payable public donationWallet;

    uint256 constant communityPercent = 10;
    uint256 constant donationPercent = 10;

    uint256 public communityCap;

    event LiquidityDistributed(
        address communityWallet,
        uint256 communityAmount,
        address donationWallet,
        uint256 donationAmount,
        address payable[] beneficiaries,
        uint256 totalBeneficiaryAmount,
        address initiator
    );
    event CommunityCapUpdate(
        uint256 capBefore,
        uint256 capAfter,
        address initiator
    );
    event CommunityWalletUpdate(
        address cwBefore,
        address cwAfter,
        address initiator
    );
    event DonationWalletUpdate(
        address dwBefore,
        address dwAfter,
        address initiator
    );
    event BeneficiaryUpdate(
        address payable[] beneficiariesBefore,
        address payable[] beneficiariesAfter,
        address initiator
    );

    constructor(
        address payable[] memory _beneficiaries,
        address payable _communityWallet,
        address payable _donationWallet,
        uint256 _communityCap
    ) {
        beneficiaries = _beneficiaries;
        communityWallet = _communityWallet;
        donationWallet = _donationWallet;
        communityCap = _communityCap;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PAYPATROL_ROLE, _msgSender());
    }

    function distribute() external onlyRole(PAYPATROL_ROLE) {
        uint256 balance = address(this).balance;

        require(
            balance > 0,
            "LiqudityCollector: No balance left on this contract to distribute"
        );

        uint256 donationAmount;
        uint256 communityAmount;
        uint256 beneficiaryAmount;

        donationAmount = (balance * donationPercent) / 100;
        communityAmount = _calcCommunityShareETH();

        if (beneficiaries.length > 0) {
            beneficiaryAmount =
                (balance - donationAmount - communityAmount) /
                beneficiaries.length;
        }

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiaries[i].transfer(beneficiaryAmount);
        }

        communityWallet.transfer(communityAmount);
        donationWallet.transfer(donationAmount);

        emit LiquidityDistributed(
            communityWallet,
            communityAmount,
            donationWallet,
            donationAmount,
            beneficiaries,
            beneficiaryAmount * beneficiaries.length,
            _msgSender()
        );
    }

    function distributeERC20(IERC20 _token) external onlyRole(PAYPATROL_ROLE) {
        uint256 balance = _token.balanceOf(address(this));

        require(
            balance > 0,
            "LiqudityCollector: No corresponding ERC20 balance left on this contract to distribute"
        );

        uint256 donationAmount;
        uint256 communityAmount;
        uint256 beneficiaryAmount;

        donationAmount = (balance * donationPercent) / 100;
        communityAmount = (balance * communityPercent) / 100;

        if (beneficiaries.length > 0) {
            beneficiaryAmount =
                (balance - donationAmount - communityAmount) /
                beneficiaries.length;
        }

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            _token.transfer(beneficiaries[i], beneficiaryAmount);
        }

        _token.transfer(communityWallet, communityAmount);
        _token.transfer(donationWallet, donationAmount);

        emit LiquidityDistributed(
            communityWallet,
            communityAmount,
            donationWallet,
            donationAmount,
            beneficiaries,
            beneficiaryAmount * beneficiaries.length,
            _msgSender()
        );
    }

    function updateCommunityCap(uint256 _communityCap)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit CommunityCapUpdate(communityCap, _communityCap, _msgSender());

        communityCap = _communityCap;
    }

    function updateCommunityWallet(address payable _communityWallet)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit CommunityWalletUpdate(
            communityWallet,
            _communityWallet,
            _msgSender()
        );

        communityWallet = _communityWallet;
    }

    function updateDonationWallet(address payable _donationWallet)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit DonationWalletUpdate(
            donationWallet,
            _donationWallet,
            _msgSender()
        );

        donationWallet = _donationWallet;
    }

    function updateBeneficiaries(address payable[] calldata _beneficiaries)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit BeneficiaryUpdate(beneficiaries, _beneficiaries, _msgSender());

        beneficiaries = _beneficiaries;
    }

    function _calcCommunityShareETH() private view returns (uint256) {
        uint256 currentCommunityBalance = address(communityWallet).balance;

        if (currentCommunityBalance >= communityCap) {
            return 0;
        }

        uint256 leftToTop = communityCap.sub(currentCommunityBalance);
        uint256 percentAmount = (address(this).balance * communityPercent) /
            100;

        return leftToTop < percentAmount ? leftToTop : percentAmount;
    }

    receive() external payable {}
}

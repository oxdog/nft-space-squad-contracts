// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/INFT.sol";

import "./@rarible/LibRoyaltiesV2.sol";
import "./@rarible/LibPart.sol";

contract NFTEnlargeningPill is
    Context,
    AccessControlEnumerable,
    ERC721,
    ERC721Burnable,
    ERC721Enumerable,
    Ownable
{
    using Counters for Counters.Counter;

    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a; // Royalty standart
    bytes32 constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");

    INFT private collection;
    string private metaURI;
    Counters.Counter private tokenTracker;

    uint96 private royaltyBasisPoints;
    address payable private royaltyReceiver;

    event PillUsed(uint256 NFTId, uint256 pillId, address initiator);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _metaURI,
        address _collection,
        address payable _royaltyReceiver,
        uint96 _royaltyBasisPoints // 1000 = 10%
    ) ERC721(_name, _symbol) {
        metaURI = _metaURI;
        collection = INFT(_collection);

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PHARMACY_ROLE, _msgSender());

        _updateRoyalty(_royaltyReceiver, _royaltyBasisPoints);
    }

    function use(uint256 pillId, uint256 targetId) external {
        require(ownerOf(pillId) == _msgSender(), "DEP: not owner");
        require(
            collection.ownerOf(targetId) == _msgSender(),
            "DEP: not owner of target"
        );

        emit PillUsed(targetId, pillId, _msgSender());

        collection.grow(targetId);
        _burn(pillId);
    }

    function mint(address to) external onlyRole(PHARMACY_ROLE) {
        _mint(to, tokenTracker.current());
        tokenTracker.increment();
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_exists(tokenId), "DEP: nonexistent token");
        return _baseURI();
    }

    function updateURI(string calldata _metaURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        metaURI = _metaURI;
    }

    function getCurrentTokenTracker()
        external
        view
        onlyRole(PHARMACY_ROLE)
        returns (uint256)
    {
        return tokenTracker.current();
    }

    function updateRoyalty(
        address payable _royaltyReceiver,
        uint96 _royaltyBasisPoints // 1000 = 10%
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateRoyalty(_royaltyReceiver, _royaltyBasisPoints);
    }

    function getRaribleV2Royalties(uint256 _tokenId)
        external
        view
        returns (LibPart.Part[] memory)
    {
        require(_exists(_tokenId), "DEP: Roy. non-existing token");
        LibPart.Part[] memory _royalties = new LibPart.Part[](1);
        _royalties[0].account = royaltyReceiver;
        _royalties[0].value = royaltyBasisPoints;
        return _royalties;
    }

    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_exists(_tokenId), "DEP: Roy. non-existing token");
        return
            royaltyBasisPoints > 0
                ? (royaltyReceiver, (_salePrice * royaltyBasisPoints) / 10000)
                : (address(0), uint256(0));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC721, ERC721Enumerable)
        returns (bool)
    {
        if (interfaceId == LibRoyaltiesV2._INTERFACE_ID_ROYALTIES) {
            return true;
        }
        if (interfaceId == _INTERFACE_ID_ERC2981) {
            return true;
        }
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return metaURI;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _updateRoyalty(
        address payable _royaltyReceiver,
        uint96 _royaltyBasisPoints // 1000 = 10%
    ) internal {
        require(_royaltyBasisPoints <= 1000, "DEP: UR");
        royaltyReceiver = _royaltyReceiver;
        royaltyBasisPoints = _royaltyBasisPoints;
    }
}

// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.11;

interface IPill {
    function mint(address to) external;

    function getCurrentTokenTracker() external view returns (uint256);
}

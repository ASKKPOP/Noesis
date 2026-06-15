// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSALite} from "./lib/ECDSALite.sol";

interface ITreasurySink {
    function depositFee() external payable;
}

/// @title LandSale — parcels for ETH or civic-labor credit (D-MONEY-05)
/// @notice A parcel is bought with ETH (paid to the civic treasury) at a price the
///         Polis sets, OR claimed by redeeming a civic-labor credit the Grid (oracle)
///         attests off-chain. One owner per parcel.
/// @dev    Zero-custody: ETH flows straight to the treasury; the Grid signs the
///         credit attestation but never holds funds. Testnet-first. Verified with
///         `forge test`.
contract LandSale {
    address public immutable authorizer;      // Polis — sets parcel prices
    address public immutable oracle;          // Grid — attests civic-labor credit claims
    address payable public immutable treasury;

    mapping(uint256 => uint256) public priceOf;  // parcelId => price (wei); 0 = not for sale
    mapping(uint256 => address) public ownerOf;   // parcelId => owner; address(0) = unowned

    event PriceSet(uint256 indexed parcelId, uint256 price);
    event ParcelSold(uint256 indexed parcelId, address indexed buyer, uint256 price);
    event ParcelClaimed(uint256 indexed parcelId, address indexed buyer);

    error NotAuthorizer();
    error NotForSale();
    error AlreadyOwned();
    error WrongPrice();
    error BadParams();
    error BadSignature();
    error TransferFailed();

    constructor(address _authorizer, address _oracle, address payable _treasury) {
        if (_authorizer == address(0) || _oracle == address(0) || _treasury == address(0)) revert BadParams();
        authorizer = _authorizer;
        oracle = _oracle;
        treasury = _treasury;
    }

    /// @notice Polis lists a parcel at `price` wei (0 retires it from sale).
    function setPrice(uint256 parcelId, uint256 price) external {
        if (msg.sender != authorizer) revert NotAuthorizer();
        priceOf[parcelId] = price;
        emit PriceSet(parcelId, price);
    }

    /// @notice Buy a listed, unowned parcel for exactly its price; ETH → treasury.
    function buyParcel(uint256 parcelId) external payable {
        uint256 price = priceOf[parcelId];
        if (price == 0) revert NotForSale();
        if (ownerOf[parcelId] != address(0)) revert AlreadyOwned();
        if (msg.value != price) revert WrongPrice();

        ownerOf[parcelId] = msg.sender;
        emit ParcelSold(parcelId, msg.sender, price);
        ITreasurySink(treasury).depositFee{value: price}();
    }

    /// @notice The message the Grid oracle signs to attest a credit-funded claim.
    function claimDigest(uint256 parcelId, address buyer) public view returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(block.chainid, address(this), parcelId, buyer));
        return ECDSALite.toEthSignedMessageHash(inner);
    }

    /// @notice Claim an unowned parcel using civic-labor credit, attested by the oracle.
    function claimWithCredit(uint256 parcelId, bytes calldata oracleSig) external {
        if (ownerOf[parcelId] != address(0)) revert AlreadyOwned();
        if (ECDSALite.recover(claimDigest(parcelId, msg.sender), oracleSig) != oracle) revert BadSignature();

        ownerOf[parcelId] = msg.sender;
        emit ParcelClaimed(parcelId, msg.sender);
    }
}

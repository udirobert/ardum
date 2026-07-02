// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RetreatDepositEscrow
/// @notice Holds practitioner deposits for yoga retreat bookings on Arbitrum.
///         Deposits arrive via Particle Universal Accounts (cross-chain, any
///         token) and are held until check-in. Operators claim after the
///         retreat starts; practitioners can refund within a cancellation
///         window.
///
/// @dev    Deployed on Arbitrum One (chainId 42161). The deposit token is
///         USDC (address 0xaf88d065e77c8cC2239327C5EDb3A432268e5831).
///         For testnet, use Arbitrum Sepolia USDC.

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract RetreatDepositEscrow {
    IERC20 public immutable depositToken;

    address public owner; // deployer (Ardum platform)

    struct Booking {
        address practitioner;
        address operator;
        uint256 amount; // in deposit token's smallest unit
        bytes32 retreatRootHash; // links to 0G Storage attestation
        uint64 bookedAt;
        uint64 checkInDeadline; // practitioner must check in by this time
        uint64 refundDeadline; // practitioner can refund before this time
        Status status;
    }

    enum Status {
        Pending,    // deposit held, waiting for check-in
        CheckedIn,  // operator confirmed arrival
        Released,   // funds sent to operator
        Refunded,   // funds returned to practitioner
        Cancelled   // expired without check-in
    }

    // bookingId => Booking (bookingId is a keccak hash of retreatRootHash + practitioner)
    mapping(bytes32 => Booking) public bookings;

    // operator => isVerified (only verified operators can claim)
    mapping(address => bool) public verifiedOperators;

    event Deposited(
        bytes32 indexed bookingId,
        address indexed practitioner,
        address indexed operator,
        uint256 amount,
        bytes32 retreatRootHash,
        uint64 checkInDeadline,
        uint64 refundDeadline
    );

    event CheckedIn(bytes32 indexed bookingId, uint64 timestamp);

    event Released(bytes32 indexed bookingId, address indexed operator, uint256 amount);

    event Refunded(bytes32 indexed bookingId, address indexed practitioner, uint256 amount);

    event OperatorVerified(address indexed operator, bool verified);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyOperator(bytes32 bookingId) {
        require(bookings[bookingId].operator == msg.sender, "only booking operator");
        _;
    }

    constructor(address _depositToken) {
        depositToken = IERC20(_depositToken);
        owner = msg.sender;
    }

    /// @notice Verify or unverify a retreat operator
    function setOperatorVerified(address operator, bool verified) external onlyOwner {
        verifiedOperators[operator] = verified;
        emit OperatorVerified(operator, verified);
    }

    /// @notice Practitioner deposits funds for a retreat booking.
    ///         Must have approved the token transfer first.
    /// @param  operator The retreat operator's address
    /// @param  amount Deposit amount in token's smallest unit
    /// @param  retreatRootHash The 0G Storage root hash of the retreat attestation
    /// @param  refundWindowHours Hours before check-in to cancel for a full refund
    /// @param  checkInWindowHours Hours after booking to check in
    function deposit(
        address operator,
        uint256 amount,
        bytes32 retreatRootHash,
        uint64 refundWindowHours,
        uint64 checkInWindowHours
    ) external returns (bytes32 bookingId) {
        require(amount > 0, "amount must be > 0");
        require(verifiedOperators[operator], "operator not verified");
        require(refundWindowHours > 0, "refund window must be > 0");
        require(checkInWindowHours > 0, "check-in window must be > 0");

        bookingId = keccak256(abi.encodePacked(retreatRootHash, msg.sender));
        require(bookings[bookingId].practitioner == address(0), "booking already exists");

        uint64 now_ = uint64(block.timestamp);

        bookings[bookingId] = Booking({
            practitioner: msg.sender,
            operator: operator,
            amount: amount,
            retreatRootHash: retreatRootHash,
            bookedAt: now_,
            checkInDeadline: now_ + checkInWindowHours * 1 hours,
            refundDeadline: now_ + refundWindowHours * 1 hours,
            status: Status.Pending
        });

        require(
            depositToken.transferFrom(msg.sender, address(this), amount),
            "token transfer failed"
        );

        emit Deposited(
            bookingId,
            msg.sender,
            operator,
            amount,
            retreatRootHash,
            now_ + checkInWindowHours * 1 hours,
            now_ + refundWindowHours * 1 hours
        );
    }

    /// @notice Operator confirms the practitioner has checked in
    function confirmCheckIn(bytes32 bookingId) external onlyOperator(bookingId) {
        Booking storage b = bookings[bookingId];
        require(b.status == Status.Pending, "booking not pending");
        require(block.timestamp <= b.checkInDeadline, "check-in deadline passed");

        b.status = Status.CheckedIn;
        emit CheckedIn(bookingId, uint64(block.timestamp));
    }

    /// @notice Operator claims the deposit after check-in is confirmed
    function claimDeposit(bytes32 bookingId) external onlyOperator(bookingId) {
        Booking storage b = bookings[bookingId];
        require(b.status == Status.CheckedIn, "not checked in");

        b.status = Status.Released;
        require(depositToken.transfer(b.operator, b.amount), "transfer to operator failed");

        emit Released(bookingId, b.operator, b.amount);
    }

    /// @notice Practitioner cancels and gets a full refund within the window
    function refund(bytes32 bookingId) external {
        Booking storage b = bookings[bookingId];
        require(b.practitioner == msg.sender, "only practitioner");
        require(b.status == Status.Pending, "booking not pending");
        require(block.timestamp <= b.refundDeadline, "refund window expired");

        b.status = Status.Refunded;
        require(depositToken.transfer(b.practitioner, b.amount), "refund transfer failed");

        emit Refunded(bookingId, b.practitioner, b.amount);
    }

    /// @notice Anyone can cancel a booking that expired without check-in
    function cancelExpired(bytes32 bookingId) external {
        Booking storage b = bookings[bookingId];
        require(b.status == Status.Pending, "booking not pending");
        require(block.timestamp > b.checkInDeadline, "check-in deadline not passed");

        b.status = Status.Cancelled;
        require(depositToken.transfer(b.practitioner, b.amount), "refund transfer failed");

        emit Refunded(bookingId, b.practitioner, b.amount);
    }

    function getBooking(bytes32 bookingId) external view returns (Booking memory) {
        return bookings[bookingId];
    }
}

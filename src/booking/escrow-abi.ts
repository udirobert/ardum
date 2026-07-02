// ABI for the RetreatDepositEscrow contract.
// Only the functions the frontend needs to call.

export const ESCROW_ABI = [
  // deposit(address,uint256,bytes32,uint64,uint64) returns bytes32
  "function deposit(address operator, uint256 amount, bytes32 retreatRootHash, uint64 refundWindowHours, uint64 checkInWindowHours) returns (bytes32)",
  // confirmCheckIn(bytes32)
  "function confirmCheckIn(bytes32 bookingId)",
  // claimDeposit(bytes32)
  "function claimDeposit(bytes32 bookingId)",
  // refund(bytes32)
  "function refund(bytes32 bookingId)",
  // cancelExpired(bytes32)
  "function cancelExpired(bytes32 bookingId)",
  // getBooking(bytes32) returns (address,address,uint256,bytes32,uint64,uint64,uint64,uint8)
  "function getBooking(bytes32) returns (address practitioner, address operator, uint256 amount, bytes32 retreatRootHash, uint64 bookedAt, uint64 checkInDeadline, uint64 refundDeadline, uint8 status)",
  // verifiedOperators(address) returns bool
  "function verifiedOperators(address) view returns (bool)",
  // depositToken() returns address
  "function depositToken() view returns (address)",
] as const;

// ERC20 approve ABI (minimal)
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

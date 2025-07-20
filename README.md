# SimpleSwap Smart Contract

An optimized decentralized exchange (DEX) smart contract that enables token swapping, liquidity management, and LP token generation using the constant product formula.

## 🚀 Key Features

- **Token Swapping**: Swap between two specific ERC20 tokens
- **Liquidity Management**: Add and remove liquidity from the pool
- **LP Tokens**: Automatic liquidity token generation (ERC20)
- **Dynamic Pricing**: Price calculation based on reserves
- **No Fees**: Fee-free token swaps
- **Optimized**: Code optimized to avoid compilation limitations

## 📋 Requirements

- Solidity ^0.8.17
- OpenZeppelin Contracts
- Two valid ERC20 tokens to form the pair

## 🛠 Installation

```bash
npm install @openzeppelin/contracts
```

### Compilation Configuration

If you encounter "Stack too deep" compilation errors, configure your `hardhat.config.js`:

```javascript
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true  // Optional: for complex cases
    }
  }
};
```

## 📖 Functionalities

### Liquidity Management

#### `addLiquidity()`
Adds liquidity to the swap pool.

**Parameters:**
- `_tokenA`: Address of the first token
- `_tokenB`: Address of the second token
- `amountADesired`: Desired amount of tokenA
- `amountBDesired`: Desired amount of tokenB
- `amountAMin`: Minimum acceptable amount of tokenA
- `amountBMin`: Minimum acceptable amount of tokenB
- `to`: Address that will receive the LP tokens
- `deadline`: Transaction deadline timestamp

**Returns:**
- `amountA`: Actual amount of tokenA added
- `amountB`: Actual amount of tokenB added
- `liquidity`: Amount of LP tokens minted

#### `removeLiquidity()`
Removes liquidity from the pool and burns LP tokens.

**Parameters:**
- `_tokenA`: Address of the first token
- `_tokenB`: Address of the second token
- `liquidity`: Amount of LP tokens to burn
- `amountAMin`: Minimum amount of tokenA to receive
- `amountBMin`: Minimum amount of tokenB to receive
- `to`: Address that will receive the tokens
- `deadline`: Transaction deadline

**Returns:**
- `amountA`: Amount of tokenA withdrawn
- `amountB`: Amount of tokenB withdrawn

### Token Swapping

#### `swapExactTokensForTokens()`
Swaps an exact amount of input tokens for output tokens.

**Parameters:**
- `amountIn`: Exact amount of input tokens
- `amountOutMin`: Minimum acceptable amount of output tokens
- `path`: Array with addresses [tokenIn, tokenOut]
- `to`: Address that will receive the output tokens
- `deadline`: Transaction deadline

### Query Functions

#### `getPrice()`
Gets the price of one token in terms of the other.

**Parameters:**
- `_tokenA`: Base token
- `_tokenB`: Quote token

**Returns:**
- `price`: Price scaled by 1e18

#### `getAmountOut()`
Calculates the amount of output tokens for a given input amount.

**Parameters:**
- `amountIn`: Amount of input tokens
- `reserveIn`: Reserve of the input token
- `reserveOut`: Reserve of the output token

**Returns:**
- `amountOut`: Amount of output tokens

#### `getReserves()`
Returns the current pool reserves.

**Returns:**
- `_reserveA`: Current reserve of tokenA
- `_reserveB`: Current reserve of tokenB

#### Other View Functions
- `getSupportedTokens()`: Returns the addresses of the token pair
- `getLiquidityShares(address)`: Returns LP tokens of a user
- `getTotalLiquidity()`: Returns total pool liquidity

## 🔧 Basic Usage

### Deployment
```solidity
// Deploy the contract with token addresses
SimpleSwap swap = new SimpleSwap(tokenA_address, tokenB_address);
```

### Add Initial Liquidity
```solidity
// Approve tokens before adding liquidity
tokenA.approve(address(swap), amountA);
tokenB.approve(address(swap), amountB);

// Add liquidity
swap.addLiquidity(
    tokenA_address,
    tokenB_address,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    msg.sender,
    deadline
);
```

### Execute Swap
```solidity
// Approve input token
tokenIn.approve(address(swap), amountIn);

// Create swap path
address[] memory path = new address[](2);
path[0] = tokenIn_address;
path[1] = tokenOut_address;

// Execute swap
swap.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    path,
    msg.sender,
    deadline
);
```

## ⚡ Optimizations

- **Immutable Variables**: `tokenA` and `tokenB` are immutable for gas efficiency
- **Optimized Access**: Use of local variables to avoid multiple storage reads
- **Short Strings**: Error messages ≤31 characters for gas optimization
- **Stack Optimized**: Code reorganized to avoid "Stack too deep" errors
- **Code Blocks**: Use of `{}` blocks to automatically free stack space

## 🔒 Security

- **Validations**: Comprehensive input parameter checks
- **Minimum Liquidity**: MINIMUM_LIQUIDITY locked to prevent total drainage
- **Audited Libraries**: Use of OpenZeppelin for ERC20 functionality
- **Overflow Protection**: Automatic overflow protection in Solidity ^0.8.0

## 📊 Events

- `LiquidityAdded`: Emitted when adding liquidity
- `LiquidityRemoved`: Emitted when removing liquidity
- `TokensSwapped`: Emitted when executing swaps
- `Transfer`: Standard ERC20 events for LP tokens
- `Approval`: Standard ERC20 events for LP tokens

## ⚠️ Considerations

- **No Fees**: The contract does not charge fees for swaps
- **Fixed Pair**: Only supports swaps between the two tokens specified in constructor
- **Constant Product**: Uses the x * y = k formula to determine prices
- **Slippage**: Users must specify minimum amounts to protect against excessive slippage
- **Optimization**: Code optimized for efficient compilation and lower gas usage
- **Error Messages**: Error strings limited to 31 characters for efficiency

## 📄 License

MIT License
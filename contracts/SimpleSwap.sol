// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleSwap
 * @dev Decentralized exchange (DEX) contract for a token pair
 * @notice Allows adding/removing liquidity and swapping tokens using constant product formula
 */
contract SimpleSwap is ERC20 {
    
    /// @dev Address of the first token in the pair
    address public immutable tokenA;
    
    /// @dev Address of the second token in the pair
    address public immutable tokenB;

    /// @dev Current reserve of tokenA in the contract
    uint256 public reserveA;
    
    /// @dev Current reserve of tokenB in the contract
    uint256 public reserveB;

    /// @dev Minimum amount of liquidity that remains locked to prevent attacks
    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    /**
     * @dev Emitted when liquidity is added to the pool
     * @param provider Address of the liquidity provider
     * @param amountA Amount of tokenA added
     * @param amountB Amount of tokenB added
     * @param liquidity Amount of LP tokens minted
     */
    event LiquidityAdded(
        address indexed provider, 
        uint256 amountA, 
        uint256 amountB, 
        uint256 liquidity
    );

    /**
     * @dev Emitted when liquidity is removed from the pool
     * @param provider Address of the liquidity provider
     * @param amountA Amount of tokenA withdrawn
     * @param amountB Amount of tokenB withdrawn
     * @param liquidity Amount of LP tokens burned
     */
    event LiquidityRemoved(
        address indexed provider, 
        uint256 amountA, 
        uint256 amountB, 
        uint256 liquidity
    );

    /**
     * @dev Emitted when a token swap is performed
     * @param user Address of the user performing the swap
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param amountIn Amount of input tokens
     * @param amountOut Amount of output tokens
     */
    event TokensSwapped(
        address indexed user, 
        address indexed tokenIn, 
        address indexed tokenOut, 
        uint256 amountIn, 
        uint256 amountOut
    );

    /**
     * @dev Contract constructor
     * @param _tokenA Address of the first token in the pair
     * @param _tokenB Address of the second token in the pair
     */
    constructor(address _tokenA, address _tokenB) 
        ERC20("SimpleSwap Liquidity Token", "SSLT") 
    {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid tokens");
        require(_tokenA != _tokenB, "Same tokens");
        
        tokenA = _tokenA;
        tokenB = _tokenB;
        
        // Mint minimum liquidity to prevent total drain
        _mint(address(this), MINIMUM_LIQUIDITY);
    }

    /**
     * @dev Modifier to verify that the transaction has not expired
     * @param deadline Timestamp limit to execute the transaction
     */
    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Expired");
        _;
    }

    /**
     * @dev Adds liquidity to the swap pool
     * @param _tokenA Address of the first token (must match contract's tokenA)
     * @param _tokenB Address of the second token (must match contract's tokenB)
     * @param amountADesired Desired amount of tokenA to add
     * @param amountBDesired Desired amount of tokenB to add
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @param to Address that will receive the LP tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Actual amount of tokenA added
     * @return amountB Actual amount of tokenB added
     * @return liquidity Amount of LP tokens minted
     */
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(_isValidTokenPair(_tokenA, _tokenB), "Invalid pair");
        require(to != address(0), "Invalid recipient");

        // Calculate optimal amounts
        {
            uint256 _reserveA = reserveA;
            uint256 _reserveB = reserveB;

            if (_reserveA == 0 && _reserveB == 0) {
                amountA = amountADesired;
                amountB = amountBDesired;
            } else {
                uint256 amountBOptimal = (amountADesired * _reserveB) / _reserveA;
                if (amountBOptimal <= amountBDesired) {
                    require(amountBOptimal >= amountBMin, "Insufficient B");
                    amountA = amountADesired;
                    amountB = amountBOptimal;
                } else {
                    uint256 amountAOptimal = (amountBDesired * _reserveA) / _reserveB;
                    require(amountAOptimal <= amountADesired && amountAOptimal >= amountAMin, "Insufficient A");
                    amountA = amountAOptimal;
                    amountB = amountBDesired;
                }
            }
        }

        // Transfer tokens
        require(IERC20(_tokenA).transferFrom(msg.sender, address(this), amountA), "Transfer A fail");
        require(IERC20(_tokenB).transferFrom(msg.sender, address(this), amountB), "Transfer B fail");

        // Calculate and mint liquidity
        {
            uint256 _totalSupply = totalSupply();
            if (_totalSupply == MINIMUM_LIQUIDITY) {
                liquidity = _sqrt(amountA * amountB);
            } else {
                uint256 liquidityA = (amountA * _totalSupply) / reserveA;
                uint256 liquidityB = (amountB * _totalSupply) / reserveB;
                liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
            }
            require(liquidity > 0, "Insufficient liquidity");
            _mint(to, liquidity);
        }

        // Update reserves
        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(to, amountA, amountB, liquidity);
    }

    /**
     * @dev Removes liquidity from the swap pool
     * @param _tokenA Address of the first token (must match contract's tokenA)
     * @param _tokenB Address of the second token (must match contract's tokenB)
     * @param liquidity Amount of LP tokens to burn
     * @param amountAMin Minimum acceptable amount of tokenA to receive
     * @param amountBMin Minimum acceptable amount of tokenB to receive
     * @param to Address that will receive the tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Amount of tokenA withdrawn
     * @return amountB Amount of tokenB withdrawn
     */
    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        require(_isValidTokenPair(_tokenA, _tokenB), "Invalid pair");
        require(to != address(0), "Invalid recipient");
        require(liquidity > 0, "Zero liquidity");
        require(balanceOf(msg.sender) >= liquidity, "Insufficient balance");

        // Calculate withdrawal amounts
        {
            uint256 _reserveA = reserveA;
            uint256 _reserveB = reserveB;
            uint256 _totalSupply = totalSupply();

            amountA = (liquidity * _reserveA) / _totalSupply;
            amountB = (liquidity * _reserveB) / _totalSupply;

            require(amountA >= amountAMin, "Insufficient A");
            require(amountB >= amountBMin, "Insufficient B");

            // Update reserves
            reserveA = _reserveA - amountA;
            reserveB = _reserveB - amountB;
        }

        // Burn LP tokens
        _burn(msg.sender, liquidity);

        // Transfer tokens
        require(IERC20(_tokenA).transfer(to, amountA), "Transfer A fail");
        require(IERC20(_tokenB).transfer(to, amountB), "Transfer B fail");

        emit LiquidityRemoved(to, amountA, amountB, liquidity);
    }

    /**
     * @dev Swaps an exact amount of input tokens for output tokens
     * @param amountIn Exact amount of input tokens
     * @param amountOutMin Minimum acceptable amount of output tokens
     * @param path Array with token addresses [tokenIn, tokenOut]
     * @param to Address that will receive the output tokens
     * @param deadline Timestamp limit for the transaction
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        require(path.length == 2, "Invalid path");
        require(to != address(0), "Invalid recipient");
        require(_isValidTokenPair(path[0], path[1]), "Invalid pair");

        // Determine reserves and calculate output
        uint256 amountOut;
        {
            // Use local variables to avoid multiple storage accesses
            uint256 _reserveA = reserveA;
            uint256 _reserveB = reserveB;
            
            uint256 reserveIn = path[0] == tokenA ? _reserveA : _reserveB;
            uint256 reserveOut = path[1] == tokenA ? _reserveA : _reserveB;
            
            amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
            require(amountOut >= amountOutMin, "Insufficient output");
        }

        // Execute transfers
        require(IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn), "Input transfer fail");
        require(IERC20(path[1]).transfer(to, amountOut), "Output transfer fail");

        // Update reserves
        if (path[0] == tokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        emit TokensSwapped(msg.sender, path[0], path[1], amountIn, amountOut);
    }

    /**
     * @dev Gets the price of one token in terms of the other
     * @param _tokenA Address of the base token
     * @param _tokenB Address of the quote token
     * @return price Price scaled by 1e18
     */
    function getPrice(address _tokenA, address _tokenB) external view returns (uint256 price) {
        require(_isValidTokenPair(_tokenA, _tokenB), "Invalid pair");
        
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        require(_reserveA > 0 && _reserveB > 0, "Insufficient reserves");
        
        if (_tokenA == tokenA) {
            price = (_reserveB * 1e18) / _reserveA;
        } else {
            price = (_reserveA * 1e18) / _reserveB;
        }
    }

    /**
     * @dev Calculates the amount of output tokens for a given input amount
     * @param amountIn Amount of input tokens
     * @param reserveIn Reserve of the input token
     * @param reserveOut Reserve of the output token
     * @return amountOut Amount of output tokens
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient reserves");
        
        // Constant product formula without fees
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    /**
     * @dev Verifies if the token pair is valid for this contract
     * @param _tokenA First token address
     * @param _tokenB Second token address
     * @return true if the pair is valid
     */
    function _isValidTokenPair(address _tokenA, address _tokenB) internal view returns (bool) {
        return (_tokenA == tokenA && _tokenB == tokenB) || (_tokenA == tokenB && _tokenB == tokenA);
    }

    /**
     * @dev Calculates the square root of a number using the Babylonian method
     * @param y Number to calculate square root of
     * @return z Square root of y
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @dev Returns the current pool reserves
     * @return _reserveA Current reserve of tokenA
     * @return _reserveB Current reserve of tokenB
     */
    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }

    /**
     * @dev Returns the addresses of the supported tokens
     * @return _tokenA Address of the first token
     * @return _tokenB Address of the second token
     */
    function getSupportedTokens() external view returns (address _tokenA, address _tokenB) {
        _tokenA = tokenA;
        _tokenB = tokenB;
    }

    /**
     * @dev Returns the amount of LP tokens owned by a user
     * @param user Address of the user
     * @return shares Amount of LP tokens
     */
    function getLiquidityShares(address user) external view returns (uint256 shares) {
        return balanceOf(user);
    }

    /**
     * @dev Returns the total amount of liquidity in the pool
     * @return total Total amount of LP tokens in circulation
     */
    function getTotalLiquidity() external view returns (uint256 total) {
        return totalSupply();
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleSwap
 * @dev Contrato de intercambio descentralizado (DEX) para un par de tokens
 * @notice Permite agregar/remover liquidez e intercambiar tokens usando fórmula de producto constante
 */
contract SimpleSwap is ERC20 {
    
    /// @dev Dirección del primer token del par
    address public immutable tokenA;
    
    /// @dev Dirección del segundo token del par
    address public immutable tokenB;

    /// @dev Reserva actual del tokenA en el contrato
    uint256 public reserveA;
    
    /// @dev Reserva actual del tokenB en el contrato
    uint256 public reserveB;

    /// @dev Cantidad mínima de liquidez que permanece bloqueada para prevenir ataques
    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    /**
     * @dev Emitido cuando se agrega liquidez al pool
     * @param provider Dirección del proveedor de liquidez
     * @param amountA Cantidad de tokenA agregada
     * @param amountB Cantidad de tokenB agregada
     * @param liquidity Cantidad de tokens LP minteados
     */
    event LiquidityAdded(
        address indexed provider, 
        uint256 amountA, 
        uint256 amountB, 
        uint256 liquidity
    );

    /**
     * @dev Emitido cuando se remueve liquidez del pool
     * @param provider Dirección del proveedor de liquidez
     * @param amountA Cantidad de tokenA retirada
     * @param amountB Cantidad de tokenB retirada
     * @param liquidity Cantidad de tokens LP quemados
     */
    event LiquidityRemoved(
        address indexed provider, 
        uint256 amountA, 
        uint256 amountB, 
        uint256 liquidity
    );

    /**
     * @dev Emitido cuando se realiza un intercambio de tokens
     * @param user Dirección del usuario que realiza el swap
     * @param tokenIn Dirección del token de entrada
     * @param tokenOut Dirección del token de salida
     * @param amountIn Cantidad de tokens de entrada
     * @param amountOut Cantidad de tokens de salida
     */
    event TokensSwapped(
        address indexed user, 
        address indexed tokenIn, 
        address indexed tokenOut, 
        uint256 amountIn, 
        uint256 amountOut
    );

    /**
     * @dev Constructor del contrato
     * @param _tokenA Dirección del primer token del par
     * @param _tokenB Dirección del segundo token del par
     */
    constructor(address _tokenA, address _tokenB) 
        ERC20("SimpleSwap Liquidity Token", "SSLT") 
    {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid tokens");
        require(_tokenA != _tokenB, "Same tokens");
        
        tokenA = _tokenA;
        tokenB = _tokenB;
        
        // Mintear liquidez mínima para prevenir drenaje total
        _mint(address(this), MINIMUM_LIQUIDITY);
    }

    /**
     * @dev Modificador para verificar que la transacción no haya expirado
     * @param deadline Timestamp límite para ejecutar la transacción
     */
    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Expired");
        _;
    }

    /**
     * @dev Agrega liquidez al pool de intercambio
     * @param _tokenA Dirección del primer token (debe coincidir con tokenA del contrato)
     * @param _tokenB Dirección del segundo token (debe coincidir con tokenB del contrato)
     * @param amountADesired Cantidad deseada de tokenA a agregar
     * @param amountBDesired Cantidad deseada de tokenB a agregar
     * @param amountAMin Cantidad mínima aceptable de tokenA
     * @param amountBMin Cantidad mínima aceptable de tokenB
     * @param to Dirección que recibirá los tokens LP
     * @param deadline Timestamp límite para la transacción
     * @return amountA Cantidad real de tokenA agregada
     * @return amountB Cantidad real de tokenB agregada
     * @return liquidity Cantidad de tokens LP minteados
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

        // Calcular cantidades óptimas
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

        // Transferir tokens
        require(IERC20(_tokenA).transferFrom(msg.sender, address(this), amountA), "Transfer A fail");
        require(IERC20(_tokenB).transferFrom(msg.sender, address(this), amountB), "Transfer B fail");

        // Calcular y mintear liquidez
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

        // Actualizar reservas
        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(to, amountA, amountB, liquidity);
    }

    /**
     * @dev Remueve liquidez del pool de intercambio
     * @param _tokenA Dirección del primer token (debe coincidir con tokenA del contrato)
     * @param _tokenB Dirección del segundo token (debe coincidir con tokenB del contrato)
     * @param liquidity Cantidad de tokens LP a quemar
     * @param amountAMin Cantidad mínima aceptable de tokenA a recibir
     * @param amountBMin Cantidad mínima aceptable de tokenB a recibir
     * @param to Dirección que recibirá los tokens
     * @param deadline Timestamp límite para la transacción
     * @return amountA Cantidad de tokenA retirada
     * @return amountB Cantidad de tokenB retirada
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

        // Calcular cantidades de retiro
        {
            uint256 _reserveA = reserveA;
            uint256 _reserveB = reserveB;
            uint256 _totalSupply = totalSupply();

            amountA = (liquidity * _reserveA) / _totalSupply;
            amountB = (liquidity * _reserveB) / _totalSupply;

            require(amountA >= amountAMin, "Insufficient A");
            require(amountB >= amountBMin, "Insufficient B");

            // Actualizar reservas
            reserveA = _reserveA - amountA;
            reserveB = _reserveB - amountB;
        }

        // Quemar tokens LP
        _burn(msg.sender, liquidity);

        // Transferir tokens
        require(IERC20(_tokenA).transfer(to, amountA), "Transfer A fail");
        require(IERC20(_tokenB).transfer(to, amountB), "Transfer B fail");

        emit LiquidityRemoved(to, amountA, amountB, liquidity);
    }

    /**
     * @dev Intercambia una cantidad exacta de tokens de entrada por tokens de salida
     * @param amountIn Cantidad exacta de tokens de entrada
     * @param amountOutMin Cantidad mínima aceptable de tokens de salida
     * @param path Array con las direcciones de los tokens [tokenIn, tokenOut]
     * @param to Dirección que recibirá los tokens de salida
     * @param deadline Timestamp límite para la transacción
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

        // Determinar reservas y calcular output
        uint256 amountOut;
        {
            // Usar variables locales para evitar múltiples accesos a storage
            uint256 _reserveA = reserveA;
            uint256 _reserveB = reserveB;
            
            uint256 reserveIn = path[0] == tokenA ? _reserveA : _reserveB;
            uint256 reserveOut = path[1] == tokenA ? _reserveA : _reserveB;
            
            amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
            require(amountOut >= amountOutMin, "Insufficient output");
        }

        // Ejecutar transferencias
        require(IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn), "Input transfer fail");
        require(IERC20(path[1]).transfer(to, amountOut), "Output transfer fail");

        // Actualizar reservas
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
     * @dev Obtiene el precio de un token en términos del otro
     * @param _tokenA Dirección del token base
     * @param _tokenB Dirección del token cotizado
     * @return price Precio escalado por 1e18
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
     * @dev Calcula la cantidad de tokens de salida para una cantidad de entrada dada
     * @param amountIn Cantidad de tokens de entrada
     * @param reserveIn Reserva del token de entrada
     * @param reserveOut Reserva del token de salida
     * @return amountOut Cantidad de tokens de salida
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient reserves");
        
        // Fórmula de producto constante sin fees
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    /**
     * @dev Verifica si el par de tokens es válido para este contrato
     * @param _tokenA Primera dirección de token
     * @param _tokenB Segunda dirección de token
     * @return true si el par es válido
     */
    function _isValidTokenPair(address _tokenA, address _tokenB) internal view returns (bool) {
        return (_tokenA == tokenA && _tokenB == tokenB) || (_tokenA == tokenB && _tokenB == tokenA);
    }

    /**
     * @dev Calcula la raíz cuadrada de un número usando el método babilónico
     * @param y Número del cual calcular la raíz cuadrada
     * @return z Raíz cuadrada de y
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
     * @dev Retorna las reservas actuales del pool
     * @return _reserveA Reserva actual del tokenA
     * @return _reserveB Reserva actual del tokenB
     */
    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }

    /**
     * @dev Retorna las direcciones de los tokens soportados
     * @return _tokenA Dirección del primer token
     * @return _tokenB Dirección del segundo token
     */
    function getSupportedTokens() external view returns (address _tokenA, address _tokenB) {
        _tokenA = tokenA;
        _tokenB = tokenB;
    }

    /**
     * @dev Retorna la cantidad de tokens LP que posee un usuario
     * @param user Dirección del usuario
     * @return shares Cantidad de tokens LP
     */
    function getLiquidityShares(address user) external view returns (uint256 shares) {
        return balanceOf(user);
    }

    /**
     * @dev Retorna la cantidad total de liquidez en el pool
     * @return total Cantidad total de tokens LP en circulación
     */
    function getTotalLiquidity() external view returns (uint256 total) {
        return totalSupply();
    }
}
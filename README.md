# SimpleSwap Smart Contract

Un contrato inteligente de intercambio descentralizado (DEX) que permite el intercambio de tokens, gestión de liquidez y generación de tokens LP utilizando la fórmula de producto constante.

## 🚀 Características Principales

- **Intercambio de Tokens**: Swap entre dos tokens ERC20 específicos
- **Gestión de Liquidez**: Agregar y remover liquidez del pool
- **Tokens LP**: Generación automática de tokens de liquidez (ERC20)
- **Precios Dinámicos**: Cálculo de precios basado en reservas
- **Sin Comisiones**: Intercambios sin fees adicionales
- **Seguridad**: Protección contra ataques de reentrancy

## 📋 Requisitos

- Solidity ^0.8.17
- OpenZeppelin Contracts
- Dos tokens ERC20 válidos para formar el par

## 🛠 Instalación

```bash
npm install @openzeppelin/contracts
```

## 📖 Funcionalidades

### Gestión de Liquidez

#### `addLiquidity()`
Agrega liquidez al pool de intercambio.

**Parámetros:**
- `_tokenA`: Dirección del primer token
- `_tokenB`: Dirección del segundo token  
- `amountADesired`: Cantidad deseada de tokenA
- `amountBDesired`: Cantidad deseada de tokenB
- `amountAMin`: Cantidad mínima aceptable de tokenA
- `amountBMin`: Cantidad mínima aceptable de tokenB
- `to`: Dirección que recibirá los tokens LP
- `deadline`: Timestamp límite para la transacción

**Retorna:**
- `amountA`: Cantidad real de tokenA agregada
- `amountB`: Cantidad real de tokenB agregada
- `liquidity`: Cantidad de tokens LP minteados

#### `removeLiquidity()`
Remueve liquidez del pool y quema tokens LP.

**Parámetros:**
- `_tokenA`: Dirección del primer token
- `_tokenB`: Dirección del segundo token
- `liquidity`: Cantidad de tokens LP a quemar
- `amountAMin`: Cantidad mínima de tokenA a recibir
- `amountBMin`: Cantidad mínima de tokenB a recibir
- `to`: Dirección que recibirá los tokens
- `deadline`: Timestamp límite

**Retorna:**
- `amountA`: Cantidad de tokenA retirada
- `amountB`: Cantidad de tokenB retirada

### Intercambio de Tokens

#### `swapExactTokensForTokens()`
Intercambia una cantidad exacta de tokens de entrada por tokens de salida.

**Parámetros:**
- `amountIn`: Cantidad exacta de tokens de entrada
- `amountOutMin`: Cantidad mínima aceptable de tokens de salida
- `path`: Array con direcciones [tokenIn, tokenOut]
- `to`: Dirección que recibirá los tokens de salida
- `deadline`: Timestamp límite

### Funciones de Consulta

#### `getPrice()`
Obtiene el precio de un token en términos del otro.

**Parámetros:**
- `_tokenA`: Token base
- `_tokenB`: Token cotizado

**Retorna:**
- `price`: Precio escalado por 1e18

#### `getAmountOut()`
Calcula la cantidad de tokens de salida para una entrada dada.

**Parámetros:**
- `amountIn`: Cantidad de tokens de entrada
- `reserveIn`: Reserva del token de entrada
- `reserveOut`: Reserva del token de salida

**Retorna:**
- `amountOut`: Cantidad de tokens de salida

#### `getReserves()`
Retorna las reservas actuales del pool.

**Retorna:**
- `_reserveA`: Reserva del tokenA
- `_reserveB`: Reserva del tokenB

#### Otras Funciones de Vista
- `getSupportedTokens()`: Retorna las direcciones de los tokens del par
- `getLiquidityShares(address)`: Retorna tokens LP de un usuario
- `getTotalLiquidity()`: Retorna liquidez total del pool

## 🔧 Uso Básico

### Despliegue
```solidity
// Desplegar el contrato con las direcciones de los tokens
SimpleSwap swap = new SimpleSwap(tokenA_address, tokenB_address);
```

### Agregar Liquidez Inicial
```solidity
// Aprobar tokens antes de agregar liquidez
tokenA.approve(address(swap), amountA);
tokenB.approve(address(swap), amountB);

// Agregar liquidez
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

### Realizar Intercambio
```solidity
// Aprobar token de entrada
tokenIn.approve(address(swap), amountIn);

// Crear path de intercambio
address[] memory path = new address[](2);
path[0] = tokenIn_address;
path[1] = tokenOut_address;

// Ejecutar swap
swap.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    path,
    msg.sender,
    deadline
);
```

## ⚡ Optimizaciones

- **Variables Inmutables**: `tokenA` y `tokenB` son inmutables para eficiencia de gas
- **Accesos Optimizados**: Uso de variables locales para evitar múltiples lecturas de storage
- **Strings Cortos**: Mensajes de error ≤31 caracteres para optimización de gas

## 🔒 Seguridad

- **ReentrancyGuard**: Protección contra ataques de reentrancy
- **Validaciones**: Verificaciones exhaustivas de parámetros de entrada
- **Liquidez Mínima**: MINIMUM_LIQUIDITY bloqueada para prevenir drenaje total
- **Librerías Auditadas**: Uso de OpenZeppelin para funcionalidad ERC20

## 📊 Eventos

- `LiquidityAdded`: Emitido al agregar liquidez
- `LiquidityRemoved`: Emitido al remover liquidez  
- `TokensSwapped`: Emitido al realizar intercambios
- `Transfer`: Eventos estándar ERC20 para tokens LP
- `Approval`: Eventos estándar ERC20 para tokens LP

## ⚠️ Consideraciones

- **Sin Fees**: El contrato no cobra comisiones por intercambios
- **Par Fijo**: Solo soporta intercambios entre los dos tokens especificados en el constructor
- **Producto Constante**: Utiliza la fórmula x * y = k para determinar precios
- **Slippage**: Los usuarios deben especificar cantidades mínimas para protegerse contra slippage excesivo

## 📄 Licencia

MIT License
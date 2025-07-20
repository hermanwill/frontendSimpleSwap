const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SwapModule = buildModule("SwapModule", (m) => {
  // Deploy tokens mock con IDs únicos
  const tokenA = m.contract("MockERC20", [
    "Token A",
    "TKA", 
    18,
    "1000000000000000000000000"  // 1M tokens
  ], {
    id: "TokenA"  // ID único para el primer token
  });

  const tokenB = m.contract("MockERC20", [
    "Token B",
    "TKB",
    18, 
    "1000000000000000000000000"  // 1M tokens
  ], {
    id: "TokenB"  // ID único para el segundo token
  });

  // Deploy SimpleSwap con las direcciones de los tokens
  const SimpleSwap = m.contract("SimpleSwap", [tokenA, tokenB], {
    id: "SimpleSwapContract"  // ID único para SimpleSwap
  });

  return { tokenA, tokenB, SimpleSwap };
});

module.exports = SwapModule;
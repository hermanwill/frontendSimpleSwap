const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SwapModule = buildModule("SwapModule", (deployer) => {
  const SimpleSwap = deployer.contract("SimpleSwap");

  return { SimpleSwap };
});

module.exports = SwapModule;
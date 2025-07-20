const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap", function () {
  let simpleSwap;
  let tokenA;
  let tokenB;
  let owner;
  let user1;
  let user2;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const MINIMUM_LIQUIDITY = 1000;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    tokenA = await MockERC20.deploy("Token A", "TKA", 18, INITIAL_SUPPLY);
    await tokenA.waitForDeployment();
    
    tokenB = await MockERC20.deploy("Token B", "TKB", 18, INITIAL_SUPPLY);
    await tokenB.waitForDeployment();

    // Deploy SimpleSwap
    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy(await tokenA.getAddress(), await tokenB.getAddress());
    await simpleSwap.waitForDeployment();

    // Distribute tokens to users
    await tokenA.transfer(user1.address, ethers.parseEther("10000"));
    await tokenA.transfer(user2.address, ethers.parseEther("10000"));
    await tokenB.transfer(user1.address, ethers.parseEther("10000"));
    await tokenB.transfer(user2.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await simpleSwap.tokenA()).to.equal(await tokenA.getAddress());
      expect(await simpleSwap.tokenB()).to.equal(await tokenB.getAddress());
    });

    it("Should initialize with zero reserves", async function () {
      const [reserveA, reserveB] = await simpleSwap.getReserves();
      expect(reserveA).to.equal(0);
      expect(reserveB).to.equal(0);
    });

    it("Should mint minimum liquidity to contract", async function () {
      expect(await simpleSwap.balanceOf(await simpleSwap.getAddress())).to.equal(MINIMUM_LIQUIDITY);
    });

    it("Should have correct LP token details", async function () {
      expect(await simpleSwap.name()).to.equal("SimpleSwap Liquidity Token");
      expect(await simpleSwap.symbol()).to.equal("SSLT");
      expect(await simpleSwap.decimals()).to.equal(18);
    });
  });

  describe("Add Liquidity", function () {
    beforeEach(async function () {
      await tokenA.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("1000"));
      await tokenB.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("1000"));
    });

    it("Should add initial liquidity successfully", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountA,
          amountB,
          amountA,
          amountB,
          user1.address,
          deadline
        )
      ).to.emit(simpleSwap, "LiquidityAdded");

      const [reserveA, reserveB] = await simpleSwap.getReserves();
      expect(reserveA).to.equal(amountA);
      expect(reserveB).to.equal(amountB);
    });

    it("Should reject invalid token pair", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      await expect(
        simpleSwap.connect(user1).addLiquidity(
          await tokenA.getAddress(),
          owner.address,
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          user1.address,
          deadline
        )
      ).to.be.revertedWith("Invalid pair");
    });

    it("Should reject expired deadline", async function () {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600;
      
      await expect(
        simpleSwap.connect(user1).addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          user1.address,
          expiredDeadline
        )
      ).to.be.revertedWith("Expired");
    });
  });

  describe("Token Swaps", function () {
    beforeEach(async function () {
      // Approve more tokens to handle the larger amounts
      await tokenA.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("2000"));
      await tokenB.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("3000"));

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await simpleSwap.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("2000"),
        ethers.parseEther("1000"),
        ethers.parseEther("2000"),
        user1.address,
        deadline
      );
    });

    it("Should swap tokens A for B successfully", async function () {
      const amountIn = ethers.parseEther("10");
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await tokenA.connect(user2).approve(await simpleSwap.getAddress(), amountIn);

      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          amountIn,
          0,
          path,
          user2.address,
          deadline
        )
      ).to.emit(simpleSwap, "TokensSwapped");
    });

    it("Should reject insufficient output amount", async function () {
      const amountIn = ethers.parseEther("10");
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await tokenA.connect(user2).approve(await simpleSwap.getAddress(), amountIn);

      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          amountIn,
          ethers.parseEther("100"),
          path,
          user2.address,
          deadline
        )
      ).to.be.revertedWith("Insufficient output");
    });
  });

  describe("Price Functions", function () {
    beforeEach(async function () {
      await tokenA.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("1000"));
      await tokenB.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("1000"));

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await simpleSwap.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        user1.address,
        deadline
      );
    });

    it("Should return correct price", async function () {
      const price = await simpleSwap.getPrice(await tokenA.getAddress(), await tokenB.getAddress());
      expect(price).to.equal(ethers.parseEther("2"));
    });

    it("Should calculate amount out correctly", async function () {
      const amountIn = ethers.parseEther("10");
      const reserveIn = ethers.parseEther("100");
      const reserveOut = ethers.parseEther("200");

      const amountOut = await simpleSwap.getAmountOut(amountIn, reserveIn, reserveOut);
      const expected = amountIn * reserveOut / (reserveIn + amountIn);
      expect(amountOut).to.equal(expected);
    });
  });

  describe("View Functions", function () {
    it("Should return supported tokens", async function () {
      const [_tokenA, _tokenB] = await simpleSwap.getSupportedTokens();
      expect(_tokenA).to.equal(await tokenA.getAddress());
      expect(_tokenB).to.equal(await tokenB.getAddress());
    });

    it("Should return total liquidity", async function () {
      const totalLiquidity = await simpleSwap.getTotalLiquidity();
      expect(totalLiquidity).to.equal(MINIMUM_LIQUIDITY);
    });
  });

  describe("Remove Liquidity", function () {
    beforeEach(async function () {
      // Add initial liquidity first
      await tokenA.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("1000"));
      await tokenB.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("1000"));

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await simpleSwap.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        user1.address,
        deadline
      );
    });

    it("Should remove liquidity successfully", async function () {
      const liquidityBalance = await simpleSwap.balanceOf(user1.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        simpleSwap.connect(user1).removeLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          liquidityBalance,
          0,
          0,
          user1.address,
          deadline
        )
      ).to.emit(simpleSwap, "LiquidityRemoved");

      expect(await simpleSwap.balanceOf(user1.address)).to.equal(0);
    });

    it("Should reject insufficient liquidity balance", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      await expect(
        simpleSwap.connect(user2).removeLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          ethers.parseEther("10"),
          0,
          0,
          user2.address,
          deadline
        )
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should reject expired deadline for remove liquidity", async function () {
      const liquidityBalance = await simpleSwap.balanceOf(user1.address);
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600;
      
      await expect(
        simpleSwap.connect(user1).removeLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          liquidityBalance,
          0,
          0,
          user1.address,
          expiredDeadline
        )
      ).to.be.revertedWith("Expired");
    });
  });

  describe("Additional Edge Cases", function () {
    it("Should reject getting price with no liquidity", async function () {
      await expect(
        simpleSwap.getPrice(await tokenA.getAddress(), await tokenB.getAddress())
      ).to.be.revertedWith("Insufficient reserves");
    });

    it("Should return correct liquidity shares for user", async function () {
      const shares = await simpleSwap.getLiquidityShares(user1.address);
      expect(shares).to.equal(0);
    });

    it("Should reject zero liquidity in removeLiquidity", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      await expect(
        simpleSwap.connect(user1).removeLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          0,
          0,
          0,
          user1.address,
          deadline
        )
      ).to.be.revertedWith("Zero liquidity");
    });

    it("Should reject invalid recipient in addLiquidity", async function () {
      await tokenA.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("100"));
      await tokenB.connect(user1).approve(await simpleSwap.getAddress(), ethers.parseEther("100"));
      
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      await expect(
        simpleSwap.connect(user1).addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          "0x0000000000000000000000000000000000000000", // Zero address
          deadline
        )
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should reject invalid path length in swap", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          ethers.parseEther("10"),
          0,
          [await tokenA.getAddress()], // Invalid path - only one token
          user2.address,
          deadline
        )
      ).to.be.revertedWith("Invalid path");
    });

    it("Should reject invalid recipient in swap", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          ethers.parseEther("10"),
          0,
          [await tokenA.getAddress(), await tokenB.getAddress()],
          "0x0000000000000000000000000000000000000000", // Zero address
          deadline
        )
      ).to.be.revertedWith("Invalid recipient");
    });
  });
});
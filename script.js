// @dev Contract configuration
const addressContract = "0xC52f33Cc4d48F3C72144C2b0E82C25B401bEF1f5"; // Reemplazar con la dirección real
const tokenAAddress = "0xB9D62F684D533D89ed7a59f0b97aa6847Ea7b935"; // Reemplazar con la dirección real del Token A
const tokenBAddress = "0x15d00E0E845d981f03010Aa69f6045EB305f30b6"; // Reemplazar con la dirección real del Token B

// @dev SimpleSwap contract ABI (simplified version with main functions)
const simpleSwapABI = [
    // @dev Read functions
    "function getReserves() view returns (uint256 _reserveA, uint256 _reserveB)",
    "function getSupportedTokens() view returns (address _tokenA, address _tokenB)",
    "function getTotalLiquidity() view returns (uint256 total)",
    "function getPrice(address _tokenA, address _tokenB) view returns (uint256 price)",
    "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256 amountOut)",
    "function getLiquidityShares(address user) view returns (uint256 shares)",
    
    // @dev Write functions
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
];

// @dev Basic ABI for ERC20 tokens
const erc20ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// @dev Global variables
let signer;
let simpleSwapContract;
let tokenAContract;
let tokenBContract;
let userAddress;

/**
 * @dev Connects MetaMask wallet
 * @notice Requests access to user accounts and initializes contracts
 */
async function conectar() {
    try {
        if (typeof window.ethereum !== "undefined") {
            console.log("MetaMask detectado");
            
            // @dev Request access to accounts
            await window.ethereum.request({ method: "eth_requestAccounts" });
            
            // @dev Create provider and signer
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
            
            // @dev Display user address
            document.getElementById("accountAddress").innerText = `Conectado: ${userAddress}`;
            
            // @dev Initialize contracts
            simpleSwapContract = new ethers.Contract(addressContract, simpleSwapABI, signer);
            tokenAContract = new ethers.Contract(tokenAAddress, erc20ABI, signer);
            tokenBContract = new ethers.Contract(tokenBAddress, erc20ABI, signer);
            
            // @dev Load initial information
            await obtenerInfoPool();
            await obtenerBalances();
            
            alert("Billetera conectada exitosamente");
        } else {
            alert("Por favor instala MetaMask");
        }
    } catch (error) {
        console.error("Error al conectar:", error);
        alert("Error al conectar la billetera");
    }
}

/**
 * @dev Gets pool information
 * @notice Retrieves supported tokens, reserves, and total liquidity
 */
async function obtenerInfoPool() {
    try {
        if (!simpleSwapContract) {
            alert("Primero conecta tu billetera");
            return;
        }
        
        // @dev Get supported tokens
        const [tokenA, tokenB] = await simpleSwapContract.getSupportedTokens();
        document.getElementById("tokenAAddress").innerText = `Token A: ${tokenA}`;
        document.getElementById("tokenBAddress").innerText = `Token B: ${tokenB}`;
        
        // @dev Get reserves
        const [reserveA, reserveB] = await simpleSwapContract.getReserves();
        document.getElementById("reserveA").innerText = `Reserva Token A: ${ethers.utils.formatEther(reserveA)}`;
        document.getElementById("reserveB").innerText = `Reserva Token B: ${ethers.utils.formatEther(reserveB)}`;
        
        // @dev Get total liquidity
        const totalLiquidity = await simpleSwapContract.getTotalLiquidity();
        document.getElementById("totalLiquidity").innerText = `Liquidez Total: ${ethers.utils.formatEther(totalLiquidity)}`;
        
    } catch (error) {
        console.error("Error al obtener info del pool:", error);
        alert("Error al cargar información del pool");
    }
}

/**
 * @dev Gets the price of one token in terms of the other
 * @notice Calculates and displays token price based on current reserves
 */
async function obtenerPrecio() {
    try {
        if (!simpleSwapContract) {
            alert("Primero conecta tu billetera");
            return;
        }
        
        const tokenBase = document.getElementById("tokenBase").value;
        let precio;
        
        if (tokenBase === "A") {
            // @dev Price of Token A in terms of Token B
            precio = await simpleSwapContract.getPrice(tokenAAddress, tokenBAddress);
            document.getElementById("priceResult").innerText = 
                `1 Token A = ${ethers.utils.formatEther(precio)} Token B`;
        } else {
            // @dev Price of Token B in terms of Token A
            precio = await simpleSwapContract.getPrice(tokenBAddress, tokenAAddress);
            document.getElementById("priceResult").innerText = 
                `1 Token B = ${ethers.utils.formatEther(precio)} Token A`;
        }
        
        document.getElementById("priceResult").className = "";
        
    } catch (error) {
        console.error("Error al obtener precio:", error);
        document.getElementById("priceResult").innerText = "Error: Reservas insuficientes o pool no inicializado";
        document.getElementById("priceResult").className = "error";
    }
}

/**
 * @dev Gets user's token balances
 * @notice Retrieves and displays balances for TokenA, TokenB, and LP tokens
 */
async function obtenerBalances() {
    try {
        if (!userAddress) {
            return;
        }
        
        // @dev Token A balance
        const balanceA = await tokenAContract.balanceOf(userAddress);
        document.getElementById("balanceA").innerText = `Token A: ${ethers.utils.formatEther(balanceA)}`;
        
        // @dev Token B balance
        const balanceB = await tokenBContract.balanceOf(userAddress);
        document.getElementById("balanceB").innerText = `Token B: ${ethers.utils.formatEther(balanceB)}`;
        
        // @dev LP Tokens balance
        const balanceLP = await simpleSwapContract.getLiquidityShares(userAddress);
        document.getElementById("balanceLP").innerText = `Tokens LP: ${ethers.utils.formatEther(balanceLP)}`;
        
    } catch (error) {
        console.error("Error al obtener balances:", error);
    }
}

/**
 * @dev Changes swap direction (From <-> To)
 * @notice Swaps the selected tokens and clears input fields
 */
function cambiarDireccion() {
    const tokenFrom = document.getElementById("tokenFrom");
    const tokenTo = document.getElementById("tokenTo");
    
    const tempValue = tokenFrom.value;
    tokenFrom.value = tokenTo.value;
    tokenTo.value = tempValue;
    
    // @dev Clear input fields
    document.getElementById("amountIn").value = "";
    document.getElementById("amountOut").value = "";
    document.getElementById("swapResult").innerText = "";
}

/**
 * @dev Estimates the amount to be received in the swap
 * @notice Calculates output amount based on current reserves and input amount
 */
async function estimarIntercambio() {
    try {
        if (!simpleSwapContract) {
            alert("Primero conecta tu billetera");
            return;
        }
        
        const amountIn = document.getElementById("amountIn").value;
        if (!amountIn || parseFloat(amountIn) <= 0) {
            alert("Ingresa una cantidad válida");
            return;
        }
        
        const tokenFrom = document.getElementById("tokenFrom").value;
        const amountInWei = ethers.utils.parseEther(amountIn);
        
        // @dev Get current reserves
        const [reserveA, reserveB] = await simpleSwapContract.getReserves();
        
        let reserveIn, reserveOut;
        if (tokenFrom === "A") {
            reserveIn = reserveA;
            reserveOut = reserveB;
        } else {
            reserveIn = reserveB;
            reserveOut = reserveA;
        }
        
        // @dev Calculate output amount
        const amountOut = await simpleSwapContract.getAmountOut(amountInWei, reserveIn, reserveOut);
        document.getElementById("amountOut").value = ethers.utils.formatEther(amountOut);
        
        // @dev Enable approval button
        document.getElementById("approveButton").disabled = false;
        
        document.getElementById("swapResult").innerText = "Estimación actualizada";
        document.getElementById("swapResult").className = "success";
        
    } catch (error) {
        console.error("Error al estimar intercambio:", error);
        document.getElementById("swapResult").innerText = "Error al estimar intercambio";
        document.getElementById("swapResult").className = "error";
    }
}

/**
 * @dev Approves token for swap
 * @notice Grants allowance to the contract to spend user's tokens
 */
async function aprobarToken() {
    try {
        const amountIn = document.getElementById("amountIn").value;
        const tokenFrom = document.getElementById("tokenFrom").value;
        
        if (!amountIn || parseFloat(amountIn) <= 0) {
            alert("Primero estima el intercambio");
            return;
        }
        
        const amountInWei = ethers.utils.parseEther(amountIn);
        const tokenContract = tokenFrom === "A" ? tokenAContract : tokenBContract;
        
        document.getElementById("swapResult").innerText = "Aprobando token...";
        document.getElementById("swapResult").className = "";
        
        const tx = await tokenContract.approve(addressContract, amountInWei);
        await tx.wait();
        
        // @dev Enable swap button
        document.getElementById("swapButton").disabled = false;
        
        document.getElementById("swapResult").innerText = "Token aprobado exitosamente";
        document.getElementById("swapResult").className = "success";
        
    } catch (error) {
        console.error("Error al aprobar token:", error);
        document.getElementById("swapResult").innerText = "Error al aprobar token";
        document.getElementById("swapResult").className = "error";
    }
}

/**
 * @dev Executes the token swap
 * @notice Performs the actual token exchange with slippage protection
 */
async function ejecutarIntercambio() {
    try {
        const amountIn = document.getElementById("amountIn").value;
        const amountOut = document.getElementById("amountOut").value;
        const tokenFrom = document.getElementById("tokenFrom").value;
        const tokenTo = document.getElementById("tokenTo").value;
        const slippage = parseFloat(document.getElementById("slippage").value) || 0.5;
        const deadlineMinutes = parseInt(document.getElementById("deadline").value) || 20;
        
        if (!amountIn || !amountOut) {
            alert("Primero estima el intercambio");
            return;
        }
        
        const amountInWei = ethers.utils.parseEther(amountIn);
        const amountOutWei = ethers.utils.parseEther(amountOut);
        
        // @dev Calculate minimum amount with slippage
        const slippageMultiplier = (100 - slippage) / 100;
        const amountOutMin = amountOutWei.mul(Math.floor(slippageMultiplier * 10000)).div(10000);
        
        // @dev Create swap path
        const path = tokenFrom === "A" ? [tokenAAddress, tokenBAddress] : [tokenBAddress, tokenAAddress];
        
        // @dev Calculate deadline
        const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
        
        document.getElementById("swapResult").innerText = "Ejecutando intercambio...";
        document.getElementById("swapResult").className = "";
        
        // @dev Execute swap
        const tx = await simpleSwapContract.swapExactTokensForTokens(
            amountInWei,
            amountOutMin,
            path,
            userAddress,
            deadline
        );
        
        await tx.wait();
        
        // @dev Update information
        await obtenerInfoPool();
        await obtenerBalances();
        
        // @dev Clear form
        document.getElementById("amountIn").value = "";
        document.getElementById("amountOut").value = "";
        document.getElementById("approveButton").disabled = true;
        document.getElementById("swapButton").disabled = true;
        
        document.getElementById("swapResult").innerText = "¡Intercambio exitoso!";
        document.getElementById("swapResult").className = "success";
        
    } catch (error) {
        console.error("Error al ejecutar intercambio:", error);
        document.getElementById("swapResult").innerText = "Error al ejecutar intercambio";
        document.getElementById("swapResult").className = "error";
    }
}
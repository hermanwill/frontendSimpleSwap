// Configuración del contrato
const addressContract = "0xC52f33Cc4d48F3C72144C2b0E82C25B401bEF1f5"; // Reemplazar con la dirección real
const tokenAAddress = "0xB9D62F684D533D89ed7a59f0b97aa6847Ea7b935"; // Reemplazar con la dirección real del Token A
const tokenBAddress = "0x15d00E0E845d981f03010Aa69f6045EB305f30b6"; // Reemplazar con la dirección real del Token B

// ABI del contrato SimpleSwap (versión simplificada con las funciones principales)
const simpleSwapABI = [
    // Funciones de lectura
    "function getReserves() view returns (uint256 _reserveA, uint256 _reserveB)",
    "function getSupportedTokens() view returns (address _tokenA, address _tokenB)",
    "function getTotalLiquidity() view returns (uint256 total)",
    "function getPrice(address _tokenA, address _tokenB) view returns (uint256 price)",
    "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256 amountOut)",
    "function getLiquidityShares(address user) view returns (uint256 shares)",
    
    // Funciones de escritura
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
];

// ABI básico para tokens ERC20
const erc20ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// Variables globales
let signer;
let simpleSwapContract;
let tokenAContract;
let tokenBContract;
let userAddress;

/**
 * Conecta la billetera MetaMask
 */
async function conectar() {
    try {
        if (typeof window.ethereum !== "undefined") {
            console.log("MetaMask detectado");
            
            // Solicitar acceso a las cuentas
            await window.ethereum.request({ method: "eth_requestAccounts" });
            
            // Crear provider y signer
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
            
            // Mostrar dirección del usuario
            document.getElementById("accountAddress").innerText = `Conectado: ${userAddress}`;
            
            // Inicializar contratos
            simpleSwapContract = new ethers.Contract(addressContract, simpleSwapABI, signer);
            tokenAContract = new ethers.Contract(tokenAAddress, erc20ABI, signer);
            tokenBContract = new ethers.Contract(tokenBAddress, erc20ABI, signer);
            
            // Cargar información inicial
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
 * Obtiene la información del pool
 */
async function obtenerInfoPool() {
    try {
        if (!simpleSwapContract) {
            alert("Primero conecta tu billetera");
            return;
        }
        
        // Obtener tokens soportados
        const [tokenA, tokenB] = await simpleSwapContract.getSupportedTokens();
        document.getElementById("tokenAAddress").innerText = `Token A: ${tokenA}`;
        document.getElementById("tokenBAddress").innerText = `Token B: ${tokenB}`;
        
        // Obtener reservas
        const [reserveA, reserveB] = await simpleSwapContract.getReserves();
        document.getElementById("reserveA").innerText = `Reserva Token A: ${ethers.utils.formatEther(reserveA)}`;
        document.getElementById("reserveB").innerText = `Reserva Token B: ${ethers.utils.formatEther(reserveB)}`;
        
        // Obtener liquidez total
        const totalLiquidity = await simpleSwapContract.getTotalLiquidity();
        document.getElementById("totalLiquidity").innerText = `Liquidez Total: ${ethers.utils.formatEther(totalLiquidity)}`;
        
    } catch (error) {
        console.error("Error al obtener info del pool:", error);
        alert("Error al cargar información del pool");
    }
}

/**
 * Obtiene el precio de un token en función del otro
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
            // Precio de Token A en términos de Token B
            precio = await simpleSwapContract.getPrice(tokenAAddress, tokenBAddress);
            document.getElementById("priceResult").innerText = 
                `1 Token A = ${ethers.utils.formatEther(precio)} Token B`;
        } else {
            // Precio de Token B en términos de Token A
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
 * Obtiene los balances del usuario
 */
async function obtenerBalances() {
    try {
        if (!userAddress) {
            return;
        }
        
        // Balance Token A
        const balanceA = await tokenAContract.balanceOf(userAddress);
        document.getElementById("balanceA").innerText = `Token A: ${ethers.utils.formatEther(balanceA)}`;
        
        // Balance Token B
        const balanceB = await tokenBContract.balanceOf(userAddress);
        document.getElementById("balanceB").innerText = `Token B: ${ethers.utils.formatEther(balanceB)}`;
        
        // Balance LP Tokens
        const balanceLP = await simpleSwapContract.getLiquidityShares(userAddress);
        document.getElementById("balanceLP").innerText = `Tokens LP: ${ethers.utils.formatEther(balanceLP)}`;
        
    } catch (error) {
        console.error("Error al obtener balances:", error);
    }
}

/**
 * Cambia la dirección del intercambio (From <-> To)
 */
function cambiarDireccion() {
    const tokenFrom = document.getElementById("tokenFrom");
    const tokenTo = document.getElementById("tokenTo");
    
    const tempValue = tokenFrom.value;
    tokenFrom.value = tokenTo.value;
    tokenTo.value = tempValue;
    
    // Limpiar campos
    document.getElementById("amountIn").value = "";
    document.getElementById("amountOut").value = "";
    document.getElementById("swapResult").innerText = "";
}

/**
 * Estima la cantidad que se recibirá en el intercambio
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
        
        // Obtener reservas actuales
        const [reserveA, reserveB] = await simpleSwapContract.getReserves();
        
        let reserveIn, reserveOut;
        if (tokenFrom === "A") {
            reserveIn = reserveA;
            reserveOut = reserveB;
        } else {
            reserveIn = reserveB;
            reserveOut = reserveA;
        }
        
        // Calcular cantidad de salida
        const amountOut = await simpleSwapContract.getAmountOut(amountInWei, reserveIn, reserveOut);
        document.getElementById("amountOut").value = ethers.utils.formatEther(amountOut);
        
        // Habilitar botón de aprobación
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
 * Aprueba el token para el intercambio
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
        
        // Habilitar botón de intercambio
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
 * Ejecuta el intercambio de tokens
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
        
        // Calcular cantidad mínima con slippage
        const slippageMultiplier = (100 - slippage) / 100;
        const amountOutMin = amountOutWei.mul(Math.floor(slippageMultiplier * 10000)).div(10000);
        
        // Crear path
        const path = tokenFrom === "A" ? [tokenAAddress, tokenBAddress] : [tokenBAddress, tokenAAddress];
        
        // Calcular deadline
        const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
        
        document.getElementById("swapResult").innerText = "Ejecutando intercambio...";
        document.getElementById("swapResult").className = "";
        
        // Ejecutar swap
        const tx = await simpleSwapContract.swapExactTokensForTokens(
            amountInWei,
            amountOutMin,
            path,
            userAddress,
            deadline
        );
        
        await tx.wait();
        
        // Actualizar información
        await obtenerInfoPool();
        await obtenerBalances();
        
        // Limpiar formulario
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
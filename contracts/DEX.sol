// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "contracts/LPToken.sol";

contract DEX {
    ERC20 public tokenA;
    ERC20 public tokenB;

    LPToken public LPT;

    uint256 public reserveA;
    uint256 public reserveB;

    uint256 public issuedLPTs;

    uint256 public constant SWAP_FEE_NUMERATOR = 3;
    uint256 public constant SWAP_FEE_DENOMINATOR = 1000;

    event LiquidityAdded(
        address user,
        uint256 amountA,
        uint256 amountB,
        uint256 mintedLPT,
        uint256 reserveA,
        uint256 reserveB
    );
    event SwapPerformed(
        address user,
        uint256 amountIn,
        uint256 amountOut,
        bool isAtoB,
        uint256 swapFee
    );
    event LiquidityRemoved(
        address user,
        uint256 amountLpt,
        uint256 amountA,
        uint256 amountB
    );

    constructor(address _tokenA, address _tokenB) {
        require(
            _tokenA != address(0) && _tokenB != address(0),
            "Invalid token address"
        );
        tokenA = ERC20(_tokenA);
        tokenB = ERC20(_tokenB);
        LPT = new LPToken();
    }

    function spotPrice() public view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(amountA > 0, "Amount for Token A should be greater than 0");
        require(amountB > 0, "Amount for Token B should be greater than 0");

        uint256 approvedAmountA = tokenA.allowance(msg.sender, address(this));
        uint256 approvedAmountB = tokenB.allowance(msg.sender, address(this));

        require(
            amountA <= approvedAmountA,
            "Insufficient approved amount for Token A"
        );
        require(
            amountB <= approvedAmountB,
            "Insufficient approved amount for Token B"
        );

        bool successA = tokenA.transferFrom(msg.sender, address(this), amountA);
        bool successB = tokenB.transferFrom(msg.sender, address(this), amountB);

        require(successA && successB, "Token transfer failed!");

        if (reserveA != 0 && reserveB != 0) {
            uint256 depositB = (amountA * reserveB) / reserveA;
            require(amountB == depositB, "Invalid ratio of amounts");
        }

        uint256 mintedLPT;

        if (issuedLPTs == 0) {
            // Set the Initial Ratio (100 TKA = 1 LPT)
            uint256 tkaDecimals = 10**tokenA.decimals();
            uint256 ratioBase = 100 * tkaDecimals;
            uint256 lptDecimals = 10**LPT.decimals();

            mintedLPT = (amountA * lptDecimals) / ratioBase;
        } else {
            mintedLPT = (amountA * issuedLPTs) / reserveA;
        }

        require(mintedLPT > 0, "Deposit insufficient to mint LPTs");
        LPT.mint(msg.sender, mintedLPT);
        issuedLPTs += mintedLPT;

        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(
            msg.sender,
            amountA,
            amountB,
            mintedLPT,
            reserveA,
            reserveB
        );
    }

    function removeLiquidity(uint256 amountLPT) external {
        require(amountLPT > 0, "LPT to be burned must be greater than 0");
        require(issuedLPTs > 0, "Pool empty");

        require(LPT.balanceOf(msg.sender) >= amountLPT, "Insufficient Balance");

        uint256 amountA = (amountLPT * reserveA) / issuedLPTs;
        uint256 amountB = (amountLPT * reserveB) / issuedLPTs;

        require(amountA > 0 && amountB > 0, "Amount too small");

        LPT.burn(msg.sender, amountLPT);

        reserveA -= amountA;
        reserveB -= amountB;
        issuedLPTs -= amountLPT;

        require(tokenA.transfer(msg.sender, amountA), "tokenA transfer failed");
        require(tokenB.transfer(msg.sender, amountB), "tokenB transfer failed");

        emit LiquidityRemoved(msg.sender, amountLPT, amountA, amountB);
    }

    function swap(uint256 amountIn, bool isAtoB) external {
        require(amountIn > 0, "Input amount must be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Pool empty");

        (
            ERC20 tokenIn,
            ERC20 tokenOut,
            uint256 reserveIn,
            uint256 reserveOut
        ) = (isAtoB)
                ? (tokenA, tokenB, reserveA, reserveB)
                : (tokenB, tokenA, reserveB, reserveA);

        uint256 approvedAmountIn = tokenIn.allowance(msg.sender, address(this));
        require(
            approvedAmountIn >= amountIn,
            "Insufficient approved amount for TokenIn"
        );

        require(
            tokenIn.transferFrom(msg.sender, address(this), amountIn),
            "TokenIn transfer failed!"
        );

        // Deduct swap fee
        uint256 swapFee = (amountIn * SWAP_FEE_NUMERATOR) /
            SWAP_FEE_DENOMINATOR;
        uint256 amountInWithFee = amountIn - swapFee;

        uint256 amountOut = reserveOut -
            (reserveIn * reserveOut) /
            (reserveIn + amountInWithFee);

        require(amountOut > 0, "Output amount too small");

        require(
            tokenOut.transfer(msg.sender, amountOut),
            "TokenOut transfer failed!"
        );

        reserveIn += amountIn;
        reserveOut -= amountOut;

        if (isAtoB) {
            reserveA = reserveIn;
            reserveB = reserveOut;
        } else {
            reserveB = reserveIn;
            reserveA = reserveOut;
        }

        emit SwapPerformed(msg.sender, amountIn, amountOut, isAtoB, swapFee);
    }
}

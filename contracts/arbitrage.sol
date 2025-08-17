// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./DEX.sol";

contract Arbitrage {
    ERC20 tokenA;
    ERC20 tokenB;
    DEX dex1;
    DEX dex2;

    // At least 0.05% profit margin
    uint256 public constant MIN_PROFIT_PERCENTAGE_NUMERATOR = 5;
    uint256 public constant MIN_PROFIT_PERCENTAGE_DENOMINATOR = 10000;

    // Neglect small profits to account for gas
    uint256 public constant MIN_PROFIT_ABSOLUTE = 1e12;

    // Struct for reserves
    struct Reserves {
        uint256 rA1;
        uint256 rB1;
        uint256 rA2;
        uint256 rB2;
    }

    constructor(address addressDex1, address addressDex2) {
        dex1 = DEX(addressDex1);
        dex2 = DEX(addressDex2);
        tokenA = DEX(dex1).tokenA();
        tokenB = DEX(dex1).tokenB();
    }

    function executeArbitrage(uint256 amount)
        external
        returns (uint256 profit)
    {
        uint256 reserveA1 = dex1.reserveA();
        uint256 reserveB1 = dex1.reserveB();

        uint256 reserveA2 = dex2.reserveA();
        uint256 reserveB2 = dex2.reserveB();

        require(amount > 0, "Amount should be greater than 0");

        // Compute profits for both arbitrage directions in a helper
        (
            uint256 profitABA,
            bool d1Tod2ABA,
            uint256 profitBAB,
            bool d1Tod2BAB
        ) = computeProfits(reserveA1, reserveB1, reserveA2, reserveB2, amount);

        bool isABAFeasible = checkFeasible(profitABA, amount);
        bool isBABFeasible = checkFeasible(profitBAB, amount);

        require(isABAFeasible || isBABFeasible, "Insufficient profit");

        if (isABAFeasible) {
            profit = executeABA(amount, d1Tod2ABA);
        } else {
            profit = executeBAB(amount, d1Tod2BAB);
        }
    }

    function computeProfits(
        uint256 reserveA1,
        uint256 reserveB1,
        uint256 reserveA2,
        uint256 reserveB2,
        uint256 amount
    )
        internal
        pure
        returns (
            uint256 profitABA,
            bool d1Tod2ABA,
            uint256 profitBAB,
            bool d1Tod2BAB
        )
    {
        uint256 profitABA1 = calculateProfitABA(
            getReserves(reserveA1, reserveB1, reserveA2, reserveB2, true),
            amount
        );
        uint256 profitBAB1 = calculateProfitBAB(
            getReserves(reserveA1, reserveB1, reserveA2, reserveB2, true),
            amount
        );
        uint256 profitABA2 = calculateProfitABA(
            getReserves(reserveA1, reserveB1, reserveA2, reserveB2, false),
            amount
        );
        uint256 profitBAB2 = calculateProfitBAB(
            getReserves(reserveA1, reserveB1, reserveA2, reserveB2, false),
            amount
        );

        (profitABA, d1Tod2ABA) = chooseProfit(profitABA1, profitABA2);
        (profitBAB, d1Tod2BAB) = chooseProfit(profitBAB1, profitBAB2);
    }

    function chooseProfit(uint256 value1, uint256 value2)
        internal
        pure
        returns (uint256 profit, bool isDex1ToDex2)
    {
        if (value1 > value2) {
            return (value1, true);
        }
        return (value2, false);
    }

    function checkFeasible(uint256 profit, uint256 amount)
        internal
        pure
        returns (bool feasible)
    {
        if (profit < MIN_PROFIT_ABSOLUTE) return false;

        uint256 minProfitByPercentage = (amount *
            MIN_PROFIT_PERCENTAGE_NUMERATOR) /
            MIN_PROFIT_PERCENTAGE_DENOMINATOR;
        return profit >= minProfitByPercentage;
    }

    function calculateProfitABA(Reserves memory reserves, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        uint256 x = amount;
        uint256 swapFee = (x * 3) / 1000;
        uint256 amountInWithFee = x - swapFee;
        uint256 amountOutB = (amountInWithFee * reserves.rB1) /
            (reserves.rA1 + amountInWithFee);

        swapFee = (amountOutB * 3) / 1000;
        uint256 amountInWithFeeB = amountOutB - swapFee;
        uint256 amountOutA = (amountInWithFeeB * reserves.rA2) /
            (reserves.rB2 + amountInWithFeeB);

        return amountOutA > x ? amountOutA - x : 0;
    }

    function calculateProfitBAB(Reserves memory reserves, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        uint256 x = amount;
        uint256 swapFee = (x * 3) / 1000;
        uint256 amountInWithFee = x - swapFee;
        uint256 amountOutA = (amountInWithFee * reserves.rA1) /
            (reserves.rB1 + amountInWithFee);

        swapFee = (amountOutA * 3) / 1000;
        uint256 amountInWithFeeA = amountOutA - swapFee;
        uint256 amountOutB = (amountInWithFeeA * reserves.rB2) /
            (reserves.rA2 + amountInWithFeeA);

        return amountOutB > x ? amountOutB - x : 0;
    }

    function executeABA(uint256 amount, bool isDex1toDex2)
        internal
        returns (uint256 profit)
    {
        (DEX d1, DEX d2) = isDex1toDex2 ? (dex1, dex2) : (dex2, dex1);
        uint256 amountIn = amount;

        tokenA.transferFrom(msg.sender, address(this), amountIn);
        tokenA.approve(address(d1), amountIn);
        d1.swap(amountIn, true);

        uint256 receivedB = tokenB.balanceOf(address(this));
        tokenB.approve(address(d2), receivedB);
        d2.swap(receivedB, false);

        uint256 finalA = tokenA.balanceOf(address(this));
        profit = finalA - amountIn;
        tokenA.transfer(msg.sender, finalA);
    }

    function executeBAB(uint256 amount, bool isDex1toDex2)
        internal
        returns (uint256 profit)
    {
        (DEX d1, DEX d2) = isDex1toDex2 ? (dex1, dex2) : (dex2, dex1);
        uint256 amountIn = amount;

        tokenB.transferFrom(msg.sender, address(this), amountIn);
        tokenB.approve(address(d1), amountIn);
        d1.swap(amountIn, false);

        uint256 receivedA = tokenA.balanceOf(address(this));
        tokenA.approve(address(d2), receivedA);
        d2.swap(receivedA, true);

        uint256 finalB = tokenB.balanceOf(address(this));
        profit = finalB - amountIn;
        tokenB.transfer(msg.sender, finalB);
    }

    function getReserves(
        uint256 reserveA1,
        uint256 reserveB1,
        uint256 reserveA2,
        uint256 reserveB2,
        bool isDex1toDex2
    ) internal pure returns (Reserves memory) {
        if (isDex1toDex2) {
            return Reserves(reserveA1, reserveB1, reserveA2, reserveB2);
        } else {
            return Reserves(reserveA2, reserveB2, reserveA1, reserveB1);
        }
    }
}

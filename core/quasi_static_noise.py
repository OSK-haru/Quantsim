"""Deterministic quadrature for Gaussian quasi-static detuning noise.

The general ensemble model is

    delta ~ Normal(0, sigma**2),
    rho_bar(t) = integral rho(t; delta) p(delta) d delta.

With delta = sqrt(2) sigma x, the normal-density integral becomes

    rho_bar(t) = 1/sqrt(pi) integral exp(-x**2)
                 rho(t; sqrt(2) sigma x) dx.

Gauss-Hermite quadrature is used because its weight is exactly exp(-x**2).
This is a deterministic replacement for Monte Carlo sampling: it removes
shot noise and needs fewer evolutions for the small interactive simulator.
It does not change the physical distribution being approximated.
"""

from __future__ import annotations

import math

import numpy as np


def gaussian_quasi_static_detuning_samples(
    sigma_rad_per_us: float,
    order: int,
) -> tuple[tuple[float, float], ...]:
    """Return ``(detuning_offset, normalized_weight)`` quadrature pairs."""

    sigma = float(sigma_rad_per_us)
    if not math.isfinite(sigma) or sigma < 0.0:
        raise ValueError("sigma_rad_per_us must be finite and non-negative")
    if order not in {3, 5, 7, 9}:
        raise ValueError("quadrature order must be one of 3, 5, 7, or 9")
    if sigma == 0.0:
        return ((0.0, 1.0),)

    nodes, weights = np.polynomial.hermite.hermgauss(order)
    normalized = weights / math.sqrt(math.pi)
    return tuple(
        (float(math.sqrt(2.0) * sigma * node), float(weight))
        for node, weight in zip(nodes, normalized, strict=True)
    )


def correlated_gaussian_detuning_pair_samples(
    sigmas_rad_per_us: tuple[float, float],
    correlation: float,
    order: int,
) -> tuple[tuple[tuple[float, float], float], ...]:
    """Return deterministic samples for a correlated two-normal vector.

    If ``z0`` and ``z1`` are independent standard normals, the Cholesky
    transform

        delta0 = sigma0 z0
        delta1 = sigma1 (correlation z0 + sqrt(1-correlation**2) z1)

    has covariance ``[[sigma0**2, r sigma0 sigma1], [..., sigma1**2]]``.
    Tensor-product Gauss-Hermite quadrature evaluates the two expectations.
    """

    sigma0, sigma1 = (float(value) for value in sigmas_rad_per_us)
    if any(not math.isfinite(value) or value < 0.0 for value in (sigma0, sigma1)):
        raise ValueError("pair sigmas must be finite and non-negative")
    r = float(correlation)
    if not math.isfinite(r) or not -1.0 <= r <= 1.0:
        raise ValueError("correlation must be finite and between -1 and 1")
    if sigma0 == 0.0 and sigma1 == 0.0:
        return ((((0.0, 0.0), 1.0)),)

    standard = gaussian_quasi_static_detuning_samples(1.0, order)
    if sigma0 == 0.0:
        return tuple(((0.0, sigma1 * z), weight) for z, weight in standard)
    if sigma1 == 0.0:
        return tuple(((sigma0 * z, 0.0), weight) for z, weight in standard)
    residual = math.sqrt(max(0.0, 1.0 - r * r))
    return tuple(
        (
            (
                sigma0 * z0,
                sigma1 * (r * z0 + residual * z1),
            ),
            weight0 * weight1,
        )
        for z0, weight0 in standard
        for z1, weight1 in standard
    )

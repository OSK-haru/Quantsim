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


def correlated_gaussian_detuning_chain_samples(
    sigmas_rad_per_us: tuple[float, ...],
    adjacent_correlation: float,
    order: int,
) -> tuple[tuple[tuple[float, ...], float], ...]:
    """Return deterministic samples for a chain of quasi-static detunings.

    Each transmon ``i`` carries an independent width ``sigma_i``; neighbouring
    transmons share the correlation coefficient ``adjacent_correlation`` and
    non-neighbours are independent, i.e. the covariance is the tridiagonal
    matrix ``Sigma_ij = sigma_i sigma_j * (1 if i == j else r if |i-j| == 1
    else 0)``.  The offsets are drawn from a tensor-product Gauss-Hermite grid
    over the standard normals and mapped through the Cholesky factor of the
    normalised (unit-diagonal) covariance, so the sample count is
    ``order ** count`` before the zero-width transmons collapse their axes.

    For ``count == 2`` this reproduces
    :func:`correlated_gaussian_detuning_pair_samples`.
    """

    sigmas = tuple(float(value) for value in sigmas_rad_per_us)
    if not sigmas:
        raise ValueError("chain sigmas must not be empty")
    if any(not math.isfinite(value) or value < 0.0 for value in sigmas):
        raise ValueError("chain sigmas must be finite and non-negative")
    r = float(adjacent_correlation)
    if not math.isfinite(r) or not -1.0 <= r <= 1.0:
        raise ValueError("adjacent_correlation must be finite and between -1 and 1")

    count = len(sigmas)
    active = [index for index, sigma in enumerate(sigmas) if sigma > 0.0]
    if not active:
        return (((0.0,) * count, 1.0),)

    # Correlation only couples active neighbours that are adjacent in the full
    # register; a zero-width transmon between two others breaks the chain.
    unit_correlation = np.eye(len(active))
    for position in range(len(active) - 1):
        if active[position + 1] - active[position] == 1:
            unit_correlation[position, position + 1] = r
            unit_correlation[position + 1, position] = r
    cholesky = np.linalg.cholesky(unit_correlation)

    standard = gaussian_quasi_static_detuning_samples(1.0, order)

    def grid(depth: int) -> tuple[tuple[tuple[float, ...], float], ...]:
        if depth == 0:
            return (((), 1.0),)
        return tuple(
            ((*rest, node), rest_weight * weight)
            for rest, rest_weight in grid(depth - 1)
            for node, weight in standard
        )

    samples: list[tuple[tuple[float, ...], float]] = []
    for standard_vector, weight in grid(len(active)):
        correlated = cholesky @ np.asarray(standard_vector)
        offsets = [0.0] * count
        for position, register_index in enumerate(active):
            offsets[register_index] = sigmas[register_index] * float(
                correlated[position]
            )
        samples.append((tuple(offsets), weight))
    return tuple(samples)

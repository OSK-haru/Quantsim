"""Stable evolution-method identifiers shared by config and executors."""

FIXED_STEP_RK4 = "fixed_step_rk4"
EXPLICIT_CPTP = "explicit_cptp"
SUPPORTED_GATE_AWARE_EVOLUTION_METHODS = (
    FIXED_STEP_RK4,
    EXPLICIT_CPTP,
)

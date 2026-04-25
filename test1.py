from numpy import rint

from core.circuit import H_GATE_DURATION_US
from core.evolution import simulate_once
from core.metrics import purity_series, fidelity_series, effective_time

times, states = simulate_once(0.1, 0.1, 0.1)
times2, states2 = simulate_once(0.8, 0.1, 0.8)


p1 = purity_series(states)
p2 = purity_series(states2)

print("purity:")
print(p1[:5], p1[-5:])
print(p2[:5], p2[-5:])

# ideal（ノイズなし）
times_ideal, states_ideal = simulate_once(0.1, 0.1, 0.0)

f = fidelity_series(states, states_ideal)
f_bad = fidelity_series(states2, states_ideal)

print("fidelaity:")

print(f[-5:])
print(f_bad[-5:])

t_eff = effective_time(times, f, threshold=0.9)
t_eff_bad = effective_time(times2, f_bad, threshold=0.9)

print("effective time:")
print(t_eff, t_eff_bad)

print("others:")
print(H_GATE_DURATION_US)

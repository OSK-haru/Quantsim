use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

#[pyfunction]
fn backend_name() -> &'static str {
    "rust_dense_preview"
}

#[pyfunction]
fn add_f64(a: f64, b: f64) -> f64 {
    a + b
}

#[pyfunction]
fn matmul_complex_flat(a: Vec<f64>, b: Vec<f64>, d: usize) -> PyResult<Vec<f64>> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("a", a.len(), element_count, d)?;
    validate_matrix_len("b", b.len(), element_count, d)?;
    Ok(matmul_flat(&a, &b, d))
}

#[pyfunction]
fn lindblad_rhs_flat(
    rho: Vec<f64>,
    h: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
) -> PyResult<Vec<f64>> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("rho", rho.len(), element_count, d)?;
    validate_matrix_len("h", h.len(), element_count, d)?;
    let collapse_len = num_ops
        .checked_mul(element_count)
        .ok_or_else(|| PyValueError::new_err("collapse operator count is too large"))?;
    if collapse_ops.len() != collapse_len {
        return Err(PyValueError::new_err(format!(
            "collapse_ops length must be num_ops * 2 * d * d; received len(collapse_ops)={} for num_ops={} and d={}",
            collapse_ops.len(),
            num_ops,
            d
        )));
    }

    Ok(lindblad_rhs_raw(&rho, &h, &collapse_ops, num_ops, d))
}

#[pyfunction]
fn gksl_exponential_superoperator_flat(
    h: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
    duration_us: f64,
) -> PyResult<Vec<f64>> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("h", h.len(), element_count, d)?;
    validate_collapse_ops_len(collapse_ops.len(), num_ops, element_count, d)?;
    validate_finite_matrix("h", &h)?;
    validate_finite_matrix("collapse_ops", &collapse_ops)?;
    validate_hermitian(&h, d)?;
    if !duration_us.is_finite() || duration_us < 0.0 {
        return Err(PyValueError::new_err(
            "duration_us must be finite and non-negative",
        ));
    }

    let generator = gksl_liouvillian_superoperator_raw(&h, &collapse_ops, num_ops, d);
    matrix_exponential_pade13(&scale_flat(&generator, duration_us), d * d)
        .map_err(PyValueError::new_err)
}

#[pyfunction]
fn gksl_piecewise_superoperator_flat(
    hamiltonians: Vec<f64>,
    interval_durations_us: Vec<f64>,
    num_intervals: usize,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
) -> PyResult<Vec<f64>> {
    if num_intervals == 0 {
        return Err(PyValueError::new_err(
            "num_intervals must be greater than 0",
        ));
    }
    if interval_durations_us.len() != num_intervals {
        return Err(PyValueError::new_err(
            "interval_durations_us length must equal num_intervals",
        ));
    }
    let element_count = matrix_element_count(d)?;
    let expected_hamiltonian_len = num_intervals
        .checked_mul(element_count)
        .ok_or_else(|| PyValueError::new_err("interval count is too large"))?;
    if hamiltonians.len() != expected_hamiltonian_len {
        return Err(PyValueError::new_err(
            "hamiltonians length must equal num_intervals * 2 * d * d",
        ));
    }
    validate_collapse_ops_len(collapse_ops.len(), num_ops, element_count, d)?;
    validate_finite_matrix("hamiltonians", &hamiltonians)?;
    validate_finite_matrix("collapse_ops", &collapse_ops)?;

    let superoperator_dimension = d * d;
    let mut composed = identity_flat(superoperator_dimension);
    for (interval_index, duration) in interval_durations_us.iter().enumerate() {
        if !duration.is_finite() || *duration <= 0.0 {
            return Err(PyValueError::new_err(
                "interval durations must be finite and positive",
            ));
        }
        let start = interval_index * element_count;
        let end = start + element_count;
        let hamiltonian = &hamiltonians[start..end];
        validate_hermitian(hamiltonian, d)?;
        let generator = gksl_liouvillian_superoperator_raw(hamiltonian, &collapse_ops, num_ops, d);
        let interval_map =
            matrix_exponential_pade13(&scale_flat(&generator, *duration), superoperator_dimension)
                .map_err(PyValueError::new_err)?;
        composed = matmul_flat(&interval_map, &composed, superoperator_dimension);
    }
    Ok(composed)
}

#[pyfunction]
fn rk4_evolve_flat(
    rho: Vec<f64>,
    h: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
    dt: f64,
    substeps: usize,
) -> PyResult<Vec<f64>> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("rho", rho.len(), element_count, d)?;
    validate_matrix_len("h", h.len(), element_count, d)?;
    validate_collapse_ops_len(collapse_ops.len(), num_ops, element_count, d)?;
    if substeps == 0 {
        return Err(PyValueError::new_err("substeps must be greater than 0"));
    }
    if !dt.is_finite() {
        return Err(PyValueError::new_err("dt must be finite"));
    }

    let mut evolved = rho;
    for _ in 0..substeps {
        let k1 = lindblad_rhs_raw(&evolved, &h, &collapse_ops, num_ops, d);
        let k2_state = add_scaled_flat(&evolved, &k1, 0.5 * dt);
        let k2 = lindblad_rhs_raw(&k2_state, &h, &collapse_ops, num_ops, d);
        let k3_state = add_scaled_flat(&evolved, &k2, 0.5 * dt);
        let k3 = lindblad_rhs_raw(&k3_state, &h, &collapse_ops, num_ops, d);
        let k4_state = add_scaled_flat(&evolved, &k3, dt);
        let k4 = lindblad_rhs_raw(&k4_state, &h, &collapse_ops, num_ops, d);

        for index in 0..element_count {
            evolved[index] +=
                dt / 6.0 * (k1[index] + 2.0 * k2[index] + 2.0 * k3[index] + k4[index]);
        }
    }

    Ok(evolved)
}

#[pyfunction]
fn rk4_time_dependent_stages_flat(
    rho: Vec<f64>,
    h1: Vec<f64>,
    h2: Vec<f64>,
    h3: Vec<f64>,
    h4: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
    dt: f64,
) -> PyResult<Vec<f64>> {
    let element_count = validate_time_dependent_rk4_inputs(
        &rho,
        &h1,
        &h2,
        &h3,
        &h4,
        &collapse_ops,
        num_ops,
        d,
        dt,
    )?;
    let (k1, k2, k3, k4) =
        rk4_time_dependent_stages_raw(&rho, &h1, &h2, &h3, &h4, &collapse_ops, num_ops, d, dt);
    let mut stages = Vec::with_capacity(4 * element_count);
    stages.extend_from_slice(&k1);
    stages.extend_from_slice(&k2);
    stages.extend_from_slice(&k3);
    stages.extend_from_slice(&k4);
    Ok(stages)
}

#[pyfunction]
fn rk4_time_dependent_step_flat(
    rho: Vec<f64>,
    h1: Vec<f64>,
    h2: Vec<f64>,
    h3: Vec<f64>,
    h4: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
    dt: f64,
) -> PyResult<Vec<f64>> {
    validate_time_dependent_rk4_inputs(&rho, &h1, &h2, &h3, &h4, &collapse_ops, num_ops, d, dt)?;
    let (k1, k2, k3, k4) =
        rk4_time_dependent_stages_raw(&rho, &h1, &h2, &h3, &h4, &collapse_ops, num_ops, d, dt);
    let mut evolved = rho;
    for index in 0..evolved.len() {
        evolved[index] += dt / 6.0 * (k1[index] + 2.0 * k2[index] + 2.0 * k3[index] + k4[index]);
    }
    Ok(evolved)
}

#[pyfunction]
fn rk4_evolve_cleaned_flat(
    rho: Vec<f64>,
    h: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
    dt: f64,
    substeps: usize,
) -> PyResult<Vec<f64>> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("rho", rho.len(), element_count, d)?;
    validate_matrix_len("h", h.len(), element_count, d)?;
    validate_collapse_ops_len(collapse_ops.len(), num_ops, element_count, d)?;
    if substeps == 0 {
        return Err(PyValueError::new_err("substeps must be greater than 0"));
    }
    if !dt.is_finite() {
        return Err(PyValueError::new_err("dt must be finite"));
    }

    let mut evolved = rho;
    for _ in 0..substeps {
        evolved = rk4_step_raw(&evolved, &h, &collapse_ops, num_ops, d, dt);
        clean_density_flat(&mut evolved, d)?;
    }

    Ok(evolved)
}

#[pyfunction]
fn rk4_evolve_cleaned_samples_flat(
    rho: Vec<f64>,
    h: Vec<f64>,
    collapse_ops: Vec<f64>,
    num_ops: usize,
    d: usize,
    dt: f64,
    sample_substeps: Vec<usize>,
) -> PyResult<Vec<f64>> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("rho", rho.len(), element_count, d)?;
    validate_matrix_len("h", h.len(), element_count, d)?;
    validate_collapse_ops_len(collapse_ops.len(), num_ops, element_count, d)?;
    if !dt.is_finite() {
        return Err(PyValueError::new_err("dt must be finite"));
    }
    if sample_substeps.is_empty() {
        return Err(PyValueError::new_err("sample_substeps must be non-empty"));
    }
    for substeps in sample_substeps.iter() {
        if *substeps == 0 {
            return Err(PyValueError::new_err(
                "sample_substeps entries must be greater than 0",
            ));
        }
    }

    let total_output_len = sample_substeps
        .len()
        .checked_mul(element_count)
        .ok_or_else(|| PyValueError::new_err("sample output length is too large"))?;
    let mut evolved = rho;
    let mut samples = Vec::with_capacity(total_output_len);
    for substeps in sample_substeps {
        for _ in 0..substeps {
            evolved = rk4_step_raw(&evolved, &h, &collapse_ops, num_ops, d, dt);
            clean_density_flat(&mut evolved, d)?;
        }
        samples.extend_from_slice(&evolved);
    }

    Ok(samples)
}

fn lindblad_rhs_raw(
    rho: &[f64],
    h: &[f64],
    collapse_ops: &[f64],
    num_ops: usize,
    d: usize,
) -> Vec<f64> {
    let element_count = 2 * d * d;
    let h_rho = matmul_flat(h, rho, d);
    let rho_h = matmul_flat(rho, h, d);
    let mut derivative = vec![0.0_f64; element_count];

    for index in (0..element_count).step_by(2) {
        let commutator_real = h_rho[index] - rho_h[index];
        let commutator_imag = h_rho[index + 1] - rho_h[index + 1];
        derivative[index] += commutator_imag;
        derivative[index + 1] += -commutator_real;
    }

    for op_index in 0..num_ops {
        let start = op_index * element_count;
        let end = start + element_count;
        let collapse_op = &collapse_ops[start..end];
        let collapse_adjoint = conjugate_transpose_flat(collapse_op, d);
        let ldl = matmul_flat(&collapse_adjoint, collapse_op, d);
        let l_rho = matmul_flat(collapse_op, &rho, d);
        let term1 = matmul_flat(&l_rho, &collapse_adjoint, d);
        let term2 = matmul_flat(&ldl, &rho, d);
        let term3 = matmul_flat(&rho, &ldl, d);

        for index in 0..element_count {
            derivative[index] += term1[index] - 0.5 * (term2[index] + term3[index]);
        }
    }

    derivative
}

fn gksl_liouvillian_superoperator_raw(
    h: &[f64],
    collapse_ops: &[f64],
    num_ops: usize,
    d: usize,
) -> Vec<f64> {
    let superoperator_dimension = d * d;
    let mut generator = vec![0.0_f64; 2 * superoperator_dimension * superoperator_dimension];

    for input_column in 0..d {
        for input_row in 0..d {
            let vectorized_column = input_row + input_column * d;
            let mut basis = vec![0.0_f64; 2 * d * d];
            basis[2 * (input_row * d + input_column)] = 1.0;
            let derivative = lindblad_rhs_raw(&basis, h, collapse_ops, num_ops, d);

            for output_column in 0..d {
                for output_row in 0..d {
                    let vectorized_row = output_row + output_column * d;
                    let source = 2 * (output_row * d + output_column);
                    let target = 2 * (vectorized_row * superoperator_dimension + vectorized_column);
                    generator[target] = derivative[source];
                    generator[target + 1] = derivative[source + 1];
                }
            }
        }
    }
    generator
}

const PADE13_THETA: f64 = 5.371_920_351_148_152;
const PADE13_COEFFICIENTS: [f64; 14] = [
    64_764_752_532_480_000.0,
    32_382_376_266_240_000.0,
    7_771_770_303_897_600.0,
    1_187_353_796_428_800.0,
    129_060_195_264_000.0,
    10_559_470_521_600.0,
    670_442_572_800.0,
    33_522_128_640.0,
    1_323_241_920.0,
    40_840_800.0,
    960_960.0,
    16_380.0,
    182.0,
    1.0,
];

fn matrix_exponential_pade13(matrix: &[f64], d: usize) -> Result<Vec<f64>, String> {
    let one_norm = matrix_one_norm(matrix, d);
    if one_norm == 0.0 {
        return Ok(identity_flat(d));
    }
    let scaling_steps = if one_norm <= PADE13_THETA {
        0_u32
    } else {
        (one_norm / PADE13_THETA).log2().ceil() as u32
    };
    let scaled = scale_flat(matrix, 2.0_f64.powi(-(scaling_steps as i32)));
    let mut approximation = pade13(&scaled, d)?;
    for _ in 0..scaling_steps {
        approximation = matmul_flat(&approximation, &approximation, d);
    }
    Ok(approximation)
}

fn pade13(matrix: &[f64], d: usize) -> Result<Vec<f64>, String> {
    let identity = identity_flat(d);
    let matrix_2 = matmul_flat(matrix, matrix, d);
    let matrix_4 = matmul_flat(&matrix_2, &matrix_2, d);
    let matrix_6 = matmul_flat(&matrix_4, &matrix_2, d);
    let coefficients = PADE13_COEFFICIENTS;

    let numerator_inner = linear_combination_flat(
        &[
            (&matrix_6, coefficients[13]),
            (&matrix_4, coefficients[11]),
            (&matrix_2, coefficients[9]),
        ],
        d,
    );
    let numerator_outer = linear_combination_flat(
        &[
            (&matmul_flat(&matrix_6, &numerator_inner, d), 1.0),
            (&matrix_6, coefficients[7]),
            (&matrix_4, coefficients[5]),
            (&matrix_2, coefficients[3]),
            (&identity, coefficients[1]),
        ],
        d,
    );
    let numerator = matmul_flat(matrix, &numerator_outer, d);

    let denominator_inner = linear_combination_flat(
        &[
            (&matrix_6, coefficients[12]),
            (&matrix_4, coefficients[10]),
            (&matrix_2, coefficients[8]),
        ],
        d,
    );
    let denominator = linear_combination_flat(
        &[
            (&matmul_flat(&matrix_6, &denominator_inner, d), 1.0),
            (&matrix_6, coefficients[6]),
            (&matrix_4, coefficients[4]),
            (&matrix_2, coefficients[2]),
            (&identity, coefficients[0]),
        ],
        d,
    );
    solve_complex_matrix(
        &subtract_flat(&denominator, &numerator),
        &add_flat(&denominator, &numerator),
        d,
    )
}

fn solve_complex_matrix(a: &[f64], b: &[f64], d: usize) -> Result<Vec<f64>, String> {
    let mut left = a.to_vec();
    let mut right = b.to_vec();

    for pivot_column in 0..d {
        let mut pivot_row = pivot_column;
        let mut pivot_norm = 0.0_f64;
        for row in pivot_column..d {
            let index = 2 * (row * d + pivot_column);
            let norm = left[index] * left[index] + left[index + 1] * left[index + 1];
            if norm > pivot_norm {
                pivot_norm = norm;
                pivot_row = row;
            }
        }
        if pivot_norm <= f64::EPSILON {
            return Err("Pade linear solve encountered a singular matrix".to_string());
        }
        if pivot_row != pivot_column {
            swap_matrix_rows(&mut left, pivot_row, pivot_column, d);
            swap_matrix_rows(&mut right, pivot_row, pivot_column, d);
        }

        let pivot_index = 2 * (pivot_column * d + pivot_column);
        let pivot_real = left[pivot_index];
        let pivot_imag = left[pivot_index + 1];
        for column in 0..d {
            let left_index = 2 * (pivot_column * d + column);
            let (real, imag) = complex_divide(
                left[left_index],
                left[left_index + 1],
                pivot_real,
                pivot_imag,
            );
            left[left_index] = real;
            left[left_index + 1] = imag;

            let right_index = 2 * (pivot_column * d + column);
            let (real, imag) = complex_divide(
                right[right_index],
                right[right_index + 1],
                pivot_real,
                pivot_imag,
            );
            right[right_index] = real;
            right[right_index + 1] = imag;
        }

        for row in 0..d {
            if row == pivot_column {
                continue;
            }
            let factor_index = 2 * (row * d + pivot_column);
            let factor_real = left[factor_index];
            let factor_imag = left[factor_index + 1];
            for column in 0..d {
                let pivot_left = 2 * (pivot_column * d + column);
                let target_left = 2 * (row * d + column);
                let (product_real, product_imag) = complex_multiply(
                    factor_real,
                    factor_imag,
                    left[pivot_left],
                    left[pivot_left + 1],
                );
                left[target_left] -= product_real;
                left[target_left + 1] -= product_imag;

                let pivot_right = 2 * (pivot_column * d + column);
                let target_right = 2 * (row * d + column);
                let (product_real, product_imag) = complex_multiply(
                    factor_real,
                    factor_imag,
                    right[pivot_right],
                    right[pivot_right + 1],
                );
                right[target_right] -= product_real;
                right[target_right + 1] -= product_imag;
            }
        }
    }
    Ok(right)
}

fn identity_flat(d: usize) -> Vec<f64> {
    let mut identity = vec![0.0_f64; 2 * d * d];
    for index in 0..d {
        identity[2 * (index * d + index)] = 1.0;
    }
    identity
}

fn linear_combination_flat(terms: &[(&[f64], f64)], d: usize) -> Vec<f64> {
    let mut result = vec![0.0_f64; 2 * d * d];
    for (matrix, coefficient) in terms {
        for index in 0..result.len() {
            result[index] += coefficient * matrix[index];
        }
    }
    result
}

fn add_flat(left: &[f64], right: &[f64]) -> Vec<f64> {
    left.iter()
        .zip(right.iter())
        .map(|(left_value, right_value)| left_value + right_value)
        .collect()
}

fn subtract_flat(left: &[f64], right: &[f64]) -> Vec<f64> {
    left.iter()
        .zip(right.iter())
        .map(|(left_value, right_value)| left_value - right_value)
        .collect()
}

fn scale_flat(matrix: &[f64], scale: f64) -> Vec<f64> {
    matrix.iter().map(|value| scale * value).collect()
}

fn matrix_one_norm(matrix: &[f64], d: usize) -> f64 {
    let mut maximum = 0.0_f64;
    for column in 0..d {
        let mut column_sum = 0.0_f64;
        for row in 0..d {
            let index = 2 * (row * d + column);
            column_sum +=
                (matrix[index] * matrix[index] + matrix[index + 1] * matrix[index + 1]).sqrt();
        }
        maximum = maximum.max(column_sum);
    }
    maximum
}

fn swap_matrix_rows(matrix: &mut [f64], first: usize, second: usize, d: usize) {
    for column in 0..d {
        let first_index = 2 * (first * d + column);
        let second_index = 2 * (second * d + column);
        matrix.swap(first_index, second_index);
        matrix.swap(first_index + 1, second_index + 1);
    }
}

fn complex_multiply(
    left_real: f64,
    left_imag: f64,
    right_real: f64,
    right_imag: f64,
) -> (f64, f64) {
    (
        left_real * right_real - left_imag * right_imag,
        left_real * right_imag + left_imag * right_real,
    )
}

fn complex_divide(
    numerator_real: f64,
    numerator_imag: f64,
    denominator_real: f64,
    denominator_imag: f64,
) -> (f64, f64) {
    let denominator = denominator_real * denominator_real + denominator_imag * denominator_imag;
    (
        (numerator_real * denominator_real + numerator_imag * denominator_imag) / denominator,
        (numerator_imag * denominator_real - numerator_real * denominator_imag) / denominator,
    )
}

fn rk4_step_raw(
    rho: &[f64],
    h: &[f64],
    collapse_ops: &[f64],
    num_ops: usize,
    d: usize,
    dt: f64,
) -> Vec<f64> {
    let element_count = 2 * d * d;
    let k1 = lindblad_rhs_raw(rho, h, collapse_ops, num_ops, d);
    let k2_state = add_scaled_flat(rho, &k1, 0.5 * dt);
    let k2 = lindblad_rhs_raw(&k2_state, h, collapse_ops, num_ops, d);
    let k3_state = add_scaled_flat(rho, &k2, 0.5 * dt);
    let k3 = lindblad_rhs_raw(&k3_state, h, collapse_ops, num_ops, d);
    let k4_state = add_scaled_flat(rho, &k3, dt);
    let k4 = lindblad_rhs_raw(&k4_state, h, collapse_ops, num_ops, d);

    let mut evolved = rho.to_vec();
    for index in 0..element_count {
        evolved[index] += dt / 6.0 * (k1[index] + 2.0 * k2[index] + 2.0 * k3[index] + k4[index]);
    }
    evolved
}

fn rk4_time_dependent_stages_raw(
    rho: &[f64],
    h1: &[f64],
    h2: &[f64],
    h3: &[f64],
    h4: &[f64],
    collapse_ops: &[f64],
    num_ops: usize,
    d: usize,
    dt: f64,
) -> (Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>) {
    let k1 = lindblad_rhs_raw(rho, h1, collapse_ops, num_ops, d);
    let k2_state = add_scaled_flat(rho, &k1, 0.5 * dt);
    let k2 = lindblad_rhs_raw(&k2_state, h2, collapse_ops, num_ops, d);
    let k3_state = add_scaled_flat(rho, &k2, 0.5 * dt);
    let k3 = lindblad_rhs_raw(&k3_state, h3, collapse_ops, num_ops, d);
    let k4_state = add_scaled_flat(rho, &k3, dt);
    let k4 = lindblad_rhs_raw(&k4_state, h4, collapse_ops, num_ops, d);
    (k1, k2, k3, k4)
}

fn clean_density_flat(rho: &mut Vec<f64>, d: usize) -> PyResult<()> {
    let adjoint = conjugate_transpose_flat(rho, d);
    for index in 0..rho.len() {
        rho[index] = 0.5 * (rho[index] + adjoint[index]);
    }

    let mut trace_real = 0.0_f64;
    let mut trace_imag = 0.0_f64;
    for index in 0..d {
        let diagonal = 2 * (index * d + index);
        trace_real += rho[diagonal];
        trace_imag += rho[diagonal + 1];
    }

    let trace_norm_squared = trace_real * trace_real + trace_imag * trace_imag;
    if trace_norm_squared == 0.0 {
        return Err(PyValueError::new_err(
            "density matrix trace vanished during evolution",
        ));
    }

    let inverse_real = trace_real / trace_norm_squared;
    let inverse_imag = -trace_imag / trace_norm_squared;
    for index in (0..rho.len()).step_by(2) {
        let value_real = rho[index];
        let value_imag = rho[index + 1];
        rho[index] = value_real * inverse_real - value_imag * inverse_imag;
        rho[index + 1] = value_real * inverse_imag + value_imag * inverse_real;
    }
    Ok(())
}

fn matrix_element_count(d: usize) -> PyResult<usize> {
    if d == 0 {
        return Err(PyValueError::new_err("d must be greater than 0"));
    }
    d.checked_mul(d)
        .and_then(|value| value.checked_mul(2))
        .ok_or_else(|| PyValueError::new_err("matrix dimension is too large"))
}

fn validate_matrix_len(name: &str, actual: usize, expected: usize, d: usize) -> PyResult<()> {
    if actual != expected {
        return Err(PyValueError::new_err(format!(
            "{} length must be 2 * d * d; received len({})={} for d={}",
            name, name, actual, d
        )));
    }
    Ok(())
}

fn validate_collapse_ops_len(
    actual: usize,
    num_ops: usize,
    element_count: usize,
    d: usize,
) -> PyResult<()> {
    let expected = num_ops
        .checked_mul(element_count)
        .ok_or_else(|| PyValueError::new_err("collapse operator count is too large"))?;
    if actual != expected {
        return Err(PyValueError::new_err(format!(
            "collapse_ops length must be num_ops * 2 * d * d; received len(collapse_ops)={} for num_ops={} and d={}",
            actual, num_ops, d
        )));
    }
    Ok(())
}

fn validate_finite_matrix(name: &str, matrix: &[f64]) -> PyResult<()> {
    if matrix.iter().any(|value| !value.is_finite()) {
        return Err(PyValueError::new_err(format!(
            "{} must contain finite values",
            name
        )));
    }
    Ok(())
}

fn validate_hermitian(matrix: &[f64], d: usize) -> PyResult<()> {
    let mut maximum_error = 0.0_f64;
    for row in 0..d {
        for column in 0..d {
            let value = 2 * (row * d + column);
            let transposed = 2 * (column * d + row);
            let real_error = matrix[value] - matrix[transposed];
            let imag_error = matrix[value + 1] + matrix[transposed + 1];
            maximum_error =
                maximum_error.max((real_error * real_error + imag_error * imag_error).sqrt());
        }
    }
    if maximum_error > 1e-12 {
        return Err(PyValueError::new_err("hamiltonian must be Hermitian"));
    }
    Ok(())
}

fn validate_time_dependent_rk4_inputs(
    rho: &[f64],
    h1: &[f64],
    h2: &[f64],
    h3: &[f64],
    h4: &[f64],
    collapse_ops: &[f64],
    num_ops: usize,
    d: usize,
    dt: f64,
) -> PyResult<usize> {
    let element_count = matrix_element_count(d)?;
    validate_matrix_len("rho", rho.len(), element_count, d)?;
    validate_matrix_len("h1", h1.len(), element_count, d)?;
    validate_matrix_len("h2", h2.len(), element_count, d)?;
    validate_matrix_len("h3", h3.len(), element_count, d)?;
    validate_matrix_len("h4", h4.len(), element_count, d)?;
    validate_collapse_ops_len(collapse_ops.len(), num_ops, element_count, d)?;
    if !dt.is_finite() {
        return Err(PyValueError::new_err("dt must be finite"));
    }
    Ok(element_count)
}

fn matmul_flat(a: &[f64], b: &[f64], d: usize) -> Vec<f64> {
    let mut c = vec![0.0_f64; 2 * d * d];
    // The explicit-CPTP path repeatedly multiplies the d²×d² Liouvillian
    // matrices. For four logical qubits this is a 256×256 complex product;
    // splitting independent output rows avoids the single-threaded hotspot
    // without adding a runtime dependency or changing arithmetic semantics.
    if d >= 64 {
        let worker_count = std::thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(1)
            .min(d);
        let rows_per_worker = (d + worker_count - 1) / worker_count;
        std::thread::scope(|scope| {
            for (chunk_index, chunk) in c.chunks_mut(2 * rows_per_worker * d).enumerate() {
                let first_row = chunk_index * rows_per_worker;
                let row_count = chunk.len() / (2 * d);
                scope.spawn(move || {
                    for local_row in 0..row_count {
                        for j in 0..d {
                            let mut real = 0.0_f64;
                            let mut imag = 0.0_f64;
                            for k in 0..d {
                                let a_index = 2 * ((first_row + local_row) * d + k);
                                let b_index = 2 * (k * d + j);
                                let ar = a[a_index];
                                let ai = a[a_index + 1];
                                let br = b[b_index];
                                let bi = b[b_index + 1];
                                real += ar * br - ai * bi;
                                imag += ar * bi + ai * br;
                            }
                            let c_index = 2 * (local_row * d + j);
                            chunk[c_index] = real;
                            chunk[c_index + 1] = imag;
                        }
                    }
                });
            }
        });
        return c;
    }
    for i in 0..d {
        for j in 0..d {
            let mut real = 0.0_f64;
            let mut imag = 0.0_f64;
            for k in 0..d {
                let a_index = 2 * (i * d + k);
                let b_index = 2 * (k * d + j);
                let ar = a[a_index];
                let ai = a[a_index + 1];
                let br = b[b_index];
                let bi = b[b_index + 1];
                real += ar * br - ai * bi;
                imag += ar * bi + ai * br;
            }
            let c_index = 2 * (i * d + j);
            c[c_index] = real;
            c[c_index + 1] = imag;
        }
    }
    c
}

fn add_scaled_flat(base: &[f64], delta: &[f64], scale: f64) -> Vec<f64> {
    base.iter()
        .zip(delta.iter())
        .map(|(base_value, delta_value)| base_value + scale * delta_value)
        .collect()
}

fn conjugate_transpose_flat(matrix: &[f64], d: usize) -> Vec<f64> {
    let mut adjoint = vec![0.0_f64; 2 * d * d];
    for i in 0..d {
        for j in 0..d {
            let source = 2 * (i * d + j);
            let target = 2 * (j * d + i);
            adjoint[target] = matrix[source];
            adjoint[target + 1] = -matrix[source + 1];
        }
    }
    adjoint
}

#[pymodule]
fn quantascope_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(backend_name, m)?)?;
    m.add_function(wrap_pyfunction!(add_f64, m)?)?;
    m.add_function(wrap_pyfunction!(matmul_complex_flat, m)?)?;
    m.add_function(wrap_pyfunction!(lindblad_rhs_flat, m)?)?;
    m.add_function(wrap_pyfunction!(gksl_exponential_superoperator_flat, m)?)?;
    m.add_function(wrap_pyfunction!(gksl_piecewise_superoperator_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_evolve_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_time_dependent_stages_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_time_dependent_step_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_evolve_cleaned_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_evolve_cleaned_samples_flat, m)?)?;
    Ok(())
}

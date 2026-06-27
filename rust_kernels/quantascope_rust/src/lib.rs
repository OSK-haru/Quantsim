use pyo3::prelude::*;
use pyo3::exceptions::PyValueError;

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
            evolved[index] += dt / 6.0 * (
                k1[index]
                + 2.0 * k2[index]
                + 2.0 * k3[index]
                + k4[index]
            );
        }
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
        evolved[index] += dt / 6.0 * (
            k1[index]
            + 2.0 * k2[index]
            + 2.0 * k3[index]
            + k4[index]
        );
    }
    evolved
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
            name,
            name,
            actual,
            d
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
            actual,
            num_ops,
            d
        )));
    }
    Ok(())
}

fn matmul_flat(a: &[f64], b: &[f64], d: usize) -> Vec<f64> {
    let mut c = vec![0.0_f64; 2 * d * d];
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
    m.add_function(wrap_pyfunction!(rk4_evolve_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_evolve_cleaned_flat, m)?)?;
    m.add_function(wrap_pyfunction!(rk4_evolve_cleaned_samples_flat, m)?)?;
    Ok(())
}

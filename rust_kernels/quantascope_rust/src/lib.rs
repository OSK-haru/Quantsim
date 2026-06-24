use pyo3::prelude::*;

#[pyfunction]
fn backend_name() -> &'static str {
    "rust_dense_preview"
}

#[pyfunction]
fn add_f64(a: f64, b: f64) -> f64 {
    a + b
}

#[pymodule]
fn quantascope_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(backend_name, m)?)?;
    m.add_function(wrap_pyfunction!(add_f64, m)?)?;
    Ok(())
}

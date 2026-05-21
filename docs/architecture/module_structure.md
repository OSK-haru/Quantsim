# Module Structure

## 方針

本開発では、core と UI を分離する。

- core は Streamlit / Godot / FastAPI に依存しない
- UI は core の public API を呼ぶ
- シミュレーションの入口は `run_simulation(config)` に統一する
- 回路・環境条件・実行設定はJSON化可能な構造にする

## 目標構成

```text
core/
  simulator.py
  circuit_model.py
  environment.py
  evolution.py
  metrics.py
  validation.py
  errors.py
  results.py

visualization/
  plots.py
  tables.py

app/
  app.py
  pages/

data/
  presets/

docs/
  requirements/
  architecture/
  development/

tests/

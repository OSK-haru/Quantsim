# Local Verification Cache

The repository now provides `scripts/verify_cached.py` for deterministic local
checks. It stores fingerprints in the ignored file
`.cache/quantascope-verification.json`.

Available checks:

```powershell
python scripts/verify_cached.py --list
python scripts/verify_cached.py frontend-build
python scripts/verify_cached.py gate-aware-tests
python scripts/verify_cached.py all
python scripts/verify_cached.py frontend-build --force
```

The fingerprint includes the configured source trees, command, working
directory, Python/platform information, and relevant tool versions. A check is
skipped only when its previous result is `passed` and the fingerprint is
unchanged. Failed checks are never treated as cached successes.

The cache is intentionally local and is not committed. It is a convenience for
developer and Codex sessions, not a replacement for CI or release freeze
evidence. Hardware, network, random, and time-dependent audits should not be
silently skipped by this cache.

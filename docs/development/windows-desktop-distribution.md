# Windows Desktop Distribution

## Goal

Produce a Windows submission build that opens Yuragi-Strider by double-clicking
`Yuragi-Strider.exe`, starts no visible command prompt, and does not require Node,
Python, an API key, or an IBM Quantum account on the review machine.

## Local architecture

`desktop_app.py` serves the built React files and the FastAPI endpoints from
one local address, then opens the default browser. The application uses only
`127.0.0.1`; it makes no external network call at startup.

The distribution contains a console-subsystem backend verified to work with
Uvicorn and a small Windows GUI launcher named `Yuragi-Strider.exe`. The GUI
launcher starts the backend without a command-prompt window.

The source-mode launcher is:

```powershell
.\.venv\Scripts\pythonw.exe desktop_app.py
```

For diagnostics without opening a browser:

```powershell
.\.venv\Scripts\python.exe desktop_app.py --no-browser
```

## Packaging

The Windows package is built from a prepared, audited environment:

```powershell
.\scripts\build_windows_desktop.ps1
```

The build script intentionally requires PyInstaller to be installed in the
build environment. PyInstaller is a packaging-only dependency; it is not
needed by users of the resulting application.

Expected output:

```text
release/windows/Yuragi-Strider/Yuragi-Strider.exe
release/windows/Yuragi-Strider/Yuragi-Strider.lnk
```

Reviewers can open `Yuragi-Strider.exe` or `Yuragi-Strider.lnk`. Both start the
hidden backend and open the default browser.

## Submission checks

- Test on a clean Windows account or virtual machine.
- Confirm that `Yuragi-Strider.exe` opens the browser without a terminal window.
- Confirm that Gate-aware simulation works with the network disconnected.
- Keep IBM Quantum and other external credentials out of the package.
- Include source code, application files, and a short launch guide separately.

## Diagnostics

The package includes a console-subsystem backend because it is the reliable
Uvicorn host. The user-facing launcher remains a GUI executable, so no command
prompt is shown during normal startup.

When the packaged application cannot open, inspect the local launcher log:

```text
%LOCALAPPDATA%\Yuragi-Strider\launcher.log
```

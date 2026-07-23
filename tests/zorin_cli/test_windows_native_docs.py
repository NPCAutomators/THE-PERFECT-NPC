from pathlib import Path


def test_windows_native_install_path_docs_match_installer() -> None:
    doc = Path("website/docs/user-guide/windows-native.md").read_text()
    install = Path("scripts/install.ps1").read_text()

    assert "%LOCALAPPDATA%\\zorin\\zorin-agent\\venv\\Scripts" in doc
    assert "Get-Command zorin        # should print C:\\Users\\<you>\\AppData\\Local\\zorin\\zorin-agent\\venv\\Scripts\\zorin.exe" in doc
    assert '$zorinBin = "$InstallDir\\venv\\Scripts"' in install

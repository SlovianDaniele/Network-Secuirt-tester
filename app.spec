# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for creating EXE from app.py
This file ensures templates and static directories are included in the bundle.
"""
import os

block_cipher = None

# Collect data files
datas = [
    ('templates', 'templates'),  # Include templates directory
    ('static', 'static'),        # Include static directory
    ('lib', 'lib'),              # Include lib directory
]

# Include settings.json if it exists
if os.path.exists('settings.json'):
    datas.append(('settings.json', '.'))

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'webview',
        'jinja2',
        'server',
        'lib.config',
        'lib.vm_utils',
        'lib.wps_utils',
        'lib.dict_utils',
        'lib.nmap_utils',
        'lib.handshake_utils',
        'lib.network_utils',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Set to False to hide console window, True for debugging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add path to .ico file if you have an icon
)

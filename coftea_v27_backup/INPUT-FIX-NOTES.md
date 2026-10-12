# v2.7 Input Freeze Fix

The previous v2.6 build used aggressive BrowserWindow focus calls from pointerdown/focusin/focus/visibility events. In Electron, repeatedly calling win.focus()/webContents.focus() while a user is editing a field can steal the caret and make all text fields appear frozen.

v2.7 removes that mechanism entirely. Inputs now use normal DOM focus, with only input styling and a lightweight focusin tracker. The Electron main process no longer receives a focus-window IPC event on every input click.

This preserves normal typing and avoids rebuilding or forcibly refocusing editable controls.

# Changelog

## 1.3.0 - 2026-02-16

### Features
- Add usage indicator below chat composer showing session and weekly usage (resets, percent) from /settings/usage
- Add Copy Last Message shortcut (Cmd/Ctrl + Shift + Y) with full locale coverage

## 1.2.1 - 2026-02-09

### Fixes
- Support updated Claude model menu DOM for model selection shortcuts
- Use version-agnostic model matching so Cmd/Ctrl + Shift + 0/8/9 keeps working across model version updates

### Chores
- Make model shortcut labels version-agnostic across settings and all locale message files

### Documentation
- Update README model shortcut names to Haiku/Sonnet/Opus

## 1.2.0 - 2026-01-21

### Features
- Add review footer layout in popup
- Add i18n messages for review footer prompt

### Documentation
- Add design guidance and reproduction steps for the review footer

## 1.1.1 - 2026-01-04

### Features
- Add Windows platform detection and Haiku shortcut fix

### Documentation
- Update keyboard shortcuts for Windows Haiku binding

## 1.1.0 - 2025-12-20

### Features
- Add footer with support links in popup

### Fixes
- Bind active input before toggling focus
- Restore focus to input after switching models
- Update model menu item selector
- Hide disclaimer in wide screen mode
- Inject localized metadata at runtime
- Remove unsupported i18n placeholders from HTML

### Chores
- Migrate style asset management to vite plugin
- Update README with URL

## 1.0.0 - 2025-12-07
- Initial release

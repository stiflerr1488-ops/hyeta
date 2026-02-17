# Архитектура и техдизайн

## Вариант 1 (Desktop, рекомендовано): Electron + Vanilla JS
**Плюсы:**
- Нативный доступ к файловой системе.
- Надежная offline-работа.
- Быстрый путь к MVP.

**Минусы:**
- Больший runtime footprint, чем Tauri.

## Вариант 2 (Web): Next.js/React + File System Access API
**Плюсы:**
- Быстрый web-onboarding, проще публиковать обновления.

**Минусы:**
- Ограничения API/разрешений в браузерах.
- Хуже контроль исполнения стороннего JS и offline-сценариев.

## Модули
- Import/Index: скан файлов, построение дерева, выделение HTML страниц.
- Parser/Edit Engine: DOM-based правки для текста/атрибутов.
- Renderer Sandbox: iframe + appfs protocol.
- Properties Panel: редактирование текста, href/src/alt/title.
- Search: grep-like поиск по текстовым файлам.
- History: undo/redo stacks.
- Plugins/Fiches (архитектурно): feature-toggle + preview/diff hooks.

## Безопасность
- Renderer isolation: `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- Preview sandbox iframe: `allow-scripts allow-same-origin allow-forms`.
- Network lockdown: запрет внешних URL (разрешены только appfs/data/blob).
- Path safety: нормализация путей и запрет выхода за project root.

## Модель данных
- `ProjectIndex`: `{ tree, htmlPages }`
- `FileNode`: directory | file
- `SearchResult`: `{ path, line, snippet }`
- Runtime state: текущая страница, выбранный selector, текущий контент, undo/redo.

## Стратегия изменения файлов
- MVP: DOM parse в renderer и сохранение документа обратно в файл.
- v1: гибрид DOM + AST (parse5/rehype) для лучшего сохранения форматирования/комментариев.

## Версионирование
- MVP: локальные снапшоты + undo/redo.
- v1: git-интеграция опционально, diff/patch и откат по операции/проекту.
<!-- updated-all-files -->

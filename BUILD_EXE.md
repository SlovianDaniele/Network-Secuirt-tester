# Створення EXE файлу з auto-py-to-exe

## Вирішена проблема

EXE файл не працював, оскільки PyInstaller не включав директорії `templates` та `static`. Це було виправлено:

1. Оновлено визначення шляхів у `app.py` для роботи з PyInstaller bundles
2. Створено файл `app.spec`, який включає всі необхідні файли

## ⚠️ ВАЖЛИВО: Перебудова після виправлень

Якщо ви вже створювали EXE раніше, **обов'язково перебудують його** після виправлень:

1. Видаліть папки `build` та `dist` (якщо вони існують)
2. Використайте один з методів нижче для створення нового EXE
3. Старий EXE **не працюватиме** з новими виправленнями

## Як створити EXE файл

### Варіант 1: Використання Spec файлу (Рекомендовано)

1. Встановіть PyInstaller, якщо ще не встановлено:

```bash
pip install pyinstaller
```

2. Створіть EXE використовуючи spec файл:

```bash
pyinstaller app.spec
```

EXE файл буде створено в папці `dist`.

**Примітка**: За замовчуванням EXE запускається без консолі (`console=False`). Якщо потрібно бачити помилки під час діагностики, змініть `console=False` на `console=True` у файлі `app.spec` на рядку 64.

### Варіант 2: Використання auto-py-to-exe GUI

**ВАЖЛИВО**: Якщо ви вже створювали EXE раніше, видаліть папки `build` та `dist` перед новою збіркою!

1. Відкрийте auto-py-to-exe
2. Встановіть наступні параметри:
    - **Script Location**: Натисніть "Browse" та оберіть файл `app.py` (повний шлях)
    - **Onefile**: Оберіть "One File" або "One Directory" (One Directory рекомендується для швидшого запуску)
    - **Console Window**: Оберіть **"Console Based"** для першого тестування, щоб бачити помилки. Після перевірки можна змінити на "Window Based"
3. **КРИТИЧНО ВАЖЛИВО - Додайте файли даних**:
   Натисніть кнопку **"Additional Files"** (або "Add Files" / "Browse" біля "Additional Files")

    Для кожної папки натисніть "Add Files" та:

    - Оберіть папку `templates` → в полі "Destination Folder" введіть `templates`
    - Натисніть "Add Files" знову → оберіть папку `static` → введіть `static`
    - Натисніть "Add Files" знову → оберіть папку `lib` → введіть `lib`

    **АБО** якщо є опція додати всю папку одразу:

    - Додайте `templates` → `templates`
    - Додайте `static` → `static`
    - Додайте `lib` → `lib`

    Якщо файл `settings.json` існує в корені проекту:

    - Додайте `settings.json` → `.` (крапка означає корінь bundle)

4. **Приховані імпорти** (вкладка Advanced):
   Додайте ці приховані імпорти:

    ```
    webview
    jinja2
    server
    lib.config
    lib.vm_utils
    lib.wps_utils
    lib.dict_utils
    lib.nmap_utils
    lib.handshake_utils
    lib.network_utils
    ```

5. Натисніть "CONVERT .PY TO .EXE"

### Варіант 3: Командний рядок з PyInstaller

```bash
pyinstaller --name=app \
  --onefile \
  --windowed \
  --add-data "templates;templates" \
  --add-data "static;static" \
  --add-data "lib;lib" \
  --hidden-import=webview \
  --hidden-import=jinja2 \
  --hidden-import=server \
  --hidden-import=lib.config \
  --hidden-import=lib.vm_utils \
  --hidden-import=lib.wps_utils \
  --hidden-import=lib.dict_utils \
  --hidden-import=lib.nmap_utils \
  --hidden-import=lib.handshake_utils \
  --hidden-import=lib.network_utils \
  app.py
```

**Примітка для Windows**: Використовуйте крапку з комою (`;`) як роздільник у `--add-data`
**Примітка для Linux/Mac**: Використовуйте двокрапку (`:`) як роздільник у `--add-data`

## Що було виправлено

1. **Визначення шляхів**: Оновлено `get_template_path()` та `get_static_path()` у `app.py` для визначення запуску з PyInstaller bundle використовуючи `sys._MEIPASS`

2. **Шлях до файлу налаштувань**: Оновлено `server.py` для збереження settings.json в тій же директорії, що й EXE (а не в тимчасовій директорії bundle)

3. **Spec файл**: Створено `app.spec`, який правильно включає всі необхідні файли та директорії

## Тестування EXE файлу

Після створення, протестуйте EXE файл:

1. Запустіть EXE з папки `dist`
2. Додаток повинен запуститися без помилки "index.html not found"
3. Всі функції повинні працювати як очікується

## Перевірка правильності збірки

Після створення EXE, перевірте що файли включені:

1. Якщо вибрано "One Directory":

    - Перейдіть до `dist/app/` (або `dist/` якщо назва інша)
    - Перевірте наявність папок: `templates/`, `static/`, `lib/`
    - Перевірте що в `templates/` є файл `index.html`

2. Якщо вибрано "One File":
    - EXE буде один файл, але при запуску PyInstaller розпакує файли в тимчасову папку
    - Запустіть EXE з консоллю (`console=True` в spec або "Console Based" в auto-py-to-exe)
    - Перевірте повідомлення про помилки

## Усунення проблем

### Помилка "index.html not found"

Якщо ви все ще отримуєте цю помилку:

1. **Переконайтеся що файли додані правильно**:

    - Видаліть папки `build` та `dist`
    - Перебудьте EXE використовуючи spec файл: `pyinstaller app.spec`
    - АБО перевірте в auto-py-to-exe що всі три папки (templates, static, lib) додані в "Additional Files"

2. **Запустіть з консоллю для діагностики**:

    - В spec файлі встановіть `console=True`
    - АБО в auto-py-to-exe оберіть "Console Based"
    - Запустіть EXE та подивіться на повідомлення про помилки
    - Код тепер виводить детальну інформацію про шляхи та наявні файли

3. **Перевірте структуру проекту**:

    - Переконайтеся що папки `templates/`, `static/`, `lib/` існують в корені проекту
    - Переконайтеся що файл `templates/index.html` існує

4. **Якщо використовуєте auto-py-to-exe**:

    - Після додавання файлів, перевірте що вони відображаються в списку "Additional Files"
    - Якщо не відображаються - видаліть та додайте знову
    - Спробуйте використати spec файл замість GUI (Варіант 1)

5. **Перевірте залежності**:
    - Переконайтеся що всі Python залежності встановлені: `pip install -r requirements.txt`
    - Переконайтеся що PyInstaller оновлено: `pip install --upgrade pyinstaller`

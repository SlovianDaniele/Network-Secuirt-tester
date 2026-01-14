"""
Головна точка входу додатку - запускає віконний додаток з PyWebView
"""
import webview
import os
import sys
from jinja2 import Environment, FileSystemLoader
from server import Api


def get_base_path():
    """Отримати базовий шлях до додатку (працює з PyInstaller)"""
    if getattr(sys, 'frozen', False):
        # Якщо запущено з EXE (PyInstaller)
        base_path = sys._MEIPASS
    else:
        # Якщо запущено як скрипт
        base_path = os.path.dirname(os.path.abspath(__file__))
    return base_path


def get_template_path():
    """Отримати абсолютний шлях до директорії templates"""
    base_path = get_base_path()
    return os.path.join(base_path, 'templates')


def get_static_path():
    """Отримати абсолютний шлях до директорії static"""
    base_path = get_base_path()
    return os.path.join(base_path, 'static')


def read_static_file(filename):
    """Читає вміст статичного файлу"""
    static_path = get_static_path()
    file_path = os.path.join(static_path, filename)
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Помилка читання файлу {filename}: {e}")
        return ''


def render_template(page='auto', theme='dark'):
    """Рендеринг HTML шаблону через Jinja2"""
    template_dir = get_template_path()
    
    # Діагностика: перевірка наявності директорії та файлів
    if not os.path.exists(template_dir):
        error_msg = f"Помилка: Директорія templates не знайдена: {template_dir}\n"
        error_msg += f"Base path: {get_base_path()}\n"
        error_msg += f"Frozen: {getattr(sys, 'frozen', False)}\n"
        if getattr(sys, 'frozen', False):
            error_msg += f"_MEIPASS: {sys._MEIPASS}\n"
        print(error_msg)
        raise FileNotFoundError(error_msg)
    
    index_path = os.path.join(template_dir, 'index.html')
    if not os.path.exists(index_path):
        error_msg = f"Помилка: Файл index.html не знайдено: {index_path}\n"
        error_msg += f"Файли в директорії {template_dir}: {os.listdir(template_dir) if os.path.exists(template_dir) else 'директорія не існує'}\n"
        print(error_msg)
        raise FileNotFoundError(error_msg)
    
    env = Environment(loader=FileSystemLoader(template_dir))
    
    # Додаємо функцію для читання статичних файлів
    env.globals['read_static'] = read_static_file
    
    template = env.get_template('index.html')
    
    # Рендеримо шаблон
    html = template.render(
        page=page,
        theme=theme
    )
    
    return html


def main():
    """Запускає десктопний додаток з вбудованим веб-переглядачем"""
    # Створюємо API клас без window (буде встановлено пізніше)
    api = Api(window=None, render_template_func=render_template)
    
    # Рендеримо початкову сторінку
    initial_html = render_template(page='auto', theme=api.settings_store.get('theme', 'dark'))
    
    # Створюємо вікно з API
    window = webview.create_window(
        title='Утиліта автоматизованого тестування на проникнення локальних інтернет мереж',
        html=initial_html,
        js_api=api,
        width=1440,
        height=850,
        resizable=True,
        frameless=False,
        easy_drag=False
    )
    
    # Оновлюємо посилання на window в API після створення вікна
    api.window = window
    
    # Відправляємо подію завантаження налаштувань після створення вікна
    api.notify_settings_loaded()
    
    # Вимкнути debug режим при запуску з EXE
    is_exe = getattr(sys, 'frozen', False)
    webview.start(debug=not is_exe)


if __name__ == '__main__':
    main()

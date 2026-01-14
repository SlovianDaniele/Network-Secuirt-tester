"""
Головна точка входу додатку - запускає віконний додаток з PyWebView
"""
import webview
import os
from jinja2 import Environment, FileSystemLoader
from server import Api


def get_template_path():
    """Отримати абсолютний шлях до директорії templates"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'templates')


def get_static_path():
    """Отримати абсолютний шлях до директорії static"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'static')


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
    
    webview.start(debug=True)


if __name__ == '__main__':
    main()

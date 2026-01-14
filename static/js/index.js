// Завантажити налаштування з сервера та застосувати тему
const loadSettingsFromServer = async () => {
    try {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            const data = await pywebview.api.get_settings();
            if (data.success && data.settings && data.settings.theme) {
                // Встановити тему з налаштувань сервера
                if (typeof ThemeManager !== 'undefined') {
                    ThemeManager.setTheme(data.settings.theme);
                }
            }
        }
    } catch (error) {
        console.error('Помилка завантаження налаштувань з сервера:', error);
        // Якщо не вдалося завантажити, використати тему з HTML атрибута
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme && typeof ThemeManager !== 'undefined') {
            ThemeManager.setTheme(htmlTheme);
        }
    }
};

// Навігація між сторінками
const navigateToPage = async (page) => {
    try {
        if (typeof pywebview === 'undefined' || !pywebview.api) {
            console.warn('PyWebView API ще не готовий');
            return;
        }

        // Викликати Python метод для навігації
        const result = await pywebview.api.navigate(page);

        if (result.success) {
            // Навігація успішна - сторінка буде перезавантажена через window.load_html()
            // Активний пункт меню оновиться автоматично після перезавантаження
        } else {
            console.error('Помилка навігації:', result.message);
        }
    } catch (error) {
        console.error('Помилка навігації:', error);
    }
};

function checkStatus() {
    updateStatusIndicators();

    // Оновлювати статуси кожні 10 секунд
    setInterval(updateStatusIndicators, 10000);
}

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function () {
    // Завантажити налаштування з сервера
    loadSettingsFromServer();

    // Ініціалізація теми
    ThemeManager.init();

    // Оновлювати статуси 
    checkStatus();
});

// Очікування готовності PyWebView API
window.addEventListener('pywebviewready', function () {
    console.log('PyWebView API готовий');
    // Завантажити налаштування після готовності API
    loadSettingsFromServer();
});

window.addEventListener('settings-loaded', function (event) {
    console.log('Налаштування завантажені:', event.detail);
});

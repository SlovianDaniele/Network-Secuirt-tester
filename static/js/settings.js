// Завантажити налаштування
const loadSettings = async () => {
    try {
        if (typeof pywebview === 'undefined' || !pywebview.api) {
            console.warn('PyWebView API ще не готовий');
            return;
        }

        const data = await pywebview.api.get_settings();

        if (data.success && data.settings) {
            const settings = data.settings;

            // Встановити тему
            if (settings.theme) {
                ThemeManager.setTheme(settings.theme);
                // Затримка для оновлення вибору теми після встановлення
                setTimeout(() => {
                    updateThemeSelection(settings.theme);
                }, 100);
            }

            // Встановити VM налаштування
            const vmCpuInput = document.getElementById('vmCpu');
            const vmRamInput = document.getElementById('vmRam');

            if (vmCpuInput && settings.vm_cpu !== undefined && settings.vm_cpu !== null) {
                vmCpuInput.value = settings.vm_cpu || 2;
            }
            if (vmRamInput && settings.vm_ram !== undefined && settings.vm_ram !== null) {
                vmRamInput.value = settings.vm_ram || 4;
            }
        } else {
            console.warn('Налаштування не отримано з сервера');
        }
    } catch (error) {
        console.error('Помилка завантаження налаштувань:', error);
    }
};

// Оновити вибір теми
const updateThemeSelection = (theme) => {
    const lightPreview = document.getElementById('theme-light');
    const darkPreview = document.getElementById('theme-dark');

    if (lightPreview && darkPreview) {
        if (theme === 'light') {
            lightPreview.style.borderColor = 'var(--accent-color)';
            lightPreview.style.borderWidth = '3px';
            darkPreview.style.borderColor = 'var(--border-color)';
            darkPreview.style.borderWidth = '2px';
        } else {
            darkPreview.style.borderColor = 'var(--accent-color)';
            darkPreview.style.borderWidth = '3px';
            lightPreview.style.borderColor = 'var(--border-color)';
            lightPreview.style.borderWidth = '2px';
        }
    }
};

// Вибір теми
const selectTheme = (theme) => {
    ThemeManager.setTheme(theme);
    updateThemeSelection(theme);
};

// Зберегти налаштування
const saveSettings = async () => {
    const settings = {
        theme: ThemeManager.getTheme(),
        vm_cpu: parseInt(document.getElementById('vmCpu').value),
        vm_ram: parseInt(document.getElementById('vmRam').value),
    };

    // Знайти кнопку збереження
    const saveBtn = document.querySelector('button.btn-primary[onclick*="saveSettings"]');
    const originalText = saveBtn ? saveBtn.innerHTML : '';

    try {
        if (typeof pywebview === 'undefined' || !pywebview.api) {
            alert('API ще не готовий');
            return;
        }

        const data = await pywebview.api.update_settings(settings);

        if (data.success) {
            // Показати повідомлення про успіх
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Збережено!';
                saveBtn.classList.remove('btn-primary');
                saveBtn.classList.add('btn-success');

                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                    saveBtn.classList.remove('btn-success');
                    saveBtn.classList.add('btn-primary');
                }, 2000);
            }
        } else {
            alert('Помилка збереження налаштувань');
        }
    } catch (error) {
        console.error('Помилка збереження налаштувань:', error);
        alert('Помилка збереження налаштувань: ' + error.message);
    }
};

// Ініціалізація при завантаженні сторінки налаштувань
document.addEventListener('DOMContentLoaded', () => {
    // Перевірити, чи ми на сторінці налаштувань
    const settingsSection = document.querySelector('.settings-section');
    if (settingsSection) {
        // Завантажити налаштування з сервера
        loadSettings();
    }
});


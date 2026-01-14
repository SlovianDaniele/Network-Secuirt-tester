// ========== Стан ==========
let savedThemeState = null;
let savedConsoleState = null;

// Перевірка статусу VM через PyWebView API
const checkVMStatus = async () => {
    try {
        if (typeof pywebview === 'undefined' || !pywebview.api) {
            console.warn('PyWebView API ще не готовий');
            return { success: false, connected: false };
        }
        const data = await pywebview.api.get_vm_status();
        return data;
    } catch (error) {
        console.error('Помилка перевірки статусу VM:', error);
        return { success: false, connected: false };
    }
};

// Оновлення індикаторів статусу
const updateStatusIndicators = async () => {
    const vmStatus = await checkVMStatus();

    // Оновлення VM статусу
    const vmIndicator = document.getElementById('vmStatusIndicator');
    const vmText = document.getElementById('vmStatusText');
    if (vmIndicator && vmText) {
        if (vmStatus.success && vmStatus.connected) {
            vmIndicator.className = 'status-indicator bg-success';
            vmText.textContent = vmStatus.message || 'Підключена';
        } else if (vmStatus.status === 'starting') {
            vmIndicator.className = 'status-indicator bg-warning';
            vmText.textContent = vmStatus.message || 'Завантажується...';
        } else {
            vmIndicator.className = 'status-indicator bg-danger';
            vmText.textContent = vmStatus.message || 'Не підключена';
        }
    }

    return { vm: vmStatus };
};

// Управління темою
const ThemeManager = {
    init() {
        // Спочатку перевірити тему з HTML атрибута (встановлена сервером)
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme) {
            this.setTheme(htmlTheme);
        } else {
            // Якщо немає в HTML, використати з localStorage
            const savedTheme = savedThemeState || 'dark';
            this.setTheme(savedTheme);
        }
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        savedThemeState = theme;

        // Оновити body клас для Bootstrap темної теми
        if (theme === 'dark') {
            document.body.classList.add('bg-dark', 'text-white');
            document.body.classList.remove('bg-light', 'text-dark');
        } else {
            document.body.classList.add('bg-light', 'text-dark');
            document.body.classList.remove('bg-dark', 'text-white');
        }
    },

    getTheme() {
        return savedThemeState || 'dark';
    },

    toggle() {
        const current = this.getTheme();
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    }
};

// Рендеринг списку мереж у вигляді таблиці
const renderNetworkList = (networks, containerId, onSelect = null) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!networks || networks.length === 0) {
        // container.innerHTML = '<p class="text-secondary text-center py-4 mb-0">Мережі не знайдено</p>';
        return;
    }

    // Функція для отримання кольору WPA badge
    const getWPAColor = (encryption) => {
        if (!encryption) return 'danger';
        const enc = encryption.toLowerCase();
        switch (true) {
            case enc.includes('wpa3') || enc.includes('enterprise'):
                return 'success';
            case enc.includes('wpa2') || enc.includes('wpa'):
                return 'warning';
            case enc === 'none' || enc === 'open':
                return 'danger';
            default:
                return 'warning';
        }
    };

    // Функція для отримання тексту WPA
    const getWPAText = (encryption) => {
        if (!encryption) return 'Невідомо';
        const enc = encryption.toLowerCase();
        switch (true) {
            case enc.includes('wpa3'):
                return 'WPA3';
            case enc.includes('enterprise'):
                return 'WPA2-Enterprise';
            case enc.includes('wpa2'):
                return 'WPA2';
            case enc.includes('wpa'):
                return 'WPA';
            case enc === 'none' || enc === 'open':
                return 'Не захищено';
            default:
                return encryption;
        }
    };

    // Функція для отримання кольору сигналу та кількості барів
    const getSignalInfo = (signal) => {
        const dbm = signal;
        if (dbm >= -50) {
            return { color: 'success', bars: 4 }; // Зелений, 4 бари
        } else if (dbm >= -60) {
            return { color: 'info', bars: 3 }; // Синій, 3 бари
        } else if (dbm >= -70) {
            return { color: 'warning', bars: 3 }; // Помаранчевий, 3 бари
        } else if (dbm >= -80) {
            return { color: 'warning', bars: 2 }; // Помаранчевий, 2 бари
        } else {
            return { color: 'danger', bars: 1 }; // Червоний, 1 бар
        }
    };

    // Функція для генерації Wi-Fi іконки
    const getWiFiIcon = (bars, color) => {
        const colorClass = `text-${color}`;
        // Створюємо візуальний індикатор Wi-Fi сигналу у вигляді вертикальних барів
        const barsArray = [];
        for (let i = 0; i < 4; i++) {
            const isActive = i < bars;
            const height = (i + 1) * 3 + 2; // Висота збільшується для кожного бару
            const opacity = isActive ? '1' : '0.25';
            barsArray.push(`<span class="${colorClass}" style="display: inline-block; width: 3px; height: ${height}px; background-color: currentColor; margin-right: 1px; opacity: ${opacity}; border-radius: 1px; vertical-align: bottom;"></span>`);
        }
        return `<span class="wifi-signal-indicator" style="display: inline-flex; align-items: flex-end; height: 16px; line-height: 1;">${barsArray.join('')}</span>`;
    };

    // Визначаємо поточну тему
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const tableClass = currentTheme === 'dark' ? 'table table-dark' : 'table';

    container.innerHTML = `
        <div class="table-responsive">
            <table class="${tableClass} networks-table">
                <thead>
                    <tr>
                        <th>SSID</th>
                        <th>BSSID</th>
                        <th>WPA</th>
                        <th>dBm</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks.map((network, index) => {
        const wpaColor = getWPAColor(network.encryption);
        const wpaText = getWPAText(network.encryption);
        const signalInfo = getSignalInfo(network.signal);
        const wifiIcon = getWiFiIcon(signalInfo.bars, signalInfo.color);
        const rowClass = network.selected ? 'table-success' : '';
        const onClick = onSelect ? `onclick="selectNetwork(${index})"` : '';

        return `
                                            <tr class="network-row ${rowClass}" ${onClick} style="cursor: pointer;">
                                                <td class="fw-semibold">${network.ssid || 'Прихована мережа'}</td>
                                                <td class="text-secondary">${network.bssid}</td>
                                                <td>
                                                    <span class="badge bg-${wpaColor} rounded-pill px-3 py-1">${wpaText}</span>
                                                </td>
                                                <td>
                                                    <div class="d-flex align-items-center gap-2">
                                                        ${wifiIcon}
                                                        <span class="text-${signalInfo.color}">${network.signal} dBm</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
};

// Функція вибору мережі (буде перевизначена в конкретних файлах)
window.selectNetwork = function (index) {
    console.log('Мережу вибрано:', index);
};

// Створення прогресу
const createProgressBar = (containerId, label = 'Прогрес') => {
    const container = document.getElementById(containerId);
    if (!container) return null;

    container.innerHTML = `
        <div class="mb-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-semibold">${label}</span>
                <span class="small text-secondary" id="${containerId}-percent">0%</span>
            </div>
            <div class="progress" style="height: 24px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     role="progressbar" 
                     id="${containerId}-bar"
                     style="width: 0%"
                     aria-valuenow="0" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                    <span id="${containerId}-text" class="small px-2">0%</span>
                </div>
            </div>
        </div>
    `;

    return {
        update: (percent) => {
            const bar = document.getElementById(`${containerId}-bar`);
            const text = document.getElementById(`${containerId}-text`);
            const percentEl = document.getElementById(`${containerId}-percent`);

            if (bar) bar.style.width = `${percent}%`;
            if (bar) bar.setAttribute('aria-valuenow', percent);
            if (text) text.textContent = `${Math.round(percent)}%`;
            if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
        },
        hide: () => {
            container.innerHTML = '';
        }
    };
};

// Симуляція прогресу
const simulateProgress = (progressBar, duration = 5000, onComplete = null) => {
    let startTime = Date.now();
    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(100, (elapsed / duration) * 100);
        progressBar.update(percent);

        if (percent >= 100) {
            clearInterval(interval);
            if (onComplete) onComplete();
        }
    }, 100);

    return interval;
};

// Консоль вивід
const ConsoleOutput = {
    init(containerId) {
        // Якщо containerId не передано, використовуємо глобальну консоль
        const id = containerId || 'consoleOutput';
        this.container = document.getElementById(id);
        if (!this.container) return;

        // Перевірити чи вже є console-content
        this.content = this.container.querySelector('.console-content');
        if (!this.content) {
            this.container.innerHTML = '<div class="console-content"></div>';
            this.content = this.container.querySelector('.console-content');
        }
    },

    log(message, type = 'info') {
        // Якщо контент не ініціалізований, спробувати ініціалізувати
        if (!this.content) {
            this.init();
        }
        if (!this.content) return;

        const timestamp = new Date().toLocaleTimeString('uk-UA');
        const typeClass = type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-primary';
        const line = document.createElement('div');
        line.className = `console-line small ${typeClass} mb-1`;
        line.innerHTML = `<span class="text-primary">[${timestamp}]</span> ${message}`;

        this.content.appendChild(line);
        this.container.scrollTop = this.container.scrollHeight;

        // Автоматично розгорнути консоль при новому повідомленні, якщо вона згорнута
        const globalConsole = document.getElementById('globalConsole');
        if (globalConsole && globalConsole.classList.contains('collapsed')) {
            expandConsole();
        }
    },

    clear() {
        if (this.content) this.content.innerHTML = '';
    }
};

// Функції для управління глобальною консоллю
const toggleConsole = () => {
    const console = document.getElementById('globalConsole');
    if (!console) return;

    if (console.classList.contains('collapsed')) {
        expandConsole();
    } else {
        collapseConsole();
    }
};

const expandConsole = () => {
    const console = document.getElementById('globalConsole');
    if (console) {
        console.classList.remove('collapsed');
        console.classList.add('expanded');
        savedConsoleState = 'expanded';
    }
};

const collapseConsole = () => {
    const console = document.getElementById('globalConsole');
    if (console) {
        console.classList.remove('expanded');
        console.classList.add('collapsed');
        savedConsoleState = 'collapsed';
    }
};

const clearConsole = () => {
    ConsoleOutput.clear();
};

// Ініціалізація глобальної консолі при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    // Ініціалізувати глобальну консоль
    ConsoleOutput.init('consoleOutput');

    const savedState = savedConsoleState || 'collapsed';
    const console = document.getElementById('globalConsole');
    if (console) {
        if (savedState === 'expanded') {
            expandConsole();
        } else {
            collapseConsole();
        }
    }

    // Обробка подій консолі
    window.addEventListener('message', function (event) {
        ConsoleOutput.log(event.detail.message, event.detail.type || 'info');
    });
});

// Експортувати функції в глобальну область видимості
window.toggleConsole = toggleConsole;
window.clearConsole = clearConsole;

// Показати секції за масивом селекторів
const showSections = (selectors) => {
    if (!Array.isArray(selectors)) {
        console.warn('showSections: очікується масив селекторів');
        return;
    }
    selectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'block';
        } else {
            console.warn(`showSections: елемент з селектором "${selector}" не знайдено`);
        }
    });
};

// Приховати секції за масивом ID
const hideSections = (selectors) => {
    if (!Array.isArray(selectors)) {
        console.warn('hideSections: очікується масив селекторів');
        return;
    }
    selectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        } else {
            console.warn(`hideSections: елемент з селектором "${selector}" не знайдено`);
        }
    });
};

// Зберігаємо оригінальний стан кнопок для відновлення
const buttonStates = new Map();

// Встановити стан завантаження для кнопок
const setButtonLoading = (selector) => {
    const button = document.querySelector(selector);
    if (!button) {
        console.warn(`setButtonLoading: кнопка з селектором "${selector}" не знайдена`);
        return;
    }

    // Зберегти оригінальний стан
    const state = {
        disabled: button.disabled,
        icon: null,
        iconClass: null,
        text: null,
        classes: Array.from(button.classList)
    };

    // Перевірити наявність іконки
    const buttonIcon = button.querySelector('i');
    if (buttonIcon) {
        state.icon = buttonIcon;
        state.iconClass = buttonIcon.className;
        // Замінити іконку на спіннер
        buttonIcon.className = 'spinner-border spinner-border-sm me-2';
    } else {
        // Якщо немає іконки, зберегти текст
        state.text = button.innerHTML;
    }

    // Вимкнути кнопку
    button.disabled = true;

    // Зберегти стан
    buttonStates.set(selector, state);
};

// Прибрати стан завантаження з кнопок
const removeButtonLoading = (selector) => {
    const button = document.querySelector(selector);
    if (!button) {
        console.warn(`removeButtonLoading: кнопка з селектором "${selector}" не знайдена`);
        return;
    }

    const state = buttonStates.get(selector);
    if (!state) {
        console.warn(`removeButtonLoading: стан для кнопки "${selector}" не знайдено`);
        return;
    }

    // Відновити іконку або текст
    if (state.icon && state.iconClass) {
        state.icon.className = state.iconClass;
    } else if (state.text) {
        button.innerHTML = state.text;
    }

    // Відновити disabled стан
    button.disabled = state.disabled;

    // Видалити збережений стан
    buttonStates.delete(selector);
};

// Встановити текстовий вміст для елемента
const setTextContent = (id, text) => {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`setTextContent: елемент з ID "${id}" не знайдено`);
    }
};

// Встановити HTML вміст для елемента
const setHTMLContent = (id, html) => {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = html;
    } else {
        console.warn(`setHTMLContent: елемент з ID "${id}" не знайдено`);
    }
};

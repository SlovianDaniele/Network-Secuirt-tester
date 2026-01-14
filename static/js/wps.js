// ========== Стан WPS ==========
let wpsNetworks = [];
let wpsSelectedNetwork = null;
let wpsProgressBar = null;

// ========== Ініціалізація WPS ==========
document.addEventListener('DOMContentLoaded', () => {
    // Обробка подій знаходження мережі
    window.addEventListener('network-found', (event) => {
        const countElement = document.getElementById('wpsNetworksCount');
        if (countElement) {
            countElement.textContent = `${event.detail.count}`;
        }
        wpsNetworks.push(event.detail.network);
        renderWPSNetworks();
    });

    // Обробка подій прогресу WPS тестування
    window.addEventListener('wps-progress', (event) => {
        console.log('WPS Progress event received:', event.detail);
        handleWPSProgress(event.detail);
    });
});

// ========== Функції вкладки WPS ==========

// Почати сканування WPS
const startWPSScan = async () => {
    setButtonLoading('#wpsStartButton');

    wpsNetworks = [];
    renderWPSNetworks();

    const countElement = document.getElementById('wpsNetworksCount');

    showSections(['#wpsNetworksSection']);
    hideSections(['#wpsSelectedNetworkInfo', '#wpsResultsSection']);

    // Оновити бейдж
    if (countElement) {
        countElement.textContent = 'Сканування...';
        countElement.className = 'badge bg-primary';
    }

    try {
        const data = await pywebview.api.scan_networks();

        if (data.success && data.networks) {
            wpsNetworks = data.networks.map((network) => ({ ...network, selected: false }));
            renderWPSNetworks();

            // Оновити лічильник
            if (countElement) {
                countElement.textContent = `${data.networks.length}`;
                countElement.className = 'badge bg-secondary';
            }
        }
    } catch (error) {
        console.error('Помилка сканування мереж:', error);
        ConsoleOutput.log('Помилка сканування мереж', 'error');

        // Повернути бейдж до звичайного стану при помилці
        if (countElement) {
            countElement.textContent = '0 мереж';
            countElement.className = 'badge bg-secondary';
        }
    } finally {
        removeButtonLoading('#wpsStartButton');
    }
};

// Відобразити мережі WPS
const renderWPSNetworks = () => {
    // Перевизначити selectNetwork для WPS
    window.selectNetwork = (index) => {
        wpsNetworks.forEach((net) => (net.selected = false));
        wpsNetworks[index].selected = true;
        wpsSelectedNetwork = wpsNetworks[index];
        renderWPSNetworks();

        setHTMLContent(
            'wpsSelectedNetworkDetails',
            `
            <strong>SSID:</strong> ${wpsSelectedNetwork.ssid}<br>
            <strong>BSSID:</strong> ${wpsSelectedNetwork.bssid}<br>
            <strong>WPS:</strong> ${wpsSelectedNetwork.wps_version}<br>
            <strong>Сигнал:</strong> ${wpsSelectedNetwork.signal} dBm
        `
        );

        showSections(['#wpsSelectedNetworkInfo']);
    };

    renderWPSNetworkList(wpsNetworks, 'wpsNetworksList', true);
};

// Почати тестування WPS
const startWPSTest = async () => {
    const command = document.getElementById('wpsCommand').value.replace('{bssid}', wpsSelectedNetwork.bssid);
    setButtonLoading('#wpsTestButton');

    // Показати секцію прогресу та ініціалізувати прогрес-бар
    showSections(['#wpsProgressSection']);
    wpsProgressBar = createProgressBar('wpsProgressBar', 'Прогрес тестування');
    wpsProgressBar.update(0);

    // Приховати результати
    hideSections(['#wpsResultsSection']);

    try {
        const data = await pywebview.api.wps_test(wpsSelectedNetwork, command);
        finishWPSTest(data);
    } catch (error) {
        console.error('Помилка WPS тестування:', error);
        ConsoleOutput.log('Помилка тестування', 'error');
        // Приховати прогрес при помилці
        hideSections(['#wpsProgressSection']);
        if (wpsProgressBar) {
            wpsProgressBar.hide();
            wpsProgressBar = null;
        }
    } finally {
        removeButtonLoading('#wpsTestButton');
    }
};

// Обробка прогресу WPS тестування
const handleWPSProgress = (progressData) => {
    console.log('handleWPSProgress called with:', progressData);

    if (!wpsProgressBar) {
        console.warn('wpsProgressBar is null, initializing...');
        wpsProgressBar = createProgressBar('wpsProgressBar', 'Прогрес тестування');
    }

    const { percentage } = progressData;

    // Оновити прогрес-бар
    wpsProgressBar.update(percentage);
};

// Завершити тестування WPS
const finishWPSTest = (data) => {
    if (!data) {
        ConsoleOutput.log('Помилка отримання результатів', 'error');
        // Приховати прогрес при помилці
        hideSections(['#wpsProgressSection']);
        if (wpsProgressBar) {
            wpsProgressBar.hide();
            wpsProgressBar = null;
        }
        return;
    }

    // Приховати секцію прогресу
    hideSections(['#wpsProgressSection']);
    if (wpsProgressBar) {
        wpsProgressBar.hide();
        wpsProgressBar = null;
    }

    ConsoleOutput.log('Тестування завершено!', 'success');

    // Визначити чи є успіх або таймаут
    const isSuccess = data.success === true;
    const isTimeout = data.timeout === true;
    const isVulnerable = data.vulnerable === true;

    if (isTimeout) {
        ConsoleOutput.log('Досягнуто максимальний час тестування (5 хвилини)', 'info');
    } else if (isVulnerable) {
        ConsoleOutput.log(`PIN знайдено: ${data.pin}`, 'success');
    } else {
        ConsoleOutput.log('Мережа захищена від WPS атак', 'info');
    }

    // Показати результати
    showSections(['#wpsResultsSection']);

    let resultHTML = '';
    if (isTimeout) {
        resultHTML = `
        <div class="vulnerability-item secure mb-3">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5 class="mb-1">WPS Тестування</h5>
                    <p class="mb-0">${data.message || 'Тестування завершено через досягнення максимального часу (5 хвилини). Мережа не показала вразливостей.'}</p>
                    <p class="mb-0 small text-secondary mt-2">
                        Час: 2:00
                    </p>
                </div>
                <span class="badge bg-info">
                    Таймаут
                </span>
            </div>
        </div>
    `;
    } else {
        resultHTML = `
        <div class="vulnerability-item ${isVulnerable ? 'vulnerable' : 'secure'} mb-3">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5 class="mb-1">WPS Уразливість</h5>
                    <p class="mb-0">${isVulnerable ? `Мережа вразлива. PIN: ${data.pin || 'N/A'}` : 'Мережа захищена'}</p>
                    <p class="mb-0 small text-secondary mt-2">
                        Спроби: ${data.attempts || 0} | Час: ${data.time_elapsed || 0}с
                    </p>
                </div>
                <span class="badge ${isVulnerable ? 'bg-danger' : 'bg-success'}">
                    ${isVulnerable ? 'Вразлива' : 'Безпечна'}
                </span>
            </div>
        </div>
    `;
    }

    setHTMLContent('wpsResults', resultHTML);
};

// ========== Рендеринг списку WPS мереж ==========

// Рендеринг списку мереж у вигляді таблиці (специфічно для WPS)
const renderWPSNetworkList = (networks, containerId, onSelect = null) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!networks || networks.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Функція для отримання кольору сигналу та кількості барів
    const getSignalInfo = (signal) => {
        const dbm = signal;
        if (dbm >= -50) {
            return { color: 'success', bars: 4 };
        } else if (dbm >= -60) {
            return { color: 'info', bars: 3 };
        } else if (dbm >= -70) {
            return { color: 'warning', bars: 3 };
        } else if (dbm >= -80) {
            return { color: 'warning', bars: 2 };
        } else {
            return { color: 'danger', bars: 1 };
        }
    };

    // Функція для генерації Wi-Fi іконки
    const getWiFiIcon = (bars, color) => {
        const colorClass = `text-${color}`;
        const barsArray = [];

        for (let i = 0; i < 4; i++) {
            const isActive = i < bars;
            const height = (i + 1) * 3 + 2;
            const opacity = isActive ? '1' : '0.25';
            barsArray.push(
                `<span class="${colorClass}" style="display: inline-block; width: 3px; height: ${height}px; background-color: currentColor; margin-right: 1px; opacity: ${opacity}; border-radius: 1px; vertical-align: bottom;"></span>`
            );
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
                        <th>WPS</th>
                        <th>dBm</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks
            .map((network, index) => {
                const signalInfo = getSignalInfo(network.signal);
                const wifiIcon = getWiFiIcon(signalInfo.bars, signalInfo.color);
                const rowClass = network.selected ? 'table-success' : '';
                const onClick = onSelect ? `onclick="selectNetwork(${index})"` : '';

                return `
                            <tr class="network-row ${rowClass}" ${onClick} style="cursor: pointer;">
                                <td class="fw-semibold">${network.ssid || 'Прихована мережа'}</td>
                                <td class="text-secondary">${network.bssid}</td>
                                <td>${network.wps_version}</td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        ${wifiIcon}
                                        <span class="text-${signalInfo.color}">${network.signal} dBm</span>
                                    </div>
                                </td>
                            </tr>
                        `;
            })
            .join('')}
                </tbody>
            </table>
        </div>
    `;
};

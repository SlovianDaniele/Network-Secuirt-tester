// ========== Стан автотестування ==========
let autoNetworks = [];
let autoSelectedNetwork = null;
let autoScanProgressBar = null;
let autoTestProgressBar = null;
let autoTestResults = null;

// ========== Ініціалізація Auto ==========
document.addEventListener('DOMContentLoaded', () => {
    // Підписка на події сканування
    window.addEventListener('auto-scan-progress', handleAutoScanProgress);

    // Підписка на події тестування
    window.addEventListener('auto-test-progress', handleAutoTestProgress);

    // Підписка на завершення тестування
    window.addEventListener('auto-test-complete', handleAutoTestComplete);

    // Примітка: обробка повідомлень для консолі вже реалізована в shared.js
});

// ========== Обробники подій ==========

// Обробка прогресу сканування
const handleAutoScanProgress = (e) => {
    const { phase, progress, status } = e.detail;

    // Оновити прогрес-бар
    if (autoScanProgressBar) {
        autoScanProgressBar.update(progress);
    }

    // Оновити текст статусу
    const statusText = {
        'starting': 'Підготовка до сканування...',
        'scanning': phase === 'wps' ? 'WPS сканування...' : 'Handshake сканування...',
        'complete': 'Завершено'
    };

    const statusElement = document.getElementById('autoScanStatus');
    if (statusElement && statusText[status]) {
        statusElement.textContent = statusText[status];
    }

    // Оновити індикатор фази
    updatePhaseIndicator('scan', phase, status);
};

// Обробка прогресу тестування
const handleAutoTestProgress = (e) => {
    const { phase, progress, status, message } = e.detail;

    // Оновити прогрес-бар відповідно до фази
    updateTestPhaseProgress(phase, progress, status);

    // Оновити текст статусу
    const statusElement = document.getElementById('autoTestStatus');
    if (statusElement && message) {
        statusElement.textContent = message;
    }

    // Оновити індикатор фази
    updatePhaseIndicator('test', phase, status);
};

// Обробка завершення тестування
const handleAutoTestComplete = (e) => {
    autoTestResults = e.detail;

    // Приховати секцію прогресу
    hideSections(['#autoProgressSection']);

    // Показати секцію результатів
    showSections(['#autoResultsSection']);

    // Відобразити результати
    renderAutoResults(autoTestResults);
};


// ========== Функції сканування ==========

// Почати автоматичне сканування
const startAutoScanning = async () => {
    // Скинути стан
    autoNetworks = [];
    autoSelectedNetwork = null;
    autoTestResults = null;

    // Приховати стартову секцію
    hideSections(['#autoStartSection', '#autoResultsSection']);

    // Показати секцію сканування
    showSections(['#autoScanSection']);

    // Створити прогрес-бар
    autoScanProgressBar = createProgressBar('autoScanProgress', 'Комбіноване сканування мереж');

    // Показати статус
    const statusElement = document.getElementById('autoScanStatus');
    if (statusElement) {
        statusElement.textContent = 'Ініціалізація...';
    }

    // Показати індикатори фаз
    showSections(['#autoScanPhases']);
    resetPhaseIndicators('scan');

    setButtonLoading('#autoStartButton');

    try {
        const data = await pywebview.api.auto_scan_networks();

        if (data.success && data.networks) {
            autoNetworks = data.networks.map((net, index) => ({ ...net, selected: false, index }));

            // Приховати секцію сканування
            hideSections(['#autoScanSection']);

            // Показати секцію мереж
            showSections(['#autoNetworksSection']);

            // Оновити лічильники
            updateNetworkCounters(data.count, data.wps_count);

            // Відобразити мережі
            renderAutoNetworks();
        } else {
            setHTMLContent('autoNetworksList', '<p class="text-danger text-center py-4">Помилка сканування мереж</p>');
            hideSections(['#autoScanSection']);
            showSections(['#autoNetworksSection']);
        }
    } catch (error) {
        console.error('Помилка сканування мереж:', error);
        setHTMLContent('autoNetworksList', '<p class="text-danger text-center py-4">Помилка з\'єднання з сервером</p>');
        hideSections(['#autoScanSection']);
        showSections(['#autoNetworksSection']);
    } finally {
        removeButtonLoading('#autoStartButton');
    }
};

// Оновити лічильники мереж
const updateNetworkCounters = (total, wpsCount) => {
    const totalElement = document.getElementById('autoNetworksCount');
    const wpsElement = document.getElementById('autoWpsCount');

    if (totalElement) {
        totalElement.textContent = `${total} мереж`;
    }
    if (wpsElement) {
        wpsElement.textContent = `${wpsCount} з WPS`;
    }
};

// Відобразити мережі
const renderAutoNetworks = () => {
    // Перевизначити selectNetwork для Auto
    window.selectNetwork = (index) => {
        autoNetworks.forEach((net) => (net.selected = false));
        autoNetworks[index].selected = true;
        autoSelectedNetwork = autoNetworks[index];
        renderAutoNetworks();

        // Показати інформацію про вибрану мережу
        const wpsStatus = autoSelectedNetwork.has_wps
            ? `<span class="badge bg-warning text-dark">WPS ${autoSelectedNetwork.wps_version || 'Увімкнено'}</span>`
            : '<span class="badge bg-secondary">WPS Вимкнено</span>';

        setHTMLContent('autoSelectedNetworkDetails', `
            <div class="d-flex flex-wrap gap-3 align-items-center">
                <div>
                    <strong>SSID:</strong> ${autoSelectedNetwork.ssid || 'Прихована мережа'}
                </div>
                <div>
                    <strong>BSSID:</strong> ${autoSelectedNetwork.bssid}
                </div>
                <div>
                    <strong>Канал:</strong> ${autoSelectedNetwork.channel}
                </div>
                <div>
                    <strong>Шифрування:</strong> ${autoSelectedNetwork.encryption || 'Невідомо'}
                </div>
                <div>
                    ${wpsStatus}
                </div>
                <div>
                    <strong>Сигнал:</strong> ${autoSelectedNetwork.signal} dBm
                </div>
            </div>
        `);

        showSections(['#autoSelectedNetworkInfo']);
    };

    renderAutoNetworkList(autoNetworks, 'autoNetworksList', true);
};

// ========== Функції тестування ==========

// Почати автоматичне тестування
const startAutoTesting = async () => {
    if (!autoSelectedNetwork) {
        alert('Будь ласка, оберіть мережу для тестування');
        return;
    }

    // Приховати секцію мереж
    hideSections(['#autoNetworksSection']);

    // Показати секцію прогресу
    showSections(['#autoProgressSection']);

    // Ініціалізувати прогрес індикатори
    initTestProgressIndicators();

    // Показати інформацію про мережу
    const networkInfoElement = document.getElementById('autoTestNetworkInfo');
    if (networkInfoElement) {
        const wpsStatus = autoSelectedNetwork.has_wps
            ? '<span class="badge bg-warning text-dark">WPS</span>'
            : '';
        networkInfoElement.innerHTML = `
            <strong>${autoSelectedNetwork.ssid || 'Прихована мережа'}</strong> 
            (${autoSelectedNetwork.bssid}) ${wpsStatus}
        `;
    }

    setButtonLoading('#autoTestButton');

    try {
        const data = await pywebview.api.auto_test_network(autoSelectedNetwork);

        // Результати обробляються через event handler handleAutoTestComplete
        if (!data.success) {
            console.error('Помилка тестування:', data.message);
        }
    } catch (error) {
        console.error('Помилка тестування мережі:', error);
        ConsoleOutput.log('Помилка тестування мережі', 'error');

        // Показати помилку в результатах
        hideSections(['#autoProgressSection']);
        showSections(['#autoResultsSection']);
        setHTMLContent('autoTestResults', `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Виникла помилка під час тестування: ${error.message || error}
            </div>
        `);
    } finally {
        removeButtonLoading('#autoTestButton');
    }
};

// Ініціалізувати індикатори прогресу тестування
const initTestProgressIndicators = () => {
    // Показати всі фази
    const phases = ['wps', 'capture', 'dictionary'];

    phases.forEach(phase => {
        const phaseElement = document.getElementById(`autoPhase${capitalizeFirst(phase)}`);
        if (phaseElement) {
            phaseElement.classList.remove('phase-active', 'phase-complete', 'phase-error');
            phaseElement.classList.add('phase-pending');
        }

        const progressElement = document.getElementById(`autoProgress${capitalizeFirst(phase)}`);
        if (progressElement) {
            const progressBar = progressElement.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
    });

    // Якщо мережа не має WPS, позначити цю фазу як пропущену
    if (!autoSelectedNetwork.has_wps) {
        const wpsPhase = document.getElementById('autoPhaseWps');
        if (wpsPhase) {
            wpsPhase.classList.remove('phase-pending');
            wpsPhase.classList.add('phase-skipped');
            wpsPhase.querySelector('.phase-status').textContent = 'Пропущено';
        }
    }
};

// Оновити прогрес фази тестування
const updateTestPhaseProgress = (phase, progress, status) => {
    const phaseElement = document.getElementById(`autoPhase${capitalizeFirst(phase)}`);
    const progressElement = document.getElementById(`autoProgress${capitalizeFirst(phase)}`);

    if (phaseElement) {
        phaseElement.classList.remove('phase-pending', 'phase-active', 'phase-complete', 'phase-error', 'phase-skipped');

        if (status === 'starting' || status === 'running') {
            phaseElement.classList.add('phase-active');
        } else if (status === 'complete') {
            phaseElement.classList.add('phase-complete');
        } else if (status === 'error') {
            phaseElement.classList.add('phase-error');
        }

        const statusElement = phaseElement.querySelector('.phase-status');
        if (statusElement) {
            const statusText = {
                'starting': 'Запуск...',
                'running': 'В процесі...',
                'complete': 'Завершено',
                'error': 'Помилка'
            };
            statusElement.textContent = statusText[status] || status;
        }
    }

    if (progressElement) {
        const progressBar = progressElement.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
};

// Оновити індикатор фази
const updatePhaseIndicator = (type, phase, status) => {
    const prefix = type === 'scan' ? 'autoScanPhase' : 'autoPhase';
    const phaseElement = document.getElementById(`${prefix}${capitalizeFirst(phase)}`);

    if (phaseElement) {
        phaseElement.classList.remove('phase-pending', 'phase-active', 'phase-complete');

        if (status === 'scanning' || status === 'starting') {
            phaseElement.classList.add('phase-active');
        } else if (status === 'complete') {
            phaseElement.classList.add('phase-complete');
        }
    }
};

// Скинути індикатори фаз
const resetPhaseIndicators = (type) => {
    const prefix = type === 'scan' ? 'autoScanPhase' : 'autoPhase';
    const phases = type === 'scan' ? ['Wps', 'Handshake'] : ['Wps', 'Capture', 'Dictionary'];

    phases.forEach(phase => {
        const element = document.getElementById(`${prefix}${phase}`);
        if (element) {
            element.classList.remove('phase-active', 'phase-complete', 'phase-error', 'phase-skipped');
            element.classList.add('phase-pending');
        }
    });
};

// ========== Функції відображення результатів ==========

// Відобразити результати тестування
const renderAutoResults = (results) => {
    if (!results) {
        setHTMLContent('autoTestResults', '<p class="text-danger">Немає результатів</p>');
        return;
    }

    const network = results.network || autoSelectedNetwork;

    // Визначити загальний статус безпеки
    const vulnerabilities = [];
    if (results.wps_vulnerable) vulnerabilities.push('WPS');
    if (results.password_cracked) vulnerabilities.push('Слабкий пароль');

    const isVulnerable = vulnerabilities.length > 0;
    const securityLevel = isVulnerable ? 'danger' : 'success';
    const securityText = isVulnerable ? 'Виявлено вразливості' : 'Базові перевірки пройдено';
    const securityIcon = isVulnerable ? 'shield-exclamation' : 'shield-check';

    let html = `
        <!-- Заголовок з загальним статусом -->
        <div class="alert alert-${securityLevel} mb-4">
            <div class="d-flex align-items-center">
                <i class="bi bi-${securityIcon} fs-2 me-3"></i>
                <div>
                    <h5 class="mb-1">${securityText}</h5>
                    <p class="mb-0">Мережа: <strong>${network.ssid || 'Прихована мережа'}</strong> (${network.bssid})</p>
                </div>
            </div>
        </div>
        
        <!-- Картки результатів -->
        <div class="row g-3 mb-4">
            <!-- WPS тест -->
            <div class="col-md-4">
                <div class="card card-dark h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <i class="bi bi-wifi fs-4 me-2 ${results.wps_tested ? (results.wps_vulnerable ? 'text-danger' : 'text-success') : 'text-secondary'}"></i>
                            <h6 class="mb-0">WPS Pixie Dust</h6>
                        </div>
                        ${!results.wps_tested ? `
                            <span class="badge bg-secondary">Не тестувалось</span>
                            <p class="small text-secondary mt-2 mb-0">WPS не підтримується мережею</p>
                        ` : results.wps_vulnerable ? `
                            <span class="badge bg-danger">Вразлива</span>
                            <p class="small text-danger mt-2 mb-0">Мережа вразлива до WPS атаки!</p>
                            ${results.wps_pin ? `<p class="small mt-1 mb-0">PIN: ${results.wps_pin}</p>` : ''}
                        ` : `
                            <span class="badge bg-success">Захищена</span>
                            <p class="small text-success mt-2 mb-0">WPS атака не вдалася</p>
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Handshake -->
            <div class="col-md-4">
                <div class="card card-dark h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <i class="bi bi-hand-index fs-4 me-2 ${results.handshake_captured ? 'text-warning' : 'text-secondary'}"></i>
                            <h6 class="mb-0">Handshake</h6>
                        </div>
                        ${results.handshake_captured ? `
                            <span class="badge bg-warning text-dark">Перехоплено</span>
                            <p class="small text-warning mt-2 mb-0">Файл: ${results.handshake_file}</p>
                        ` : `
                            <span class="badge bg-secondary">Не перехоплено</span>
                            <p class="small text-secondary mt-2 mb-0">Не вдалося перехопити handshake</p>
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Dictionary Attack -->
            <div class="col-md-4">
                <div class="card card-dark h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <i class="bi bi-book fs-4 me-2 ${results.dictionary_tested ? (results.password_cracked ? 'text-danger' : 'text-success') : 'text-secondary'}"></i>
                            <h6 class="mb-0">Атака по словнику</h6>
                        </div>
                        ${!results.dictionary_tested ? `
                            <span class="badge bg-secondary">Не тестувалось</span>
                            <p class="small text-secondary mt-2 mb-0">Handshake не було перехоплено</p>
                        ` : results.password_cracked ? `
                            <span class="badge bg-danger">Пароль знайдено!</span>
                            <p class="small text-danger mt-2 mb-0">Пароль: ${results.cracked_password}</p>
                        ` : `
                            <span class="badge bg-success">Захищена</span>
                            <p class="small text-success mt-2 mb-0">Пароль не знайдено у словнику</p>
                        `}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Рекомендації -->
        <div class="card card-dark">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-lightbulb me-2"></i>Рекомендації</h6>
            </div>
            <div class="card-body">
                <ul class="mb-0">
                    ${results.recommendations && results.recommendations.length > 0
            ? results.recommendations.map(rec => `<li>${rec}</li>`).join('')
            : '<li>Мережа показала хороший рівень захисту від базових атак.</li>'}
                </ul>
            </div>
        </div>
    `;

    setHTMLContent('autoTestResults', html);
};

// ========== Функції навігації ==========

// Скинути вид до початкового стану
const resetAutoView = () => {
    // Сховати всі секції
    hideSections([
        '#autoScanSection',
        '#autoNetworksSection',
        '#autoProgressSection',
        '#autoResultsSection'
    ]);

    // Показати стартову секцію
    showSections(['#autoStartSection']);

    // Скинути дані
    autoNetworks = [];
    autoSelectedNetwork = null;
    autoTestResults = null;
    autoScanProgressBar = null;
    autoTestProgressBar = null;
};

// Повернутися до списку мереж
const backToNetworksList = () => {
    hideSections(['#autoProgressSection', '#autoResultsSection']);
    showSections(['#autoNetworksSection']);
};

// ========== Допоміжні функції ==========

// Capitalize first letter
const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Рендеринг списку мереж з WPS badge
const renderAutoNetworkList = (networks, containerId, onSelect = null) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!networks || networks.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center py-4 mb-0">Мережі не знайдено</p>';
        return;
    }

    // Функція для отримання кольору WPA badge
    const getWPAColor = (encryption) => {
        if (!encryption) return 'secondary';
        const enc = encryption.toLowerCase();
        switch (true) {
            case enc.includes('wpa3') || enc.includes('enterprise'):
                return 'success';
            case enc.includes('wpa2') || enc.includes('wpa'):
                return 'warning';
            case enc === 'none' || enc === 'open':
                return 'danger';
            default:
                return 'secondary';
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
                return 'WPA2-E';
            case enc.includes('wpa2'):
                return 'WPA2';
            case enc.includes('wpa'):
                return 'WPA';
            case enc === 'none' || enc === 'open':
                return 'Open';
            default:
                return encryption.substring(0, 8);
        }
    };

    // Функція для отримання кольору сигналу та кількості барів
    const getSignalInfo = (signal) => {
        const dbm = signal || -100;
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
            barsArray.push(`<span class="${colorClass}" style="display: inline-block; width: 3px; height: ${height}px; background-color: currentColor; margin-right: 1px; opacity: ${opacity}; border-radius: 1px; vertical-align: bottom;"></span>`);
        }
        return `<span class="wifi-signal-indicator" style="display: inline-flex; align-items: flex-end; height: 16px; line-height: 1;">${barsArray.join('')}</span>`;
    };

    // Визначаємо поточну тему
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const tableClass = currentTheme === 'dark' ? 'table table-dark' : 'table';

    container.innerHTML = `
        <div class="table-responsive">
            <table class="${tableClass} networks-table table-hover">
                <thead>
                    <tr>
                        <th>SSID</th>
                        <th>BSSID</th>
                        <th>Шифрування</th>
                        <th>WPS</th>
                        <th>Канал</th>
                        <th>Сигнал</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks.map((network, index) => {
        const wpaColor = getWPAColor(network.encryption);
        const wpaText = getWPAText(network.encryption);
        const signalInfo = getSignalInfo(network.signal);
        const wifiIcon = getWiFiIcon(signalInfo.bars, signalInfo.color);
        const rowClass = network.selected ? 'table-primary' : '';
        const onClick = onSelect ? `onclick="selectNetwork(${index})"` : '';

        // WPS badge
        const wpsBadge = network.has_wps
            ? `<span class="badge bg-warning text-dark" title="WPS ${network.wps_version || ''}">
                                <i class="bi bi-exclamation-triangle-fill me-1"></i>WPS
                               </span>`
            : '<span class="badge bg-secondary">-</span>';

        return `
                            <tr class="network-row ${rowClass}" ${onClick} style="cursor: pointer;" 
                                tabindex="0" 
                                role="button" 
                                aria-label="Вибрати мережу ${network.ssid || 'Прихована мережа'}"
                                onkeydown="if(event.key==='Enter')selectNetwork(${index})">
                                <td class="fw-semibold">${network.ssid || '<em class="text-secondary">Прихована мережа</em>'}</td>
                                <td class="text-secondary font-monospace small">${network.bssid}</td>
                                <td>
                                    <span class="badge bg-${wpaColor} rounded-pill px-2 py-1">${wpaText}</span>
                                </td>
                                <td>${wpsBadge}</td>
                                <td class="text-center">${network.channel || '-'}</td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        ${wifiIcon}
                                        <span class="text-${signalInfo.color} small">${network.signal || '?'} dBm</span>
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

// Експорт функцій у глобальну область видимості
window.startAutoScanning = startAutoScanning;
window.startAutoTesting = startAutoTesting;
window.resetAutoView = resetAutoView;
window.backToNetworksList = backToNetworksList;

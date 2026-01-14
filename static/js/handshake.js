// ========== Стан Handshake ==========
let handshakeNetworks = [];
let handshakeSelectedNetwork = null;
let handshakeCaptureProgressBar = null;

// ========== Ініціалізація Handshake ==========
document.addEventListener('DOMContentLoaded', () => {
    // Налаштувати зміну методу деавторизації
    const deauthMethod = document.getElementById('deauthMethod');
    if (deauthMethod) {
        deauthMethod.addEventListener('change', () => {
            showSections(['#deauthOptions']);
        });
    }

    // Завантажити файли handshake при ініціалізації
    loadHandshakeFiles();

    // Завантажити файли для dictionary tab
    loadDictionaryFiles();
    loadDictionaryHandshakeFiles();

    // Налаштувати оновлення команди при зміні чекбоксів або довжини паролю
    const checkboxIds = ['useLowercase', 'useUppercase', 'useDigits', 'useSpecial'];
    checkboxIds.forEach((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', updateBruteforceCommand);
        }
    });

    const passwordLengthInput = document.getElementById('passwordLength');
    if (passwordLengthInput) {
        passwordLengthInput.addEventListener('input', updateBruteforceCommand);
    }

    // Підписка на події знайдених мереж
    window.addEventListener('handshake-network-found', handleHandshakeNetworkFound);

    // Підписка на події прогресу перехоплення
    window.addEventListener('handshake-capture-progress', handleHandshakeCaptureProgress);

    // Підписка на події прогресу розшифрування
    window.addEventListener('handshake-decrypt-progress', handleHandshakeDecryptProgress);
});

// ========== Обробники подій прогресу ==========

// Обробка знайдених мереж
const handleHandshakeNetworkFound = (e) => {
    const { network, count } = e.detail;

    // Додати мережу до списку
    handshakeNetworks.push({ ...network, selected: false });

    // Оновити лічильник
    const countElement = document.getElementById('handshakeNetworksCount');
    if (countElement) {
        countElement.textContent = count;
    }

    // Перерендерити список
    renderHandshakeNetworks();
};

// Обробка прогресу перехоплення
const handleHandshakeCaptureProgress = (e) => {
    const { status, progress, elapsed, total, packets_sent } = e.detail;

    if (handshakeCaptureProgressBar) {
        handshakeCaptureProgressBar.update(progress);
    }

    // Оновити статус тексту
    const statusText = {
        'preparing': 'Підготовка...',
        'checking_monitor': 'Перевірка режиму моніторингу...',
        'starting_capture': 'Запуск захоплення...',
        'deauth_attack': 'Атака деавтентифікації...',
        'capturing': `Захоплення handshake... (${elapsed || 0}/${total || 0}с)`,
        'stopping': 'Зупинка процесів...',
        'converting': 'Конвертація файлу...',
        'checking': 'Перевірка результату...',
        'complete': 'Завершено!'
    };

    const statusElement = document.getElementById('handshakeCaptureStatus');
    if (statusElement && statusText[status]) {
        statusElement.textContent = statusText[status];
    }

    // Оновити інформацію про пакети
    const packetsElement = document.getElementById('handshakePacketsSent');
    if (packetsElement && packets_sent !== undefined) {
        packetsElement.textContent = `Пакетів відправлено: ${packets_sent}`;
    }
};

// Обробка прогресу розшифрування
const handleHandshakeDecryptProgress = (e) => {
    const { status, progress } = e.detail;

    // Оновити прогрес для brute force або dictionary
    const bruteforceProgressBar = document.getElementById('bruteforceProgressBar');
    const dictionaryProgressBar = document.getElementById('dictionaryProgressBar');

    if (bruteforceProgressBar) {
        const progressElement = bruteforceProgressBar.querySelector('.progress-bar');
        if (progressElement) {
            progressElement.style.width = `${progress}%`;
            progressElement.setAttribute('aria-valuenow', progress);
        }
    }

    if (dictionaryProgressBar) {
        const progressElement = dictionaryProgressBar.querySelector('.progress-bar');
        if (progressElement) {
            progressElement.style.width = `${progress}%`;
            progressElement.setAttribute('aria-valuenow', progress);
        }
    }
};

// ========== Функції Brute Force - Завантаження файлів ==========

// Завантажити список файлів handshake
const loadHandshakeFiles = async () => {
    try {
        const data = await pywebview.api.get_handshake_files();
        const select = document.getElementById('bruteforceHandshake');

        if (!select) return;

        // Очистити всі опції крім першої (placeholder)
        while (select.options.length > 1) {
            select.remove(1);
        }

        if (data.success && data.files.length > 0) {
            data.files.forEach((file) => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Помилка завантаження файлів handshake:', error);
    }
};

// Оновити команду brute force на основі вибраних опцій
const updateBruteforceCommand = () => {
    const passwordLength = parseInt(document.getElementById('passwordLength')?.value || '8');
    const useLowercase = document.getElementById('useLowercase')?.checked || false;
    const useUppercase = document.getElementById('useUppercase')?.checked || false;
    const useDigits = document.getElementById('useDigits')?.checked || false;
    const useSpecial = document.getElementById('useSpecial')?.checked || false;

    // Створити маску на основі вибраних чекбоксів
    let maskChar = '';

    // Якщо вибрано кілька типів символів, використовуємо комбіновану маску
    const selectedMasks = [];
    if (useLowercase) selectedMasks.push('?l');
    if (useUppercase) selectedMasks.push('?u');
    if (useDigits) selectedMasks.push('?d');
    if (useSpecial) selectedMasks.push('?s');

    // Якщо нічого не вибрано, за замовчуванням ?a (всі символи)
    if (selectedMasks.length === 0) {
        maskChar = '?a';
    } else if (selectedMasks.length === 1) {
        maskChar = selectedMasks[0];
    } else {
        // Для кількох типів створюємо custom charset
        // hashcat: -1 ?l?u?d?s означає charset 1 = lowercase + uppercase + digits + special
        // потім використовуємо ?1 в масці
        maskChar = selectedMasks.join('');
    }

    // Генеруємо маску потрібної довжини
    let mask = '';
    if (selectedMasks.length > 1) {
        // Використовуємо custom charset
        const charset = selectedMasks.join('');
        mask = `-1 ${charset} ` + '?1'.repeat(passwordLength);
    } else {
        mask = maskChar.repeat(passwordLength);
    }

    const command = `hashcat -m 22000 {file} -a 3 ${mask}`;
    const commandInput = document.getElementById('bruteforceCommand');
    if (commandInput) {
        commandInput.value = command;
    }
};

// ========== Функції вкладки Handshake ==========

// Почати сканування handshake
const startHandshakeScan = async () => {
    setButtonLoading('#handshakeScanButton');

    // Очистити попередні результати
    handshakeNetworks = [];
    handshakeSelectedNetwork = null;

    // Показати секцію мереж
    showSections(['#handshakeNetworksSection']);
    hideSections(['#handshakeSelectedNetworkInfo', '#handshakeResultsSection']);

    // Очистити список мереж
    const networksList = document.getElementById('handshakeNetworksList');
    if (networksList) {
        networksList.innerHTML = '';
    }

    // Оновити лічильник
    const countElement = document.getElementById('handshakeNetworksCount');
    if (countElement) {
        countElement.textContent = 'Сканування...';
        countElement.className = 'badge bg-primary';
    }

    try {
        // Використовуємо новий метод API для сканування через airodump-ng
        const data = await pywebview.api.handshake_scan_networks();

        if (data.success && data.networks) {
            handshakeNetworks = data.networks.map((net) => ({ ...net, selected: false }));
            renderHandshakeNetworks();

            // Оновити лічильник
            if (countElement) {
                countElement.textContent = `Знайдено ${data.count} мереж`;
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
        removeButtonLoading('#handshakeScanButton');
    }
};

// Відобразити мережі handshake
const renderHandshakeNetworks = () => {
    window.selectHandshakeNetwork = (index) => {
        handshakeNetworks.forEach((net) => (net.selected = false));
        handshakeNetworks[index].selected = true;
        handshakeSelectedNetwork = handshakeNetworks[index];
        renderHandshakeNetworks();

        setHTMLContent(
            'handshakeSelectedNetworkDetails',
            `
            <strong>SSID:</strong> ${handshakeSelectedNetwork.ssid || 'Прихована мережа'}<br>
            <strong>BSSID:</strong> ${handshakeSelectedNetwork.bssid}<br>
            <strong>Канал:</strong> ${handshakeSelectedNetwork.channel}<br>
            <strong>Протокол:</strong> ${handshakeSelectedNetwork.encryption}<br>
            <strong>Шифрування:</strong> ${handshakeSelectedNetwork.cipher}
        `
        );

        showSections(['#handshakeSelectedNetworkInfo']);
    };

    renderHandshakeNetworkList(handshakeNetworks, 'handshakeNetworksList', true);
};

// Рендеринг списку мереж для handshake (специфічно для handshake - показує channel, encryption, cipher)
const renderHandshakeNetworkList = (networks, containerId, onSelect = null) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!networks || networks.length === 0) {
        container.innerHTML = '<p class="text-secondary">Мережі не знайдено</p>';
        return;
    }

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
                        <th>Канал</th>
                        <th>Протокол</th>
                        <th>Шифрування</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks
            .map((network, index) => {
                const rowClass = network.selected ? 'table-success' : '';
                const onClick = onSelect ? `onclick="selectHandshakeNetwork(${index})"` : '';

                return `
                                <tr class="network-row ${rowClass}" ${onClick} style="cursor: pointer;" 
                                    tabindex="0" 
                                    role="button"
                                    aria-label="Вибрати мережу ${network.ssid || 'Прихована мережа'}"
                                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { selectHandshakeNetwork(${index}); event.preventDefault(); }">
                                    <td class="fw-semibold">${network.ssid || 'Прихована мережа'}</td>
                                    <td class="text-secondary">${network.bssid}</td>
                                    <td>${network.channel}</td>
                                    <td>
                                        <span class="badge ${getEncryptionBadgeClass(network.encryption)}">
                                            ${network.encryption}
                                        </span>
                                    </td>
                                    <td>${network.cipher || '-'}</td>
                                </tr>
                            `;
            })
            .join('')}
                </tbody>
            </table>
        </div>
    `;
};

// Отримати клас бейджа для типу шифрування
const getEncryptionBadgeClass = (encryption) => {
    if (!encryption) return 'bg-secondary';

    const enc = encryption.toUpperCase();
    if (enc.includes('WPA3')) return 'bg-success';
    if (enc.includes('WPA2')) return 'bg-primary';
    if (enc.includes('WPA')) return 'bg-warning';
    if (enc.includes('WEP')) return 'bg-danger';
    if (enc.includes('OPN') || enc.includes('OPEN')) return 'bg-danger';
    return 'bg-secondary';
};

// Почати перехоплення handshake
const startHandshakeCapture = async () => {
    if (!handshakeSelectedNetwork) {
        alert('Будь ласка, оберіть мережу');
        return;
    }

    const method = document.getElementById('deauthMethod').value;
    const packetsPerSec = parseInt(document.getElementById('packetsPerSec').value);
    const duration = parseInt(document.getElementById('captureDuration').value);

    showSections(['#handshakeProgressSection']);
    hideSections(['#handshakeResultsSection']);

    handshakeCaptureProgressBar = createProgressBar('handshakeProgress', 'Перехоплення handshake');

    try {
        const data = await pywebview.api.capture_handshake(handshakeSelectedNetwork, method, packetsPerSec, duration);

        showSections(['#handshakeResultsSection']);
        hideSections(['#handshakeProgressSection']);

        if (data.captured) {
            setHTMLContent(
                'handshakeResults',
                `
                <div class="alert alert-success">
                    <h5 class="alert-heading"><i class="bi bi-check-circle me-2"></i>Успішно!</h5>
                    <p>Handshake успішно перехоплено</p>
                    <p class="mb-0"><strong>Файл:</strong> ${data.file}</p>
                    <p class="mb-0">${data.message || ''}</p>
                </div>
            `
            );

            // Оновити списки файлів handshake
            loadHandshakeFiles();
            loadDictionaryHandshakeFiles();
        } else {
            setHTMLContent(
                'handshakeResults',
                `
                <div class="alert alert-warning">
                    <h5 class="alert-heading"><i class="bi bi-exclamation-triangle me-2"></i>Не вдалося перехопити</h5>
                    <p>${data.message || 'Спробуйте збільшити тривалість або кількість пакетів'}</p>
                </div>
            `
            );
        }
    } catch (error) {
        console.error('Помилка перехоплення handshake:', error);
        hideSections(['#handshakeProgressSection']);
        showSections(['#handshakeResultsSection']);
        setHTMLContent(
            'handshakeResults',
            `
            <div class="alert alert-danger">
                <h5 class="alert-heading"><i class="bi bi-x-circle me-2"></i>Помилка</h5>
                <p>Виникла помилка під час перехоплення handshake</p>
            </div>
        `
        );
    } finally {
        handshakeCaptureProgressBar = null;
    }
};

// ========== Функції Brute Force ==========

// Почати brute force
const startBruteforce = async () => {
    const handshakeSelect = document.getElementById('bruteforceHandshake');
    const handshakeFile = handshakeSelect?.value;

    if (!handshakeFile) {
        alert('Будь ласка, оберіть файл handshake');
        return;
    }

    const passwordLength = parseInt(document.getElementById('passwordLength').value);
    const useLowercase = document.getElementById('useLowercase')?.checked || false;
    const useUppercase = document.getElementById('useUppercase')?.checked || false;
    const useDigits = document.getElementById('useDigits')?.checked || false;
    const useSpecial = document.getElementById('useSpecial')?.checked || false;

    showSections(['#bruteforceProgress']);
    const progressBar = createProgressBar('bruteforceProgressBar', 'Brute Force');

    let timeElapsed = 0;
    const timeInterval = setInterval(() => {
        timeElapsed++;
        setTextContent('bruteforceTime', `Час: ${timeElapsed}с`);
    }, 1000);

    try {
        const data = await pywebview.api.decrypt_bruteforce(
            handshakeFile,
            passwordLength,
            useLowercase,
            useUppercase,
            useDigits,
            useSpecial,
            document.getElementById('bruteforceCommand').value
        );
        clearInterval(timeInterval);

        hideSections(['#bruteforceProgress']);

        if (data.cracked) {
            showBruteforceResult(true, data.password, data.message);
        } else {
            showBruteforceResult(false, null, data.message);
        }
    } catch (error) {
        clearInterval(timeInterval);
        console.error('Помилка brute force:', error);
        hideSections(['#bruteforceProgress']);
        alert('Помилка розшифрування');
    }
};

// Показати результат brute force
const showBruteforceResult = (success, password, message) => {
    const resultsContainer = document.getElementById('bruteforceResults');
    if (!resultsContainer) return;

    resultsContainer.style.display = 'block';

    if (success) {
        resultsContainer.innerHTML = `
            <div class="alert alert-success mt-3">
                <h5 class="alert-heading"><i class="bi bi-check-circle me-2"></i>Пароль знайдено!</h5>
                <p><strong>Пароль:</strong> ${password}</p>
                <p class="mb-0">${message || ''}</p>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="alert alert-info mt-3">
                <h5 class="alert-heading"><i class="bi bi-shield-check me-2"></i>Пароль не знайдено</h5>
                <p class="mb-0">${message || 'Спробуйте інші параметри або інший словник.'}</p>
            </div>
        `;
    }
};

// ========== Функції Dictionary Attack ==========

// Завантажити список файлів словників
const loadDictionaryFiles = async () => {
    try {
        const data = await pywebview.api.get_dictionary_files();
        const select = document.getElementById('dictionaryFile');

        if (!select) return;

        // Очистити всі опції крім першої (placeholder)
        while (select.options.length > 1) {
            select.remove(1);
        }

        if (data.success && data.files.length > 0) {
            data.files.forEach((file) => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Помилка завантаження файлів словників:', error);
    }
};

// Завантажити список файлів handshake для dictionary tab
const loadDictionaryHandshakeFiles = async () => {
    try {
        const data = await pywebview.api.get_handshake_files();
        const select = document.getElementById('dictionaryHandshake');

        if (!select) return;

        // Очистити всі опції крім першої (placeholder)
        while (select.options.length > 1) {
            select.remove(1);
        }

        if (data.success && data.files.length > 0) {
            data.files.forEach((file) => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Помилка завантаження файлів handshake:', error);
    }
};

// Почати dictionary attack
const startDictionary = async () => {
    const dictionarySelect = document.getElementById('dictionaryFile');
    const handshakeSelect = document.getElementById('dictionaryHandshake');

    const dictionaryFile = dictionarySelect?.value;
    const handshakeFile = handshakeSelect?.value;

    if (!dictionaryFile || !handshakeFile) {
        alert('Будь ласка, оберіть файли словника та handshake');
        return;
    }

    showSections(['#dictionaryProgress']);
    const progressBar = createProgressBar('dictionaryProgressBar', 'Dictionary Brute Force');

    try {
        const data = await pywebview.api.decrypt_dictionary(handshakeFile, dictionaryFile);

        hideSections(['#dictionaryProgress']);

        const resultsContainer = document.getElementById('dictionaryResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
        }

        if (data.cracked) {
            setHTMLContent(
                'dictionaryResults',
                `
                <div class="alert alert-success">
                    <h5 class="alert-heading"><i class="bi bi-check-circle me-2"></i>Успішно!</h5>
                    <p><strong>Пароль:</strong> ${data.password}</p>
                    <p class="mb-0">${data.message || ''}</p>
                </div>
            `
            );
        } else {
            setHTMLContent(
                'dictionaryResults',
                `
                <div class="alert alert-info">
                    <h5 class="alert-heading"><i class="bi bi-shield-check me-2"></i>Пароль не знайдено</h5>
                    <p class="mb-0">${data.message || 'Спробуйте інший словник'}</p>
                </div>
            `
            );
        }
    } catch (error) {
        console.error('Помилка dictionary атаки:', error);
        hideSections(['#dictionaryProgress']);
        alert('Помилка розшифрування');
    }
};

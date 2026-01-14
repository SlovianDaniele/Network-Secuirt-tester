// ========== Ініціалізація Nmap ==========
document.addEventListener('DOMContentLoaded', () => {
    initNmapEventListeners();
    updateNmapCommand();
});

// Ініціалізація слухачів подій
const initNmapEventListeners = () => {
    // Слухачі для радіо-кнопок вибору портів
    const portRadios = document.querySelectorAll('input[name="portSelection"]');
    portRadios.forEach((radio) => {
        radio.addEventListener('change', handlePortSelectionChange);
    });

    // Слухач для ручного введення портів
    const manualPortsInput = document.getElementById('manualPorts');
    if (manualPortsInput) {
        manualPortsInput.addEventListener('input', updateNmapCommand);
    }

    // Слухач для цілі сканування
    const targetInput = document.getElementById('nmapTarget');
    if (targetInput) {
        targetInput.addEventListener('input', updateNmapCommand);
    }

    // Слухач для агресивності
    const timingSelect = document.getElementById('nmapTiming');
    if (timingSelect) {
        timingSelect.addEventListener('change', updateNmapCommand);
    }

    // Слухачі для чекбоксів опцій
    const checkboxes = [
        'nmapActiveScan',
        'nmapVersionDetection',
        'nmapOsDetection',
        'nmapVerbose'
    ];

    checkboxes.forEach((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', handleOptionChange);
        }
    });
};

// Обробник зміни вибору портів
const handlePortSelectionChange = (event) => {
    const value = event.target.value;
    const manualPortInput = document.getElementById('manualPortInput');

    if (value === 'manual') {
        showSections(['#manualPortInput']);
    } else {
        hideSections(['#manualPortInput']);
    }

    updateNmapCommand();
};

// Обробник зміни опцій (для -A який включає -sV і -O)
const handleOptionChange = (event) => {
    const activeScanCheckbox = document.getElementById('nmapActiveScan');
    const versionDetection = document.getElementById('nmapVersionDetection');
    const osDetection = document.getElementById('nmapOsDetection');

    // Якщо увімкнено активне сканування (-A), воно вже включає -sV і -O
    if (event.target.id === 'nmapActiveScan' && activeScanCheckbox.checked) {
        // Показуємо інформаційне повідомлення
        versionDetection.disabled = true;
        osDetection.disabled = true;
        versionDetection.checked = false;
        osDetection.checked = false;
    } else if (event.target.id === 'nmapActiveScan' && !activeScanCheckbox.checked) {
        versionDetection.disabled = false;
        osDetection.disabled = false;
    }

    updateNmapCommand();
};

// Генерація команди Nmap
const updateNmapCommand = () => {
    const commandInput = document.getElementById('nmapCommand');
    if (!commandInput) return;

    const command = buildNmapCommand();
    commandInput.value = command;
};

// Побудова команди Nmap
const buildNmapCommand = () => {
    const parts = ['nmap'];

    // Порти
    const portSelection = document.querySelector('input[name="portSelection"]:checked');
    if (portSelection) {
        const portValue = portSelection.value;

        if (portValue === 'all') {
            parts.push('-p-');
        } else if (portValue === 'manual') {
            const manualPorts = document.getElementById('manualPorts')?.value?.trim();
            if (manualPorts) {
                parts.push(`-p ${manualPorts}`);
            }
        }
        // 'standard' - не додаємо -p, nmap використає стандартні порти
    }

    // Агресивність/Timing
    const timing = document.getElementById('nmapTiming')?.value;
    if (timing && timing !== '3') {
        parts.push(`-T${timing}`);
    }

    // Активне сканування (-A)
    const activeScan = document.getElementById('nmapActiveScan')?.checked;
    if (activeScan) {
        parts.push('-A');
    } else {
        // Ідентифікація версій (-sV)
        const versionDetection = document.getElementById('nmapVersionDetection')?.checked;
        if (versionDetection) {
            parts.push('-sV');
        }

        // Визначення ОС (-O)
        const osDetection = document.getElementById('nmapOsDetection')?.checked;
        if (osDetection) {
            parts.push('-O');
        }
    }

    // Детальний вивід (-v)
    const verbose = document.getElementById('nmapVerbose')?.checked;
    if (verbose) {
        parts.push('-v');
    }

    // Ціль сканування
    const target = document.getElementById('nmapTarget')?.value?.trim() || '192.168.1.0/24';
    parts.push(target);

    return parts.join(' ');
};

// Отримання параметрів для API
const getNmapParams = () => {
    const portSelection = document.querySelector('input[name="portSelection"]:checked')?.value || 'standard';
    let ports = 'standard';

    if (portSelection === 'all') {
        ports = '-';
    } else if (portSelection === 'manual') {
        ports = document.getElementById('manualPorts')?.value?.trim() || '';
    }

    return {
        target: document.getElementById('nmapTarget')?.value?.trim() || '192.168.1.0/24',
        ports: ports,
        timing: document.getElementById('nmapTiming')?.value || '3',
        activeScan: document.getElementById('nmapActiveScan')?.checked || false,
        versionDetection: document.getElementById('nmapVersionDetection')?.checked || false,
        osDetection: document.getElementById('nmapOsDetection')?.checked || false,
        verbose: document.getElementById('nmapVerbose')?.checked || false,
        command: buildNmapCommand()
    };
};

// ========== Функції вкладки Nmap ==========

// Почати сканування Nmap
const handleStartNmapScan = async () => {
    const params = getNmapParams();

    // Валідація
    if (!params.target) {
        alert('Будь ласка, введіть ціль сканування');
        return;
    }

    if (params.ports === '' && document.querySelector('input[name="portSelection"]:checked')?.value === 'manual') {
        alert('Будь ласка, введіть порти для сканування');
        return;
    }

    // Показати секцію прогресу
    showSections(['#nmapProgressSection']);
    hideSections(['#nmapResultsSection']);

    const progressBar = createProgressBar('nmapProgress', 'Nmap сканування');
    const statusElement = document.getElementById('nmapScanStatus');
    const startButton = document.getElementById('nmapStartButton');

    // Деактивувати кнопку під час сканування
    if (startButton) {
        startButton.disabled = true;
        startButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Сканування...';
    }

    // Підписка на події прогресу
    const handleProgress = (e) => {
        const { progress, status } = e.detail;
        progressBar.update(progress);
        if (statusElement && status) {
            statusElement.textContent = `Статус: ${status}`;
        }
    };
    window.addEventListener('nmapProgress', handleProgress);

    try {
        // Виклик API з усіма параметрами
        const data = await pywebview.api.nmap_scan(
            params.ports,
            params.target,
            params.timing,
            params.activeScan,
            params.versionDetection,
            params.osDetection,
            params.verbose
        );

        window.removeEventListener('nmapProgress', handleProgress);

        // Показати результати
        showSections(['#nmapResultsSection']);
        renderNmapResults(data, params);

    } catch (error) {
        window.removeEventListener('nmapProgress', handleProgress);
        console.error('Помилка сканування Nmap:', error);

        setHTMLContent('nmapResults', `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Помилка сканування:</strong> ${error.message || 'Невідома помилка'}
            </div>
        `);
        showSections(['#nmapResultsSection']);
    } finally {
        // Відновити кнопку
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Старт';
        }
    }
};

// Рендер результатів сканування
const renderNmapResults = (data, params) => {
    const openPortsRows = data.open_ports?.map((port) => `
        <tr>
            <td><code>${port.port}</code></td>
            <td>${port.service || 'Невідомо'}</td>
            <td>${port.version || '-'}</td>
            <td><span class="badge bg-success">${port.state}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="4" class="text-center text-secondary">Відкриті порти не знайдено</td></tr>';

    const html = `
        <div class="mb-4">
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Ціль:</strong> ${data.target || params.target}</p>
                    <p><strong>Порти:</strong> ${data.ports || params.ports}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Час сканування:</strong> ${data.scan_time || '-'}с</p>
                    <p><strong>Команда:</strong> <code>${params.command}</code></p>
                </div>
            </div>
        </div>
        
        <h5 class="mb-3">
            <i class="bi bi-door-open me-2"></i>
            Відкриті порти (${data.open_ports?.length || 0})
        </h5>
        
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Порт</th>
                        <th>Сервіс</th>
                        <th>Версія</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${openPortsRows}
                </tbody>
            </table>
        </div>

        ${data.os_detection ? `
            <div class="mt-4">
                <h5 class="mb-3">
                    <i class="bi bi-pc-display me-2"></i>
                    Операційна система
                </h5>
                <p>${data.os_detection}</p>
            </div>
        ` : ''}
    `;

    setHTMLContent('nmapResults', html);
};

// Для зворотної сумісності
const startNmapScan = handleStartNmapScan;

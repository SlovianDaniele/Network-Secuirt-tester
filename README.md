# Pentester Application

Віконний додаток на Python з PyWebView API та HTML інтерфейсом для пентестування та аналізу безпеки мереж.

## Технології

-   **Desktop**: PyWebView 4.4.1
-   **Backend**: Python API клас (server.py) з PyWebView API bridge
-   **Frontend**: HTML5, JavaScript (ES6+), Jinja2 templates, Custom CSS, Bootstrap 5.3.0
-   **Templates**: Jinja2 з модульною структурою partials
-   **SSH**: Paramiko 4.0.0 для з'єднання з Kali Linux VM
-   **VM Management**: VirtualBox через командний рядок

## Особливості

-   ✅ Віконний десктопний додаток на PyWebView
-   ✅ Прямі Python API виклики з JavaScript (без HTTP)
-   ✅ Event-driven архітектура (CustomEvents)
-   ✅ Real-time прогрес операцій
-   ✅ Сучасний UI з темною/світлою темою
-   ✅ Модульна структура сторінок
-   ✅ Перевірка стану VM через SSH
-   ✅ Автоматичний режим тестування (комбіноване сканування + автоматичне тестування)
-   ✅ Сканування Wi-Fi мереж (wash, airodump-ng)
-   ✅ WPS тестування (reaver, Pixie Dust)
-   ✅ Перехоплення Handshake (deauth атаки)
-   ✅ Розшифрування Handshake (Brute Force та Dictionary)
-   ✅ Nmap сканування портів (з розширеними параметрами)
-   ✅ Генерація персоналізованих словників (CUPP)
-   ✅ Управління файлами (handshake, словники)
-   ✅ Налаштування теми та параметрів VM
-   ✅ Збереження налаштувань у JSON

## Встановлення

1. Клонуйте репозиторій
2. Встановіть залежності:

```bash
pip install -r requirements.txt
```

## Запуск

Запустіть додаток командою:

```bash
python app.py
```

Додаток автоматично:

-   Створить PyWebView вікно розміром 1440x850 (resizable)
-   Відкриє віконний додаток з інтерфейсом
-   Ініціалізує VM підключення в фоновому режимі (окремий потік)
-   Завантажить налаштування з `settings.json` (якщо файл існує)
-   Відправить подію `settings-loaded` після завантаження
-   Запуститься в debug режимі (для розробки)

## Архітектура

### PyWebView API

Додаток використовує **PyWebView API** для комунікації між JavaScript та Python:

-   ✅ **Прямі виклики**: JavaScript викликає Python методи через `pywebview.api.method_name()`
-   ✅ **CustomEvents**: Python відправляє події на фронтенд через `window.dispatchEvent()`
-   ✅ **Без HTTP**: Немає потреби в REST API та серверних запитах
-   ✅ **Real-time**: Миттєве оновлення прогресу операцій

### Приклад комунікації

**JavaScript → Python:**

```javascript
// Виклик Python методу
const result = await pywebview.api.scan_networks();
console.log(result.networks);
```

**Python → JavaScript:**

```python
# Відправка події на фронтенд
self.dispatch_event('scan-progress', {
    'progress': 50,
    'message': 'Сканування...'
})
```

**JavaScript слухає події:**

```javascript
window.addEventListener("scan-progress", (event) => {
	console.log(event.detail.progress); // 50
});
```

## Структура проекту

```
pentester/
├── app.py                  # Головний файл додатку (PyWebView + Jinja2)
├── server.py               # PyWebView API клас
├── settings.json           # Файл налаштувань (автоматично створюється)
├── requirements.txt        # Залежності Python
├── lib/                    # Утиліти та конфігурація
│   ├── vm_utils.py         # Управління VM (VirtualBox, SSH)
│   ├── wps_utils.py        # WPS тестування та сканування мереж
│   ├── handshake_utils.py  # Handshake операції (перехоплення, розшифрування)
│   ├── ssh_utils.py        # SSH з'єднання з Kali VM
│   ├── dict_utils.py       # Робота зі словниками
│   ├── nmap_utils.py       # Nmap сканування портів
│   ├── network_utils.py    # Мережеві утиліти
│   ├── config.py           # Конфігурація додатку
│   ├── cupp.py             # CUPP інтеграція
│   ├── cupp.cfg            # CUPP конфігурація
│   ├── handshake/          # Папка для handshake файлів
│   ├── dict/               # Папка для словників
│   └── convert/            # Папка для конвертованих файлів
├── templates/
│   ├── index.html          # Головний шаблон (Jinja2)
│   └── partials/           # Модульні компоненти
│       ├── auto/           # Auto режим
│       │   ├── _auto.html
│       │   ├── start-section.html
│       │   ├── networks-section.html
│       │   ├── progress-section.html
│       │   └── results-section.html
│       ├── wps/            # WPS тестування
│       │   └── _wps.html
│       ├── handshake/      # Handshake операції (partials)
│       │   ├── interception/
│       │   │   └── _interception.html
│       │   └── decryption/
│       │       ├── _decryption.html
│       │       ├── bruteforce-subtab.html
│       │       └── dictionary-subtab.html
│       ├── nmap/           # Nmap сканування
│       │   └── _nmap.html
│       ├── dictionaries/   # CUPP генерація
│       │   └── _dictionaries.html
│       └── settings/       # Налаштування
│           └── _settings.html
└── static/
    ├── css/
    │   └── style.css       # Кастомні стилі (темна тема)
    └── js/
        ├── shared.js       # Спільні функції
        ├── index.js        # Навігація
        ├── auto.js         # Auto режим логіка
        ├── wps.js          # WPS логіка
        ├── handshake.js    # Handshake логіка
        ├── nmap.js         # Nmap логіка
        ├── dictionaries.js # CUPP логіка
        └── settings.js     # Налаштування логіка
```

## Сторінки додатку

Додаток має модульну структуру з окремими сторінками:

-   **auto** - Автоматичний режим тестування:
    -   Комбіноване сканування (WPS + Handshake)
    -   Автоматичне тестування безпеки (WPS Pixie Dust → Handshake capture → Dictionary attack)
    -   Результати та рекомендації
-   **wps** - WPS тестування (перевірка WPS вразливостей через reaver)
-   **interception** - Перехоплення handshake (deauth атаки через airodump-ng)
-   **decryption** - Розшифрування handshake (brute force, dictionary через hashcat)
-   **nmap** - Nmap сканування портів (з розширеними параметрами)
-   **dictionaries** - Генерація персоналізованих словників (CUPP)
-   **settings** - Налаштування (тема, VM параметри)

Навігація між сторінками реалізована через `pywebview.api.navigate(page)`.

## Python API Methods

Усі методи доступні через `pywebview.api.*` з JavaScript:

### VM та Статус

```python
get_vm_status()
# Повертає: { success, connected, status, ip, message }
```

### Сканування мереж

```python
scan_networks()
# Повертає: { success, networks: [{ ssid, bssid, encryption, wps, wps_version, signal, channel }], count }
# Використовує: wash (WPS сканування)

handshake_scan_networks()
# Повертає: { success, networks: [{ ssid, bssid, encryption, cipher, signal, channel }], count }
# Використовує: airodump-ng (Handshake сканування)

auto_scan_networks()
# Комбіноване сканування (WPS + Handshake)
# Повертає: { success, networks: [...], count, wps_count }
# Події: auto-scan-progress, message
```

### WPS тестування

```python
wps_test(network, command='reaver -i wlan0 -b {bssid} -vv')
# Параметри: network (dict), command (str)
# Повертає: { success, message, timeout }
# Події: wps-progress
# Використовує: reaver (WPS Pixie Dust атака)
```

### Handshake операції

```python
get_handshake_files()
# Повертає: { success, files: [], count, message }
# Отримує список файлів handshake з папки lib/handshake/
# Підтримувані формати: .cap, .hccapx, .pcap

capture_handshake(network, method='deauth', packets_per_sec=10, duration=70)
# Параметри: network (dict), method (str), packets_per_sec (int), duration (int)
# Повертає: { success, captured, network, method, packets_sent, file }
# Події: handshake-capture-progress

decrypt_bruteforce(handshake_file, password_length=8, use_lowercase=False,
                   use_uppercase=False, use_digits=True, use_special=False, command='')
# Параметри: handshake_file (str), password_length (int), use_lowercase (bool),
#            use_uppercase (bool), use_digits (bool), use_special (bool), command (str)
# Повертає: { success, cracked, password, time_elapsed, attempts }
# Події: handshake-decrypt-progress

decrypt_dictionary(handshake_file, dictionary_file='rockyou.txt')
# Параметри: handshake_file (str), dictionary_file (str)
# Повертає: { success, cracked, password, time_elapsed, words_tried }
# Події: handshake-decrypt-progress
```

### Nmap сканування

```python
nmap_scan(ports='standard', target='192.168.1.0/24', timing='3',
          active_scan=False, version_detection=True, os_detection=False, verbose=False)
# Параметри:
#   - ports: 'standard', '-' (всі), або конкретні порти (напр. '80,443,22')
#   - target: IP адреса або підмережа (напр. '192.168.1.0/24')
#   - timing: Агресивність від '0' до '5'
#   - active_scan: Чи використовувати -A (активне сканування)
#   - version_detection: Чи використовувати -sV (визначення версій)
#   - os_detection: Чи використовувати -O (визначення ОС)
#   - verbose: Чи використовувати -v (детальний вивід)
# Повертає: { success, target, ports, open_ports: [{ port, service, state }], scan_time }
# Події: nmap-progress
```

### CUPP генерація

```python
cupp_generate(data)
# Параметри: data { name, surname, nickname, birthdate, wife, pet, company, words, special_chars }
# Повертає: { success, message, count, file }

get_dictionary_files()
# Повертає: { success, files: [], count, message }
# Отримує список файлів словників з папки lib/dict/
# Підтримувані формати: .txt, .lst, .dic
```

### Автоматичне тестування

```python
auto_test_network(network)
# Параметри: network (dict) з bssid, channel, ssid, has_wps, encryption
# Виконує послідовно:
#   1. WPS Pixie Dust (якщо has_wps=True)
#   2. Handshake capture (deauth атака)
#   3. Dictionary attack (probable-v2-wpa-top4800.txt)
# Повертає: {
#   success, network, wps_tested, wps_vulnerable, wps_pin, wps_password,
#   handshake_captured, handshake_file, dictionary_tested, password_cracked,
#   cracked_password, recommendations: []
# }
# Події: auto-test-progress, auto-test-complete, message
```

### Налаштування

```python
get_settings()
# Повертає: { success, settings: { theme, vm_cpu, vm_ram } }

update_settings(data)
# Параметри: data { theme, vm_cpu, vm_ram }
# Повертає: { success, settings }
```

### Навігація

```python
navigate(page)
# Параметри: page ('auto', 'wps', 'interception', 'decryption', 'nmap', 'dictionaries', 'settings')
# Повертає: { success, page }
```

## Приклади використання API

### JavaScript приклади

#### Сканування мереж

```javascript
async function scanNetworks() {
	try {
		const result = await pywebview.api.scan_networks();
		if (result.success) {
			console.log(`Знайдено ${result.count} мереж`);
			result.networks.forEach((network) => {
				console.log(
					`${network.ssid} - ${network.bssid} - Signal: ${network.signal}`
				);
			});
		}
	} catch (error) {
		console.error("Помилка сканування:", error);
	}
}
```

#### WPS тестування з прогресом

```javascript
// Слухаємо події прогресу
window.addEventListener("wps-progress", (event) => {
	const { progress, message, pin } = event.detail;
	console.log(`${progress}%: ${message}`);
	if (pin) {
		console.log(`Знайдено PIN: ${pin}`);
	}
});

// Запускаємо тест
async function testWPS(network) {
	const result = await pywebview.api.wps_test(
		network,
		"reaver -i wlan0 -b {bssid} -vv"
	);

	if (result.success) {
		console.log(result.message);
	}
}
```

#### Перехоплення Handshake з прогресом

```javascript
// Слухаємо прогрес
window.addEventListener("handshake-capture-progress", (event) => {
	const { progress, elapsed, total, packets_sent } = event.detail;
	console.log(
		`${progress.toFixed(
			1
		)}% - ${elapsed}/${total}s - Packets: ${packets_sent}`
	);
});

// Перехоплюємо
async function captureHandshake(network) {
	const result = await pywebview.api.capture_handshake(
		network,
		"deauth",
		10,
		70
	);

	if (result.captured) {
		console.log(`Handshake перехоплено: ${result.file}`);
	}
}

// Отримати список handshake файлів
async function getHandshakeFiles() {
	const result = await pywebview.api.get_handshake_files();
	if (result.success) {
		console.log(`Знайдено ${result.count} файлів:`);
		result.files.forEach((file) => console.log(`- ${file}`));
	}
}
```

#### Nmap сканування

```javascript
window.addEventListener("nmap-progress", (event) => {
	console.log(`${event.detail.progress}%: ${event.detail.message}`);
});

async function scanPorts(target, ports = "standard") {
	const result = await pywebview.api.nmap_scan(
		ports,
		target,
		"3", // timing
		false, // active_scan
		true, // version_detection
		false, // os_detection
		false // verbose
	);

	if (result.success) {
		console.log(`Відкриті порти на ${result.target}:`);
		result.open_ports.forEach((port) => {
			console.log(`- ${port.port}: ${port.service} (${port.state})`);
		});
	}
}
```

#### CUPP генерація словника

```javascript
async function generateWordlist() {
	const data = {
		name: "John",
		surname: "Doe",
		nickname: "johndoe",
		birthdate: "01011990",
		pet: "Fluffy",
		company: "TechCorp",
		words: "password, admin, test",
		special_chars: true,
	};

	const result = await pywebview.api.cupp_generate(data);

	if (result.success) {
		console.log(`Згенеровано ${result.count} паролів`);
		console.log(`Файл: ${result.file}`);
		result.wordlist.forEach((word) => console.log(word));
	}
}
```

#### Налаштування

```javascript
// Отримати налаштування
async function loadSettings() {
	const result = await pywebview.api.get_settings();
	if (result.success) {
		console.log("Тема:", result.settings.theme);
		console.log("CPU:", result.settings.vm_cpu);
		console.log("RAM:", result.settings.vm_ram);
	}
}

// Оновити налаштування
async function saveSettings() {
	const result = await pywebview.api.update_settings({
		theme: "dark",
		vm_cpu: 4,
		vm_ram: 8,
	});

	if (result.success) {
		console.log("Налаштування збережено");
	}
}
```

#### Автоматичне тестування

```javascript
// Слухаємо події автоматичного тестування
window.addEventListener("auto-scan-progress", (event) => {
	const { phase, progress, status } = event.detail;
	console.log(`[${phase}] ${progress}% - ${status}`);
});

window.addEventListener("auto-test-progress", (event) => {
	const { phase, progress, status, message } = event.detail;
	console.log(`[${phase}] ${progress}% - ${message}`);
});

window.addEventListener("auto-test-complete", (event) => {
	const results = event.detail;
	console.log("Результати тестування:", results);
	if (results.wps_vulnerable) {
		console.log("⚠️ WPS вразливість знайдена!");
	}
	if (results.password_cracked) {
		console.log(`🔓 Пароль: ${results.cracked_password}`);
	}
	console.log("Рекомендації:", results.recommendations);
});

// Комбіноване сканування
async function autoScanNetworks() {
	const result = await pywebview.api.auto_scan_networks();
	if (result.success) {
		console.log(
			`Знайдено ${result.count} мереж (${result.wps_count} з WPS)`
		);
	}
}

// Автоматичне тестування мережі
async function autoTestNetwork(network) {
	const result = await pywebview.api.auto_test_network(network);
	console.log("Результати:", result);
}
```

#### Навігація

```javascript
async function navigateToPage(page) {
	const result = await pywebview.api.navigate(page);
	if (result.success) {
		console.log(`Перехід на сторінку: ${result.page}`);
	}
}

// Приклади
navigateToPage("wps");
navigateToPage("interception");
navigateToPage("decryption");
navigateToPage("settings");
```

## Налаштування

Налаштування зберігаються у файлі `settings.json`:

```json
{
	"theme": "dark",
	"vm_cpu": 2,
	"vm_ram": 4
}
```

Додаткові налаштування конфігурації (VM, SSH) знаходяться в `lib/config.py`:

```python
{
  "host": "",                # IP адреса VM (SSH) визначається автоматично
  "port": "22",              # SSH порт
  "username": "kali",        # SSH користувач
  "password": "kali",        # SSH пароль
  "vm_name": "MAN",          # Назва віртуальної машини
  "handshake_folder": "handshake",  # Папка для handshake файлів (відносно lib/)
  "dict_folder": "dict",            # Папка для словників (відносно lib/)
  "hashcat_folder": "convert"       # Папка для конвертованих файлів (відносно lib/)
}
```

Папки `lib/handshake/`, `lib/dict/` та `lib/convert/` створюються автоматично при запуску.

**Примітка:** Додаток також підтримує змінні середовища через `.env` файл для конфігурації SSH та локальних шляхів (якщо потрібно перевизначити стандартні налаштування).

## Event System

Додаток використовує CustomEvents для real-time комунікації:

### Події прогресу

| Подія                        | Дані                                         | Опис                                      |
| ---------------------------- | -------------------------------------------- | ----------------------------------------- |
| `settings-loaded`            | `{ success, message }`                       | Налаштування завантажені                  |
| `wps-progress`               | `{ progress, message, pin }`                 | Прогрес WPS тестування                    |
| `handshake-capture-progress` | `{ progress, elapsed, total, packets_sent }` | Прогрес перехоплення                      |
| `handshake-decrypt-progress` | `{ progress, status }`                       | Прогрес розшифрування                     |
| `nmap-progress`              | `{ progress, message }`                      | Прогрес Nmap сканування                   |
| `scan-progress`              | `{ progress, message }`                      | Прогрес сканування мереж                  |
| `auto-scan-progress`         | `{ phase, progress, status }`                | Прогрес auto сканування                   |
| `auto-test-progress`         | `{ phase, progress, status, message }`       | Прогрес auto тестування                   |
| `auto-test-complete`         | `{ success, network, wps_tested, ... }`      | Завершення auto тестування                |
| `message`                    | `{ message, type }`                          | Повідомлення (info/success/warning/error) |

### Слухання подій

```javascript
window.addEventListener("wps-progress", (event) => {
	const data = event.detail;
	console.log(`Прогрес: ${data.progress}%`);
	console.log(`Повідомлення: ${data.message}`);
});
```

## Залежності

-   **pywebview==4.4.1** - Desktop window framework
-   **jinja2==3.1.6** - Templating engine
-   **python-dotenv==1.2.1** - Environment variables
-   **paramiko==4.0.0** - SSH connections

Всі залежності встановлюються через `pip install -r requirements.txt`.

## Вимоги

-   **Python 3.8+** (рекомендовано Python 3.10+)
-   **pip** для встановлення залежностей
-   **Oracle VirtualBox** (для роботи з VM)
-   **Kali Linux VM** (назва за замовчуванням: "MAN")
-   **Налаштоване SSH з'єднання** з VM (username: kali, password: kali)
-   **Wi-Fi адаптер з підтримкою monitor mode** (для перехоплення handshake та WPS атак)
-   **Kali Linux інструменти**: wash, airodump-ng, reaver, hashcat (встановлені в VM)

## Особливості реалізації

### 1. Асинхронна ініціалізація VM

VM підключення ініціалізується в окремому потоці при запуску додатку (в `server.py`):

```python
def init_vm_thread():
    try:
        vm_utils.init_vm()
    except Exception as e:
        print(f"Помилка ініціалізації VM: {e}")

init_thread = threading.Thread(target=init_vm_thread, daemon=True)
init_thread.start()
```

Це дозволяє додатку запускатися без очікування підключення до VM.

### 2. Прогрес операцій через події

Всі тривалі операції відправляють прогрес у реальному часі через CustomEvents:

```python
def dispatch_event(self, event_name, data):
    """Відправити подію на фронтенд через PyWebView"""
    if not self.window:
        return

    try:
        json_data = json.dumps(data)
        js_code = f"""
            window.dispatchEvent(new CustomEvent('{event_name}', {{ detail: {json_data} }}));
        """
        self.window.evaluate_js(js_code)
    except Exception as e:
        print(f"Помилка відправки події: {e}")
```

Метод `send_progress_event()` є обгорткою над `dispatch_event()` для зручності.

### 3. Динамічна навігація

Навігація реалізована через Jinja2 re-rendering та PyWebView `load_html()`:

```python
def navigate(self, page):
    """Змінити сторінку (викликається з JS)"""
    if not self.window or not self.render_template:
        return {'success': False, 'message': 'Window або render_template не встановлено'}

    try:
        theme = self.settings_store.get('theme', 'dark')
        html = self.render_template(page=page, theme=theme)
        self.window.load_html(html)
        return {'success': True, 'page': page}
    except Exception as e:
        return {'success': False, 'message': f'Помилка навігації: {str(e)}'}
```

Кожна сторінка рендериться заново з актуальною темою та контекстом.

### 4. Модульна frontend структура

Кожна сторінка має власний JS модуль з обробниками подій та логікою. Модулі завантажуються через Jinja2 `read_static()` функцію:

```javascript
// Приклад структури модуля (auto.js)
document.addEventListener("DOMContentLoaded", () => {
	window.addEventListener("auto-scan-progress", handleAutoScanProgress);
	window.addEventListener("auto-test-progress", handleAutoTestProgress);
	window.addEventListener("auto-test-complete", handleAutoTestComplete);
	window.addEventListener("message", handleMessage);
});
```

Всі JS файли знаходяться в `static/js/` та вбудовуються в HTML через Jinja2 шаблони.

### 5. Автоматичний режим тестування

Auto режим виконує комплексне тестування безпеки:

1. **Комбіноване сканування** (`auto_scan_networks`):

    - Об'єднує результати WPS (wash) та Handshake (airodump-ng) сканування
    - Створює об'єднаний список мереж з повною інформацією про WPS та шифрування
    - Відсортовує мережі за силою сигналу

2. **Автоматичне тестування** (`auto_test_network`): Послідовно виконує:

    - WPS Pixie Dust атаку через `reaver -K 1` (якщо мережа підтримує WPS)
    - Перехоплення Handshake через deauth атаку (10 пакетів/сек, 70 секунд)
    - Dictionary атаку з словником `probable-v2-wpa-top4800.txt` (якщо handshake перехоплено)

3. **Генерація рекомендацій**: На основі результатів тестування:
    - Попередження про WPS вразливості
    - Рекомендації щодо зміни пароля (якщо знайдено у словнику)
    - Рекомендації щодо оновлення протоколу (якщо використовується застарілий WPA/WPA2)

## Діаграма архітектури

Детальна діаграма архітектури доступна в файлі [architecture-diagram.md](architecture-diagram.md).

## Ліцензія

MIT

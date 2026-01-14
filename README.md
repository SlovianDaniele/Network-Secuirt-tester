# Pentester Application

Віконний додаток на Python з PyWebView API та HTML інтерфейсом для пентестування та аналізу безпеки мереж.

## Технології

-   **Desktop**: PyWebView 4.4.1 (замість Flask)
-   **Backend**: Python API клас (server.py)
-   **Frontend**: HTML5, JavaScript, Jinja2, Custom CSS
-   **Templates**: Jinja2
-   **SSH**: Paramiko 4.0.0

## Особливості

-   ✅ Віконний десктопний додаток на PyWebView
-   ✅ Прямі Python API виклики з JavaScript (без HTTP)
-   ✅ Event-driven архітектура (CustomEvents)
-   ✅ Real-time прогрес операцій
-   ✅ Сучасний UI з темною темою
-   ✅ Модульна структура сторінок
-   ✅ Перевірка стану VM через SSH
-   ✅ Сканування Wi-Fi мереж (wash)
-   ✅ WPS тестування (reaver)
-   ✅ Перехоплення Handshake
-   ✅ Розшифрування Handshake (Brute Force та Dictionary)
-   ✅ Nmap сканування портів
-   ✅ Генерація персоналізованих словників (CUPP)
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

-   Створить PyWebView вікно розміром 1440x850
-   Відкриє віконний додаток з інтерфейсом
-   Ініціалізує VM підключення в фоновому режимі
-   Завантажить налаштування з settings.json

## Архітектура

### PyWebView замість Flask

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
self.dispatch_event('scanProgress', {
    'progress': 50,
    'message': 'Сканування...'
})
```

**JavaScript слухає події:**

```javascript
window.addEventListener("scanProgress", (event) => {
	console.log(event.detail.progress); // 50
});
```

## Структура проекту

```
pentester/
├── app.py                  # Головний файл додатку (PyWebView + Jinja2)
├── server.py               # PyWebView API клас (замість Flask)
├── settings.json           # Файл налаштувань (автоматично створюється)
├── requirements.txt        # Залежності Python
├── lib/                    # Утиліти та конфігурація
│   ├── vm_utils.py         # Управління VM (VirtualBox, SSH)
│   ├── wps_utils.py        # WPS тестування та сканування мереж
│   ├── ssh_utils.py        # SSH з'єднання з Kali VM
│   ├── dict_utils.py       # Робота зі словниками
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
│       ├── handshake/      # Handshake операції
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

-   **auto** - Автоматичний режим (сканування мереж, вибір мережі)
-   **wps** - WPS тестування (перевірка WPS вразливостей)
-   **handshake** - Handshake операції:
    -   **interception** - Перехоплення handshake (deauth атаки)
    -   **decryption** - Розшифрування (brute force, dictionary)
-   **nmap** - Nmap сканування портів
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
# Повертає: { success, networks: [{ ssid, bssid, encryption, wps, signal, channel }], count }
```

### WPS тестування

```python
wps_test(network, command='reaver -i wlan0 -b {bssid} -vv')
# Параметри: network (dict), command (str)
# Повертає: { success, message }
# Події: wpsProgress
```

### Handshake операції

```python
capture_handshake(network, method='deauth', packets_per_sec=10, duration=60)
# Повертає: { success, captured, network, method, packets_sent, file }
# Події: handshakeProgress

decrypt_bruteforce(handshake_file, password_length=8, use_numbers=True, use_special=False, command='...')
# Повертає: { success, cracked, password, time_elapsed, attempts }
# Події: bruteforceProgress

decrypt_dictionary(handshake_file, dictionary_file='rockyou.txt')
# Повертає: { success, cracked, password, time_elapsed, words_tried }
# Події: dictionaryProgress
```

### Nmap сканування

```python
nmap_scan(ports='standard', target='192.168.1.1')
# Повертає: { success, target, ports, open_ports: [{ port, service, state }], scan_time }
# Події: nmapProgress
```

### CUPP генерація

```python
cupp_generate(data)
# Параметри: data { name, surname, nickname, birthdate, wife, pet, company, words, special_chars }
# Повертає: { success, wordlist: [], count, file }
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
# Параметри: page ('auto', 'wps', 'handshake', 'nmap', 'dictionaries', 'settings')
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
window.addEventListener("wpsProgress", (event) => {
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
window.addEventListener("handshakeProgress", (event) => {
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
		60
	);

	if (result.captured) {
		console.log(`Handshake перехоплено: ${result.file}`);
	}
}
```

#### Nmap сканування

```javascript
window.addEventListener("nmapProgress", (event) => {
	console.log(`${event.detail.progress}%: ${event.detail.message}`);
});

async function scanPorts(target, ports = "standard") {
	const result = await pywebview.api.nmap_scan(ports, target);

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
navigateToPage("handshake");
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
  "host": None,              # IP адреса VM (автоматично визначається)
  "username": "kali",        # SSH користувач
  "password": "kali",        # SSH пароль
  "vm_name": "MAN",          # Назва віртуальної машини
  "handshake_folder": "lib/handshake",  # Папка для handshake файлів
  "dict_folder": "lib/dict",            # Папка для словників
  "hashcat_folder": "lib/convert"       # Папка для конвертованих файлів
}
```

Папки `lib/handshake/`, `lib/dict/` та `lib/convert/` створюються автоматично при запуску.

## Event System

Додаток використовує CustomEvents для real-time комунікації:

### Події прогресу

| Подія                | Дані                                         | Опис                     |
| -------------------- | -------------------------------------------- | ------------------------ |
| `settings-loaded`    | `{ success, message }`                       | Налаштування завантажені |
| `wpsProgress`        | `{ progress, message, pin }`                 | Прогрес WPS тестування   |
| `handshakeProgress`  | `{ progress, elapsed, total, packets_sent }` | Прогрес перехоплення     |
| `bruteforceProgress` | `{ progress, time_elapsed, attempts }`       | Прогрес brute force      |
| `dictionaryProgress` | `{ progress, words_tried }`                  | Прогрес dictionary атаки |
| `nmapProgress`       | `{ progress, message }`                      | Прогрес Nmap сканування  |
| `scanProgress`       | `{ progress, message }`                      | Прогрес сканування мереж |

### Слухання подій

```javascript
window.addEventListener("wpsProgress", (event) => {
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

## Вимоги

-   Python 3.8+
-   pip
-   Oracle VirtualBox (для роботи з VM)
-   Kali Linux VM (назва за замовчуванням: "MAN")
-   Налаштоване SSH з'єднання (username: kali, password: kali)

## Переваги PyWebView над Flask

| Аспект          | PyWebView                                | Flask                         |
| --------------- | ---------------------------------------- | ----------------------------- |
| Архітектура     | Desktop app з вбудованим браузером       | Web server + external browser |
| Комунікація     | Прямі Python виклики через JS API bridge | HTTP REST API requests        |
| Латентність     | Миттєво (~0ms)                           | 10-50ms HTTP overhead         |
| Real-time події | CustomEvents (двосторонній зв'язок)      | WebSockets або polling        |
| Безпека         | Локальні виклики (без мережі)            | Потребує CORS, токени         |
| Розгортання     | Один exe файл                            | Server + client files         |
| Складність      | Простіша архітектура                     | Більше boilerplate коду       |

## Особливості реалізації

### 1. Асинхронна ініціалізація VM

VM підключення ініціалізується в окремому потоці при запуску:

```python
def init_vm_thread():
    try:
        vm_utils.init_vm()
    except Exception as e:
        print(f"Помилка ініціалізації VM: {e}")

init_thread = threading.Thread(target=init_vm_thread, daemon=True)
init_thread.start()
```

### 2. Прогрес операцій через події

Всі тривалі операції відправляють прогрес у реальному часі:

```python
def send_progress_event(self, event_name, data):
    """Відправити подію прогресу на фронтенд"""
    json_data = json.dumps(data)
    js_code = f"""
        window.dispatchEvent(new CustomEvent('{event_name}', {{ detail: {json_data} }}));
    """
    self.window.evaluate_js(js_code)
```

### 3. Динамічна навігація

Навігація реалізована через Jinja2 re-rendering:

```python
def navigate(self, page):
    """Змінити сторінку"""
    theme = self.settings_store.get('theme', 'dark')
    html = self.render_template(page=page, theme=theme)
    self.window.load_html(html)
```

### 4. Модульна frontend структура

Кожна сторінка має власний JS модуль з lifecycle методами:

```javascript
// Приклад структури модуля
export function init() {
	// Ініціалізація сторінки
}

export function cleanup() {
	// Очищення при виході
}
```

## Діаграма архітектури

Детальна діаграма архітектури доступна в файлі [architecture-diagram.md](architecture-diagram.md).

## Ліцензія

MIT

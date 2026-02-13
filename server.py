"""
PyWebView API клас для комунікації між JS та Python
"""
import time
import random
import json
import os
import threading
import lib.vm_utils as vm_utils
import lib.wps_utils as wps_utils
import lib.dict_utils as dict_utils
import lib.nmap_utils as nmap_utils
import lib.handshake_utils as handshake_utils


class Api:
    """API клас для PyWebView - замінює Flask endpoints"""

    def __init__(self, window=None, render_template_func=None):
        """Ініціалізація API класу"""
        self.window = window
        self.render_template = render_template_func

        # Запускаємо ініціалізацію VM в окремому потоці
        def init_vm_thread():
            try:
                vm_utils.init_vm()
            except Exception as e:
                print(f"Помилка ініціалізації VM: {e}")

        init_thread = threading.Thread(target=init_vm_thread, daemon=True)
        init_thread.start()

        # Сховище для налаштувань
        self.settings_store = {
            'theme': 'dark',
            'vm_cpu': 2,
            'vm_ram': 4,
        }

        # Завантажити налаштування з файлу, якщо він існує
        from lib.network_utils import get_local_path
        local_path = get_local_path()
        self.settings_file = os.path.join(local_path, 'settings.json')
        if os.path.exists(self.settings_file):
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    self.settings_store.update(json.load(f))
            except:
                pass

        # Подію завантаження налаштувань буде відправлено після створення вікна

    def _save_settings(self):
        """Зберегти налаштування у файл"""
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings_store, f, ensure_ascii=False, indent=2)
        except:
            pass

    def send_progress_event(self, event_name, data):
        """Відправити подію прогресу на фронтенд"""
        self.dispatch_event(event_name, data)

    def dispatch_event(self, event_name, data):
        """
        Створюємо стандартну JS подію CustomEvent
        і передаємо дані через властивість 'detail' для безпечного виконання в JS.
        """
        if not self.window:
            # Вікно ще не створено, пропускаємо подію
            return

        try:
            json_data = json.dumps(data)
            js_code = f"""
                window.dispatchEvent(new CustomEvent('{event_name}', {{ detail: {json_data} }}));
            """
            self.window.evaluate_js(js_code)
        except Exception as e:
            print(f"Помилка відправки події: {e}")

    def notify_settings_loaded(self):
        """Відправити подію завантаження налаштувань після створення вікна"""
        def dispatch_after_delay():
            # Невелика затримка, щоб переконатися, що вікно повністю завантажено
            time.sleep(0.1)
            self.dispatch_event('settings-loaded', {'success': True, 'message': 'Налаштування завантажені'})

        thread = threading.Thread(target=dispatch_after_delay, daemon=True)
        thread.start()

    # Статус VM
    def get_vm_status(self):
        """Статус підключення віртуальної машини"""
        try:
            status = vm_utils.get_status_vm(timeout=3)
            return status
        except Exception as e:
            return {
                'success': False,
                'connected': False,
                'status': 'error',
                'ip': None,
                'message': 'Помилка перевірки статусу'
            }

    # Сканування мереж
    def parse_network_string(self, network_str):
        """Парсинг рядка мережі у структурований формат

        Формат вхідного рядка: 'BSSID    CH  SIG  WPS  Lck  Vendor  SSID'
        Приклад: '50:D4:F7:75:5D:E1    1  -68  2.0  No   RalinkTe  TP-Link_5DE1'
        Приклад: '50:FF:20:FE:65:41    4  -92  2.0  Yes            She_is'
        """
        if not network_str or not network_str.strip():
            return None

        # Розділяємо рядок на частини, фільтруючи порожні значення
        parts = [p for p in network_str.split() if p]

        if len(parts) < 7:
            # Недостатньо даних для парсингу
            return None

        try:
            bssid = parts[0]
            channel = int(parts[1])
            signal = int(parts[2])
            wps_version = parts[3]
            lock = parts[4]
            vendor = parts[5]
            # SSID може містити пробіли, тому беремо все що залишилось
            ssid = ' '.join(parts[6:]) if len(parts) > 6 else ''

            # Визначаємо чи є WPS (якщо wps_version не порожній і не 'No')
            has_wps = wps_version and wps_version.lower() not in ['no', 'none', '']

            # Оскільки ми не маємо точної інформації про encryption, встановлюємо за замовчуванням
            encryption = ''

            return {
                'ssid': ssid,
                'bssid': bssid,
                'encryption': encryption,
                'wps': has_wps,
                'wps_version': wps_version,
                'signal': signal,
                'channel': channel
            }
        except (ValueError, IndexError) as e:
            print(f"Помилка парсингу мережі '{network_str}': {e}")
            return None

    def scan_networks(self):
        """Сканування доступних мереж"""
        networks = wps_utils.wps_wifi_scan(api=self)

        return {
            'success': True,
            'networks': networks,
            'count': len(networks)
        }

    # WPS тестування
    def wps_test(self, network, command='reaver -i wlan0 -b {bssid} -vv'):
        """Запуск WPS тестування з прогресом"""

        print(network, command)
        result = wps_utils.wps_check(api=self, network=network, command=command)

        return {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'timeout': result.get('timeout', False)
        }

    # Отримати список файлів handshake
    def get_handshake_files(self):
        """Отримати список файлів handshake з локальної папки"""
        try:
            from lib.config import config
            from lib.network_utils import get_local_path

            local_path = get_local_path()
            handshake_folder = os.path.join(local_path, config.get("handshake_folder"))

            files = []
            if os.path.exists(handshake_folder):
                for file in os.listdir(handshake_folder):
                    if file.endswith(('.cap', '.hccapx', '.pcap', 'hc22000')):
                        files.append(file)

            return {
                'success': True,
                'files': files,
                'count': len(files)
            }
        except Exception as e:
            return {
                'success': False,
                'files': [],
                'count': 0,
                'message': str(e)
            }

    # Отримати список файлів словників
    def get_dictionary_files(self):
        """Отримати список файлів словників з локальної папки"""
        try:
            from lib.config import config
            from lib.network_utils import get_local_path

            local_path = get_local_path()
            dict_folder = os.path.join(local_path, config.get("dict_folder"))

            files = []
            if os.path.exists(dict_folder):
                for file in os.listdir(dict_folder):
                    if file.endswith(('.txt', '.lst', '.dic')):
                        files.append(file)

            return {
                'success': True,
                'files': files,
                'count': len(files)
            }
        except Exception as e:
            return {
                'success': False,
                'files': [],
                'count': 0,
                'message': str(e)
            }

    # Handshake сканування мереж
    def handshake_scan_networks(self):
        """Сканування WiFi мереж для перехоплення handshake (через airodump-ng)"""
        networks = handshake_utils.handshake_wifi_scan(api=self)

        return {
            'success': True,
            'networks': networks,
            'count': len(networks)
        }

    # Handshake перехоплення
    def capture_handshake(self, network, method='deauth', packets_per_sec=10, duration=70):
        """Перехоплення handshake з прогресом"""
        result = handshake_utils.handshake_capture(
            api=self,
            network=network,
            method=method,
            packets_per_sec=packets_per_sec,
            duration=duration
        )
        return result

    # Handshake розшифрування - Brute Force
    def decrypt_bruteforce(self, handshake_file, password_length=8, use_lowercase=False,
                           use_uppercase=False, use_digits=True, use_special=False, command=''):
        """Brute force розшифрування handshake з прогресом"""
        result = handshake_utils.handshake_decrypt_bruteforce(
            api=self,
            handshake_file=handshake_file,
            password_length=password_length,
            use_lowercase=use_lowercase,
            use_uppercase=use_uppercase,
            use_digits=use_digits,
            use_special=use_special
        )
        return result

    # Handshake розшифрування - Dictionary
    def decrypt_dictionary(self, handshake_file, dictionary_file='rockyou.txt'):
        """Dictionary розшифрування handshake з прогресом"""
        result = handshake_utils.handshake_decrypt_dictionary(
            api=self,
            handshake_file=handshake_file,
            dict_file=dictionary_file
        )
        return result

    # Nmap сканування
    def nmap_scan(self, ports='standard', target='192.168.1.0/24', timing='3',
                  active_scan=False, version_detection=True, os_detection=False, verbose=False):
        """Nmap сканування портів з прогресом

        Args:
            ports: 'standard', '-' (всі), або конкретні порти (напр. '80,443,22')
            target: IP адреса або підмережа (напр. '192.168.1.0/24')
            timing: Агресивність від '0' до '5'
            active_scan: Чи використовувати -A (активне сканування)
            version_detection: Чи використовувати -sV (визначення версій)
            os_detection: Чи використовувати -O (визначення ОС)
            verbose: Чи використовувати -v (детальний вивід)
        """
        return nmap_utils.nmap_scan(
            api=self,
            ports=ports,
            target=target,
            timing=timing,
            active_scan=active_scan,
            version_detection=version_detection,
            os_detection=os_detection,
            verbose=verbose
        )

    # Cupp генерація
    def cupp_generate(self, data):
        """Генерація wordlist через Cupp"""
        # Тестовий результат
        result = dict_utils.generate_dictionary(api=self, fields=data)

        return {
            'success': result['success'],
            'message': result['message'],
            'count': result['count'],
            'file': result['file']
        }

    # Налаштування
    def get_settings(self):
        """Отримати налаштування"""
        return {
            'success': True,
            'settings': self.settings_store
        }

    def update_settings(self, data):
        """Оновити налаштування"""
        if 'theme' in data:
            self.settings_store['theme'] = data['theme']

        vm_resources_updated = False
        if 'vm_cpu' in data:
            self.settings_store['vm_cpu'] = int(data['vm_cpu'])
            vm_resources_updated = True
        if 'vm_ram' in data:
            self.settings_store['vm_ram'] = int(data['vm_ram'])
            vm_resources_updated = True

        # Оновити ресурси VM, якщо змінилися CPU або RAM
        if vm_resources_updated:
            try:
                from lib.config import config
                vm_name = config.get("vm_name")
                cpu = self.settings_store.get('vm_cpu', 2)
                ram = self.settings_store.get('vm_ram', 4)

                result = vm_utils.set_resources(vm_name, cpu, ram)
                if not result.get('success', False):
                    print(f"Попередження: {result.get('message', 'Невідома помилка')}")
            except Exception as e:
                print(f"Помилка оновлення ресурсів VM: {e}")

        self._save_settings()

        return {
            'success': True,
            'settings': self.settings_store
        }

    # ========== Auto Testing ==========

    def auto_scan_networks(self):
        """
        Комбіноване сканування мереж для автотестування.
        Об'єднує результати WPS та Handshake сканування.
        """
        self.dispatch_event('message', {'message': '[Auto]: Починаємо комбіноване сканування...', 'type': 'info'})
        self.dispatch_event('auto-scan-progress', {'phase': 'wps', 'progress': 0, 'status': 'starting'})

        combined_networks = {}

        try:
            # Крок 1: WPS сканування (дає інформацію про WPS)
            self.dispatch_event('message', {'message': '[Auto]: Запускаємо WPS сканування...', 'type': 'info'})
            self.dispatch_event('auto-scan-progress', {'phase': 'wps', 'progress': 10, 'status': 'scanning'})

            wps_networks = wps_utils.wps_wifi_scan(api=self)

            self.dispatch_event('auto-scan-progress', {'phase': 'wps', 'progress': 50, 'status': 'complete'})

            # Додати WPS мережі до combined_networks
            for network in wps_networks:
                bssid = network.get('bssid', '').upper()
                if bssid:
                    combined_networks[bssid] = {
                        'ssid': network.get('ssid', ''),
                        'bssid': bssid,
                        'channel': network.get('channel', 0),
                        'signal': network.get('signal', -100),
                        'encryption': network.get('encryption', ''),
                        'cipher': '',
                        'has_wps': network.get('wps', False),
                        'wps_version': network.get('wps_version', ''),
                        'wps_locked': network.get('wps_locked', False)
                    }

            # Крок 2: Handshake сканування (дає інформацію про шифрування)
            self.dispatch_event('message', {'message': '[Auto]: Запускаємо Handshake сканування...', 'type': 'info'})
            self.dispatch_event('auto-scan-progress', {'phase': 'handshake', 'progress': 60, 'status': 'scanning'})

            handshake_networks = handshake_utils.handshake_wifi_scan(api=self)

            self.dispatch_event('auto-scan-progress', {'phase': 'handshake', 'progress': 90, 'status': 'complete'})

            # Об'єднати з handshake даними
            for network in handshake_networks:
                bssid = network.get('bssid', '').upper()
                if bssid:
                    if bssid in combined_networks:
                        # Оновити існуючу мережу даними про шифрування
                        combined_networks[bssid]['encryption'] = network.get('encryption', combined_networks[bssid]['encryption'])
                        combined_networks[bssid]['cipher'] = network.get('cipher', '')
                        # Взяти сильніший сигнал
                        new_signal = network.get('signal', -100)
                        if new_signal > combined_networks[bssid]['signal']:
                            combined_networks[bssid]['signal'] = new_signal
                    else:
                        # Додати нову мережу (без WPS)
                        combined_networks[bssid] = {
                            'ssid': network.get('ssid', ''),
                            'bssid': bssid,
                            'channel': network.get('channel', 0),
                            'signal': network.get('signal', -100),
                            'encryption': network.get('encryption', ''),
                            'cipher': network.get('cipher', ''),
                            'has_wps': False,
                            'wps_version': '',
                            'wps_locked': False
                        }

            # Перетворити на список
            networks_list = list(combined_networks.values())

            # Відсортувати за сигналом (найсильніші спочатку)
            networks_list.sort(key=lambda x: x.get('signal', -100), reverse=True)

            self.dispatch_event('auto-scan-progress', {'phase': 'complete', 'progress': 100, 'status': 'complete'})
            self.dispatch_event('message', {'message': f'[Auto]: Сканування завершено. Знайдено {len(networks_list)} мереж.', 'type': 'success'})

            return {
                'success': True,
                'networks': networks_list,
                'count': len(networks_list),
                'wps_count': sum(1 for n in networks_list if n.get('has_wps', False))
            }

        except Exception as e:
            print(f"Помилка auto_scan_networks: {e}")
            self.dispatch_event('message', {'message': f'[Auto]: Помилка сканування: {e}', 'type': 'error'})
            return {
                'success': False,
                'networks': [],
                'count': 0,
                'wps_count': 0,
                'message': str(e)
            }

    def auto_test_network(self, network):
        """
        Автоматичне тестування безпеки мережі.
        Виконує послідовно: WPS Pixie Dust (якщо є WPS) -> Handshake capture -> Dictionary attack

        Args:
            network: Об'єкт мережі з bssid, channel, ssid, has_wps

        Returns:
            dict з результатами всіх тестів
        """
        results = {
            'success': True,
            'network': network,
            'wps_tested': False,
            'wps_vulnerable': False,
            'wps_pin': None,
            'wps_password': None,
            'handshake_captured': False,
            'handshake_file': None,
            'dictionary_tested': False,
            'password_cracked': False,
            'cracked_password': None,
            'recommendations': []
        }

        bssid = network.get('bssid', '')
        ssid = network.get('ssid', 'Unknown')
        has_wps = network.get('has_wps', False)

        self.dispatch_event('message', {'message': f'[Auto]: Починаємо тестування мережі {ssid}...', 'type': 'info'})

        try:
            # ========== Крок 1: WPS Pixie Dust (якщо є WPS) ==========
            if has_wps:
                self.dispatch_event('auto-test-progress', {
                    'phase': 'wps',
                    'progress': 0,
                    'status': 'starting',
                    'message': 'Запуск WPS Pixie Dust атаки...'
                })
                self.dispatch_event('message', {'message': '[Auto]: Тестування WPS Pixie Dust...', 'type': 'info'})

                results['wps_tested'] = True

                # Формуємо команду для reaver з Pixie Dust
                wps_command = f'sudo -S reaver -i wlan0mon -b {bssid} -vvv -K 1'

                try:
                    wps_result = wps_utils.wps_check(api=self, network=network, command=wps_command)

                    if wps_result.get('success', False):
                        results['wps_vulnerable'] = True
                        results['recommendations'].append('WPS вразливість: Вимкніть WPS на роутері для підвищення безпеки.')
                        self.dispatch_event('message', {'message': '[Auto]: WPS вразливість знайдена!', 'type': 'success'})
                    else:
                        self.dispatch_event('message', {'message': '[Auto]: WPS атака не вдалася або мережа захищена.', 'type': 'info'})

                except Exception as wps_error:
                    print(f"WPS test error: {wps_error}")
                    self.dispatch_event('message', {'message': f'[Auto]: Помилка WPS тесту: {wps_error}', 'type': 'warning'})

                self.dispatch_event('auto-test-progress', {
                    'phase': 'wps',
                    'progress': 100,
                    'status': 'complete',
                    'message': 'WPS тестування завершено'
                })
            else:
                self.dispatch_event('message', {'message': '[Auto]: WPS не підтримується, пропускаємо...', 'type': 'info'})

            # ========== Крок 2: Handshake Capture ==========
            self.dispatch_event('auto-test-progress', {
                'phase': 'capture',
                'progress': 0,
                'status': 'starting',
                'message': 'Запуск перехоплення handshake...'
            })
            self.dispatch_event('message', {'message': '[Auto]: Перехоплення Handshake...', 'type': 'info'})

            try:
                capture_result = handshake_utils.handshake_capture(
                    api=self,
                    network=network,
                    method='deauth',
                    packets_per_sec=10,
                    duration=70
                )

                if capture_result.get('captured', False):
                    results['handshake_captured'] = True
                    results['handshake_file'] = capture_result.get('file')
                    self.dispatch_event('message', {'message': '[Auto]: Handshake успішно перехоплено!', 'type': 'success'})
                else:
                    self.dispatch_event('message', {'message': '[Auto]: Не вдалося перехопити handshake.', 'type': 'warning'})

            except Exception as capture_error:
                print(f"Handshake capture error: {capture_error}")
                self.dispatch_event('message', {'message': f'[Auto]: Помилка перехоплення: {capture_error}', 'type': 'error'})

            self.dispatch_event('auto-test-progress', {
                'phase': 'capture',
                'progress': 100,
                'status': 'complete',
                'message': 'Перехоплення завершено'
            })

            # ========== Крок 3: Dictionary Attack ==========
            if results['handshake_captured'] and results['handshake_file']:
                self.dispatch_event('auto-test-progress', {
                    'phase': 'dictionary',
                    'progress': 0,
                    'status': 'starting',
                    'message': 'Запуск атаки по словнику...'
                })
                self.dispatch_event('message', {'message': '[Auto]: Атака по словнику (probable-v2-wpa-top4800.txt)...', 'type': 'info'})

                results['dictionary_tested'] = True

                try:
                    decrypt_result = handshake_utils.handshake_decrypt_dictionary(
                        api=self,
                        handshake_file=results['handshake_file'],
                        dict_file='probable-v2-wpa-top4800.txt'
                    )

                    if decrypt_result.get('cracked', False):
                        results['password_cracked'] = True
                        results['cracked_password'] = decrypt_result.get('password')
                        results['recommendations'].append('Слабкий пароль: Змініть пароль на більш складний (мінімум 12 символів, різні регістри, цифри, спецсимволи).')
                        self.dispatch_event('message', {'message': '[Auto]: Пароль знайдено у словнику!', 'type': 'success'})
                    else:
                        self.dispatch_event('message', {'message': '[Auto]: Пароль не знайдено у словнику. Мережа захищена від базових атак.', 'type': 'info'})

                except Exception as decrypt_error:
                    print(f"Dictionary attack error: {decrypt_error}")
                    self.dispatch_event('message', {'message': f'[Auto]: Помилка атаки по словнику: {decrypt_error}', 'type': 'error'})

                self.dispatch_event('auto-test-progress', {
                    'phase': 'dictionary',
                    'progress': 100,
                    'status': 'complete',
                    'message': 'Атака по словнику завершена'
                })
            else:
                self.dispatch_event('message', {'message': '[Auto]: Пропускаємо атаку по словнику (немає handshake).', 'type': 'info'})

            # ========== Генерація рекомендацій ==========
            encryption = network.get('encryption', '').upper()
            if 'WPA3' not in encryption and encryption:
                results['recommendations'].append(f'Застарілий протокол ({encryption}): Оновіть до WPA3 для кращого захисту.')

            if not results['recommendations']:
                results['recommendations'].append('Мережа показала хороший рівень захисту від базових атак.')

            # ========== Завершення ==========
            self.dispatch_event('auto-test-progress', {
                'phase': 'complete',
                'progress': 100,
                'status': 'complete',
                'message': 'Тестування завершено'
            })
            self.dispatch_event('message', {'message': f'[Auto]: Тестування мережі {ssid} завершено!', 'type': 'success'})

            self.dispatch_event('auto-test-complete', results)

        except Exception as e:
            print(f"Auto test error: {e}")
            results['success'] = False
            results['message'] = str(e)
            self.dispatch_event('message', {'message': f'[Auto]: Критична помилка: {e}', 'type': 'error'})

        return results

    # Навігація
    def navigate(self, page):
        """Змінити сторінку (викликається з JS)"""
        if not self.window or not self.render_template:
            return {
                'success': False,
                'message': 'Window або render_template не встановлено'
            }

        try:
            # Отримуємо поточну тему
            theme = self.settings_store.get('theme', 'dark')

            # Рендеримо новий HTML
            html = self.render_template(page=page, theme=theme)

            # Завантажуємо новий HTML у вікно
            self.window.load_html(html)

            return {
                'success': True,
                'page': page
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Помилка навігації: {str(e)}'
            }

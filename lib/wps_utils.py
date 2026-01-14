from lib.config import config
import paramiko
import time
import re
from lib.network_utils import get_networks_correct_form, mask_value

username = config.get("username")
password = config.get("password")

# Сканування Wi-Fi мереж
def wps_wifi_scan(api):
    api.dispatch_event('message', {'message': '[WPS]: Починаємо роботу...', 'type': 'info'})
    networks = []

    host = config.get("host")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(host, username=username, password=password)

        api.dispatch_event('message', {'message': '[WPS]: Переводимо wlan0 в режим моніторингу...', 'type': 'info'})

        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S airmon-ng start wlan0', get_pty=True)
        time.sleep(5)

        output_wlan0 = stdout.read().decode()
        errors_wlan0 = stderr.read().decode()
        print(f"Результат виконання команди 'sudo airmon-ng start wlan0':\n{output_wlan0}")
        
        if errors_wlan0:
            print(f"Помилка: {errors_wlan0}")

        print("Запускаємо wash для пошуку WPS точок...")
        api.dispatch_event('message', {'message': '[WPS]: Запускаємо wash для пошуку WPS точок...', 'type': 'info'})

        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S wash -i wlan0mon', get_pty=True)
        stdout.channel.settimeout(30)

        start_time = time.time()
        max_duration = 300

        while True:
            try:
                output = stdout.readline()
                if output == '' and stdout.channel.exit_status_ready():
                    break
                if output:
                    print(output.strip())
                    network = output.strip()
                    if (network and not "BSSID" in network and not "skipping..." in network and 
                        not "--------------------------------------------------------------------------------" in network):
                        parsed_network = api.parse_network_string(network)
                        if parsed_network:
                            networks.append(parsed_network)
                            api.dispatch_event('message', {'message': f'[WPS]: Знайдено мережу: {network}', 'type': 'info'})
                            api.dispatch_event('network-found', {'network': parsed_network, 'count': get_networks_correct_form(len(networks)), 'scan_type': 'wps'})
                        else:
                            api.dispatch_event('message', {'message': f'[WPS]: Не вдалося розпарсити мережу: {network}', 'type': 'error'})
                
                if time.time() - start_time > max_duration:
                    print("\nМаксимальний час сканування завершився.")
                    api.dispatch_event('message', {'message': '[WPS]: Максимальний час сканування завершився.', 'type': 'info'})
                    break
            except Exception as e:
                print(f"Помилка при читанні: {e}")
                break

        print("\nДоступні мережі:")
        for i, network in enumerate(networks, 1):
            print(f"{i}. {network}")

    except Exception as e:
        api.dispatch_event('message', {'message': f'[WPS]: Виникла помилка: {e}', 'type': 'error'})
        print(f"Виникла помилка: {e}")

    finally:
        print("\nЗупинка моніторингового режиму...")
        api.dispatch_event('message', {'message': '[WPS]: Зупинка моніторингового режиму...', 'type': 'info'})

        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S airmon-ng stop wlan0mon', get_pty=True)
        stdout.channel.recv_exit_status()  # Очікування завершення команди
        output_stop = stdout.read().decode()
        errors_stop = stderr.read().decode()
        print(f"Результат зупинки моніторингового режиму:\n{output_stop}")
        if errors_stop:
            print(f"Помилка: {errors_stop}")

        ssh.close()
        print("Підключення до SSH закрито.")

    return networks


# WPS тестування
def wps_check(api, network, command):
    host = config.get("host")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    bssid = network['bssid']

    try:
        ssh.connect(host, username=username, password=password)

        print("Переводимо wlan0 в режим моніторингу...")
        api.dispatch_event('message', {'message': '[WPS]: Переводимо wlan0 в режим моніторингу...', 'type': 'info'})

        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S airmon-ng start wlan0', get_pty=True)
        time.sleep(5)

        print(f"Запускаємо reaver для мережі з BSSID: {bssid}")
        api.dispatch_event('message', {'message': f'[WPS]: Запускаємо reaver для мережі з BSSID: {bssid}', 'type': 'info'})

        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | {command}', get_pty=True)
        stdout.channel.settimeout(1)  # Неблокуюче читання з таймаутом 1 секунда

        attack_successful = False
        no_vulnerabilities = False
        timeout_reached = False
        extracted_data = "\n"

        start_time = time.time()
        max_duration = 300  # 5 minutes
        last_progress = 0
        
        # Відправити початкову подію прогресу
        api.dispatch_event('wps-progress', {
            'elapsed': 0,
            'total': max_duration,
            'percentage': 0
        })

        try:
            while True:
                elapsed = time.time() - start_time

                # Send progress every 5 seconds
                if elapsed - last_progress >= 5:
                    progress_percentage = (elapsed / max_duration) * 100
                    progress_data = {
                        'elapsed': int(elapsed),
                        'total': max_duration,
                        'percentage': min(progress_percentage, 100)
                    }
                    print(f"[WPS Progress] Elapsed: {int(elapsed)}s, Percentage: {min(progress_percentage, 100):.1f}%")
                    api.dispatch_event('wps-progress', progress_data)
                    last_progress = elapsed

                # Check timeout
                if elapsed > max_duration:
                    timeout_reached = True
                    print("\nМаксимальний час тестування (5 хвилини) завершився.")
                    api.dispatch_event('message', {'message': '[WPS]: Максимальний час тестування (5 хвилини) завершився.', 'type': 'info'})
                    ssh.exec_command(f'echo {password} | sudo -S killall reaver', get_pty=True)
                    break

                # Неблокуюче читання з таймаутом
                try:
                    # Перевірити чи є дані для читання
                    if stdout.channel.recv_ready():
                        output = stdout.readline()
                    else:
                        # Якщо немає даних, продовжити цикл для перевірки прогресу
                        time.sleep(0.5)
                        continue
                    
                    if output == '':
                        # Перевірити чи процес завершився
                        if stdout.channel.exit_status_ready():
                            break
                        # Якщо немає даних, продовжити цикл для перевірки прогресу
                        time.sleep(0.5)
                        continue
                    
                    print(output.strip())

                    if "Pixiewps: success" in output or ("WPS PIN" in output and "WPA PSK" in output):
                        attack_successful = True
                        # Send final progress update
                        api.dispatch_event('wps-progress', {
                            'elapsed': int(elapsed),
                            'total': max_duration,
                            'percentage': min((elapsed / max_duration) * 100, 100)
                        })
                        break
                    if "WPS pin not found!" in output:
                        no_vulnerabilities = True
                        # Send final progress update
                        api.dispatch_event('wps-progress', {
                            'elapsed': int(elapsed),
                            'total': max_duration,
                            'percentage': min((elapsed / max_duration) * 100, 100)
                        })
                        break

                    # Витягти WPS PIN
                    pin_match = re.search(r"WPS PIN: '([^']+)'", output)
                    wps_pin = pin_match.group(1) if pin_match else None
                    if wps_pin:
                        extracted_data += f"\nWPS PIN: {mask_value(wps_pin)}"
                    # Витягти WPA
                    psk_match = re.search(r"WPA PSK: '([^']+)'", output)
                    wpa_psk = psk_match.group(1) if psk_match else None
                    if wpa_psk:
                        extracted_data += f"\nWPA PSK: {mask_value(wpa_psk)}"
                except Exception as read_error:
                    # Таймаут при читанні - це нормально, продовжуємо цикл
                    if "timeout" in str(read_error).lower() or "timed out" in str(read_error).lower():
                        continue
                    # Інша помилка - виводимо і продовжуємо
                    print(f"Помилка читання: {read_error}")
                    time.sleep(0.5)
                    continue
        except KeyboardInterrupt:
            print("\nСкасування атаки користувачем...")
            api.dispatch_event('message', {'message': '[WPS]: Скасування атаки користувачем...', 'type': 'info'})
            ssh.exec_command(f'echo {password} | sudo -S killall reaver', get_pty=True)

        if attack_successful:
            attack_successful_text = "Ваша мережа вразлива до WPS Pixie Dust атаки.\nРадимо вам вимкнути WPS, щоб покращити свій захист."
            attack_successful_text += extracted_data
            print(f"\n{attack_successful_text}")
            api.dispatch_event('message', {'message': f'[WPS]: {attack_successful_text}', 'type': 'success'})
        elif timeout_reached:
            timeout_text = "Тестування завершено через досягнення максимального часу (5 хвилини). Мережа не показала вразливостей до WPS Pixie Dust атаки протягом цього періоду."
            print(f"\n{timeout_text}")
            api.dispatch_event('message', {'message': f'[WPS]: {timeout_text}', 'type': 'info'})
            return {
                'success': False,
                'message': timeout_text,
                'timeout': True
            }
        elif no_vulnerabilities:
            no_vulnerabilities_text = "Чудово! Ваша мережа не має вразливостей для WPS Pixie Dust атаки."
            print(f"\n{no_vulnerabilities_text}")
            api.dispatch_event('message', {'message': f'[WPS]: {no_vulnerabilities_text}', 'type': 'error'})

        return {
            'success': attack_successful,
            'message': attack_successful_text if attack_successful else (no_vulnerabilities_text if no_vulnerabilities else 'Тестування завершено')
        }    

    except Exception as e:
        print(f"Виникла помилка: {e}")
        api.dispatch_event('message', {'message': f'[WPS]: Виникла помилка: {e}', 'type': 'error'})

    finally:
        print("\nЗупинка моніторингового режиму...")
        api.dispatch_event('message', {'message': '[WPS]: Зупинка моніторингового режиму...', 'type': 'info'})

        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S airmon-ng stop wlan0mon', get_pty=True)
        stdout.channel.recv_exit_status()  # Очікування завершення команди
        output_stop = stdout.read().decode()
        errors_stop = stderr.read().decode()
        print(f"Результат зупинки моніторингового режиму:\n{output_stop}")
        if errors_stop:
            print(f"Помилка: {errors_stop}")

        ssh.close()
        print("Підключення до SSH закрито.")
 
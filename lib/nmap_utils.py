"""
Nmap scanning utilities for network port scanning
"""
import xml.etree.ElementTree as ET
import time
import socket
import paramiko
from lib.config import config


def build_nmap_command(ports='standard', target='192.168.1.0/24', timing='3',
                       active_scan=False, version_detection=True, os_detection=False, verbose=False):
    """Побудувати команду nmap на основі параметрів
    
    Args:
        ports: 'standard', '-' (всі), або конкретні порти (напр. '80,443,22')
        target: IP адреса або підмережа (напр. '192.168.1.0/24')
        timing: Агресивність від '0' до '5'
        active_scan: Чи використовувати -A (активне сканування)
        version_detection: Чи використовувати -sV (визначення версій)
        os_detection: Чи використовувати -O (визначення ОС)
        verbose: Чи використовувати -v (детальний вивід)
    
    Returns:
        str: Команда nmap для виконання
    """
    cmd_parts = ['nmap']
    
    # Використовуємо TCP connect scan (-sT) якщо не вказано інше
    # Це не вимагає root прав
    if not active_scan:
        cmd_parts.append('-sT')
    
    # Порти
    if ports == '-':
        cmd_parts.append('-p-')
    elif ports and ports != 'standard':
        cmd_parts.append(f'-p {ports}')
    
    # Timing
    if timing and timing != '3':
        cmd_parts.append(f'-T{timing}')
    
    # Активне сканування
    if active_scan:
        cmd_parts.append('-A')
    else:
        # Окремі опції якщо не активне сканування
        if version_detection:
            cmd_parts.append('-sV')
        if os_detection:
            cmd_parts.append('-O')
    
    # Verbose
    if verbose:
        cmd_parts.append('-v')
    
    # XML вивід для парсингу
    cmd_parts.append('-oX')
    cmd_parts.append('-')
    
    # Ціль
    cmd_parts.append(target)
    
    return cmd_parts


def parse_nmap_xml(xml_string):
    """Парсинг XML виводу nmap
    
    Args:
        xml_string: XML рядок від nmap
    
    Returns:
        dict: Структуровані дані про сканування
    """
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as e:
        return {
            'success': False,
            'error': f'Помилка парсингу XML: {e}',
            'open_ports': [],
            'os_detection': None
        }
    
    open_ports = []
    os_detection = None
    scan_time = 0
    
    # Отримуємо час сканування
    try:
        runstats = root.find('runstats')
        if runstats is not None:
            finished = runstats.find('finished')
            if finished is not None:
                elapsed = finished.get('elapsed', '0')
                scan_time = float(elapsed)
    except (ValueError, AttributeError):
        pass
    
    # Обробляємо кожен хост
    for host in root.findall('host'):
        # Отримуємо інформацію про ОС
        if os_detection is None:
            os_elem = host.find('os')
            if os_elem is not None:
                os_matches = os_elem.findall('osmatch')
                if os_matches:
                    # Беремо найбільш ймовірну ОС
                    best_match = max(os_matches, key=lambda x: float(x.get('accuracy', '0')))
                    os_detection = f"{best_match.get('name', 'Unknown')} ({best_match.get('accuracy', '0')}%)"
        
        # Обробляємо порти
        ports_elem = host.find('ports')
        if ports_elem is not None:
            for port in ports_elem.findall('port'):
                port_id = port.get('portid')
                state = port.find('state')
                service = port.find('service')
                
                if state is not None and state.get('state') == 'open':
                    port_info = {
                        'port': int(port_id) if port_id else 0,
                        'state': 'open',
                        'service': 'unknown',
                        'version': ''
                    }
                    
                    if service is not None:
                        port_info['service'] = service.get('name', 'unknown')
                        version = service.get('product', '')
                        if version:
                            version_info = version
                            if service.get('version'):
                                version_info += f" {service.get('version')}"
                            if service.get('extrainfo'):
                                version_info += f" ({service.get('extrainfo')})"
                            port_info['version'] = version_info
                    
                    open_ports.append(port_info)
    
    return {
        'success': True,
        'open_ports': open_ports,
        'os_detection': os_detection,
        'scan_time': scan_time
    }


def nmap_scan(api, ports='standard', target='192.168.1.0/24', timing='3',
              active_scan=False, version_detection=True, os_detection=False, verbose=False):
    """Nmap сканування портів з прогресом (виконується на VM через SSH)
    
    Args:
        api: API об'єкт для відправки подій прогресу
        ports: 'standard', '-' (всі), або конкретні порти (напр. '80,443,22')
        target: IP адреса або підмережа (напр. '192.168.1.0/24')
        timing: Агресивність від '0' до '5'
        active_scan: Чи використовувати -A (активне сканування)
        version_detection: Чи використовувати -sV (визначення версій)
        os_detection: Чи використовувати -O (визначення ОС)
        verbose: Чи використовувати -v (детальний вивід)
    
    Returns:
        dict: Результати сканування
    """
    # Отримуємо параметри підключення до VM
    host = config.get("host")
    username = config.get("username")
    password = config.get("password")
    
    command_parts = build_nmap_command(ports, target, timing, active_scan,
                                       version_detection, os_detection, verbose)
    command = ' '.join(command_parts)
    
    # Визначаємо очікуваний час сканування для прогресу
    estimated_time = 30
    if ports == '-':
        estimated_time = 300
    elif active_scan:
        estimated_time = 60
    
    start_time = time.time()
    xml_output = ''
    stderr_output = ''
    ssh = None
    
    try:
        # Підключаємося до VM
        api.dispatch_event('nmapProgress', {
            'progress': 0,
            'status': 'Підключення до VM...'
        })
        
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password)
        
        api.dispatch_event('nmapProgress', {
            'progress': 5,
            'status': 'Початок сканування на VM...'
        })
        
        # Виконуємо nmap з sudo на VM
        stdin, stdout, stderr = ssh.exec_command(
            f'echo {password} | sudo -S {command}',
            get_pty=True
        )
        stdout.channel.settimeout(1)
        
        # Читаємо вивід в реальному часі
        last_progress_update = 0
        output_buffer = ''
        
        while True:
            elapsed = time.time() - start_time
            
            # Оновлюємо прогрес кожні 2 секунди
            if elapsed - last_progress_update >= 2:
                progress = min((elapsed / estimated_time) * 85 + 5, 90)
                api.dispatch_event('nmapProgress', {
                    'progress': progress,
                    'status': f'Сканування на VM... ({int(elapsed)}с)'
                })
                last_progress_update = elapsed
            
            # Читаємо дані з stdout
            try:
                chunk = stdout.read(4096)
                if chunk:
                    output_buffer += chunk.decode('utf-8', errors='ignore')
            except socket.timeout:
                pass
            
            # Перевіряємо чи процес завершився
            if stdout.channel.exit_status_ready():
                # Дочитуємо залишок
                try:
                    remaining = stdout.read()
                    if remaining:
                        output_buffer += remaining.decode('utf-8', errors='ignore')
                except Exception:
                    pass
                break
            
            time.sleep(0.5)
        
        # Отримуємо код виходу
        return_code = stdout.channel.recv_exit_status()
        
        # Читаємо stderr
        try:
            stderr_output = stderr.read().decode('utf-8', errors='ignore')
        except Exception:
            stderr_output = ''
        
        # Видаляємо sudo prompt з виводу та отримуємо XML
        xml_output = output_buffer
        # Видаляємо рядок з паролем sudo якщо є
        if '[sudo]' in xml_output:
            lines = xml_output.split('\n')
            xml_output = '\n'.join(line for line in lines if '[sudo]' not in line and 'Password:' not in line)
        
        # Знаходимо початок XML
        xml_start = xml_output.find('<?xml')
        if xml_start != -1:
            xml_output = xml_output[xml_start:]
        
        if return_code != 0 and not xml_output.strip():
            error_msg = stderr_output or 'Невідома помилка nmap на VM'
            api.dispatch_event('nmapProgress', {
                'progress': 100,
                'status': f'Помилка: {error_msg[:100]}'
            })
            return {
                'success': False,
                'target': target,
                'ports': ports if ports != '-' else 'all (1-65535)',
                'open_ports': [],
                'scan_time': time.time() - start_time,
                'command': f'[VM] {command}',
                'error': error_msg
            }
        
        # Парсимо XML
        api.dispatch_event('nmapProgress', {
            'progress': 95,
            'status': 'Обробка результатів...'
        })
        
        parsed_data = parse_nmap_xml(xml_output)
        
        if not parsed_data.get('success'):
            return {
                'success': False,
                'target': target,
                'ports': ports if ports != '-' else 'all (1-65535)',
                'open_ports': [],
                'scan_time': time.time() - start_time,
                'command': f'[VM] {command}',
                'error': parsed_data.get('error', 'Помилка парсингу')
            }
        
        # Формуємо результат
        result = {
            'success': True,
            'target': target,
            'ports': ports if ports != '-' else 'all (1-65535)',
            'open_ports': parsed_data['open_ports'],
            'scan_time': int(parsed_data.get('scan_time', time.time() - start_time)),
            'command': f'[VM] {command}'
        }
        
        # Додаємо інформацію про ОС якщо є
        if parsed_data.get('os_detection'):
            result['os_detection'] = parsed_data['os_detection']
        
        # Додаємо сирий вивід для відображення
        if verbose:
            result['raw_output'] = stderr_output[:5000] if stderr_output else ''
        else:
            result['raw_output'] = xml_output[:5000] if xml_output else ''
        
        api.dispatch_event('nmapProgress', {
            'progress': 100,
            'status': 'Сканування завершено'
        })
        
        return result
        
    except paramiko.AuthenticationException:
        error_msg = 'Помилка автентифікації SSH. Перевірте логін/пароль.'
        api.dispatch_event('nmapProgress', {
            'progress': 100,
            'status': error_msg
        })
        return {
            'success': False,
            'target': target,
            'ports': ports if ports != '-' else 'all (1-65535)',
            'open_ports': [],
            'scan_time': 0,
            'command': f'[VM] {command}',
            'error': error_msg
        }
    except paramiko.SSHException as e:
        error_msg = f'Помилка SSH підключення: {str(e)}'
        api.dispatch_event('nmapProgress', {
            'progress': 100,
            'status': error_msg
        })
        return {
            'success': False,
            'target': target,
            'ports': ports if ports != '-' else 'all (1-65535)',
            'open_ports': [],
            'scan_time': 0,
            'command': f'[VM] {command}',
            'error': error_msg
        }
    except socket.error as e:
        error_msg = f'Не вдалося підключитися до VM: {str(e)}'
        api.dispatch_event('nmapProgress', {
            'progress': 100,
            'status': error_msg
        })
        return {
            'success': False,
            'target': target,
            'ports': ports if ports != '-' else 'all (1-65535)',
            'open_ports': [],
            'scan_time': 0,
            'command': f'[VM] {command}',
            'error': error_msg
        }
    except Exception as e:
        error_msg = f'Помилка виконання nmap на VM: {str(e)}'
        api.dispatch_event('nmapProgress', {
            'progress': 100,
            'status': error_msg
        })
        return {
            'success': False,
            'target': target,
            'ports': ports if ports != '-' else 'all (1-65535)',
            'open_ports': [],
            'scan_time': time.time() - start_time if 'start_time' in locals() else 0,
            'command': f'[VM] {command}',
            'error': error_msg
        }
    finally:
        # Закриваємо SSH з'єднання
        if ssh:
            try:
                ssh.close()
            except Exception:
                pass
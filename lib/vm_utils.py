import subprocess
import time
import paramiko
import socket
from lib.config import config

# Параметри підключення SSH
vm_name = config.get("vm_name")

# Запуск віртуальної машини
def start_vm():
    try:
        subprocess.run(["C:/Program Files/Oracle/VirtualBox/VBoxManage", "startvm", vm_name, "--type", "headless"])
        print(f"VM '{vm_name}' started.")
    except subprocess.CalledProcessError:
        print(f"Не вдалося запустити VM '{vm_name}'.")


# Вимкнення віртуальної машини
def shutdown_vm():
    try:
        subprocess.run(["C:/Program Files/Oracle/VirtualBox/VBoxManage", "controlvm", vm_name, "poweroff"])
        print(f"VM '{vm_name}' is powered off.")
    except Exception:
        print(f"Не вдалося вимкнути VM '{vm_name}'.")


# Отримання IP через guestproperty
def get_ip_from_guestproperty():
    # print(f"Отримання IP через guestproperty для VM '{vm_name}'...")

    try:
        output = subprocess.check_output(
            ["C:/Program Files/Oracle/VirtualBox/VBoxManage", "guestproperty", "get", vm_name,
             "/VirtualBox/GuestInfo/Net/0/V4/IP"],
            universal_newlines=True
        )
        if "Value" in output:
            ip = output.split()[-1]
            if ip != "null":
                return ip
        else:
            return None
    except subprocess.CalledProcessError:
        print("Не вдалося отримати IP через guestproperty.")
        
    return None


# Перевірка статусу віртуальної машини
def get_status_vm(timeout=3):
    # print("🔍 Перевірка доступності VM через SSH...")

    host = get_ip_from_guestproperty()
    port = config.get("port")
    username = config.get("username")
    password = config.get("password")

    if not host:
        print("🔴 Не вдалося отримати IP")
        return {
            'success': True,
            'connected': False,
            'status': 'offline',
            'ip': None,
            'message': 'Не вдалося отримати IP адресу'
        }

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=host,
            port=port,
            username=username,
            password=password,
            timeout=timeout,
            banner_timeout=timeout,
            auth_timeout=timeout
        )
        client.close()

        # print("🟢 VM ONLINE (SSH доступний)")
        return {
            'success': True,
            'connected': True,
            'status': 'online',
            'ip': host,
            'message': f'Підключена, IP: {host}'
        }

    except socket.timeout:
        # print("🔴 VM OFFLINE — таймаут підключення")
        return {
            'success': True,
            'connected': False,
            'status': 'offline',
            'ip': None,
            'message': 'Вимкнена'
        }

    except Exception as e:
        print(f"🔴 SSH помилка: {e}")
        return {
            'success': False,
            'connected': False,
            'status': 'error',
            'ip': None,
            'message': 'Не вдалося підключитися'
        }


# Ініціалізація віртуальної машини
def init_vm():
    try:
        status = get_status_vm()
        if not status['connected']:
            start_vm()
    except Exception as e:
        print(f"Не вдалося ініціалізувати VM: {e}")
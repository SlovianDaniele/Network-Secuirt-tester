from tkinter import messagebox
import subprocess
import os
import re
from lib.ssh_utils import move_file
from lib.config import config
from lib.network_utils import get_local_path

local_path = get_local_path()
local_dict_path = os.path.join(local_path, config.get("dict_folder"))


def generate_dictionary(api, fields):
    """Генерація словника Cupp"""

    api.dispatch_event('message', {'message': '[Dict] Генерація словника Cupp...', 'type': 'info'})
    if not fields["name"] or not fields["surname"]:
        print(f"[Dict] Ім'я та прізвище обов'язкові поля.")
        api.dispatch_event('message', {'message': "[Dict] Ім'я та прізвище обов'язкові поля.", 'type': 'error'})
        return

    if fields["special_chars"]:    
        special_chars = "y"
    else:
        special_chars = "n"

    # Інтерактивний ввід для Cupp
    interactive_input = (
        f"{fields['name']}\n{fields['surname']}\n{fields['nick']}\n{fields['birthdate']}\n"
        f"{fields['wife']}\n{fields['wifen']}\n{fields['wifeb']}\n"
        f"{fields['kid']}\n{fields['kidn']}\n{fields['kidb']}\n"
        f"{fields['pet']}\n{fields['company']}\n"
        f"{'y'}\n{fields['words']}\n{special_chars}\n{'n'}\n{'n'}\n{'n'}\n"
    )

    try:
        process = subprocess.run(
            ["python", os.path.join(local_path, "cupp.py"), "-i"],
            input=interactive_input,
            text=True,
            capture_output=True,
            check=True,
        )

        print(process.stdout)   

        word_count = 0
        # Потрібно видалити ANSI escape codes (color formatting) з виводу, щоб отримати чисту кількість слів
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        clean_output = ansi_escape.sub('', process.stdout)
        match = re.search(r"counting\s+([0-9]+)\s+word", clean_output, re.IGNORECASE)
        print(f"[Dict] match: {match}")
        if match:
            word_count = int(match.group(1))
        
        if word_count:
            print(f"[Dict] Словник успішно згенеровано! Кількість слів: {word_count}")
            api.dispatch_event('message', {'message': f"[Dict] Словник успішно згенеровано! Кількість слів: {word_count}", 'type': 'success'})
        else:
            print(f"[Dict] Словник успішно згенеровано!")
            api.dispatch_event('message', {'message': "[Dict] Словник успішно згенеровано!", 'type': 'success'})

        file_name = f"{fields['name'].lower()}_{fields['surname'].lower()}"
        move_file(f"{fields['name'].lower()}.txt", local_dict_path, f"{file_name}")

        return {
            'success': True,
            'message': f"Словник успішно згенеровано!",
            'count': word_count,
            'file': file_name
        }
    except subprocess.CalledProcessError as e:
        print(e.stderr)
        print(f"[Dict] {e.stderr}")
        api.dispatch_event('message', {'message': f"[Dict] Не вдалось згенерувати словник", 'type': 'error'})
    except FileNotFoundError:
        print(f"[Dict] cupp.py не знайдено")
        api.dispatch_event('message', {'message': "[Dict] cupp.py не знайдено", 'type': 'error'})
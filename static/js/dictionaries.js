// ========== Функції вкладки Словники (Cupp) ==========

// Почати генерацію словника Cupp
const startCupp = async () => {
    const form = document.getElementById('cuppForm');
    const formData = new FormData(form);

    const data = {
        name: formData.get('name').replace(/\s+/g, ''),
        surname: formData.get('surname').replace(/\s+/g, ''),
        nick: formData.get('nick').replace(/\s+/g, ''),
        birthdate: formData.get('birthdate'),
        wife: formData.get('wife').replace(/\s+/g, ''),
        wifen: formData.get('wifen').replace(/\s+/g, ''),
        wifeb: formData.get('wifeb').replace(/\s+/g, ''),
        kid: formData.get('kid').replace(/\s+/g, ''),
        kidn: formData.get('kidn').replace(/\s+/g, ''),
        kidb: formData.get('kidb').replace(/\s+/g, ''),
        pet: formData.get('pet').replace(/\s+/g, ''),
        company: formData.get('company').replace(/\s+/g, ''),
        words: formData.get('words').replace(/\s+/g, ''),
        special_chars: formData.get('special_chars') === 'on',
    };

    try {
        const result = await pywebview.api.cupp_generate(data);

        if (result.success) {
            showSections(['#cuppResultsSection']);
            setHTMLContent(
                'cuppResults',
                `
                <div class="alert alert-success">
                    <h5 class="alert-heading">Словник згенеровано!</h5>
                    <ul>
                        <li><strong>Кількість слів:</strong> ${result.count}</li>
                        <li><strong>Файл:</strong> ${result.file}</li>
                    </ul>
                </div>
            `
            );
        }
    } catch (error) {
        console.error('Помилка генерації словника:', error);
        pywebview.api.dispatch_event('message', { 'message': '[Dict] Помилка генерації словника', 'type': 'error' });
    }
};

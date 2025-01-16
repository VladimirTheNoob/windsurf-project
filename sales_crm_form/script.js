document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('salesCrmForm');
    const messageContainer = document.createElement('div');
    messageContainer.id = 'message-container';
    form.appendChild(messageContainer);

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Collect form data
        const formData = {
            person_name: document.getElementById('personName').value,
            company_name: document.getElementById('companyName').value,
            department: document.getElementById('department').value,
            case: document.getElementById('case').value,
            next_steps: document.getElementById('nextSteps').value,
            status: document.getElementById('status').value,
            description: document.getElementById('description').value,
            sale_person: document.getElementById('salePerson').value
        };
        
        try {
            const response = await fetch('http://localhost:5000/submit_crm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                messageContainer.innerHTML = `
                    <div class="success-message">
                        CRM Entry Submitted Successfully! 
                        Entry ID: ${result.entry_id}
                    </div>
                `;
                form.reset();
            } else {
                messageContainer.innerHTML = `
                    <div class="error-message">
                        Error: ${result.error || 'Unknown error occurred'}
                    </div>
                `;
                console.error('Server response:', result);
            }
        } catch (error) {
            messageContainer.innerHTML = `
                <div class="error-message">
                    Network Error: Unable to submit CRM entry
                </div>
            `;
            console.error('Fetch error:', error);
        }
    });
});

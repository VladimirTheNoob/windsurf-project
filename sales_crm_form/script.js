document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('salesCrmForm');
    const messageContainer = document.createElement('div');
    messageContainer.id = 'message-container';
    form.appendChild(messageContainer);

    // Function to display messages
    function showMessage(message, isError = false) {
        messageContainer.innerHTML = `
            <div class="${isError ? 'error-message' : 'success-message'}">
                ${message}
            </div>
        `;
        
        // Auto-clear message after 5 seconds
        setTimeout(() => {
            messageContainer.innerHTML = '';
        }, 5000);
    }

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
        
        // Validate required fields
        if (!formData.person_name || !formData.company_name) {
            showMessage('Please fill in Person Name and Company Name', true);
            return;
        }
        
        try {
            const response = await fetch('/submit_crm', {
                method: 'POST',
                credentials: 'same-origin', // Important for session-based auth
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            // Check for non-OK responses
            if (!response.ok) {
                // Try to parse error details
                const errorData = await response.json().catch(() => ({
                    error: 'Unknown error',
                    details: 'Could not parse error response'
                }));

                // Log detailed error
                console.error('Submission error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorDetails: errorData
                });

                // Show user-friendly error message
                showMessage(`Error: ${errorData.details || errorData.error || 'Submission failed'}`, true);
                return;
            }

            // Parse successful response
            const result = await response.json();

            // Show success message
            showMessage(`CRM Entry Submitted Successfully! Entry ID: ${result.entry_id}`);
            
            // Reset form
            form.reset();

        } catch (error) {
            // Network errors or JSON parsing errors
            console.error('Fetch error:', error);
            
            // Show user-friendly network error
            showMessage('Network Error: Unable to submit CRM entry. Please check your connection.', true);
        }
    });

    // Logout functionality
    function handleLogout() {
        fetch('/logout', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            // Check if response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Clone the response to allow multiple reads
            const responseClone = response.clone();
            
            // First try JSON parsing
            return response.json().catch(() => {
                // If JSON fails, try text parsing on the cloned response
                return responseClone.text().then(text => {
                    console.warn('Non-JSON response:', text);
                    throw new Error('Invalid response format');
                });
            });
        })
        .then(data => {
            // Check for logout success or handle potential error response
            if (data.message === 'Logout successful') {
                // Use full URL for redirection
                window.location.href = data.redirect;
            } else if (data.error) {
                console.error('Logout failed:', data.error);
                alert(data.error);
            } else {
                console.error('Unexpected logout response:', data);
                alert('Logout failed. Please try again.');
            }
        })
        .catch(error => {
            console.error('Logout error:', error);
            
            // More specific error handling
            if (error.message.includes('Invalid response')) {
                alert('Server returned an unexpected response. Please try logging out again.');
            } else {
                alert('An error occurred during logout. Please try again.');
            }
        });
    }

    // Add logout button event listener if it exists
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault();
            handleLogout();
        });
    }
});

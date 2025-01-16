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

    // Login form submission handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();

            // Fallback URLs
            const successRedirect = '/index';
            const loginUrl = '/login';

            // Timeout to ensure we handle cases where fetch fails
            const submitTimer = setTimeout(() => {
                console.warn('Login timeout: Forcing redirect');
                window.location.href = loginUrl;
            }, 5000);

            // Collect login data
            const formData = {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            };

            fetch('/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                // Log full response details for debugging
                console.log('Login Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    type: response.type,
                    ok: response.ok
                });

                // Check if response is OK
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Try to get content type
                const contentType = response.headers.get('content-type') || '';
                console.log('Content-Type:', contentType);

                // Multiple parsing strategies
                if (contentType.includes('application/json')) {
                    return response.json();
                }

                // Try text parsing with multiple fallback strategies
                return response.text().then(text => {
                    console.warn('Non-JSON response text:', text);
                    
                    // Strategy 1: Direct JSON parse
                    try {
                        return JSON.parse(text);
                    } catch (jsonParseError) {
                        console.warn('JSON parse failed, trying alternative parsing');
                    }

                    // Strategy 2: Check for specific success indicators
                    if (text.includes('Login successful')) {
                        return { message: 'Login successful', redirect: successRedirect };
                    }

                    // Strategy 3: Fallback to default
                    console.error('Failed to parse login response');
                    throw new Error('Invalid response format');
                });
            })
            .then(data => {
                // Clear the timeout
                clearTimeout(submitTimer);

                console.log('Parsed login response:', data);

                // Check for login success or handle potential error response
                if (data.message === 'Login successful') {
                    // Prefer provided redirect, fallback to default
                    const redirectUrl = data.redirect || successRedirect;
                    window.location.href = redirectUrl;
                } else if (data.error) {
                    console.error('Login failed:', data.error);
                    alert(data.error);
                    window.location.href = loginUrl;
                } else {
                    console.error('Unexpected login response:', data);
                    alert('Login failed. Redirecting to login.');
                    window.location.href = loginUrl;
                }
            })
            .catch(error => {
                // Clear the timeout
                clearTimeout(submitTimer);

                console.error('Login error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                
                // Always provide a way to handle login failure
                alert('An error occurred during login. Please try again.');
                window.location.href = loginUrl;
            });
        });
    }

    // Logout functionality
    function handleLogout() {
        // Fallback redirect URL
        const fallbackLoginUrl = '/login';

        // Timeout to ensure we redirect even if fetch fails
        const redirectTimer = setTimeout(() => {
            console.warn('Logout timeout: Forcing redirect');
            window.location.href = fallbackLoginUrl;
        }, 5000);

        fetch('/logout', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        })
        .then(response => {
            // Log full response details for debugging
            console.log('Logout Response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                type: response.type,
                ok: response.ok
            });

            // Check if response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Try to get content type
            const contentType = response.headers.get('content-type') || '';
            console.log('Content-Type:', contentType);

            // Multiple parsing strategies
            if (contentType.includes('application/json')) {
                return response.json();
            }

            // Try text parsing with multiple fallback strategies
            return response.text().then(text => {
                console.warn('Non-JSON response text:', text);
                
                // Strategy 1: Direct JSON parse
                try {
                    return JSON.parse(text);
                } catch (jsonParseError) {
                    console.warn('JSON parse failed, trying alternative parsing');
                }

                // Strategy 2: Check for specific success indicators
                if (text.includes('Logout successful')) {
                    return { message: 'Logout successful', redirect: fallbackLoginUrl };
                }

                // Strategy 3: Fallback to default
                console.error('Failed to parse logout response');
                throw new Error('Invalid response format');
            });
        })
        .then(data => {
            // Clear the timeout
            clearTimeout(redirectTimer);

            console.log('Parsed logout response:', data);

            // Check for logout success or handle potential error response
            if (data.message === 'Logout successful') {
                // Prefer provided redirect, fallback to default
                const redirectUrl = data.redirect || fallbackLoginUrl;
                window.location.href = redirectUrl;
            } else if (data.error) {
                console.error('Logout failed:', data.error);
                alert(data.error);
                window.location.href = fallbackLoginUrl;
            } else {
                console.error('Unexpected logout response:', data);
                alert('Logout failed. Redirecting to login.');
                window.location.href = fallbackLoginUrl;
            }
        })
        .catch(error => {
            // Clear the timeout
            clearTimeout(redirectTimer);

            console.error('Logout error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Always provide a way to log out
            alert('An error occurred during logout. Redirecting to login.');
            window.location.href = fallbackLoginUrl;
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

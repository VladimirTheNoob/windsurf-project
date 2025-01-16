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

    // Comprehensive login function with multiple fallback strategies
    const performLogin = async (loginData, fallbackNextPage = '/retrieve_data.html') => {
        // Logging utility
        const debugLog = (message, ...args) => {
            const timestamp = new Date().toISOString();
            console.log(`[LOGIN_DEBUG ${timestamp}] ${message}`, ...args);
        };

        // Error handling utility
        const handleLoginError = (errorMessage, details = null) => {
            debugLog('Login Error:', errorMessage, details);
            
            const messageContainer = document.getElementById('message-container');
            if (messageContainer) {
                messageContainer.innerHTML = `
                    <div class="error-message">
                        ${errorMessage}
                        ${details ? `<small>${details}</small>` : ''}
                    </div>
                `;
            }

            // Optional: Clear sensitive data
            loginData.password = null;
        };

        // Environment detection
        const getEnvironmentInfo = () => {
            return {
                hostname: window.location.hostname,
                origin: window.location.origin,
                protocol: window.location.protocol,
                isLocalhost: ['localhost', '127.0.0.1'].includes(window.location.hostname),
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            };
        };

        const envInfo = getEnvironmentInfo();
        debugLog('Environment Details:', envInfo);

        // Determine login endpoints with multiple fallback strategies
        const loginEndpoints = [
            `${envInfo.origin}/login`,  // Current origin
            `${envInfo.origin}/api/login`,
            '/login',
            'http://localhost:5000/login',
            'http://127.0.0.1:5000/login'
        ];

        // Login methods to try
        const loginMethods = ['POST', 'GET'];

        let loginResponse;
        let loginError;

        // Try multiple methods and endpoints
        for (const method of loginMethods) {
            for (const endpoint of loginEndpoints) {
                try {
                    debugLog(`Attempting login with endpoint: ${endpoint}, method: ${method}`);
                    
                    const fetchOptions = {
                        method: method,
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json, text/html',
                            'Cache-Control': 'no-cache',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify({
                            loginIdentifier: loginData.loginIdentifier,
                            password: loginData.password,
                            nextPage: loginData.nextPage || fallbackNextPage
                        })
                    };

                    // Remove body for GET requests
                    if (method === 'GET') {
                        delete fetchOptions.body;
                        fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    }

                    const response = await fetch(endpoint, fetchOptions);

                    debugLog('Login Response:', {
                        endpoint,
                        method,
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        type: response.type,
                        ok: response.ok
                    });

                    // Parse response content
                    let responseData;
                    const contentType = response.headers.get('content-type') || '';

                    try {
                        if (contentType.includes('application/json')) {
                            responseData = await response.json();
                        } else {
                            // Attempt to parse HTML or text response
                            const text = await response.text();
                            debugLog('Non-JSON login response:', text);

                            // Check for HTML error pages
                            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                                throw new Error('Received HTML instead of JSON');
                            }

                            // Try parsing text as JSON
                            try {
                                responseData = JSON.parse(text);
                            } catch (parseError) {
                                responseData = { 
                                    message: 'Login response could not be parsed', 
                                    details: text 
                                };
                            }
                        }
                    } catch (parseError) {
                        debugLog('Response parsing error:', parseError);
                        throw parseError;
                    }

                    // Consider various success scenarios
                    if (response.ok || 
                        response.status === 200 || 
                        response.status === 201 || 
                        responseData.success === true) {
                        loginResponse = { response, data: responseData };
                        break;
                    }

                    // Handle specific error scenarios
                    if (response.status === 401 || response.status === 403) {
                        handleLoginError('Invalid credentials', responseData.details);
                        return;
                    }
                } catch (endpointError) {
                    debugLog(`Login failed with endpoint ${endpoint}, method ${method}:`, endpointError);
                    loginError = endpointError;
                }
            }

            if (loginResponse) break;
        }

        // If no successful response, handle error
        if (!loginResponse) {
            handleLoginError(
                loginError 
                    ? `Login failed: ${loginError.message}` 
                    : 'Unable to log in. Please try again.'
            );
            return;
        }

        // Extract redirect URL
        const redirectUrl = 
            loginResponse.data.redirect || 
            loginResponse.data.nextPage || 
            fallbackNextPage;

        debugLog('Login successful. Redirecting to:', redirectUrl);

        // Ensure valid URL
        const fullRedirectUrl = new URL(redirectUrl, window.location.origin).href;
        debugLog('Full redirect URL:', fullRedirectUrl);

        // Optional: Store authentication token if provided
        if (loginResponse.data.token) {
            localStorage.setItem('authToken', loginResponse.data.token);
            sessionStorage.setItem('authToken', loginResponse.data.token);
        }

        // Redirect
        window.location.href = fullRedirectUrl;
    };

    // Login form submission handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Clear previous messages
            const messageContainer = document.getElementById('message-container');
            messageContainer.innerHTML = '';
            
            // Collect login data
            const loginIdentifier = document.getElementById('loginIdentifier').value;
            const password = document.getElementById('password').value;
            const nextPage = document.getElementById('nextPage').value;

            // Perform login
            await performLogin({ loginIdentifier, password, nextPage });
        });
    }

    // Comprehensive logout function with multiple fallback strategies
    const performLogout = async (fallbackLoginUrl = '/login') => {
        // Logging utility
        const debugLog = (message, ...args) => {
            const timestamp = new Date().toISOString();
            console.log(`[LOGOUT_DEBUG ${timestamp}] ${message}`, ...args);
        };

        // Error handling utility
        const handleLogoutError = (errorMessage, details = null) => {
            debugLog('Logout Error:', errorMessage, details);
            
            const messageContainer = document.getElementById('message-container');
            if (messageContainer) {
                messageContainer.innerHTML = `
                    <div class="error-message">
                        ${errorMessage}
                        ${details ? `<small>${details}</small>` : ''}
                    </div>
                `;
            }

            // Perform client-side logout
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            
            // Clear cookies
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // Redirect to login page
            window.location.href = fallbackLoginUrl;
        };

        // Environment detection
        const getEnvironmentInfo = () => {
            return {
                hostname: window.location.hostname,
                origin: window.location.origin,
                protocol: window.location.protocol,
                isLocalhost: ['localhost', '127.0.0.1'].includes(window.location.hostname),
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            };
        };

        const envInfo = getEnvironmentInfo();
        debugLog('Environment Details:', envInfo);

        // Determine logout endpoints with multiple fallback strategies
        const loginEndpoints = [
            `${envInfo.origin}/logout`,
            `${envInfo.origin}/api/logout`,
            '/logout',
            '/api/logout'
        ];

        // Logout methods to try (prioritize GET for local server)
        const logoutMethods = ['GET', 'POST'];

        let logoutResponse;
        let logoutError;

        // Try multiple methods and endpoints
        for (const method of logoutMethods) {
            for (const endpoint of loginEndpoints) {
                try {
                    debugLog(`Attempting logout with endpoint: ${endpoint}, method: ${method}`);
                    
                    const fetchOptions = {
                        method: method,
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json, text/html',
                            'Cache-Control': 'no-cache',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    };

                    // Only add body for POST requests
                    if (method === 'POST') {
                        fetchOptions.body = JSON.stringify({
                            action: 'logout'
                        });
                    }

                    const response = await fetch(endpoint, fetchOptions);

                    debugLog('Logout Response:', {
                        endpoint,
                        method,
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        type: response.type,
                        ok: response.ok
                    });

                    // Consider various success scenarios
                    if (response.ok || 
                        response.status === 200 || 
                        response.status === 204 || 
                        response.status === 302) {
                        logoutResponse = response;
                        break;
                    }

                    // Handle specific error scenarios
                    if (response.status === 405) {
                        debugLog('Method Not Allowed, trying alternative method');
                        continue;
                    }
                } catch (endpointError) {
                    debugLog(`Logout failed with endpoint ${endpoint}, method ${method}:`, endpointError);
                    logoutError = endpointError;
                }
            }

            if (logoutResponse) break;
        }

        // If no successful response, perform client-side logout
        if (!logoutResponse) {
            handleLogoutError(
                logoutError 
                    ? `Logout failed: ${logoutError.message}` 
                    : 'Unable to log out. Performing client-side logout.'
            );
            return;
        }

        // Parse response with multiple parsing strategies
        let data;
        const contentType = logoutResponse.headers.get('content-type') || '';

        try {
            // Try JSON parsing first
            if (contentType.includes('application/json')) {
                data = await logoutResponse.json();
            } else {
                // Fallback text parsing
                const text = await logoutResponse.text();
                debugLog('Non-JSON logout response:', text);

                try {
                    // Attempt to parse text as JSON
                    data = JSON.parse(text);
                } catch (parseError) {
                    // Fallback parsing strategies
                    data = { 
                        message: 'Logout successful', 
                        redirect: fallbackLoginUrl 
                    };
                }
            }
        } catch (error) {
            handleLogoutError(
                'Unable to process logout response', 
                error.message
            );
            return;
        }

        debugLog('Parsed logout response:', data);

        // Handle logout response
        if (data.message === 'Logout successful' || 
            data.status === 'success' || 
            data.success === true) {
            // Determine redirect URL
            const redirectUrl = data.redirect || fallbackLoginUrl;
            debugLog('Redirecting to:', redirectUrl);

            // Ensure valid URL
            const fullRedirectUrl = new URL(redirectUrl, window.location.origin).href;
            debugLog('Full redirect URL:', fullRedirectUrl);

            // Redirect
            window.location.href = fullRedirectUrl;
        } else {
            handleLogoutError(
                data.error || data.details || 'Logout failed. Performing client-side logout.'
            );
        }
    };

    // Add logout button event listener if it exists
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault();
            performLogout();
        });
    }
});

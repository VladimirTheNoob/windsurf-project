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
    const performLogin = async (loginIdentifier, password, nextPage = null) => {
        // Logging utility
        const debugLog = (message, ...args) => {
            const timestamp = new Date().toISOString();
            console.log(`[LOGIN_DEBUG ${timestamp}] ${message}`, ...args);
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
            `${envInfo.origin}/login`,
            `${envInfo.origin}/api/login`,
            '/login',
            '/api/login',
            'https://mavericka-crm.netlify.app/login',
            'https://mavericka-crm.netlify.app/api/login'
        ];

        // Login payload
        const loginPayload = {
            username: loginIdentifier,
            password: password,
            next: nextPage || 'No next page specified'
        };

        // Login methods to try
        const loginMethods = ['POST', 'GET'];

        // Fallback redirect URLs
        const successRedirect = '/index';
        const fallbackLoginUrl = '/login';

        let loginResponse;
        let loginError;

        // Try multiple methods and endpoints
        for (const method of loginMethods) {
            for (const endpoint of loginEndpoints) {
                try {
                    debugLog(`Attempting login with endpoint: ${endpoint}, method: ${method}`);
                    
                    const response = await fetch(endpoint, {
                        method: method,
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-Debug-Env': JSON.stringify(envInfo)
                        },
                        body: method === 'POST' ? JSON.stringify(loginPayload) : undefined
                    });

                    debugLog('Login Response:', {
                        endpoint,
                        method,
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        type: response.type,
                        ok: response.ok
                    });

                    // Check for successful response
                    if (response.ok || response.status === 200) {
                        loginResponse = response;
                        break;
                    }

                    // Handle HTML or non-JSON responses
                    if (response.status === 404 || response.status === 500) {
                        const text = await response.text();
                        debugLog('Non-OK Response Text:', text);
                        
                        // Check if response is HTML error page
                        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                            debugLog('Received HTML error response');
                            continue;
                        }
                    }
                } catch (endpointError) {
                    debugLog(`Login failed with endpoint ${endpoint}, method ${method}:`, endpointError);
                    loginError = endpointError;
                }
            }

            if (loginResponse) break;
        }

        // Fallback error handling if no successful response
        if (!loginResponse) {
            debugLog('All login attempts failed');
            
            const errorMessage = loginError 
                ? `Login failed: ${loginError.message}` 
                : 'Unable to log in. Please try again.';
            
            // Show error message
            const messageContainer = document.getElementById('message-container');
            if (messageContainer) {
                messageContainer.innerHTML = `
                    <div class="error-message">
                        ${errorMessage}
                    </div>
                `;
            }

            // Redirect to login page
            window.location.href = fallbackLoginUrl;
            return;
        }

        // Parse response with multiple parsing strategies
        let data;
        const contentType = loginResponse.headers.get('content-type') || '';

        try {
            // Try JSON parsing first
            if (contentType.includes('application/json')) {
                data = await loginResponse.json();
            } else {
                // Fallback text parsing
                const text = await loginResponse.text();
                debugLog('Non-JSON login response:', text);

                try {
                    // Attempt to parse text as JSON
                    data = JSON.parse(text);
                } catch (parseError) {
                    // Fallback parsing strategies
                    if (text.includes('Login successful')) {
                        data = { 
                            message: 'Login successful', 
                            redirect: successRedirect 
                        };
                    } else {
                        data = {
                            error: 'Invalid response format',
                            details: text,
                            parseError: parseError.message
                        };
                        debugLog('Failed to parse login response:', parseError);
                    }
                }
            }
        } catch (error) {
            debugLog('Login response parsing error:', error);
            data = { 
                error: 'Unable to process login response', 
                details: error.message 
            };
        }

        debugLog('Parsed login response:', data);

        // Handle login response
        if (data.message === 'Login successful' || 
            data.status === 'success' || 
            data.success === true) {
            // Determine redirect URL
            const redirectUrl = data.redirect || successRedirect;
            debugLog('Redirecting to:', redirectUrl);

            // Ensure valid URL
            const fullRedirectUrl = new URL(redirectUrl, window.location.origin).href;
            debugLog('Full redirect URL:', fullRedirectUrl);

            // Redirect
            window.location.href = fullRedirectUrl;
        } else {
            // Show error message
            const messageContainer = document.getElementById('message-container');
            if (messageContainer) {
                messageContainer.innerHTML = `
                    <div class="error-message">
                        ${data.error || data.details || 'Login failed. Please try again.'}
                    </div>
                `;
            }

            debugLog('Login failed:', data.error || 'Unknown error');
            
            // Redirect to login page
            window.location.href = fallbackLoginUrl;
        }
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
            await performLogin(loginIdentifier, password, nextPage);
        });
    }

    // Logout function with comprehensive error handling
    const performLogout = async (fallbackLoginUrl = '/login') => {
        try {
            // Determine logout endpoint based on environment
            const logoutEndpoints = [
                `${window.location.origin}/logout`,
                `${window.location.origin}/api/logout`,
                '/logout',
                '/api/logout',
                'https://mavericka-crm.netlify.app/logout',
                'https://mavericka-crm.netlify.app/api/logout'
            ];

            let logoutResponse;
            let logoutError;

            // Try multiple endpoints with different methods
            const logoutMethods = ['POST', 'GET'];
            
            for (const method of logoutMethods) {
                for (const endpoint of logoutEndpoints) {
                    try {
                        console.log(`Attempting logout with endpoint: ${endpoint}, method: ${method}`);
                        
                        const response = await fetch(endpoint, {
                            method: method,
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Cache-Control': 'no-cache',
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                        });

                        console.log('Logout Response:', {
                            endpoint,
                            method,
                            status: response.status,
                            statusText: response.statusText,
                            headers: Object.fromEntries(response.headers.entries()),
                            type: response.type,
                            ok: response.ok
                        });

                        // Consider 401 or 403 as potential logout success
                        if (response.ok || response.status === 401 || response.status === 403) {
                            logoutResponse = response;
                            break;
                        }
                    } catch (endpointError) {
                        console.warn(`Logout failed with endpoint ${endpoint}, method ${method}:`, endpointError);
                        logoutError = endpointError;
                    }
                }

                if (logoutResponse) break;
            }

            // Fallback to direct client-side logout if all attempts fail
            if (!logoutResponse) {
                console.warn('All logout attempts failed. Performing client-side logout.');
                
                // Clear authentication-related items
                localStorage.removeItem('authToken');
                sessionStorage.removeItem('authToken');
                
                // Clear cookies by setting expiration to past
                document.cookie.split(";").forEach((c) => {
                    document.cookie = c
                        .replace(/^ +/, "")
                        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });

                // Redirect to login
                window.location.href = fallbackLoginUrl;
                return;
            }

            // Parse response
            let data;
            const contentType = logoutResponse.headers.get('content-type') || '';
            
            try {
                if (contentType.includes('application/json')) {
                    data = await logoutResponse.json();
                } else {
                    const text = await logoutResponse.text();
                    console.warn('Non-JSON logout response:', text);
                    
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        data = {
                            message: 'Logout successful',
                            details: text,
                            parseError: parseError.message
                        };
                        console.error('Failed to parse logout response:', parseError);
                    }
                }
            } catch (parseError) {
                console.error('Logout response parsing error:', parseError);
                data = { 
                    message: 'Logout successful', 
                    parseError: parseError.message 
                };
            }

            console.log('Logout response data:', data);

            // Handle logout response
            if (data.message === 'Logout successful' || 
                data.status === 'success' || 
                data.success === true) {
                // Prefer provided redirect, fallback to default
                const redirectUrl = data.redirect || fallbackLoginUrl;
                console.log('Redirecting to:', redirectUrl);
                
                // Ensure valid URL
                const fullRedirectUrl = new URL(redirectUrl, window.location.origin).href;
                console.log('Full redirect URL:', fullRedirectUrl);
                
                // Redirect
                window.location.href = fullRedirectUrl;
            } else {
                console.error('Logout failed:', data.error || 'Unknown error');
                alert(data.error || 'Logout failed. Please try again.');
                window.location.href = fallbackLoginUrl;
            }
        } catch (error) {
            console.error('Logout error details:', error);
            alert(`Logout failed: ${error.message}`);
            window.location.href = fallbackLoginUrl;
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

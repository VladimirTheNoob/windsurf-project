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

    // Debugging utility function
    const debugLog = (message, ...args) => {
        const timestamp = new Date().toISOString();
        console.log(`[LOGIN_DEBUG ${timestamp}] ${message}`, ...args);
    };

    // Environment detection utility
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

    // Login form submission handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Comprehensive environment logging
            const envInfo = getEnvironmentInfo();
            debugLog('Environment Details:', envInfo);
            
            // Clear previous messages
            const messageContainer = document.getElementById('message-container');
            messageContainer.innerHTML = '';
            
            // Fallback URLs
            const successRedirect = '/index';
            const loginUrl = '/login';

            // Timeout to ensure we handle cases where fetch fails
            const submitTimer = setTimeout(() => {
                debugLog('Login timeout triggered');
                window.location.href = loginUrl;
            }, 5000);

            // Collect login data
            const loginIdentifier = document.getElementById('loginIdentifier').value;
            const password = document.getElementById('password').value;
            const nextPage = document.getElementById('nextPage').value;

            // Log login attempt with sanitized information
            debugLog('Login Attempt', {
                loginIdentifier: loginIdentifier.replace(/(.{2}).*@/, '$1***@'),
                nextPage: nextPage || 'No next page specified'
            });

            // Logging function to capture detailed information
            const logDetailedError = (context, error, response) => {
                debugLog(`Detailed Error: ${context}`, {
                    errorMessage: error.message,
                    errorStack: error.stack,
                    responseStatus: response ? response.status : 'N/A',
                    responseHeaders: response ? Object.fromEntries(response.headers.entries()) : 'N/A'
                });

                if (response) {
                    response.text().then(text => {
                        debugLog(`Response Text for ${context}:`, text);
                    }).catch(textError => {
                        debugLog(`Could not read response text: ${textError.message}`);
                    });
                }
            };

            try {
                // Determine login endpoint based on environment
                const loginEndpoints = (() => {
                    const endpoints = [
                        `${envInfo.origin}/login`,
                        `${envInfo.origin}/api/login`,
                        '/login',
                        '/api/login',
                        'https://mavericka-crm.netlify.app/login'
                    ];

                    debugLog('Configured Login Endpoints:', endpoints);
                    return endpoints;
                })();

                // Function to attempt login with multiple endpoints
                const attemptLogin = async (endpoints) => {
                    const loginPayload = {
                        username: loginIdentifier,
                        password: password,
                        next: nextPage
                    };

                    for (const endpoint of endpoints) {
                        try {
                            debugLog(`Attempting login with endpoint: ${endpoint}`);
                            
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'Cache-Control': 'no-cache',
                                    'X-Requested-With': 'XMLHttpRequest',
                                    'X-Debug-Env': JSON.stringify(envInfo)
                                },
                                body: JSON.stringify(loginPayload)
                            });

                            // Log full response details for debugging
                            debugLog('Login Response:', {
                                endpoint,
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries()),
                                type: response.type,
                                ok: response.ok
                            });

                            // If response is successful, return it
                            if (response.ok) {
                                return response;
                            }

                            // Log unsuccessful responses
                            debugLog(`Unsuccessful login attempt with ${endpoint}:`, 
                                response.status, response.statusText);
                        } catch (endpointError) {
                            debugLog(`Failed to login with endpoint ${endpoint}:`, endpointError);
                        }
                    }
                    
                    // If all endpoints fail
                    throw new Error('All login endpoints failed');
                };

                // Attempt login
                const response = await attemptLogin(loginEndpoints);

                // Clear the timeout
                clearTimeout(submitTimer);

                // Handle response parsing
                let result;
                const contentType = response.headers.get('content-type') || '';
                
                if (contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    // Try to parse text response
                    const text = await response.text();
                    debugLog('Non-JSON response text:', text);
                    
                    // Attempt to parse as JSON
                    try {
                        result = JSON.parse(text);
                    } catch (parseError) {
                        // Fallback error handling
                        result = {
                            error: 'Unexpected response format',
                            details: text,
                            parseError: parseError.message
                        };
                        logDetailedError('JSON Parsing', parseError, response);
                    }
                }

                debugLog('Parsed login response:', result);

                // Check for login success or handle potential error response
                if (response.ok) {
                    // Successful login
                    messageContainer.innerHTML = `
                        <div class="success-message">
                            Login successful! Redirecting...
                        </div>
                    `;
                    
                    // Determine redirect URL
                    const redirectUrl = result.redirect || successRedirect;
                    debugLog('Redirecting to:', redirectUrl);
                    
                    // Ensure valid URL
                    const fullRedirectUrl = new URL(redirectUrl, window.location.origin).href;
                    debugLog('Full redirect URL:', fullRedirectUrl);
                    
                    // Redirect
                    window.location.href = fullRedirectUrl;
                } else {
                    // Login failed
                    messageContainer.innerHTML = `
                        <div class="error-message">
                            ${result.details || result.error || 'Login failed'}
                        </div>
                    `;
                    debugLog('Login failed:', result);
                }
            } catch (error) {
                // Clear the timeout
                clearTimeout(submitTimer);

                debugLog('Login error:', error);
                logDetailedError('Network Error', error);
                
                messageContainer.innerHTML = `
                    <div class="error-message">
                        Network error: ${error.message}. Please try again.
                    </div>
                `;
            }
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

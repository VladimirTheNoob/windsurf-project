document.addEventListener('DOMContentLoaded', function() {
    // Robust element selection with error checking
    function safeGetElement(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.error(`[CRM Retrieval Error] Element not found: ${selector}`);
            throw new Error(`Element not found: ${selector}`);
        }
        return element;
    }

    // Try to get elements with fallback
    let retrieveAllBtn, retrieveFilteredBtn, clearDataBtn, crmDataBody, salesPersonFilter, salesPersonOther;
    
    try {
        retrieveAllBtn = safeGetElement('#retrieveAllBtn');
        retrieveFilteredBtn = safeGetElement('#retrieveFilteredBtn');
        clearDataBtn = safeGetElement('#clearDataBtn');
        crmDataBody = safeGetElement('#crmDataBody');
        salesPersonFilter = safeGetElement('#salePerson');
        salesPersonOther = safeGetElement('#salePersonOther');
    } catch (error) {
        console.error('[CRM Retrieval Fatal Error] Failed to find required elements:', error);
        alert('Error initializing CRM retrieval. Please check the page structure.');
        return;
    }

    // Enhanced logging function
    function debugLog(...args) {
        console.log('[CRM Retrieval Debug]', ...args);
    }

    // Function to fetch CRM entries
    async function fetchCRMEntries(salePerson = '', status = '') {
        // Determine possible endpoints
        const endpoints = [
            `/get_crm_entries`,
            `/api/get_crm_entries`,
            `${window.location.origin}/get_crm_entries`,
            `${window.location.origin}/api/get_crm_entries`,
            `http://localhost:5000/get_crm_entries`,
            `http://127.0.0.1:5000/get_crm_entries`
        ];

        for (const baseUrl of endpoints) {
            try {
                // Construct URL with optional filters
                const url = new URL(baseUrl, window.location.origin);
                
                // Add filters to URL
                if (salePerson) {
                    url.searchParams.append('sale_person', salePerson);
                    debugLog('Applying Sale Person Filter:', salePerson);
                }
                if (status) {
                    url.searchParams.append('status', status);
                    debugLog('Applying Status Filter:', status);
                }

                debugLog('Fetching CRM Entries from URL:', url.toString());

                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                debugLog('Response Status:', response.status, response.statusText);

                // Check for non-OK responses
                if (!response.ok) {
                    const contentType = response.headers.get('content-type') || '';
                    let errorText;

                    try {
                        // Try parsing as JSON first
                        if (contentType.includes('application/json')) {
                            errorText = await response.json();
                        } else {
                            // Fallback to text
                            errorText = await response.text();
                        }
                    } catch (parseError) {
                        errorText = 'Unable to parse error response';
                    }

                    debugLog('Error Response:', errorText);
                    
                    // If this endpoint fails, continue to next
                    continue;
                }

                // Parse response
                const contentType = response.headers.get('content-type') || '';
                let data;

                try {
                    if (contentType.includes('application/json')) {
                        data = await response.json();
                    } else {
                        // Attempt to parse text as JSON
                        const text = await response.text();
                        debugLog('Non-JSON response:', text);
                        
                        // Check for HTML error pages
                        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                            throw new Error('Received HTML instead of JSON');
                        }

                        data = JSON.parse(text);
                    }
                } catch (parseError) {
                    debugLog('Response parsing error:', parseError);
                    continue;
                }

                debugLog('Retrieved CRM Entries:', data);
                return data;
            } catch (error) {
                debugLog(`Error fetching from ${baseUrl}:`, error);
                // Continue to next endpoint
                continue;
            }
        }

        // If all endpoints fail
        alert('Unable to retrieve CRM entries. Please check your connection.');
        return [];
    }

    // Function to populate table
    function populateTable(entries) {
        debugLog('Populating table with entries:', entries);

        // Verify crmDataBody exists before manipulation
        if (!crmDataBody) {
            console.error('[CRM Retrieval Error] Table body element not found');
            return;
        }

        // Clear existing table rows
        crmDataBody.innerHTML = '';

        // Populate table with fetched entries
        if (!entries || entries.length === 0) {
            const row = crmDataBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 10;
            cell.textContent = 'No entries found.';
            cell.style.textAlign = 'center';
            cell.style.color = 'gray';
            debugLog('No entries to display');
        } else {
            entries.forEach(entry => {
                const row = crmDataBody.insertRow();
                row.insertCell(0).textContent = entry.id;
                row.insertCell(1).textContent = entry.person_name;
                row.insertCell(2).textContent = entry.company_name;
                row.insertCell(3).textContent = entry.department || '';
                row.insertCell(4).textContent = entry.case || '';
                row.insertCell(5).textContent = entry.next_steps || '';
                row.insertCell(6).textContent = entry.status;
                row.insertCell(7).textContent = entry.description || '';
                row.insertCell(8).textContent = entry.sale_person;
                row.insertCell(9).textContent = new Date(entry.submission_time).toLocaleString();
            });
            debugLog(`Displayed ${entries.length} entries`);
        }
    }

    // Retrieve All Data
    retrieveAllBtn.addEventListener('click', async () => {
        debugLog('Retrieve All Data button clicked');
        const entries = await fetchCRMEntries();
        populateTable(entries);
    });

    // Retrieve Filtered Data
    retrieveFilteredBtn.addEventListener('click', async () => {
        debugLog('Retrieve Filtered Data button clicked');
        
        // Get sale person filter value
        let salePerson = salesPersonFilter.value;
        debugLog('Initial Sale Person Filter Value:', salePerson);
        
        // Check for 'Other' option and get custom input if exists
        if (salePerson === 'Other') {
            salePerson = salesPersonOther.value.trim();
            debugLog('Custom Sale Person Input:', salePerson);
        }

        // Fetch and populate entries
        const entries = await fetchCRMEntries(salePerson);
        populateTable(entries);
    });

    // Clear All Data
    clearDataBtn.addEventListener('click', () => {
        debugLog('Clear Data button clicked');
        if (crmDataBody) {
            crmDataBody.innerHTML = '';
        }
    });

    // Add event listener for 'Other' option
    salesPersonFilter.addEventListener('change', function() {
        debugLog('Sales Person Filter changed:', this.value);
        
        if (this.value === 'Other') {
            salesPersonOther.style.display = 'inline-block';
        } else {
            salesPersonOther.style.display = 'none';
        }
    });

    // Initial log to confirm script is loaded
    debugLog('CRM Retrieval Script Loaded Successfully');

    // Initial load of all entries
    try {
        retrieveAllBtn.click();
    } catch (error) {
        console.error('[CRM Retrieval Error] Failed to perform initial load:', error);
    }
});

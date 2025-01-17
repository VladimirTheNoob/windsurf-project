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
    let retrieveAllBtn, retrieveFilteredBtn, clearDataBtn, crmDataBody, 
        salesPersonFilter, salesPersonOther, caseFilter;
    
    try {
        retrieveAllBtn = safeGetElement('#retrieveAllBtn');
        retrieveFilteredBtn = safeGetElement('#retrieveFilteredBtn');
        clearDataBtn = safeGetElement('#clearDataBtn');
        crmDataBody = safeGetElement('#crmDataBody');
        salesPersonFilter = safeGetElement('#salePerson');
        salesPersonOther = safeGetElement('#salePersonOther');
        caseFilter = safeGetElement('#caseFilter');
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
    async function fetchCRMEntries(salePerson = '', caseValue = '') {
        try {
            // Construct URL with optional filters
            const url = new URL('/get_crm_entries', window.location.origin);
            
            // Add filters to URL
            if (salePerson) {
                url.searchParams.append('sale_person', salePerson);
                debugLog('Applying Sale Person Filter:', salePerson);
            }
            if (caseValue) {
                url.searchParams.append('case', caseValue);
                debugLog('Applying Case Filter:', caseValue);
            }

            debugLog('Fetching CRM Entries from URL:', url.toString());

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            debugLog('Response Status:', response.status, response.statusText);

            // Check for non-OK responses
            if (!response.ok) {
                const errorText = await response.text();
                debugLog('Error Response Text:', errorText);
                
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            debugLog('Retrieved CRM Entries:', data);

            // Filter data based on case text
            if (caseValue) {
                const filteredData = data.filter(entry => entry.case.toLowerCase().includes(caseValue.toLowerCase()));
                debugLog('Filtered CRM Entries:', filteredData);
                return filteredData;
            }

            return data;
        } catch (error) {
            debugLog('Error fetching CRM entries:', error);
            alert(`Error retrieving entries: ${error.message}`);
            return [];
        }
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
            return;
        }

        entries.forEach(entry => {
            const row = crmDataBody.insertRow();
            row.insertCell(0).textContent = entry.id;
            row.insertCell(1).textContent = entry.person_name;
            row.insertCell(2).textContent = entry.company_name;
            row.insertCell(3).textContent = entry.department;
            row.insertCell(4).textContent = entry.case;
            row.insertCell(5).textContent = entry.next_steps;
            row.insertCell(6).textContent = entry.status;
            row.insertCell(7).textContent = entry.description;
            row.insertCell(8).textContent = entry.sale_person;
            row.insertCell(9).textContent = entry.submission_time;
        });

        debugLog('Table populated successfully');
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
        
        // Get selected sale person
        let selectedSalePerson = salesPersonFilter.value;
        if (selectedSalePerson === 'Other') {
            selectedSalePerson = salesPersonOther.value || '';
        }

        // Get selected case
        const selectedCase = caseFilter.value;

        // Fetch filtered entries
        const entries = await fetchCRMEntries(selectedSalePerson, selectedCase);
        populateTable(entries);
    });

    // Clear Data
    clearDataBtn.addEventListener('click', () => {
        debugLog('Clear Data button clicked');
        crmDataBody.innerHTML = '';
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

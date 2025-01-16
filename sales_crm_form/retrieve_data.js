document.addEventListener('DOMContentLoaded', function() {
    const salesPersonFilter = document.getElementById('salesPersonFilter');
    const retrieveAllBtn = document.getElementById('retrieveAllBtn');
    const retrieveFilteredBtn = document.getElementById('retrieveFilteredBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const crmDataBody = document.getElementById('crmDataBody');

    // Function to fetch CRM entries
    async function fetchCRMEntries(salePerson = '') {
        try {
            const url = new URL('http://localhost:5000/get_crm_entries');
            if (salePerson) {
                url.searchParams.append('sale_person', salePerson);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch CRM entries');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching CRM entries:', error);
            alert('Error fetching CRM entries');
            return [];
        }
    }

    // Function to truncate text
    function truncateText(text, maxLength = 50) {
        if (!text) return 'N/A';
        return text.length > maxLength 
            ? text.substring(0, maxLength) + '...' 
            : text;
    }

    // Function to populate table
    function populateTable(entries) {
        crmDataBody.innerHTML = ''; // Clear existing rows
        
        if (entries.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="10" style="text-align: center; padding: 20px;">
                    No data available
                </td>
            `;
            crmDataBody.appendChild(noDataRow);
            return;
        }

        entries.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td title="${entry.id}">${entry.id}</td>
                <td title="${entry.person_name}">${truncateText(entry.person_name)}</td>
                <td title="${entry.company_name}">${truncateText(entry.company_name)}</td>
                <td title="${entry.department || ''}">${truncateText(entry.department)}</td>
                <td title="${entry.case || ''}">${truncateText(entry.case)}</td>
                <td title="${entry.next_steps || ''}">${truncateText(entry.next_steps)}</td>
                <td title="${entry.status || ''}">${truncateText(entry.status)}</td>
                <td title="${entry.description || ''}">${truncateText(entry.description, 100)}</td>
                <td title="${entry.sale_person}">${truncateText(entry.sale_person)}</td>
                <td title="${new Date(entry.submission_time).toLocaleString()}">
                    ${new Date(entry.submission_time).toLocaleString()}
                </td>
            `;
            crmDataBody.appendChild(row);
        });
    }

    // Retrieve All Data
    retrieveAllBtn.addEventListener('click', async () => {
        const entries = await fetchCRMEntries();
        populateTable(entries);
    });

    // Retrieve Filtered Data
    retrieveFilteredBtn.addEventListener('click', async () => {
        const salePerson = salesPersonFilter.value;
        const entries = await fetchCRMEntries(salePerson);
        populateTable(entries);
    });

    // Clear Table Data (Local Clear)
    clearDataBtn.addEventListener('click', () => {
        const confirmClear = confirm('Are you sure you want to clear the table? This will only remove the data from the view.');
        
        if (confirmClear) {
            crmDataBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 20px;">
                        No data available
                    </td>
                </tr>
            `;
        }
    });

    // Initial load of all entries
    retrieveAllBtn.click();
});

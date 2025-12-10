// script.js - Google Apps Script Integration

// =================== CONFIGURATION ===================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw7Jon1jycLLK64AuQg9LQbjlX0jWADzhUEAbBVPBXCGNCf0Sf7L4FOKHavuHBcmB6LqA/exec'; // Ganti dengan URL Web App Anda

// Jika menggunakan mode development, bisa pakai URL lokal untuk testing
// const APPS_SCRIPT_URL = 'http://localhost:3000/mock-api'; // Untuk testing
// =================== DOM ELEMENTS ===================
const tableBody = document.getElementById('tableBody');
const hospitalFilter = document.getElementById('hospitalFilter');
const yearFilter = document.getElementById('yearFilter');
const monthFilter = document.getElementById('monthFilter');
const serviceFilter = document.getElementById('serviceFilter');
const resetFiltersBtn = document.getElementById('resetFilters');
const searchInput = document.getElementById('searchInput');
const refreshDataBtn = document.getElementById('refreshData');
const exportCSVBtn = document.getElementById('exportCSV');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const retryButton = document.getElementById('retryButton');
const noDataMessage = document.getElementById('noDataMessage');
const connectionStatus = document.getElementById('connectionStatus');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const manualSync = document.getElementById('manualSync');
const totalCount = document.getElementById('totalCount');
const openCount = document.querySelector('.open-count');
const lastSync = document.getElementById('lastSync');
const recordCount = document.getElementById('recordCount');
const showingFrom = document.getElementById('showingFrom');
const showingTo = document.getElementById('showingTo');
const totalItems = document.getElementById('totalItems');
const filterInfo = document.getElementById('filterInfo');

// Modal Elements
const modal = document.getElementById('actionPlanModal');
const closeModalBtn = document.querySelector('.close-modal');
const cancelBtn = document.getElementById('cancelBtn');
const saveActionPlanBtn = document.getElementById('saveActionPlanBtn');
const actionPlanText = document.getElementById('actionPlanText');
const charCount = document.getElementById('charCount');
const modalRequestNo = document.getElementById('modalRequestNo');
const modalHospital = document.getElementById('modalHospital');
const modalDate = document.getElementById('modalDate');
const modalService = document.getElementById('modalService');

// Toast Elements
const toast = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');
const toastClose = document.querySelector('.toast-close');

// =================== GLOBAL VARIABLES ===================
let currentWorkOrders = [];
let filteredWorkOrders = [];
let currentPage = 1;
const itemsPerPage = 15;
let currentWorkOrderId = null;
let currentRequestNo = null;
let isOnline = true;

// =================== INITIALIZATION ===================
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkConnection();
    loadWorkOrders();
});

// =================== CONNECTION MANAGEMENT ===================
function checkConnection() {
    isOnline = navigator.onLine;
    updateConnectionStatus();
    
    window.addEventListener('online', function() {
        isOnline = true;
        updateConnectionStatus();
        showToast('Connection restored', 'Connected to network', 'success');
    });
    
    window.addEventListener('offline', function() {
        isOnline = false;
        updateConnectionStatus();
        showToast('Connection lost', 'Working in offline mode', 'warning');
    });
}

function updateConnectionStatus() {
    if (isOnline) {
        statusIndicator.className = 'status-indicator connected';
        statusText.textContent = 'Connected to Google Sheets';
        manualSync.disabled = false;
    } else {
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Offline - Using cached data';
        manualSync.disabled = true;
    }
}

// =================== API FUNCTIONS ===================
async function fetchFromGoogleSheets(endpoint = '', params = {}) {
    const url = new URL(APPS_SCRIPT_URL);
    
    // Add parameters to URL
    Object.keys(params).forEach(key => {
        if (params[key]) {
            url.searchParams.append(key, params[key]);
        }
    });
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Unknown error from Google Sheets');
        }
        
        return data;
        
    } catch (error) {
        console.error('Error fetching from Google Sheets:', error);
        throw error;
    }
}

async function postToGoogleSheets(data) {
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Unknown error from Google Sheets');
        }
        
        return result;
        
    } catch (error) {
        console.error('Error posting to Google Sheets:', error);
        throw error;
    }
}

// =================== DATA LOADING ===================
async function loadWorkOrders() {
    showLoading();
    hideError();
    
    try {
        let data;
        
        if (isOnline) {
            // Fetch from Google Sheets
            const response = await fetchFromGoogleSheets('', { action: 'getWorkOrders' });
            data = response.data;
            
            // Cache the data
            localStorage.setItem('cachedWorkOrders', JSON.stringify(data));
            localStorage.setItem('lastSyncTime', new Date().toISOString());
            
            // Update sync time display
            const syncTime = new Date().toLocaleTimeString('en-MY', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            lastSync.textContent = syncTime;
            
        } else {
            // Use cached data
            const cachedData = localStorage.getItem('cachedWorkOrders');
            if (!cachedData) {
                throw new Error('No cached data available');
            }
            data = JSON.parse(cachedData);
            showToast('Offline Mode', 'Using cached data', 'warning');
        }
        
        // Transform and process data
        currentWorkOrders = processWorkOrderData(data);
        filteredWorkOrders = [...currentWorkOrders];
        
        // Update UI
        updateStats();
        populateFilterOptions();
        applyFilters();
        
        // Show success message
        const message = isOnline 
            ? `Loaded ${currentWorkOrders.length} work orders from Google Sheets`
            : `Loaded ${currentWorkOrders.length} work orders from cache`;
        
        showToast('Data Loaded', message, 'success');
        
    } catch (error) {
        console.error('Error loading work orders:', error);
        
        // Try to load from cache as fallback
        try {
            const cachedData = localStorage.getItem('cachedWorkOrders');
            if (cachedData) {
                currentWorkOrders = processWorkOrderData(JSON.parse(cachedData));
                filteredWorkOrders = [...currentWorkOrders];
                updateStats();
                populateFilterOptions();
                applyFilters();
                
                showToast('Using Cached Data', 'Unable to connect to Google Sheets', 'warning');
                return;
            }
        } catch (cacheError) {
            console.error('Cache also failed:', cacheError);
        }
        
        // Show error
        showError(`Failed to load data: ${error.message}`);
        
    } finally {
        hideLoading();
    }
}

function processWorkOrderData(data) {
    return data.map((item, index) => {
        // Extract date components
        let requestYear = new Date().getFullYear();
        let month = new Date().getMonth() + 1;
        
        if (item['REQUEST DATE']) {
                try {
                    // Guna Regex untuk pastikan format yyyy-MM-dd dan convert ke tempatan (local)
                    // cth. tukar '2025-12-10' kepada '2025-12-10T00:00:00'
                    const dateString = item['REQUEST DATE'].toString().split('T')[0]; // Buang bahagian masa jika ada
                    const date = new Date(dateString.replace(/-/g, '/') + ' 00:00:00'); // memaksa interpretasi tempatan
                    
                    if (!isNaN(date.getTime())) {
                        requestYear = date.getFullYear();
                        month = date.getMonth() + 1;
                    }
                } catch (e) {
                    console.warn('Invalid date format:', item['REQUEST DATE']);
                }
            }
        
        return {
            id: index + 1,
            REQUEST_NO: item['REQUEST NO'] || item['REQUEST NO'] || '',
            HOSPITAL: item.HOSPITAL || item.HOSPITAL || 'Unknown Hospital',
            REQUEST_DATE: item['REQUEST DATE'] || item['REQUEST DATE'] || '',
            SERVICES: item.SERVICES || '',
            SUB_SYSTEM: item['SUB-SYSTEM'] || item['SUB-SYSTEM'] || '',
            ACTION_PLAN: item['ACTION PLAN'] || item['ACTION PLAN'] || '',
            VENDOR: item.VENDOR || '',
            COST: parseFloat(item.COST || 0),
            Request_Year: requestYear,
            Month: month,
            _rawData: item // Keep original data
        };
    });
}

async function loadFilterOptions() {
    try {
        const response = await fetchFromGoogleSheets('', { action: 'getFilterOptions' });
        return response.data;
    } catch (error) {
        console.error('Error loading filter options:', error);
        
        // Generate from current data as fallback
        const hospitals = [...new Set(currentWorkOrders.map(wo => wo.HOSPITAL).filter(Boolean))];
        const years = [...new Set(currentWorkOrders.map(wo => wo.Request_Year).filter(Boolean))];
        const services = [...new Set(currentWorkOrders.map(wo => wo.SERVICES).filter(Boolean))];
        
        return { hospitals, years, services };
    }
}

// =================== UI UPDATES ===================
function populateFilterOptions() {
    // Clear existing options
    hospitalFilter.innerHTML = '<option value="all">All Hospitals</option>';
    yearFilter.innerHTML = '<option value="all">All Years</option>';
    serviceFilter.innerHTML = '<option value="all">All Services</option>';
    
    // Get unique values from current data
    const hospitals = [...new Set(currentWorkOrders.map(wo => wo.HOSPITAL).filter(Boolean))];
    const years = [...new Set(currentWorkOrders.map(wo => wo.Request_Year).filter(Boolean))];
    const services = [...new Set(currentWorkOrders.map(wo => wo.SERVICES).filter(Boolean))];
    
    // Populate hospitals
    hospitals.sort().forEach(hospital => {
        const option = document.createElement('option');
        option.value = hospital;
        option.textContent = hospital;
        hospitalFilter.appendChild(option);
    });
    
    // Populate years (descending)
    years.sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    
    // Populate services
    services.sort().forEach(service => {
        const option = document.createElement('option');
        option.value = service;
        option.textContent = service;
        serviceFilter.appendChild(option);
    });
}

function renderTable() {
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (filteredWorkOrders.length === 0) {
        noDataMessage.style.display = 'block';
        updatePaginationInfo(0, 0, 0);
        return;
    }
    
    noDataMessage.style.display = 'none';
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredWorkOrders.length);
    const paginatedData = filteredWorkOrders.slice(startIndex, endIndex);
    
    // Update pagination info
    updatePaginationInfo(startIndex + 1, endIndex, filteredWorkOrders.length);
    
    // Render rows
    paginatedData.forEach((workOrder, index) => {
        const row = document.createElement('tr');
        
        // Format date
        const formattedDate = formatDate(workOrder.REQUEST_DATE);
        
        // Determine cost class
        let costClass = 'cost-low';
        if (workOrder.COST > 10000) costClass = 'cost-high';
        else if (workOrder.COST > 5000) costClass = 'cost-medium';
        
        // Action plan cell
        let actionPlanCell = '';
        if (workOrder.ACTION_PLAN && workOrder.ACTION_PLAN.trim() !== '') {
            actionPlanCell = `
                <div class="has-action-plan" title="${workOrder.ACTION_PLAN}">
                    ${workOrder.ACTION_PLAN.substring(0, 60)}${workOrder.ACTION_PLAN.length > 60 ? '...' : ''}
                </div>
            `;
        } else {
            actionPlanCell = '<div class="no-action-plan">No Action Plan</div>';
        }
        
        // Action buttons
        let actionButtons = '';
        if (!workOrder.ACTION_PLAN || workOrder.ACTION_PLAN.trim() === '') {
            actionButtons = `
                <button class="btn-action btn-add" onclick="openAddActionPlanModal(${workOrder.id}, '${workOrder.REQUEST_NO}')">
                    <i class="fas fa-plus"></i> Add Plan
                </button>
            `;
        } else {
            actionButtons = `
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewActionPlan(${workOrder.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-action btn-edit" onclick="openAddActionPlanModal(${workOrder.id}, '${workOrder.REQUEST_NO}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            `;
        }
        
        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td><strong class="request-no">${workOrder.REQUEST_NO}</strong></td>
            <td>${workOrder.HOSPITAL}</td>
            <td>${formattedDate}</td>
            <td><span class="service-badge">${workOrder.SERVICES}</span></td>
            <td>${workOrder.SUB_SYSTEM}</td>
            <td class="action-plan-cell">${actionPlanCell}</td>
            <td>${workOrder.VENDOR || 'N/A'}</td>
            <td class="${costClass}">${workOrder.COST === 0 ? '0' : workOrder.COST.toLocaleString()}</td>
            <td>${actionButtons}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    updatePagination();
    updateFilterInfo();
}

function updatePaginationInfo(from, to, total) {
    showingFrom.textContent = from;
    showingTo.textContent = to;
    totalItems.textContent = total;
    recordCount.textContent = total;
}

function updateFilterInfo() {
    const activeFilters = [];
    
    if (hospitalFilter.value !== 'all') {
        activeFilters.push(`Hospital: ${hospitalFilter.value}`);
    }
    
    if (yearFilter.value !== 'all') {
        activeFilters.push(`Year: ${yearFilter.value}`);
    }
    
    if (monthFilter.value !== 'all') {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        activeFilters.push(`Month: ${monthNames[parseInt(monthFilter.value) - 1]}`);
    }
    
    if (serviceFilter.value !== 'all') {
        activeFilters.push(`Service: ${serviceFilter.value}`);
    }
    
    if (searchInput.value) {
        activeFilters.push(`Search: "${searchInput.value}"`);
    }
    
    if (activeFilters.length > 0) {
        filterInfo.textContent = `(${activeFilters.join(', ')})`;
    } else {
        filterInfo.textContent = '(Showing all)';
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredWorkOrders.length / itemsPerPage);
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function updateStats() {
    totalCount.textContent = currentWorkOrders.length;
    
    // Count work orders without action plan
    const withoutActionPlan = currentWorkOrders.filter(wo => 
        !wo.ACTION_PLAN || wo.ACTION_PLAN.trim() === ''
    ).length;
    openCount.textContent = withoutActionPlan;
}

// =================== FILTER FUNCTIONS ===================
function applyFilters() {
    let filtered = [...currentWorkOrders];
    
    // Apply hospital filter
    if (hospitalFilter.value !== 'all') {
        filtered = filtered.filter(wo => wo.HOSPITAL === hospitalFilter.value);
    }
    
    // Apply year filter
    if (yearFilter.value !== 'all') {
        filtered = filtered.filter(wo => wo.Request_Year === parseInt(yearFilter.value));
    }
    
    // Apply month filter
    if (monthFilter.value !== 'all') {
        filtered = filtered.filter(wo => wo.Month === parseInt(monthFilter.value));
    }
    
    // Apply service filter
    if (serviceFilter.value !== 'all') {
        filtered = filtered.filter(wo => wo.SERVICES === serviceFilter.value);
    }
    
    // Apply search filter
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(wo => 
            wo.REQUEST_NO.toLowerCase().includes(searchTerm) ||
            wo.HOSPITAL.toLowerCase().includes(searchTerm) ||
            wo.SERVICES.toLowerCase().includes(searchTerm) ||
            wo.SUB_SYSTEM.toLowerCase().includes(searchTerm) ||
            wo.VENDOR.toLowerCase().includes(searchTerm) ||
            (wo.ACTION_PLAN && wo.ACTION_PLAN.toLowerCase().includes(searchTerm))
        );
    }
    
    filteredWorkOrders = filtered;
    currentPage = 1;
    renderTable();
}

function resetFilters() {
    hospitalFilter.value = 'all';
    yearFilter.value = 'all';
    monthFilter.value = 'all';
    serviceFilter.value = 'all';
    searchInput.value = '';
    applyFilters();
    showToast('Filters Reset', 'All filters have been reset', 'info');
}

// =================== MODAL FUNCTIONS ===================
function openAddActionPlanModal(workOrderId, requestNo) {
    const workOrder = currentWorkOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;
    
    currentWorkOrderId = workOrderId;
    currentRequestNo = requestNo;
    
    // Set modal values
    modalRequestNo.textContent = workOrder.REQUEST_NO;
    modalHospital.textContent = workOrder.HOSPITAL;
    modalDate.textContent = formatDate(workOrder.REQUEST_DATE, 'long');
    modalService.textContent = workOrder.SERVICES;
    actionPlanText.value = workOrder.ACTION_PLAN || '';
    
    // Update character count
    updateCharCount();
    
    // Show modal
    modal.style.display = 'flex';
    actionPlanText.focus();
}

function closeModal() {
    modal.style.display = 'none';
    actionPlanText.value = '';
    currentWorkOrderId = null;
    currentRequestNo = null;
}

function updateCharCount() {
    const count = actionPlanText.value.length;
    charCount.textContent = count;
    
    if (count > 1000) {
        charCount.style.color = '#dc3545';
    } else if (count > 500) {
        charCount.style.color = '#ff9800';
    } else {
        charCount.style.color = '#28a745';
    }
}

// =================== ACTION PLAN FUNCTIONS ===================
async function saveActionPlan() {
    if (!currentWorkOrderId || !currentRequestNo) return;
    
    const actionPlan = actionPlanText.value.trim();
    if (!actionPlan) {
        showToast('Validation Error', 'Please enter an action plan', 'error');
        return;
    }
    
    // Update UI
    const saveBtn = document.getElementById('saveActionPlanBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
        let success = false;
        let message = '';
        
        if (isOnline) {
            // Save to Google Sheets
            const result = await postToGoogleSheets({
                action: 'updateActionPlan',
                request_no: currentRequestNo,
                action_plan: actionPlan
            });
            
            success = result.success;
            message = result.message || 'Action plan saved to Google Sheets';
        } else {
            // Save locally (will sync when online)
            saveActionPlanLocally(currentRequestNo, actionPlan);
            success = true;
            message = 'Action plan saved locally (will sync when online)';
        }
        
        if (success) {
            // Update local data
            updateLocalData(currentWorkOrderId, actionPlan);
            
            // Show success message
            showToast('Success', message, 'success');
            
            // Refresh data if online
            if (isOnline) {
                setTimeout(() => {
                    loadWorkOrders();
                }, 1000);
            } else {
                renderTable();
                updateStats();
            }
            
            // Close modal
            closeModal();
        } else {
            throw new Error('Failed to save action plan');
        }
        
    } catch (error) {
        console.error('Error saving action plan:', error);
        showToast('Error', `Failed to save: ${error.message}`, 'error');
    } finally {
        // Restore button state
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

function saveActionPlanLocally(requestNo, actionPlan) {
    // Save to localStorage for offline sync
    const pendingUpdates = JSON.parse(localStorage.getItem('pendingUpdates') || '[]');
    pendingUpdates.push({
        request_no: requestNo,
        action_plan: actionPlan,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('pendingUpdates', JSON.stringify(pendingUpdates));
}

function updateLocalData(workOrderId, actionPlan) {
    const index = currentWorkOrders.findIndex(wo => wo.id === workOrderId);
    if (index !== -1) {
        currentWorkOrders[index].ACTION_PLAN = actionPlan;
        currentWorkOrders[index].updated = new Date().toISOString();
        
        // Update filtered data
        const filteredIndex = filteredWorkOrders.findIndex(wo => wo.id === workOrderId);
        if (filteredIndex !== -1) {
            filteredWorkOrders[filteredIndex].ACTION_PLAN = actionPlan;
        }
    }
}

function viewActionPlan(workOrderId) {
    const workOrder = currentWorkOrders.find(wo => wo.id === workOrderId);
    if (workOrder && workOrder.ACTION_PLAN) {
        alert(`ACTION PLAN\n\nRequest No: ${workOrder.REQUEST_NO}\n\n${workOrder.ACTION_PLAN}`);
    }
}

// =================== EXPORT FUNCTIONS ===================
function exportToCSV() {
    if (filteredWorkOrders.length === 0) {
        showToast('Export Failed', 'No data to export', 'warning');
        return;
    }
    
    try {
        // Prepare CSV content
        const headers = ['REQUEST NO', 'HOSPITAL', 'DATE', 'SERVICES', 'SUB-SYSTEM', 'ACTION PLAN', 'VENDOR', 'COST'];
        const rows = filteredWorkOrders.map(wo => [
            wo.REQUEST_NO,
            wo.HOSPITAL,
            wo.REQUEST_DATE,
            wo.SERVICES,
            wo.SUB_SYSTEM,
            wo.ACTION_PLAN,
            wo.VENDOR,
            wo.COST
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `work-orders-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Export Complete', `Exported ${filteredWorkOrders.length} records to CSV`, 'success');
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Export Failed', 'Failed to generate CSV file', 'error');
    }
}

// =================== HELPER FUNCTIONS ===================
function formatDate(dateString, format = 'short') {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        if (format === 'long') {
            return date.toLocaleDateString('en-MY', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else {
            return date.toLocaleDateString('en-MY', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch (e) {
        return dateString;
    }
}

function showLoading() {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    noDataMessage.style.display = 'none';
}

function hideLoading() {
    loading.style.display = 'none';
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showToast(title, message, type = 'success') {
    // Set title and message
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Set type (success, error, warning, info)
    toast.className = 'toast';
    toast.classList.add(type);
    
    // Set icon based on type
    const icon = toast.querySelector('.toast-icon i');
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle';
            break;
        default:
            icon.className = 'fas fa-info-circle';
    }
    
    // Show toast
    toast.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 5000);
}

// =================== EVENT LISTENERS ===================
function setupEventListeners() {
    // Filter events
    hospitalFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);
    monthFilter.addEventListener('change', applyFilters);
    serviceFilter.addEventListener('change', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    searchInput.addEventListener('input', applyFilters);
    
    // Data events
    refreshDataBtn.addEventListener('click', loadWorkOrders);
    manualSync.addEventListener('click', loadWorkOrders);
    exportCSVBtn.addEventListener('click', exportToCSV);
    retryButton.addEventListener('click', loadWorkOrders);
    
    // Pagination events
    prevBtn.addEventListener('click', goToPrevPage);
    nextBtn.addEventListener('click', goToNextPage);
    
    // Modal events
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveActionPlanBtn.addEventListener('click', saveActionPlan);
    actionPlanText.addEventListener('input', updateCharCount);
    
    // Toast event
    toastClose.addEventListener('click', function() {
        toast.style.display = 'none';
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// =================== PAGINATION FUNCTIONS ===================
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(filteredWorkOrders.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

// =================== GLOBAL EXPORTS ===================
window.openAddActionPlanModal = openAddActionPlanModal;
window.viewActionPlan = viewActionPlan;
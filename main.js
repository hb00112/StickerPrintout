const firebaseConfig = {
    apiKey: "AIzaSyD75VN0x6DLmKljSMKOqXgVYFIuU_X7g7c",
    authDomain: "ka-oms-new.firebaseapp.com",
    databaseURL: "https://ka-oms-new-default-rtdb.firebaseio.com",
    projectId: "ka-oms-new",
    storageBucket: "ka-oms-new.firebasestorage.app",
    messagingSenderId: "528745660731",
    appId: "1:528745660731:web:277e4e0ae6382d2378771e",
    measurementId: "G-B7EEVXQ2TG"
};

// Initialize Firebase
let database;
let isConnected = false;
let partyData = [];
let currentPartyId = null;
let pendingImportData = null;
let filteredPartyData = [];
let searchTerm = '';
let filteredPrintPartyData = []; // Add this variable to track filtered print parties
let printSearchTerm = ''; 
// Replace the existing parcelNumbers variable with these two:
let envelopeParcelNumbers = {};  // Stores parcel counts for envelopes
let stickerParcelNumbers = {};   // Stores parcel counts for stickers
let currentParcelContext = 'envelope'; // Tracks which context we're setting parcels for
const FORMAT_ENAMOR_STICKER = 'enamor-sticker';


try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();

    // Test connection
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
        isConnected = snapshot.val() === true;
        updateConnectionStatus();
    });

    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    updateConnectionStatus();
}

// Global variables
let formats = [];
let currentEditingId = null;

let isInitialized = false;

// Global variables for Enamor info
let enamorBillNumbers = {};
let enamorTotalPcs = {};

function openEnamorInfoModal() {
    if (!selectedPartyForPrint) {
        showNotification('Please select a party first', 'error');
        return;
    }
    
    const modal = document.getElementById('enamorInfoModal');
    const partyNameEl = document.getElementById('enamorPartyName');
    const billInputEl = document.getElementById('enamorBillNumber');
    const pcsInputEl = document.getElementById('enamorTotalPcs');
    
    if (modal && partyNameEl && billInputEl && pcsInputEl) {
        partyNameEl.textContent = `${selectedPartyForPrint.name} - ${selectedPartyForPrint.city}`;
        
        // Set current values
        billInputEl.value = enamorBillNumbers[selectedPartyForPrint.id] ? 
            enamorBillNumbers[selectedPartyForPrint.id].replace('K', '') : '';
        pcsInputEl.value = enamorTotalPcs[selectedPartyForPrint.id] || '';
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => billInputEl.focus(), 300);
    }
}

function closeEnamorInfoModal() {
    const modal = document.getElementById('enamorInfoModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function saveEnamorInfo() {
    if (!selectedPartyForPrint) return;
    
    const billInputEl = document.getElementById('enamorBillNumber');
    const pcsInputEl = document.getElementById('enamorTotalPcs');
    
    if (!billInputEl || !pcsInputEl) return;
    
    const billNumber = billInputEl.value.trim();
    const totalPcs = pcsInputEl.value.trim();
    
    // Update bill number (empty string will remove it)
    if (billNumber) {
        enamorBillNumbers[selectedPartyForPrint.id] = 'K' + billNumber;
    } else {
        delete enamorBillNumbers[selectedPartyForPrint.id];
    }
    
    // Update total pieces (empty string will remove it)
    if (totalPcs) {
        enamorTotalPcs[selectedPartyForPrint.id] = totalPcs + 'PCS';
    } else {
        delete enamorTotalPcs[selectedPartyForPrint.id];
    }
    
    showNotification('Additional information updated for Enamor sticker');
    closeEnamorInfoModal();
    
    // Regenerate preview
    generateEnamorStickerPreview(selectedPartyForPrint);
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    if (isInitialized) return; // Prevent multiple initializations
    isInitialized = true;
    
    console.log('DOM loaded, initializing app...');
   addPrintButtonStyles();
    
    // Initialize print button as disabled
    updatePrintButtonState();
    setupEventListeners();
       createParcelModal();

    loadPartyData();
});
// Updated function to control connection status visibility
function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    
    // Only show connection status on homescreen
    if (isOnHomescreen()) {
        if (statusEl) {
            if (isConnected) {
                statusEl.textContent = '🟢 Connected';
                statusEl.className = 'connection-status connected';
                statusEl.style.display = 'block';
            } else {
                statusEl.textContent = '🔴 Offline';
                statusEl.className = 'connection-status disconnected';
                statusEl.style.display = 'block';
            }
        }
    } else {
        // Hide connection status when not on homescreen
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }
}


    function openParcelModal() {
    if (!selectedPartyForPrint) {
        showNotification('Please select a party first', 'error');
        return;
    }
    
    // Set the context based on current format
    currentParcelContext = currentFormat === 'envelope' ? 'envelope' : 'sticker';
    
    const modal = document.getElementById('parcelModal');
    const partyNameEl = document.getElementById('parcelPartyName');
    const inputEl = document.getElementById('parcelNumberInput');
    
    if (modal && partyNameEl && inputEl) {
        partyNameEl.textContent = `${selectedPartyForPrint.name} - ${selectedPartyForPrint.city}`;
        
        // Set current parcel number based on context
        const currentParcelNumber = currentParcelContext === 'envelope' 
            ? (envelopeParcelNumbers[selectedPartyForPrint.id] || 0)
            : (stickerParcelNumbers[selectedPartyForPrint.id] || 0);
        
        inputEl.value = currentParcelNumber;
        
        // Update modal title based on context
        const modalTitle = modal.querySelector('.parcel-modal-title');
        if (modalTitle) {
            modalTitle.textContent = currentParcelContext === 'envelope' 
                ? '📦 Set Number of Parcels (Envelope)' 
                : '📦 Set Number of Parcels (Sticker)';
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => inputEl.focus(), 300);
    }
}

// Function to close parcel modal
function closeParcelModal() {
    const modal = document.getElementById('parcelModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// Function to save parcel number
function saveParcelNumber() {
    if (!selectedPartyForPrint) return;
    
    const inputEl = document.getElementById('parcelNumberInput');
    if (!inputEl) return;
    
    let parcelNumber = parseInt(inputEl.value) || 0;
    
    // Validate range
    if (parcelNumber < 0) parcelNumber = 0;
    if (parcelNumber > 20) parcelNumber = 20;
    
    // Store parcel number based on context
    if (currentParcelContext === 'envelope') {
        envelopeParcelNumbers[selectedPartyForPrint.id] = parcelNumber;
    } else {
        stickerParcelNumbers[selectedPartyForPrint.id] = parcelNumber;
    }
    
    // Show notification
    if (parcelNumber === 0) {
        showNotification(`Parcel number cleared for ${currentParcelContext}`);
    } else {
        showNotification(`Parcel number set to ${parcelNumber} for ${selectedPartyForPrint.name} (${currentParcelContext})`);
    }
    
    // Close modal
    closeParcelModal();
    
    // Regenerate preview based on current format
    if (currentFormat === 'envelope') {
        generateEnvelopePreview(selectedPartyForPrint);
    } else if (currentFormat === 'sticker') {
        generateStickerPreview(selectedPartyForPrint);
    }
}

function openImportModal() {
    document.getElementById('importModal').style.display = 'block';
}

// Helper function to check if user is on homescreen
function isOnHomescreen() {
    const printSection = document.getElementById('printSection');
    const partyModal = document.getElementById('partyModal');
    const partyDetailsModal = document.getElementById('partyDetailsModal');
    const importModal = document.getElementById('importModal');
    
    // Check if any modal or section is currently visible
    const isPrintSectionVisible = printSection && printSection.style.display === 'block';
    const isPartyModalVisible = partyModal && partyModal.style.display === 'block';
    const isPartyDetailsVisible = partyDetailsModal && partyDetailsModal.style.display === 'block';
    const isImportModalVisible = importModal && importModal.style.display === 'block';
    
    // Return true only when on homescreen (no modals/sections open)
    return !isPrintSectionVisible && !isPartyModalVisible && !isPartyDetailsVisible && !isImportModalVisible;
}



function updateStats() {
    const totalFormats = formats.length;
    document.getElementById('totalFormats').textContent = totalFormats;
    document.getElementById('partyCount').textContent = partyData.length;
}
function setupEventListeners() {
    // Helper function to safely add event listeners
    function addListener(selector, event, handler) {
        const element = document.getElementById(selector);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with ID '${selector}' not found - cannot add '${event}' listener`);
        }
    }

    // Search functionality
    addListener('searchInput', 'input', filterParties);
    
    // Party modal events
    addListener('openPartyModal', 'click', openPartyDataModal);
    addListener('partySearch', 'input', filterParties);
    addListener('closePartyModal', 'click', closePartyModal);
    
    // Party details modal events
    addListener('savePartyDetails', 'click', savePartyDetails);
    addListener('closePartyDetails', 'click', closePartyDetailsModal);
    
    // Import functionality
    addListener('importExcel', 'change', handleFileUpload);
    addListener('confirmImport', 'click', confirmImport);
    addListener('cancelImport', 'click', closeImportModal);
    addListener('removeDuplicates', 'click', removeDuplicateParties);
    
    // Print section events - Handle all three format buttons
    const printButtons = [
        { id: 'openEnvelopeSection', format: 'envelope' },
        { id: 'openStickerSection', format: 'sticker' },
        { id: 'openEnamorStickerSection', format: 'enamor-sticker' }
    ];

    printButtons.forEach(button => {
        addListener(button.id, 'click', function(e) {
            e.preventDefault();
            const btn = document.getElementById(button.id);
            if (btn && !btn.disabled) {
                openPrintSection(button.format);
            }
        });
    });
    
    // Print section controls
    addListener('closePrintSection', 'click', closePrintSection);
    addListener('printPartySearch', 'input', filterPrintParties);
    addListener('downloadPdf', 'click', downloadPdf);
    addListener('printPdf', 'click', printPdf);
    
    // Parcel modal events
    addListener('openParcelModal', 'click', openParcelModal);
    addListener('saveParcelNumber', 'click', saveParcelNumber);
    addListener('cancelParcelModal', 'click', closeParcelModal);
}
function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    
    // Show connection status when returning to homescreen
    updateConnectionStatus();
}


function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Style the notification
    notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                z-index: 10001;
                font-weight: 500;
                transform: translateX(400px);
                transition: all 0.3s ease;
            `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}



function clearSearch() {
    document.getElementById('searchInput').value = '';
   
}

// Keyboard shortcuts
document.addEventListener('keydown', function (event) {
    // Ctrl/Cmd + N for new format
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        openModal();
    }

    // Escape to close modal
    if (event.key === 'Escape') {
        closeModal();
    }
});


function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                alert('Excel file must have headers and at least one data row');
                return;
            }

            const headers = jsonData[0];
            pendingImportData = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                const partyRecord = {
                    name: row[5] || '', // Column F (index 5)
                    city: row[3] || '', // Column D (index 3)
                    address1: row[6] || '', // Column G (index 6)
                    address2: row[7] || '', // Column H (index 7)
                    address3: row[8] || '', // Column I (index 8)
                    mobile: row[13] || row[14] || row[15] || row[16] || null // Columns N,O,P,Q (indices 13,14,15,16)
                };

                if (partyRecord.name && partyRecord.city) {
                    pendingImportData.push(partyRecord);
                }
            }

            displayImportPreview();

        } catch (error) {
            console.error('Error reading Excel file:', error);
            alert('Error reading Excel file. Please make sure it\'s a valid Excel file.');
        }
    };

    reader.readAsArrayBuffer(file);
}
function displayImportPreview() {
    if (!pendingImportData || pendingImportData.length === 0) {
        alert('No valid data found in the Excel file');
        return;
    }

    const previewDiv = document.getElementById('importPreview');
    const tableDiv = document.getElementById('previewTable');
    if (!previewDiv || !tableDiv) return;

    let tableHTML = `
        <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="border: 1px solid #ddd; padding: 8px;">Name</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">City</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Mobile</th>
                </tr>
            </thead>
            <tbody>
    `;

    pendingImportData.slice(0, 5).forEach(party => {
        tableHTML += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${party.name || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${party.city || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${party.mobile || 'N/A'}</td>
            </tr>
        `;
    });

    if (pendingImportData.length > 5) {
        tableHTML += `<tr><td colspan="3" style="text-align:center; padding: 8px; font-style: italic;">... and ${pendingImportData.length - 5} more rows</td></tr>`;
    }

    tableHTML += '</tbody></table>';
    tableHTML += `<p><strong>Total records to import: ${pendingImportData.length}</strong></p>`;

    tableDiv.innerHTML = tableHTML;
    previewDiv.style.display = 'block';
    
    // Hide connection status when import modal opens
    updateConnectionStatus();
}

async function confirmImport() {
    if (!pendingImportData || pendingImportData.length === 0) {
        alert('No data to import');
        return;
    }

    try {
        let importedCount = 0;
        let skippedCount = 0;

        for (const party of pendingImportData) {
            // Check for duplicates based on name and city
            const isDuplicate = partyData.some(existing => 
                existing.name.toLowerCase() === party.name.toLowerCase() && 
                existing.city.toLowerCase() === party.city.toLowerCase()
            );

            if (!isDuplicate) {
                const partyWithTimestamp = {
                    ...party,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                if (database) {
                    const newRef = database.ref('partyData').push();
                    await newRef.set(partyWithTimestamp);
                    importedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        if (skippedCount > 0) {
            showNotification(`Imported ${importedCount} new records. Skipped ${skippedCount} duplicates.`);
        } else {
            showNotification(`Successfully imported ${importedCount} party records!`);
        }
        
        closeImportModal();
        
        // Update print button state after successful import
        updatePrintButtonState();
        
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data: ' + error.message);
    }
}
async function removeDuplicateParties() {
    if (!database || partyData.length === 0) {
        alert('No party data to process');
        return;
    }

    const confirmation = confirm('This will remove duplicate parties based on Name and City. This action cannot be undone. Continue?');
    if (!confirmation) return;

    try {
        const seen = new Set();
        const duplicates = [];
        
        partyData.forEach(party => {
            const key = `${party.name?.toLowerCase()}-${party.city?.toLowerCase()}`;
            if (seen.has(key)) {
                duplicates.push(party.id);
            } else {
                seen.add(key);
            }
        });

        if (duplicates.length === 0) {
            alert('No duplicates found!');
            return;
        }

        // Remove duplicates from Firebase
        for (const duplicateId of duplicates) {
            await database.ref('partyData/' + duplicateId).remove();
        }

        showNotification(`Removed ${duplicates.length} duplicate entries!`);
        
    } catch (error) {
        console.error('Error removing duplicates:', error);
        alert('Error removing duplicates: ' + error.message);
    }
}
// Add this CSS for the print button states (add to your existing CSS)
const printButtonStyles = `
.btn-print {
    padding: 8px 16px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.3s ease;
}

.btn-print:disabled {
    background-color: #e74c3c;
    color: white;
    cursor: not-allowed;
    opacity: 0.7;
}

.btn-print:enabled {
    background-color: #27ae60;
    color: white;
    cursor: pointer;
}

.btn-print:enabled:hover {
    background-color: #2ecc71;
    transform: translateY(-1px);
}
`;

// Add styles to head if not already present

// Updated addPrintButtonStyles function to include parcel styles
function addPrintButtonStyles() {
    if (!document.getElementById('printButtonStyles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'printButtonStyles';
        styleElement.textContent = printButtonStyles;
        document.head.appendChild(styleElement);
    }
   
}

function createParcelModal() {
    const modalHTML = `
        <div id="parcelModal" class="parcel-modal">
            <div class="parcel-modal-content">
                <div class="parcel-modal-header">
                    <h2 class="parcel-modal-title">
                        📦 Set Number of Parcels
                    </h2>
                </div>
                <div class="parcel-modal-body">
                    <div class="parcel-party-name" id="parcelPartyName">
                        Party Name Will Appear Here
                    </div>
                    <div class="parcel-input-group">
                        <label class="parcel-input-label">Number of Parcels</label>
                        <input type="number" id="parcelNumberInput" class="parcel-number-input" 
                               min="0" max="20" value="0" placeholder="0">
                        <div class="parcel-input-hint">Enter 0-20 parcels (0 = no parcel display)</div>
                    </div>
                </div>
                <div class="parcel-modal-footer">
                    <button class="parcel-btn parcel-btn-save" onclick="saveParcelNumber()">
                        💾 Save
                    </button>
                    <button class="parcel-btn parcel-btn-cancel" onclick="closeParcelModal()">
                        ❌ Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body if it doesn't exist
    if (!document.getElementById('parcelModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}


// Updated function to update print button state
function updatePrintButtonState() {
    const printBtns = document.querySelectorAll('.btn-print');
    
    if (printBtns) {
        printBtns.forEach(btn => {
            if (partyData && partyData.length > 0) {
                // Enable print button - green color
                btn.disabled = false;
                btn.style.backgroundColor = '#27ae60';
                btn.style.color = 'white';
                btn.style.cursor = 'pointer';
                btn.style.opacity = '1';
                btn.title = 'Click to print';
            } else {
                // Disable print button - red color
                btn.disabled = true;
                btn.style.backgroundColor = '#e74c3c';
                btn.style.color = 'white';
                btn.style.cursor = 'not-allowed';
                btn.style.opacity = '0.7';
                btn.title = 'No party data available. Import data first.';
            }
        });
    }
}

// Updated loadPartyData function with print button state update
function loadPartyData() {
    if (!database) {
        console.error('Database not initialized');
        partyData = [];
        filteredPartyData = [];
        updateStats();
        updatePrintButtonState(); // Add this line
        return;
    }

    // Remove any existing listeners first
    database.ref('partyData').off('value');

    database.ref('partyData').on('value', (snapshot) => {
        partyData = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                partyData.push({
                    id: childSnapshot.key,
                    name: data.name || '',
                    city: data.city || '',
                    address1: data.address1 || '',
                    address2: data.address2 || '',
                    address3: data.address3 || '',
                    mobile: data.mobile || '',
                    createdAt: data.createdAt || 0,
                    updatedAt: data.updatedAt || 0
                });
            });
            
            // Sort alphabetically by name (A to Z)
            partyData.sort((a, b) => {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            console.log('Loaded party data:', partyData.length, 'records');
        } else {
            console.log('No party data found in database');
        }
        
        // Update filtered data
        filterParties();
        updateStats();
        updatePrintButtonState(); // Add this line
    }, (error) => {
        console.error('Error loading party data:', error);
        partyData = [];
        filteredPartyData = [];
        updateStats();
        updatePrintButtonState(); // Add this line
    });
}

function openPartyDataModal() {
    const modal = document.getElementById('partyModal');
    if (!modal) return;

    // Clear search term and reset filter
    const partySearch = document.getElementById('partySearch');
    if (partySearch) partySearch.value = '';
    searchTerm = '';

    filterParties(); // This will display all parties
    modal.style.display = 'block';
    
    // Hide connection status when modal opens
    updateConnectionStatus();
}
function filterParties() {
    const searchInput = document.getElementById('partySearch') || document.getElementById('searchInput');
    searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!searchTerm) {
        filteredPartyData = [...partyData];
    } else {
        filteredPartyData = partyData.filter(party =>
            (party.name || '').toLowerCase().includes(searchTerm) ||
            (party.city || '').toLowerCase().includes(searchTerm)
        );
    }

    displayPartyList();
}


function displayPartyList() {
    const partyList = document.getElementById('partyList');

    if (filteredPartyData.length === 0) {
        if (partyData.length === 0) {
            partyList.innerHTML = '<p style="text-align: center; padding: 40px; color: #666; font-size: 18px;">📋 No party data available. Import some data first.</p>';
        } else {
            partyList.innerHTML = '<p style="text-align: center; padding: 40px; color: #666; font-size: 18px;">🔍 No parties found matching your search.</p>';
        }
        return;
    }

    // Add results count at the top
    const totalResults = filteredPartyData.length;
    const resultsInfo = searchTerm ?
        `<div style="padding: 12px 15px; background: linear-gradient(135deg, #e3f2fd 0%, #f1f8e9 100%); border-radius: 8px; margin-bottom: 15px; font-size: 14px; color: #333; border-left: 4px solid #2196f3;">
            📊 Found <strong>${totalResults}</strong> result${totalResults !== 1 ? 's' : ''} for "<strong>${searchTerm}</strong>"
        </div>` :
        `<div style="padding: 12px 15px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; margin-bottom: 15px; font-size: 14px; color: #333; border-left: 4px solid #28a745;">
            📊 Showing all <strong>${totalResults}</strong> parties (A-Z)
        </div>`;

    let listHTML = '<div class="party-grid" style="width: 100%;">';
    filteredPartyData.forEach(party => {
        listHTML += `
            <div class="party-item" onclick="openPartyDetails('${party.id}')" style="
                border: 1px solid #e0e0e0; 
                padding: 15px 20px; 
                margin: 0; 
                border-radius: 12px; 
                cursor: pointer;
                transition: all 0.3s ease;
                background: white;
                word-wrap: break-word;
                overflow-wrap: break-word;
                width: 100%;
                box-sizing: border-box;
                display: block;
            " onmouseover="this.style.background='linear-gradient(135deg, #f8f9ff 0%, #fff5f5 100%)'; this.style.borderColor='#667eea'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)';" 
               onmouseout="this.style.background='white'; this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                <div style="font-weight: 600; font-size: 16px; line-height: 1.4; color: #333; margin-bottom: 5px;">
                    ${highlightSearchTerm(party.name || 'N/A')}
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 3px;">📍 ${party.city || 'N/A'}</div>
                ${party.mobile ? `<div style="color: #888; font-size: 13px;">📱 ${party.mobile}</div>` : ''}
            </div>
        `;
    });
    listHTML += '</div>';

    partyList.innerHTML = resultsInfo + listHTML;
}

function highlightSearchTerm(text) {
    if (!searchTerm || !text) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark style="background: #fff3cd; padding: 1px 2px; border-radius: 2px;">$1</mark>');
}

function closePartyModal() {
    const modal = document.getElementById('partyModal');
    if (modal) modal.style.display = 'none';
    
    // Show connection status when returning to homescreen
    updateConnectionStatus();
}

// Updated openPartyDetails function
function openPartyDetails(partyId) {
    const party = partyData.find(p => p.id === partyId);
    if (!party) return;

    currentPartyId = partyId;

    // Safely set values
    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    };

    setValue('partyName', party.name);
    setValue('partyCity', party.city);
    setValue('partyAddress1', party.address1);
    setValue('partyAddress2', party.address2);
    setValue('partyAddress3', party.address3);
    setValue('partyMobile', party.mobile);

    const modal = document.getElementById('partyDetailsModal');
    if (modal) modal.style.display = 'block';
    
    // Hide connection status when modal opens
    updateConnectionStatus();
}

// Updated closePartyDetailsModal function
function closePartyDetailsModal() {
    const modal = document.getElementById('partyDetailsModal');
    if (modal) modal.style.display = 'none';
    currentPartyId = null;
    
    // Show connection status when returning to homescreen
    updateConnectionStatus();
}



// Print Section Functions
let selectedPartyForPrint = null;
let currentFormat = null;

function openPrintSection(formatType) {
    // Check if party data is available
    if (!partyData || partyData.length === 0) {
        showNotification('No party data available. Please import party data first.', 'error');
        return;
    }

    currentFormat = formatType;
    document.getElementById('printSection').style.display = 'block';
    document.querySelector('.container').style.display = 'none';
    
    // Update the print section title based on format
    const printTitle = document.getElementById('printSectionTitle');
    if (printTitle) {
        const formatNames = {
            'envelope': 'Print Envelope',
            'sticker': 'Print Parcel Sticker',
            'enamor-sticker': 'Print Enamor Sticker'
        };
        printTitle.textContent = formatNames[formatType] || 'Print';
    }
    
    // Hide connection status when entering print section
    updateConnectionStatus();
    
    // Clear search term and reset filter
    const printPartySearch = document.getElementById('printPartySearch');
    if (printPartySearch) printPartySearch.value = '';
    printSearchTerm = '';
    
    loadPrintParties();
}

function closePrintSection() {
    document.getElementById('printSection').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    selectedPartyForPrint = null;
    printSearchTerm = ''; // Reset search term
    document.getElementById('printActions').style.display = 'none';
    document.getElementById('printPreviewContent').innerHTML = `
        <div class="empty-preview">
            <h3>Kindly select a party name to print the design</h3>
            <p>Select a party from the left panel to generate the envelope</p>
        </div>
    `;
    
    // Show connection status when returning to homescreen
    updateConnectionStatus();
}
function loadPrintParties() {
    // Initialize filtered data with all parties
    filteredPrintPartyData = [...partyData];
    displayPrintPartyList();
}

function filterPrintParties() {
    const searchInput = document.getElementById('printPartySearch');
    printSearchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!printSearchTerm) {
        filteredPrintPartyData = [...partyData];
    } else {
        filteredPrintPartyData = partyData.filter(party =>
            (party.name || '').toLowerCase().includes(printSearchTerm) ||
            (party.city || '').toLowerCase().includes(printSearchTerm)
        );
    }

    displayPrintPartyList();
}
function displayPrintPartyList() {
    const partyList = document.getElementById('printPartyList');
    
    if (filteredPrintPartyData.length === 0) {
        if (partyData.length === 0) {
            partyList.innerHTML = '<div class="no-parties" style="text-align: center; padding: 40px; color: #666; font-size: 16px;">📋 No party data available. Import some data first.</div>';
        } else {
            partyList.innerHTML = '<div class="no-parties" style="text-align: center; padding: 40px; color: #666; font-size: 16px;">🔍 No parties found matching your search.</div>';
        }
        return;
    }

    // Add results count at the top (similar to main party search)
    const totalResults = filteredPrintPartyData.length;
    const resultsInfo = printSearchTerm ?
        `<div style="padding: 12px 15px; background: linear-gradient(135deg, #e3f2fd 0%, #f1f8e9 100%); border-radius: 8px; margin-bottom: 15px; font-size: 14px; color: #333; border-left: 4px solid #2196f3;">
            📊 Found <strong>${totalResults}</strong> result${totalResults !== 1 ? 's' : ''} for "<strong>${printSearchTerm}</strong>"
        </div>` :
        `<div style="padding: 12px 15px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; margin-bottom: 15px; font-size: 14px; color: #333; border-left: 4px solid #28a745;">
            📊 Showing all <strong>${totalResults}</strong> parties for printing
        </div>`;
    
    let html = resultsInfo;
    
    filteredPrintPartyData.forEach(party => {
        html += `
            <div class="party-item" onclick="selectPartyForPrint('${party.id}')" style="
                border: 1px solid #e0e0e0; 
                padding: 15px 20px; 
                margin-bottom: 10px; 
                border-radius: 12px; 
                cursor: pointer;
                transition: all 0.3s ease;
                background: white;
                word-wrap: break-word;
                overflow-wrap: break-word;
            " onmouseover="this.style.background='linear-gradient(135deg, #f8f9ff 0%, #fff5f5 100%)'; this.style.borderColor='#667eea'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)';" 
               onmouseout="this.style.background='white'; this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                <div class="party-name" style="font-weight: 600; font-size: 16px; line-height: 1.4; color: #333; margin-bottom: 5px;">
                    ${highlightPrintSearchTerm(party.name || 'N/A')}
                </div>
                <div class="party-city" style="color: #666; font-size: 14px; margin-bottom: 3px;">
                    📍 ${highlightPrintSearchTerm(party.city || 'N/A')}
                </div>
                ${party.mobile ? `<div style="color: #888; font-size: 13px;">📱 ${party.mobile}</div>` : ''}
            </div>
        `;
    });
    
    partyList.innerHTML = html;
}

function highlightPrintSearchTerm(text) {
    if (!printSearchTerm || !text) return text;

    const regex = new RegExp(`(${printSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark style="background: #fff3cd; padding: 1px 2px; border-radius: 2px;">$1</mark>');
}

function selectPartyForPrint(partyId) {
    const party = partyData.find(p => p.id === partyId);
    if (!party) return;
    
    selectedPartyForPrint = party;
    
    // Highlight selected party
    const partyItems = document.querySelectorAll('#printPartyList .party-item');
    if (partyItems) {
        partyItems.forEach(item => {
            item.classList.remove('selected');
            item.style.background = 'white';
            item.style.borderColor = '#e0e0e0';
        });
        
        partyItems.forEach(item => {
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(partyId)) {
                item.classList.add('selected');
                item.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                item.style.borderColor = '#667eea';
                item.style.color = 'white';
                
                const partyName = item.querySelector('.party-name');
                const partyCity = item.querySelector('.party-city');
                if (partyName) partyName.style.color = 'white';
                if (partyCity) partyCity.style.color = '#e0e0e0';
            }
        });
    }
    
    // Generate preview based on current format
    switch(currentFormat) {
        case 'envelope':
            generateEnvelopePreview(party);
            break;
        case 'sticker':
            generateStickerPreview(party);
            break;
        case 'enamor-sticker':
            generateEnamorStickerPreview(party);
            break;
    }
    
    // Show print actions
    const printActions = document.getElementById('printActions');
    if (printActions) {
        printActions.style.display = 'flex';
    }
}


function generateEnvelopePreview(party) {
    const previewContent = document.getElementById('printPreviewContent');
    
    // Get parcel number for this party
    const parcelNumber = envelopeParcelNumbers[party.id] || 0;
    
    // Filter out empty addresses and create a clean array
    const addresses = [party.address1, party.address2, party.address3].filter(addr => addr && addr.trim() !== '');
    
    // Calculate envelope dimensions and logo position
    const envelopeWidth = 649.08;
    const envelopeHeight = 280.80;
    const logoWidth = 120;
    const logoHeight = 90;
    const logoRight = 20;
    const logoBottom = 20;
    
    // Logo boundaries (from envelope top-left)
    const logoLeft = envelopeWidth - logoWidth - logoRight;
    const logoTop = envelopeHeight - logoHeight - logoBottom;
    const logoRightEdge = envelopeWidth - logoRight;
    const logoBottomEdge = envelopeHeight - logoBottom;
    
    // Function to check if text overlaps with logo
    function checkTextOverlap(textLeft, textTop, textWidth, textHeight) {
        return !(textLeft + textWidth < logoLeft || 
                textLeft > logoRightEdge || 
                textTop + textHeight < logoTop || 
                textTop > logoBottomEdge);
    }
    
    // Estimate text dimensions (approximate)
    function estimateTextDimensions(text, fontSize) {
        const avgCharWidth = fontSize * 0.6;
        const lineHeight = fontSize * 1.2;
        return {
            width: text.length * avgCharWidth,
            height: lineHeight
        };
    }
    
    // Check for overlaps (existing logic...)
    let hasOverlap = false;
    
    // Check mobile number (top right)
    if (party.mobile && party.mobile.trim() !== '') {
        const mobileText = `MOB: ${party.mobile}`;
        const mobileDims = estimateTextDimensions(mobileText, 14);
        const mobileLeft = envelopeWidth - 40 - mobileDims.width;
        if (checkTextOverlap(mobileLeft, 30, mobileDims.width, mobileDims.height)) {
            hasOverlap = true;
        }
    }
    
    // Check recipient name and city
    const nameText = `${party.name || ''} - ${party.city || ''}`;
    const nameDims = estimateTextDimensions(nameText, 18);
    if (checkTextOverlap(40, 55, nameDims.width, nameDims.height)) {
        hasOverlap = true;
    }
    
    // Check addresses
    const addressStartTop = 80;
    const addressLineHeight = 22;
    addresses.forEach((address, index) => {
        const topPosition = addressStartTop + (index * addressLineHeight);
        const addressDims = estimateTextDimensions(address, 15);
        if (checkTextOverlap(40, topPosition, addressDims.width, addressDims.height)) {
            hasOverlap = true;
        }
    });
    
    // Check FROM section
    const fromTexts = [
        { text: "FROM : HREENKAR CREATION", top: 190, size: 11 },
        { text: "SHOP NO.32, COSMOS CENTER MOROD", top: 210, size: 11 },
        { text: "MAPUSA - GOA (9422593814 / 8888099776)", top: 230, size: 11 }
    ];
    
    fromTexts.forEach(item => {
        const textDims = estimateTextDimensions(item.text, item.size);
        if (checkTextOverlap(40, item.top, textDims.width, textDims.height)) {
            hasOverlap = true;
        }
    });
    
    // Set logo opacity based on overlap detection
    const logoOpacity = hasOverlap ? 0.5 : 1;
    
    // Create envelope design with party data
    let envelopeHTML = `
        <div class="envelope-design" style="width: ${envelopeWidth}pt; height: ${envelopeHeight}pt; border: 1px dashed #ccc; position: relative; margin: 0 auto; background: white;">
            
            <!-- Logo Image - Right Bottom Corner with dynamic opacity -->
            <div style="position: absolute; right: ${logoRight}pt; bottom: ${logoBottom}pt; z-index: 1;">
                <img src="https://i.ibb.co/Y7dTtW3b/Copilot-20250605-233015-removebg-preview.png" 
                     alt="Company Logo" 
                     style="width: ${logoWidth}pt; height: auto; opacity: ${logoOpacity}; display: block;" 
                     onerror="this.style.display='none';" />
            </div>
    `;
    
    // Add parcel number circle only if parcel number > 0
    if (parcelNumber > 0) {
        const parcelLeft = logoLeft - 140; // Left of logo with some spacing
        const parcelTop = logoTop + (logoHeight - 90) / 2; // Vertically centered with logo
        
        envelopeHTML += `
            <!-- Parcel Number Circle - Left of Logo -->
            <div style="position: absolute; left: ${parcelLeft}pt; top: ${parcelTop}pt; z-index: 2;">
                <div class="parcel-circle" style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 120px;
                    height: 90px;
                   border: 4px solid RED;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.95);
                    font-size: 50px;
                    font-weight: bold;
                    color: #333;
                    box-shadow: 0 4px 15px rgba(164, 194, 96, 0.2);
                    font-family: 'Arial Rounded MT Bold', sans-serif;
                ">${parcelNumber} P</div>
            </div>
        `;
    }
    
    envelopeHTML += `
            <!-- TO. label in top left -->
            <div style="position: absolute; left: 40pt; top: 30pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 12pt; font-weight: bold; z-index: 2;">TO.</div>
    `;
    
    // Only add mobile number section if mobile exists and is not empty
    if (party.mobile && party.mobile.trim() !== '') {
        envelopeHTML += `
            <!-- Mobile number in top right -->
            <div style="position: absolute; right: 40pt; top: 30pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 14pt; font-weight: bold; z-index: 2;">MOB: ${party.mobile}</div>
        `;
    }
    
    envelopeHTML += `
            <!-- Recipient name and city -->
            <div style="position: absolute; left: 40pt; top: 55pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 18pt; font-weight: bold; z-index: 2;">${party.name || ''} - ${party.city || ''}</div>
    `;
    
    // Add addresses dynamically
    addresses.forEach((address, index) => {
        const topPosition = addressStartTop + (index * addressLineHeight);
        envelopeHTML += `
            <!-- Address line ${index + 1} -->
            <div style="position: absolute; left: 40pt; top: ${topPosition}pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 15pt; font-weight: bold; z-index: 2;">${address}</div>
        `;
    });
    
    // FROM section at bottom
    envelopeHTML += `
            <!-- FROM section at bottom -->
            <div style="position: absolute; left: 40pt; top: 190pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 11pt; font-weight: bold; z-index: 2;">FROM : HREENKAR CREATION</div>
            <div style="position: absolute; left: 40pt; top: 210pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 11pt; font-weight: bold; z-index: 2;">SHOP NO.32, COSMOS CENTER MOROD</div>
            <div style="position: absolute; left: 40pt; top: 230pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 11pt; font-weight: bold; z-index: 2;">MAPUSA - GOA (9422593814 / 8888099776)</div>
            
        </div>
    `;
    
    previewContent.innerHTML = envelopeHTML;
}
// Updated downloadPdf function to include parcel number
async function downloadEnvelopePdf() {
    if (!selectedPartyForPrint) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [649.08, 280.80]
    });
    
    // Get parcel number for this party
      const parcelNumber = envelopeParcelNumbers[selectedPartyForPrint.id] || 0;
    
    // Calculate logo position and overlap detection
    const envelopeWidth = 649.08;
    const envelopeHeight = 280.80;
    const logoWidth = 120;
    const logoHeight = 90;
    const logoRight = 20;
    const logoBottom = 20;
    
    // Logo boundaries
    const logoLeft = envelopeWidth - logoWidth - logoRight;
    const logoTop = envelopeHeight - logoHeight - logoBottom;
    const logoRightEdge = envelopeWidth - logoRight;
    const logoBottomEdge = envelopeHeight - logoBottom;
    
    // Function to check text overlap with logo
    function checkTextOverlap(textLeft, textTop, textWidth, textHeight) {
        return !(textLeft + textWidth < logoLeft || 
                textLeft > logoRightEdge || 
                textTop + textHeight < logoTop || 
                textTop > logoBottomEdge);
    }
    
    // Estimate text dimensions
    function estimateTextDimensions(text, fontSize) {
        const avgCharWidth = fontSize * 0.6;
        const lineHeight = fontSize * 1.2;
        return {
            width: text.length * avgCharWidth,
            height: lineHeight
        };
    }
    
    // Check for overlaps
    let hasOverlap = false;
    
    // Check mobile number
    if (selectedPartyForPrint.mobile && selectedPartyForPrint.mobile.trim() !== '') {
        const mobileText = `MOB: ${selectedPartyForPrint.mobile}`;
        const mobileDims = estimateTextDimensions(mobileText, 14);
        const mobileLeft = envelopeWidth - 40 - mobileDims.width;
        if (checkTextOverlap(mobileLeft, 30, mobileDims.width, mobileDims.height)) {
            hasOverlap = true;
        }
    }
    
    // Check recipient name and city
    const nameText = `${selectedPartyForPrint.name || ''} - ${selectedPartyForPrint.city || ''}`;
    const nameDims = estimateTextDimensions(nameText, 18);
    if (checkTextOverlap(40, 55, nameDims.width, nameDims.height)) {
        hasOverlap = true;
    }
    
    // Check addresses
    const addresses = [
        selectedPartyForPrint.address1, 
        selectedPartyForPrint.address2, 
        selectedPartyForPrint.address3
    ].filter(addr => addr && addr.trim() !== '');
    
    const addressStartTop = 80;
    const addressLineHeight = 22;
    addresses.forEach((address, index) => {
        const topPosition = addressStartTop + (index * addressLineHeight);
        const addressDims = estimateTextDimensions(address, 15);
        if (checkTextOverlap(40, topPosition, addressDims.width, addressDims.height)) {
            hasOverlap = true;
        }
    });
    
    // Check FROM section
    const fromTexts = [
        { text: "FROM : HREENKAR CREATION", top: 190, size: 11 },
        { text: "SHOP NO.32, COSMOS CENTER MOROD", top: 210, size: 11 },
        { text: "MAPUSA - GOA (9422593814 / 8888099776)", top: 230, size: 11 }
    ];
    
    fromTexts.forEach(item => {
        const textDims = estimateTextDimensions(item.text, item.size);
        if (checkTextOverlap(40, item.top, textDims.width, textDims.height)) {
            hasOverlap = true;
        }
    });
    
    // Set logo opacity based on overlap
    const logoOpacity = hasOverlap ? 0.5 : 1;
    
    try {
        // Load and add logo image to PDF
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
            logoImg.onload = () => {
                try {
                    // Create canvas to handle opacity
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = logoWidth;
                    canvas.height = logoHeight;
                    
                    // Set opacity and draw image
                    ctx.globalAlpha = logoOpacity;
                    ctx.drawImage(logoImg, 0, 0, logoWidth, logoHeight);
                    
                    // Convert canvas to data URL
                    const logoDataUrl = canvas.toDataURL('image/png');
                    
                    // Add logo to PDF (bottom right)
                    doc.addImage(logoDataUrl, 'PNG', logoLeft, logoTop, logoWidth, logoHeight);
                    resolve();
                } catch (error) {
                    console.warn('Error processing logo for PDF:', error);
                    resolve(); // Continue without logo
                }
            };
            
            logoImg.onerror = () => {
                console.warn('Failed to load logo for PDF');
                resolve(); // Continue without logo
            };
            
            // Set timeout to prevent hanging
            setTimeout(() => {
                console.warn('Logo loading timeout for PDF');
                resolve();
            }, 5000);
        });
        
        logoImg.src = 'https://i.ibb.co/Y7dTtW3b/Copilot-20250605-233015-removebg-preview.png';
        
    } catch (error) {
        console.warn('Error adding logo to PDF:', error);
    }
    
    // Add parcel number if greater than 0
    if (parcelNumber > 0) {
        const parcelLeft = logoLeft - 140; // Left of logo with some spacing
        const parcelTop = logoTop + (logoHeight - 90) / 2; // Vertically centered with logo
        
        // Draw parcel circle
        doc.setDrawColor(255, 0, 0); // Red border
        doc.setLineWidth(4);
        doc.circle(parcelLeft + 60, parcelTop + 45, 45, 'D'); // Draw circle
        
        // Add parcel number text
        doc.setFontSize(50);
        doc.setTextColor(0, 0, 0); // Black text
        doc.text(`${parcelNumber} P`, parcelLeft + 60, parcelTop + 50, { align: 'center' });
    }
    
    // Add text content
    doc.setFont('helvetica', 'bold');
    
    // TO. label (top left)
    doc.setFontSize(12);
    doc.text('TO.', 40, 50);
    
    // Mobile number (top right) - only if mobile exists
    if (selectedPartyForPrint.mobile && selectedPartyForPrint.mobile.trim() !== '') {
        doc.setFontSize(14);
        doc.text(`MOB: ${selectedPartyForPrint.mobile}`, 649.08 - 40, 50, { align: 'right' });
    }
    
    // Recipient name and city (large text)
    doc.setFontSize(18);
    doc.text(`${selectedPartyForPrint.name || ''} - ${selectedPartyForPrint.city || ''}`, 40, 75);
    
    // Addresses - dynamically positioned
    doc.setFontSize(15);
    addresses.forEach((address, index) => {
        const yPosition = 100 + (index * 22);
        doc.text(address, 40, yPosition);
    });
    
    // FROM section at bottom
    doc.setFontSize(11);
    doc.text('FROM : HREENKAR CREATION', 40, 210);
    doc.text('SHOP NO.32, COSMOS CENTER MOROD', 40, 230);
    doc.text('MAPUSA - GOA (9422593814 / 8888099776)', 40, 250);
    
    // Save the PDF
    doc.save(`envelope_${selectedPartyForPrint.name.replace(/\s+/g, '_')}.pdf`);
}


function downloadPdf() {
    if (!selectedPartyForPrint) return;
    
    switch(currentFormat) {
        case 'envelope':
            downloadEnvelopePdf();
            break;
        case 'sticker':
            downloadStickerPdf();
            break;
        case 'enamor-sticker':
            downloadEnamorStickerPdf();
            break;
    }
}

function printPdf() {
    if (!selectedPartyForPrint) return;
    
    switch(currentFormat) {
        case 'envelope':
            printEnvelope();
            break;
        case 'sticker':
            printSticker();
            break;
        case 'enamor-sticker':
            printEnamorSticker();
            break;
    }
}



// Updated printPdf function to include parcel number
function printEnvelope() {
    if (!selectedPartyForPrint) return;
    
    // Get parcel number for this party
   const parcelNumber = envelopeParcelNumbers[selectedPartyForPrint.id] || 0;
    
    // Calculate logo position and overlap detection
    const envelopeWidth = 649.08;
    const envelopeHeight = 280.80;
    const logoWidth = 120;
    const logoHeight = 90;
    const logoRight = 20;
    const logoBottom = 20;
    
    // Logo boundaries
    const logoLeft = envelopeWidth - logoWidth - logoRight;
    const logoTop = envelopeHeight - logoHeight - logoBottom;
    const logoRightEdge = envelopeWidth - logoRight;
    const logoBottomEdge = envelopeHeight - logoBottom;
    
    // Function to check text overlap with logo
    function checkTextOverlap(textLeft, textTop, textWidth, textHeight) {
        return !(textLeft + textWidth < logoLeft || 
                textLeft > logoRightEdge || 
                textTop + textHeight < logoTop || 
                textTop > logoBottomEdge);
    }
    
    // Estimate text dimensions
    function estimateTextDimensions(text, fontSize) {
        const avgCharWidth = fontSize * 0.6;
        const lineHeight = fontSize * 1.2;
        return {
            width: text.length * avgCharWidth,
            height: lineHeight
        };
    }
    
    // Check for overlaps
    let hasOverlap = false;
    
    // Check mobile number
    if (selectedPartyForPrint.mobile && selectedPartyForPrint.mobile.trim() !== '') {
        const mobileText = `MOB: ${selectedPartyForPrint.mobile}`;
        const mobileDims = estimateTextDimensions(mobileText, 14);
        const mobileLeft = envelopeWidth - 40 - mobileDims.width;
        if (checkTextOverlap(mobileLeft, 30, mobileDims.width, mobileDims.height)) {
            hasOverlap = true;
        }
    }
    
    // Check recipient name and city
    const nameText = `${selectedPartyForPrint.name || ''} - ${selectedPartyForPrint.city || ''}`;
    const nameDims = estimateTextDimensions(nameText, 18);
    if (checkTextOverlap(40, 55, nameDims.width, nameDims.height)) {
        hasOverlap = true;
    }
    
    // Filter out empty addresses
    const addresses = [
        selectedPartyForPrint.address1, 
        selectedPartyForPrint.address2, 
        selectedPartyForPrint.address3
    ].filter(addr => addr && addr.trim() !== '');
    
    // Check addresses
    const addressStartTop = 80;
    const addressLineHeight = 22;
    addresses.forEach((address, index) => {
        const topPosition = addressStartTop + (index * addressLineHeight);
        const addressDims = estimateTextDimensions(address, 15);
        if (checkTextOverlap(40, topPosition, addressDims.width, addressDims.height)) {
            hasOverlap = true;
        }
    });
    
    // Check FROM section
    const fromTexts = [
        { text: "FROM : HREENKAR CREATION", top: 190, size: 11 },
        { text: "SHOP NO.32, COSMOS CENTER MOROD", top: 210, size: 11 },
        { text: "MAPUSA - GOA (9422593814 / 8888099776)", top: 230, size: 11 }
    ];
    
    fromTexts.forEach(item => {
        const textDims = estimateTextDimensions(item.text, item.size);
        if (checkTextOverlap(40, item.top, textDims.width, textDims.height)) {
            hasOverlap = true;
        }
    });
    
    // Set logo opacity based on overlap
    const logoOpacity = hasOverlap ? 0.5 : 1;
    
    // Create address HTML dynamically
    let addressHTML = '';
    addresses.forEach((address, index) => {
        const topPosition = 100 + (index * 22);
        addressHTML += `<div style="position: absolute; left: 40pt; top: ${topPosition}pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 15pt; font-weight: bold;">${address}</div>`;
    });
    
    // Create parcel HTML if parcel number > 0
    let parcelHTML = '';
    if (parcelNumber > 0) {
        const parcelLeft = logoLeft - 140;
        const parcelTop = logoTop + (logoHeight - 90) / 2;
        
        parcelHTML = `
            <div style="position: absolute; left: ${parcelLeft}pt; top: ${parcelTop}pt; z-index: 2;">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 120px;
                    height: 90px;
                    border: 4px solid red;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.95);
                    font-size: 50px;
                    font-weight: bold;
                    color: #333;
                    box-shadow: 0 4px 15px rgba(164, 194, 96, 0.2);
                    font-family: 'Arial Rounded MT Bold', sans-serif;
                ">${parcelNumber} P</div>
            </div>
        `;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Envelope - ${selectedPartyForPrint.name}</title>
            <style>
                @page {
                    size: 649.08pt 280.80pt;
                    margin: 0;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        justify-content: flex-end;
                        align-items: center;
                    }
                    .envelope-container {
                        margin-right: 2pt;
                    }
                    .envelope-design {
                        width: 649.08pt !important;
                        height: 280.80pt !important;
                        border: none !important;
                    }
                }
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Arial Rounded MT Bold', sans-serif;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                }
                .envelope-container {
                    margin-right: 2pt;
                }
                .envelope-design {
                    width: 649.08pt;
                    height: 280.80pt;
                    position: relative;
                    background: white;
                }
            </style>
        </head>
        <body>
            <div class="envelope-container">
                <div class="envelope-design">
                    <!-- Logo Image - Right Bottom Corner with dynamic opacity -->
                    <div style="position: absolute; right: ${logoRight}pt; bottom: ${logoBottom}pt; z-index: 1;">
                        <img src="https://i.ibb.co/Y7dTtW3b/Copilot-20250605-233015-removebg-preview.png" 
                             alt="Company Logo" 
                             style="width: ${logoWidth}pt; height: auto; opacity: ${logoOpacity}; display: block;" 
                             onerror="this.style.display='none';" />
                    </div>
                    
                    ${parcelHTML}
                    
                    <!-- TO. label in top left -->
                    <div style="position: absolute; left: 40pt; top: 30pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 12pt; font-weight: bold; z-index: 2;">TO.</div>
                    
                    ${selectedPartyForPrint.mobile && selectedPartyForPrint.mobile.trim() !== '' ? 
                        `<!-- Mobile number in top right -->
                        <div style="position: absolute; right: 40pt; top: 30pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 14pt; font-weight: bold; z-index: 2;">MOB: ${selectedPartyForPrint.mobile}</div>` : ''
                    }
                    
                    <!-- Recipient name and city -->
                    <div style="position: absolute; left: 40pt; top: 55pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 18pt; font-weight: bold; z-index: 2;">${selectedPartyForPrint.name || ''} - ${selectedPartyForPrint.city || ''}</div>
                    
                    ${addressHTML}
                    
                    <!-- FROM section at bottom -->
                    <div style="position: absolute; left: 40pt; top: 190pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 11pt; font-weight: bold; z-index: 2;">FROM : HREENKAR CREATION</div>
                    <div style="position: absolute; left: 40pt; top: 210pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 11pt; font-weight: bold; z-index: 2;">SHOP NO.32, COSMOS CENTER MOROD</div>
                    <div style="position: absolute; left: 40pt; top: 230pt; font-family: 'Arial Rounded MT Bold', sans-serif; font-size: 11pt; font-weight: bold; z-index: 2;">MAPUSA - GOA (9422593814 / 8888099776)</div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 1000);
                };
                
                window.onafterprint = function() {
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function savePartyDetails() {
    if (!currentPartyId) return;

    try {
        const updatedParty = {
            name: document.getElementById('partyName').value.trim(),
            city: document.getElementById('partyCity').value.trim(),
            address1: document.getElementById('partyAddress1').value.trim(),
            address2: document.getElementById('partyAddress2').value.trim(),
            address3: document.getElementById('partyAddress3').value.trim(),
            mobile: document.getElementById('partyMobile').value.trim(),
            updatedAt: Date.now()
        };

        if (!updatedParty.name || !updatedParty.city) {
            alert('Name and City are required fields');
            return;
        }

        if (database) {
            await database.ref('partyData/' + currentPartyId).update(updatedParty);
            showNotification('Party details updated successfully!');
            closePartyDetailsModal();
        }

    } catch (error) {
        console.error('Error updating party details:', error);
        alert('Error updating party details: ' + error.message);
    }
}
function openNewPartyModal() {
    // Clear all fields
    document.getElementById('newPartyName').value = '';
    document.getElementById('newPartyCity').value = '';
    document.getElementById('newPartyAddress1').value = '';
    document.getElementById('newPartyAddress2').value = '';
    document.getElementById('newPartyAddress3').value = '';
    document.getElementById('newPartyMobile').value = '';
    
    // Open the modal
    document.getElementById('newPartyModal').style.display = 'block';
}

function closeNewPartyModal() {
    document.getElementById('newPartyModal').style.display = 'none';
}

async function saveNewParty() {
    const name = document.getElementById('newPartyName').value.trim();
    const city = document.getElementById('newPartyCity').value.trim();
    const address1 = document.getElementById('newPartyAddress1').value.trim();
    const address2 = document.getElementById('newPartyAddress2').value.trim();
    const address3 = document.getElementById('newPartyAddress3').value.trim();
    const mobile = document.getElementById('newPartyMobile').value.trim();

    // Validate required fields
    if (!name || !city) {
        showNotification('Name and City are required fields', 'error');
        return;
    }

    try {
        const newParty = {
            name,
            city,
            address1,
            address2,
            address3,
            mobile,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        if (database) {
            const newRef = database.ref('partyData').push();
            await newRef.set(newParty);
            
            showNotification('Party added successfully!');
            closeNewPartyModal();
            
            // Update print button state if this is the first party
            updatePrintButtonState();
        }
    } catch (error) {
        console.error('Error adding new party:', error);
        showNotification('Error adding party: ' + error.message, 'error');
    }
}
//sticker
function generateStickerPreview(party) {
    const previewContent = document.getElementById('printPreviewContent');
    
    // Convert dimensions from inches to points (1 inch = 72 points)
    const widthInPoints = 4.14 * 72;
    const heightInPoints = 3.07 * 72;
    
    const parcelNumber = stickerParcelNumbers[party.id] || 0;
    
    // Split the name into two parts if it contains a space
    const nameParts = (party.name || '').split(' ');
    let line1 = '', line2 = '';
    
    if (nameParts.length > 1) {
        // Split name into two roughly equal parts
        const midPoint = Math.ceil(nameParts.length / 2);
        line1 = nameParts.slice(0, midPoint).join(' ');
        line2 = nameParts.slice(midPoint).join(' ');
    } else {
        // If no space, put whole name on first line
        line1 = party.name || '';
    }
    
    // Calculate dynamic font sizes based on available space
    const reservedBottomSpace = 35; // Space for "FROM" section
    const padding = 30; // Total padding (top + bottom)
    let availableHeight = heightInPoints - reservedBottomSpace - padding;
    
    // Determine number of content lines - IGNORE PARCEL FOR HEIGHT CALCULATION
    const nameLines = line2 ? 2 : 1;
    const cityLines = party.city ? 1 : 0;
    const hasParcel = parcelNumber > 0;
    
    // Layout determination
    let layoutType = 'normal'; // normal, cityWithParcel, parcelBelowCity
    let cityAlignLeft = false;
    let parcelBelowCity = false;
    
    if (hasParcel && cityLines > 0) {
        // Check if there's space to put parcel next to city
        const cityWidth = (party.city.length * 12); // Approximate width
        const parcelWidth = 60; // Approximate parcel circle width
        const availableWidth = widthInPoints - 40; // Account for padding
        
        if (cityWidth + parcelWidth + 40 < availableWidth) {
            layoutType = 'cityWithParcel';
            cityAlignLeft = true;
        } else {
            layoutType = 'parcelBelowCity';
            parcelBelowCity = true;
        }
    } else if (hasParcel && cityLines === 0) {
        layoutType = 'parcelBelowName';
        parcelBelowCity = true;
    }
    
    // Calculate spacing based on content lines ONLY (ignore parcel for height calculations)
    let totalContentLines = nameLines + cityLines;
    // REMOVED: No height adjustment for parcel
    // if (parcelBelowCity) {
    //     totalContentLines += 0.8; // Parcel takes partial line space
    //     availableHeight -= 15; // Reduce available height for tighter spacing
    // }
    
    // Calculate optimal spacing
    let nameFontSize, cityFontSize, lineSpacing;
    
    if (totalContentLines <= 1) {
        // Only single name line
        nameFontSize = Math.min(60, availableHeight * 0.7);
        cityFontSize = 0;
        lineSpacing = availableHeight * 0.1;
    } else if (totalContentLines <= 2) {
        if (nameLines === 2 && cityLines === 0) {
            // Two name lines, no city
            nameFontSize = Math.min(45, availableHeight * 0.4);
            cityFontSize = 0;
            lineSpacing = availableHeight * 0.1; // CONSISTENT SPACING
        } else {
            // One name line, one city line
            nameFontSize = Math.min(50, availableHeight * 0.55);
            cityFontSize = Math.min(35, availableHeight * 0.35);
            lineSpacing = availableHeight * 0.1;
        }
    } else {
        // Two name lines + city
        nameFontSize = Math.min(40, availableHeight * 0.35);
        cityFontSize = Math.min(30, availableHeight * 0.25);
        lineSpacing = availableHeight * 0.08; // CONSISTENT SPACING
    }
    
    // Calculate character-based width constraints
    const availableWidth = widthInPoints - 40; // Account for left/right padding
    const maxNameChars = Math.max(line1.length, line2.length);
    const maxCityChars = (party.city || '').length;
    
    // Adjust font sizes based on text width
    if (maxNameChars > 0) {
        const maxNameWidth = availableWidth / maxNameChars * 1.2; // Approximate character width
        nameFontSize = Math.min(nameFontSize, maxNameWidth);
    }
    
    if (maxCityChars > 0 && !cityAlignLeft) {
        const maxCityWidth = availableWidth / maxCityChars * 1.2;
        cityFontSize = Math.min(cityFontSize, maxCityWidth);
    } else if (maxCityChars > 0 && cityAlignLeft) {
        const maxCityWidth = (availableWidth - 80) / maxCityChars * 1.2; // Leave space for parcel
        cityFontSize = Math.min(cityFontSize, maxCityWidth);
    }
    
    // Ensure minimum readable sizes
    nameFontSize = Math.max(nameFontSize, 24);
    cityFontSize = Math.max(cityFontSize, 18);
    
    // Calculate parcel size based on available space
    let parcelSize = 50; // Increased base size
    if (hasParcel) {
        if (layoutType === 'cityWithParcel') {
            parcelSize = Math.min(60, cityFontSize * 1.8);
        } else if (parcelBelowCity) {
            parcelSize = Math.min(70, availableHeight * 0.25);
        }
        parcelSize = Math.max(parcelSize, 40); // Increased minimum size
    }
    
    // Calculate parcel text font size - INCREASED FROM 0.35 TO 0.5
    const parcelTextSize = Math.max(parcelSize * 0.5, 16);
    
    let stickerHTML = `
        <div class="sticker-design" style="
            width: ${widthInPoints}pt; 
            height: ${heightInPoints}pt; 
            border: 1px dashed #ccc; 
            position: relative; 
            margin: 0 auto; 
            background: white;
            padding: 15pt 20pt ${reservedBottomSpace}pt 20pt;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        ">
            <!-- Logo Image - Center Background -->
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1;
                width: 220pt;
                height: 210pt;
                overflow: hidden;
            ">
                <img src="https://i.ibb.co/Y7dTtW3b/Copilot-20250605-233015-removebg-preview.png" 
                     alt="Company Logo" 
                     style="
                        width: 220pt; 
                        height: 210pt; 
                        opacity: 0.4; 
                        display: block;
                        object-fit: contain;
                        object-position: center;
                     " 
                     onerror="this.style.display='none';" />
            </div>
            
            <!-- Name Line 1 -->
            <div style="
                font-size: ${nameFontSize}pt;
                font-weight: bold;
                text-align: center;
                color: #333;
                line-height: 1.1;
                margin-bottom: ${line2 ? lineSpacing : (cityLines > 0 ? lineSpacing * 1.5 : 0)}pt;
                word-wrap: break-word;
                max-width: 100%;
                z-index: 2;
                position: relative;
            ">${line1}</div>
            
            <!-- Name Line 2 -->
            ${line2 ? `
            <div style="
                font-size: ${nameFontSize}pt;
                font-weight: bold;
                text-align: center;
                color: #333;
                line-height: 1.1;
                margin-bottom: ${cityLines > 0 ? lineSpacing * 1.5 : 0}pt;
                word-wrap: break-word;
                max-width: 100%;
                z-index: 2;
                position: relative;
            ">${line2}</div>` : ''}
            
            <!-- City and Parcel Container -->
            ${party.city ? `
            <div style="
                display: flex;
                align-items: center;
                justify-content: ${cityAlignLeft ? 'center' : 'center'};
                width: 100%;
                margin-bottom: 0pt;
                z-index: 2;
                position: relative;
                gap: 15pt;
            ">
                <!-- City -->
                <div style="
                    font-size: ${cityFontSize}pt;
                    text-align: center;
                    color: #555;
                    font-weight: 500;
                    word-wrap: break-word;
                    ${cityAlignLeft ? 'flex-shrink: 0;' : 'max-width: 100%;'}
                ">${party.city}</div>
                
                <!-- Parcel next to city -->
                ${hasParcel && layoutType === 'cityWithParcel' ? `
                <div style="
                    width: ${parcelSize}pt;
                    height: ${parcelSize}pt;
                    background: transparent;
                    border: 3pt solid #dc3545;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #dc3545;
                    font-weight: bold;
                    font-size: ${parcelTextSize}pt;
                    flex-shrink: 0;
                ">${parcelNumber}P</div>` : ''}
            </div>` : ''}
            
            <!-- Parcel below city or name - POSITIONED ABSOLUTELY TO ALLOW OVERLAP -->
            ${hasParcel && parcelBelowCity ? `
            <div style="
                width: ${parcelSize}pt;
                height: ${parcelSize}pt;
                background: transparent;
                border: 3pt solid #dc3545;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #dc3545;
                font-weight: bold;
                font-size: ${parcelTextSize}pt;
                z-index: 2;
                position: relative;
                margin-top: ${lineSpacing * 0.3}pt;
            ">${parcelNumber}P</div>` : ''}
            
            <!-- FROM section at bottom left -->
            <div style="
                font-size: 9pt;
                position: absolute;
                bottom: 12pt;
                left: 15pt;
                font-weight: 500;
                color: #666;
                z-index: 2;
            ">
                FROM: HREENKAR CREATION - MAPUSA GOA (9422593814)
            </div>
        </div>
    `;
    
    previewContent.innerHTML = stickerHTML;
    
    // Optional: Add a debug info comment for testing
    console.log(`Sticker dimensions: ${widthInPoints}pt x ${heightInPoints}pt`);
    console.log(`Name font size: ${nameFontSize}pt, City font size: ${cityFontSize}pt`);
    console.log(`Available height: ${availableHeight}pt, Layout: ${layoutType}`);
    console.log(`Parcel number: ${parcelNumber}, Size: ${parcelSize}pt, Text size: ${parcelTextSize}pt`);
}

// Helper function to calculate font sizes and layout (reused by PDF and print functions)
function calculateStickerLayout(party) {
    const widthInPoints = 4.14 * 72;
    const heightInPoints = 3.07 * 72;
    
    const parcelNumber = stickerParcelNumbers[party.id] || 0;
    
    // Split the name into two parts if it contains a space
    const nameParts = (party.name || '').split(' ');
    let line1 = '', line2 = '';
    
    if (nameParts.length > 1) {
        const midPoint = Math.ceil(nameParts.length / 2);
        line1 = nameParts.slice(0, midPoint).join(' ');
        line2 = nameParts.slice(midPoint).join(' ');
    } else {
        line1 = party.name || '';
    }
    
    const reservedBottomSpace = 35;
    const padding = 30;
    let availableHeight = heightInPoints - reservedBottomSpace - padding;
    
    const nameLines = line2 ? 2 : 1;
    const cityLines = party.city ? 1 : 0;
    const hasParcel = parcelNumber > 0;
    
    // Layout determination
    let layoutType = 'normal';
    let cityAlignLeft = false;
    let parcelBelowCity = false;
    
    if (hasParcel && cityLines > 0) {
        const cityWidth = (party.city.length * 12);
        const parcelWidth = 60;
        const availableWidth = widthInPoints - 40;
        
        if (cityWidth + parcelWidth + 40 < availableWidth) {
            layoutType = 'cityWithParcel';
            cityAlignLeft = true;
        } else {
            layoutType = 'parcelBelowCity';
            parcelBelowCity = true;
        }
    } else if (hasParcel && cityLines === 0) {
        layoutType = 'parcelBelowName';
        parcelBelowCity = true;
    }
    
    // REMOVED HEIGHT ADJUSTMENT FOR PARCEL
    let totalContentLines = nameLines + cityLines;
    // REMOVED: No height adjustment for parcel
    // if (parcelBelowCity) {
    //     totalContentLines += 0.8;
    //     availableHeight -= 15;
    // }
    
    let nameFontSize, cityFontSize, lineSpacing;
    
    if (totalContentLines <= 1) {
        nameFontSize = Math.min(60, availableHeight * 0.7);
        cityFontSize = 0;
        lineSpacing = availableHeight * 0.1;
    } else if (totalContentLines <= 2) {
        if (nameLines === 2 && cityLines === 0) {
            nameFontSize = Math.min(45, availableHeight * 0.4);
            cityFontSize = 0;
            lineSpacing = availableHeight * 0.1; // CONSISTENT SPACING
        } else {
            nameFontSize = Math.min(50, availableHeight * 0.55);
            cityFontSize = Math.min(35, availableHeight * 0.35);
            lineSpacing = availableHeight * 0.1;
        }
    } else {
        nameFontSize = Math.min(40, availableHeight * 0.35);
        cityFontSize = Math.min(30, availableHeight * 0.25);
        lineSpacing = availableHeight * 0.08; // CONSISTENT SPACING
    }
    
    // Width constraints
    const availableWidth = widthInPoints - 40;
    const maxNameChars = Math.max(line1.length, line2.length);
    const maxCityChars = (party.city || '').length;
    
    if (maxNameChars > 0) {
        const maxNameWidth = availableWidth / maxNameChars * 1.2;
        nameFontSize = Math.min(nameFontSize, maxNameWidth);
    }
    
    if (maxCityChars > 0 && !cityAlignLeft) {
        const maxCityWidth = availableWidth / maxCityChars * 1.2;
        cityFontSize = Math.min(cityFontSize, maxCityWidth);
    } else if (maxCityChars > 0 && cityAlignLeft) {
        const maxCityWidth = (availableWidth - 80) / maxCityChars * 1.2;
        cityFontSize = Math.min(cityFontSize, maxCityWidth);
    }
    
    nameFontSize = Math.max(nameFontSize, 24);
    cityFontSize = Math.max(cityFontSize, 18);
    
    // Calculate parcel size
    let parcelSize = 50; // Increased base size
    if (hasParcel) {
        if (layoutType === 'cityWithParcel') {
            parcelSize = Math.min(60, cityFontSize * 1.8);
        } else if (parcelBelowCity) {
            parcelSize = Math.min(70, availableHeight * 0.25);
        }
        parcelSize = Math.max(parcelSize, 40); // Increased minimum size
    }
    
    // Calculate parcel text font size - INCREASED FROM 0.35 TO 0.5
    const parcelTextSize = Math.max(parcelSize * 0.5, 16);
    
    return {
        widthInPoints,
        heightInPoints,
        line1,
        line2,
        nameFontSize,
        cityFontSize,
        lineSpacing,
        nameLines,
        cityLines,
        reservedBottomSpace,
        parcelNumber,
        hasParcel,
        layoutType,
        cityAlignLeft,
        parcelBelowCity,
        parcelSize,
        parcelTextSize
    };
}

async function downloadStickerPdf() {
    if (!selectedPartyForPrint) return;
    
    const { jsPDF } = window.jspdf;
    const layout = calculateStickerLayout(selectedPartyForPrint);
    
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [layout.widthInPoints, layout.heightInPoints]
    });
    
    // Calculate vertical positioning to center content (CONSISTENT POSITIONING)
    const availableHeight = layout.heightInPoints - layout.reservedBottomSpace - 30;
    let totalContentLines = layout.nameLines + layout.cityLines;
    // REMOVED PARCEL HEIGHT ADJUSTMENT
    
    let startY;
    if (totalContentLines <= 1) {
        startY = (availableHeight / 2) + 15 + (layout.nameFontSize / 3);
    } else if (totalContentLines <= 2) {
        startY = (availableHeight / 2) + 15 - (layout.lineSpacing / 2);
    } else {
        startY = (availableHeight / 2) + 15 - layout.lineSpacing;
    }
    
    // Set font
    doc.setFont('helvetica', 'bold');
    
    // Name Line 1
    doc.setFontSize(layout.nameFontSize);
    doc.text(layout.line1, layout.widthInPoints / 2, startY, { align: 'center' });
    
    let currentY = startY;
    
    // Name Line 2
    if (layout.line2) {
        currentY += layout.nameFontSize + layout.lineSpacing;
        doc.text(layout.line2, layout.widthInPoints / 2, currentY, { align: 'center' });
    }
    
    // City and Parcel
    if (selectedPartyForPrint.city) {
        currentY += (layout.line2 ? layout.nameFontSize : layout.nameFontSize) + (layout.lineSpacing * 1.5);
        doc.setFontSize(layout.cityFontSize);
        doc.setFont('helvetica', 'normal');
        
        if (layout.layoutType === 'cityWithParcel' && layout.hasParcel) {
            // City aligned left, parcel on right
            const centerX = layout.widthInPoints / 2;
            const cityWidth = doc.getTextWidth(selectedPartyForPrint.city);
            const totalWidth = cityWidth + layout.parcelSize + 15;
            const startX = centerX - (totalWidth / 2);
            
            // Draw city
            doc.text(selectedPartyForPrint.city, startX, currentY);
            
            // Draw parcel circle
            const parcelX = startX + cityWidth + 15 + (layout.parcelSize / 2);
            const parcelY = currentY - (layout.parcelSize / 3);
            
            doc.setDrawColor(220, 53, 69); // Red border
            doc.setLineWidth(3);
            doc.circle(parcelX, parcelY, layout.parcelSize / 2, 'S'); // S for stroke only
            
            // Draw parcel text with increased font size
            doc.setTextColor(220, 53, 69); // Red text
            doc.setFontSize(layout.parcelTextSize);
            doc.setFont('helvetica', 'bold');
            doc.text(`${layout.parcelNumber}P`, parcelX, parcelY + 2, { align: 'center' });
            doc.setTextColor(0, 0, 0); // Reset to black
        } else {
            // Normal city placement
            doc.text(selectedPartyForPrint.city, layout.widthInPoints / 2, currentY, { align: 'center' });
        }
    }
    
    // Parcel below city or name - REDUCED SPACING TO ALLOW OVERLAP
    if (layout.hasParcel && layout.parcelBelowCity) {
        currentY += (selectedPartyForPrint.city ? layout.cityFontSize : 0) + (layout.lineSpacing * 0.8); // REDUCED FROM 1.5 TO 0.8
        
        const parcelX = layout.widthInPoints / 2;
        const parcelY = currentY;
        
        doc.setDrawColor(220, 53, 69); // Red border
        doc.setLineWidth(3);
        doc.circle(parcelX, parcelY, layout.parcelSize / 2, 'S'); // S for stroke only
        
        // Draw parcel text with increased font size
        doc.setTextColor(220, 53, 69); // Red text
        doc.setFontSize(layout.parcelTextSize);
        doc.setFont('helvetica', 'bold');
        doc.text(`${layout.parcelNumber}P`, parcelX, parcelY + 2, { align: 'center' });
        doc.setTextColor(0, 0, 0); // Reset to black
    }
    
    // FROM section at bottom left
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('FROM: HREENKAR CREATION - MAPUSA GOA (9422594814)', 
             15, layout.heightInPoints - 12);
    
    // Save the PDF
    doc.save(`sticker_${selectedPartyForPrint.name.replace(/\s+/g, '_')}.pdf`);
}

function printSticker() {
    if (!selectedPartyForPrint) return;

    const layout = calculateStickerLayout(selectedPartyForPrint);

    const A4_LANDSCAPE_HEIGHT = 595.28; // A4 Landscape height in pt
    const STICKER_HEIGHT = layout.heightInPoints;
    const TOP_OFFSET = (A4_LANDSCAPE_HEIGHT - layout.heightInPoints) / 2 - 14.17;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Sticker - ${selectedPartyForPrint.name}</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 0;
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                    font-family: 'Arial', sans-serif;
                    overflow: hidden;
                    position: relative;
                }

                .sticker-wrapper {
                    position: absolute;
                    top: ${TOP_OFFSET}pt;
                    left: 530pt;
                    width: ${layout.widthInPoints}pt;
                    height: ${layout.heightInPoints}pt;
                }

                .sticker-design {
                    width: ${layout.widthInPoints}pt;
                    height: ${layout.heightInPoints}pt;
                    position: relative;
                    background: white;
                    padding: 15pt 20pt ${layout.reservedBottomSpace}pt 20pt;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }

                .logo-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 1;
                    width: 220pt;
                    height: 210pt;
                    overflow: hidden;
                }

                .logo-img {
                    width: 220pt;
                    height: 210pt;
                    opacity: 0.4;
                    display: block;
                    object-fit: contain;
                    object-position: center;
                }

                .from-text {
                    font-size: 9pt;
                    position: absolute;
                    bottom: 12pt;
                    left: 20pt;
                    font-weight: 500;
                    color: #666;
                    z-index: 2;
                }

                .city-parcel-container {
                    display: flex;
                    align-items: center;
                    justify-content: ${layout.cityAlignLeft ? 'center' : 'center'};
                    width: 100%;
                    gap: 15pt;
                    z-index: 2;
                    position: relative;
                }

                .parcel-circle {
                    width: ${layout.parcelSize}pt;
                    height: ${layout.parcelSize}pt;
                    background: transparent;
                    border: 3pt solid #dc3545;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #dc3545;
                    font-weight: bold;
                    font-size: ${layout.parcelTextSize}pt;
                    flex-shrink: 0;
                }
            </style>
        </head>
        <body>
            <div class="sticker-wrapper">
                <div class="sticker-design">
                    <div class="logo-container">
                        <img src="https://i.ibb.co/Y7dTtW3b/Copilot-20250605-233015-removebg-preview.png"
                             alt="Company Logo"
                             class="logo-img"
                             onerror="this.style.display='none';" />
                    </div>

                    <div style="
                        font-size: ${layout.nameFontSize}pt;
                        font-weight: bold;
                        text-align: center;
                        color: #333;
                        line-height: 1;
                        margin-bottom: ${layout.line2 ? layout.lineSpacing : (layout.cityLines > 0 ? layout.lineSpacing * 1.5 : 0)}pt;
                        word-wrap: break-word;
                        max-width: 100%;
                        z-index: 2;
                        position: relative;
                    ">${layout.line1}</div>

                    ${layout.line2 ? `
                    <div style="
                        font-size: ${layout.nameFontSize}pt;
                        font-weight: bold;
                        text-align: center;
                        color: #333;
                        line-height: 1;
                        margin-bottom: ${layout.cityLines > 0 ? layout.lineSpacing * 1.5 : 0}pt;
                        word-wrap: break-word;
                        max-width: 100%;
                        z-index: 2;
                        position: relative;
                    ">${layout.line2}</div>` : ''}

                    ${selectedPartyForPrint.city ? `
                    <div class="city-parcel-container" style="margin-bottom: 0pt;">
                        <div style="
                            font-size: ${layout.cityFontSize}pt;
                            text-align: center;
                            color: #555;
                            font-weight: 500;
                            word-wrap: break-word;
                            ${layout.cityAlignLeft ? 'flex-shrink: 0;' : 'max-width: 100%;'}
                        ">${selectedPartyForPrint.city}</div>
                        
                        ${layout.hasParcel && layout.layoutType === 'cityWithParcel' ? `
                        <div class="parcel-circle">${layout.parcelNumber}P</div>` : ''}
                    </div>` : ''}

                    ${layout.hasParcel && layout.parcelBelowCity ? `
                    <div class="parcel-circle" style="margin-top: ${layout.lineSpacing * 0.3}pt;">${layout.parcelNumber}P</div>` : ''}

                    <div class="from-text">
                        FROM: HREENKAR CREATION - MAPUSA GOA (9422593814)
                    </div>
                </div>
            </div>

            <script>
                window.onload = function () {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };

                window.onafterprint = function () {
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


//ENAMOR STICKER


async function downloadEnamorStickerPdf() {
    if (!selectedPartyForPrint) return;
    
    const { jsPDF } = window.jspdf;
    const layout = calculateStickerLayout(selectedPartyForPrint);
    
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [layout.widthInPoints, layout.heightInPoints]
    });
    
    // Calculate vertical positioning to center content
    const availableHeight = layout.heightInPoints - layout.reservedBottomSpace - 30;
    let totalContentLines = layout.nameLines + layout.cityLines;
    
    let startY;
    if (totalContentLines <= 1) {
        startY = (availableHeight / 2) + 15 + (layout.nameFontSize / 3);
    } else if (totalContentLines <= 2) {
        startY = (availableHeight / 2) + 15 - (layout.lineSpacing / 2);
    } else {
        startY = (availableHeight / 2) + 15 - layout.lineSpacing;
    }
    
    // Set font
    doc.setFont('helvetica', 'bold');
    
    // Name Line 1
    doc.setFontSize(layout.nameFontSize);
    doc.text(layout.line1, layout.widthInPoints / 2, startY, { align: 'center' });
    
    let currentY = startY;
    
    // Name Line 2
    if (layout.line2) {
        currentY += layout.nameFontSize + layout.lineSpacing;
        doc.text(layout.line2, layout.widthInPoints / 2, currentY, { align: 'center' });
    }
    
    // City and Parcel
    if (selectedPartyForPrint.city) {
        currentY += (layout.line2 ? layout.nameFontSize : layout.nameFontSize) + (layout.lineSpacing * 1.5);
        doc.setFontSize(layout.cityFontSize);
        doc.setFont('helvetica', 'normal');
        
        if (layout.layoutType === 'cityWithParcel' && layout.hasParcel) {
            // City aligned left, parcel on right
            const centerX = layout.widthInPoints / 2;
            const cityWidth = doc.getTextWidth(selectedPartyForPrint.city);
            const totalWidth = cityWidth + layout.parcelSize + 15;
            const startX = centerX - (totalWidth / 2);
            
            // Draw city
            doc.text(selectedPartyForPrint.city, startX, currentY);
            
            // Draw parcel circle
            const parcelX = startX + cityWidth + 15 + (layout.parcelSize / 2);
            const parcelY = currentY - (layout.parcelSize / 3);
            
            doc.setDrawColor(220, 53, 69); // Red border
            doc.setLineWidth(3);
            doc.circle(parcelX, parcelY, layout.parcelSize / 2, 'S');
            
            // Draw parcel text
            doc.setTextColor(220, 53, 69);
            doc.setFontSize(layout.parcelTextSize);
            doc.setFont('helvetica', 'bold');
            doc.text(`${layout.parcelNumber}P`, parcelX, parcelY + 2, { align: 'center' });
            doc.setTextColor(0, 0, 0);
        } else {
            // Normal city placement
            doc.text(selectedPartyForPrint.city, layout.widthInPoints / 2, currentY, { align: 'center' });
        }
    }
    
    // Parcel below city or name
    if (layout.hasParcel && layout.parcelBelowCity) {
        currentY += (selectedPartyForPrint.city ? layout.cityFontSize : 0) + (layout.lineSpacing * 0.8);
        
        const parcelX = layout.widthInPoints / 2;
        const parcelY = currentY;
        
        doc.setDrawColor(220, 53, 69);
        doc.setLineWidth(3);
        doc.circle(parcelX, parcelY, layout.parcelSize / 2, 'S');
        
        doc.setTextColor(220, 53, 69);
        doc.setFontSize(layout.parcelTextSize);
        doc.setFont('helvetica', 'bold');
        doc.text(`${layout.parcelNumber}P`, parcelX, parcelY + 2, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    }
    
    // FROM section at bottom left
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('FROM: KAMBESHWAR AGENCIES - MAPUSA GOA (9422593814)', 
             15, layout.heightInPoints - 12);
    
    // Save the PDF
    doc.save(`enamor_sticker_${selectedPartyForPrint.name.replace(/\s+/g, '_')}.pdf`);
}

function generateEnamorStickerPreview(party) {
    const previewContent = document.getElementById('printPreviewContent');
    const layout = calculateStickerLayout(party);
    
    // Get Enamor additional info
    const billNumber = enamorBillNumbers[party.id] || '';
    const totalPcs = enamorTotalPcs[party.id] || '';
    
    let stickerHTML = `
        <div class="sticker-design" style="
            width: ${layout.widthInPoints}pt; 
            height: ${layout.heightInPoints}pt; 
            border: 1px dashed #ccc; 
            position: relative; 
            margin: 0 auto; 
            background: white;
            padding: 15pt 20pt ${layout.reservedBottomSpace}pt 20pt;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        ">
            <!-- Logo Image - Center Background -->
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1;
                width: 220pt;
                height: 210pt;
                overflow: hidden;
            ">
                <img src="https://i.ibb.co/jk4cRdJ6/Copilot-20250626-091649-removebg-preview.png" 
                     alt="Company Logo" 
                     style="
                        width: 220pt; 
                        height: 210pt; 
                        opacity: 0.4; 
                        display: block;
                        object-fit: contain;
                        object-position: center;
                     " 
                     onerror="this.style.display='none';" />
            </div>
            
            <!-- Additional Info Button (only in preview) -->
            <button onclick="openEnamorInfoModal()" style="
                position: absolute;
                top: 10pt;
                right: 10pt;
                background: #4a6baf;
                color: white;
                border: none;
                padding: 5pt 10pt;
                border-radius: 4pt;
                font-size: 10pt;
                cursor: pointer;
                z-index: 10;
            ">
                Additional Info
            </button>
            
            <!-- Bill Number and Total PCS in all 4 corners -->
            ${billNumber ? `
                <div style="position: absolute; top: 10pt; left: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${billNumber}</div>
                <div style="position: absolute; top: 10pt; right: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${billNumber}</div>
                <div style="position: absolute; bottom: ${layout.reservedBottomSpace + 10}pt; left: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${billNumber}</div>
                <div style="position: absolute; bottom: ${layout.reservedBottomSpace + 10}pt; right: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${billNumber}</div>
            ` : ''}
            
            ${totalPcs ? `
                <div style="position: absolute; top: 25pt; left: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${totalPcs}</div>
                <div style="position: absolute; top: 25pt; right: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${totalPcs}</div>
                <div style="position: absolute; bottom: ${layout.reservedBottomSpace + 25}pt; left: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${totalPcs}</div>
                <div style="position: absolute; bottom: ${layout.reservedBottomSpace + 25}pt; right: 10pt; font-size: 10pt; color: #333; opacity: 0.7; z-index: 2;">${totalPcs}</div>
            ` : ''}
            
            <!-- Name Line 1 -->
            <div style="
                font-size: ${layout.nameFontSize}pt;
                font-weight: bold;
                text-align: center;
                color: #333;
                line-height: 1.1;
                margin-bottom: ${layout.line2 ? layout.lineSpacing : (layout.cityLines > 0 ? layout.lineSpacing * 1.5 : 0)}pt;
                word-wrap: break-word;
                max-width: 100%;
                z-index: 2;
                position: relative;
            ">${layout.line1}</div>
            
            <!-- Name Line 2 -->
            ${layout.line2 ? `
            <div style="
                font-size: ${layout.nameFontSize}pt;
                font-weight: bold;
                text-align: center;
                color: #333;
                line-height: 1.1;
                margin-bottom: ${layout.cityLines > 0 ? layout.lineSpacing * 1.5 : 0}pt;
                word-wrap: break-word;
                max-width: 100%;
                z-index: 2;
                position: relative;
            ">${layout.line2}</div>` : ''}
            
            <!-- City and Parcel Container -->
            ${party.city ? `
            <div style="
                display: flex;
                align-items: center;
                justify-content: ${layout.cityAlignLeft ? 'flex-start' : 'center'};
                width: 100%;
                margin-bottom: 0pt;
                z-index: 2;
                position: relative;
                gap: 15pt;
            ">
                <!-- City -->
                <div style="
                    font-size: ${layout.cityFontSize}pt;
                    text-align: center;
                    color: #555;
                    font-weight: 500;
                    word-wrap: break-word;
                    ${layout.cityAlignLeft ? 'flex-shrink: 0;' : 'max-width: 100%;'}
                ">${party.city}</div>
                
                <!-- Parcel next to city -->
                ${layout.hasParcel && layout.layoutType === 'cityWithParcel' ? `
                <div style="
                    width: ${layout.parcelSize}pt;
                    height: ${layout.parcelSize}pt;
                    background: transparent;
                    border: 3pt solid #dc3545;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #dc3545;
                    font-weight: bold;
                    font-size: ${layout.parcelTextSize}pt;
                    flex-shrink: 0;
                ">${layout.parcelNumber}P</div>` : ''}
            </div>` : ''}
            
            <!-- Parcel below city or name -->
            ${layout.hasParcel && (layout.parcelBelowCity || !party.city) ? `
            <div style="
                width: ${layout.parcelSize}pt;
                height: ${layout.parcelSize}pt;
                background: transparent;
                border: 3pt solid #dc3545;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #dc3545;
                font-weight: bold;
                font-size: ${layout.parcelTextSize}pt;
                z-index: 2;
                position: relative;
                margin-top: ${layout.lineSpacing * 0.3}pt;
            ">${layout.parcelNumber}P</div>` : ''}
            
            <!-- FROM section at bottom left -->
            <div style="
                font-size: 9pt;
                position: absolute;
                bottom: 12pt;
                left: 15pt;
                font-weight: 500;
                color: #666;
                z-index: 2;
            ">
                FROM: KAMBESHWAR AGENCIES - MAPUSA GOA (9422593814)
            </div>
        </div>
    `;
    
    previewContent.innerHTML = stickerHTML;
}


function printEnamorSticker() {
    if (!selectedPartyForPrint) return;

    const layout = calculateStickerLayout(selectedPartyForPrint);
    
    // Get Enamor additional info
    const billNumber = enamorBillNumbers[selectedPartyForPrint.id] || '';
    const totalPcs = enamorTotalPcs[selectedPartyForPrint.id] || '';

    const A4_LANDSCAPE_HEIGHT = 595.28; // A4 Landscape height in pt
    const STICKER_HEIGHT = layout.heightInPoints;
    const TOP_OFFSET = (A4_LANDSCAPE_HEIGHT - layout.heightInPoints) / 2 - 14.17;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Sticker - ${selectedPartyForPrint.name}</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 0;
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                    font-family: 'Arial', sans-serif;
                    overflow: hidden;
                    position: relative;
                }

                .sticker-wrapper {
                    position: absolute;
                    top: ${TOP_OFFSET}pt;
                    left: 530pt;
                    width: ${layout.widthInPoints}pt;
                    height: ${layout.heightInPoints}pt;
                }

                .sticker-design {
                    width: ${layout.widthInPoints}pt;
                    height: ${layout.heightInPoints}pt;
                    position: relative;
                    background: white;
                    padding: 15pt 20pt ${layout.reservedBottomSpace}pt 20pt;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }

                .logo-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 1;
                    width: 220pt;
                    height: 210pt;
                    overflow: hidden;
                }

                .logo-img {
                margin-top: -20pt;
                    width: 220pt;
                    height: 260pt;
                    opacity: 0.4;
                    display: block;
                    object-fit: contain;
                    object-position: center;
                }

                .from-text {
                    font-size: 9pt;
                    position: absolute;
                    bottom: 12pt;
                    left: 20pt;
                    font-weight: 500;
                    color: #666;
                    z-index: 2;
                }

                .city-parcel-container {
                    display: flex;
                    align-items: center;
                    justify-content: ${layout.cityAlignLeft ? 'center' : 'center'};
                    width: 100%;
                    gap: 15pt;
                    z-index: 2;
                    position: relative;
                }

                .parcel-circle {
                    width: ${layout.parcelSize}pt;
                    height: ${layout.parcelSize}pt;
                    background: transparent;
                    border: 3pt solid #dc3545;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #dc3545;
                    font-weight: bold;
                    font-size: ${layout.parcelTextSize}pt;
                    flex-shrink: 0;
                }
                
                .enamor-info {
                    position: absolute;
                    font-size: 10pt;
                    color: #333;
                    opacity: 0.7;
                    z-index: 2;
                }
            </style>
        </head>
        <body>
            <div class="sticker-wrapper">
                <div class="sticker-design">
                    <div class="logo-container">
                        <img src="https://i.ibb.co/jk4cRdJ6/Copilot-20250626-091649-removebg-preview.png"
                             alt="Company Logo"
                             class="logo-img"
                             onerror="this.style.display='none';" />
                    </div>
                    
                    ${billNumber ? `
                        <div class="enamor-info" style="top: 10pt; left: 10pt;">${billNumber}</div>
                        <div class="enamor-info" style="top: 10pt; right: 10pt;">${billNumber}</div>
                        <div class="enamor-info" style="bottom: ${layout.reservedBottomSpace + 10}pt; left: 10pt;">${billNumber}</div>
                        <div class="enamor-info" style="bottom: ${layout.reservedBottomSpace + 10}pt; right: 10pt;">${billNumber}</div>
                    ` : ''}
                    
                    ${totalPcs ? `
                        <div class="enamor-info" style="top: 25pt; left: 10pt;">${totalPcs}</div>
                        <div class="enamor-info" style="top: 25pt; right: 10pt;">${totalPcs}</div>
                        <div class="enamor-info" style="bottom: ${layout.reservedBottomSpace + 25}pt; left: 10pt;">${totalPcs}</div>
                        <div class="enamor-info" style="bottom: ${layout.reservedBottomSpace + 25}pt; right: 10pt;">${totalPcs}</div>
                    ` : ''}

                    <div style="
                        font-size: ${layout.nameFontSize}pt;
                        font-weight: bold;
                        text-align: center;
                        color: #333;
                        line-height: 1;
                        margin-bottom: ${layout.line2 ? layout.lineSpacing : (layout.cityLines > 0 ? layout.lineSpacing * 1.5 : 0)}pt;
                        word-wrap: break-word;
                        max-width: 100%;
                        z-index: 2;
                        position: relative;
                    ">${layout.line1}</div>

                    ${layout.line2 ? `
                    <div style="
                        font-size: ${layout.nameFontSize}pt;
                        font-weight: bold;
                        text-align: center;
                        color: #333;
                        line-height: 1;
                        margin-bottom: ${layout.cityLines > 0 ? layout.lineSpacing * 1.5 : 0}pt;
                        word-wrap: break-word;
                        max-width: 100%;
                        z-index: 2;
                        position: relative;
                    ">${layout.line2}</div>` : ''}

                    ${selectedPartyForPrint.city ? `
                    <div class="city-parcel-container" style="margin-bottom: 0pt;">
                        <div style="
                            font-size: ${layout.cityFontSize}pt;
                            text-align: center;
                            color: #555;
                            font-weight: 500;
                            word-wrap: break-word;
                            ${layout.cityAlignLeft ? 'flex-shrink: 0;' : 'max-width: 100%;'}
                        ">${selectedPartyForPrint.city}</div>
                        
                        ${layout.hasParcel && layout.layoutType === 'cityWithParcel' ? `
                        <div class="parcel-circle">${layout.parcelNumber}P</div>` : ''}
                    </div>` : ''}

                    ${layout.hasParcel && layout.parcelBelowCity ? `
                    <div class="parcel-circle" style="margin-top: ${layout.lineSpacing * 0.3}pt;">${layout.parcelNumber}P</div>` : ''}

                    <div class="from-text">
                        FROM: KAMBESHWAR AGENCIES - MAPUSA GOA (9422593814)
                    </div>
                </div>
            </div>

            <script>
                window.onload = function () {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };

                window.onafterprint = function () {
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function createParcelModal() {
    const modalHTML = `
        <div id="parcelModal" class="parcel-modal">
            <div class="parcel-modal-content">
                <div class="parcel-modal-header">
                    <h2 class="parcel-modal-title">
                        📦 Set Number of Parcels
                    </h2>
                </div>
                <div class="parcel-modal-body">
                    <div class="parcel-party-name" id="parcelPartyName">
                        Party Name Will Appear Here
                    </div>
                    <div class="parcel-input-group">
                        <label class="parcel-input-label">Number of Parcels</label>
                        <input type="number" id="parcelNumberInput" class="parcel-number-input" 
                               min="0" max="20" value="0" placeholder="0">
                        <div class="parcel-input-hint">Enter 0-20 parcels (0 = no parcel display)</div>
                    </div>
                </div>
                <div class="parcel-modal-footer">
                    <button class="parcel-btn parcel-btn-save" onclick="saveParcelNumber()">
                        💾 Save
                    </button>
                    <button class="parcel-btn parcel-btn-cancel" onclick="closeParcelModal()">
                        ❌ Cancel
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Additional Info Modal for Enamor Stickers -->
        <div id="enamorInfoModal" class="enamor-info-modal">
            <div class="enamor-info-modal-content">
                <div class="enamor-info-modal-header">
                    <h2>📝 Additional Information (Enamor)</h2>
                </div>
                <div class="enamor-info-modal-body">
                    <div class="enamor-party-name" id="enamorPartyName">
                        Party Name Will Appear Here
                    </div>
                    
                    <div class="enamor-input-group">
                        <label>Bill Number (without K)</label>
                        <input type="text" id="enamorBillNumber" class="enamor-input" placeholder="Enter bill number">
                    </div>
                    
                    <div class="enamor-input-group">
                        <label>Total Pieces</label>
                        <input type="number" id="enamorTotalPcs" class="enamor-input" placeholder="Enter total pieces" min="1">
                    </div>
                </div>
                <div class="enamor-info-modal-footer">
                    <button class="enamor-btn enamor-btn-save" onclick="saveEnamorInfo()">
                        💾 Save
                    </button>
                    <button class="enamor-btn enamor-btn-cancel" onclick="closeEnamorInfoModal()">
                        ❌ Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modals to body if they don't exist
    if (!document.getElementById('parcelModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

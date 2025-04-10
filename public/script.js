// DOM Elements
const connectionAlert = document.getElementById('connection-alert');
const connectionStatus = document.getElementById('connection-status');
const parkingGrid = document.getElementById('parking-grid');
const lastUpdated = document.getElementById('last-updated');
const availableCount = document.getElementById('available-count');
const occupiedCount = document.getElementById('occupied-count');
const totalCount = document.getElementById('total-count');
const totalCount2 = document.getElementById('total-count-2');
const occupancyRate = document.getElementById('occupancy-rate');
const currentLotName = document.getElementById('current-lot-name');
const lotLocation = document.getElementById('lot-location');
const lotCapacity = document.getElementById('lot-capacity');

// Management elements
const addSpaceBtn = document.getElementById('add-space-btn');
const removeSpaceBtn = document.getElementById('remove-space-btn');
const selectionControls = document.getElementById('selection-controls');
const cancelSelectionBtn = document.getElementById('cancel-selection-btn');
const confirmSelectionBtn = document.getElementById('confirm-selection-btn');

// Modal elements
const addSpaceModal = document.getElementById('add-space-modal');
const closeModalBtn = document.querySelector('.close-modal');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const confirmAddBtn = document.getElementById('confirm-add-btn');
const spaceIdInput = document.getElementById('space-id');

// State
let parkingLots = {
    1: {
        name: 'Estacionamento A',
        location: 'Prédio Principal',
        capacity: 20,
        spaces: []
    },
    2: {
        name: 'Estacionamento B',
        location: 'Centro Comercial',
        capacity: 30,
        spaces: []
    },
    3: {
        name: 'Estacionamento C',
        location: 'Complexo de Escritórios',
        capacity: 15,
        spaces: []
    }
};

let currentLot = 1;
let isConnected = false;
let isSelectionMode = false;
let selectedSpaces = [];
let pollingInterval = null;

// Initialize with all spaces unavailable
function initializeData() {
    // Generate data for each lot with all spaces available (true)
    Object.keys(parkingLots).forEach(lotId => {
        const lot = parkingLots[lotId];
        lot.spaces = Array.from({ length: lot.capacity }, (_, i) => ({
            id: `P${i + 1}`,
            available: true,
            lotId: lotId
        }));
    });
    
    updateUI();
}

// Start polling for sensor data
function startPolling() {
    // Fetch initial data
    fetchSensorData();
    
    // Set up polling interval (every 2 seconds)
    pollingInterval = setInterval(fetchSensorData, 2000);
    
    // Update connection status
    setConnectionStatus(true);
}

// Stop polling
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    setConnectionStatus(false);
}

// Fetch sensor data from server
async function fetchSensorData() {
    try {
        const response = await fetch('/api/sensors');
        
        if (!response.ok) {
            throw new Error('Falha na conexão com o servidor');
        }
        
        const responseJson = await response.json();
        
        // Check if response contains data property (as per app.js structure)
        if (!responseJson.data || !Array.isArray(responseJson.data)) {
            throw new Error('Formato de dados inválido');
        }
        
        const data = responseJson.data;
        console.log('Dados recebidos:', data);
        
        // Process received data - map from database format to our application format
        if (data.length > 0) {
            data.forEach(sensorData => {
                if (sensorData && sensorData.idSensor && sensorData.hasOwnProperty('available') && sensorData.lot) {
                    const space = {
                        id: `P${sensorData.idSensor}`, // Format ID as "P{number}"
                        available: Boolean(sensorData.available), // Ensure boolean
                        lotId: sensorData.lot.toString(), // Convert to string to match our format
                        timestamp: new Date().toISOString() // Add current timestamp
                    };
                    
                    updateParkingSpace(space, space.lotId);
                }
            });
            
            updateLastUpdated();
            updateUI();
            
            // Set connected status to true if not already
            if (!isConnected) {
                setConnectionStatus(true);
            }
        }
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        setConnectionStatus(false);
    }
}

// Update connection status UI
function setConnectionStatus(connected) {
    isConnected = connected;
    
    if (connected) {
        document.body.classList.add('connected');
        connectionStatus.classList.remove('offline');
        connectionStatus.classList.add('online');
        connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Online</span>';
        connectionAlert.classList.add('hidden');
    } else {
        document.body.classList.remove('connected');
        connectionStatus.classList.remove('online');
        connectionStatus.classList.add('offline');
        connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Offline</span>';
        connectionAlert.classList.remove('hidden');
    }
}

// Update a single parking space
function updateParkingSpace(updatedSpace, lotId) {
    const index = parkingLots[lotId].spaces.findIndex(space => space.id === updatedSpace.id);
    
    if (index !== -1) {
        parkingLots[lotId].spaces[index] = { 
            ...parkingLots[lotId].spaces[index], 
            ...updatedSpace,
            timestamp: updatedSpace.timestamp || new Date().toISOString()
        };
        console.log(`Vaga ${updatedSpace.id} no estacionamento ${lotId} atualizada para ${updatedSpace.available ? 'disponível' : 'ocupada'}`);
    } else {
        // If the space doesn't exist yet, add it
        parkingLots[lotId].spaces.push({
            id: updatedSpace.id,
            available: updatedSpace.available,
            lotId: lotId,
            timestamp: updatedSpace.timestamp || new Date().toISOString()
        });
        console.log(`Nova vaga ${updatedSpace.id} adicionada ao estacionamento ${lotId}`);
    }
}

// Update the last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleTimeString();
}

// Render the parking grid for the current lot
function renderParkingGrid() {
    parkingGrid.innerHTML = '';
    
    const currentLotSpaces = parkingLots[currentLot].spaces;
    
    currentLotSpaces.forEach(space => {
        const spaceElement = document.createElement('div');
        spaceElement.className = `parking-space ${space.available ? 'available' : 'occupied'}`;
        
        // Add selectable class if in selection mode
        if (isSelectionMode) {
            spaceElement.classList.add('selectable');
            
            // Add selected class if this space is selected
            if (selectedSpaces.includes(space.id)) {
                spaceElement.classList.add('selected');
            }
        }
        
        spaceElement.id = `space-${space.id}`;
        spaceElement.dataset.id = space.id;
        
        const statusClass = space.available ? 'available' : 'occupied';
        const statusText = space.available ? 'Disponível' : 'Ocupada';
        
        spaceElement.innerHTML = `
            <div class="space-status ${statusClass}">${statusText}</div>
            <div class="space-icon ${statusClass}">
                <i class="fas fa-car"></i>
            </div>
            <div class="space-id">${space.id}</div>
            ${space.timestamp ? `<div class="space-time">${new Date(space.timestamp).toLocaleTimeString()}</div>` : ''}
        `;
        
        // Add click event for selection mode
        if (isSelectionMode) {
            spaceElement.addEventListener('click', () => toggleSpaceSelection(space.id));
        }
        
        parkingGrid.appendChild(spaceElement);
    });
}

// Toggle selection of a parking space
function toggleSpaceSelection(spaceId) {
    const index = selectedSpaces.indexOf(spaceId);
    
    if (index === -1) {
        // Add to selected spaces
        selectedSpaces.push(spaceId);
    } else {
        // Remove from selected spaces
        selectedSpaces.splice(index, 1);
    }
    
    // Update UI to reflect selection
    const spaceElement = document.getElementById(`space-${spaceId}`);
    if (spaceElement) {
        spaceElement.classList.toggle('selected', selectedSpaces.includes(spaceId));
    }
    
    // Update confirm button state
    confirmSelectionBtn.disabled = selectedSpaces.length === 0;
}

// Enter selection mode for removing spaces
function enterSelectionMode() {
    isSelectionMode = true;
    selectedSpaces = [];
    selectionControls.classList.remove('hidden');
    removeSpaceBtn.disabled = true;
    addSpaceBtn.disabled = true;
    
    // Update UI to make spaces selectable
    updateUI();
}

// Exit selection mode
function exitSelectionMode() {
    isSelectionMode = false;
    selectedSpaces = [];
    selectionControls.classList.add('hidden');
    removeSpaceBtn.disabled = false;
    addSpaceBtn.disabled = false;
    
    // Update UI to remove selectable state
    updateUI();
}

// Remove selected spaces
function removeSelectedSpaces() {
    if (selectedSpaces.length === 0) return;
    
    // Remove each selected space from the current lot
    selectedSpaces.forEach(spaceId => {
        const index = parkingLots[currentLot].spaces.findIndex(space => space.id === spaceId);
        if (index !== -1) {
            parkingLots[currentLot].spaces.splice(index, 1);
        }
    });
    
    // Update capacity
    parkingLots[currentLot].capacity = parkingLots[currentLot].spaces.length;
    
    // Exit selection mode and update UI
    exitSelectionMode();
    updateUI();
}

// Convert our UI space ID format (P1, P2, etc.) to database format (1, 2, etc.)
function extractSensorId(spaceId) {
    // Extract numeric part from "P1", "P2", etc.
    return parseInt(spaceId.replace(/P/i, ''));
}

// Add a new parking space
function addNewSpace(spaceId) {
    if (!spaceId) return;
    
    // Check if space ID already exists
    const exists = parkingLots[currentLot].spaces.some(space => space.id === spaceId);
    if (exists) {
        alert(`Vaga com ID ${spaceId} já existe no estacionamento atual.`);
        return false;
    }
    
    // Add new space
    parkingLots[currentLot].spaces.push({
        id: spaceId,
        available: true,
        lotId: currentLot.toString(),
        timestamp: new Date().toISOString()
    });
    
    // Update capacity
    parkingLots[currentLot].capacity = parkingLots[currentLot].spaces.length;
    
    // Send new space to server
    const sensorId = extractSensorId(spaceId);
    sendSpaceToServer(sensorId, currentLot, true);
    
    // Update UI
    updateUI();
    return true;
}

// Send space data to server
async function sendSpaceToServer(idSensor, lot, available) {
    try {
        const response = await fetch('/api/sensors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idSensor,
                lot,
                available
            })
        });
        
        if (!response.ok) {
            throw new Error('Falha ao enviar dados para o servidor');
        }
        
        console.log(`Dados da vaga ${idSensor} enviados com sucesso para o servidor`);
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
    }
}

// Show add space modal
function showAddSpaceModal() {
    addSpaceModal.classList.add('active');
    spaceIdInput.value = '';
    spaceIdInput.focus();
}

// Hide add space modal
function hideAddSpaceModal() {
    addSpaceModal.classList.remove('active');
}

// Update statistics for the current lot
function updateStats() {
    const currentLotSpaces = parkingLots[currentLot].spaces;
    const total = currentLotSpaces.length;
    const available = currentLotSpaces.filter(space => space.available).length;
    const occupied = total - available;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    availableCount.textContent = available;
    occupiedCount.textContent = occupied;
    totalCount.textContent = total;
    totalCount2.textContent = total;
    occupancyRate.textContent = `${rate}%`;
}

// Update lot information
function updateLotInfo() {
    const lot = parkingLots[currentLot];
    currentLotName.textContent = lot.name;
    lotLocation.textContent = lot.location;
    lotCapacity.textContent = `${lot.capacity} Vagas`;
}

// Update the entire UI
function updateUI() {
    renderParkingGrid();
    updateStats();
    updateLotInfo();
}

// Switch to a different parking lot
function switchParkingLot(lotId) {
    // Exit selection mode if active
    if (isSelectionMode) {
        exitSelectionMode();
    }
    
    currentLot = lotId;
    
    // Update active button
    document.querySelectorAll('.parking-button').forEach(button => {
        if (button.dataset.lot === lotId.toString()) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    updateUI();
}

// Initialize the application
function init() {
    initializeData(); // Initialize with all spaces available
    startPolling(); // Start fetching data periodically
    
    // Add event listeners to parking lot buttons
    document.querySelectorAll('.parking-button').forEach(button => {
        button.addEventListener('click', function() {
            const lotId = parseInt(this.dataset.lot);
            console.log('Botão clicado para estacionamento:', lotId);
            switchParkingLot(lotId);
        });
    });
    
    // Add event listeners for management buttons
    addSpaceBtn.addEventListener('click', showAddSpaceModal);
    removeSpaceBtn.addEventListener('click', enterSelectionMode);
    cancelSelectionBtn.addEventListener('click', exitSelectionMode);
    confirmSelectionBtn.addEventListener('click', removeSelectedSpaces);
    
    // Modal event listeners
    closeModalBtn.addEventListener('click', hideAddSpaceModal);
    cancelAddBtn.addEventListener('click', hideAddSpaceModal);
    confirmAddBtn.addEventListener('click', () => {
        const spaceId = spaceIdInput.value.trim();
        if (spaceId && addNewSpace(spaceId)) {
            hideAddSpaceModal();
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === addSpaceModal) {
            hideAddSpaceModal();
        }
    });
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        stopPolling();
    });
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

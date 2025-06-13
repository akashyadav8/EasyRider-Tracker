// Initialize socket connection with shared token if present
const urlParams = new URLSearchParams(window.location.search);
const sharedToken = urlParams.get('token') || (window.sharedToken ? window.sharedToken : null);
const socket = io({
    query: {
        token: sharedToken
    }
});

// Global variables
let watchId = null;
let isTracking = false;
let userMarker = null;
const markers = {};
let distanceLines = {};
let selectedUser = null;
let lastPosition = null;
let connectedUsers = 0;
let isSharedView = false;
let sharedTargetId = null;
let currentUser = null;
let routingControl = null; // New variable for routing control

// Group functionality
let groups = [];

// Generate a unique ID for groups
function generateGroupId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Create a new group
function createGroup(name) {
    const groupId = generateGroupId();
    const userId = currentUser ? currentUser.id : 'anonymous';
    const userName = currentUser ? currentUser.name : 'Anonymous';
    
    const group = {
        id: groupId,
        name: name,
        createdBy: userId,
        creatorName: userName,
        createdAt: new Date().toISOString(),
        members: [{ id: userId, name: userName, role: 'admin' }]
    };
    
    // Store in localStorage
    groups = JSON.parse(localStorage.getItem('groups') || '[]');
    groups.push(group);
    localStorage.setItem('groups', JSON.stringify(groups));
    
    return group;
}

// Generate a shareable link for a group
function generateGroupShareLink(groupId, groupName) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join-group/${groupId}?name=${encodeURIComponent(groupName)}`;
}

// Get group details for display
function getGroupDetails(groupId, groupName) {
    // This function will be removed
}

// Show group details modal
function showGroupDetailsModal(groupId, groupName) {
    // This function will be removed
}

// Handle Create Group Modal
function setupGroupModal() {
    const createGroupCard = document.getElementById('createGroupCard');
    const modal = document.getElementById('createGroupModal');
    const closeBtn = modal.querySelector('.close-modal-btn');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const joinExistingGroupBtn = document.getElementById('joinExistingGroupBtn');
    const groupNameInput = document.getElementById('groupName');
    const joinGroupIdInput = document.getElementById('joinGroupId');
    const groupCreatedSection = document.getElementById('groupCreatedSection');
    const groupShareLinkInput = document.getElementById('groupShareLink');
    const copyGroupLinkBtn = document.getElementById('copyGroupLinkBtn');
    
    // Open modal when clicking on the Create Groups card
    if (createGroupCard) {
        createGroupCard.addEventListener('click', () => {
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.add('visible');
            }, 10);
            groupNameInput.focus();
        });
    }
    
    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.classList.add('hidden');
                // Reset form state
                groupNameInput.value = '';
                joinGroupIdInput.value = '';
                groupCreatedSection.classList.add('hidden');
            }, 300);
        });
    }
    
    // Create group
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            const groupName = groupNameInput.value.trim();
            
            if (!groupName) {
                showNotification('Please enter a group name', 'error');
                return;
            }
            
            // Create the group
            const group = createGroup(groupName);
            
            // Generate share link
            const shareLink = generateGroupShareLink(group.id, group.name);
            
            // Update UI
            groupShareLinkInput.value = shareLink;
            groupCreatedSection.classList.remove('hidden');
            
            showNotification(`Group "${groupName}" created successfully!`, 'success');
        });
    }
    
    // Join existing group directly
    if (joinExistingGroupBtn) {
        joinExistingGroupBtn.addEventListener('click', () => {
            const groupIdOrLink = joinGroupIdInput.value.trim();
            
            if (!groupIdOrLink) {
                showNotification('Please enter a group ID or invite link', 'error');
                return;
            }
            
            // Check if it's a full URL or just an ID
            let groupId = groupIdOrLink;
            let groupName = "Group";
            
            // If it's a URL, extract the group ID
            if (groupIdOrLink.includes('/join-group/')) {
                try {
                    const url = new URL(groupIdOrLink);
                    const pathParts = url.pathname.split('/');
                    groupId = pathParts[pathParts.length - 1];
                    
                    // Try to get the group name from the URL
                    const params = new URLSearchParams(url.search);
                    if (params.has('name')) {
                        groupName = params.get('name');
                    }
                } catch (e) {
                    showNotification('Invalid group link format', 'error');
                    return;
                }
            }
            
            // Join the group directly
            const group = joinGroup(groupId, groupName);
            
            if (group) {
                showNotification(`Joined group "${group.name}" successfully!`, 'success');
                
                // Close modal after success
                modal.classList.remove('visible');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    joinGroupIdInput.value = '';
                }, 300);
            }
        });
    }
    
    // Copy share link
    if (copyGroupLinkBtn) {
        copyGroupLinkBtn.addEventListener('click', () => {
            groupShareLinkInput.select();
            document.execCommand('copy');
            showNotification('Link copied to clipboard!', 'success');
        });
    }
}

// Handle Group Details Modal
function setupGroupDetailsModal() {
    // This function will be removed
}

// Check for current user and update UI
function updateAuthUI() {
    const userJSON = localStorage.getItem('user');
    if (userJSON) {
        currentUser = JSON.parse(userJSON);
        
        // Update welcome message in hero section
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.innerHTML = `
                <span>Welcome, ${currentUser.name}</span>
                <button id="heroLogoutBtn" class="hero-logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            `;
            
            // Add event listener to logout button
            document.getElementById('heroLogoutBtn').addEventListener('click', () => {
                localStorage.removeItem('user');
                window.location.href = '/login';
            });
        }
    } else if (!sharedToken) {
        // Redirect to login if not logged in and not a shared view
        window.location.href = '/login';
    }
}

// Initialize map
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Marker colors
const markerColors = ['#E25555', '#4ADE80', '#4A90E2', '#F6A623', '#9B51E0', '#2196F3'];

// Create user icon
function createUserIcon(color, isPulsing = false) {
    const pulseRing = isPulsing ? 
        `<div class="pulse-ring" style="background-color: ${color}20;"></div>` : '';
    
    return L.divIcon({
        className: 'custom-marker',
        html: `<div class="user-marker">
                ${pulseRing}
                <div class="marker-dot" style="background-color: ${color}; border-color: ${color}"></div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// Get color for user marker
function getNextColor(userId) {
    const colorIndex = Math.abs(userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % markerColors.length;
    return markerColors[colorIndex];
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Update status display
function updateStatusDisplay(position) {
    const statusDiv = document.getElementById('locationStatus');
    const { latitude, longitude, accuracy } = position.coords;
    
    // Create or update status card
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = `
        <div class="status-card-header">
            <div class="status-card-title">
                <i class="fas fa-location-dot"></i> Location Details
            </div>
            <button class="status-card-close" id="closeStatusCard">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="status-content">
            <div class="status-item">
                <span>Latitude:</span>
                <span>${latitude.toFixed(6)}</span>
            </div>
            <div class="status-item">
                <span>Longitude:</span>
                <span>${longitude.toFixed(6)}</span>
            </div>
            <div class="status-item">
                <span>Accuracy:</span>
                <span>${Math.min(accuracy, 100).toFixed(1)}m</span>
            </div>
            <div class="status-item users-counter">
                <span>Connected Users:</span>
                <span class="user-count">${connectedUsers}</span>
            </div>
        </div>
    `;
    
    // Add event listener to close button
    document.getElementById('closeStatusCard').addEventListener('click', () => {
        statusDiv.classList.add('hidden');
        toggleStatusButton.classList.remove('hidden');
    });
    
    // Hide the toggle button when status card is shown
    if (toggleStatusButton) {
        toggleStatusButton.classList.add('hidden');
    }
}

// Handle location updates
function handleLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Format lastPosition properly for routing functionality
    lastPosition = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy
    };
    
    // Emit to server with user name from auth
    socket.emit('share-initial-location', {
        latitude,
        longitude,
        name: currentUser ? currentUser.name : `User-${Math.floor(Math.random() * 1000)}`
    });
    
    // Update user marker
    if (!userMarker) {
        userMarker = L.marker([latitude, longitude], { 
            icon: createUserIcon(markerColors[0], true)
        }).addTo(map);
        map.setView([latitude, longitude], 15);
    } else {
        userMarker.setLatLng([latitude, longitude]);
    }
    
    // Update accuracy circle
    if (window.accuracyCircle) map.removeLayer(window.accuracyCircle);
    window.accuracyCircle = L.circle([latitude, longitude], {
        radius: Math.min(accuracy, 100),
        color: markerColors[0],
        fillOpacity: 0.1
    }).addTo(map);
    
    updateStatusDisplay(position);
}

// Calculate distance to user and display route
function calculateDistanceToUser(targetId) {
    socket.emit('calculate-distance', {
        targetId: targetId,
        withRoute: true
    }, data => {
        if (data.error) {
            showNotification(data.error, 'error');
            return;
        }
        
        document.getElementById('straightDistance').textContent = data.straightDistance + ' ' + data.unit;
        document.getElementById('routeDistance').textContent = data.routeDistance ? data.routeDistance + ' ' + data.unit : 'N/A';
        
        document.getElementById('distancePanel').classList.remove('hidden');
        selectedUser = targetId;
        document.getElementById('targetUserName').textContent = markers[targetId]._tooltip ? markers[targetId]._tooltip._content : 'User';
        
        // Show route on map
        showRoute(lastPosition, markers[targetId].getLatLng());
    });
}

// Show route between two points using Leaflet Routing Machine
function showRoute(startPoint, endPoint) {
    // Remove existing routing control if any
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    
    if (!startPoint || !endPoint) {
        showNotification('Start or end point is missing', 'error');
        return;
    }
    
    // Ensure coordinates are properly formatted as LatLng objects
    let startLatLng, endLatLng;
    
    // Handle startPoint
    if (startPoint.coords) {
        // Handle browser geolocation Position object
        startLatLng = L.latLng(startPoint.coords.latitude, startPoint.coords.longitude);
    } else if (startPoint.lat !== undefined && startPoint.lng !== undefined) {
        // Handle {lat, lng} format
        startLatLng = L.latLng(startPoint.lat, startPoint.lng);
    } else if (Array.isArray(startPoint) && startPoint.length >= 2) {
        // Handle array format [lat, lng]
        startLatLng = L.latLng(startPoint[0], startPoint[1]);
    } else if (startPoint instanceof L.LatLng) {
        // Already a LatLng object
        startLatLng = startPoint;
    } else {
        showNotification('Invalid start point format', 'error');
        return;
    }
    
    // Handle endPoint
    if (endPoint.coords) {
        // Handle browser geolocation Position object
        endLatLng = L.latLng(endPoint.coords.latitude, endPoint.coords.longitude);
    } else if (endPoint.lat !== undefined && endPoint.lng !== undefined) {
        // Handle {lat, lng} format
        endLatLng = L.latLng(endPoint.lat, endPoint.lng);
    } else if (Array.isArray(endPoint) && endPoint.length >= 2) {
        // Handle array format [lat, lng]
        endLatLng = L.latLng(endPoint[0], endPoint[1]);
    } else if (endPoint instanceof L.LatLng) {
        // Already a LatLng object
        endLatLng = endPoint;
    } else {
        showNotification('Invalid end point format', 'error');
        return;
    }
    
    // Create routing control
    routingControl = L.Routing.control({
        waypoints: [
            startLatLng,
            endLatLng
        ],
        routeWhileDragging: false,
        showAlternatives: true,
        fitSelectedRoutes: true,
        lineOptions: {
            styles: [
                { color: 'black', opacity: 0.15, weight: 9 },
                { color: '#6366f1', opacity: 0.8, weight: 6 },
                { color: 'white', opacity: 0.8, weight: 2 }
            ]
        },
        altLineOptions: {
            styles: [
                { color: 'black', opacity: 0.15, weight: 9 },
                { color: '#94a3b8', opacity: 0.8, weight: 6 },
                { color: 'white', opacity: 0.8, weight: 2 }
            ]
        },
        createMarker: function() { return null; } // Don't create additional markers
    }).addTo(map);
    
    // Hide the control panel for cleaner UI
    const controlContainer = routingControl.getContainer();
    if (controlContainer) {
        controlContainer.style.display = 'none';
    }
}

// Hide route when closing distance panel
function hideRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
}

// Draw line between users
function drawDistanceLine(user1Id, user2Id) {
    if (!markers[user1Id] || !markers[user2Id]) return;
    
    const latlng1 = markers[user1Id].getLatLng();
    const latlng2 = markers[user2Id].getLatLng();
    
    // Remove existing line
    if (distanceLines[user2Id]) {
        map.removeLayer(distanceLines[user2Id]);
    }
    
    // Create new line
    distanceLines[user2Id] = L.polyline([latlng1, latlng2], {
        color: '#4A90E2',
        weight: 2,
        dashArray: '5, 5'
    }).addTo(map);
}

// Generate share link
function generateShareLink() {
    socket.emit('generate-share-link', {}, (response) => {
        const shareUrl = response.url;
        
        // Create share dialog
        const shareDialog = document.createElement('div');
        shareDialog.className = 'share-dialog';
        shareDialog.innerHTML = `
            <div class="share-content">
                <h3>Share Your Live Location</h3>
                <div class="share-url">
                    <input type="text" id="shareUrlInput" value="${shareUrl}" readonly>
                    <button id="copyShareUrl" class="copy-btn">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <p>Anyone with this link can view your live location</p>
                <button class="close-share-dialog">Close</button>
            </div>
        `;
        
        document.body.appendChild(shareDialog);
        
        // Add event listeners
        document.getElementById('copyShareUrl').addEventListener('click', () => {
            const input = document.getElementById('shareUrlInput');
            input.select();
            document.execCommand('copy');
            showNotification('Link copied to clipboard!', 'success');
        });
        
        document.querySelector('.close-share-dialog').addEventListener('click', () => {
            shareDialog.remove();
        });
    });
}

// Route Map Modal Variables
let routeMap = null;
let routeMapRoutingControl = null;
let currentStep = 1;
let searchedLocations = {
    start: null,
    end: null
};

// Initialize route map modal
function initRouteMapModal() {
    const viewRouteMapBtn = document.getElementById('viewRouteMapBtn');
    const routeMapModal = document.getElementById('routeMapModal');
    const closeBtn = routeMapModal.querySelector('.close-modal-btn');
    
    // Form elements
    const step1Form = document.getElementById('step1Form');
    const step2Form = document.getElementById('step2Form');
    const step3Summary = document.getElementById('step3Summary');
    const startPointSearch = document.getElementById('startPointSearch');
    const destinationSearch = document.getElementById('destinationSearch');
    const searchStartBtn = document.getElementById('searchStartBtn');
    const searchDestBtn = document.getElementById('searchDestBtn');
    const backToStep1 = document.getElementById('backToStep1');
    const resetRouteBtn = document.getElementById('resetRouteBtn');
    const startLocationError = document.getElementById('startLocationError');
    const destinationError = document.getElementById('destinationError');
    const startPointLabel = document.getElementById('startPointLabel');
    const destinationLabel = document.getElementById('destinationLabel');
    const searchSpinner = document.getElementById('searchSpinner');
    
    // Initialize the map if it doesn't exist
    if (!routeMap) {
        routeMap = L.map('routeMap').setView([51.505, -0.09], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(routeMap);
    }
    
    // Open modal
    if (viewRouteMapBtn) {
        viewRouteMapBtn.addEventListener('click', () => {
            routeMapModal.classList.remove('hidden');
            setTimeout(() => {
                routeMapModal.classList.add('visible');
                // Ensure the map renders correctly
                setTimeout(() => {
                    routeMap.invalidateSize();
                }, 10);
            }, 10);
        });
    }
    
    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            routeMapModal.classList.remove('visible');
            setTimeout(() => {
                routeMapModal.classList.add('hidden');
                
                // Clean up routing control
                if (routeMapRoutingControl) {
                    routeMap.removeControl(routeMapRoutingControl);
                    routeMapRoutingControl = null;
                }
            }, 300);
        });
    }
    
    // Search for a location using Nominatim
    async function searchLocation(query, type) {
        if (!query.trim()) {
            showError(type === 'start' ? startLocationError : destinationError, 'Please enter a location');
            return;
        }
        
        showSpinner(true);
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                const location = {
                    lat: Number.parseFloat(data[0].lat),
                    lng: Number.parseFloat(data[0].lon),
                    name: data[0].display_name
                };
                
                if (type === 'start') {
                    searchedLocations.start = location;
                    moveToStep(2);
                } else {
                    searchedLocations.end = location;
                    moveToStep(3);
                    createRoute();
                }
            } else {
                showError(
                    type === 'start' ? startLocationError : destinationError,
                    `Could not find location: ${query}`
                );
            }
        } catch (err) {
            showError(
                type === 'start' ? startLocationError : destinationError,
                'Error searching for location. Please try again.'
            );
            console.error(err);
        } finally {
            showSpinner(false);
        }
    }
    
    // Show or hide the loading spinner
    function showSpinner(show) {
        searchSpinner.classList.toggle('hidden', !show);
    }
    
    // Show error message
    function showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }
    
    // Change the current step
    function moveToStep(step) {
        currentStep = step;
        step1Form.classList.toggle('hidden', step !== 1);
        step2Form.classList.toggle('hidden', step !== 2);
        step3Summary.classList.toggle('hidden', step !== 3);
        
        if (step === 3) {
            startPointLabel.textContent = searchedLocations.start.name;
            destinationLabel.textContent = searchedLocations.end.name;
        }
    }
    
    // Create a route between the selected locations
    function createRoute() {
        // Clean up existing routing control
        if (routeMapRoutingControl) {
            routeMap.removeControl(routeMapRoutingControl);
            routeMapRoutingControl = null;
        }
        
        const startPoint = L.latLng(searchedLocations.start.lat, searchedLocations.start.lng);
        const endPoint = L.latLng(searchedLocations.end.lat, searchedLocations.end.lng);
        
        // Create bounds to fit both markers
        const bounds = L.latLngBounds(startPoint, endPoint);
        routeMap.fitBounds(bounds, { padding: [50, 50] });
        
        // Create routing control
        routeMapRoutingControl = L.Routing.control({
            waypoints: [startPoint, endPoint],
            routeWhileDragging: false,
            showAlternatives: true,
            fitSelectedRoutes: true,
            lineOptions: {
                styles: [
                    { color: 'black', opacity: 0.15, weight: 9 },
                    { color: '#6366f1', opacity: 0.8, weight: 6 },
                    { color: 'white', opacity: 0.8, weight: 2 }
                ]
            },
            altLineOptions: {
                styles: [
                    { color: 'black', opacity: 0.15, weight: 9 },
                    { color: '#94a3b8', opacity: 0.8, weight: 6 },
                    { color: 'white', opacity: 0.8, weight: 2 }
                ]
            }
        }).addTo(routeMap);
        
        // Add custom markers with popups
        L.marker(startPoint)
            .addTo(routeMap)
            .bindPopup("Starting Point: " + searchedLocations.start.name);
        
        L.marker(endPoint)
            .addTo(routeMap)
            .bindPopup("Destination: " + searchedLocations.end.name);
    }
    
    // Reset the form and map
    function resetForm() {
        moveToStep(1);
        startPointSearch.value = '';
        destinationSearch.value = '';
        searchedLocations = { start: null, end: null };
        
        if (routeMapRoutingControl) {
            routeMap.removeControl(routeMapRoutingControl);
            routeMapRoutingControl = null;
        }
        
        // Clear all markers and overlays
        routeMap.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                routeMap.removeLayer(layer);
            }
        });
        
        // Reset the map view
        routeMap.setView([51.505, -0.09], 2);
    }
    
    // Event listeners
    searchStartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchLocation(startPointSearch.value, 'start');
    });
    
    searchDestBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchLocation(destinationSearch.value, 'end');
    });
    
    // Allow pressing Enter to submit
    startPointSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocation(startPointSearch.value, 'start');
        }
    });
    
    destinationSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocation(destinationSearch.value, 'end');
        }
    });
    
    backToStep1.addEventListener('click', () => {
        moveToStep(1);
    });
    
    resetRouteBtn.addEventListener('click', resetForm);
}

// Initialize UI events
function initUIEvents() {
    // Start/stop tracking
    document.getElementById('liveLocationBtn').addEventListener('click', () => {
        if (!isTracking) {
            if (startLocationTracking()) {
                isTracking = true;
                document.getElementById('liveLocationBtn').classList.add('active');
                document.getElementById('liveLocationBtn').querySelector('.button-content').textContent = 'Stop Tracking';
            }
        } else {
            stopLocationTracking();
            document.getElementById('liveLocationBtn').querySelector('.button-content').textContent = 'Start Tracking';
        }
    });
    
    // Start tracking button
    document.getElementById('startTrackingBtn').addEventListener('click', showMap);
    document.querySelector('.get-started-btn') && document.querySelector('.get-started-btn').addEventListener('click', showMap);
    
    // Create toggle button for status card
    createStatusToggleButton();
    
    // Close distance panel
    document.getElementById('closeDistancePanel').addEventListener('click', () => {
        document.getElementById('distancePanel').classList.add('hidden');
        selectedUser = null;
        hideRoute(); // Hide the route when closing the panel
        
        // Remove all distance lines
        Object.values(distanceLines).forEach(line => map.removeLayer(line));
        distanceLines = {};
    });
    
    // Initialize route map modal
    initRouteMapModal();
}

// Create a toggle button to show/hide the status card
let toggleStatusButton;
function createStatusToggleButton() {
    // Create the button if it doesn't exist
    if (!toggleStatusButton) {
        toggleStatusButton = document.createElement('button');
        toggleStatusButton.id = 'toggleStatusBtn';
        toggleStatusButton.className = 'status-toggle-btn';
        toggleStatusButton.innerHTML = '<i class="fas fa-info-circle"></i> Show Location Details';
        document.body.appendChild(toggleStatusButton);
        
        // Add click event to show the status card
        toggleStatusButton.addEventListener('click', () => {
            const statusDiv = document.getElementById('locationStatus');
            statusDiv.classList.remove('hidden');
            toggleStatusButton.classList.add('hidden');
        });
        
        // Initially hide if status card is visible
        if (document.getElementById('locationStatus') && 
            !document.getElementById('locationStatus').classList.contains('hidden')) {
            toggleStatusButton.classList.add('hidden');
        }
    }
}

// Socket event handlers
socket.on('receive-location', (data) => {
    const { id, latitude, longitude, name } = data;
    
    if (id !== socket.id) {
        const userColor = getNextColor(id);
        
        if (!markers[id]) {
            markers[id] = L.marker([latitude, longitude], {
                icon: createUserIcon(userColor)
            }).addTo(map);
            
            // Add click handler to show distance
            markers[id].on('click', () => {
                selectedUser = id;
                document.getElementById('targetUserName').textContent = name;
                document.getElementById('distancePanel').classList.remove('hidden');
                calculateDistanceToUser(id);
            });
        } else {
            markers[id].setLatLng([latitude, longitude]);
        }
    }
});

socket.on('users-count', (count) => {
    connectedUsers = count;
    document.getElementById('usersCount').textContent = count;
    if (lastPosition) updateStatusDisplay(lastPosition);
});

socket.on('users-list', (users) => {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        // Find user's group if available (kept for future reference but not displayed)
        const userGroup = findUserGroup(user.id);
        
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.innerHTML = `
            <span class="user-color" style="background-color: ${getNextColor(user.id)}"></span>
            <span class="user-name">${user.name}</span>
        `;
        
        userElement.addEventListener('click', () => {
            selectedUser = user.id;
            document.getElementById('targetUserName').textContent = user.name;
            document.getElementById('distancePanel').classList.remove('hidden');
            calculateDistanceToUser(user.id);
            
            // Center map on user
            if (markers[user.id]) {
                map.setView(markers[user.id].getLatLng(), map.getZoom());
            }
        });
        
        usersList.appendChild(userElement);
    });
});

// Find which group a user belongs to
function findUserGroup(userId) {
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    for (const group of groups) {
        if (group.members.some(member => member.id === userId)) {
            return group;
        }
    }
    return null;
}

socket.on('user-disconnected', (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    if (distanceLines[id]) {
        map.removeLayer(distanceLines[id]);
        delete distanceLines[id];
    }
});

socket.on('shared-target', (targetId) => {
    isSharedView = true;
    sharedTargetId = targetId;
    
    // Hide unnecessary UI elements for shared view
    document.getElementById('liveLocationBtn').style.display = 'none';
    document.getElementById('locationStatus').style.display = 'none';
    
    // Show message
    const statusDiv = document.getElementById('locationStatus');
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = `
        <div class="status-content">
            <h3>Viewing Shared Location</h3>
            <p>You're viewing a shared live location</p>
        </div>
    `;
});

// Join an existing group
function joinGroup(groupId, groupName) {
    // Get current groups
    groups = JSON.parse(localStorage.getItem('groups') || '[]');
    
    // Check if group already exists in localStorage
    const existingGroup = groups.find(g => g.id === groupId);
    
    if (existingGroup) {
        // Check if user is already a member
        const userId = currentUser ? currentUser.id : 'anonymous';
        const isMember = existingGroup.members.some(m => m.id === userId);
        
        if (isMember) {
            showNotification(`You are already a member of "${existingGroup.name}"`, 'info');
            return existingGroup;
        } else {
            // Add user to existing group
            const userName = currentUser ? currentUser.name : 'Anonymous';
            existingGroup.members.push({
                id: userId,
                name: userName,
                role: 'member',
                joinedAt: new Date().toISOString()
            });
            
            localStorage.setItem('groups', JSON.stringify(groups));
            showNotification(`You have joined "${existingGroup.name}"`, 'success');
            return existingGroup;
        }
    } else {
        // Create a new group record since it doesn't exist locally
        const userId = currentUser ? currentUser.id : 'anonymous';
        const userName = currentUser ? currentUser.name : 'Anonymous';
        
        const newGroup = {
            id: groupId,
            name: groupName,
            createdBy: 'external',
            createdAt: new Date().toISOString(),
            members: [{
                id: userId,
                name: userName,
                role: 'member',
                joinedAt: new Date().toISOString()
            }]
        };
        
        groups.push(newGroup);
        localStorage.setItem('groups', JSON.stringify(groups));
        showNotification(`You have joined "${groupName}"`, 'success');
        return newGroup;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Update UI based on auth status
    updateAuthUI();
    
    // Setup modal functionality
    setupGroupModal();
    
    // Check if this is a join group request
    if (window.joinGroup && currentUser) {
        const groupId = window.joinGroup.id;
        const groupName = window.joinGroup.name;
        
        // Join the group automatically
        const group = joinGroup(groupId, groupName);
        
        if (group) {
            showNotification(`Joined group "${group.name}" successfully!`, 'success');
        }
    }
    
    initUIEvents();
    
    // Add a sample user for demonstration if needed
    if (document.getElementById('usersList') && document.getElementById('usersList').children.length === 0) {
        const sampleUser = document.createElement('div');
        sampleUser.className = 'user-item';
        sampleUser.innerHTML = `
            <span class="user-color" style="background-color: #4ADE80"></span>
            <span class="user-name">John Doe</span>
        `;
        document.getElementById('usersList').appendChild(sampleUser);
        
        // Update the user count
        document.getElementById('usersCount').textContent = '1';
    }
    
    // Check if this is a shared view
    if (sharedToken) {
        document.getElementById('startTrackingBtn').style.display = 'none';
    }
    
    // Add event listener for dashboard button
    const dashboardBtn = document.getElementById('goDashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            // Check if user is logged in
            const currentUser = localStorage.getItem('user');
            if (!currentUser) {
                // Create a mock user if none exists
                const mockUser = {
                    id: 'mock-' + Date.now().toString(),
                    name: 'Guest User',
                    email: 'guest@example.com'
                };
                localStorage.setItem('user', JSON.stringify(mockUser));
                showNotification('Created temporary user for demonstration', 'info');
            }
            
            // Redirect to the dashboard page
            window.location.href = '/dashboard';
        });
    }
});

// Helper functions
function showMap() {
    document.querySelector('.hero').style.display = 'none';
    document.querySelector('.map-section').classList.remove('hidden');
    setTimeout(() => map.invalidateSize(), 100);
}

function backToHome() {
    if (isTracking) stopLocationTracking();
    document.querySelector('.hero').style.display = 'block';
    document.querySelector('.map-section').classList.add('hidden');
}

function startLocationTracking() {
    if (!navigator.geolocation) {
        showNotification('Geolocation not supported', 'error');
        return false;
    }

    watchId = navigator.geolocation.watchPosition(
        handleLocationUpdate,
        (error) => showNotification('Location error: ' + error.message, 'error'),
        { enableHighAccuracy: true }
    );
    
    isTracking = true;
    return true;
}

function stopLocationTracking() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    isTracking = false;
    
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    
    document.getElementById('locationStatus').classList.add('hidden');
}

// Weather Modal Logic
const showWeatherBtn = document.getElementById('showWeatherBtn');
const weatherModal = document.getElementById('weatherModal');
const closeWeatherModal = document.getElementById('closeWeatherModal');
const weatherModalBody = document.getElementById('weatherModalBody');

if (showWeatherBtn && weatherModal && closeWeatherModal && weatherModalBody) {
    showWeatherBtn.addEventListener('click', () => {
        weatherModal.classList.remove('hidden');
        setTimeout(() => weatherModal.classList.add('visible'), 10);
        weatherModalBody.innerHTML = '<div class="weather-loading">Loading weather...</div>';
        getAndShowWeather();
    });

    closeWeatherModal.addEventListener('click', () => {
        weatherModal.classList.remove('visible');
        setTimeout(() => weatherModal.classList.add('hidden'), 300);
    });
}

function getAndShowWeather() {
    if (!navigator.geolocation) {
        weatherModalBody.innerHTML = '<div class="weather-loading">Geolocation not supported. Showing Mumbai weather...</div>';
        fetchMumbaiWeather();
        return;
    }

    weatherModalBody.innerHTML = '<div class="weather-loading">Getting your location...</div>';
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        weatherModalBody.innerHTML = '<div class="weather-loading">Fetching weather data...</div>';
        
        try {
            const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to fetch weather');
            }
            const data = await res.json();
            weatherModalBody.innerHTML = renderWeather(data);
        } catch (error) {
            console.error('Weather fetch error:', error);
            weatherModalBody.innerHTML = `
                <div class="weather-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${error.message}</p>
                    <p>Showing Mumbai weather instead...</p>
                </div>
            `;
            fetchMumbaiWeather();
        }
    }, (error) => {
        console.error('Geolocation error:', error);
        weatherModalBody.innerHTML = `
            <div class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>${getGeolocationErrorMessage(error)}</p>
                <p>Showing Mumbai weather instead...</p>
            </div>
        `;
        fetchMumbaiWeather();
    });
}

function fetchMumbaiWeather() {
    const mumbaiLat = 19.0760;
    const mumbaiLon = 72.8777;
    
    fetch(`/api/weather?lat=${mumbaiLat}&lon=${mumbaiLon}`)
        .then(async res => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to fetch Mumbai weather');
            }
            return res.json();
        })
        .then(data => {
            weatherModalBody.innerHTML = renderWeather(data);
        })
        .catch(error => {
            console.error('Mumbai weather fetch error:', error);
            weatherModalBody.innerHTML = `
                <div class="weather-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to fetch weather data. Please try again later.</p>
                </div>
            `;
        });
}

function getGeolocationErrorMessage(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return "Location access was denied. Please enable location services.";
        case error.POSITION_UNAVAILABLE:
            return "Location information is unavailable.";
        case error.TIMEOUT:
            return "The request to get location timed out.";
        default:
            return "An unknown error occurred.";
    }
}

function renderWeather(data) {
    // Helper for weather icon
    const iconMap = {
        'Clear': '<i class="fas fa-sun" style="color:#fbbf24"></i>',
        'Sunny': '<i class="fas fa-sun" style="color:#fbbf24"></i>',
        'Partly cloudy': '<i class="fas fa-cloud-sun" style="color:#fbbf24"></i>',
        'Clouds': '<i class="fas fa-cloud" style="color:#64748b"></i>',
        'Cloudy': '<i class="fas fa-cloud" style="color:#64748b"></i>',
        'Rain': '<i class="fas fa-cloud-showers-heavy" style="color:#38bdf8"></i>',
        'Drizzle': '<i class="fas fa-cloud-rain" style="color:#38bdf8"></i>',
        'Thunderstorm': '<i class="fas fa-bolt" style="color:#f59e42"></i>',
        'Snow': '<i class="fas fa-snowflake" style="color:#60a5fa"></i>',
        'Mist': '<i class="fas fa-smog" style="color:#a3a3a3"></i>',
        'Fog': '<i class="fas fa-smog" style="color:#a3a3a3"></i>',
        'Haze': '<i class="fas fa-smog" style="color:#a3a3a3"></i>',
    };

    // Weather severity styles
    const severityStyles = {
        severe: {
            background: '#fee2e2',
            border: '2px solid #ef4444',
            color: '#991b1b'
        },
        moderate: {
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            color: '#1e40af'
        },
        normal: {
            background: '#dcfce7',
            border: '2px solid #22c55e',
            color: '#166534'
        }
    };

    const current = data.current;
    const forecast = data.forecast;
    const location = data.location || 'Current Location';

    // Get severity style
    const severityStyle = severityStyles[current.severity] || severityStyles.normal;

    return `
        <div class="weather-location">${location}</div>
        <div class="weather-current" style="background: ${severityStyle.background}; border: ${severityStyle.border};">
            <div class="weather-current-main">
                <div class="weather-current-temp" style="color: ${severityStyle.color}">${current.temp}°F</div>
                <div class="weather-current-icon">${iconMap[current.main] || ''}</div>
            </div>
            <div class="weather-current-details">
                <div>Feels Like: ${current.feels_like}°F</div>
                <div>Humidity: ${current.humidity}%</div>
                <div>Wind: ${current.wind_speed} mph</div>
                <div class="weather-description" style="color: ${severityStyle.color}">${current.description}</div>
            </div>
            ${current.severity === 'severe' ? `
                <div class="weather-alert" style="background: #fee2e2; color: #991b1b; padding: 10px; margin-top: 10px; border-radius: 5px; text-align: center;">
                    <i class="fas fa-exclamation-triangle"></i> Severe Weather Alert
                </div>
            ` : ''}
            ${current.severity === 'moderate' ? `
                <div class="weather-alert" style="background: #dbeafe; color: #1e40af; padding: 10px; margin-top: 10px; border-radius: 5px; text-align: center;">
                    <i class="fas fa-cloud-rain"></i> Moderate Weather Conditions
                </div>
            ` : ''}
        </div>
        <div class="weather-forecast">
            <div class="weather-forecast-title">5-Day Forecast</div>
            <div class="weather-forecast-list">
                ${forecast.map(day => `
                    <div class="weather-forecast-day">
                        <div class="day">${day.day}</div>
                        <div class="icon">${iconMap[day.main] || ''}</div>
                        <div class="temp">${day.temp}°F</div>
                        <div class="desc">${day.description}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
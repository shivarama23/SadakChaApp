// Configuration
const API_BASE = '/api/potholes';
const NAGPUR_CENTER = [21.1458, 79.0882];
const ZOOM_LEVEL = 13;
const SELECTED_SEVERITY = new Map();

// Map & Marker Cluster Group
let map;
let markerClusterGroup;
let selectedSeverity = null;

// Initialize map
function initMap() {
    map = L.map('map').setView(NAGPUR_CENTER, ZOOM_LEVEL);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 10
    }).addTo(map);

    // Initialize marker cluster group
    markerClusterGroup = L.markerClusterGroup();
    map.addLayer(markerClusterGroup);

    // Handle map clicks for reporting
    map.on('click', handleMapClick);

    // Load initial potholes
    loadPotholes();

    // Load stats
    loadStats();

    // Set up auto-refresh (optional)
    setInterval(loadPotholes, 30000); // Refresh every 30 seconds
    setInterval(loadStats, 60000);    // Refresh stats every 60 seconds
}

// Load potholes from API
function loadPotholes() {
    const bounds = map.getBounds();
    const params = new URLSearchParams({
        min_lat: bounds.getSouth(),
        max_lat: bounds.getNorth(),
        min_lon: bounds.getWest(),
        max_lon: bounds.getEast()
    });

    fetch(`${API_BASE}?${params}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load potholes');
            return response.json();
        })
        .then(potholes => {
            markerClusterGroup.clearLayers();
            potholes.forEach(pothole => addPotholeMarker(pothole));
        })
        .catch(error => {
            console.error('Error loading potholes:', error);
            showError('Failed to load potholes from map');
        });
}

// Add a pothole marker to the map
function addPotholeMarker(pothole) {
    const lat = pothole.lat;
    const lon = pothole.lon;
    const severity = pothole.severity;

    let markerColor;
    let severityEmoji;

    switch (severity) {
        case 'LOW':
            markerColor = '#4CAF50';
            severityEmoji = '🟢';
            break;
        case 'MEDIUM':
            markerColor = '#FFC107';
            severityEmoji = '🟡';
            break;
        case 'DANGEROUS':
            markerColor = '#F44336';
            severityEmoji = '🔴';
            break;
    }

    const marker = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: markerColor,
        color: markerColor,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.7
    });

    const popupContent = `
        <div>
            <strong>${severityEmoji} ${severity}</strong><br>
            <small>${new Date(pothole.created_at).toLocaleDateString()}</small><br>
            ${pothole.description ? `<p><small>${pothole.description}</small></p>` : ''}
        </div>
    `;

    marker.bindPopup(popupContent);
    markerClusterGroup.addLayer(marker);
}

// Selected location marker (for reporting)
let selectedLocationMarker = null;

// Handle map click for reporting
function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    showLocationPin(lat, lon);
}

// Show a draggable pin at the selected location
function showLocationPin(lat, lon) {
    // Remove previous selected location marker if exists
    if (selectedLocationMarker) {
        map.removeLayer(selectedLocationMarker);
    }

    // Create a red draggable marker
    selectedLocationMarker = L.marker([lat, lon], {
        draggable: true,
        autoPan: true
    }).addTo(map);

    // Custom red icon
    const redIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="
            background-color: #FF6B6B;
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
    selectedLocationMarker.setIcon(redIcon);

    // Update popup content with current coordinates
    function updatePopup(lat, lon) {
        selectedLocationMarker.bindPopup(`
            <div style="text-align: center; min-width: 180px;">
                <strong>📍 Selected Location</strong><br>
                <small style="color: #666;">${lat.toFixed(5)}, ${lon.toFixed(5)}</small><br>
                <small style="color: #888;">Drag pin to adjust</small><br>
                <button onclick="openReportModal(${lat}, ${lon}); removeSelectedPin();"
                        style="margin-top: 10px; padding: 8px 16px; background: #FF6B6B; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Report Pothole Here
                </button>
            </div>
        `).openPopup();
    }

    // Show initial popup
    updatePopup(lat, lon);

    // Update popup when marker is dragged
    selectedLocationMarker.on('dragend', function(e) {
        const newPos = e.target.getLatLng();
        updatePopup(newPos.lat, newPos.lng);
    });
}

// Remove selected location pin
function removeSelectedPin() {
    if (selectedLocationMarker) {
        map.removeLayer(selectedLocationMarker);
        selectedLocationMarker = null;
    }
}

// Open report modal
function openReportModal(lat, lon) {
    const modal = document.getElementById('reportModal');
    const coordsEl = document.getElementById('modalCoords');

    coordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    // Store coordinates in modal
    modal.dataset.lat = lat;
    modal.dataset.lon = lon;

    // Reset form
    selectedSeverity = null;
    document.querySelectorAll('.severity-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('description').value = '';
    document.getElementById('submitStatus').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').textContent = 'Submit Report';

    // Check for nearby reports
    checkNearby(lat, lon);

    modal.classList.add('show');
}

// Close report modal
function closeReportModal() {
    const modal = document.getElementById('reportModal');
    modal.classList.remove('show');
    // Remove selected pin when modal is closed
    removeSelectedPin();
}

// Check for nearby potholes
function checkNearby(lat, lon) {
    const params = new URLSearchParams({ lat, lon });

    fetch(`${API_BASE}/nearby-check?${params}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to check nearby');
            return response.json();
        })
        .then(data => {
            const warningEl = document.getElementById('nearbyWarning');
            const countEl = document.getElementById('nearbyCount');

            if (data.nearby_count > 0) {
                countEl.textContent = data.nearby_count;
                warningEl.style.display = 'block';
            } else {
                warningEl.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error checking nearby:', error);
        });
}

// Submit report
function submitReport() {
    const modal = document.getElementById('reportModal');
    const lat = parseFloat(modal.dataset.lat);
    const lon = parseFloat(modal.dataset.lon);
    const description = document.getElementById('description').value.trim();
    const statusEl = document.getElementById('submitStatus');
    const submitBtn = document.getElementById('submitBtn');

    if (!selectedSeverity) {
        showError('Please select a severity level');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const payload = {
        lat,
        lon,
        severity: selectedSeverity,
        description: description || null
    };

    fetch(API_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.detail || 'Failed to submit report');
                });
            }
            return response.json();
        })
        .then(pothole => {
            statusEl.className = 'success';
            statusEl.textContent = '✅ Report submitted successfully!';
            statusEl.style.display = 'block';

            // Add new marker to map immediately
            addPotholeMarker(pothole);

            // Close modal after 2 seconds
            setTimeout(() => {
                closeReportModal();
                loadStats(); // Update stats
            }, 2000);
        })
        .catch(error => {
            console.error('Error submitting report:', error);
            statusEl.className = 'error';
            statusEl.textContent = `❌ ${error.message}`;
            statusEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Report';
        });
}

// Load statistics
function loadStats() {
    fetch(`${API_BASE}/stats`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load stats');
            return response.json();
        })
        .then(stats => {
            document.getElementById('totalCount').textContent = stats.total_count;
            document.getElementById('lowCount').textContent = stats.by_severity.LOW || 0;
            document.getElementById('mediumCount').textContent = stats.by_severity.MEDIUM || 0;
            document.getElementById('dangerousCount').textContent = stats.by_severity.DANGEROUS || 0;
        })
        .catch(error => {
            console.error('Error loading stats:', error);
        });
}

// Current location marker
let currentLocationMarker = null;

// Geolocation
function geolocate() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    // Show loading state
    const geolocateBtn = document.getElementById('geolocateBtn');
    const originalText = geolocateBtn.textContent;
    geolocateBtn.textContent = '📍 Locating...';
    geolocateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy; // in meters

            // Remove previous location marker if exists
            if (currentLocationMarker) {
                map.removeLayer(currentLocationMarker);
            }

            // Create a blue pulsing marker for current location
            currentLocationMarker = L.circleMarker([lat, lon], {
                radius: 12,
                fillColor: '#4285F4',
                color: '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            // Add accuracy circle
            const accuracyCircle = L.circle([lat, lon], {
                radius: accuracy,
                fillColor: '#4285F4',
                fillOpacity: 0.1,
                color: '#4285F4',
                weight: 1
            }).addTo(map);

            // Bind popup to marker
            currentLocationMarker.bindPopup(`
                <div style="text-align: center;">
                    <strong>📍 You are here</strong><br>
                    <small>Accuracy: ~${Math.round(accuracy)}m</small><br>
                    <button onclick="openReportModal(${lat}, ${lon})"
                            style="margin-top: 8px; padding: 6px 12px; background: #FF6B6B; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Report Pothole Here
                    </button>
                </div>
            `).openPopup();

            // Zoom to location
            map.setView([lat, lon], 17); // Higher zoom for precise location

            // Reset button
            geolocateBtn.textContent = originalText;
            geolocateBtn.disabled = false;

            // Auto-remove accuracy circle after 5 seconds (keep marker)
            setTimeout(() => {
                if (accuracyCircle) {
                    map.removeLayer(accuracyCircle);
                }
            }, 5000);
        },
        error => {
            geolocateBtn.textContent = originalText;
            geolocateBtn.disabled = false;

            let errorMsg = 'Unable to get your location.';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Location permission denied. Please enable location access in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Location request timed out.';
                    break;
            }
            alert(errorMsg);
        },
        {
            enableHighAccuracy: true,  // Use GPS if available
            timeout: 10000,            // 10 second timeout
            maximumAge: 0              // Don't use cached position
        }
    );
}

// Show error message
function showError(message) {
    const statusEl = document.getElementById('submitStatus');
    statusEl.className = 'error';
    statusEl.textContent = `❌ ${message}`;
    statusEl.style.display = 'block';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    initMap();

    // Modal controls
    const modal = document.getElementById('reportModal');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const reportBtn = document.getElementById('reportBtn');
    const geolocateBtn = document.getElementById('geolocateBtn');

    closeBtn.addEventListener('click', closeReportModal);
    cancelBtn.addEventListener('click', closeReportModal);
    submitBtn.addEventListener('click', submitReport);
    reportBtn.addEventListener('click', () => {
        // Use map center as default location
        const center = map.getCenter();
        openReportModal(center.lat, center.lng);
    });
    geolocateBtn.addEventListener('click', geolocate);

    // Severity button selection
    document.querySelectorAll('.severity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSeverity = btn.dataset.severity;
        });
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeReportModal();
        }
    });

    // Reload potholes when map is dragged/zoomed
    map.on('moveend', loadPotholes);
});

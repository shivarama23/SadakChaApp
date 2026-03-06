const API_BASE = '/api/parking';
const NAGPUR_CENTER = [21.1458, 79.0882];
const ZOOM_LEVEL = 13;

let map;
let markerClusterGroup;
let selectedSeverity = null;

function initMap() {
    map = L.map('map').setView(NAGPUR_CENTER, ZOOM_LEVEL);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19, minZoom: 10
    }).addTo(map);

    markerClusterGroup = L.markerClusterGroup();
    map.addLayer(markerClusterGroup);
    map.on('click', handleMapClick);
    setupLongPress(map);
    loadReports();
    loadStats();
    setInterval(loadReports, 30000);
    setInterval(loadStats, 60000);
}

function loadReports() {
    const b = map.getBounds();
    const params = new URLSearchParams({
        min_lat: b.getSouth(), max_lat: b.getNorth(),
        min_lon: b.getWest(), max_lon: b.getEast()
    });
    fetch(`${API_BASE}?${params}`)
        .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
        .then(zones => {
            markerClusterGroup.clearLayers();
            zones.forEach(addMarker);
        })
        .catch(e => console.error('Error loading reports:', e));
}

function addMarker(zone) {
    const colors = {
        LOW: '#3B82F6',
        MODERATE: '#F59E0B',
        SEVERE: '#EF4444'
    };
    const emojis = { LOW: '🟢', MODERATE: '🟡', SEVERE: '🔴' };
    const labels = { LOW: 'Minor', MODERATE: 'Partial Block', SEVERE: 'Full Block' };

    const color = colors[zone.severity] || '#3B82F6';
    const pinIcon = L.divIcon({
        className: 'severity-pin',
        html: `<div style="
            background-color: ${color};
            width: 24px; height: 24px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
    });

    const marker = L.marker([zone.lat, zone.lon], { icon: pinIcon });

    marker.bindPopup(`
        <div>
            <strong>${emojis[zone.severity] || ''} ${labels[zone.severity] || zone.severity}</strong><br>
            <small>${new Date(zone.created_at).toLocaleDateString()}</small>
            <p><small>${zone.description}</small></p>
        </div>
    `);
    markerClusterGroup.addLayer(marker);
}

// Center pin selection mode (Uber-style)
let pinActive = false;
let centerPinEl = null;
let confirmBarEl = null;

function createCenterPinUI() {
    centerPinEl = document.createElement('div');
    centerPinEl.id = 'centerPin';
    centerPinEl.innerHTML = `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="shadow-b"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter>
        <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="#3B82F6" filter="url(#shadow-b)"/>
        <circle cx="18" cy="18" r="8" fill="white"/>
    </svg>`;
    document.getElementById('map').parentElement.appendChild(centerPinEl);

    confirmBarEl = document.createElement('div');
    confirmBarEl.id = 'confirmBar';
    confirmBarEl.innerHTML = `
        <span id="pinCoords"></span>
        <div>
            <button id="cancelPinBtn">Cancel</button>
            <button id="confirmPinBtn">KnowParking Here</button>
        </div>
    `;
    document.getElementById('map').parentElement.appendChild(confirmBarEl);

    document.getElementById('cancelPinBtn').addEventListener('click', deactivatePin);
    document.getElementById('confirmPinBtn').addEventListener('click', () => {
        const center = map.getCenter();
        deactivatePin();
        openReportModal(center.lat, center.lng);
    });
}

function activatePin(lat, lon) {
    if (!centerPinEl) createCenterPinUI();
    pinActive = true;
    centerPinEl.classList.add('active');
    confirmBarEl.classList.add('active');
    if (lat !== undefined && lon !== undefined) {
        map.setView([lat, lon], map.getZoom());
    }
    updatePinCoords();
}

function deactivatePin() {
    pinActive = false;
    if (centerPinEl) centerPinEl.classList.remove('active');
    if (confirmBarEl) confirmBarEl.classList.remove('active');
}

function updatePinCoords() {
    if (!pinActive) return;
    const center = map.getCenter();
    const el = document.getElementById('pinCoords');
    if (el) el.textContent = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
}

function handleMapClick(e) {
    activatePin(e.latlng.lat, e.latlng.lng);
}

function showLocationPin(lat, lon) {
    activatePin(lat, lon);
}

function removeSelectedPin() {
    deactivatePin();
}

function openReportModal(lat, lon) {
    const modal = document.getElementById('reportModal');
    document.getElementById('modalCoords').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    modal.dataset.lat = lat;
    modal.dataset.lon = lon;
    selectedSeverity = null;
    document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('description').value = '';
    document.getElementById('submitStatus').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').textContent = 'Submit Report';
    checkNearby(lat, lon);
    modal.classList.add('show');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('show');
    removeSelectedPin();
}

function checkNearby(lat, lon) {
    fetch(`${API_BASE}/nearby-check?lat=${lat}&lon=${lon}`)
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('nearbyWarning');
            if (data.nearby_count > 0) {
                document.getElementById('nearbyCount').textContent = data.nearby_count;
                el.style.display = 'block';
            } else { el.style.display = 'none'; }
        }).catch(() => {});
}

function submitReport() {
    const modal = document.getElementById('reportModal');
    const lat = parseFloat(modal.dataset.lat);
    const lon = parseFloat(modal.dataset.lon);
    const description = document.getElementById('description').value.trim();
    const statusEl = document.getElementById('submitStatus');
    const submitBtn = document.getElementById('submitBtn');

    if (!selectedSeverity) { alert('Please select a severity level'); return; }
    if (!description || description.length < 5) { alert('Please describe what is happening (at least 5 characters)'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, severity: selectedSeverity, description })
    })
    .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.detail || 'Failed'); });
        return r.json();
    })
    .then(zone => {
        statusEl.className = 'success';
        statusEl.textContent = 'Report submitted successfully!';
        statusEl.style.display = 'block';
        addMarker(zone);
        setTimeout(() => { closeReportModal(); loadStats(); }, 2000);
    })
    .catch(e => {
        statusEl.className = 'error';
        statusEl.textContent = e.message;
        statusEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Report';
    });
}

function loadStats() {
    fetch(`${API_BASE}/stats`)
        .then(r => r.json())
        .then(stats => {
            document.getElementById('totalCount').textContent = stats.total_count;
            document.getElementById('lowCount').textContent = stats.by_severity.LOW || 0;
            document.getElementById('mediumCount').textContent = stats.by_severity.MODERATE || 0;
            document.getElementById('dangerousCount').textContent = stats.by_severity.SEVERE || 0;
        }).catch(() => {});
}

// Geolocation
let currentLocationMarker = null;

function geolocate() {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    const btn = document.getElementById('geolocateBtn');
    const orig = btn.textContent;
    btn.textContent = '📍 Locating...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude, lon = pos.coords.longitude, acc = pos.coords.accuracy;
            if (currentLocationMarker) map.removeLayer(currentLocationMarker);

            currentLocationMarker = L.circleMarker([lat, lon], {
                radius: 12, fillColor: '#4285F4', color: '#fff', weight: 3, opacity: 1, fillOpacity: 0.8
            }).addTo(map);

            const circle = L.circle([lat, lon], {
                radius: acc, fillColor: '#4285F4', fillOpacity: 0.1, color: '#4285F4', weight: 1
            }).addTo(map);

            currentLocationMarker.bindPopup(`
                <div style="text-align:center;">
                    <strong>📍 You are here</strong><br>
                    <small>Accuracy: ~${Math.round(acc)}m</small><br>
                    <button onclick="openReportModal(${lat},${lon})"
                            style="margin-top:8px;padding:6px 12px;background:#3B82F6;color:white;border:none;border-radius:4px;cursor:pointer;">
                        KnowParking Here
                    </button>
                </div>
            `).openPopup();

            map.setView([lat, lon], 17);
            btn.textContent = orig;
            btn.disabled = false;
            setTimeout(() => { if (circle) map.removeLayer(circle); }, 5000);
        },
        err => {
            btn.textContent = orig;
            btn.disabled = false;
            const msgs = {
                1: 'Location permission denied.',
                2: 'Location unavailable.',
                3: 'Location request timed out.'
            };
            alert(msgs[err.code] || 'Unable to get location.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// Long-press support for mobile (hold 500ms to drop pin)
function setupLongPress(map) {
    let pressTimer = null;
    let startLatLng = null;

    function clearPress() {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }

    map.getContainer().addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { clearPress(); return; }
        const touch = e.touches[0];
        startLatLng = map.containerPointToLatLng(L.point(touch.clientX - map.getContainer().getBoundingClientRect().left, touch.clientY - map.getContainer().getBoundingClientRect().top));
        pressTimer = setTimeout(() => {
            if (startLatLng) {
                map.dragging.disable();
                showLocationPin(startLatLng.lat, startLatLng.lng);
                setTimeout(() => map.dragging.enable(), 100);
            }
            pressTimer = null;
        }, 500);
    }, { passive: true });

    map.getContainer().addEventListener('touchmove', clearPress, { passive: true });
    map.getContainer().addEventListener('touchend', clearPress, { passive: true });
    map.getContainer().addEventListener('touchcancel', clearPress, { passive: true });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    document.querySelector('.close').addEventListener('click', closeReportModal);
    document.getElementById('cancelBtn').addEventListener('click', closeReportModal);
    document.getElementById('submitBtn').addEventListener('click', submitReport);
    document.getElementById('reportBtn').addEventListener('click', () => {
        activatePin();
    });
    document.getElementById('geolocateBtn').addEventListener('click', geolocate);

    document.querySelectorAll('.severity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSeverity = btn.dataset.severity;
        });
    });

    document.getElementById('reportModal').addEventListener('click', e => {
        if (e.target.id === 'reportModal') closeReportModal();
    });

    // Stats panel toggle
    const statsH3 = document.querySelector('.stats-panel h3');
    if (statsH3) {
        statsH3.addEventListener('click', () => {
            document.getElementById('statsPanel').classList.toggle('collapsed');
        });
        if (window.innerWidth <= 600) {
            document.getElementById('statsPanel').classList.add('collapsed');
        }
    }

    map.on('movestart', () => {
        if (centerPinEl) centerPinEl.classList.add('lifting');
    });
    map.on('moveend', () => {
        if (centerPinEl) centerPinEl.classList.remove('lifting');
        loadReports();
        updatePinCoords();
    });
});

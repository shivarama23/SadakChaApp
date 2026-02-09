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

    const marker = L.circleMarker([zone.lat, zone.lon], {
        radius: 8, fillColor: colors[zone.severity] || '#3B82F6',
        color: colors[zone.severity] || '#3B82F6',
        weight: 2, opacity: 0.8, fillOpacity: 0.7
    });

    marker.bindPopup(`
        <div>
            <strong>${emojis[zone.severity] || ''} ${labels[zone.severity] || zone.severity}</strong><br>
            <small>${new Date(zone.created_at).toLocaleDateString()}</small>
            <p><small>${zone.description}</small></p>
        </div>
    `);
    markerClusterGroup.addLayer(marker);
}

// --- Pin & Report Flow (same pattern as potholes) ---

let selectedLocationMarker = null;

function handleMapClick(e) {
    showLocationPin(e.latlng.lat, e.latlng.lng);
}

function showLocationPin(lat, lon) {
    if (selectedLocationMarker) map.removeLayer(selectedLocationMarker);

    selectedLocationMarker = L.marker([lat, lon], { draggable: true, autoPan: true }).addTo(map);
    const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color:#3B82F6;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30]
    });
    selectedLocationMarker.setIcon(icon);

    function updatePopup(lat, lon) {
        selectedLocationMarker.bindPopup(`
            <div style="text-align:center;min-width:180px;">
                <strong>📍 Selected Location</strong><br>
                <small style="color:#666;">${lat.toFixed(5)}, ${lon.toFixed(5)}</small><br>
                <small style="color:#888;">Drag pin to adjust</small><br>
                <button onclick="openReportModal(${lat},${lon});removeSelectedPin();"
                        style="margin-top:10px;padding:8px 16px;background:#3B82F6;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
                    Report Bad Parking Here
                </button>
            </div>
        `).openPopup();
    }
    updatePopup(lat, lon);
    selectedLocationMarker.on('dragend', e => {
        const p = e.target.getLatLng();
        updatePopup(p.lat, p.lng);
    });
}

function removeSelectedPin() {
    if (selectedLocationMarker) { map.removeLayer(selectedLocationMarker); selectedLocationMarker = null; }
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
                        Report Bad Parking Here
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    document.querySelector('.close').addEventListener('click', closeReportModal);
    document.getElementById('cancelBtn').addEventListener('click', closeReportModal);
    document.getElementById('submitBtn').addEventListener('click', submitReport);
    document.getElementById('reportBtn').addEventListener('click', () => {
        const c = map.getCenter();
        openReportModal(c.lat, c.lng);
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

    map.on('moveend', loadReports);
});

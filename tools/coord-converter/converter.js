// FINAL COMPLETE AND CORRECTLY ORDERED CODE

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------
    // --- 1. CONSTANTS, VARIABLES, and UI ELEMENT SELECTORS ---
    // --------------------------------------------------------------------
    let map;
    let marker;
    let markers = [];
    const ostn15Data = [];
    const GRID_WIDTH = 701;
    let pointCounter = 1;

    const ELLIPSOID_PARAMS = {
        GRS80: { a: 6378137.0, b: 6356752.3141 },
        WGS84: { a: 6378137.0, b: 6356752.3142 }
    };
    const PROJECTION_PARAMS = {
        NationalGrid: { lat0_rad: 49 * (Math.PI / 180), lon0_rad: -2 * (Math.PI / 180), E0: 400000.0, N0: -100000.0, F0: 0.9996012717 },
        LSG: { lat0_rad: 51.166666666667 * (Math.PI / 180), lon0_rad: -0.158333333333 * (Math.PI / 180), E0: 78250.0, N0: -2800.0, F0: 0.9999999 }
    };
    const HELMERT_PARAMS = {
        ETRS89_to_LSG: { tx: 19.019, ty: 115.122, tz: -97.287, s: 18.60847540 / 1000000, rx: -3.577824, ry: 3.484437, rz: 2.767646 }
    };

    // UI Element Selectors
    const modeSelector = document.getElementById('mode-selector');
    const osgbForm = document.getElementById('osgb-form');
    const etrsForm = document.getElementById('etrs-form');
    const lsgForm = document.getElementById('lsg-form');
    const convertBtn = document.getElementById('convert-btn');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('spinner');
    const resultContainer = document.getElementById('result-container');
    const resultTbody = document.getElementById('result-tbody');
    const mapContainer = document.getElementById('map');
    const osgbEastingInput = document.getElementById('easting'), osgbNorthingInput = document.getElementById('northing'), osgbHeightInput = document.getElementById('osgb-height');
    const etrsLatInput = document.getElementById('latitude'), etrsLonInput = document.getElementById('longitude'), etrsHeightInput = document.getElementById('etrs-height');
    const lsgEastingInput = document.getElementById('lsg-easting'), lsgNorthingInput = document.getElementById('lsg-northing'), lsgHeightInput = document.getElementById('lsg-height');
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutSection = document.getElementById('aboutSection');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn = document.getElementById('clear-btn');
    const downloadBtn = document.getElementById('download-btn');
    const csvInput = document.getElementById('csv-input');
    
    // --------------------------------------------------------------------
    // --- 2. FUNCTION DEFINITIONS ---
    // --------------------------------------------------------------------

    // --- UPDATED INIT MAP FUNCTION ---
    function initMap() {
        if (map) return;
        map = L.map('map').setView([51.5074, -0.1278], 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // 2. Add Subtle Scale Bar (Bottom Left)
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 150
        }).addTo(map);

        // 3. Dynamic Text Sizing Logic
        const updateLabelSize = () => {
            const zoom = map.getZoom();
            // Formula: Zoom 10 = 10px, Zoom 18 = 18px. 
            // We clamp it so it doesn't get too tiny (<10px) or absurdly large (>24px)
            const newSize = Math.max(10, Math.min(24, zoom)) + 'px';
            document.documentElement.style.setProperty('--label-size', newSize);
        };

        // Listen for zoom events to update text size
        map.on('zoomend', updateLabelSize);
        updateLabelSize(); // Run once on init

        // Toggle Labels Checkbox
    const showLabelsChk = document.getElementById('show-labels-chk');
    const mapDiv = document.getElementById('map');

    if (showLabelsChk) {
        showLabelsChk.addEventListener('change', (e) => {
            if (e.target.checked) {
                mapDiv.classList.add('labels-visible');
            } else {
                mapDiv.classList.remove('labels-visible');
            }
        });
    }
    }

    // --- UPDATED MARKER FUNCTION ---
    function updateMapWithPoints(points) {
        if (marker) marker.remove();
        markers.forEach(m => m.remove());
        markers = [];
        marker = null;

        if (!points || points.length === 0) return;

        // Helper to create marker with label
        const createMarker = (p) => {
            if (!p.latitude || !p.longitude) return null;
            
            const m = L.marker([p.latitude, p.longitude]);
            
            // Bind the Tooltip (Label)
            if (p.pointId) {
                m.bindTooltip(String(p.pointId), {
                    permanent: true,
                    direction: 'right', // Text appears to the right of the pin
                    offset: [12, -15],  // Offset to align nicely with marker head
                    className: 'map-point-label' // The class we defined in CSS
                });
            }
            return m;
        };

        if (points.length === 1) {
            marker = createMarker(points[0]);
            if (marker) {
                marker.addTo(map);
                map.setView([points[0].latitude, points[0].longitude], 15);
            }
        } else {
            points.forEach(point => {
                const newMarker = createMarker(point);
                if (newMarker) markers.push(newMarker);
            });

            if (markers.length > 0) {
                const featureGroup = L.featureGroup(markers).addTo(map);
                map.fitBounds(featureGroup.getBounds().pad(0.1));
            }
        }
    }
    // --- Open Map in New Window Logic ---
    const openMapBtn = document.getElementById('open-map-btn');
    
    if (openMapBtn) {
        openMapBtn.addEventListener('click', () => {
            // 1. Capture current state
            const currentCenter = map.getCenter();
            const currentZoom = map.getZoom();
            
            // 2. Open new window
            const newWindow = window.open("", "MapWindow", "width=1200,height=800");
            
            if (!newWindow) {
                alert("Pop-up blocked! Please allow pop-ups for this site.");
                return;
            }

            // 3. Collect point data to transfer
            // We iterate through the hidden result table or our internal data to get points
            const pointsToTransfer = [];
            // We can reconstruct points from the table rows if we didn't save them globally. 
            // Better yet, let's grab them from the table which is the source of truth for the UI.
            const rows = resultTbody.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.cells;
                if (cells.length > 0) {
                    pointsToTransfer.push({
                        pointId: cells[0].textContent,
                        latitude: parseFloat(cells[4].textContent),
                        longitude: parseFloat(cells[5].textContent)
                    });
                }
            });

            // 4. Write HTML to the new window
            newWindow.document.write(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <title>Full Page Map View</title>
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                    <style>
                        body { margin: 0; padding: 0; }
                        #full-map { width: 100vw; height: 100vh; }
                        
                        /* Re-use your Label Styles */
                        .map-point-label {
                            background-color: rgba(0, 0, 0, 0.8);
                            border: 1px solid rgba(255, 255, 255, 0.5);
                            color: #fff;
                            font-weight: 500;
                            font-size: 12px; /* Fixed size or add dynamic logic if needed */
                            padding: 2px 5px;
                            border-radius: 4px;
                            white-space: nowrap;
                        }
                    </style>
                </head>
                <body>
                    <div id="full-map"></div>
                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
                    <script>
                        const map = L.map('full-map').setView([${currentCenter.lat}, ${currentCenter.lng}], ${currentZoom});
                        
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            maxZoom: 19,
                            attribution: '© OpenStreetMap'
                        }).addTo(map);

                        L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

                        const points = ${JSON.stringify(pointsToTransfer)};
                        const markers = [];

                        points.forEach(p => {
                            if(p.latitude && p.longitude) {
                                const m = L.marker([p.latitude, p.longitude]).addTo(map);
                                if(p.pointId) {
                                    m.bindTooltip(String(p.pointId), {
                                        permanent: true,
                                        direction: 'right',
                                        offset: [12, -15],
                                        className: 'map-point-label'
                                    });
                                }
                                markers.push(m);
                            }
                        });

                        if(markers.length > 0) {
                            const group = L.featureGroup(markers);
                            // Only fit bounds if we aren't using the parent's exact view
                            // map.fitBounds(group.getBounds()); 
                        }
                    <\/script>
                </body>
                </html>
            `);
            newWindow.document.close(); // Important to finish loading
        });
    }

    

    function downloadResults() {
        const headers = "Point ID,OSGB36 E,OSGB36 N,OSGB36 H,ETRS89 Lat,ETRS89 Lon,ETRS89 h,LSG E,LSG N,LSG H";
        let csvContent = headers + "\r\n";
        for (const row of resultTbody.rows) {
            const cells = Array.from(row.cells).map(cell => `"${cell.textContent}"`);
            csvContent += cells.join(',') + "\r\n";
        }
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "converted_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function getShifts(x, y) {
        const east_idx = Math.floor(x / 1000), north_idx = Math.floor(y / 1000), id0 = (north_idx * GRID_WIDTH) + east_idx;
        if (!ostn15Data[id0] || !ostn15Data[id0 + GRID_WIDTH + 1]) return null;
        const { e_shift: se0, n_shift: sn0, h_shift: sh0 } = ostn15Data[id0];
        const { e_shift: se1, n_shift: sn1, h_shift: sh1 } = ostn15Data[id0 + 1];
        const { e_shift: se2, n_shift: sn2, h_shift: sh2 } = ostn15Data[id0 + GRID_WIDTH + 1];
        const { e_shift: se3, n_shift: sn3, h_shift: sh3 } = ostn15Data[id0 + GRID_WIDTH];
        const t = (x / 1000) - east_idx, u = (y / 1000) - north_idx;
        const se = (1 - t) * (1 - u) * se0 + t * (1 - u) * se1 + t * u * se2 + (1 - t) * u * se3;
        const sn = (1 - t) * (1 - u) * sn0 + t * (1 - u) * sn1 + t * u * sn2 + (1 - t) * u * sn3;
        const sh = (1 - t) * (1 - u) * sh0 + t * (1 - u) * sh1 + t * u * sh2 + (1 - t) * u * sh3;
        return { se, sn, sh };
    }

    function iterativeTransform(E_osgb, N_osgb) {
        let x_etrs = E_osgb, y_etrs = N_osgb, se_prev = 0, sn_prev = 0;
        for (let i = 0; i < 10; i++) {
            const shifts = getShifts(x_etrs, y_etrs);
            if (!shifts) return null;
            const { se, sn } = shifts;
            if (Math.abs(se - se_prev) < 0.0001 && Math.abs(sn - sn_prev) < 0.0001) return { x_etrs, y_etrs };
            se_prev = se; sn_prev = sn;
            x_etrs = E_osgb - se; y_etrs = N_osgb - sn;
        }
        return { x_etrs, y_etrs };
    }

    function convertProjectedToGeodetic(e, n, projParams, ellParams) {
        const { a, b } = ellParams;
        const { lat0_rad, lon0_rad, E0, N0, F0 } = projParams;
        const e2 = (a * a - b * b) / (a * a);
        const n_param = (a - b) / (a + b);
        let phi_prime = ((n - N0) / (a * F0)) + lat0_rad, M = 0;
        do {
            phi_prime = ((n - N0 - M) / (a * F0)) + phi_prime;
            M = b * F0 * ((1 + n_param + (5 / 4) * n_param ** 2 + (5 / 4) * n_param ** 3) * (phi_prime - lat0_rad) - (3 * n_param + 3 * n_param ** 2 + (21 / 8) * n_param ** 3) * Math.sin(phi_prime - lat0_rad) * Math.cos(phi_prime + lat0_rad) + ((15 / 8) * n_param ** 2 + (15 / 8) * n_param ** 3) * Math.sin(2 * (phi_prime - lat0_rad)) * Math.cos(2 * (phi_prime + lat0_rad)) - ((35 / 24) * n_param ** 3) * Math.sin(3 * (phi_prime - lat0_rad)) * Math.cos(3 * (phi_prime + lat0_rad)));
        } while (Math.abs(n - N0 - M) >= 0.0001);
        const nu = a * F0 / Math.sqrt(1 - e2 * Math.sin(phi_prime) ** 2), rho = a * F0 * (1 - e2) * (1 - e2 * Math.sin(phi_prime) ** 2) ** -1.5;
        const eta2 = nu / rho - 1, tan_phi = Math.tan(phi_prime), sec_phi = 1 / Math.cos(phi_prime);
        const VII = tan_phi / (2 * rho * nu), VIII = tan_phi / (24 * rho * nu ** 3) * (5 + 3 * tan_phi ** 2 + eta2 - 9 * tan_phi ** 2 * eta2), IX = tan_phi / (720 * rho * nu ** 5) * (61 + 90 * tan_phi ** 2 + 45 * tan_phi ** 4);
        const X = sec_phi / nu, XI = sec_phi / (6 * nu ** 3) * (nu / rho + 2 * tan_phi ** 2), XII = sec_phi / (120 * nu ** 5) * (5 + 28 * tan_phi ** 2 + 24 * tan_phi ** 4), XIIA = sec_phi / (5040 * nu ** 7) * (61 + 662 * tan_phi ** 2 + 1320 * tan_phi ** 4 + 720 * tan_phi ** 6);
        const E_minus_E0 = e - E0;
        const phi_rad = phi_prime - VII * E_minus_E0 ** 2 + VIII * E_minus_E0 ** 4 - IX * E_minus_E0 ** 6;
        const lambda_rad = lon0_rad + X * E_minus_E0 - XI * E_minus_E0 ** 3 + XII * E_minus_E0 ** 5 - XIIA * E_minus_E0 ** 7;
        return { latitude: phi_rad * (180 / Math.PI), longitude: lambda_rad * (180 / Math.PI) };
    }

    function convertGeodeticToProjected(lat, lon, projParams, ellParams) {
        const { a, b } = ellParams;
        const { lat0_rad, lon0_rad, E0, N0, F0 } = projParams;
        const e2 = (a * a - b * b) / (a * a), n = (a - b) / (a + b);
        const lat_rad = lat * (Math.PI / 180), lon_rad = lon * (Math.PI / 180);
        const sin_lat = Math.sin(lat_rad), cos_lat = Math.cos(lat_rad), tan_lat_sq = Math.tan(lat_rad) ** 2;
        const nu = a * F0 / Math.sqrt(1 - e2 * sin_lat ** 2), rho = a * F0 * (1 - e2) * (1 - e2 * sin_lat ** 2) ** -1.5;
        const eta2 = nu / rho - 1;
        const M = b * F0 * ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (lat_rad - lat0_rad) - (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(lat_rad - lat0_rad) * Math.cos(lat_rad + lat0_rad) + ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * (lat_rad - lat0_rad)) * Math.cos(2 * (lat_rad + lat0_rad)) - ((35 / 24) * n ** 3) * Math.sin(3 * (lat_rad - lat0_rad)) * Math.cos(3 * (lat_rad + lat0_rad)));
        const I = M + N0, II = (nu / 2) * sin_lat * cos_lat, III = (nu / 24) * sin_lat * cos_lat ** 3 * (5 - tan_lat_sq + 9 * eta2), IIIA = (nu / 720) * sin_lat * cos_lat ** 5 * (61 - 58 * tan_lat_sq + tan_lat_sq ** 2);
        const IV = nu * cos_lat, V = (nu / 6) * cos_lat ** 3 * (nu / rho - tan_lat_sq), VI = (nu / 120) * cos_lat ** 5 * (5 - 18 * tan_lat_sq + tan_lat_sq ** 2 + 14 * eta2 - 58 * tan_lat_sq * eta2);
        const lon_diff = lon_rad - lon0_rad;
        const y_proj = I + II * lon_diff ** 2 + III * lon_diff ** 4 + IIIA * lon_diff ** 6;
        const x_proj = E0 + IV * lon_diff + V * lon_diff ** 3 + VI * lon_diff ** 5;
        return { x_proj, y_proj };
    }
    
    function geodeticToCartesian(lat, lon, h, ellParams) {
        const { a, b } = ellParams;
        const e2 = (a * a - b * b) / (a * a);
        const lat_rad = lat * (Math.PI / 180), lon_rad = lon * (Math.PI / 180);
        const nu = a / Math.sqrt(1 - e2 * Math.sin(lat_rad) ** 2);
        const x = (nu + h) * Math.cos(lat_rad) * Math.cos(lon_rad);
        const y = (nu + h) * Math.cos(lat_rad) * Math.sin(lon_rad);
        const z = ((1 - e2) * nu + h) * Math.sin(lat_rad);
        return { x, y, z };
    }

    function cartesianToGeodetic(x, y, z, ellParams) {
        const { a, b } = ellParams;
        const e2 = (a * a - b * b) / (a * a);
        const lon_rad = Math.atan2(y, x);
        const p = Math.sqrt(x ** 2 + y ** 2);
        let lat_rad = Math.atan2(z, p * (1 - e2)), nu;
        for (let i = 0; i < 5; i++) {
            nu = a / Math.sqrt(1 - e2 * Math.sin(lat_rad) ** 2);
            lat_rad = Math.atan2(z + e2 * nu * Math.sin(lat_rad), p);
        }
        const h = (p / Math.cos(lat_rad)) - nu;
        return { latitude: lat_rad * (180 / Math.PI), longitude: lon_rad * (180 / Math.PI), height: h };
    }

    function helmertTransform(x, y, z, params) {
        const { tx, ty, tz, s, rx, ry, rz } = params;
        const rx_rad = rx * (Math.PI / (180 * 3600)), ry_rad = ry * (Math.PI / (180 * 3600)), rz_rad = rz * (Math.PI / (180 * 3600));
        const x_out = tx + (1 + s) * (x + rz_rad * y - ry_rad * z);
        const y_out = ty + (1 + s) * (-rz_rad * x + y + rx_rad * z);
        const z_out = tz + (1 + s) * (ry_rad * x - rx_rad * y + z);
        return { x: x_out, y: y_out, z: z_out };
    }

    function inverseHelmertTransform(x, y, z, params) {
        const { tx, ty, tz, s, rx, ry, rz } = params;
        const scaleFactor = 1 / (1 + s);
        const rx_rad = rx * (Math.PI / (180 * 3600)), ry_rad = ry * (Math.PI / (180 * 3600)), rz_rad = rz * (Math.PI / (180 * 3600));
        const x_temp = x - tx, y_temp = y - ty, z_temp = z - tz;
        const x_out = scaleFactor * (x_temp - rz_rad * y_temp + ry_rad * z_temp);
        const y_out = scaleFactor * (rz_rad * x_temp + y_temp - rx_rad * z_temp);
        const z_out = scaleFactor * (-ry_rad * x_temp + rx_rad * y_temp + z_temp);
        return { x: x_out, y: y_out, z: z_out };
    }
    
    function handleMasterConversion(event) {
        event.preventDefault();
        const selectedMode = document.querySelector('input[name="conversion-mode"]:checked').value;
        spinner.style.display = 'block';
        resultContainer.style.display = 'none';

        setTimeout(() => {
            let E_osgb, N_osgb, H_osgb, lat, lon, H_etrs, E_lsg, N_lsg, H_lsg;
            let finalResult = null;
            let etrsProjected, shifts, geoETRS, etrsCartesian, lsgCartesian, lsgGeo, lsgProjected;

            switch (selectedMode) {
                case 'osgb':
                    E_osgb = parseFloat(osgbEastingInput.value); N_osgb = parseFloat(osgbNorthingInput.value); H_osgb = parseFloat(osgbHeightInput.value) || 0;
                    if (isNaN(E_osgb) || isNaN(N_osgb)) { alert("Invalid OSGB36 input."); break; }
                    etrsProjected = iterativeTransform(E_osgb, N_osgb);
                    if (etrsProjected) {
                        shifts = getShifts(etrsProjected.x_etrs, etrsProjected.y_etrs);
                        if (shifts) {
                            H_etrs = H_osgb + shifts.sh;
                            geoETRS = convertProjectedToGeodetic(etrsProjected.x_etrs, etrsProjected.y_etrs, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                            etrsCartesian = geodeticToCartesian(geoETRS.latitude, geoETRS.longitude, H_etrs, ELLIPSOID_PARAMS.WGS84);
                            lsgCartesian = helmertTransform(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                            lsgGeo = cartesianToGeodetic(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, ELLIPSOID_PARAMS.WGS84);
                            lsgProjected = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                            H_lsg = H_osgb + 100.0;
                            finalResult = { pointId: pointCounter, E_osgb, N_osgb, H_osgb, x_etrs: etrsProjected.x_etrs, y_etrs: etrsProjected.y_etrs, H_etrs, ...geoETRS, lsgE: lsgProjected.x_proj, lsgN: lsgProjected.y_proj, H_lsg };
                        }
                    }
                    break;
                case 'etrs':
                    lat = parseFloat(etrsLatInput.value); lon = parseFloat(etrsLonInput.value); H_etrs = parseFloat(etrsHeightInput.value) || 0;
                    if (isNaN(lat) || isNaN(lon)) { alert("Invalid ETRS89 input."); break; }
                    etrsProjected = convertGeodeticToProjected(lat, lon, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                    shifts = getShifts(etrsProjected.x_proj, etrsProjected.y_proj);
                    if (shifts) {
                        E_osgb = etrsProjected.x_proj + shifts.se; N_osgb = etrsProjected.y_proj + shifts.sn; H_osgb = H_etrs - shifts.sh;
                        etrsCartesian = geodeticToCartesian(lat, lon, H_etrs, ELLIPSOID_PARAMS.WGS84);
                        lsgCartesian = helmertTransform(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                        lsgGeo = cartesianToGeodetic(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, ELLIPSOID_PARAMS.WGS84);
                        lsgProjected = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                        H_lsg = H_osgb + 100.0;
                        finalResult = { pointId: pointCounter, E_osgb, N_osgb, H_osgb, latitude: lat, longitude: lon, x_etrs: etrsProjected.x_proj, y_etrs: etrsProjected.y_proj, H_etrs, lsgE: lsgProjected.x_proj, lsgN: lsgProjected.y_proj, H_lsg };
                    }
                    break;
                case 'lsg':
                    E_lsg = parseFloat(lsgEastingInput.value); N_lsg = parseFloat(lsgNorthingInput.value); H_lsg = parseFloat(lsgHeightInput.value) || 0;
                    if (isNaN(E_lsg) || isNaN(N_lsg)) { alert("Invalid LSG input."); break; }
                    H_osgb = H_lsg - 100.0;
                    lsgGeo = convertProjectedToGeodetic(E_lsg, N_lsg, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                    const tempETRSforShift = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                    const tempShifts = getShifts(tempETRSforShift.x_proj, tempETRSforShift.y_proj);
                    if (tempShifts) {
                        const approx_h_etrs = H_osgb + tempShifts.sh;
                        lsgCartesian = geodeticToCartesian(lsgGeo.latitude, lsgGeo.longitude, approx_h_etrs, ELLIPSOID_PARAMS.WGS84);
                        etrsCartesian = inverseHelmertTransform(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                        geoETRS = cartesianToGeodetic(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, ELLIPSOID_PARAMS.GRS80);
                        lat = geoETRS.latitude; lon = geoETRS.longitude; H_etrs = geoETRS.height;
                        etrsProjected = convertGeodeticToProjected(lat, lon, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                        shifts = getShifts(etrsProjected.x_proj, etrsProjected.y_proj);
                        if (shifts) {
                            E_osgb = etrsProjected.x_proj + shifts.se; N_osgb = etrsProjected.y_proj + shifts.sn;
                            finalResult = { pointId: pointCounter, E_osgb, N_osgb, H_osgb, latitude: lat, longitude: lon, x_etrs: etrsProjected.x_proj, y_etrs: etrsProjected.y_proj, H_etrs, lsgE: E_lsg, lsgN: N_lsg, H_lsg };
                        }
                    }
                    break;
            }

            spinner.style.display = 'none';
            if (finalResult) {
                if (pointCounter === 1) {
                    resultTbody.innerHTML = '';
                }
                const resultRowHTML = `
                    <tr>
                        <td>${finalResult.pointId}</td>
                        <td>${finalResult.E_osgb.toFixed(3)}</td>
                        <td>${finalResult.N_osgb.toFixed(3)}</td>
                        <td>${finalResult.H_osgb.toFixed(3)}</td>
                        <td>${finalResult.latitude.toFixed(8)}</td>
                        <td>${finalResult.longitude.toFixed(8)}</td>
                        <td>${finalResult.H_etrs.toFixed(3)}</td>
                        <td>${finalResult.lsgE.toFixed(3)}</td>
                        <td>${finalResult.lsgN.toFixed(3)}</td>
                        <td>${finalResult.H_lsg.toFixed(3)}</td>
                    </tr>`;
                resultTbody.innerHTML = resultRowHTML; // This should be += for CSV
                resultContainer.style.display = 'block';
                pointCounter++;
                updateMapWithPoints([finalResult]);
            } else {
                alert("Calculation failed or coordinate is outside the supported transformation area.");
            }
        }, 50);
    }

    function handleFile(file) {
        const selectedMode = document.querySelector('input[name="conversion-mode"]:checked').value;
        const allResults = [];
        resultTbody.innerHTML = '';
        spinner.style.display = 'block';
        resultContainer.style.display = 'none';
        downloadBtn.disabled = true;

        Papa.parse(file, {
            header: false, // Changed to false to rely on column index, not name
            skipEmptyLines: true, 
            worker: true,
            step: (results) => {
                const row = results.data;
                
                // 1. INPUT MAPPING (Strictly Columns A, B, C, D)
                // Col A = ID, Col B = East/Lat, Col C = North/Lon, Col D = Height
                const rawId = row[0];
                const rawColB = parseFloat(row[1]); 
                const rawColC = parseFloat(row[2]);
                const rawColD = parseFloat(row[3]);

                // 2. INTELLIGENT HEADER DETECTION
                // If Column B or C are NOT numbers, assume this is a header row and skip it.
                if (isNaN(rawColB) || isNaN(rawColC)) {
                    return; 
                }

                const pointId = rawId || 'N/A';
                
                let E_osgb, N_osgb, H_osgb, lat, lon, H_etrs, E_lsg, N_lsg, H_lsg;
                let finalResult = null;
                let etrsProjected, shifts, geoETRS, etrsCartesian, lsgCartesian, lsgGeo, lsgProjected;

                switch (selectedMode) {
                    case 'osgb':
                        E_osgb = rawColB; 
                        N_osgb = rawColC; 
                        H_osgb = isNaN(rawColD) ? 0 : rawColD;

                        etrsProjected = iterativeTransform(E_osgb, N_osgb);
                        if (etrsProjected) {
                            shifts = getShifts(etrsProjected.x_etrs, etrsProjected.y_etrs);
                            if(shifts) {
                               H_etrs = H_osgb + shifts.sh;
                               geoETRS = convertProjectedToGeodetic(etrsProjected.x_etrs, etrsProjected.y_etrs, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                               etrsCartesian = geodeticToCartesian(geoETRS.latitude, geoETRS.longitude, H_etrs, ELLIPSOID_PARAMS.WGS84);
                               lsgCartesian = helmertTransform(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                               lsgGeo = cartesianToGeodetic(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, ELLIPSOID_PARAMS.WGS84);
                               lsgProjected = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                               H_lsg = H_osgb + 100.0;
                               finalResult = { pointId, E_osgb, N_osgb, H_osgb, x_etrs: etrsProjected.x_etrs, y_etrs: etrsProjected.y_etrs, H_etrs, ...geoETRS, lsgE: lsgProjected.x_proj, lsgN: lsgProjected.y_proj, H_lsg };
                            }
                        }
                        break;

                    case 'etrs':
                        lat = rawColB; 
                        lon = rawColC; 
                        H_etrs = isNaN(rawColD) ? 0 : rawColD;

                        etrsProjected = convertGeodeticToProjected(lat, lon, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                        shifts = getShifts(etrsProjected.x_proj, etrsProjected.y_proj);
                        if (shifts) {
                            E_osgb = etrsProjected.x_proj + shifts.se; N_osgb = etrsProjected.y_proj + shifts.sn; H_osgb = H_etrs - shifts.sh;
                            etrsCartesian = geodeticToCartesian(lat, lon, H_etrs, ELLIPSOID_PARAMS.WGS84);
                            lsgCartesian = helmertTransform(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                            lsgGeo = cartesianToGeodetic(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, ELLIPSOID_PARAMS.WGS84);
                            lsgProjected = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                            H_lsg = H_osgb + 100.0;
                            finalResult = { pointId, E_osgb, N_osgb, H_osgb, latitude: lat, longitude: lon, x_etrs: etrsProjected.x_proj, y_etrs: etrsProjected.y_proj, H_etrs, lsgE: lsgProjected.x_proj, lsgN: lsgProjected.y_proj, H_lsg };
                        }
                        break;

                    case 'lsg':
                        E_lsg = rawColB; 
                        N_lsg = rawColC; 
                        H_lsg = isNaN(rawColD) ? 0 : rawColD;

                        H_osgb = H_lsg - 100.0;
                        lsgGeo = convertProjectedToGeodetic(E_lsg, N_lsg, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                        const tempETRSforShift = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                        const tempShifts = getShifts(tempETRSforShift.x_proj, tempETRSforShift.y_proj);
                        if (tempShifts) {
                            const approx_h_etrs = H_osgb + tempShifts.sh;
                            lsgCartesian = geodeticToCartesian(lsgGeo.latitude, lsgGeo.longitude, approx_h_etrs, ELLIPSOID_PARAMS.WGS84);
                            etrsCartesian = inverseHelmertTransform(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                            geoETRS = cartesianToGeodetic(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, ELLIPSOID_PARAMS.GRS80);
                            lat = geoETRS.latitude; lon = geoETRS.longitude; H_etrs = geoETRS.height;
                            etrsProjected = convertGeodeticToProjected(lat, lon, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                            shifts = getShifts(etrsProjected.x_proj, etrsProjected.y_proj);
                            if (shifts) {
                                E_osgb = etrsProjected.x_proj + shifts.se; N_osgb = etrsProjected.y_proj + shifts.sn;
                                finalResult = { pointId, E_osgb, N_osgb, H_osgb, latitude: lat, longitude: lon, x_etrs: etrsProjected.x_proj, y_etrs: etrsProjected.y_proj, H_etrs, lsgE: E_lsg, lsgN: N_lsg, H_lsg };
                            }
                        }
                        break;
                }

                if (finalResult) {
                    allResults.push(finalResult);
                    const resultRowHTML = `
                        <tr>
                            <td>${finalResult.pointId}</td>
                            <td>${finalResult.E_osgb.toFixed(3)}</td>
                            <td>${finalResult.N_osgb.toFixed(3)}</td>
                            <td>${finalResult.H_osgb.toFixed(3)}</td>
                            <td>${finalResult.latitude.toFixed(8)}</td>
                            <td>${finalResult.longitude.toFixed(8)}</td>
                            <td>${finalResult.H_etrs.toFixed(3)}</td>
                            <td>${finalResult.lsgE.toFixed(3)}</td>
                            <td>${finalResult.lsgN.toFixed(3)}</td>
                            <td>${finalResult.H_lsg.toFixed(3)}</td>
                        </tr>`;
                    resultTbody.innerHTML += resultRowHTML;
                }
            },
            complete: () => {
                spinner.style.display = 'none';
                resultContainer.style.display = 'block';
                if (allResults.length > 0) {
                     downloadBtn.disabled = false;
                     updateMapWithPoints(allResults);
                } else {
                     // If no results, user likely uploaded a file that had no numbers in Col B/C
                     alert("No valid coordinates found in Columns B and C. Please check your CSV format.");
                }
            }
        });
    }

    // --------------------------------------------------------------------
    // --- 3. EVENT LISTENERS AND INITIALIZATION ---
    // --------------------------------------------------------------------
    
    aboutBtn.addEventListener('click', () => {
        aboutSection.classList.toggle('hidden');
        aboutBtn.textContent = aboutSection.classList.contains('hidden') ? 'About This Tool' : 'Hide About Section';
    });

    modeSelector.addEventListener('change', (event) => {
        pointCounter = 1;
        resultTbody.innerHTML = '';
        const selectedMode = event.target.value;
        osgbForm.style.display = 'none'; etrsForm.style.display = 'none'; lsgForm.style.display = 'none';
        let activeForm = osgbForm;
        if (selectedMode === 'etrs') activeForm = etrsForm;
        if (selectedMode === 'lsg') activeForm = lsgForm;
        activeForm.style.display = 'block';
        activeForm.appendChild(convertBtn);
        activeForm.appendChild(statusText);
        resultContainer.style.display = 'none';
    });
    
    uploadBtn.addEventListener('click', () => { csvInput.value = null; csvInput.click(); });
    csvInput.addEventListener('change', (event) => { if (event.target.files[0]) handleFile(event.target.files[0]); });
    clearBtn.addEventListener('click', () => {
        resultTbody.innerHTML = '';
        pointCounter = 1;
        resultContainer.style.display = 'none';
        downloadBtn.disabled = true;
        if (marker) marker.remove();
        markers.forEach(m => m.remove());
        markers = [];
        marker = null;
        map.setView([51.5074, -0.1278], 14);
    });
    downloadBtn.addEventListener('click', downloadResults);

    statusText.textContent = "Attempting to load transformation data...";
    Papa.parse('ostn15.csv', {
        download: true, header: true, dynamicTyping: true, worker: false, skipEmptyLines: true,
        transformHeader: header => header.trim().replace(/^\ufeff/, ''),
        step: results => {
            const row = results.data;
            if (row && row.Point_ID) {
                ostn15Data[row.Point_ID - 1] = {
                    e_shift: row.ETRS89_OSGB36_EShift,
                    n_shift: row.ETRS89_OSGB36_NShift,
                    h_shift: row.ETRS89_ODN_HeightShift
                };
            }
        },
        complete: () => {
            console.log("SUCCESS: Papa Parse complete.");
            statusText.textContent = "Data loaded. Ready to convert.";
            statusText.style.color = 'var(--accent-dim)';
            convertBtn.disabled = false;
            osgbForm.addEventListener('submit', handleMasterConversion);
            etrsForm.addEventListener('submit', handleMasterConversion);
            lsgForm.addEventListener('submit', handleMasterConversion);
            initMap();
        },
        error: error => {
            console.error("ERROR: Papa Parse 'error' callback fired.", error);
            statusText.textContent = "Error: Failed to load transformation data.";
            statusText.style.color = '#ff4444';
            alert(`Failed to load or parse OSTN15 data. Check console (F12). Error: ${error.message}`);
        }
    });

});
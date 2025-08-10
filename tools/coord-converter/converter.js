// FINAL COMPLETE AND CORRECTLY ORDERED CODE

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------
    // --- 1. CONSTANTS, VARIABLES, and UI ELEMENT SELECTORS ---
    // --------------------------------------------------------------------
    const ostn15Data = [];
    const GRID_WIDTH = 701;

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
    const osgbEastingInput = document.getElementById('easting'), osgbNorthingInput = document.getElementById('northing'), osgbHeightInput = document.getElementById('osgb-height');
    const etrsLatInput = document.getElementById('latitude'), etrsLonInput = document.getElementById('longitude'), etrsHeightInput = document.getElementById('etrs-height');
    const lsgEastingInput = document.getElementById('lsg-easting'), lsgNorthingInput = document.getElementById('lsg-northing'), lsgHeightInput = document.getElementById('lsg-height');
    const resultOsgbE = document.getElementById('result-osgb-e'), resultOsgbN = document.getElementById('result-osgb-n'), resultOsgbH = document.getElementById('result-osgb-h');
    const resultEtrsLat = document.getElementById('result-etrs-lat'), resultEtrsLon = document.getElementById('result-etrs-lon'), resultEtrsH = document.getElementById('result-etrs-h');
    const resultLsgE = document.getElementById('result-lsg-e'), resultLsgN = document.getElementById('result-lsg-n'), resultLsgH = document.getElementById('result-lsg-h');
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutSection = document.getElementById('aboutSection');
    
    // --------------------------------------------------------------------
    // --- 2. FUNCTION DEFINITIONS ---
    // --------------------------------------------------------------------

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
                        H_etrs = H_osgb + shifts.sh;
                        geoETRS = convertProjectedToGeodetic(etrsProjected.x_etrs, etrsProjected.y_etrs, PROJECTION_PARAMS.NationalGrid, ELLIPSOID_PARAMS.GRS80);
                        etrsCartesian = geodeticToCartesian(geoETRS.latitude, geoETRS.longitude, H_etrs, ELLIPSOID_PARAMS.WGS84);
                        lsgCartesian = helmertTransform(etrsCartesian.x, etrsCartesian.y, etrsCartesian.z, HELMERT_PARAMS.ETRS89_to_LSG);
                        lsgGeo = cartesianToGeodetic(lsgCartesian.x, lsgCartesian.y, lsgCartesian.z, ELLIPSOID_PARAMS.WGS84);
                        lsgProjected = convertGeodeticToProjected(lsgGeo.latitude, lsgGeo.longitude, PROJECTION_PARAMS.LSG, ELLIPSOID_PARAMS.WGS84);
                        H_lsg = H_osgb + 100.0;
                        finalResult = { E_osgb, N_osgb, H_osgb, x_etrs: etrsProjected.x_etrs, y_etrs: etrsProjected.y_etrs, H_etrs, ...geoETRS, lsgE: lsgProjected.x_proj, lsgN: lsgProjected.y_proj, H_lsg };
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
                        finalResult = { E_osgb, N_osgb, H_osgb, latitude: lat, longitude: lon, x_etrs: etrsProjected.x_proj, y_etrs: etrsProjected.y_proj, H_etrs, lsgE: lsgProjected.x_proj, lsgN: lsgProjected.y_proj, H_lsg };
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
                            finalResult = { E_osgb, N_osgb, H_osgb, latitude: lat, longitude: lon, x_etrs: etrsProjected.x_proj, y_etrs: etrsProjected.y_proj, H_etrs, lsgE: E_lsg, lsgN: N_lsg, H_lsg };
                        }
                    }
                    break;
            }

            spinner.style.display = 'none';
            if (finalResult) {
                resultOsgbE.textContent = finalResult.E_osgb.toFixed(3); resultOsgbN.textContent = finalResult.N_osgb.toFixed(3); resultOsgbH.textContent = finalResult.H_osgb.toFixed(3);
                resultEtrsLat.textContent = finalResult.latitude.toFixed(8); resultEtrsLon.textContent = finalResult.longitude.toFixed(8); resultEtrsH.textContent = finalResult.H_etrs.toFixed(3);
                resultLsgE.textContent = finalResult.lsgE.toFixed(3); resultLsgN.textContent = finalResult.lsgN.toFixed(3); resultLsgH.textContent = finalResult.H_lsg.toFixed(3);
                resultContainer.style.display = 'block';
            } else {
                alert("Calculation failed or coordinate is outside the supported transformation area.");
            }
        }, 50);
    }
    
    // --------------------------------------------------------------------
    // --- 3. EVENT LISTENERS AND INITIALIZATION ---
    // --------------------------------------------------------------------
    
    aboutBtn.addEventListener('click', () => {
        aboutSection.classList.toggle('hidden');
        aboutBtn.textContent = aboutSection.classList.contains('hidden') ? 'About This Tool' : 'Hide About Section';
    });

    modeSelector.addEventListener('change', (event) => {
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
        },
        error: error => {
            console.error("ERROR: Papa Parse 'error' callback fired.", error);
            statusText.textContent = "Error: Failed to load transformation data.";
            statusText.style.color = '#ff4444';
            alert(`Failed to load or parse OSTN15 data. Check console (F12). Error: ${error.message}`);
        }
    });
});
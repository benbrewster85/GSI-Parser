'use strict';

// --- Global State ---
let rawFileData = '';
let starNetSetups = []; 
let traverseSequence = []; 
let knownCoordinates = {}; 

const elements = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    status: document.getElementById('status'),
    statsSection: document.getElementById('statsSection'),
    traverseBuilderSection: document.getElementById('traverseBuilderSection'),
    
    // Stats
    statSetups: document.getElementById('statSetups'),
    statObservations: document.getElementById('statObservations'),
    statPoints: document.getElementById('statPoints'),
    statHanging: document.getElementById('statHanging'),

    // Traverse UI
    travStartStation: document.getElementById('travStartStation'),
    travNextStation: document.getElementById('travNextStation'),
    addTravStationBtn: document.getElementById('addTravStationBtn'),
    clearTravBtn: document.getElementById('clearTravBtn'),
    traverseSequenceList: document.getElementById('traverseSequenceList'),
    linkTraverseCloseBlock: document.getElementById('linkTraverseCloseBlock'),
    runBowditchBtn: document.getElementById('runBowditchBtn'),

    exportPdfBtn: document.getElementById('exportPdfBtn'),
    
    // About Toggle
    aboutBtn: document.getElementById('aboutBtn'),
    aboutSection: document.getElementById('aboutSection'),
    aboutToggle: document.getElementById('aboutToggle'),

    // Network Plot
    networkPlotSection: document.getElementById('networkPlotSection'),
    networkCanvas: document.getElementById('networkCanvas'),
    networkToggle: document.getElementById('networkToggle'),

    // Control Manager
    controlSection: document.getElementById('controlSection'),
    controlTableBody: document.getElementById('controlTableBody'),
    newCtrlId: document.getElementById('newCtrlId'),
    newCtrlE: document.getElementById('newCtrlE'),
    newCtrlN: document.getElementById('newCtrlN'),
    addCtrlBtn: document.getElementById('addCtrlBtn'),
    controlToggle: document.getElementById('controlToggle'),
};

// --- Initialization & Event Listeners ---
function init() {
    // Upload Events
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); elements.uploadArea.classList.add('dragover'); });
    elements.uploadArea.addEventListener('dragleave', () => elements.uploadArea.classList.remove('dragover'));
    elements.uploadArea.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Traverse Events
    elements.travStartStation.addEventListener('change', () => { traverseSequence = []; updateTraverseUI(); });
    elements.addTravStationBtn.addEventListener('click', addStationToSequence);
    elements.clearTravBtn.addEventListener('click', () => { traverseSequence = []; updateTraverseUI(); });
    elements.runBowditchBtn.addEventListener('click', executeBowditch);
    elements.exportPdfBtn?.addEventListener('click', generatePDFReport);

    // About UI
    elements.aboutBtn?.addEventListener('click', () => elements.aboutSection.classList.toggle('hidden'));
    elements.aboutToggle?.addEventListener('click', () => elements.aboutSection.classList.add('hidden'));

    // Network & Control UI
    elements.networkToggle?.addEventListener('click', () => {
        const canvas = elements.networkCanvas;
        canvas.style.display = canvas.style.display === 'none' ? 'block' : 'none';
        elements.networkToggle.textContent = canvas.style.display === 'none' ? 'Show' : 'Hide';
    });

    elements.addCtrlBtn?.addEventListener('click', addControlPoint);
    elements.controlToggle?.addEventListener('click', () => {
        const content = elements.controlSection.querySelector('.advanced-content');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
        elements.controlToggle.textContent = content.style.display === 'none' ? 'Show' : 'Hide';
    });
}

// --- File Handling ---
function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) processFiles(e.target.files);
}

async function processFiles(fileList) {
    const files = Array.from(fileList);
    const fileNames = files.map(f => f.name);
    showStatus(`Reading ${files.length} file(s)...`, 'info');

    try {
        const fileContents = await Promise.all(files.map(readFileAsync));
        rawFileData = fileContents.join('\n\n.FILE_BOUNDARY\n\n');
        parseStarNetData(rawFileData);
        
        const fileListHTML = fileNames.length > 3 
            ? `${fileNames.slice(0, 3).join(', ')} ...and ${fileNames.length - 3} more` 
            : fileNames.join(', ');

        elements.uploadArea.innerHTML = `
            <div style="font-size: 36px; margin-bottom: 10px;">📄</div>
            <div><strong>Loaded ${files.length} file(s):</strong><br><small>${fileListHTML}</small></div>
            <div style="font-size: 12px; color: var(--text-dim); margin-top: 10px;">
                Drop or click to replace with new files
            </div>
        `;
        
        showStatus('Network files merged and parsed successfully.', 'success');
        elements.statsSection.classList.remove('hidden');
        elements.traverseBuilderSection.classList.remove('hidden');
    } catch (error) {
        console.error('File reading error:', error);
        showStatus('✗ Error reading files. Please check the file formats.', 'error');
    }
    document.getElementById('exportPdfBtn').style.display = 'block';
}

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}



// --- Parsing Logic ---
function parseStarNetData(data) {
    starNetSetups = [];
    knownCoordinates = {}; 
    const lines = data.split('\n');
    let totalObs = 0;
    const allPoints = new Set();
    const setupMap = new Map();

    function getSetup(station) {
        let stn = station.replace(/['"]/g, '');
        if (!setupMap.has(stn)) {
            setupMap.set(stn, { station: stn, hi: null, observations: {} });
            allPoints.add(stn);
        }
        return setupMap.get(stn);
    }

    function getObs(setup, target) {
        let tgt = target.replace(/['"]/g, '');
        if (!setup.observations[tgt]) {
            setup.observations[tgt] = { target: tgt, rawLines: [] };
            allPoints.add(tgt);
        }
        return setup.observations[tgt];
    }

    // --- PASTE THIS MISSING FUNCTION HERE ---
    function splitRoute(routeStr) {
        if (!routeStr) return [];
        // Respect quotes for station names that contain hyphens natively (e.g. "P-1")
        if (routeStr.includes("'") || routeStr.includes('"')) {
            const matches = routeStr.match(/['"]([^'"]+)['"]/g);
            if (matches && matches.length >= 2) {
                return matches.map(m => m.replace(/['"]/g, ''));
            }
        }
        // Otherwise, just split by hyphen
        return routeStr.split('-').filter(p => p.trim() !== '');
    }

    let activeStation = null;

    lines.forEach(line => {
        let cleanLine = line.split(/[!#]/)[0].trim();
        if (!cleanLine) return;

        let hi = null, ht = null;
        if (cleanLine.includes('@')) {
            const parts = cleanLine.split('@');
            cleanLine = parts[0].trim();
            const heights = parts[1].split(/[/\s]+/);
            if (heights[0] && !isNaN(parseFloat(heights[0]))) hi = parseFloat(heights[0]);
            if (heights[1] && !isNaN(parseFloat(heights[1]))) ht = parseFloat(heights[1]);
        }

        const tokens = cleanLine.split(/[\s,]+/);
        const recordType = tokens[0].toUpperCase();

        // 0. Boundary Reset
        if (recordType === '.FILE_BOUNDARY') {
            activeStation = null;
            return;
        }

        // 1. Ignore system directives and GNSS Vectors
        if (recordType.startsWith('.') || ['G0', 'G1', 'G2', 'G3'].includes(recordType)) return;

        // Get the structural shape of the target/station string
        const route = splitRoute(tokens[1] || "");

        // 2. Parse Control Coordinates (C)
        if (recordType === 'C' && tokens.length >= 4) {
            const ptName = tokens[1].replace(/['"]/g, '');
            knownCoordinates[ptName] = { n: parseFloat(tokens[2]), e: parseFloat(tokens[3]) };
            allPoints.add(ptName);
        }
        
        // --- THE FIX: ROUTE SHAPE DETECTION ---

        // 3. Parse Inline 3-Point Angles (A At-From-To, M At-From-To)
        else if (['A', 'M'].includes(recordType) && route.length === 3) {
            const setup = getSetup(route[0]); 
            const bsObs = getObs(setup, route[1]); 
            const fsObs = getObs(setup, route[2]); 

            if (!bsObs.hz) bsObs.hz = "0.0000"; // Anchor the backsight
            fsObs.hz = tokens[2];
            
            // If distance is provided on the line, grab it
            if (tokens.length >= 4) fsObs.hd = tokens[3]; 
            
            fsObs.rawLines.push(cleanLine);
            totalObs++;
        }

        // 4. Parse Standalone 2-Point Vectors (D At-To, M At-To, etc)
        else if (['D', 'S', 'V', 'DV', 'SD', 'TR', 'SS', 'M'].includes(recordType) && route.length === 2) {
            const setup = getSetup(route[0]);
            const obs = getObs(setup, route[1]);
            obs.rawLines.push(cleanLine);
            totalObs++;

            if (['D', 'TR', 'SS'].includes(recordType)) obs.hd = tokens[2];
            if (recordType === 'S') obs.sd = tokens[2];
            if (recordType === 'V') obs.v = tokens[2];
            
            if (recordType === 'M') {
                obs.hz = tokens[2]; // Direction
                if (tokens.length >= 4) obs.hd = tokens[3]; // Distance
            }
            
            if (['DV', 'SD'].includes(recordType)) {
                if (recordType === 'DV') obs.hd = tokens[2];
                if (recordType === 'SD') obs.sd = tokens[2];
                if (tokens.length >= 4) obs.v = tokens[3];
            }
            if (ht !== null) obs.ht = ht;
        }

        // 5. Start of Round (DB or standard Native M Block Headers)
        else if (['DB', 'M'].includes(recordType) && route.length === 1) {
            activeStation = tokens[1].replace(/['"]/g, '');
            const setup = getSetup(activeStation);
            if (hi !== null) setup.hi = hi;
        }

        // --- END ROUTE SHAPE DETECTION ---
        
        // 6. End of Round (DE)
        else if (recordType === 'DE') {
            activeStation = null;
        }
        
        // 7. SCC Measurement (DM)
        else if (recordType === 'DM' && activeStation && tokens.length >= 5) {
            const target = tokens[1].replace(/['"]/g, '');
            const setup = getSetup(activeStation);
            const obs = getObs(setup, target);

            obs.hz = tokens[2];
            obs.sd = tokens[3];
            obs.v = tokens[4];
            obs.rawLines.push(cleanLine);
            totalObs++;

            if (tokens.length >= 6 && tokens[5].includes('/')) {
                const hParts = tokens[5].split('/');
                if (hParts[0] && !isNaN(parseFloat(hParts[0]))) setup.hi = parseFloat(hParts[0]);
                if (hParts[1] && !isNaN(parseFloat(hParts[1]))) obs.ht = parseFloat(hParts[1]);
            }
        }

        // 8. Native StarNet Implicit Targets (Lines under an M header)
        else if (activeStation && !['DE', 'DB', 'DM', 'C', 'E', 'A'].includes(recordType)) {
            const target = tokens[0].replace(/['"]/g, '');
            const setup = getSetup(activeStation);
            const obs = getObs(setup, target);

            obs.hz = tokens[1];
            obs.rawLines.push(cleanLine);
            totalObs++;

            if (tokens.length >= 3) obs.sd = tokens[2]; 
            if (tokens.length >= 4) obs.v = tokens[3];
        }
    });

    // Cleanup: Only keep setups that actually have valid observations
    setupMap.forEach(setup => {
        const obsArray = Object.values(setup.observations);
        if (obsArray.length > 0) {
            setup.observations = obsArray;
            starNetSetups.push(setup);
        }
    });

    // Update UI Stats
    elements.statSetups.textContent = starNetSetups.length;
    elements.statObservations.textContent = totalObs;
    elements.statPoints.textContent = allPoints.size;
    elements.statHanging.textContent = '-'; 

    populateTraverseDropdowns();
    drawNetworkPlot();
    renderControlTable();
    elements.controlSection.classList.remove('hidden');
}

// --- Control Manager Logic ---
function renderControlTable() {
    elements.controlTableBody.innerHTML = '';
    for (const [pt, coords] of Object.entries(knownCoordinates)) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${pt}</strong></td>
            <td class="numeric">${coords.e.toFixed(3)}</td>
            <td class="numeric">${coords.n.toFixed(3)}</td>
            <td><button class="btn" style="padding: 2px 6px; font-size: 11px;" onclick="removeControlPoint('${pt}')">Remove</button></td>
        `;
        elements.controlTableBody.appendChild(row);
    }
}

function addControlPoint() {
    const pt = elements.newCtrlId.value.trim();
    const e = parseFloat(elements.newCtrlE.value);
    const n = parseFloat(elements.newCtrlN.value);
    
    if (pt && !isNaN(e) && !isNaN(n)) {
        knownCoordinates[pt] = { e, n };
        renderControlTable();
        elements.newCtrlId.value = '';
        elements.newCtrlE.value = '';
        elements.newCtrlN.value = '';
    } else {
        showStatus('Please enter valid ID, Easting, and Northing.', 'warning');
    }
}

window.removeControlPoint = function(pt) {
    delete knownCoordinates[pt];
    renderControlTable();
};


// --- Traverse Builder UI Logic ---
function populateTraverseDropdowns() {
    elements.travStartStation.innerHTML = '';
    const uniqueStations = Array.from(new Set(starNetSetups.map(s => s.station)));
    uniqueStations.forEach(stn => {
        const opt = document.createElement('option');
        opt.value = stn;
        opt.textContent = stn;
        elements.travStartStation.appendChild(opt);
    });
    traverseSequence = [];
    updateTraverseUI();
}

function updateNextStationDropdown() {
    elements.travNextStation.innerHTML = '<option value="">Select Next Station...</option>';
    let activeStn = traverseSequence.length > 0 ? traverseSequence[traverseSequence.length - 1] : elements.travStartStation.value;
    
    if (!activeStn) return;

    // Get the specific setup for the station we are currently sitting at
    const setup = starNetSetups.find(s => s.station === activeStn);

    // If there is no setup here, it's a dead end
    if (!setup) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "-- Dead End (No instrument setup data) --";
        elements.travNextStation.appendChild(opt);
        elements.addTravStationBtn.disabled = true;
        return;
    }

    // Identify the previous station so we don't accidentally traverse backwards
    const previousStn = traverseSequence.length > 1 ? traverseSequence[traverseSequence.length - 2] : null;

    let hasValidOptions = false;

    setup.observations.forEach(obs => {
        // Hide the backsight from the forward options
        if (obs.target === previousStn) return; 
        
        // Check if the target exists as a setup elsewhere in the network
        const isOccupied = starNetSetups.some(s => s.station === obs.target);
        
        const option = document.createElement('option');
        option.value = obs.target;
        
        // Visually label Dead Ends in the UI so the user is warned
        if (isOccupied) {
            option.textContent = `▶ ${obs.target} (Traverse Station)`;
            hasValidOptions = true;
        } else {
            option.textContent = `⨂ ${obs.target} (Sideshot / Dead End)`;
            option.disabled = true; // Prevent selecting sideshots entirely
        }
        
        elements.travNextStation.appendChild(option);
    });

    // Disable the "Add" button if there are no valid forward traverse stations
    elements.addTravStationBtn.disabled = !hasValidOptions;
}

function addStationToSequence() {
    const nextStn = elements.travNextStation.value;
    if (nextStn) {
        traverseSequence.push(nextStn);
        updateTraverseUI();
    }
}

function updateTraverseUI() {
    const startStn = elements.travStartStation.value;
    if (traverseSequence.length === 0) {
        elements.traverseSequenceList.innerHTML = `<em>Start: ${startStn || '???'} -> [Select next station & click Add]</em>`;
        if(elements.linkTraverseCloseBlock) elements.linkTraverseCloseBlock.classList.add('hidden');
        elements.runBowditchBtn.disabled = true;
    } else {
        let html = `<strong>1. ${startStn}</strong> (Start)<br>`;
        traverseSequence.forEach((stn, index) => {
            html += `   ↓<br><strong>${index + 2}. ${stn}</strong><br>`;
        });
        elements.traverseSequenceList.innerHTML = html;

        if (traverseSequence.length >= 2) {
            elements.runBowditchBtn.disabled = false;
        } else {
            elements.runBowditchBtn.disabled = true;
        }
    }
    updateNextStationDropdown();
}

// --- Math Helpers ---
function parseAngleToDecimal(angleStr) {
    if (!angleStr) return 0;
    let parts = angleStr.toString().split('-');
    if (parts.length === 3) {
        return parseFloat(parts[0]) + (parseFloat(parts[1]) / 60) + (parseFloat(parts[2]) / 3600);
    }
    const num = parseFloat(angleStr);
    const deg = Math.floor(num);
    const minStr = ((num - deg) * 100).toFixed(4);
    const min = Math.floor(parseFloat(minStr));
    const sec = (parseFloat(minStr) - min) * 100;
    return deg + (min / 60) + (sec / 3600);
}

function resolveHorizontalDistance(obs) {
    // 1. Prioritize pre-calculated Horizontal Distance (from D, DV, or inline HD records)
    if (obs.hd) return parseFloat(obs.hd);
    
    // 2. Reduce Slope Distance using the Zenith Angle
    if (obs.sd && obs.v) {
        const sd = parseFloat(obs.sd);
        const zenithDecimal = parseAngleToDecimal(obs.v);
        
        // Convert degrees to radians for JS Math functions
        const zenithRad = zenithDecimal * (Math.PI / 180);
        
        // HD = SD * sin(Zenith)
        return Math.abs(sd * Math.sin(zenithRad));
    }
    
    // 3. Fallback: If no vertical angle exists, assume it's already a 2D distance
    return parseFloat(obs.sd) || 0;
}

// --- The Bowditch Engine ---
function executeBowditch() {
    const startStn = elements.travStartStation.value;
    const fullSequence = [startStn, ...traverseSequence];
    
    // 1. Check Starting Anchors
    if (!knownCoordinates[startStn]) {
        showStatus(`Error: Start Station '${startStn}' has no fixed coordinates. Add it to the Control Manager above.`, 'error');
        return;
    }
    
    let currentE = knownCoordinates[startStn].e;
    let currentN = knownCoordinates[startStn].n;
    let currentAzimuth = parseAngleToDecimal(document.getElementById('travStartAzimuth').value || "0-00-00");
    
    let totalTraverseDistance = 0;
    const traverseData = []; 

    traverseData.push({
        station: startStn,
        distance: 0,
        unadjE: currentE,
        unadjN: currentN,
        runningDist: 0
    });

    // --- Inside executeBowditch() ---

    // 2. Build Unadjusted Route
    for (let i = 0; i < fullSequence.length - 1; i++) {
        const fromStn = fullSequence[i];
        const toStn = fullSequence[i + 1];

        // Find ALL setups at this station
        const matchingSetups = starNetSetups.filter(s => s.station === fromStn);
        if (matchingSetups.length === 0) {
            showStatus(`Error: Could not find setup data for ${fromStn}.`, 'error');
            return;
        }

        let distance = 0;
        let angleTurned = 0;

        if (i > 0) {
            // Needs BOTH Backsight and Foresight in the SAME setup to turn an angle
            const bsStn = fullSequence[i - 1];
            let validSetup = null, fsObs = null, bsObs = null;

            for (const s of matchingSetups) {
                const tempFs = s.observations.find(o => o.target === toStn);
                const tempBs = s.observations.find(o => o.target === bsStn);
                if (tempFs && tempBs) {
                    validSetup = s; 
                    fsObs = tempFs; 
                    bsObs = tempBs;
                    break;
                }
            }

            if (!validSetup) {
                showStatus(`Error: No single setup at '${fromStn}' contains observations to BOTH '${bsStn}' (BS) and '${toStn}' (FS). Cannot calculate angle.`, 'error');
                return;
            }

            distance = resolveHorizontalDistance(fsObs);
            const bsHz = parseAngleToDecimal(bsObs.hz);
            const fsHz = parseAngleToDecimal(fsObs.hz);
            
            angleTurned = fsHz - bsHz;
            if (angleTurned < 0) angleTurned += 360;
            
            currentAzimuth = (currentAzimuth + angleTurned + 180) % 360;

        } else {
            // First leg: Just needs a foresight (starting azimuth is fixed manually)
            let fsObs = null;
            for (const s of matchingSetups) {
                fsObs = s.observations.find(o => o.target === toStn);
                if (fsObs) break;
            }

            if (!fsObs) {
                showStatus(`Error: No observation found from ${fromStn} to ${toStn}.`, 'error');
                return;
            }
            distance = resolveHorizontalDistance(fsObs);
        }

        const azRad = currentAzimuth * (Math.PI / 180);
        const deltaE = distance * Math.sin(azRad);
        const deltaN = distance * Math.cos(azRad);

        currentE += deltaE;
        currentN += deltaN;
        totalTraverseDistance += distance;

        traverseData.push({
            station: toStn,
            distance: distance,
            unadjE: currentE,
            unadjN: currentN,
            runningDist: totalTraverseDistance
        });
    }

    // 3. Determine Misclose
    const finalStn = fullSequence[fullSequence.length - 1];
    
    if (!knownCoordinates[finalStn]) {
        showStatus(`Error: Final Station '${finalStn}' has no fixed coordinates in the Control Manager. Cannot calculate closing error.`, 'error');
        return;
    }

    let targetE = knownCoordinates[finalStn].e;
    let targetN = knownCoordinates[finalStn].n;

    const miscloseE = traverseData[traverseData.length - 1].unadjE - targetE;
    const miscloseN = traverseData[traverseData.length - 1].unadjN - targetN;
    
    const linearMisclose = Math.sqrt(Math.pow(miscloseE, 2) + Math.pow(miscloseN, 2));
    const proportionalError = linearMisclose > 0 ? Math.round(totalTraverseDistance / linearMisclose) : 0;

    // 4. Adjust and Render
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';

    traverseData.forEach((leg) => {
        let adjE = leg.unadjE;
        let adjN = leg.unadjN;

        if (leg.runningDist > 0 && totalTraverseDistance > 0) {
            adjE = leg.unadjE - (miscloseE * (leg.runningDist / totalTraverseDistance));
            adjN = leg.unadjN - (miscloseN * (leg.runningDist / totalTraverseDistance));
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${leg.station}</strong></td>
            <td class="numeric">${leg.distance > 0 ? leg.distance.toFixed(3) : '-'}</td>
            <td class="numeric">${leg.unadjE.toFixed(3)}</td>
            <td class="numeric">${leg.unadjN.toFixed(3)}</td>
            <td class="numeric" style="color: var(--primary); font-weight: bold;">${adjE.toFixed(3)}</td>
            <td class="numeric" style="color: var(--primary); font-weight: bold;">${adjN.toFixed(3)}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('resLinearMisclose').textContent = `${linearMisclose.toFixed(4)}m`;
    document.getElementById('resProportional').textContent = proportionalError > 0 ? `1 in ${proportionalError.toLocaleString()}` : 'Perfect Match';
    document.getElementById('resAngularMisclose').textContent = "N/A (Coordinate Only)";
    document.getElementById('traverseResultsSection').classList.remove('hidden');
    showStatus('Traverse calculated successfully!', 'success');
}

function showStatus(message, type) {
    elements.status.innerHTML = message;
    elements.status.className = 'status ' + type;
    elements.status.classList.remove('hidden');
}

// --- Network Plotting Logic (Vis.js) ---
function drawNetworkPlot() {
    if (!starNetSetups || starNetSetups.length === 0) return;

    const nodesData = new Map();
    const edgesData = [];
    const occupiedStations = new Set(starNetSetups.map(s => s.station));

    starNetSetups.forEach(setup => {
        if (!nodesData.has(setup.station)) {
            nodesData.set(setup.station, {
                id: setup.station, label: setup.station, shape: 'box',
                color: { background: '#2563eb', border: '#1e40af' }, font: { color: '#ffffff' }
            });
        }
        setup.observations.forEach(obs => {
            if (!nodesData.has(obs.target)) {
                const isOccupiedLater = occupiedStations.has(obs.target);
                nodesData.set(obs.target, {
                    id: obs.target, label: obs.target, shape: isOccupiedLater ? 'box' : 'dot', size: 10,
                    color: isOccupiedLater ? { background: '#2563eb', border: '#1e40af' } : { background: '#9ca3af', border: '#4b5563' },
                    font: { color: '#1f2937' } 
                });
            }
            edgesData.push({ from: setup.station, to: obs.target, arrows: 'to', color: { color: '#cbd5e1', opacity: 0.7 }});
        });
    });

    const options = {
        physics: {
            forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100, springConstant: 0.08 },
            maxVelocity: 50, solver: 'forceAtlas2Based', timestep: 0.35, stabilization: { iterations: 150 }
        },
        interaction: { dragNodes: true, zoomView: true, dragView: true }
    };

    new vis.Network(elements.networkCanvas, { nodes: Array.from(nodesData.values()), edges: edgesData }, options);
    elements.networkPlotSection.classList.remove('hidden');
}

// --- Advanced Network Analysis & PDF Export ---

let extendedAnalysis = {
    totalDistance: 0,
    outliers: [],
    unknowns: 0
};

// Hook up the PDF button in your init() function
// Add this line to init(): elements.exportPdfBtn = document.getElementById('exportPdfBtn');
// Add this line to init(): elements.exportPdfBtn.addEventListener('click', generatePDFReport);

function analyzeNetworkData() {
    extendedAnalysis.totalDistance = 0;
    extendedAnalysis.outliers = [];
    
    const uniquePoints = new Set();
    const observedDistances = new Set(); // To prevent double-counting reciprocal obs

    starNetSetups.forEach(setup => {
        uniquePoints.add(setup.station);
        
        // Group observations by target to check for Face 1 / Face 2 spreads
        const obsByTarget = {};
        setup.observations.forEach(obs => {
            uniquePoints.add(obs.target);
            if (!obsByTarget[obs.target]) obsByTarget[obs.target] = [];
            obsByTarget[obs.target].push(obs);
        });

        // Analyze Spreads & Distances
        for (const [target, obsList] of Object.entries(obsByTarget)) {
            // Track distance (naive average if multiple shots)
            const dists = obsList.map(o => parseFloat(o.sd)).filter(d => !isNaN(d));
            if (dists.length > 0) {
                const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
                // Create a unique key for the leg (e.g., "A-B" or "B-A" sorted alphabetically)
                const legKey = [setup.station, target].sort().join('-');
                if (!observedDistances.has(legKey)) {
                    extendedAnalysis.totalDistance += avgDist;
                    observedDistances.add(legKey);
                }
            }

            // Outlier Detection (If multiple shots to same target)
            if (obsList.length > 1) {
                const hzAngles = obsList.map(o => parseAngleToDecimal(o.hz));
                
                // Very basic check: If max difference is > 15 arc-seconds (ignoring 180deg face flips)
                // Normalize angles to 0-180 for basic spread checking
                const normalizedHz = hzAngles.map(a => a >= 180 ? a - 180 : a);
                const maxSpread = (Math.max(...normalizedHz) - Math.min(...normalizedHz)) * 3600; // in seconds

                if (maxSpread > 15) { // 15 seconds tolerance threshold
                    extendedAnalysis.outliers.push({
                        station: setup.station,
                        target: target,
                        spread: maxSpread.toFixed(1) + '"',
                        issue: 'High Hz Spread'
                    });
                }
            }
        }
    });

    extendedAnalysis.unknowns = uniquePoints.size - Object.keys(knownCoordinates).length;
}

function generatePDFReport() {
    // Run the analysis right before printing
    analyzeNetworkData();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // --- Header ---
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175); // Primary Blue
    doc.text("Star*Check Pre-Analysis Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Software: SurveyTools | Assessor: B Brewster`, 14, 33);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 38, 196, 38);

    // --- Network Summary ---
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("1. Network Topology Summary", 14, 48);
    
    doc.setFontSize(11);
    doc.text(`Total Occupied Setups: ${starNetSetups.length}`, 14, 56);
    doc.text(`Total Unique Points: ${elements.statPoints.textContent}`, 14, 62);
    doc.text(`Fixed Control Points: ${Object.keys(knownCoordinates).length}`, 14, 68);
    doc.text(`Unknown Points: ${extendedAnalysis.unknowns}`, 14, 74);
    doc.text(`Total Observed Linear Distance: ~${extendedAnalysis.totalDistance.toFixed(1)} m`, 14, 80);

    // --- Outliers / Warnings ---
    doc.setFontSize(14);
    doc.text("2. Data Quality & Outliers", 14, 95);
    
    if (extendedAnalysis.outliers.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(5, 150, 105); // Green
        doc.text("No gross outliers or high spreads detected within setups.", 14, 103);
    } else {
        doc.autoTable({
            startY: 100,
            head: [['Station', 'Target', 'Spread', 'Flag']],
            body: extendedAnalysis.outliers.map(o => [o.station, o.target, o.spread, o.issue]),
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38] } // Red header for warnings
        });
    }

    // --- Control Coordinates Used ---
    let nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 120;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("3. Fixed Control (Anchors)", 14, nextY);

    const controlBody = Object.entries(knownCoordinates).map(([pt, coords]) => [pt, coords.e.toFixed(3), coords.n.toFixed(3)]);
    
    if (controlBody.length > 0) {
        doc.autoTable({
            startY: nextY + 5,
            head: [['Point ID', 'Easting (m)', 'Northing (m)']],
            body: controlBody,
            theme: 'grid',
            headStyles: { fillColor: [30, 64, 175] }
        });
    } else {
        doc.setFontSize(11);
        doc.text("No fixed control coordinates provided (Free Network).", 14, nextY + 8);
    }

    // --- Traverse Audit Results (If Available) ---
    nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : nextY + 25;
    
    // Check if a Bowditch was actually run
    const tbody = document.getElementById('resultsTableBody');
    if (tbody && tbody.children.length > 0) {
        
        // Add new page if we are too far down
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        
        doc.setFontSize(14);
        doc.text("4. Linear Traverse Audit (Bowditch)", 14, nextY);
        
        const linearMisclose = document.getElementById('resLinearMisclose').textContent;
        const propError = document.getElementById('resProportional').textContent;
        
        doc.setFontSize(11);
        doc.text(`Linear Misclose: ${linearMisclose}`, 14, nextY + 8);
        doc.text(`Proportional Error: ${propError}`, 14, nextY + 14);

        // Scrape the HTML table to build the PDF table
        const rows = [];
        for (let i = 0; i < tbody.children.length; i++) {
            const tr = tbody.children[i];
            rows.push([
                tr.children[0].textContent, // Station
                tr.children[1].textContent, // Dist
                tr.children[4].textContent, // Adj E
                tr.children[5].textContent  // Adj N
            ]);
        }

        doc.autoTable({
            startY: nextY + 20,
            head: [['Station', 'Distance (m)', 'Adj Easting', 'Adj Northing']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] } // Green header
        });
    }

    // Save the PDF
    const filename = `Network_PreCheck_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    showStatus('PDF Report generated successfully.', 'success');
}

// Boot the app
document.addEventListener('DOMContentLoaded', init);
// tools/lcs-converter/lcs-engine.js

// --- Core Vector Math Operations ---
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dotProduct = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normSq = (v) => dotProduct(v, v);
const norm = (v) => Math.sqrt(normSq(v));

function projectPointToSegment(p1, p2, pInput, p1_m) {
    const v = subtract(p2, p1);
    const w = subtract(pInput, p1);
    const vNormSq = normSq(v);
    if (vNormSq === 0) return { closestPt: p1, segmentM: p1_m };
    const t = Math.max(0, Math.min(1, dotProduct(w, v) / vNormSq));
    const closestPt = [p1[0] + t * v[0], p1[1] + t * v[1], p1[2] + t * v[2]];
    return { closestPt, segmentM: p1_m + (t * norm(v)) };
}

// Global Bounding Box Pre-Filter cache
let cachedBounds = null;
function getTrackBounds(networkData) {
    if (cachedBounds) return cachedBounds;
    const bounds = {};
    for (const [prefix, points] of Object.entries(networkData)) {
        let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.e < minE) minE = p.e;
            if (p.e > maxE) maxE = p.e;
            if (p.n < minN) minN = p.n;
            if (p.n > maxN) maxN = p.n;
        }
        bounds[prefix] = { minE, maxE, minN, maxN };
    }
    cachedBounds = bounds;
    return bounds;
}

// 1. COORDINATE TO LCS (Global Auto-Detection)
function findGlobal3DMatch(networkData, easting, northing, elevation) {
    const pInput = [easting, northing, elevation];
    const bounds = getTrackBounds(networkData);
    let bestPrefix = "", bestClosest3D = null, bestM = 0, minDist3D = Infinity, bestIdx = 0;
    const pad = 50; 

    for (const [prefix, track] of Object.entries(networkData)) {
        const box = bounds[prefix];
        if (easting < box.minE - pad || easting > box.maxE + pad ||
            northing < box.minN - pad || northing > box.maxN + pad) {
            continue;
        }
        for (let i = 0; i < track.length - 1; i++) {
            const p1 = [track[i].e, track[i].n, track[i].z];
            const p2 = [track[i+1].e, track[i+1].n, track[i+1].z];
            const { closestPt, segmentM } = projectPointToSegment(p1, p2, pInput, track[i].m);
            const dist = norm(subtract(pInput, closestPt));
            if (dist < minDist3D) {
                minDist3D = dist;
                bestPrefix = prefix;
                bestClosest3D = closestPt;
                bestM = segmentM;
                bestIdx = i;
            }
        }
    }

    if (!bestClosest3D || !bestPrefix) throw new Error("No matching track alignment found.");

    const track = networkData[bestPrefix];
    const p1 = track[bestIdx];
    const p2 = track[bestIdx + 1];
    const headingNorm = Math.hypot(p2.e - p1.e, p2.n - p1.n);
    const dirX = (p2.e - p1.e) / headingNorm;
    const dirY = (p2.n - p1.n) / headingNorm;
    const crossProduct2D = (dirX * (northing - bestClosest3D[1])) - (dirY * (easting - bestClosest3D[0]));
    
    return { 
        assetPrefix: bestPrefix,
        chainage: bestM, 
        direction: crossProduct2D > 0 ? "L" : "R", 
        horizontalOffset: Math.hypot(easting - bestClosest3D[0], northing - bestClosest3D[1]), 
        verticalOffset: elevation - bestClosest3D[2] 
    };
}

// 2. LCS TO COORDINATE (Reverse Calculation Engine)
function findCoordinatesFromLCS(networkData, lcsCode) {
    const regex = /^([A-Za-z0-9\-]+?)-(\d+(?:\.\d+)?)-([LRlr])(\d+(?:\.\d+)?)$/;
    const match = lcsCode.trim().match(regex);
    if (!match) throw new Error("Invalid LCS format syntax.");
    
    const assetPrefix = match[1];
    const targetM = parseFloat(match[2]);
    const direction = match[3].toUpperCase();
    const offsetH = parseFloat(match[4]);

    const track = networkData[assetPrefix];
    if (!track) throw new Error(`Track prefix not found: ${assetPrefix}`);

    // --- NEW GUARDRAIL: Extrapolation Blocker ---
    const minM = track[0].m;
    const maxM = track[track.length - 1].m;
    
    // We include a 1mm (0.001) tolerance to prevent false flags on floating-point rounding
    if (targetM < minM - 0.001 || targetM > maxM + 0.001) {
        throw new Error(`Chainage ${targetM.toFixed(3)} is out of bounds. Valid limits: ${minM.toFixed(3)} to ${maxM.toFixed(3)}`);
    }
    // --------------------------------------------

    let lowIdx = 0, highIdx = track.length - 1;
    
    if (targetM <= track[lowIdx].m) {
        highIdx = 1;
    } else if (targetM >= track[highIdx].m) {
        lowIdx = track.length - 2;
    } else {
        while (highIdx - lowIdx > 1) {
            const mid = Math.floor((lowIdx + highIdx) / 2);
            if (track[mid].m <= targetM) lowIdx = mid;
            else highIdx = mid;
        }
    }

    const p1 = track[lowIdx], p2 = track[highIdx];
    const segLenM = p2.m - p1.m;
    const factor = segLenM === 0 ? 0 : (targetM - p1.m) / segLenM;

    const centerE = p1.e + factor * (p2.e - p1.e);
    const centerN = p1.n + factor * (p2.n - p1.n);
    const centerZ = p1.z + factor * (p2.z - p1.z);

    const headingNorm = Math.hypot(p2.e - p1.e, p2.n - p1.n);
    const sign = direction === "L" ? 1 : -1;
    const perpE = -((p2.n - p1.n) / headingNorm) * sign;
    const perpN = ((p2.e - p1.e) / headingNorm) * sign;

    return {
        assetPrefix,
        chainage: targetM,
        easting: centerE + perpE * offsetH,
        northing: centerN + perpN * offsetH,
        elevation: centerZ
    };
}
/**
 * SurveyTools: Resection Analysis Module
 * Adapted for Retro Theme
 */

class ResectionMath {
    calculate(stn, targets, config) {
        if (targets.length < 2) return null;

        const rad = deg => deg * Math.PI / 180;
        const deg = r => r * 180 / Math.PI;
        
        let N = [[0, 0], [0, 0]]; // Normal Matrix

        targets.forEach(t => {
            const dx = t.x - stn.x;
            const dy = t.y - stn.y;
            const distSq = dx*dx + dy*dy;
            const dist = Math.sqrt(distSq);
            if(dist < 0.001) return;

            const az = Math.atan2(dx, dy);

            // 1. ANGLE WEIGHTS
            const sigAng = rad(config.angleSec / 3600);
            const wAng = 1 / (sigAng ** 2);
            
            // Derivatives (Angle)
            const ax_a = Math.cos(az) / dist;
            const ay_a = -Math.sin(az) / dist;

            // Accumulate Angle
            N[0][0] += ax_a * wAng * ax_a;
            N[0][1] += ax_a * wAng * ay_a;
            N[1][0] += ay_a * wAng * ax_a;
            N[1][1] += ay_a * wAng * ay_a;

            // 2. DISTANCE WEIGHTS (If Enabled)
            if (config.useDist) {
                // Formula: Base (m) + (Distance * PPM / 1,000,000)
                const ppmFactor = config.distPpm / 1000000;
                const sigDist = (config.distMm / 1000) + (dist * ppmFactor); 
                const wDist = 1 / (sigDist ** 2);

                // Derivatives (Distance)
                const ax_d = -Math.sin(az); 
                const ay_d = -Math.cos(az);

                // Accumulate Distance
                N[0][0] += ax_d * wDist * ax_d;
                N[0][1] += ax_d * wDist * ay_d;
                N[1][0] += ay_d * wDist * ax_d;
                N[1][1] += ay_d * wDist * ay_d;
            }
        });

        // Invert Normal Matrix to get Covariance Matrix (Qxx)
        const det = N[0][0]*N[1][1] - N[0][1]*N[1][0];
        if (Math.abs(det) < 1e-20) return null; // Singular

        const Q = [
            [N[1][1]/det, -N[0][1]/det],
            [-N[1][0]/det, N[0][0]/det]
        ];

        // Eigen Decomposition for Ellipse Axes (1-Sigma)
        const term1 = (Q[0][0] + Q[1][1]) / 2;
        const term2 = Math.sqrt(((Q[0][0] - Q[1][1]) / 2) ** 2 + Q[0][1] ** 2);
        
        // Orientation
        let theta = 0.5 * Math.atan2(2 * Q[0][1], Q[0][0] - Q[1][1]);
        let bearing = 90 - deg(theta);
        if (bearing < 0) bearing += 360;

        // Raw 1-Sigma Values
        const maj1s = Math.sqrt(term1 + term2);
        const min1s = Math.sqrt(term1 - term2);
        const scalar1s = Math.sqrt(Q[0][0] + Q[1][1]);

        // Apply Confidence Multiplier (K-Factor)
        // K = 1.0 for 1-Sigma (39%)
        // K = 2.447 for 95% Confidence (2D)
        const k = config.confidence || 1.0;

        return {
            maj: maj1s * k,
            min: min1s * k,
            rot: theta,
            brg: bearing,
            scalar: scalar1s * k,
            confidence: k
        };
    }
}

const app = {
    cvs: document.getElementById('mainCanvas'),
    ctx: null,
    container: document.getElementById('canvas-container'),
    
    colors: { bg: '#000', grid: '#333', text: '#fff', accent: '#0f0', danger: 'red' },

    // State
    width: 0, height: 0, cx: 0, cy: 0, 
    scale: 4, // Reduced from 5 to ensure points fit on smaller screens
    stn: { x: 0, y: 0 },
    targets: [
        // Tighter geometry to ensure visibility on load
        { x: -40, y: 30, id: 1 },
        { x: 40, y: 30, id: 2 },
        { x: 0, y: -40, id: 3 } // Moved from -60 to -40
    ],
    nextId: 4,
    
    // Config now includes PPM and Confidence Factor
    config: { angleSec: 5, distMm: 2, distPpm: 2, useDist: true, confidence: 1.0 },
    math: new ResectionMath(),
    dragItem: null, hoverItem: null,

    init() {
        this.ctx = this.cvs.getContext('2d', { alpha: false });
        this.updateThemeColors();

        window.addEventListener('resize', () => this.resize());
        new MutationObserver(() => {
            this.updateThemeColors();
            this.draw();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Bind Sliders
        const bind = (id, prop, lbl, unit) => {
            const el = document.getElementById(id);
            if(!el) return;
            el.addEventListener('input', (e) => {
                this.config[prop] = parseFloat(e.target.value);
                if(lbl) document.getElementById(lbl).innerText = this.config[prop] + unit;
                this.draw();
            });
        };
        bind('inp-ang', 'angleSec', 'lbl-ang', '"');
        bind('inp-dist', 'distMm', 'lbl-dist', 'mm');
        bind('inp-ppm', 'distPpm', 'lbl-ppm', 'ppm');

        // Bind Checkbox
        const chk = document.getElementById('chk-dist');
        if(chk) chk.addEventListener('change', (e) => {
            this.config.useDist = e.target.checked;
            this.draw();
        });

        // Mouse Events
        this.cvs.addEventListener('mousedown', e => this.onDown(e));
        window.addEventListener('mousemove', e => this.onMove(e));
        window.addEventListener('mouseup', e => this.onUp(e));

        this.resize();
    },

    setConfidence(k) {
        this.config.confidence = k;
        
        // Toggle UI Button Styles
        const btn1 = document.getElementById('btn-conf-1');
        const btn95 = document.getElementById('btn-conf-95');
        
        // Reset both
        [btn1, btn95].forEach(b => {
            b.classList.remove('primary');
            b.style.background = 'var(--surface)';
            b.style.border = '1px solid var(--border)';
        });

        // Highlight active
        const active = k === 1 ? btn1 : btn95;
        active.classList.add('primary');
        active.style.background = 'var(--accent)';
        active.style.border = 'none';
        
        this.draw();
    },

    updateThemeColors() {
        const styles = getComputedStyle(document.documentElement);
        this.colors.bg = styles.getPropertyValue('--bg').trim();
        this.colors.grid = styles.getPropertyValue('--border').trim();
        this.colors.text = styles.getPropertyValue('--text').trim();
        this.colors.accent = styles.getPropertyValue('--accent').trim();
        this.colors.dim = styles.getPropertyValue('--text-dim').trim();
    },

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.cvs.width = this.width;
        this.cvs.height = this.height;
        this.cx = this.width / 2;
        this.cy = this.height / 2;
        this.draw();
    },

    // --- MATH HELPERS ---
    toScr(wx, wy) { return { x: this.cx + (wx * this.scale), y: this.cy - (wy * this.scale) }; },
    toWorld(sx, sy) { return { x: (sx - this.cx) / this.scale, y: (this.cy - sy) / this.scale }; },
    
    getMousePos(e) {
        const rect = this.cvs.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },

    getHit(mx, my) {
        const sScr = this.toScr(this.stn.x, this.stn.y);
        if (Math.hypot(mx - sScr.x, my - sScr.y) < 20) return 'stn';
        for (let t of this.targets) {
            const tScr = this.toScr(t.x, t.y);
            if (Math.hypot(mx - tScr.x, my - tScr.y) < 15) return t;
        }
        return null;
    },

    // --- INTERACTION ---
    onDown(e) {
        const m = this.getMousePos(e);
        const item = this.getHit(m.x, m.y);
        if (item) {
            this.dragItem = item;
            document.body.style.cursor = 'grabbing';
            if (e.button === 2 || e.shiftKey) {
                if (item !== 'stn') this.removePoint(item);
                this.dragItem = null;
                document.body.style.cursor = 'default';
            }
        }
    },

    onMove(e) {
        const m = this.getMousePos(e);
        if (this.dragItem) {
            const wPos = this.toWorld(m.x, m.y);
            if (this.dragItem === 'stn') { this.stn.x = wPos.x; this.stn.y = wPos.y; } 
            else { this.dragItem.x = wPos.x; this.dragItem.y = wPos.y; }
            this.draw();
            return;
        }
        const hit = this.getHit(m.x, m.y);
        this.hoverItem = hit;
        this.cvs.style.cursor = hit ? 'grab' : 'crosshair';
    },

    onUp() {
        this.dragItem = null;
        document.body.style.cursor = 'default';
    },

    addPoint() {
        this.targets.push({ x: (Math.random()*40)-20, y: (Math.random()*40)+20, id: this.nextId++ });
        this.draw();
    },

    removePoint(tRef) {
        this.targets = this.targets.filter(t => t !== tRef);
        this.draw();
    },

    reset() {
        // Reset to tighter default coordinates
        this.targets = [
            { x: -40, y: 30, id: 1 },
            { x: 40, y: 30, id: 2 },
            { x: 0, y: -40, id: 3 }
        ];
        this.stn = { x:0, y:0 };
        this.nextId = 4; // Set next ID correctly
        this.draw();
    },

    // --- RENDERER ---
    draw() {
        const ctx = this.ctx;
        const c = this.colors;
        
        // Clear
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Grid (Dots)
        ctx.fillStyle = c.grid; 
        const gs = 50; 
        const offX = this.cx % gs; const offY = this.cy % gs;
        for(let x = offX; x < this.width; x += gs) { 
             for(let y = offY; y < this.height; y += gs) {
                 ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill();
             }
        }

        // Axes
        ctx.strokeStyle = c.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.cx, 0); ctx.lineTo(this.cx, this.height);
        ctx.moveTo(0, this.cy); ctx.lineTo(this.width, this.cy);
        ctx.stroke();

        const sScr = this.toScr(this.stn.x, this.stn.y);

        // Sight Lines
        ctx.strokeStyle = c.dim;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        this.targets.forEach(t => {
            const tScr = this.toScr(t.x, t.y);
            ctx.moveTo(sScr.x, sScr.y);
            ctx.lineTo(tScr.x, tScr.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Targets
        this.targets.forEach(t => {
            const tScr = this.toScr(t.x, t.y);
            const isHover = (this.hoverItem === t);
            
            ctx.strokeStyle = isHover ? c.text : c.accent;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tScr.x, tScr.y, 6, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = c.bg; ctx.fill(); 
            ctx.fillStyle = c.text; 
            ctx.font = '12px "SF Mono", monospace'; 
            ctx.fillText(`TP${t.id}`, tScr.x + 10, tScr.y - 5);
        });

        // Station
        const isStnHover = (this.hoverItem === 'stn');
        ctx.strokeStyle = '#007aff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sScr.x, sScr.y - 12);
        ctx.lineTo(sScr.x - 10, sScr.y + 10);
        ctx.lineTo(sScr.x + 10, sScr.y + 10);
        ctx.closePath();
        ctx.stroke();

        // Ellipse
        const res = this.math.calculate(this.stn, this.targets, this.config);
        if (res) {
            this.updateStats(res);
            const mag = 5000;
            const rx = res.maj * this.scale * mag;
            const ry = res.min * this.scale * mag;

            ctx.strokeStyle = '#ff3b30';
            ctx.fillStyle = 'rgba(255, 59, 48, 0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(sScr.x, sScr.y, rx, ry, -res.rot, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        } else {
            this.updateStats(null);
        }
    },

    updateStats(res) {
        const el = (id) => document.getElementById(id);
        if(!res) {
            ['res-maj','res-min','res-rot','res-scalar'].forEach(id => el(id).innerText = "--");
            return;
        }
        el('res-maj').innerText = (res.maj * 1000).toFixed(1) + " mm";
        el('res-min').innerText = (res.min * 1000).toFixed(1) + " mm";
        el('res-rot').innerText = res.brg.toFixed(1) + "°";
        el('res-scalar').innerText = (res.scalar * 1000).toFixed(1) + " mm";
    }
};

// Start
app.init();
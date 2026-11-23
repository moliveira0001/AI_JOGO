(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const MAX_FUEL = 100;
    const FUEL_PICKUP_AMOUNT = MAX_FUEL * 0.1;
    const startForm = document.getElementById("start-form");
    const playerNameInput = document.getElementById("player-name");
    const scoreStatus = document.getElementById("score-status");
    const rankingList = document.getElementById("ranking-list");
    const endRankingList = document.getElementById("end-ranking-list");
    const startModal = document.getElementById("start-modal");
    const helpModal = document.getElementById("help-modal");
    const resultsModal = document.getElementById("results-modal");
    const finalScore = document.getElementById("final-score");
    const resultsStatus = document.getElementById("results-status");
    const fullscreenStatus = document.getElementById("fullscreen-status");
    const gameActionButton = document.querySelector("[data-action='state']");
    const jumpButton = document.querySelector("[data-action='jump']");
    const touchControlButtons = document.querySelectorAll(".touch-controls [data-key]");
    const fullscreenButtons = document.querySelectorAll("[data-action='fullscreen']");
    const RANKING_STORAGE_KEY = "rivergrip-ranking-v1";

    const STATE = { MENU: "menu", PLAY: "play", OVER: "over", PAUSE: "pause" };
    const MAX_LIVES = 6;
    const keys = new Set();
    let state = STATE.MENU;
    let lastTime = 0;
    let game = null;
    let engineAudio = null;
    let engineOscillator = null;
    let engineGain = null;
    let savedScores = [];
    let rankingAvailable = true;
    let helpOpenedDuringPlay = false;

    const PHASES = [
        { id: 1, name: "FASE 1", subtitle: "Rio Interior", sky: "#b9d8d3", land: "#688b78", water: "#55a8ae", waterDeep: "#468f9b", accent: "#a8f0dc", scenery: ["tree", "tree", "house", "farm"], landmark: "waterfall", spawnLimit: 4, enemySpeed: 0.9, targetScore: 1200, rescueGoal: 2 },
        { id: 2, name: "FASE 2", subtitle: "Floresta Verde", sky: "#b6d9c9", land: "#557f68", water: "#4b9da5", waterDeep: "#39808e", accent: "#b3efd0", scenery: ["pine", "pine", "tree", "rocks"], landmark: "pine", spawnLimit: 5, enemySpeed: 1.05, targetScore: 2200, rescueGoal: 4 },
        { id: 3, name: "FASE 3", subtitle: "Costa e Artilharia", sky: "#a9cad8", land: "#607c72", water: "#438ba5", waterDeep: "#326f8c", accent: "#a9e9ee", scenery: ["palm", "rocks", "house", "farm"], landmark: "lighthouse", spawnLimit: 6, enemySpeed: 1.25, targetScore: 3600, rescueGoal: 6 },
        { id: 4, name: "FASE 4", subtitle: "Zona de Guerra", sky: "#526777", land: "#536b62", water: "#376f86", waterDeep: "#29566d", accent: "#c4ead8", scenery: ["ruins", "rocks", "tower", "rocks"], landmark: "smoke", spawnLimit: 7, enemySpeed: 1.45, targetScore: 5400, rescueGoal: 8 },
        { id: 5, name: "FASE 5", subtitle: "Vale Nebuloso", sky: "#8998ad", land: "#536d68", water: "#3f8293", waterDeep: "#2d657a", accent: "#b5d9e8", scenery: ["pine", "rocks", "house", "pine"], landmark: "fog", spawnLimit: 8, enemySpeed: 1.6, targetScore: 7000, rescueGoal: 10 },
        { id: 6, name: "FASE 6", subtitle: "Delta Tropical", sky: "#8db8a6", land: "#4b765c", water: "#368b83", waterDeep: "#286c70", accent: "#a5ead0", scenery: ["palm", "farm", "tree", "rocks"], landmark: "wetland", spawnLimit: 9, enemySpeed: 1.75, targetScore: 8800, rescueGoal: 12 },
        { id: 7, name: "FASE 7", subtitle: "Canyon Azul", sky: "#a3b5c8", land: "#6b7168", water: "#3f769c", waterDeep: "#305b7d", accent: "#c2e3f5", scenery: ["cactus", "rocks", "canyon", "cactus"], landmark: "canyon", spawnLimit: 10, enemySpeed: 1.9, targetScore: 10800, rescueGoal: 14 },
        { id: 8, name: "FASE 8", subtitle: "Travessia Final", sky: "#677b8f", land: "#555f60", water: "#315f79", waterDeep: "#23495f", accent: "#d0e8e3", scenery: ["volcano", "ruins", "rocks", "tower"], landmark: "volcano", spawnLimit: 11, enemySpeed: 2.05, targetScore: 13000, rescueGoal: 16 }
    ];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function getPhaseConfig(phaseIndex) {
        const clamped = clamp(phaseIndex, 1, PHASES.length);
        return PHASES[clamped - 1];
    }

    function getPalette(phaseNumber) {
        const phase = getPhaseConfig(phaseNumber);
        return {
            sky: phase.sky,
            land: phase.land,
            landDark: "#1c3b2c",
            water: phase.water,
            waterDeep: phase.waterDeep,
            plane: "#ececec",
            planeAccent: phase.accent,
            ship: "#6b7280",
            heli: "#c43c3c",
            fuel: "#f2d24a",
            fuelBody: "#8a6a12",
            hud: phase.accent,
            text: "#f4f7fb",
            wave: "rgba(255,255,255,0.12)",
            victim: "#ff4d6d",
            enemy: "#d8dde6"
        };
    }

    function riverAt(worldY) {
        const t = worldY * 0.003;
        const margin = 40;
        const width = clamp(200 + Math.sin(t * 0.8) * 35, 160, 260);
        const room = W - margin * 2 - width;
        const wander = Math.sin(t) * 0.35 + Math.sin(t * 0.45) * 0.15;
        const left = margin + room * 0.5 + wander * room * 0.5;
        return { left, right: left + width };
    }

    function createGame(phase = 1) {
        return {
            phase,
            scroll: 0,
            speed: 72,
            fuel: MAX_FUEL,
            score: 0,
            scoreSaved: false,
            lives: 4,
            lifeSpawnTimer: randomRange(12, 20),
            rescued: 0,
            shootCooldown: 0,
            bridgeJump: 0,
            bridgeJumpCooldown: 0,
            nextBridgeY: H + 420,
            refueling: false,
            invuln: 2,
            flash: 0,
            phaseTransition: 1.1,
            phaseStarted: performance.now(),
            player: { x: W / 2 - 11, y: H - 140, w: 22, h: 28 },
            bullets: [],
            entities: [],
            lastSpawnY: 0,
            warning: "",
            warningTimer: 0,
        };
    }

    function setWarning(g, text, time = 1.2) {
        if (!g) return;
        g.warning = text;
        g.warningTimer = time;
    }

    function ensureAudio() {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;

        if (!engineAudio) {
            engineAudio = new AudioCtor();
            engineOscillator = engineAudio.createOscillator();
            engineGain = engineAudio.createGain();
            engineOscillator.type = "sawtooth";
            engineOscillator.frequency.value = 60;
            engineGain.gain.value = 0.0001;
            engineOscillator.connect(engineGain);
            engineGain.connect(engineAudio.destination);
            engineOscillator.start();
        }

        if (engineAudio.state === "suspended") {
            engineAudio.resume();
        }

        return engineAudio;
    }

    function startEngineSound() {
        ensureAudio();
        if (engineGain) {
            engineGain.gain.setTargetAtTime(0.04, engineAudio.currentTime, 0.15);
        }
    }

    function startBridgeJump() {
        if (state !== STATE.PLAY || !game || game.bridgeJumpCooldown > 0) return;

        game.bridgeJump = 1.1;
        game.bridgeJumpCooldown = 1.8;
        setWarning(game, "SALTO!", 0.8);
        beep(740, 0.09, "triangle", 0.04);
    }

    function stopEngineSound() {
        if (engineGain && engineAudio) {
            engineGain.gain.setTargetAtTime(0.0001, engineAudio.currentTime, 0.15);
        }
    }

    function updateEngineSound() {
        if (!engineOscillator || !engineGain || !engineAudio) return;

        const phaseSpeed = game ? game.speed : 72;
        engineOscillator.frequency.setTargetAtTime(58 + phaseSpeed * 0.55 + (game ? game.phase * 10 : 0), engineAudio.currentTime, 0.14);
        const fuelFactor = game ? clamp(game.fuel / 100, 0, 1) : 1;
        const targetGain = state === STATE.PLAY ? 0.016 + fuelFactor * 0.022 : 0.0001;
        engineGain.gain.setTargetAtTime(targetGain, engineAudio.currentTime, 0.1);
    }

    function beep(freq, duration, type = "square", gain = 0.05) {
        try {
            const audio = ensureAudio();
            if (!audio) return;
            const osc = audio.createOscillator();
            const vol = audio.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            vol.gain.value = gain;
            osc.connect(vol);
            vol.connect(audio.destination);
            osc.start();
            vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
            osc.stop(audio.currentTime + duration);
            setTimeout(() => {
                osc.disconnect();
                vol.disconnect();
            }, duration * 1000 + 80);
        } catch (_) {}
    }

    function rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function toScreenY(g, worldY) {
        return H - (worldY - g.scroll);
    }

    function screenToWorldY(g, screenY) {
        return g.scroll + (H - screenY);
    }

    function sceneryRandom(seed) {
        let value = seed | 0;
        value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
        value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
        value = (value ^ (value >>> 16)) >>> 0;
        return value / 4294967296;
    }

    function drawPhaseLandmark(type, x, y, scale, phase) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        if (type === "pine") {
            ctx.fillStyle = "#735f4a";
            ctx.fillRect(13, -8, 5, 12);
            ctx.fillStyle = "#315f4b";
            for (let layer = 0; layer < 3; layer += 1) {
                ctx.beginPath();
                ctx.moveTo(15.5, -38 + layer * 10);
                ctx.lineTo(3 + layer * 3, -16 + layer * 9);
                ctx.lineTo(28 - layer * 3, -16 + layer * 9);
                ctx.closePath();
                ctx.fill();
            }
        } else if (type === "waterfall") {
            ctx.fillStyle = "#83958c";
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(20, -13);
            ctx.lineTo(29, 0);
            ctx.lineTo(20, 12);
            ctx.lineTo(1, 9);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(188, 238, 228, 0.8)";
            ctx.beginPath();
            ctx.moveTo(18, -3);
            ctx.lineTo(37, 2);
            ctx.lineTo(18, 7);
            ctx.closePath();
            ctx.fill();
        } else if (type === "lighthouse") {
            ctx.fillStyle = "#f0e8d2";
            ctx.beginPath();
            ctx.moveTo(7, 0);
            ctx.lineTo(11, -30);
            ctx.lineTo(24, -30);
            ctx.lineTo(28, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#bd6e64";
            ctx.fillRect(10, -23, 18, 5);
            ctx.fillStyle = "#f6d28b";
            ctx.fillRect(13, -34, 13, 5);
            ctx.fillStyle = "rgba(255, 236, 165, 0.2)";
            ctx.beginPath();
            ctx.moveTo(19, -32);
            ctx.lineTo(-13, -44);
            ctx.lineTo(50, -44);
            ctx.closePath();
            ctx.fill();
        } else if (type === "smoke") {
            ctx.fillStyle = "#6e7772";
            ctx.fillRect(7, -8, 10, 8);
            ctx.fillRect(10, -19, 5, 12);
            for (let puff = 0; puff < 3; puff += 1) {
                ctx.fillStyle = `rgba(91, 105, 103, ${0.48 - puff * 0.1})`;
                ctx.beginPath();
                ctx.arc(12 + puff * 5, -24 - puff * 7, 7 + puff * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === "fog") {
            ctx.fillStyle = "rgba(224, 239, 237, 0.52)";
            for (let band = 0; band < 3; band += 1) {
                ctx.beginPath();
                ctx.ellipse(16 + band * 5, -5 - band * 9, 24 - band * 2, 5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === "wetland") {
            ctx.strokeStyle = "#587b62";
            ctx.lineWidth = 2;
            for (let reed = 0; reed < 5; reed += 1) {
                const reedX = reed * 6;
                ctx.beginPath();
                ctx.moveTo(reedX, 0);
                ctx.quadraticCurveTo(reedX - 3, -12, reedX + (reed % 2 ? -4 : 4), -21);
                ctx.stroke();
                ctx.fillStyle = "#9ab477";
                ctx.beginPath();
                ctx.ellipse(reedX + (reed % 2 ? -4 : 4), -21, 4, 2, -0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === "ruins") {
            ctx.fillStyle = "#777b70";
            ctx.fillRect(1, -18, 8, 18);
            ctx.fillRect(11, -11, 7, 11);
            ctx.fillRect(21, -22, 8, 22);
            ctx.fillRect(0, -21, 11, 4);
            ctx.fillRect(19, -25, 12, 4);
            ctx.fillStyle = "rgba(46, 55, 53, 0.5)";
            ctx.fillRect(4, -13, 3, 7);
            ctx.fillRect(23, -17, 3, 7);
        } else if (type === "canyon") {
            ctx.fillStyle = "#9c7963";
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -23);
            ctx.lineTo(9, -23);
            ctx.lineTo(9, -34);
            ctx.lineTo(20, -34);
            ctx.lineTo(20, -17);
            ctx.lineTo(31, -17);
            ctx.lineTo(31, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#c09a79";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(3, -18);
            ctx.lineTo(9, -18);
            ctx.moveTo(21, -12);
            ctx.lineTo(29, -12);
            ctx.stroke();
        } else if (type === "volcano") {
            ctx.fillStyle = "#4f5554";
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(8, -13);
            ctx.lineTo(13, -29);
            ctx.lineTo(19, -16);
            ctx.lineTo(26, -24);
            ctx.lineTo(37, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = phase.accent;
            ctx.beginPath();
            ctx.moveTo(11, -22);
            ctx.lineTo(13, -29);
            ctx.lineTo(19, -16);
            ctx.lineTo(15, -12);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    function setScoreStatus(message, isError = false) {
        scoreStatus.textContent = message;
        scoreStatus.classList.toggle("error", isError);
    }

    function readSavedScores() {
        const stored = window.localStorage.getItem(RANKING_STORAGE_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            throw new Error("O formato do ranking salvo é inválido.");
        }

        return parsed.filter((entry) =>
            entry
            && typeof entry.name === "string"
            && Number.isFinite(entry.score)
            && entry.score >= 0
        );
    }

    function renderRanking(list = rankingList) {
        list.replaceChildren();
        if (savedScores.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty";
            empty.textContent = "Nenhuma pontuação salva ainda.";
            list.appendChild(empty);
            return;
        }

        savedScores.slice(0, 10).forEach((entry, index) => {
            const item = document.createElement("li");
            const player = document.createElement("strong");
            const score = document.createElement("span");
            player.textContent = `${index + 1}. ${entry.name}`;
            score.textContent = Math.floor(entry.score).toLocaleString("pt-BR");
            item.append(player, score);
            list.appendChild(item);
        });
    }

    function loadRanking() {
        try {
            savedScores = readSavedScores()
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
            rankingAvailable = true;
            renderRanking();
        } catch (error) {
            rankingAvailable = false;
            setScoreStatus("Não foi possível acessar o ranking salvo neste navegador.", true);
            console.error("Falha ao carregar o ranking:", error);
        }
    }

    function saveCurrentScore() {
        if (!game || state !== STATE.OVER || game.scoreSaved || !rankingAvailable) return;

        const name = playerNameInput.value.trim() || "Jogador";
        playerNameInput.value = name;
        const score = Math.floor(game.score);
        const updatedScores = [...savedScores, { name, score, savedAt: Date.now() }]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        try {
            window.localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(updatedScores));
            savedScores = updatedScores;
            game.scoreSaved = true;
            setScoreStatus(`Pontuação de ${name} salva: ${score.toLocaleString("pt-BR")} pontos.`);
            renderRanking();
            return true;
        } catch (error) {
            setScoreStatus("Não foi possível salvar. Verifique o armazenamento do navegador.", true);
            console.error("Falha ao salvar a pontuação:", error);
            return false;
        }
    }

    function showResults() {
        finalScore.textContent = `Jogador: ${playerNameInput.value.trim() || "Jogador"} · Pontuação: ${Math.floor(game.score).toLocaleString("pt-BR")}`;
        resultsStatus.textContent = game.scoreSaved
            ? "Sua pontuação foi salva neste navegador."
            : "A pontuação não pôde ser salva, mas este é o ranking disponível neste navegador.";
        resultsStatus.classList.toggle("error", !game.scoreSaved);
        renderRanking(endRankingList);
        if (!resultsModal.open) resultsModal.showModal();
    }

    function loseLife(g, reason = "inimigo") {
        if (state !== STATE.PLAY || g.invuln > 0) return;

        g.lives -= 1;
        g.flash = 0.25;
        g.invuln = 2.4;
        beep(90, 0.4, "triangle", 0.07);

        if (g.lives <= 0) {
            state = STATE.OVER;
            stopEngineSound();
            saveCurrentScore();
            if (!game.scoreSaved && rankingAvailable) {
                setScoreStatus("Não foi possível salvar a pontuação. Verifique o armazenamento do navegador.", true);
            }
            showResults();
            return;
        }

        g.player.x = W / 2 - 11;
        g.player.y = H - 140;
        g.fuel = clamp(g.fuel + 30, 0, 100);
        g.bullets = [];
        g.entities = g.entities.filter((e) => toScreenY(g, e.y) > 180);

        if (reason === "inimigo") {
            beep(180, 0.18, "sawtooth", 0.04);
        }
    }

    function spawnShipWave(g) {
        const config = getPhaseConfig(g.phase);
        let maxY = g.scroll + H + 30;
        g.entities.forEach((e) => {
            if (e.y > maxY) maxY = e.y;
        });

        const baseGap = randomRange(140, 200) - g.phase * 8;
        const waveOrigin = maxY + baseGap;
        const groupSize = g.phase >= 2 ? 1 + Math.floor(Math.random() * (g.phase >= 3 ? 2 : 1)) : 1;

        for (let i = 0; i < groupSize; i += 1) {
            const worldY = waveOrigin + i * randomRange(42, 78);
            const river = riverAt(worldY);
            const x = river.left + randomRange(20, river.right - river.left - 60);
            const kindRoll = Math.random();

            let type = "ship";
            if (kindRoll > 0.78) type = "heli";
            else if (kindRoll > 0.5) type = "jet";

            const enemy = {
                type,
                x,
                y: worldY,
                w: type === "jet" ? 26 : type === "heli" ? 30 : 42,
                h: type === "jet" ? 14 : type === "heli" ? 16 : 16,
                vx: (Math.random() > 0.5 ? 1 : -1) * (22 + Math.random() * 40 + (g.phase * 16)),
                dead: false,
                carryingVictim: type === "ship" && Math.random() < Math.min(0.82, 0.38 + g.phase * 0.06),
            };

            g.entities.push(enemy);
            if (enemy.type === "ship" && enemy.carryingVictim) {
                g.entities.push({
                    type: "victim",
                    x: enemy.x + enemy.w / 2 - 6,
                    y: enemy.y - 18,
                    w: 12,
                    h: 12,
                    dead: false,
                    carriedBy: enemy,
                });
            }
        }
    }

    function maybeSpawn(g) {
        const config = getPhaseConfig(g.phase);
        const target = Math.max(2, config.spawnLimit - 1 + Math.min(2, Math.floor(g.score / 1100)));

        while (g.entities.filter((e) => !e.dead && e.type !== "life" && e.type !== "bridge").length < target) {
            const canSpawnFuel = Math.random() < 0.12 + g.phase * 0.02;
            if (canSpawnFuel) {
                const maxY = g.entities.reduce((m, e) => Math.max(m, e.y), g.scroll + H);
                const worldY = maxY + randomRange(150, 230);
                const river = riverAt(worldY);
                const x = river.left + 20 + Math.random() * (river.right - river.left - 60);
                g.entities.push({ type: "fuel", x, y: worldY, w: 34, h: 42, dead: false });
            } else {
                spawnShipWave(g);
            }
        }
    }

    function maybeSpawnBridge(g) {
        if (g.scroll + H < g.nextBridgeY) return;

        const worldY = g.nextBridgeY;
        const river = riverAt(worldY);
        g.entities.push({
            type: "bridge",
            x: river.left - 12,
            y: worldY,
            w: river.right - river.left + 24,
            h: 26,
            health: 3,
            warned: false,
            dead: false,
        });
        g.nextBridgeY = worldY + randomRange(1100, 1500);
    }

    function maybeSpawnLife(g, dt) {
        g.lifeSpawnTimer -= dt;
        if (g.lifeSpawnTimer > 0) return;

        const lifeExists = g.entities.some((e) => !e.dead && e.type === "life");
        if (g.lives < MAX_LIVES && !lifeExists) {
            const maxY = g.entities.reduce((m, e) => Math.max(m, e.y), g.scroll + H);
            const worldY = maxY + randomRange(180, 300);
            const river = riverAt(worldY);
            const x = river.left + randomRange(20, river.right - river.left - 44);
            g.entities.push({ type: "life", x, y: worldY, w: 24, h: 24, dead: false });
            g.lifeSpawnTimer = randomRange(18, 30);
        } else {
            g.lifeSpawnTimer = randomRange(6, 12);
        }
    }

    function phaseObjectiveText(g) {
        const phaseConfig = getPhaseConfig(g.phase);
        const rescueProgress = Math.min(g.rescued, phaseConfig.rescueGoal);
        return `${rescueProgress}/${phaseConfig.rescueGoal} RESGATES`;
    }

    function phaseAdvanceCheck(g) {
        const phaseConfig = getPhaseConfig(g.phase);
        const rescueReached = g.rescued >= phaseConfig.rescueGoal;
        const scoreReached = g.score >= phaseConfig.targetScore;

        if ((scoreReached || rescueReached) && g.phase < PHASES.length) {
            const nextPhase = g.phase + 1;
            g.phase = nextPhase;
            g.phaseTransition = 1.8;
            g.entities = [];
            g.bullets = [];
            g.player.x = W / 2 - 11;
            g.player.y = H - 140;
            g.invuln = 2.2;
            g.fuel = clamp(g.fuel + 15, 0, 100);
            beep(440, 0.1, "triangle", 0.05);
            beep(660, 0.13, "sine", 0.04);
        }
    }

    function handlePlayerCollision(g, playerWorld) {
        const hitEnemy = g.entities.some((e) => {
            if (e.dead) return false;
            if (e.type === "ship" && e.carryingVictim) return false;
            if (e.type !== "ship" && e.type !== "heli" && e.type !== "jet") return false;
            return rectsOverlap(playerWorld, { x: e.x, y: e.y, w: e.w, h: e.h });
        });

        const victimPickup = g.entities.find((e) => {
            if (e.dead || e.type !== "victim") return false;
            const victimBox = { x: e.x - 4, y: e.y - 4, w: e.w + 8, h: e.h + 8 };
            return rectsOverlap(playerWorld, victimBox);
        });

        if (victimPickup) {
            victimPickup.dead = true;
            if (victimPickup.carriedBy) {
                victimPickup.carriedBy.carryingVictim = false;
                victimPickup.carriedBy = null;
            }
            g.score += 220;
            g.rescued += 1;
            g.invuln = Math.max(g.invuln, 1.2);
            beep(520, 0.1, "triangle", 0.04);
            beep(740, 0.09, "sine", 0.04);
            return true;
        }

        const carrierPickup = g.entities.find((e) => {
            if (e.dead || e.type !== "ship" || !e.carryingVictim) return false;
            return rectsOverlap(playerWorld, { x: e.x, y: e.y, w: e.w, h: e.h });
        });

        if (carrierPickup) {
            carrierPickup.carryingVictim = false;
            const rescued = g.entities.find((e) => e.type === "victim" && e.carriedBy === carrierPickup);
            if (rescued) {
                rescued.dead = true;
                rescued.carriedBy = null;
            }
            g.score += 220;
            g.rescued += 1;
            g.invuln = Math.max(g.invuln, 1.2);
            beep(520, 0.1, "triangle", 0.04);
            beep(740, 0.09, "sine", 0.04);
            return true;
        }

        const lifePickup = g.entities.find((e) => {
            if (e.dead || e.type !== "life") return false;
            return rectsOverlap(playerWorld, { x: e.x - 6, y: e.y - 6, w: e.w + 12, h: e.h + 12 });
        });

        if (lifePickup) {
            lifePickup.dead = true;
            g.lives = Math.min(g.lives + 1, MAX_LIVES);
            beep(660, 0.1, "sine", 0.05);
            beep(880, 0.12, "triangle", 0.04);
            return;
        }

        if (hitEnemy && g.invuln <= 0) {
            loseLife(g, "inimigo");
            return;
        }

        const fuelPickup = g.entities.find((e) => {
            if (e.dead || e.type !== "fuel") return false;
            const fuelBox = { x: e.x - 12, y: e.y - 12, w: e.w + 24, h: e.h + 24 };
            return rectsOverlap(playerWorld, fuelBox);
        });

        if (fuelPickup) {
            fuelPickup.dead = true;
            g.refueling = true;
            g.fuel = clamp(g.fuel + FUEL_PICKUP_AMOUNT, 0, MAX_FUEL);
            beep(880, 0.06, "sine", 0.04);
        }

        return false;
    }

    function update(g, dt) {
        const p = g.player;
        const move = 220 * dt;

        if (g.phaseTransition > 0) {
            g.phaseTransition = Math.max(0, g.phaseTransition - dt);
        }

        g.warningTimer = Math.max(0, (g.warningTimer || 0) - dt);
        if (g.warningTimer <= 0) g.warning = "";

        if (keys.has("ArrowLeft") || keys.has("KeyA")) p.x -= move;
        if (keys.has("ArrowRight") || keys.has("KeyD")) p.x += move;
        if (keys.has("ArrowUp") || keys.has("KeyW")) p.y -= move;
        if (keys.has("ArrowDown") || keys.has("KeyS")) p.y += move;

        p.x = clamp(p.x, 8, W - 8 - p.w);
        p.y = clamp(p.y, 78, H - 40 - p.h);

        const forward = 1 - (p.y - 78) / (H - 118 - p.h);
        g.speed = g.refueling ? 30 : 54 + forward * 26 + (getPhaseConfig(g.phase).enemySpeed - 1) * 28;
        g.scroll += g.speed * dt;

        if (!g.refueling) g.fuel -= 2.0 * dt;
        g.shootCooldown = Math.max(0, g.shootCooldown - dt);
        g.bridgeJump = Math.max(0, g.bridgeJump - dt);
        g.bridgeJumpCooldown = Math.max(0, g.bridgeJumpCooldown - dt);
        g.flash = Math.max(0, g.flash - dt);
        g.invuln = Math.max(0, g.invuln - dt);
        g.refueling = false;

        if ((keys.has("Space") || keys.has("KeyK")) && g.shootCooldown <= 0) {
            g.bullets.push({
                x: p.x + p.w / 2 - 2,
                y: screenToWorldY(g, p.y - 8),
                w: 4,
                h: 12,
                vy: 560,
            });
            g.shootCooldown = 0.18;
            beep(680, 0.05, "square", 0.03);
        }

        maybeSpawn(g);
        maybeSpawnBridge(g);
        maybeSpawnLife(g, dt);

        const playerWorld = { x: p.x, y: screenToWorldY(g, p.y), w: p.w, h: p.h };

        const activeEntities = g.entities.filter((e) => !e.dead);

        g.bullets.forEach((b) => { b.y += b.vy * dt; });
        g.bullets = g.bullets.filter((b) => toScreenY(g, b.y) > -20);

        activeEntities.forEach((e) => {
            if (e.type === "victim") {
                if (e.carriedBy && e.carriedBy.dead && !e.dead) {
                    e.dead = true;
                }
                return;
            }

            if (e.vx) {
                e.x += e.vx * dt;
                const river = riverAt(e.y);
                if (e.x < river.left + 8 || e.x + e.w > river.right - 8) {
                    e.vx *= -1;
                    e.x = clamp(e.x, river.left + 8, river.right - 8 - e.w);
                }
            }

        });

        let escapedEnemy = false;
        g.entities.forEach((e) => {
            if (e.dead) return;

            if (e.type === "bridge" && !e.warned && toScreenY(g, e.y) > p.y - 150) {
                e.warned = true;
                setWarning(g, "PONTE! PULE OU ATIRE", 2);
            }

            if (e.type === "victim" && e.carriedBy) {
                e.x = e.carriedBy.x + e.carriedBy.w / 2 - 6;
                e.y = e.carriedBy.y - 18;
            }

            g.bullets.forEach((b) => {
                if (!e.dead && e.type !== "life" && e.type !== "victim" && rectsOverlap(b, { x: e.x, y: e.y, w: e.w, h: e.h })) {
                    b.y = 99999;
                    if (e.type === "bridge") {
                        e.health -= 1;
                        if (e.health <= 0) {
                            e.dead = true;
                            g.score += 250;
                            setWarning(g, "PONTE DESTRUÍDA!", 1.1);
                        }
                    } else {
                        e.dead = true;
                    }
                    if (e.type === "fuel") {
                        g.score += 80;
                    } else if (e.type === "jet") {
                        g.score += 150;
                    } else if (e.type === "heli") {
                        g.score += 120;
                    } else if (e.type === "ship") {
                        g.score += 90;
                    }
                    g.flash = 0.08;
                    beep(e.type === "fuel" ? 180 : 320, 0.12, "sawtooth", 0.04);
                }
            });

            if (e.type === "life" && toScreenY(g, e.y) > H + 80) {
                e.dead = true;
            } else if (e.type === "bridge" && toScreenY(g, e.y) > H + 80) {
                e.dead = true;
            } else if (e.type !== "fuel" && e.type !== "victim" && toScreenY(g, e.y) > H + 80) {
                e.dead = true;
                setWarning(g, "INIMIGO ESCAPOU!", 1.2);
                if (!e.carryingVictim || e.type !== "ship") {
                    escapedEnemy = true;
                }
            }
        });

        const rescuedThisFrame = handlePlayerCollision(g, playerWorld);
        const hitBridge = g.entities.some((e) =>
            !e.dead && e.type === "bridge"
            && rectsOverlap(playerWorld, { x: e.x, y: e.y, w: e.w, h: e.h })
        );
        if (!rescuedThisFrame && g.invuln <= 0) {
            if (hitBridge && g.bridgeJump <= 0) {
                loseLife(g, "ponte");
            } else {
                const riverPlayer = riverAt(playerWorld.y + p.h * 0.5);
                if (playerWorld.x < riverPlayer.left || playerWorld.x + playerWorld.w > riverPlayer.right) {
                    loseLife(g, "rio");
                } else if (escapedEnemy) {
                    loseLife(g, "inimigo");
                }
            }
        }

        g.entities = g.entities.filter((e) => !e.dead);
        g.bullets = g.bullets.filter((b) => b.y < 99999);

        phaseAdvanceCheck(g);

        if (g.fuel <= 0 && !rescuedThisFrame) {
            g.fuel = 0;
            loseLife(g, "combustivel");
        }

        updateEngineSound();
    }

    function drawBackground(g, paletteData) {
        const phaseConfig = getPhaseConfig(g.phase);
        const sky = ctx.createLinearGradient(0, 0, W, H);
        sky.addColorStop(0, paletteData.sky);
        sky.addColorStop(1, paletteData.land);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        if (g.phase === 3) {
            ctx.fillStyle = "rgba(255, 231, 172, 0.55)";
            ctx.beginPath();
            ctx.arc(W - 58, 112, 24, 0, Math.PI * 2);
            ctx.fill();
        } else if (g.phase === 4) {
            ctx.fillStyle = "rgba(48, 57, 57, 0.16)";
            for (let cloud = 0; cloud < 5; cloud += 1) {
                const cloudX = (cloud * 117 + 36) % W;
                const cloudY = 110 + (cloud % 3) * 105;
                ctx.beginPath();
                ctx.ellipse(cloudX, cloudY, 38, 9, -0.08, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (g.phase === 5) {
            ctx.fillStyle = "rgba(237, 245, 245, 0.13)";
            for (let layer = 0; layer < 4; layer += 1) {
                const fogY = (layer * 167 + g.scroll * 0.18) % (H + 100) - 50;
                ctx.fillRect(0, fogY, W, 24);
            }
        } else if (g.phase === 7) {
            ctx.fillStyle = "rgba(117, 102, 88, 0.22)";
            for (let ridge = 0; ridge < 5; ridge += 1) {
                const x = ridge * 112 - 20;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + 48, 0);
                ctx.lineTo(x + 20, H);
                ctx.lineTo(x - 24, H);
                ctx.closePath();
                ctx.fill();
            }
        } else if (g.phase === 8) {
            ctx.fillStyle = "rgba(226, 232, 221, 0.58)";
            for (let star = 0; star < 28; star += 1) {
                const x = sceneryRandom(star + 812) * W;
                const y = sceneryRandom(star + 916) * H;
                ctx.beginPath();
                ctx.arc(x, y, 1 + sceneryRandom(star + 1030), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const scenerySpacing = 92;
        const firstSegment = Math.floor(g.scroll / scenerySpacing) - 1;
        const lastSegment = Math.ceil((g.scroll + H) / scenerySpacing) + 1;
        const sceneryTypes = phaseConfig.scenery;
        const phaseTint = g.phase >= 4 ? "#344c49" : "#426b52";

        for (let segment = firstSegment; segment <= lastSegment; segment += 1) {
            const worldY = segment * scenerySpacing + sceneryRandom(segment + 17) * scenerySpacing;
            const screenY = toScreenY(g, worldY);
            const river = riverAt(worldY);

            for (const side of[-1, 1]) {
                const seed = segment * 31 + (side < 0 ? 7 : 19);
                if (sceneryRandom(seed) > 0.86) continue;

                const type = sceneryTypes[Math.floor(sceneryRandom(seed + 1) * sceneryTypes.length)];
                const baseWidth = ["house", "farm", "canyon", "volcano", "ruins"].includes(type) ? 42 : 34;
                const bankWidth = side < 0 ? river.left : W - river.right;
                const scale = Math.min(
                    0.72 + sceneryRandom(seed + 2) * 0.52,
                    Math.max(0.58, (bankWidth - 8) / baseWidth)
                );
                const width = baseWidth * scale;
                const offset = 4 + sceneryRandom(seed + 3) * Math.max(0, bankWidth - width - 8);
                const x = side < 0 ? river.left - offset - width : river.right + offset;

                if (type === "tree" || type === "pine" || type === "palm") {
                    const trunkWidth = 5 * scale;
                    const trunkHeight = 13 * scale;
                    ctx.fillStyle = "#745d43";
                    ctx.fillRect(x + width / 2 - trunkWidth / 2, screenY - trunkHeight / 2, trunkWidth, trunkHeight);
                    if (type === "pine") {
                        ctx.fillStyle = "#315f4b";
                        for (let layer = 0; layer < 3; layer += 1) {
                            ctx.beginPath();
                            ctx.moveTo(x + width / 2, screenY - 25 * scale + layer * 9 * scale);
                            ctx.lineTo(x + width / 2 - (13 - layer * 3) * scale, screenY - 7 * scale + layer * 6 * scale);
                            ctx.lineTo(x + width / 2 + (13 - layer * 3) * scale, screenY - 7 * scale + layer * 6 * scale);
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else if (type === "palm") {
                        ctx.strokeStyle = "#856a4c";
                        ctx.lineWidth = 4 * scale;
                        ctx.beginPath();
                        ctx.moveTo(x + width / 2, screenY + 3 * scale);
                        ctx.quadraticCurveTo(x + width / 2 - 4 * scale, screenY - 8 * scale, x + width / 2 + 2 * scale, screenY - 20 * scale);
                        ctx.stroke();
                        ctx.strokeStyle = "#3c7658";
                        ctx.lineWidth = 3 * scale;
                        for (let leaf = 0; leaf < 5; leaf += 1) {
                            const angle = -Math.PI + leaf * Math.PI / 4;
                            ctx.beginPath();
                            ctx.moveTo(x + width / 2 + 2 * scale, screenY - 20 * scale);
                            ctx.quadraticCurveTo(
                                x + width / 2 + Math.cos(angle) * 9 * scale,
                                screenY - 31 * scale,
                                x + width / 2 + Math.cos(angle) * 17 * scale,
                                screenY - 22 * scale + Math.sin(angle) * 8 * scale
                            );
                            ctx.stroke();
                        }
                    } else {
                        ctx.fillStyle = phaseTint;
                        ctx.beginPath();
                        ctx.ellipse(x + width / 2, screenY - 5 * scale, 15 * scale, 12 * scale, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = sceneryRandom(seed + 4) > 0.5 ? "#648c62" : "#527b59";
                        ctx.beginPath();
                        ctx.arc(x + width / 2 - 7 * scale, screenY - 7 * scale, 8 * scale, 0, Math.PI * 2);
                        ctx.arc(x + width / 2 + 7 * scale, screenY - 6 * scale, 8 * scale, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (type === "house") {
                    const houseY = screenY - 16 * scale;
                    ctx.fillStyle = "rgba(31, 55, 46, 0.18)";
                    ctx.beginPath();
                    ctx.ellipse(x + width / 2, screenY + 4 * scale, width * 0.62, 5 * scale, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = sceneryRandom(seed + 4) > 0.5 ? "#e5d3ad" : "#d2c39f";
                    ctx.beginPath();
                    ctx.roundRect(x + 4 * scale, houseY + 8 * scale, width - 8 * scale, 20 * scale, 3 * scale);
                    ctx.fill();
                    ctx.fillStyle = "#a56e59";
                    ctx.beginPath();
                    ctx.moveTo(x, houseY + 10 * scale);
                    ctx.lineTo(x + width / 2, houseY);
                    ctx.lineTo(x + width, houseY + 10 * scale);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = "#8c6a50";
                    ctx.fillRect(x + width / 2 - 3 * scale, houseY + 17 * scale, 6 * scale, 11 * scale);
                    ctx.fillStyle = "#92c4bb";
                    ctx.fillRect(x + 8 * scale, houseY + 12 * scale, 5 * scale, 5 * scale);
                    ctx.fillRect(x + width - 13 * scale, houseY + 12 * scale, 5 * scale, 5 * scale);
                } else if (type === "farm") {
                    ctx.fillStyle = "rgba(224, 207, 148, 0.28)";
                    ctx.beginPath();
                    ctx.ellipse(x + width / 2, screenY, width / 2, 12 * scale, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = "rgba(104, 119, 73, 0.48)";
                    ctx.lineWidth = 2;
                    for (let row = -1; row <= 1; row += 1) {
                        ctx.beginPath();
                        ctx.moveTo(x + 5 * scale, screenY + row * 6 * scale);
                        ctx.lineTo(x + width - 5 * scale, screenY + row * 6 * scale);
                        ctx.stroke();
                    }
                } else if (type === "cactus") {
                    ctx.strokeStyle = "#66805c";
                    ctx.lineWidth = 5 * scale;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(x + width / 2, screenY + 6 * scale);
                    ctx.lineTo(x + width / 2, screenY - 17 * scale);
                    ctx.moveTo(x + width / 2, screenY - 4 * scale);
                    ctx.lineTo(x + width / 2 - 8 * scale, screenY - 4 * scale);
                    ctx.lineTo(x + width / 2 - 8 * scale, screenY - 12 * scale);
                    ctx.moveTo(x + width / 2, screenY + 1 * scale);
                    ctx.lineTo(x + width / 2 + 8 * scale, screenY + 1 * scale);
                    ctx.lineTo(x + width / 2 + 8 * scale, screenY - 8 * scale);
                    ctx.stroke();
                    ctx.lineCap = "butt";
                } else if (type === "canyon" || type === "volcano" || type === "ruins" || type === "tower") {
                    const landmarkType = type === "tower" ? "lighthouse" : type;
                    drawPhaseLandmark(landmarkType, x, screenY + 4 * scale, scale, phaseConfig);
                } else {
                    ctx.fillStyle = "#82928a";
                    ctx.beginPath();
                    ctx.ellipse(x + width * 0.28, screenY + 2 * scale, 8 * scale, 5 * scale, -0.2, 0, Math.PI * 2);
                    ctx.ellipse(x + width * 0.58, screenY - 1 * scale, 10 * scale, 7 * scale, 0.1, 0, Math.PI * 2);
                    ctx.ellipse(x + width * 0.83, screenY + 3 * scale, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                if (sceneryRandom(seed + 9) > 0.88) {
                    const landmarkX = side < 0 ? x - 18 * scale : x + width - 2 * scale;
                    drawPhaseLandmark(phaseConfig.landmark, landmarkX, screenY + 5 * scale, scale * 0.8, phaseConfig);
                }
            }
        }

        ctx.fillStyle = "rgba(18, 55, 46, 0.12)";
        ctx.beginPath();
        ctx.moveTo(riverAt(screenToWorldY(g, 0)).left, 0);
        for (let y = 0; y <= H; y += 8) {
            ctx.lineTo(riverAt(screenToWorldY(g, y)).left, y);
        }
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(riverAt(screenToWorldY(g, 0)).left, 0);
        for (let y = 0; y <= H; y += 8) {
            ctx.lineTo(riverAt(screenToWorldY(g, y)).left, y);
        }
        for (let y = H; y >= 0; y -= 8) {
            ctx.lineTo(riverAt(screenToWorldY(g, y)).right, y);
        }
        ctx.closePath();
        const water = ctx.createLinearGradient(0, 0, W, 0);
        water.addColorStop(0, paletteData.waterDeep);
        water.addColorStop(0.5, paletteData.water);
        water.addColorStop(1, paletteData.waterDeep);
        ctx.fillStyle = water;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.clip();
        ctx.strokeStyle = "rgba(224, 255, 248, 0.16)";
        ctx.lineWidth = 1;
        for (let y = -((g.scroll * 0.32) % 56); y < H; y += 56) {
            const worldY = screenToWorldY(g, y);
            const river = riverAt(worldY);
            ctx.beginPath();
            ctx.moveTo(river.left + 28, y);
            ctx.quadraticCurveTo((river.left + river.right) / 2, y + 8, river.right - 28, y);
            ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = "rgba(226, 255, 244, 0.24)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let y = 0; y <= H; y += 8) {
            const river = riverAt(screenToWorldY(g, y));
            ctx.lineTo(river.left, y);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let y = 0; y <= H; y += 8) {
            const river = riverAt(screenToWorldY(g, y));
            ctx.lineTo(river.right, y);
        }
        ctx.stroke();
    }

    function drawPlane(p, jumping = false) {
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.scale(jumping ? 1.16 : 1, jumping ? 1.16 : 1);
        ctx.shadowColor = jumping ? "rgba(165, 236, 213, 0.9)" : "rgba(12, 35, 42, 0.35)";
        ctx.shadowBlur = jumping ? 16 : 9;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = "#f4fbfa";
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.quadraticCurveTo(3, -13, 4, -5);
        ctx.lineTo(13, 2);
        ctx.quadraticCurveTo(14, 5, 11, 6);
        ctx.lineTo(4, 4);
        ctx.lineTo(3, 11);
        ctx.lineTo(7, 14);
        ctx.lineTo(7, 16);
        ctx.lineTo(0, 14);
        ctx.lineTo(-7, 16);
        ctx.lineTo(-7, 14);
        ctx.lineTo(-3, 11);
        ctx.lineTo(-4, 4);
        ctx.lineTo(-11, 6);
        ctx.quadraticCurveTo(-14, 5, -13, 2);
        ctx.lineTo(-4, -5);
        ctx.quadraticCurveTo(-3, -13, 0, -15);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#45a997";
        ctx.beginPath();
        ctx.ellipse(0, -5, 2.2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawEntity(e, screenY, paletteData) {
        if (e.type === "bridge") {
            ctx.fillStyle = "rgba(10, 25, 30, 0.32)";
            ctx.fillRect(e.x - 3, screenY + 5, e.w + 6, e.h + 4);
            ctx.fillStyle = "#594b3d";
            ctx.fillRect(e.x, screenY + 3, e.w, e.h - 3);
            ctx.fillStyle = "#b68b5c";
            ctx.fillRect(e.x, screenY + 7, e.w, 4);
            ctx.fillStyle = "#73543b";
            for (let plank = 0; plank < e.w; plank += 12) {
                ctx.fillRect(e.x + plank, screenY + 12, 2, 10);
            }
            ctx.fillStyle = "#ded0ad";
            ctx.fillRect(e.x, screenY + 2, e.w, 3);
            ctx.fillRect(e.x, screenY + e.h - 3, e.w, 3);

            const supportCount = Math.max(2, Math.floor(e.w / 65));
            ctx.fillStyle = "#76634a";
            for (let support = 0; support <= supportCount; support += 1) {
                const supportX = e.x + e.w * support / supportCount;
                ctx.fillRect(supportX - 2, screenY - 5, 4, e.h + 10);
            }

            if (e.health < 3) {
                ctx.strokeStyle = "#e7a36f";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(e.x + e.w * 0.35, screenY + 7);
                ctx.lineTo(e.x + e.w * 0.39, screenY + 13);
                ctx.lineTo(e.x + e.w * 0.36, screenY + 19);
                if (e.health === 1) {
                    ctx.moveTo(e.x + e.w * 0.67, screenY + 8);
                    ctx.lineTo(e.x + e.w * 0.64, screenY + 14);
                    ctx.lineTo(e.x + e.w * 0.69, screenY + 20);
                }
                ctx.stroke();
            }
        } else if (e.type === "ship") {
            ctx.fillStyle = "rgba(8, 29, 40, 0.25)";
            ctx.beginPath();
            ctx.ellipse(e.x + e.w / 2, screenY + e.h / 2 + 3, e.w * 0.52, e.h * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#e9f1ef";
            ctx.beginPath();
            ctx.moveTo(e.x + 3, screenY + 5);
            ctx.quadraticCurveTo(e.x + e.w / 2, screenY + 2, e.x + e.w - 3, screenY + 5);
            ctx.lineTo(e.x + e.w - 8, screenY + e.h - 2);
            ctx.quadraticCurveTo(e.x + e.w / 2, screenY + e.h + 2, e.x + 8, screenY + e.h - 2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#718a8b";
            ctx.beginPath();
            ctx.roundRect(e.x + e.w / 2 - 8, screenY + 1, 16, 8, 3);
            ctx.fill();
            ctx.fillStyle = "#45a997";
            ctx.fillRect(e.x + e.w / 2 - 5, screenY + 3, 4, 3);
            ctx.fillRect(e.x + e.w / 2 + 1, screenY + 3, 4, 3);

            if (e.carryingVictim) {
                ctx.fillStyle = "#19c58d";
                ctx.beginPath();
                ctx.arc(e.x + e.w / 2, screenY - 3, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (e.type === "heli") {
            ctx.strokeStyle = "#6d3545";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(e.x + e.w / 2, screenY + 2);
            ctx.lineTo(e.x + e.w / 2, screenY + 5);
            ctx.moveTo(e.x + 4, screenY + 1);
            ctx.lineTo(e.x + e.w - 4, screenY + 1);
            ctx.stroke();
            ctx.fillStyle = "#d76f72";
            ctx.beginPath();
            ctx.roundRect(e.x + 6, screenY + 5, e.w - 12, 9, 5);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(e.x + 6, screenY + 9, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#596c71";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(e.x + 10, screenY + 15);
            ctx.lineTo(e.x + 20, screenY + 15);
            ctx.moveTo(e.x + 15, screenY + 14);
            ctx.lineTo(e.x + 15, screenY + 18);
            ctx.stroke();
        } else if (e.type === "jet") {
            ctx.fillStyle = "#eff5f4";
            ctx.beginPath();
            ctx.moveTo(e.x + e.w / 2, screenY + e.h);
            ctx.lineTo(e.x + e.w / 2 - 4, screenY + 7);
            ctx.lineTo(e.x + 1, screenY + 11);
            ctx.lineTo(e.x, screenY + 8);
            ctx.lineTo(e.x + e.w / 2 - 2, screenY + 5);
            ctx.lineTo(e.x + e.w / 2, screenY);
            ctx.lineTo(e.x + e.w / 2 + 2, screenY + 5);
            ctx.lineTo(e.x + e.w, screenY + 8);
            ctx.lineTo(e.x + e.w - 1, screenY + 11);
            ctx.lineTo(e.x + e.w / 2 + 4, screenY + 7);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#d97872";
            ctx.fillRect(e.x + e.w / 2 - 1, screenY + 10, 2, 3);
        } else if (e.type === "fuel") {
            ctx.fillStyle = "rgba(12, 34, 34, 0.22)";
            ctx.beginPath();
            ctx.ellipse(e.x + e.w / 2, screenY + e.h + 3, e.w * 0.62, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f2fbf5";
            ctx.beginPath();
            ctx.roundRect(e.x + 2, screenY + 4, e.w - 4, e.h - 6, 8);
            ctx.fill();
            ctx.fillStyle = "#3ea987";
            ctx.beginPath();
            ctx.roundRect(e.x + 6, screenY + 9, e.w - 12, 7, 3);
            ctx.fill();
            ctx.fillStyle = "#285b50";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("FUEL", e.x + e.w / 2, screenY + 31);
            ctx.textAlign = "left";
        } else if (e.type === "victim") {
            ctx.fillStyle = "rgba(7, 41, 36, 0.28)";
            ctx.beginPath();
            ctx.ellipse(e.x + e.w / 2, screenY + 19, 8, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff7e8";
            ctx.beginPath();
            ctx.arc(e.x + e.w / 2, screenY + 5, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#22ba88";
            ctx.beginPath();
            ctx.roundRect(e.x + 3, screenY + 11, 6, 9, 3);
            ctx.fill();
            ctx.strokeStyle = "#22ba88";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(e.x + 4, screenY + 19);
            ctx.lineTo(e.x + 2, screenY + 23);
            ctx.moveTo(e.x + 8, screenY + 19);
            ctx.lineTo(e.x + 10, screenY + 23);
            ctx.stroke();
        } else if (e.type === "life") {
            ctx.save();
            ctx.translate(e.x + e.w / 2, screenY + e.h / 2);
            ctx.shadowColor = "rgba(14, 47, 46, 0.28)";
            ctx.shadowBlur = 9;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = "#f26d79";
            ctx.beginPath();
            ctx.moveTo(0, 9);
            ctx.bezierCurveTo(-15, 1, -11, -10, -4, -9);
            ctx.bezierCurveTo(-1, -9, 0, -6, 0, -4);
            ctx.bezierCurveTo(0, -6, 1, -9, 4, -9);
            ctx.bezierCurveTo(11, -10, 15, 1, 0, 9);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawHud(g) {
        ctx.fillStyle = "rgba(10, 29, 35, 0.92)";
        ctx.fillRect(0, 0, W, 68);
        ctx.fillStyle = "#edf7f4";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(String(Math.floor(g.score)).padStart(6, "0"), 14, 29);
        ctx.fillStyle = "rgba(237, 247, 244, 0.58)";
        ctx.font = "10px sans-serif";
        ctx.fillText("PONTOS", 14, 14);
        ctx.fillStyle = "#edf7f4";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`FASE ${g.phase}`, 184, 25);
        ctx.font = "12px sans-serif";
        ctx.fillText(`♥ ${g.lives}`, 293, 25);
        ctx.fillStyle = "#8ce1c7";
        ctx.fillText(`◎ ${g.rescued}`, 378, 25);

        ctx.fillStyle = "rgba(237, 247, 244, 0.14)";
        ctx.beginPath();
        ctx.roundRect(14, 43, 215, 7, 4);
        ctx.fill();
        const fuelColor = g.fuel < 22 ? "#f27474" : g.fuel < 45 ? "#e9c879" : "#73d9b4";
        ctx.fillStyle = fuelColor;
        ctx.beginPath();
        ctx.roundRect(14, 43, 215 * (g.fuel / 100), 7, 4);
        ctx.fill();
        ctx.fillStyle = "rgba(237, 247, 244, 0.76)";
        ctx.font = "10px sans-serif";
        ctx.fillText(g.refueling ? "REABASTECENDO" : "COMBUSTÍVEL", 239, 50);
        const phaseConfig = getPhaseConfig(g.phase);
        ctx.fillStyle = "rgba(237, 247, 244, 0.72)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${phaseObjectiveText(g)}  ·  META ${phaseConfig.targetScore}`, W - 14, 50);
        ctx.textAlign = "left";
    }

    function drawOverlay(title, subtitle) {
        ctx.fillStyle = "rgba(4, 18, 24, 0.48)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(12, 34, 41, 0.94)";
        ctx.beginPath();
        ctx.roundRect(42, H / 2 - 67, W - 84, 134, 18);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "#a5ecd5";
        ctx.font = "bold 27px sans-serif";
        ctx.fillText(title, W / 2, H / 2 - 18);
        ctx.fillStyle = "rgba(237, 247, 244, 0.8)";
        ctx.font = "14px sans-serif";
        ctx.fillText(subtitle, W / 2, H / 2 + 17);
        ctx.textAlign = "left";
    }

    function drawWarning(g) {
        if (!g || !g.warning || g.warningTimer <= 0) return;

        ctx.save();
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(122, 42, 51, 0.94)";
        ctx.beginPath();
        ctx.roundRect(W / 2 - 112, 80, 224, 30, 15);
        ctx.fill();
        ctx.fillStyle = "#fff1ed";
        ctx.fillText(g.warning, W / 2, 99);
        ctx.restore();
    }

    function startGame() {
        game = createGame();
        state = STATE.PLAY;
        playerNameInput.blur();
        setScoreStatus("Pontuação será salva automaticamente ao fim da partida.");
        startEngineSound();
        beep(520, 0.08, "square", 0.04);
    }

    function toggleGameState() {
        if (state === STATE.MENU || state === STATE.OVER) {
            showStartModal();
        } else if (state === STATE.PLAY) {
            state = STATE.PAUSE;
            stopEngineSound();
            beep(440, 0.05, "sine", 0.03);
        } else if (state === STATE.PAUSE) {
            state = STATE.PLAY;
            startEngineSound();
            beep(550, 0.05, "sine", 0.03);
        }
    }

    function showStartModal() {
        if (resultsModal.open) resultsModal.close();
        if (!startModal.open) startModal.showModal();
    }

    function openHelpModal() {
        helpOpenedDuringPlay = state === STATE.PLAY;
        if (helpOpenedDuringPlay) {
            state = STATE.PAUSE;
            stopEngineSound();
        }
        if (!helpModal.open) helpModal.showModal();
    }

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            } else {
                fullscreenStatus.textContent = "Tela cheia não é compatível com este navegador.";
            }
        } catch (error) {
            fullscreenStatus.textContent = "Não foi possível ativar a tela cheia neste navegador.";
            console.error("Falha ao alternar tela cheia:", error);
        }
    }

    function updateFullscreenButtons() {
        const isFullscreen = Boolean(document.fullscreenElement);
        fullscreenStatus.textContent = "";
        fullscreenButtons.forEach((button) => {
            button.textContent = isFullscreen ? "⛶ Sair da tela cheia" : "⛶ Tela cheia";
            button.setAttribute("aria-label", isFullscreen ? "Sair da tela cheia" : "Ativar tela cheia");
        });
    }

    function syncGameActionButton() {
        if (state === STATE.MENU) {
            gameActionButton.textContent = "INICIAR";
        } else if (state === STATE.OVER) {
            gameActionButton.textContent = "JOGAR";
        } else if (state === STATE.PAUSE) {
            gameActionButton.textContent = "CONTINUAR";
        } else {
            gameActionButton.textContent = "PAUSAR";
        }
    }

    function render(g) {
        syncGameActionButton();
        if (!g) {
            g = createGame();
        }

        const paletteData = getPalette(g.phase);
        drawBackground(g, paletteData);

        g.entities.forEach((e) => {
            const sy = toScreenY(g, e.y);
            if (sy > -60 && sy < H + 60) drawEntity(e, sy, paletteData);
        });

        g.bullets.forEach((b) => {
            ctx.fillStyle = "#fff6a8";
            ctx.fillRect(b.x, toScreenY(g, b.y), b.w, b.h);
        });

        drawPlane(g.player, g.bridgeJump > 0);
        drawWarning(g);

        if (g.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${g.flash * 3})`;
            ctx.fillRect(0, 0, W, H);
        }

        drawHud(g);

        if (state === STATE.MENU) {
            drawOverlay("RiverGrip 2D", "ENTER para decolar");
        } else if (state === STATE.OVER) {
            drawOverlay("FIM DE JOGO", `Pontos ${Math.floor(g.score)} · ENTER para tentar de novo`);
        } else if (state === STATE.PAUSE) {
            drawOverlay("JOGO PAUSADO", "P ou ESC para continuar");
        } else if (g.phaseTransition > 0) {
            const phaseConfig = getPhaseConfig(g.phase);
            drawOverlay(phaseConfig.name, `${phaseConfig.subtitle} · ${phaseObjectiveText(g)}`);
        }
    }

    function loop(ts) {
        const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
        lastTime = ts;

        if (state === STATE.PLAY && game) {
            update(game, dt);
        }

        render(game);
        requestAnimationFrame(loop);
    }

    window.addEventListener("keydown", (event) => {
        if (startModal.open || helpModal.open || resultsModal.open) return;
        keys.add(event.code);

        if (event.code === "KeyP" || event.code === "Escape") {
            toggleGameState();
            event.preventDefault();
            return;
        }

        if ((event.code === "KeyJ" || event.code === "ShiftLeft" || event.code === "ShiftRight") && !event.repeat) {
            startBridgeJump();
            event.preventDefault();
        }

        if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();

        if (event.code === "Enter") {
            if (state !== STATE.PLAY && state !== STATE.PAUSE) showStartModal();
        }
    });

    window.addEventListener("keyup", (event) => {
        keys.delete(event.code);
    });

    function releaseAllControls() {
        keys.clear();
    }

    touchControlButtons.forEach((button) => {
        const key = button.dataset.key;

        button.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            keys.add(key);
            button.classList.add("pressed");
            button.setPointerCapture(event.pointerId);
        });

        const releaseButton = () => {
            keys.delete(key);
            button.classList.remove("pressed");
        };
        button.addEventListener("pointerup", releaseButton);
        button.addEventListener("pointercancel", releaseButton);
        button.addEventListener("lostpointercapture", releaseButton);
    });

    startForm.addEventListener("submit", (event) => {
        event.preventDefault();
        playerNameInput.value = playerNameInput.value.trim() || "Jogador";
        startModal.close();
        startGame();
    });

    document.querySelectorAll("[data-action='state']").forEach((button) => {
        button.addEventListener("click", toggleGameState);
    });
    jumpButton.addEventListener("click", startBridgeJump);
    document.querySelectorAll("[data-action='help']").forEach((button) => {
        button.addEventListener("click", openHelpModal);
    });
    document.querySelector("[data-action='close-help']").addEventListener("click", () => helpModal.close());
    helpModal.addEventListener("close", () => {
        if (helpOpenedDuringPlay && state === STATE.PAUSE) {
            state = STATE.PLAY;
            startEngineSound();
        }
        helpOpenedDuringPlay = false;
    });
    document.querySelector("[data-action='replay']").addEventListener("click", showStartModal);
    document.querySelector("[data-action='close-results']").addEventListener("click", () => resultsModal.close());
    fullscreenButtons.forEach((button) => {
        button.addEventListener("click", toggleFullscreen);
    });
    document.addEventListener("fullscreenchange", updateFullscreenButtons);
    window.addEventListener("blur", releaseAllControls);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) releaseAllControls();
    });

    loadRanking();
    startModal.showModal();
    updateFullscreenButtons();
    requestAnimationFrame(loop);
})();
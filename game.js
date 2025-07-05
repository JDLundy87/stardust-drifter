const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

let canvasWidth, canvasHeight;

let player, planets, stars, score, isGameOver, currentLevel, gamePausedForTransition, gameStarted;

// Game settings
const PLAYER_SPEED = 4;
const PLANET_MIN_RADIUS = 20;
const PLANET_MAX_RADIUS = 50;
const GRAVITY = 0.1;

const LEVEL_TRANSITION_DELAY = 2000; // 2 seconds
const BASE_PLANET_COUNT = 5;
const PLANET_COUNT_PER_LEVEL = 2;
const BASE_SCORE_THRESHOLD = 1000;
const SCORE_THRESHOLD_MULTIPLIER = 1.5;

let images;

function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

function init() {
    score = 0;
    currentLevel = 1;
    isGameOver = false;
    gamePausedForTransition = true; // Game starts paused for transition/start screen
    gameStarted = false; // Game not actively playing yet
    scoreEl.textContent = `Score: ${score}`;
    gameOverScreen.style.display = 'none';

    player = {
        x: canvasWidth / 2,
        y: canvasHeight / 3,
        dx: 0,
        dy: 0,
        radius: 20,
        isMoving: false
    };

    planets = [];
    stars = [];

    // Generate stars (static for now)
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            radius: Math.random() * 2 + 1
        });
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop(); // Start the game loop, which will draw the start screen
}

function startLevel() {
    gamePausedForTransition = true;
    player.x = canvasWidth / 2;
    player.y = canvasHeight / 3;
    player.dx = 0;
    player.dy = 0;
    player.isMoving = false; // Ensure player is not moving at the start of a level

    generatePlanetsForLevel();

    setTimeout(() => {
        gamePausedForTransition = false;
    }, LEVEL_TRANSITION_DELAY);
}

function generatePlanetsForLevel() {
    planets = [];
    // Create the first planet for the player to orbit
    planets.push({
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        radius: 40,
        type: Math.floor(Math.random() * images.planets.length)
    });

    const numPlanets = BASE_PLANET_COUNT + (currentLevel - 1) * PLANET_COUNT_PER_LEVEL;
    for (let i = 0; i < numPlanets; i++) {
        planets.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            radius: Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS,
            type: Math.floor(Math.random() * images.planets.length)
        });
    }
}

function drawLevelScreen() {
    ctx.drawImage(images.background, 0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'white';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${currentLevel}`, canvasWidth / 2, canvasHeight / 2 - 30);
    ctx.font = '20px Arial';
    ctx.fillText(`Cumulative Score: ${score}`, canvasWidth / 2, canvasHeight / 2 + 20);
    ctx.fillText('Press any key to start', canvasWidth / 2, canvasHeight / 2 + 60);
}

let isDragging = false;
let dragStartX, dragStartY;

function handleMouseDown(e) {
    if (isGameOver) return;

    if (!gameStarted && !isGameOver) {
        gameStarted = true;
        gamePausedForTransition = false; // Unpause the game
        generatePlanetsForLevel(); // Generate the first level
        return; // Consume the event, don't start dragging yet
    }

    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartX = clientX;
    dragStartY = clientY;
}

function handleMouseMove(e) {
    if (!isDragging || isGameOver) return;
    // No need to update dragEndX/Y here, as it's only used on mouseUp/touchEnd
}

function handleMouseUp(e) {
    if (!isDragging || isGameOver) return;
    isDragging = false;
    player.isMoving = true;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const dragEndX = clientX;
    const dragEndY = clientY;

    const angle = Math.atan2(dragEndY - dragStartY, dragEndX - dragStartX);
    const power = Math.min(Math.hypot(dragEndX - dragStartX, dragEndY - dragStartY) / 20, 10);

    player.dx = Math.cos(angle) * power;
    player.dy = Math.sin(angle) * power;
}

function update() {
    if (isGameOver || gamePausedForTransition) return;

    if (player.isMoving) {
        let totalGravityX = 0;
        let totalGravityY = 0;

        planets.forEach(p => {
            const dx = p.x - player.x;
            const dy = p.y - player.y;
            const distSq = dx * dx + dy * dy;
            const force = GRAVITY / distSq;

            totalGravityX += dx * force;
            totalGravityY += dy * force;
        });

        player.dx += totalGravityX;
        player.dy += totalGravityY;

        player.x += player.dx;
        player.y += player.dy;

        score++;
        scoreEl.textContent = `Score: ${score}`;

        // Check for level completion
        const requiredScore = BASE_SCORE_THRESHOLD * Math.pow(SCORE_THRESHOLD_MULTIPLIER, currentLevel - 1);
        if (score >= requiredScore) {
            currentLevel++;
            startLevel(); // Call startLevel to handle the transition
        }
    }

    // Collision detection
    planets.forEach(p => {
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist < p.radius + player.radius) {
            gameOver();
        }
    });

    // Out of bounds
    if (player.x < 0 || player.x > canvasWidth || player.y < 0 || player.y > canvasHeight) {
        gameOver();
    }
}

function draw() {
    ctx.drawImage(images.background, 0, 0, canvasWidth, canvasHeight);

    // Draw stars
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw planets
    planets.forEach(p => {
        const planetImage = images.planets[p.type];
        if (planetImage) {
            ctx.drawImage(planetImage, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
        }
    });

    // Draw player
    ctx.drawImage(images.player, player.x - player.radius, player.y - player.radius, player.radius * 2, player.radius * 2);

    // Draw trajectory line when dragging
    if (isDragging) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(dragStartX, dragStartY);
        ctx.stroke();
    }
}

let animationFrameId;
function gameLoop() {
    if (!gameStarted) {
        drawLevelScreen(); // Draw the start screen
    } else if (gamePausedForTransition) {
        drawLevelScreen(); // Draw level transition screen
    } else {
        update();
        draw();
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationFrameId);
    finalScoreEl.textContent = score;
    gameOverScreen.style.display = 'flex';
}

// Event Listeners
window.addEventListener('resize', () => {
    resizeCanvas();
    // We might need to re-init the game on resize for a better experience
    init(); 
});
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
restartButton.addEventListener('click', init);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    handleMouseDown(e);
});
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
    handleMouseMove(e);
});
canvas.addEventListener('touchend', handleMouseUp);

window.addEventListener('keydown', (e) => {
    if (!gameStarted && !isGameOver) {
        gameStarted = true;
        gamePausedForTransition = false; // Unpause the game
        generatePlanetsForLevel(); // Generate the first level
    } else if (gamePausedForTransition && !isGameOver) {
        // Continue after level transition
        gamePausedForTransition = false;
    }
});

// Initial setup
resizeCanvas();
loadImages().then(loadedImages => {
    images = loadedImages;
    init();
});
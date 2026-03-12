const DROP_SPAWN_INTERVAL = 850;
const BUCKET_SPEED = 12;

const DROP_TIERS = [
  { size: 34, value: 1 },
  { size: 44, value: 5 },
  { size: 56, value: 10 },
  { size: 70, value: 20 },
];

let gameRunning = false;
let gameActive = false;
let dropMaker;
let timerInterval;
let flashTimeout;
let gameEndTime = 0;
let timeLeft = 30;
let currentScore = 0;
let bucketX = 0;
let bucketVelocity = 0;
let pointerTargetX = null;
let lastFrameTime = performance.now();

const keys = {
  left: false,
  right: false,
};

const bucket = document.getElementById("bucket");
const gameContainer = document.getElementById("game-container");
const scoreDisplay = document.getElementById("score");
const timeDisplay = document.getElementById("time");
const timerPanel = timeDisplay.closest(".timer");
const globalWarningTimer = document.getElementById("global-warning-timer");
const durationSelect = document.getElementById("duration-select");
const startBtn = document.getElementById("start-btn");
const gameOverModal = document.getElementById("game-over-modal");
const finalScoreDisplay = document.getElementById("final-score");
const playAgainBtn = document.getElementById("play-again-btn");

function getSelectedDuration() {
  return Number(durationSelect.value);
}

startBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", resetGame);
durationSelect.addEventListener("change", () => {
  if (!gameRunning) {
    timeLeft = getSelectedDuration();
    timeDisplay.textContent = String(timeLeft);
  }
});
document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);
gameContainer.addEventListener("pointerdown", handlePointerMove);
gameContainer.addEventListener("pointermove", handlePointerMove);
gameContainer.addEventListener("pointerup", clearPointerTarget);
gameContainer.addEventListener("pointercancel", clearPointerTarget);
window.addEventListener("resize", handleResize);

function startGame() {
  if (gameRunning) {
    return;
  }

  durationSelect.disabled = true;
  resetBoard();
  gameRunning = true;
  gameActive = true;
  setStartButtonState(true);
  createDrop();
  dropMaker = setInterval(createDrop, DROP_SPAWN_INTERVAL);
  timerInterval = setInterval(updateTimer, 1000);
}

function resetGame() {
  stopGame();
  startGame();
}

function stopGame() {
  gameRunning = false;
  gameActive = false;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  dropMaker = undefined;
  timerInterval = undefined;
  keys.left = false;
  keys.right = false;
  bucketVelocity = 0;
  pointerTargetX = null;
}

function resetBoard() {
  clearDrops();
  clearFeedback();
  clearDangerFlash();
  currentScore = 0;
  timeLeft = getSelectedDuration();
  gameOverModal.classList.add("hidden");
  updateHud();
  updateLowTimeWarning();
  centerBucket();
}

function endGame() {
  finalScoreDisplay.textContent = currentScore;
  stopGame();
  clearDrops();
  updateLowTimeWarning();
  durationSelect.disabled = false;
  setStartButtonState(false);
  gameOverModal.classList.remove("hidden");
}

function updateTimer() {
  timeLeft -= 1;
  timeDisplay.textContent = String(Math.max(0, timeLeft));
  updateLowTimeWarning();

  if (timeLeft <= 0) {
    endGame();
  }
}

function createDrop() {
  if (!gameActive) {
    return;
  }

  const isBad = Math.random() < 0.5075;
  const tier = DROP_TIERS[Math.floor(Math.random() * DROP_TIERS.length)];
  const value = isBad ? tier.value * 2 : tier.value;
  const drop = document.createElement("div");
  const gameWidth = gameContainer.clientWidth;
  const xPosition = Math.random() * Math.max(1, gameWidth - tier.size);
  const fallDuration = Math.random() * 1.3 + 2.7;
  const fallDistance = gameContainer.clientHeight + tier.size + 30;

  drop.className = `water-drop ${isBad ? "bad-drop" : "good-drop"}`;
  drop.textContent = "💧";
  drop.style.width = `${tier.size}px`;
  drop.style.height = `${tier.size}px`;
  drop.style.fontSize = `${tier.size}px`;
  drop.style.left = `${xPosition}px`;
  drop.style.animationDuration = `${fallDuration}s`;
  drop.style.setProperty("--fall-distance", `${fallDistance}px`);
  drop.dataset.isBad = String(isBad);
  drop.dataset.value = String(value);
  drop.setAttribute("role", "img");
  drop.setAttribute("aria-label", isBad ? "Polluted water drop" : "Clean water drop");

  gameContainer.appendChild(drop);

  drop.addEventListener("animationend", () => {
    if (drop.parentElement) {
      drop.remove();
    }
  });
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a") {
    keys.left = true;
    event.preventDefault();
  }

  if (key === "arrowright" || key === "d") {
    keys.right = true;
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a") {
    keys.left = false;
  }

  if (key === "arrowright" || key === "d") {
    keys.right = false;
  }
}

function handlePointerMove(event) {
  if (!gameActive) {
    return;
  }

  if (event.type === "pointermove" && event.pointerType !== "touch" && event.buttons !== 1) {
    return;
  }

  const containerRect = gameContainer.getBoundingClientRect();
  const bucketWidth = bucket.offsetWidth;
  const relativeX = event.clientX - containerRect.left;
  const maxX = gameContainer.clientWidth - bucketWidth;

  pointerTargetX = clamp(relativeX - bucketWidth / 2, 0, maxX);

  if (event.type === "pointerdown") {
    bucketX = pointerTargetX;
    bucketVelocity = 0;
    updateBucketPosition();
  }
}

function clearPointerTarget(event) {
  if (event.pointerType !== "touch") {
    pointerTargetX = null;
  }
}

function handleResize() {
  centerBucket();
}

function centerBucket() {
  const maxX = Math.max(0, gameContainer.clientWidth - bucket.offsetWidth);
  bucketX = maxX / 2;
  updateBucketPosition();
}

function updateBucketPosition() {
  const maxX = Math.max(0, gameContainer.clientWidth - bucket.offsetWidth);
  bucketX = clamp(bucketX, 0, maxX);
  bucket.style.left = `${bucketX}px`;
}

function updateHud() {
  scoreDisplay.textContent = String(currentScore);
  timeDisplay.textContent = String(timeLeft);
}

function updateLowTimeWarning() {
  const isLowTime = gameActive && timeLeft <= 5;

  document.body.classList.toggle("time-warning-global", isLowTime);
  timerPanel.classList.toggle("low-time", isLowTime);

  if (globalWarningTimer) {
    globalWarningTimer.textContent = String(Math.max(0, timeLeft));
  }
}

function clearDrops() {
  gameContainer.querySelectorAll(".water-drop").forEach((drop) => drop.remove());
}

function clearFeedback() {
  gameContainer.querySelectorAll(".feedback-text").forEach((feedback) => feedback.remove());
}

function clearDangerFlash() {
  clearTimeout(flashTimeout);
  gameContainer.classList.remove("danger-flash");
}

function setStartButtonState(isRunning) {
  startBtn.disabled = isRunning;
  startBtn.textContent = isRunning ? "Rescue Active" : "Start Rescue";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isColliding(firstRect, secondRect) {
  return (
    firstRect.left < secondRect.right &&
    firstRect.right > secondRect.left &&
    firstRect.top < secondRect.bottom &&
    firstRect.bottom > secondRect.top
  );
}

function moveBucket(deltaTime) {
  if (!gameActive) {
    return;
  }

  const maxSpeed = BUCKET_SPEED * 60;
  const acceleration = 2600;
  const deceleration = 3200;
  let direction = 0;

  if (keys.left) {
    direction -= 1;
  }

  if (keys.right) {
    direction += 1;
  }

  if (pointerTargetX !== null && direction === 0) {
    const distance = pointerTargetX - bucketX;

    if (Math.abs(distance) < 0.5) {
      bucketX = pointerTargetX;
      bucketVelocity = 0;
    } else {
      bucketVelocity = distance * 12;
      bucketX += distance * Math.min(1, deltaTime * 12);
    }
  } else {
    if (direction !== 0) {
      pointerTargetX = null;
      bucketVelocity += direction * acceleration * deltaTime;
      bucketVelocity = clamp(bucketVelocity, -maxSpeed, maxSpeed);
    } else if (bucketVelocity !== 0) {
      const decelerationStep = deceleration * deltaTime;

      if (Math.abs(bucketVelocity) <= decelerationStep) {
        bucketVelocity = 0;
      } else {
        bucketVelocity -= Math.sign(bucketVelocity) * decelerationStep;
      }
    }

    bucketX += bucketVelocity * deltaTime;
  }

  updateBucketPosition();
  checkCollisions();
}

function checkCollisions() {
  if (!gameActive) {
    return;
  }

  const bucketRect = bucket.getBoundingClientRect();
  const catchZone = getBucketCatchZone(bucketRect);
  const drops = gameContainer.querySelectorAll(".water-drop");

  drops.forEach((drop) => {
    if (drop.dataset.collected === "true") {
      return;
    }

    const dropRect = drop.getBoundingClientRect();
    const enteringBucket = isDropEnteringBucket(dropRect, catchZone);

    drop.classList.toggle("in-bucket", enteringBucket);

    if (isDropInsideCatchZone(dropRect, catchZone)) {
      collectDrop(drop);
    }
  });
}

function getBucketCatchZone(bucketRect) {
  const wallInset = bucketRect.width * 0.18;
  const openingDepth = bucketRect.height * 0.72;

  return {
    left: bucketRect.left + wallInset,
    right: bucketRect.right - wallInset,
    top: bucketRect.top + 4,
    bottom: bucketRect.top + openingDepth,
  };
}

function isDropCenteredOverOpening(dropRect, catchZone) {
  const dropCenterX = dropRect.left + dropRect.width / 2;
  return dropCenterX >= catchZone.left && dropCenterX <= catchZone.right;
}

function isDropEnteringBucket(dropRect, catchZone) {
  return (
    isDropCenteredOverOpening(dropRect, catchZone) &&
    dropRect.bottom >= catchZone.top &&
    dropRect.top <= catchZone.bottom
  );
}

function isDropInsideCatchZone(dropRect, catchZone) {
  const entryDepth = catchZone.top + dropRect.height / 3;

  return (
    isDropCenteredOverOpening(dropRect, catchZone) &&
    dropRect.bottom >= entryDepth &&
    dropRect.top <= catchZone.bottom
  );
}

function collectDrop(drop) {
  if (drop.dataset.collected === "true") {
    return;
  }

  drop.dataset.collected = "true";
  const isBad = drop.dataset.isBad === "true";
  const value = Number(drop.dataset.value);

  if (isBad) {
    currentScore = Math.max(0, currentScore - value);
    drop.classList.add("hit");
    showFeedback(`AVOID! -${value}.`, "#7a3b1d");
    triggerDangerFlash();
  } else {
    currentScore += value;
    drop.classList.add("pop");
    showFeedback(`+${value} POINTS!`, "#0b6e4f");
  }

  scoreDisplay.textContent = String(currentScore);

  setTimeout(() => {
    if (drop.parentElement) {
      drop.remove();
    }
  }, 220);
}

function showFeedback(text, color) {
  const feedback = document.createElement("div");
  const feedbackLeft = bucketX + bucket.offsetWidth / 2;
  const feedbackTop = gameContainer.clientHeight - bucket.offsetHeight - 54;

  feedback.className = "feedback-text";
  feedback.textContent = text;
  feedback.style.left = `${feedbackLeft}px`;
  feedback.style.top = `${feedbackTop}px`;
  feedback.style.color = color;
  gameContainer.appendChild(feedback);

  setTimeout(() => {
    feedback.remove();
  }, 900);
}

function triggerDangerFlash() {
  gameContainer.classList.add("danger-flash");
  clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => {
    gameContainer.classList.remove("danger-flash");
  }, 180);
}

function gameLoop(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.032);

  lastFrameTime = timestamp;
  moveBucket(deltaTime);
  requestAnimationFrame(gameLoop);
}

setStartButtonState(false);
resetBoard();
requestAnimationFrame(gameLoop);

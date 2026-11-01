// ========================================
// SPELLING COMPETITION - TIMEKEEPER PANEL
// ========================================

let competition = null;
let stage = null;
let currentState = null;

let syncInterval = null;
let syncBusy = false;

// Timer controls remain disabled until secure
// startTimer and stopTimer backend actions exist.
const TIMER_CONTROLS_ENABLED = false;


// ========================================
// API HELPER
// ========================================

async function api(data) {

  const response = await fetch("/api", {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(data),
    cache: "no-store"
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      "Server request failed."
    );
  }

  return result;
}


// ========================================
// INITIALIZATION
// ========================================

window.addEventListener("load", initializeTimekeeper);

async function initializeTimekeeper() {

  try {

    setStatus("Connecting to competition...");

    await loadCompetition();

    await loadStage();

    await synchronizeCompetition();

    syncInterval = setInterval(
      synchronizeCompetition,
      1000
    );

  } catch (error) {

    console.error("Timekeeper initialization failed:", error);

    showError(error.message);

    setConnection(false);

    setStatus("CONNECTION FAILED");

  }

}


// ========================================
// LOAD ACTIVE COMPETITION
// ========================================

async function loadCompetition() {

  const result = await api({
    action: "getActiveCompetition"
  });

  if (!result.success || !result.competition) {

    throw new Error("No active competition was found.");

  }

  competition = result.competition;

  setText(
    "competitionName",
    competition.competition_name || "Unnamed Competition"
  );

}


// ========================================
// LOAD ACTIVE STAGE
// ========================================

async function loadStage() {

  const result = await api({

    action: "getActiveStage",

    competition_id: competition.id

  });

  if (!result.success || !result.stage) {

    throw new Error("No active stage was found.");

  }

  stage = result.stage;

  setText(
    "stageName",
    `Stage ${stage.stage_number} - ${stage.stage_name}`
  );

}


// ========================================
// SHARED COMPETITION SYNCHRONIZATION
// ========================================

async function synchronizeCompetition() {

  if (syncBusy || !competition) return;

  syncBusy = true;

  try {

    const result = await api({

      action: "getCompetitionRealtime",

      competition_id: competition.id

    });

    if (!result || result.success !== true) {

      throw new Error("Could not retrieve competition state.");

    }

    currentState = result;

    updateTimekeeperDisplay(result);

    setConnection(true);

    setText(
      "lastUpdated",
      "Last synchronized: " +
      new Date().toLocaleTimeString()
    );

    showError("");

  } catch (error) {

    console.error("Competition synchronization failed:", error);

    setConnection(false);

    showError(error.message);

  } finally {

    syncBusy = false;

  }

}


// ========================================
// UPDATE DISPLAY
// ========================================

function updateTimekeeperDisplay(state) {

  const participant =
    state.student?.full_name || "Waiting for participant";

  const word =
    state.current_word ||
    state.word ||
    "WAITING";

  const timeLeft =
    Number(state.time_left || 0);

  const timerRunning =
    state.started === true;

  setText("participantName", participant);

  setText("currentWord", word);

  setText("timer", timeLeft);

  const timerElement =
    document.getElementById("timer");

  if (timerElement) {

    timerElement.classList.toggle(
      "running",
      timerRunning
    );

  }

  if (timerRunning) {

    setStatus("TIMER RUNNING");

  } else {

    setStatus("TIMER STOPPED");

  }

  updateTimerControls(timerRunning);

}


// ========================================
// TIMER CONTROL AVAILABILITY
// ========================================

function updateTimerControls(timerRunning) {

  const startButton =
    document.getElementById("startButton");

  const stopButton =
    document.getElementById("stopButton");

  if (!startButton || !stopButton) return;

  startButton.disabled =
    !TIMER_CONTROLS_ENABLED || timerRunning;

  stopButton.disabled =
    !TIMER_CONTROLS_ENABLED || !timerRunning;

  if (TIMER_CONTROLS_ENABLED) {

    startButton.style.cursor = "pointer";
    stopButton.style.cursor = "pointer";

    startButton.style.opacity =
      timerRunning ? ".45" : "1";

    stopButton.style.opacity =
      timerRunning ? "1" : ".45";

  }

}


// ========================================
// START TIMER
// ========================================

async function startTimer() {

  if (!TIMER_CONTROLS_ENABLED) {

    showError("Timer controls are not activated yet.");

    return;

  }

  // The secure backend action will be connected here.
  showError("The startTimer backend action is not installed.");

}


// ========================================
// STOP TIMER
// ========================================

async function stopTimer() {

  if (!TIMER_CONTROLS_ENABLED) {

    showError("Timer controls are not activated yet.");

    return;

  }

  // The secure backend action will be connected here.
  showError("The stopTimer backend action is not installed.");

}


// ========================================
// CONNECTION STATUS
// ========================================

function setConnection(connected) {

  const dot =
    document.getElementById("connectionDot");

  const status =
    document.getElementById("connectionStatus");

  if (dot) {

    dot.classList.toggle("online", connected);

    dot.classList.toggle("offline", !connected);

  }

  if (status) {

    status.textContent = connected
      ? "Connected to competition"
      : "Connection lost";

  }

}


// ========================================
// STATUS DISPLAY
// ========================================

function setStatus(message) {

  setText("timerStatus", message);

}


// ========================================
// ERROR DISPLAY
// ========================================

function showError(message) {

  setText("errorMessage", message || "");

}


// ========================================
// SAFE TEXT HELPER
// ========================================

function setText(id, value) {

  const element = document.getElementById(id);

  if (element) {

    element.textContent = value ?? "";

  }

}


// ========================================
// CLEANUP
// ========================================

window.addEventListener("beforeunload", () => {

  if (syncInterval) {

    clearInterval(syncInterval);

  }

});

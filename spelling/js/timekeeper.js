
// ========================================
// SPELLING COMPETITION - TIMEKEEPER
// ========================================

let competition = null;
let stage = null;
let currentState = null;

let syncInterval = null;
let syncBusy = false;
let actionBusy = false;

window.addEventListener("load", initializeTimekeeper);

async function initializeTimekeeper() {
  try {
    setStatus("CONNECTING TO COMPETITION...");

    await loadCompetition();
    await loadStage();
    await synchronizeCompetition();

    syncInterval = setInterval(synchronizeCompetition, 1000);
  } catch (error) {
    console.error(error);
    showError(error.message);
    setConnection(false);
    setStatus("CONNECTION FAILED");
  }
}

async function request(data) {
  if (typeof api !== "function") {
    throw new Error("Shared API helper is missing.");
  }

  const result = await api(data);

  if (!result) {
    throw new Error("Request failed. Check your login and connection.");
  }

  if (result.success !== true) {
    throw new Error(result.error || result.message || "Request failed.");
  }

  return result;
}

async function loadCompetition() {
  const result = await request({
    action: "getActiveCompetition"
  });

  if (!result.competition) {
    throw new Error("No active competition found.");
  }

  competition = result.competition;

  setText(
    "competitionName",
    competition.competition_name || "Unnamed Competition"
  );
}

async function loadStage() {
  const result = await request({
    action: "getActiveStage",
    competition_id: competition.id
  });

  if (!result.stage) {
    throw new Error("No active stage found.");
  }

  stage = result.stage;

  setText(
    "stageName",
    `Stage ${stage.stage_number} - ${stage.stage_name}`
  );
}

async function synchronizeCompetition() {
  if (syncBusy || !competition || actionBusy) return;

  syncBusy = true;

  try {
    const result = await request({
      action: "getCompetitionRealtime",
      competition_id: competition.id
    });

    currentState = result;

    updateTimekeeperDisplay(result);

    setConnection(true);

    setText(
      "lastUpdated",
      "Last synchronized: " + new Date().toLocaleTimeString()
    );

    showError("");
  } catch (error) {
    console.error("Synchronization failed:", error);
    setConnection(false);
    showError(error.message);
  } finally {
    syncBusy = false;
  }
}

function updateTimekeeperDisplay(state) {
  setText(
    "participantName",
    state.student?.full_name || "Waiting for participant"
  );

  setText(
    "currentWord",
    state.current_word || state.word || "WAITING"
  );

  const timeLeft = Math.max(0, Number(state.time_left) || 0);
  const running = state.started === true;

  setText("timer", timeLeft);

  document.getElementById("timer")
    ?.classList.toggle("running", running);

  if (running) {
    setStatus("TIMER RUNNING");
  } else if (state.spelling_authorized === true) {
    setStatus("READY — SPELLING AUTHORIZED");
  } else if (state.voting_open === true) {
    setStatus("VOTING IN PROGRESS");
  } else if (state.timer_stopped_at) {
    setStatus("TIMER STOPPED — WAITING FOR LEADER");
  } else {
    setStatus("WAITING FOR LEADER");
  }

  updateTimerControls(state);
}

function updateTimerControls(state) {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");

  if (!startButton || !stopButton) return;

  const running = state.started === true;

  const canStart =
    state.spelling_authorized === true &&
    !running &&
    state.voting_open !== true;

  startButton.disabled = actionBusy || !canStart;
  stopButton.disabled = actionBusy || !running;

  startButton.style.cursor = startButton.disabled ? "not-allowed" : "pointer";
  stopButton.style.cursor = stopButton.disabled ? "not-allowed" : "pointer";

  startButton.style.opacity = startButton.disabled ? ".45" : "1";
  stopButton.style.opacity = stopButton.disabled ? ".45" : "1";
}

async function startTimer() {
  if (actionBusy || !currentState) return;

  if (currentState.spelling_authorized !== true) {
    showError("The Leader must authorize spelling first.");
    return;
  }

  actionBusy = true;
  updateTimerControls(currentState);

  try {
    await request({
      action: "startTimer",
      competition_id: competition.id
    });

    await synchronizeAfterAction();
  } catch (error) {
    showError(error.message);
  } finally {
    actionBusy = false;
    if (currentState) updateTimerControls(currentState);
  }
}

async function stopTimer() {
  if (actionBusy || !currentState) return;

  if (currentState.started !== true) {
    showError("There is no running timer.");
    return;
  }

  actionBusy = true;
  updateTimerControls(currentState);

  try {
    await request({
      action: "stopTimer",
      competition_id: competition.id
    });

    await synchronizeAfterAction();
  } catch (error) {
    showError(error.message);
  } finally {
    actionBusy = false;
    if (currentState) updateTimerControls(currentState);
  }
}

async function synchronizeAfterAction() {
  const result = await request({
    action: "getCompetitionRealtime",
    competition_id: competition.id
  });

  currentState = result;
  updateTimekeeperDisplay(result);
}

function setConnection(connected) {
  const dot = document.getElementById("connectionDot");
  const status = document.getElementById("connectionStatus");

  dot?.classList.toggle("online", connected);
  dot?.classList.toggle("offline", !connected);

  if (status) {
    status.textContent = connected
      ? "Connected to competition"
      : "Connection lost";
  }
}

function setStatus(message) {
  setText("timerStatus", message);
}

function showError(message) {
  setText("errorMessage", message || "");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "";
}

document.getElementById("startButton")
  ?.addEventListener("click", startTimer);

document.getElementById("stopButton")
  ?.addEventListener("click", stopTimer);

window.addEventListener("beforeunload", () => {
  if (syncInterval) clearInterval(syncInterval);
});

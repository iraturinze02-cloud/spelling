
// ==========================================
// PROFESSIONAL SPELLING COMPETITION ENGINE
// competition.js
// LEADER CONTROL VERSION
// ==========================================


// ==========================================
// AUDIO SYSTEM
// ==========================================

const sounds = {
  tick: new Audio("sounds/tick.mp3"),
  halfway: new Audio("sounds/halfway.mp3"),
  warning: new Audio("sounds/warning.mp3"),
  timeout: new Audio("sounds/timeout.mp3"),
  correct: new Audio("sounds/good.mp3"),
  wrong: new Audio("sounds/wrong.mp3"),
  applause: new Audio("sounds/applause.mp3"),
  roundFinish: new Audio("sounds/round-finish.mp3"),
  competitionFinish: new Audio("sounds/competition-finish.mp3"),
  welcome: new Audio("sounds/welcome.mp3"),
  tension: new Audio("sounds/tension.mp3"),
  victory: new Audio("sounds/victory.mp3"),
  background: new Audio("sounds/background.mp3")
};


// ==========================================
// GLOBAL STATE
// ==========================================

let realtimeTimer = null;

let backgroundMusic = new Audio();

let competitionRealtimeSocket = null;
let competitionRealtimeReconnect = null;
let competitionRealtimeFallback = null;

let finalizingResult = false;
let finalizedWordKey = null;
let votingRefreshBusy = false;
let activeVotingSessionId = null;

let competitionState = {
  competition: null,
  stage: null,
  students: [],
  wordGroups: [],
  words: [],

  currentStudentIndex: 0,
  currentRound: 1,
  currentWordIndex: 0,

  currentStudent: null,
  currentWord: "",

  timeLeft: 0,
  usedTime: 0,
  started: false
};


// ==========================================
// AUDIO HELPERS
// ==========================================

function playSound(sound, duration = null) {
  try {
    if (!sound) return;

    sound.pause();
    sound.currentTime = 0;

    sound.play().catch(error => {
      console.log("Audio playback:", error);
    });

    if (duration) {
      setTimeout(() => {
        sound.pause();
        sound.currentTime = 0;
      }, duration);
    }

  } catch (error) {
    console.log(error);
  }
}


function stopAllSounds() {
  Object.values(sounds).forEach(sound => {
    sound.pause();
    sound.currentTime = 0;
  });
}


// ==========================================
// INITIALIZE
// ==========================================

window.addEventListener("load", initializeCompetition);


let competitionReadinessReport = null;
let readinessInspectionBusy = false;
let competitionInitiatedInThisPage = false;

async function initializeCompetition() {
  await inspectCompetitionReadiness();
}

async function inspectCompetitionReadiness() {
  if (readinessInspectionBusy) return;
  readinessInspectionBusy = true;
  setReadinessBanner("Inspecting competition and stage readiness...", "info");
  document.getElementById("confirmReadinessBtn").disabled = true;
  document.getElementById("readinessSummary").innerHTML = "";
  document.getElementById("readinessParticipantArea").innerHTML = "";
  document.getElementById("leaderStats").hidden = true;
  document.getElementById("leaderOperations").hidden = true;

  try {
    const competitionRes = await api({ action: "getActiveCompetition" });
    competitionState.competition = competitionRes?.competition || null;
    if (!competitionState.competition) {
      competitionReadinessReport = null;
      setReadinessBanner("No active competition was found. Create or activate a competition before continuing.", "error");
      return;
    }

    const stageRes = await api({
      action: "getActiveStage",
      competition_id: competitionState.competition.id
    });
    competitionState.stage = stageRes?.stage || null;
    if (!competitionState.stage) {
      competitionReadinessReport = null;
      setReadinessBanner("No active stage was found for this competition. The Leader Panel remains locked.", "error");
      renderReadinessIdentity(competitionState.competition, null);
      return;
    }

    const report = await api({
      action: "inspectCompetitionReadiness",
      competition_id: competitionState.competition.id,
      stage_number: competitionState.stage.stage_number
    });
    if (!report || report.success === false) {
      throw new Error(report?.message || "The readiness inspection could not be completed.");
    }

    competitionReadinessReport = report;
    renderReadinessReport(report);
  } catch (error) {
    console.error("Readiness inspection failed:", error);
    competitionReadinessReport = null;
    setReadinessBanner(error.message || "Readiness inspection failed. Check the connection and try again.", "error");
  } finally {
    readinessInspectionBusy = false;
  }
}

function setReadinessBanner(message, type = "info") {
  const el = document.getElementById("readinessBanner");
  if (!el) return;
  el.className = "readiness-banner" + (type === "error" ? " error" : type === "success" ? " success" : "");
  el.textContent = message;
}

function renderReadinessIdentity(competition, stage) {
  const summary = document.getElementById("readinessSummary");
  const compName = competition?.competition_name || "Unknown competition";
  const stageName = stage ? `Stage ${stage.stage_number} — ${stage.stage_name}` : "No active stage";
  summary.textContent = `${compName} · ${stageName}`;
}

function renderReadinessReport(report) {
  const competition = report.competition || competitionState.competition;
  const stage = report.stage || competitionState.stage;
  renderReadinessIdentity(competition, stage);

  const checks = report.checks || {};
  const labels = {
    competition: "Active competition",
    stage: "Active stage",
    configuration: "Stage configuration",
    participants: "Participant assignments",
    draw_order: "Complete sequential draw order",
    word_groups: "Valid word groups and word availability",
    judges: "Judge assignments and activation",
    existing_records: "Existing stage records reviewed"
  };
  const checksHtml = Object.entries(labels).map(([key, label]) => {
    const check = checks[key] || {};
    const passed = check.passed === true && check.review_required !== true;
    const detail = readinessCheckDetail(key, check);
    return `<div class="readiness-check ${passed ? "pass" : "fail"}"><i class="fa-solid ${passed ? "fa-circle-check" : "fa-circle-xmark"}"></i><div><strong>${escapeReadinessText(label)}</strong><div>${escapeReadinessText(detail)}</div></div></div>`;
  }).join("");

  let issuesHtml = "";
  if (Array.isArray(report.issues) && report.issues.length) {
    issuesHtml = `<ul class="readiness-issues">${report.issues.map(issue => `<li>${escapeReadinessText(issue)}</li>`).join("")}</ul>`;
  }
  document.getElementById("readinessSummary").innerHTML = `<div class="readiness-checks">${checksHtml}</div>${issuesHtml}`;

  const participants = Array.isArray(report.participants) ? report.participants : [];
  if (participants.length) {
    const rows = participants.map((person, index) => `<tr><td>${index + 1}</td><td>${escapeReadinessText(person.full_name || "Unnamed participant")}</td><td>${escapeReadinessText(person.group_number ?? "—")}</td><td>${escapeReadinessText(person.draw_order ?? "—")}</td></tr>`).join("");
    document.getElementById("readinessParticipantArea").innerHTML = `<h4>Participants — original draw order</h4><div class="readiness-table-wrap"><table class="readiness-table"><thead><tr><th>Position</th><th>Participant</th><th>Word group</th><th>Draw order</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    document.getElementById("readinessParticipantArea").innerHTML = `<p class="readiness-footnote">No participants were returned by the readiness inspection.</p>`;
  }

  const ready = report.ready === true && participants.length > 0;
  if (ready) {
    setReadinessBanner("All required checks passed. Review the participant list before initiating the competition.", "success");
    document.getElementById("confirmReadinessBtn").disabled = false;
  } else {
    setReadinessBanner("Readiness checks have not passed. Competition operations are locked. Resolve the issues below and inspect again.", "error");
    document.getElementById("confirmReadinessBtn").disabled = true;
  }
}

function readinessCheckDetail(key, check) {
  switch (key) {
    case "participants": return `${check.count ?? 0} participant(s) found`;
    case "draw_order": return `Missing positions: ${check.missing_positions ?? "—"}; inconsistent positions: ${check.inconsistent_positions ?? "—"}`;
    case "word_groups": return `Missing groups: ${check.missing_groups ?? "—"}; insufficient word groups: ${check.insufficient_word_groups ?? "—"}`;
    case "judges": return `Assigned judges: ${check.assigned_count ?? 0}; stage activation verifiable: ${check.stage_activation_verifiable === true ? "Yes" : "No"}`;
    case "existing_records": {
      const records = check.records || {};
      return `Attempts: ${records.word_attempts ?? 0}; votes: ${records.judge_votes ?? 0}; voting sessions: ${records.voting_sessions ?? 0}${check.review_required ? " — Leader review required" : ""}`;
    }
    case "configuration": return `Rounds: ${check.total_rounds ?? "—"}; words per round: ${check.words_per_round ?? "—"}; total words: ${check.total_words ?? "—"}`;
    case "stage": return `Stage ${check.stage_number ?? "—"}: ${check.stage_name ?? "—"}`;
    case "competition": return check.name || "Competition record found";
    default: return check.passed ? "Passed" : "Not passed";
  }
}

function escapeReadinessText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

async function recheckCompetitionReadiness() {
  await inspectCompetitionReadiness();
}

async function confirmReadinessAndInitiate() {
  const report = competitionReadinessReport;
  if (!report || report.ready !== true || !Array.isArray(report.participants) || !report.participants.length) {
    alert("The competition is not ready. Resolve all failed checks first.");
    return;
  }

  const competitionName = report.competition?.competition_name || competitionState.competition?.competition_name || "this competition";
  const stageNumber = report.stage?.stage_number ?? competitionState.stage?.stage_number;
  const stageName = report.stage?.stage_name || competitionState.stage?.stage_name || "the active stage";

  if (!confirm(`Confirm the participant list in its original draw order for:\n\n${competitionName}\n\n${report.participants.length} participant(s).`)) return;
  if (!confirm(`Final initiation confirmation:\n\nCompetition: ${competitionName}\nStage: ${stageNumber} — ${stageName}\n\nInitiate this stage now?`)) return;

  // The current API has no dedicated, verified initiation/audit action.
  // Therefore this only unlocks the existing frontend in this page session;
  // it does not claim to persist an initiation timestamp on the server.
  competitionInitiatedInThisPage = true;
  await initializeOperationalCompetition();
}

async function initializeOperationalCompetition() {
  try {
    const competitionRes = await api({ action: "getActiveCompetition" });
    competitionState.competition = competitionRes?.competition || null;
    if (!competitionState.competition) throw new Error("The active competition is no longer available.");

    const stageRes = await api({ action: "getActiveStage", competition_id: competitionState.competition.id });
    competitionState.stage = stageRes?.stage || null;
    if (!competitionState.stage) throw new Error("The active stage is no longer available.");

    const studentsRes = await api({
      action: "getLiveStudents",
      competition_id: competitionState.competition.id,
      stage_number: competitionState.stage.stage_number
    });
    competitionState.students = studentsRes?.students || [];

    const wordsRes = await api({
      action: "getWordGroups",
      competition_id: competitionState.competition.id,
      stage_number: competitionState.stage.stage_number
    });
    competitionState.wordGroups = wordsRes?.groups || [];

    await restoreCompetitionState();
    await prepareCurrentParticipant();
    await refreshVotingSession();
    startRealtimeSync();

    document.getElementById("readinessPanel").hidden = true;
    document.getElementById("leaderStats").hidden = false;
    document.getElementById("leaderOperations").hidden = false;
    setReadinessBanner("Competition initiated in this page session.", "success");
    updateTeacherStatus("Competition Ready — awaiting Leader participant confirmation");
  } catch (error) {
    console.error("Operational panel initialization failed:", error);
    competitionInitiatedInThisPage = false;
    document.getElementById("leaderStats").hidden = true;
    document.getElementById("leaderOperations").hidden = true;
    document.getElementById("readinessPanel").hidden = false;
    setReadinessBanner(error.message || "Could not open the operational panel.", "error");
  }
}

// ==========================================
// PARTICIPANT PREPARATION
// ==========================================

async function prepareCurrentParticipant() {

  const student =
    competitionState.students[
      competitionState.currentStudentIndex
    ];

  competitionState.currentStudent = student || null;

  if (!student) {

    setText("studentName", "No Participant");
    setText("participantDisplay", "No Participant");
    setText("word", "READY");

    competitionState.currentWord = "";

    updateTeacherTimer();

    return;
  }


  // DISPLAY PARTICIPANT

  setText("studentName", student.full_name);
  setText("participantDisplay", student.full_name);


  // LOAD PARTICIPANT WORDS

  await loadParticipantWords(student.group_number);

  updateLiveInformation();
}


// ==========================================
// PREPARE CURRENT WORD
// ==========================================

function prepareCurrentWord() {

  const stage = competitionState.stage;

  if (!stage) return;

  const words = competitionState.words || [];

  if (words.length === 0) {

    competitionState.currentWord = "NO WORDS";

    setText("word", "NO WORDS");

    updateTeacherStatus("No words available");

    return;
  }


  const wordsPerRound = Math.max(
    1,
    Number(stage.words_per_round) || 3
  );


  const globalWordIndex =
    ((competitionState.currentRound - 1) * wordsPerRound) +
    competitionState.currentWordIndex;


  const word = words[globalWordIndex];


  if (!word) {

    competitionState.currentWord = "FINISHED";

    setText("word", "FINISHED");

    return;
  }


  competitionState.currentWord = word;

  setText("word", word);


  setText(
    "roundInfo",
    `${competitionState.currentRound}/${stage.total_rounds}`
  );


  competitionState.timeLeft =
    calculateAllowedTime(word);

  competitionState.usedTime = 0;

  competitionState.started = false;

  finalizedWordKey = null;
  finalizingResult = false;


  updateTeacherTimer();

  updateLiveInformation();

  disableVotingButtons();
}


// ==========================================
// CALCULATE ALLOWED TIME
// ==========================================

function calculateAllowedTime(word) {

  if (!word) return 10;

  const len = word.length;

  if (len <= 4) return 8;

  if (len <= 7) return 12;

  if (len <= 10) return 15;

  return 20;
}


// ==========================================
// START TIMER
// ==========================================

async function startWord() {
  updateTeacherStatus("Only the Timekeeper Panel can start or operate the timer.");
  return;


  if (!competitionState.currentStudent) {
    updateTeacherStatus("No participant selected");
    return;
  }

  if (
    !competitionState.currentWord ||
    competitionState.currentWord === "NO WORDS" ||
    competitionState.currentWord === "FINISHED"
  ) {
    updateTeacherStatus("No valid word available");
    return;
  }

  if (competitionState.started) return;

  clearInterval(realtimeTimer);


  // RESUME REMAINING TIME.
  // Only initialize the timer when there is no remaining time.

  if (competitionState.timeLeft <= 0) {

    competitionState.timeLeft =
      calculateAllowedTime(
        competitionState.currentWord
      );

    competitionState.usedTime = 0;
  }


  competitionState.started = true;

  updateTeacherTimer();

  disableVotingButtons();

  updateTeacherStatus("Timer Running");

  await saveCompetitionState();


  realtimeTimer = setInterval(async () => {

    if (!competitionState.started) {
      clearInterval(realtimeTimer);
      return;
    }


    competitionState.timeLeft--;

    competitionState.usedTime++;

    updateTeacherTimer();

    playSound(sounds.tick);


    // HALF-TIME SOUND

    if (
      competitionState.timeLeft ===
      Math.floor(
        calculateAllowedTime(
          competitionState.currentWord
        ) / 2
      )
    ) {
      playSound(sounds.halfway);
    }


    // FIVE-SECOND WARNING

    if (competitionState.timeLeft === 5) {
      playSound(sounds.warning, 5000);
    }


    // TIME EXPIRED

    if (competitionState.timeLeft <= 0) {

      clearInterval(realtimeTimer);

      realtimeTimer = null;

      competitionState.timeLeft = 0;

      competitionState.started = false;

      updateTeacherTimer();

      playSound(sounds.timeout);

      // IMPORTANT:
      // Timer expiry DOES NOT open voting.
      // The leader must open a voting session separately.

      updateTeacherStatus(
        "Time expired — awaiting leader action"
      );

      await saveCompetitionState();

      return;
    }


    await saveCompetitionState();

  }, 1000);

}


// ==========================================
// STOP / PAUSE TIMER
// ==========================================

async function stopTimer() {

  clearInterval(realtimeTimer);

  realtimeTimer = null;

  competitionState.started = false;

  stopAllSounds();

  // IMPORTANT:
  // Stopping the timer does NOT authorize judges.

  updateTeacherStatus(
    "Timer stopped — voting remains closed"
  );

  updateTeacherTimer();

  await saveCompetitionState();
}


// ==========================================
// LOAD PARTICIPANT WORDS
// ==========================================

async function loadParticipantWords(groupNumber) {

  try {

    const res = await api({
      action: "getWordsByGroup",
      group_number: groupNumber,
      competition_id: competitionState.competition.id,
      stage_number: competitionState.stage.stage_number
    });


    const rawWords = res?.words || [];

    competitionState.words = rawWords
      .map(w => typeof w === "string" ? w : w.word)
      .filter(Boolean);


    // Do not call prepareCurrentWord here.
    // prepareCurrentParticipant calls it after loading.

    prepareCurrentWord();

  } catch (error) {

    console.error("Loading participant words failed:", error);

    competitionState.words = [];

    competitionState.currentWord = "NO WORDS";

    setText("word", "NO WORDS");

  }
}


// ==========================================
// TEACHER VOTING REMOVED
// ==========================================

// The teacher is the competition leader, not a judge.
// Do not send teacher votes to saveJudgeVote.

async function submitVote() {

  updateTeacherStatus(
    "The competition leader cannot submit judge votes"
  );

}


// ==========================================
// FINALIZE RESULT
// ==========================================

async function finalizeResult() {
  updateTeacherStatus(
    "Result confirmation is locked. The current legacy finalizeVotes API does not yet enforce closed voting, strict majority, tie resolution, duplicate protection, or Leader confirmation. No result was saved."
  );
  alert("Result confirmation is not available yet. The voting and result-confirmation backend must be secured before this action can be enabled.");
  return;
}


// ==========================================
// NEXT WORD
// ==========================================

async function nextWord() {
  updateTeacherStatus("Progression is locked until secure Leader result confirmation and round controls are implemented.");
  return;

  if (!finalizedWordKey) {
    updateTeacherStatus("Confirm the current word result before progressing.");
    return;
  }


  clearInterval(realtimeTimer);

  realtimeTimer = null;

  competitionState.started = false;

  competitionState.usedTime = 0;

  const stage = competitionState.stage;

  if (!stage) return;


  competitionState.currentWordIndex++;


  // PARTICIPANT FINISHED WORDS IN THIS ROUND

  if (
    competitionState.currentWordIndex >=
    Number(stage.words_per_round)
  ) {

    competitionState.currentWordIndex = 0;

    competitionState.currentStudentIndex++;

    playSound(sounds.roundFinish);


    // ALL PARTICIPANTS FINISHED THIS ROUND

    if (
      competitionState.currentStudentIndex >=
      competitionState.students.length
    ) {

      competitionState.currentStudentIndex = 0;

      competitionState.currentRound++;


      // COMPETITION FINISHED

      if (
        competitionState.currentRound >
        Number(stage.total_rounds)
      ) {

        playSound(sounds.competitionFinish);

        updateTeacherStatus("Competition Finished");

        await saveCompetitionState();

        setTimeout(() => {
          window.location = "leaderboard.html";
        }, 3000);

        return;
      }

    }


    await prepareCurrentParticipant();

  } else {

    // NEXT WORD FOR SAME PARTICIPANT

    prepareCurrentWord();

  }


  competitionState.timeLeft =
    calculateAllowedTime(
      competitionState.currentWord
    );

  updateTeacherTimer();

  updateLiveInformation();

  await saveCompetitionState();

  finalizedWordKey = null;
  updateTeacherStatus("Next Word Ready");

}


// ==========================================
// NEXT PARTICIPANT
// ==========================================

async function nextParticipant() {
  updateTeacherStatus("Direct participant skipping is disabled. Participants must follow the confirmed word and round workflow.");
  return;


  clearInterval(realtimeTimer);

  realtimeTimer = null;

  competitionState.started = false;

  competitionState.currentStudentIndex++;

  competitionState.currentWordIndex = 0;


  // RESET ROUND SCORE DISPLAY

  setText("roundScore", "0");

  setText("liveRoundScore", "0");


  // ALL PARTICIPANTS FINISHED

  if (
    competitionState.currentStudentIndex >=
    competitionState.students.length
  ) {

    competitionState.currentStudentIndex = 0;

    competitionState.currentRound++;


    if (
      competitionState.currentRound >
      Number(competitionState.stage.total_rounds)
    ) {

      updateTeacherStatus("Competition Finished");

      playMusic("sounds/victory.mp3");

      await saveCompetitionState();

      window.location = "leaderboard.html";

      return;
    }

  }


  await prepareCurrentParticipant();

  playMusic("sounds/background.mp3");

  await saveCompetitionState();

  updateTeacherStatus("Next Participant Ready");

}


// ==========================================
// RESET PARTICIPANT
// ==========================================

async function resetParticipant() {
  updateTeacherStatus("Participant restart is locked until a reasoned, audited Leader override is implemented.");
  alert("Participant restart is temporarily unavailable to protect competition records.");
  return;


  if (
    !competitionState.competition ||
    !competitionState.stage
  ) {
    alert("No active competition or stage was found.");
    return;
  }


  if (
    !competitionState.students[
      competitionState.currentStudentIndex
    ]
  ) {
    alert("No current participant was found.");
    return;
  }


  const confirmed = confirm(
    "Restart this participant from Round 1, Word 1?"
  );

  if (!confirmed) return;


  try {

    clearInterval(realtimeTimer);

    realtimeTimer = null;

    competitionState.started = false;

    competitionState.currentRound = 1;

    competitionState.currentWordIndex = 0;

    competitionState.timeLeft = 0;

    competitionState.usedTime = 0;

    finalizedWordKey = null;


    setText("roundScore", "0");

    setText("liveRoundScore", "0");


    await prepareCurrentParticipant();

    await saveCompetitionState();

    updateTeacherStatus("Participant Reset");

  } catch (error) {

    console.error("Reset participant failed:", error);

    alert("Could not reset this participant. Please try again.");

  }
}


// ==========================================
// RESET COMPETITION
// ==========================================

async function resetCompetition() {
  updateTeacherStatus("Competition reset is disabled to protect existing competition history.");
  alert("Competition reset is disabled. Existing records and history will not be deleted from this panel.");
  return;


  const confirmed = confirm(
    "Reset the entire competition and return to the first participant?"
  );

  if (!confirmed) return;


  const competitionId =
    competitionState.competition?.id;

  if (!competitionId) {
    alert("No active competition was found.");
    return;
  }


  try {

    clearInterval(realtimeTimer);

    realtimeTimer = null;


    const result = await api({
      action: "resetState",
      competition_id: competitionId
    });


    if (!result || result.success !== true) {

      alert(
        result?.message ||
        "Could not reset the competition."
      );

      return;
    }


    competitionState.currentStudentIndex = 0;

    competitionState.currentRound = 1;

    competitionState.currentWordIndex = 0;

    competitionState.currentStudent = null;

    competitionState.currentWord = "";

    competitionState.timeLeft = 0;

    competitionState.usedTime = 0;

    competitionState.started = false;

    finalizedWordKey = null;


    location.reload();

  } catch (error) {

    console.error("Reset competition failed:", error);

    alert("Could not reset the competition. Please try again.");

  }
}


// ==========================================
// SAVE COMPETITION STATE
// ==========================================

async function saveCompetitionState() {

  if (
    !competitionState.competition ||
    !competitionState.stage
  ) {
    return;
  }


  try {

    await api({

      action: "updateState",

      competition_id:
        competitionState.competition.id,

      stage_number:
        competitionState.stage.stage_number,

      currentStudent:
        competitionState.currentStudentIndex,

      round:
        competitionState.currentRound,

      currentWordIndex:
        competitionState.currentWordIndex,

      timeLeft:
        competitionState.timeLeft,

      started:
        competitionState.started,

      score:
        document.getElementById("roundScore")?.innerText || 0,

      participant_done: false

    });

  } catch (error) {

    console.error("Saving competition state failed:", error);

  }

}


// ==========================================
// RESTORE COMPETITION STATE
// ==========================================

async function restoreCompetitionState() {

  const res = await api({

    action: "getCompetitionState",

    competition_id:
      competitionState.competition.id

  });


  if (!res || !res.state) return;


  const state = res.state;


  competitionState.currentStudentIndex =
    Number(state.current_student_index || 0);

  competitionState.currentRound =
    Number(state.current_round || 1);

  competitionState.currentWordIndex =
    Number(state.current_word_index || 0);

  competitionState.timeLeft =
    Number(state.time_left || 0);

  competitionState.started =
    Boolean(state.started);


  // Do not create a second countdown when restoring.
  // The live timer synchronization will be handled separately.

  if (competitionState.started) {
    updateTeacherStatus("Restoring competition timer state");
  }

}



// ==========================================
// READ-ONLY JUDGE VOTING MONITOR
// ==========================================

async function refreshVotingSession() {
  if (votingRefreshBusy || !competitionState.competition?.id) return;
  votingRefreshBusy = true;

  try {
    const response = await api({
      action: "getVotingSession",
      competition_id: competitionState.competition.id
    });

    if (!response?.success) {
      throw new Error(response?.error || "Could not retrieve voting-session status.");
    }

    const session = response.session || null;
    const judges = Array.isArray(response.judges) ? response.judges : [];
    activeVotingSessionId = session?.id ?? null;

    const authorized = judges.filter(judge => judge.authorized === true);
    const voted = authorized.filter(judge => judge.voted === true);
    const pending = authorized.filter(judge => judge.voted !== true);
    const unauthorized = judges.filter(judge => judge.authorized !== true);
    const progress = authorized.length
      ? Math.round((voted.length / authorized.length) * 100)
      : 0;

    setText("authorizedCount", `${authorized.length} / ${judges.length}`);
    setText("votesReceivedCount", `${voted.length}`);
    setText("pendingCount", `${pending.length}`);
    setText("sessionResult", session ? (session.status || "open").toUpperCase() : "—");

    const bar = document.getElementById("voteProgressBar");
    if (bar) bar.style.width = `${progress}%`;

    const status = document.getElementById("votingStatus");
    const judgeArea = document.getElementById("judgeSessionDetails");

    if (!session) {
      if (status) status.textContent = "There is currently no open voting session for this competition.";
      if (judgeArea) judgeArea.innerHTML = '<p class="section-note">Waiting for a voting session. This panel does not open sessions or authorize judges.</p>';
      setText("sessionResult", "NO OPEN SESSION");
      return;
    }

    if (status) {
      status.textContent = `Voting is ${session.status}. Stage ${session.stage_number ?? "—"}, Round ${session.round_number ?? "—"}, Participant ID ${session.student_id}, Word: ${session.word || "—"}.`;
    }

    if (judgeArea) {
      const rows = judges.map(judge => {
        const state = judge.authorized !== true
          ? "Not authorized"
          : judge.voted === true
            ? "Vote submitted"
            : "Authorized — awaiting vote";
        return `<li><span>Judge ${escapeReadinessText(judge.judge_id ?? "Unknown")}</span><strong>${escapeReadinessText(state)}</strong></li>`;
      }).join("");

      judgeArea.innerHTML = `
        <div class="session-summary">
          <span><strong>${voted.length}</strong> of <strong>${authorized.length}</strong> authorized judges have voted (${progress}%).</span>
          <span>${unauthorized.length} judge(s) not yet authorized.</span>
        </div>
        ${judges.length
          ? `<ul class="judge-session-list">${rows}</ul>`
          : '<p class="section-note">No judges were attached to this voting session.</p>'}
        <p class="section-note">Read-only monitoring: no authorization, voting, session closure, or result confirmation is performed here.</p>
      `;
    }
  } catch (error) {
    console.error("Voting session monitor failed:", error);
    setText("votingStatus", error.message || "Voting-session status is temporarily unavailable.");
  } finally {
    votingRefreshBusy = false;
  }
}

// ==========================================
// REALTIME SYNCHRONIZATION
// ==========================================

function startRealtimeSync() {

  connectCompetitionRealtime();

  clearInterval(competitionRealtimeFallback);

  competitionRealtimeFallback =
    setInterval(syncCompetitionState, 15000);

}


function connectCompetitionRealtime() {

  const competitionId =
    competitionState.competition?.id;

  if (!competitionId) return;


  if (
    competitionRealtimeSocket &&
    (
      competitionRealtimeSocket.readyState === WebSocket.CONNECTING ||
      competitionRealtimeSocket.readyState === WebSocket.OPEN
    )
  ) {
    return;
  }


  const protocol =
    location.protocol === "https:" ? "wss:" : "ws:";


  const socketUrl =
    `${protocol}//${location.host}/api/realtime?competition_id=${encodeURIComponent(competitionId)}`;


  try {

    competitionRealtimeSocket =
      new WebSocket(socketUrl);


    competitionRealtimeSocket.addEventListener("message", () => {
      syncCompetitionState();
    });


    competitionRealtimeSocket.addEventListener("close", () => {

      competitionRealtimeSocket = null;

      clearTimeout(competitionRealtimeReconnect);

      competitionRealtimeReconnect =
        setTimeout(connectCompetitionRealtime, 3000);

    });


    competitionRealtimeSocket.addEventListener("error", () => {

      competitionRealtimeSocket?.close();

    });

  } catch (error) {

    console.error("Realtime connection failed:", error);

  }

}


async function syncCompetitionState() {

  try {

    if (!competitionState.competition) return;


    const res = await api({

      action: "getCompetitionState",

      competition_id:
        competitionState.competition.id

    });


    if (!res || !res.state) {
      await refreshVotingSession();
      return;
    }


    // Do not overwrite the leader's active local countdown.

    if (!competitionState.started) {

      competitionState.timeLeft =
        Number(res.state.time_left || 0);

      updateTeacherTimer();

    }

    await refreshVotingSession();

  } catch (error) {

    console.error("Competition state sync failed:", error);

  }

}


// ==========================================
// UI HELPERS
// ==========================================

function setText(id, value) {

  const element = document.getElementById(id);

  if (element) {
    element.innerText =
      value === null || value === undefined ? "" : value;
  }

}


function updateTeacherTimer() {

  const timer =
    document.getElementById("timer");

  if (!timer) return;


  const seconds =
    Math.max(0, Number(competitionState.timeLeft) || 0);


  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;


  timer.innerText =
    `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

}


function updateTeacherStatus(text) {

  setText("status", text);

}


function updateLiveInformation() {

  const student =
    competitionState.currentStudent;

  if (student) {
    setText("studentName", student.full_name);
    setText("participantDisplay", student.full_name);
  }

  setText("liveRound", competitionState.currentRound);

  setText(
    "liveRoundScore",
    document.getElementById("roundScore")?.innerText || "0"
  );

  setText(
    "liveTotalScore",
    document.getElementById("totalScore")?.innerText || "0"
  );

  if (competitionState.stage) {

    setText(
      "roundInfo",
      `${competitionState.currentRound}/${competitionState.stage.total_rounds}`
    );

  }

}


// ==========================================
// TEACHER VOTING BUTTONS REMOVED
// ==========================================

// These functions are retained for compatibility with older
// markup, but they NEVER enable teacher voting controls.

function disableVotingButtons() {

  [
    "correctBtn",
    "wrongBtn",
    "notspeltBtn"
  ].forEach(id => {

    const button =
      document.getElementById(id);

    if (button) {
      button.disabled = true;
    }

  });

}


function enableVotingButtons() {

  // Teacher is not a judge.
  // This function intentionally does not enable voting.

  disableVotingButtons();

}


// ==========================================
// MUSIC
// ==========================================

function toggleMusicPanel() {

  const panel =
    document.getElementById("musicPanel");

  if (!panel) return;


  panel.style.display =
    panel.style.display === "block"
      ? "none"
      : "block";

}


function playMusic(src) {

  if (!src) return;

  backgroundMusic.pause();

  backgroundMusic.currentTime = 0;

  backgroundMusic.src = src;

  backgroundMusic.loop = true;

  backgroundMusic.play().catch(error => {
    console.log("Music playback:", error);
  });

}


function stopMusic() {

  backgroundMusic.pause();

  backgroundMusic.currentTime = 0;

}


// ==========================================
// NAVIGATION
// ==========================================

function goHome() {

  window.location = "teacher-home.html";

}


function goLeaderboard() {
  alert("Leaderboard access from the Leader Panel will be enabled after the competition-closure and visibility controls are connected.");
  return;
}

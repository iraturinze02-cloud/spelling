
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


async function initializeCompetition() {
  try {

    // LOAD ACTIVE COMPETITION

    const competitionRes = await api({
      action: "getActiveCompetition"
    });

    competitionState.competition =
      competitionRes?.competition || null;

    if (!competitionState.competition) {
      updateTeacherStatus("No active competition");
      playMusic("sounds/welcome.mp3");
      return;
    }

    setText(
      "competitionTitle",
      competitionState.competition.competition_name
    );


    // LOAD ACTIVE STAGE

    const stageRes = await api({
      action: "getActiveStage",
      competition_id: competitionState.competition.id
    });

    competitionState.stage =
      stageRes?.stage || null;

    if (!competitionState.stage) {
      updateTeacherStatus("No active stage");
      return;
    }

    setText(
      "stageTitle",
      `Stage ${competitionState.stage.stage_number} • ${competitionState.stage.stage_name}`
    );


    // LOAD LIVE STUDENTS

    const studentsRes = await api({
      action: "getLiveStudents",
      competition_id: competitionState.competition.id,
      stage_number: competitionState.stage.stage_number
    });

    competitionState.students =
      studentsRes?.students || [];


    // LOAD WORD GROUPS

    const wordsRes = await api({
      action: "getWordGroups",
      competition_id: competitionState.competition.id,
      stage_number: competitionState.stage.stage_number
    });

    competitionState.wordGroups =
      wordsRes?.groups || [];


    // RESTORE SAVED STATE

    await restoreCompetitionState();


    // PREPARE CURRENT PARTICIPANT

    await prepareCurrentParticipant();


    // START REALTIME SYNCHRONIZATION

    startRealtimeSync();

    updateTeacherStatus("Competition Ready");

  } catch (error) {
    console.error("Competition initialization failed:", error);
    updateTeacherStatus("Failed to initialize");
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

  if (finalizingResult) return;

  const student = competitionState.currentStudent;

  if (!student) {
    updateTeacherStatus("No participant selected");
    return;
  }

  if (!competitionState.currentWord) {
    updateTeacherStatus("No current word");
    return;
  }


  // Prevent accidental duplicate finalization for this word.

  const wordKey = [
    competitionState.competition?.id,
    competitionState.stage?.stage_number,
    student.id,
    competitionState.currentRound,
    competitionState.currentWordIndex
  ].join("-");


  if (finalizedWordKey === wordKey) {
    updateTeacherStatus(
      "This word's result has already been finalized"
    );
    return;
  }


  if (competitionState.started) {
    updateTeacherStatus(
      "Stop the timer before finalizing the result"
    );
    return;
  }


  finalizingResult = true;

  updateTeacherStatus("Finalizing result...");


  try {

    const result = await api({

      action: "finalizeVotes",

      competition_id:
        competitionState.competition.id,

      stage_number:
        competitionState.stage.stage_number,

      student_id:
        student.id,

      round_number:
        competitionState.currentRound,

      word:
        competitionState.currentWord,

      used_time:
        competitionState.usedTime,

      time_allowed:
        calculateAllowedTime(
          competitionState.currentWord
        )

    });


    if (!result || result.success === false) {

      updateTeacherStatus(
        result?.message || "Could not finalize result"
      );

      return;
    }


    // MARK THIS WORD AS FINALIZED

    finalizedWordKey = wordKey;


    const score = Number(result.score || 0);


    // UPDATE ROUND SCORE

    const roundScoreElement =
      document.getElementById("roundScore");

    const currentRoundScore =
      Number(roundScoreElement?.innerText || 0);

    const newRoundScore =
      currentRoundScore + score;

    setText(
      "roundScore",
      newRoundScore.toFixed(2)
    );


    // UPDATE TOTAL SCORE

    const totalScoreElement =
      document.getElementById("totalScore");

    const currentTotalScore =
      Number(totalScoreElement?.innerText || 0);

    const newTotalScore =
      currentTotalScore + score;

    setText(
      "totalScore",
      newTotalScore.toFixed(2)
    );


    updateLiveInformation();


    // PLAY RESULT SOUND

    if (result.final_status === "correct") {

      if (
        competitionState.usedTime <=
        calculateAllowedTime(
          competitionState.currentWord
        ) / 2
      ) {

        playSound(sounds.applause, 5000);

      } else {

        playSound(sounds.correct);

      }

    } else {

      playSound(sounds.wrong);

    }


    disableVotingButtons();


    updateTeacherStatus(
      `Result finalized: ${String(result.final_status || "unknown").toUpperCase()} — leader may advance`
    );


    await saveCompetitionState();


    // IMPORTANT:
    // Do not automatically call nextWord().
    // The leader decides when to advance.

  } catch (error) {

    console.error("Finalizing result failed:", error);

    updateTeacherStatus("Could not finalize result");

  } finally {

    finalizingResult = false;

  }
}


// ==========================================
// NEXT WORD
// ==========================================

async function nextWord() {

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

  updateTeacherStatus("Next Word Ready");

}


// ==========================================
// NEXT PARTICIPANT
// ==========================================

async function nextParticipant() {

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


    if (!res || !res.state) return;


    // Do not overwrite the leader's active local countdown.

    if (!competitionState.started) {

      competitionState.timeLeft =
        Number(res.state.time_left || 0);

      updateTeacherTimer();

    }

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

  window.location = "leaderboard.html";

}

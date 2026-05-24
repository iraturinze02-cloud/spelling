

let refreshing = false;
/* ===============================
LOAD ACTIVE STAGE
=============================== */

async function loadStages() {
  try {

    if (!competition) return;

    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getActiveStage",
        competition_id: competition.id
      })
    });

    const data = await res.json();

    stages = data.stages || [];

  } catch (error) {
    console.log(error);
  }
}

/* ===============================
LOAD LEADERBOARD
=============================== */

async function load() {

  try {

    const competition_id = localStorage.getItem("competition_id");
    const activeStage = stages.find(s => s.status === "active") || stages[0];

    if (!competition_id || ! activeStage) {
      document.getElementById("title").innerText =
        "No Active Competition / Stage";
      document.getElementById("list").innerHTML = "";
      return;
    }

    
    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getLeaderboard",
        competition_id,
        stage_number
      })
    });

    const data = await res.json();

    let leaderboard = data.leaderboard || [];

    /* ===============================
    TITLE LOGIC (FIXED)
    =============================== */

    document.getElementById("title").innerText =
      "YOUNG SPELLERS - Stage " + stage_number + " Ranking";

    /* ===============================
    EMPTY STATE
    =============================== */

    if (leaderboard.length === 0) {
      document.getElementById("list").innerHTML =
        "<tr><td colspan='4'>No results yet</td></tr>";
      return;
    }

    /* ===============================
    RENDER TABLE
    =============================== */

    let html = "";

    leaderboard.forEach((s, i) => {

      let cls = "";
      let rank = i + 1;

      if (i === 0) {
        cls = "top1";
        rank = "🥇";
      } else if (i === 1) {
        cls = "top2";
        rank = "🥈";
      } else if (i === 2) {
        cls = "top3";
        rank = "🥉";
      }

      html += `
        <tr class="${cls}">
          <td class="rank">${rank}</td>
          <td>${s.full_name}</td>
          <td>${s.class_name}</td>
          <td>${s.total_score}</td>
        </tr>
      `;
    });

    document.getElementById("list").innerHTML = html;

  } catch (error) {
    console.log("Load error:", error);
  }
}

/* ===============================
NEXT ROUND (QUALIFICATION + STAGE ADVANCE)
=============================== */

async function nextRound() {

  try {

    const competition_id = localStorage.getItem("competition_id");
    const currentStage = parseInt(localStorage.getItem("active_stage") || 1);
    const currentRound = parseInt(localStorage.getItem("currentRound") || 1);

    if (!competition_id) {
      alert("No competition selected");
      return;
    }

    /* 1. QUALIFY STUDENTS FOR NEXT ROUND */
    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "qualifyNextRound",
        competition_id,
        stage_number: currentStage,
        round_number: currentRound,
        qualification_rule: localStorage.getItem("qualification_rule") || "top",
        qualifier_count: parseInt(localStorage.getItem("qualifier_count") || 5)
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to advance round");
      return;
    }

    /* 2. MOVE TO NEXT ROUND */
    const newRound = currentRound + 1;
    localStorage.setItem("currentRound", newRound);

    /* 3. CHECK IF STAGE SHOULD AUTO ADVANCE */
    await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "autoAdvanceStage",
        competition_id,
        current_stage_number: currentStage
      })
    });

    /* 4. RELOAD UI */
    load();

    alert("Round " + newRound + " started!");

  } catch (error) {
    console.log("Next round error:", error);
  }
}

/* ===============================
AUTO REFRESH (SAFE)
=============================== */

async function autoRefresh() {

  if (refreshing) return;

  refreshing = true;

  try {
    await load();
  } catch (error) {
    console.log(error);
  }

  refreshing = false;
}

/* ===============================
INIT
=============================== */

load();

setInterval(autoRefresh, 10000);

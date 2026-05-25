import { neon } from "@neondatabase/serverless";

export async function onRequest(context) {

  const sql = neon(context.env.NEON_URL);

  let body = {};
  try {
    body = await context.request.json();
  } catch (e) {
    body = {};
  }
  console.log("BODY RECEIVED:", body);

  const action = body.action;
  const data=body;
  console.log("BODY:", body);
console.log("ACTION:", action);



  try {
    

    // =====================================================
    // LOGIN (YOU HAD SEPARATE FILE BEFORE)
    // =====================================================
    if (action === "login") {

      const users = await sql`
        SELECT *
        FROM users
        WHERE username=${body.username}
        AND password=${body.password}
        LIMIT 1
      `;

      return Response.json({
        success: users.length > 0,
        user: users[0] || null
      });
    }

    // =====================================================
    // CREATE STAGE
    // =====================================================
    if (action === "createStage") {

      await sql`
        INSERT INTO competition_stages
        (competition_id, stage_number, stage_name, participant_count,
         total_rounds, words_per_round, top_qualifiers, judge_count, status)
        VALUES(
          ${body.competition_id},
          ${body.stage_number},
          ${body.stage_name},
          ${body.participant_count},
          ${body.total_rounds},
          ${body.words_per_round},
          ${body.top_qualifiers},
          ${body.judge_count},
          ${body.status}
        )
      `;

      return Response.json({ success: true });
    }

    // =====================================================
    // UPDATE STAGE SETTINGS
    // =====================================================
    if (action === "updateStageSettings") {

      await sql`
        UPDATE competition_stages
        SET
          total_rounds=${body.total_rounds},
          words_per_round=${body.words_per_round},
          total_words=${body.total_words}
        WHERE competition_id=${body.competition_id}
        AND stage_number=${body.stage_number}
      `;

      return Response.json({ success: true });
    }
// =====================================================
// ACTIVATE STAGE (FIXED)
// =====================================================
if (action === "activateStage") {

  // 1. deactivate all stages
  await sql`
    UPDATE competition_stages
    SET status='inactive'
  `;

  // 2. activate selected stage
  const stage = await sql`
    UPDATE competition_stages
    SET status='active'
    WHERE id=${body.stage_id}
    RETURNING *
  `;

  const activeStage = stage[0];

  // 3. ONLY ensure progress exists for THIS stage
  const existing = await sql`
    SELECT 1
    FROM student_stage_progress
    WHERE competition_id=${activeStage.competition_id}
      AND stage_number=${activeStage.stage_number}
    LIMIT 1
  `;

  // ❗initialize Stage (or empty system)
if (existing.length === 0 && activeStage.stage_number == 1){

    const students = await sql`
      SELECT id
      FROM students
      WHERE competition_id=${activeStage.competition_id}
    `;

    for (const student of students) {
      await sql`
        INSERT INTO student_stage_progress(
          student_id,
          competition_id,
          stage_number,
          status
        )
        VALUES(
          ${student.id},
          ${activeStage.competition_id},
          ${activeStage.stage_number},
          'active'
        )
      `;
    }
  }

  return Response.json({ success: true });
}
    // =====================================================
    // CREATE COMPETITION
    // =====================================================
    if (action === "createCompetition") {

      await sql`
        INSERT INTO competitions (competition_name, status)
        VALUES (${body.competition_name}, 'inactive')
      `;

      return Response.json({ success: true });
    }

    // =====================================================
    // GET COMPETITIONS
    // =====================================================
    if (action === "getCompetitions") {

      const result = await sql`
        SELECT * FROM competitions
        ORDER BY id DESC
      `;

      return Response.json({ competitions: result });
    }


    // =====================================================
    // ACTIVATE COMPETITION
    // =====================================================
    if (action === "activateCompetition") {

      await sql`
        UPDATE competitions
        SET status='inactive'
        WHERE status='active'
      `;

      const result = await sql`
        UPDATE competitions
        SET status='active'
        WHERE id=${body.competition_id}
        RETURNING *
      `;

      return Response.json({
        success: true,
        competition: result[0]
      });
    }

    // =====================================================
    // DELETE COMPETITION
    // =====================================================
    if (action === "deleteCompetition") {

      await sql`
        DELETE FROM competitions
        WHERE id=${body.id}
      `;

      return Response.json({ success: true });
    }

    // =====================================================
    // CREATE WORD GROUP
    // =====================================================
    if (action === "createWordGroup") {

      if (!body.words || body.words.length !== 9) {
        return Response.json({
          success: false,
          message: "Exactly 9 words required"
        }, { status: 400 });
      }

      const group = await sql`
        INSERT INTO word_groups DEFAULT VALUES
        RETURNING *
      `;

      for (const word of body.words) {
        await sql`
          INSERT INTO words(group_id, word)
          VALUES(${group[0].id}, ${word})
        `;
      }

      return Response.json({ success: true, group: group[0] });
    }

    // =====================================================
    // INSERT WORD ATTEMPT
    // =====================================================
    if (action === "submitAttempt") {

      const result = await sql`
        INSERT INTO word_attempts(
          student_id,
          competition_id,
          round_number,
          word,
          learner_answer,
          score,
          time_allowed,
          time_used,
          status
        )
        VALUES(
          ${body.student_id},
          ${body.competition_id || null},
          ${body.round_number},
          ${body.word},
          ${body.learner_answer},
          ${body.score},
          ${body.time_allowed},
          ${body.time_used},
          ${body.status}
        )
        RETURNING *
      `;

      return Response.json({ success: true, result });
    }

    

    // =====================================================
    // GET STUDENTS (FILTERED)
    // =====================================================
    if (action === "getStudents") {

      const students = await sql`
        SELECT *
        FROM students
        WHERE competition_id=${body.competition_id}
        AND stage_number=${body.stage_number}
        ORDER BY full_name ASC
      `;

      return Response.json({
        success: true,
        students
      });
    }

    // =====================================================
    // ADD STUDENT
    // =====================================================
    if (action === "addStudent") {

      const full_name = body.full_name?.trim();
      const class_name = body.class_name?.trim() || "";

      if (!full_name) {
        return Response.json({
          success: false,
          message: "Student name required"
        }, { status: 400 });
      }

      const existing = await sql`
        SELECT id FROM students
        WHERE LOWER(full_name)=LOWER(${full_name})
      `;

      if (existing.length > 0) {
        return Response.json({
          success: false,
          message: "Student already exists"
        }, { status: 400 });
      }

      const student = await sql`
        INSERT INTO students(full_name, class_name)
        VALUES(${full_name}, ${class_name})
        RETURNING *
      `;

      return Response.json({ success: true, student });
    }

    // =====================================================
    // UPDATE STUDENT
    // =====================================================
    if (action === "updateStudent") {

      const updated = await sql`
        UPDATE students
        SET
          full_name=${body.full_name},
          gender=${body.gender},
          class_name=${body.class_name}
        WHERE id=${body.id}
        RETURNING *
      `;

      return Response.json({
        success: true,
        student: updated[0]
      });
    }

    // =====================================================
    // DELETE STUDENT
    // =====================================================
    if (action === "deleteStudent") {

      await sql`
        DELETE FROM students
        WHERE id=${body.id}
      `;

      return Response.json({ success: true });
    }

    // =====================================================
    // UPDATE COMPETITION STATE
    // =====================================================
    if (action === "updateState") {

      await sql`
        UPDATE competition_state
        SET
          current_student_index=${body.currentStudent},
          current_round=${body.round},
          current_word_index=${body.currentWordIndex},
          time_left=${body.timeLeft},
          started=${body.started},
          score=${body.score},
          participant_done=${body.participant_done},
          stage_number=${body.stage_number}
        WHERE competition_id=${body.competition_id}
      `;

      return Response.json({ success: true });
    }

    // =====================================================
    // RESET COMPETITION STATE
    // =====================================================
    if (action === "resetState") {

      await sql`
        UPDATE competition_state
        SET
          currentstudent=0,
          currentwordindex=0,
          round=1,
          score=0,
          timeleft=0
        WHERE id=1
      `;

      return Response.json({ success: true });
    }

    /* =====================
GET ACTIVE STAGE
===================== */

if(action==="getActiveStage"){

const stage=
await sql`

SELECT *

FROM competition_stages

WHERE competition_id=
${body.competition_id}

AND status='active'

LIMIT 1

`;

return Response.json({
success:true,
stage:stage[0] || null
});
}                        
    // =====================================================
    // GET ACTIVE COMPETITION
    // =====================================================
    if (action === "getActiveCompetition") {

      const result = await sql`
        SELECT *
        FROM competitions
        WHERE status='active'
        LIMIT 1
      `;

      return Response.json({
        competition: result[0] || null
      });
    }
    if (action === "getStageById") {

  const result = await sql`
    SELECT *
    FROM competition_stages
    WHERE id=${body.id}
    LIMIT 1
  `;

  return Response.json({
    stage: result[0] || null
  });
    }
    if (action === "getWordGroups") {

  const groups = await sql`
    SELECT
      g.id,
      g.group_number,
      json_agg(w.word) AS words
    FROM word_groups g
    LEFT JOIN words w ON g.id = w.group_id
    GROUP BY g.id
    ORDER BY g.group_number
  `;

  return Response.json({
    success: true,
    groups
  });
    }
    if (action === "getJudges") {

  const judges = await sql`
    SELECT id, full_name, username, role
    FROM users
    WHERE role='judge' OR role='teacher'
    ORDER BY id
  `;

  return Response.json({
    success: true,
    judges
  });
    }
    if (action === "getStudentDraws") {

  const students = await sql`
    SELECT
      s.id,
      s.full_name,
      d.draw_order,
      g.group_number
    FROM students s
    LEFT JOIN student_draws d ON s.id = d.student_id
    LEFT JOIN word_groups g ON d.group_id = g.id
    ORDER BY d.draw_order
  `;

  return Response.json({
    success: true,
    students
  });
          }
    
if (action === "getStudentsWithGroups") {

  const students = await sql`
    SELECT
      s.id,
      s.full_name,
      s.gender,
      d.draw_order,
      g.group_number
    FROM students s
    LEFT JOIN student_draws d ON s.id = d.student_id
    LEFT JOIN word_groups g ON d.group_id = g.id
    ORDER BY s.full_name
  `;

  return Response.json({
    success: true,
    students
  });
}

    if (action === "getStagesByCompetition") {

  const competition_id = parseInt(body.competition_id);

  if (!competition_id) {
    return Response.json(
      { message: "competition_id required" },
      { status: 400 }
    );
  }

  const stages = await sql`
    SELECT *
    FROM competition_stages
    WHERE competition_id = ${competition_id}
    ORDER BY stage_number ASC
  `;

  return Response.json({
    stages
  });
    }


// =====================================================
// GET LEADERBOARD (DB-DRIVEN QUALIFICATION SYSTEM)
// =====================================================
if (action === "getLeaderboard") {

  // 1. Get active competition
  const competition = await sql`
    SELECT id
    FROM competitions
    WHERE status = 'active'
    LIMIT 1
  `;

  if (competition.length === 0) {
    return Response.json({ success: true, leaderboard: [] });
  }

  const competition_id = competition[0].id;

  // 2. Get active stage
  const stage = await sql`
    SELECT stage_number
    FROM competition_stages
    WHERE competition_id = ${competition_id}
      AND status = 'active'
    LIMIT 1
  `;

  if (stage.length === 0) {
    return Response.json({ success: true, leaderboard: [] });
  }

  const active_stage = stage[0].stage_number;

  // 3. Get leaderboard (STRICT stage control via progress table)
  const leaderboard = await sql`
    SELECT
      s.id,
      s.full_name,
      s.class_name,

      COALESCE(SUM(
        CASE 
          WHEN w.stage_number = ${active_stage}
          THEN w.score 
          ELSE 0 
        END
      ), 0) AS total_score,

      sp.status AS stage_status

    FROM student_stage_progress sp

    JOIN students s
      ON s.id = sp.student_id

    LEFT JOIN word_attempts w
      ON w.student_id = s.id
      AND w.competition_id = ${competition_id}

    WHERE sp.competition_id = ${competition_id}
      AND sp.stage_number = ${active_stage}
      AND sp.status = 'active'

    GROUP BY s.id, s.full_name, s.class_name, sp.status
    ORDER BY total_score DESC
  `;

  return Response.json({
    success: true,
    leaderboard,
    active_stage
  });
}
    if (action === "autoAdvanceStage") {

  const { competition_id, current_stage_number } = body;

  // 1. Get next stage
  const nextStage = await sql`
    SELECT *
    FROM competition_stages
    WHERE competition_id = ${competition_id}
      AND stage_number > ${current_stage_number}
    ORDER BY stage_number ASC
    LIMIT 1
  `;

  if (nextStage.length === 0) {
    return Response.json({ success: true, message: "Finished" });
  }

  const next_stage_number = nextStage[0].stage_number;

  // 2. Get current stage leaderboard (TOP QUALIFIERS)
  const leaderboard = await sql`
    SELECT student_id, SUM(score) AS total_score
    FROM word_attempts
    WHERE competition_id = ${competition_id}
      AND stage_number = ${current_stage_number}
    GROUP BY student_id
    ORDER BY total_score DESC
  `;

  // 3. Get rule
  const rule = await sql`
    SELECT qualifier_count
    FROM competition_stages
    WHERE competition_id = ${competition_id}
      AND stage_number = ${current_stage_number}
    LIMIT 1
  `;

  const limit = rule[0].qualifier_count;

  let qualified = [];

if (rule[0].qualification_rule === "top") {
  qualified = leaderboard
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, limit);
}

if (rule[0].qualification_rule === "low") {
  qualified = leaderboard
    .sort((a, b) => a.total_score - b.total_score)
    .slice(0, limit);
}

if (rule[0].qualification_rule === "random") {
  qualified = leaderboard
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);
    }
  // 4. Mark current stage finished
  await sql`
    UPDATE student_stage_progress
    SET status = 'eliminated'
    WHERE competition_id = ${competition_id}
      AND stage_number = ${current_stage_number}
  `;

  // 5. Insert ONLY qualified into next stage
  for (const s of qualified) {
    await sql`
      INSERT INTO student_stage_progress (
        student_id,
        competition_id,
        stage_number,
        status
      )
      VALUES (
        ${s.student_id},
        ${competition_id},
        ${next_stage_number},
        'active'
      )
    `;
  }

  return Response.json({
    success: true,
    next_stage: next_stage_number,
    qualified
  });
}
    // =====================================================
// ENSURE STAGE READY (LIVE QUALIFICATION ENGINE)
// =====================================================
if (action === "ensureStageReady") {

  const { competition_id, stage_number } = body;

  // 1. check if stage already initialized (prevents duplicates)
  const existing = await sql`
    SELECT 1
    FROM student_stage_progress
    WHERE competition_id = ${competition_id}
      AND stage_number = ${stage_number}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return Response.json({
      success: true,
      message: "Stage already ready"
    });
  }

  // 2. get qualification rule for PREVIOUS stage
  const prevStage = stage_number - 1;

  const rule = await sql`
    SELECT qualifier_count, qualification_rule
    FROM competition_stages
    WHERE competition_id = ${competition_id}
      AND stage_number = ${prevStage}
    LIMIT 1
  `;

  // if no previous stage (stage 1 case) → allow all students
  let qualification_rule = rule[0]?.qualification_rule || "all";
  let limit = rule[0]?.qualifier_count || 0;

  // 3. get previous stage leaderboard
  const leaderboard = await sql`
    SELECT 
      student_id,
      SUM(score) AS total_score
    FROM word_attempts
    WHERE competition_id = ${competition_id}
      AND stage_number = ${prevStage}
    GROUP BY student_id
    ORDER BY total_score DESC
  `;

  // 4. apply qualification rule
  let qualified = [];

  if (qualification_rule === "top") {
    qualified = leaderboard.slice(0, limit);
  }

  if (qualification_rule === "low") {
    qualified = leaderboard.slice(-limit);
  }

  if (qualification_rule === "random") {
    qualified = leaderboard.sort(() => Math.random() - 0.5).slice(0, limit);
  }

  if (qualification_rule === "all") {
    qualified = leaderboard;
  }

  // 5. fallback: if stage 1 or no data → include all students
  if (prevStage < 1 || leaderboard.length === 0) {

    const allStudents = await sql`
      SELECT id AS student_id
      FROM students
      WHERE competition_id = ${competition_id}
    `;

    qualified = allStudents;
  }

  // 6. insert qualified students into progress table (NO DUPLICATES)
  for (const s of qualified) {

    await sql`
      INSERT INTO student_stage_progress (
        student_id,
        competition_id,
        stage_number,
        status
      )
      VALUES (
        ${s.student_id},
        ${competition_id},
        ${stage_number},
        'active'
      )
      ON CONFLICT DO NOTHING
    `;
  }

  return Response.json({
    success: true,
    stage_number,
    qualified_count: qualified.length
  });
  }

    // =====================================================
    // DEFAULT
    // =====================================================
      return Response.json({
error:"Invalid action"
},{status:400});

}
    catch(error){

console.log(
"FAILED ACTION:",
action
);

console.log(
"ERROR:",
error
);

return Response.json({
success:false,
action,
error:error.message
},{status:500});

}                        }

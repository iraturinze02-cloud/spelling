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
    // ACTIVATE STAGE
    // =====================================================
    if (action === "activateStage") {

      await sql`
        UPDATE competition_stages
        SET status='inactive'
      `;

      await sql`
        UPDATE competition_stages
        SET status='active'
        WHERE id=${body.stage_id}
      `;

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
    // GET LEADERBOARD
    // =====================================================
    if (action === "getLeaderboard") {

      const leaderboard = await sql`
        SELECT
          s.full_name,
          s.class_name,
          COALESCE(SUM(w.score), 0) AS total_score
        FROM students s
        LEFT JOIN word_attempts w ON s.id = w.student_id
        GROUP BY s.id, s.full_name, s.class_name
        ORDER BY total_score DESC
      `;

      return Response.json({
        success: true,
        leaderboard
      });
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
${data.competition_id}

AND status='active'

LIMIT 1

`;

return{

statusCode:200,

body:JSON.stringify({

success:true,
stage:stage[0] || null

})

};

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


    /* =====================================================
    6. QUALIFY NEXT ROUND (CORE ENGINE)
    ===================================================== */
    if (action === "qualifyNextRound") {

      const {
        competition_id,
        stage_number,
        round_number,
        qualification_rule,
        qualifier_count
      } = body;

      const students = await sql`
        SELECT 
          s.id,
          s.full_name,
          COALESCE(SUM(w.score), 0) AS total_score
        FROM students s
        LEFT JOIN word_attempts w
          ON s.id = w.student_id
          AND w.round_number = ${round_number}
        WHERE s.competition_id = ${competition_id}
          AND s.stage_number = ${stage_number}
        GROUP BY s.id, s.full_name
      `;

      let selected = [];

      if (qualification_rule === "top") {
        selected = students.sort((a,b)=>b.total_score-a.total_score)
          .slice(0, qualifier_count);
      }

      if (qualification_rule === "low") {
        selected = students.sort((a,b)=>a.total_score-b.total_score)
          .slice(0, qualifier_count);
      }

      if (qualification_rule === "random") {
        selected = students.sort(()=>Math.random()-0.5)
          .slice(0, qualifier_count);
      }

      const nextRound = round_number + 1;

      for (const s of selected) {

        await sql`
          INSERT INTO word_attempts (
            student_id,
            competition_id,
            round_number,
            score,
            status,
            final_decision
          )
          VALUES (
            ${s.id},
            ${competition_id},
            ${nextRound},
            0,
            'qualified',
            'auto'
          )
        `;
      }

      return json({
        success: true,
        next_round: nextRound,
        qualified: selected
      });
    }

    /* =====================================================
    7. AUTO ADVANCE STAGE
    ===================================================== */
    if (action === "autoAdvanceStage") {

      const { competition_id, current_stage_number } = body;

      const nextStage = await sql`
        SELECT *
        FROM competition_stages
        WHERE competition_id = ${competition_id}
          AND stage_number > ${current_stage_number}
        ORDER BY stage_number ASC
        LIMIT 1
      `;

      if (nextStage.length === 0) {
        return json({ success: true, message: "Competition finished" });
      }

      await sql`
        UPDATE competition_stages
        SET status = 'inactive'
        WHERE competition_id = ${competition_id}
      `;

      await sql`
        UPDATE competition_stages
        SET status = 'active'
        WHERE id = ${nextStage[0].id}
      `;

      await sql`
        UPDATE students
        SET stage_number = ${nextStage[0].stage_number}
        WHERE competition_id = ${competition_id}
      `;

      return json({
        success: true,
        next_stage: nextStage[0]
      });
  }
    // =====================================================
    // DEFAULT
    // =====================================================
    return Response.json({
      error: "Invalid action"
    }, { status: 400 });

  } catch (error) {

    return Response.json({
      error: error.message
    }, { status: 500 });

  }
                         }

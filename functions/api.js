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
  
if(action === "createWordGroup"){

try{

// VALIDATION
if(
!body.competition_id ||
!body.stage_number ||
!body.words
){

return Response.json({
success:false,
message:"Missing required fields"
},{status:400});

}


// GET STAGE RULES
const stage = await sql`

SELECT *

FROM competition_stages

WHERE competition_id=${body.competition_id}

AND stage_number=${body.stage_number}

LIMIT 1

`;

if(stage.length === 0){

return Response.json({
success:false,
message:"Stage not found"
},{status:400});

}


// REQUIRED WORDS
const requiredWords =

stage[0].total_rounds *
stage[0].words_per_round;


// VALIDATE WORD COUNT
if(body.words.length !== requiredWords){

return Response.json({

success:false,

message:
`Exactly ${requiredWords} words required`

},{status:400});

}


// NEXT GROUP NUMBER
const lastGroup = await sql`

SELECT

COALESCE(
MAX(group_number),
0
) AS max

FROM word_groups

WHERE competition_id=${body.competition_id}

AND stage_number=${body.stage_number}

`;

const nextGroupNumber =
lastGroup[0].max + 1;


// CREATE GROUP
const group = await sql`

INSERT INTO word_groups(

competition_id,
stage_number,
group_number

)

VALUES(

${body.competition_id},
${body.stage_number},
${nextGroupNumber}

)

RETURNING *

`;


// INSERT WORDS
for(const word of body.words){

await sql`

INSERT INTO words(

group_id,
word

)

VALUES(

${group[0].id},
${word.trim()}
)

`;

}


return Response.json({

success:true,
group:group[0]

});

}
catch(error){

console.log(error);

return Response.json({

success:false,
message:error.message

},{status:500});

}

   }

    // =====================================================
    // INSERT WORD ATTEMPT
    // =====================================================
    if (action === "submitAttempt") {

      const result = await sql`
        INSERT INTO word_attempts(
          student_id,
          competition_id,
          stage_number,
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
          ${body.stage_number},
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

    SELECT
      s.*,
      sp.stage_number,
      sp.status

    FROM student_stage_progress sp

    JOIN students s
      ON s.id = sp.student_id

    WHERE sp.competition_id=${body.competition_id}
      AND sp.stage_number=${body.stage_number}
      AND sp.status='active'

    ORDER BY s.full_name ASC

  `;

  return Response.json({
    success:true,
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

INSERT INTO competition_state(

competition_id,
stage_number,
current_student_index,
current_round,
current_word_index,
time_left,
started,
score,
participant_done

)

VALUES(

${body.competition_id},
${body.stage_number},
${body.currentStudent},
${body.round},
${body.currentWordIndex},
${body.timeLeft},
${body.started},
${body.score},
${body.participant_done}

)

ON CONFLICT (competition_id)

DO UPDATE SET

stage_number=EXCLUDED.stage_number,
current_student_index=EXCLUDED.current_student_index,
current_round=EXCLUDED.current_round,
current_word_index=EXCLUDED.current_word_index,
time_left=EXCLUDED.time_left,
started=EXCLUDED.started,
score=EXCLUDED.score,
participant_done=EXCLUDED.participant_done

`;

return Response.json({
success:true
});

  }

// =====================================================
// RESET STATE
// =====================================================

if(action==="resetState"){

await sql`

UPDATE competition_state

SET

current_student_index=0,
current_round=1,
current_word_index=0,
time_left=0,
started=false,
score=0,
participant_done=false,
voting_open=false,
finalized=false,
competition_status='Waiting To Start'

WHERE competition_id=${body.competition_id}

`;

return Response.json({
success:true
});

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
//===================================
//  Get Word Groups
//===================================
    if(action === "getWordGroups"){

try{

if(
!body.competition_id ||
!body.stage_number
){

return Response.json({
success:false,
message:"competition_id and stage_number required"
},{status:400});

}

const groups = await sql`

SELECT

g.id,
g.group_number,
g.stage_number,
g.competition_id,

COALESCE(

json_agg(
w.word
ORDER BY w.id
)

FILTER (
WHERE w.word IS NOT NULL
),

'[]'

) AS words

FROM word_groups g

LEFT JOIN words w
ON g.id = w.group_id

WHERE g.competition_id=${body.competition_id}

AND g.stage_number=${body.stage_number}

GROUP BY

g.id,
g.group_number,
g.stage_number,
g.competition_id

ORDER BY g.group_number ASC

`;

return Response.json({

success:true,
groups

});

}
catch(error){

console.log(error);

return Response.json({

success:false,
message:error.message

},{status:500});

}

}
  //=======================================
    //GET JUDGES
  //=========================================
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
    
    if(action === "getStudentDraws"){

// ACTIVE STAGE
const stage = await sql`

SELECT *

FROM competition_stages

WHERE competition_id=${body.competition_id}

AND status='active'

LIMIT 1

`;

if(stage.length === 0){

return Response.json({
success:false,
students:[]
});

}

const activeStage =
stage[0].stage_number;


// ONLY ACTIVE PARTICIPANTS
const students = await sql`

SELECT

s.id,
s.full_name,
s.gender,

d.draw_order,

d.group_id,

g.group_number,

sp.status

FROM student_stage_progress sp

JOIN students s
ON s.id = sp.student_id

LEFT JOIN student_draws d
ON d.student_id = s.id
AND d.competition_id = sp.competition_id

LEFT JOIN word_groups g
ON g.id = d.group_id

WHERE sp.competition_id=${body.competition_id}

AND sp.stage_number=${activeStage}

AND sp.status='active'

ORDER BY

COALESCE(d.draw_order,9999),
s.full_name ASC

`;

return Response.json({

success:true,
students

});

}
// =====================================================
// GET STUDENTS WITH GROUPS
// =====================================================

if(action === "getStudentsWithGroups"){

// ACTIVE STAGE
const stage = await sql`

SELECT *

FROM competition_stages

WHERE competition_id=${body.competition_id}

AND status='active'

LIMIT 1

`;

if(stage.length === 0){

return Response.json({
success:false,
message:"No active stage"
});

}

const activeStage =
stage[0].stage_number;


// ACTIVE STUDENTS ONLY
const students = await sql`

SELECT

s.id,
s.full_name,
s.gender,

sp.stage_number,
sp.status,

d.draw_order,
d.group_id

FROM student_stage_progress sp

JOIN students s
ON s.id = sp.student_id

LEFT JOIN student_draws d
ON d.student_id = s.id
AND d.competition_id = sp.competition_id
AND d.stage_number = sp.stage_number

WHERE sp.competition_id=${body.competition_id}

AND sp.stage_number=${activeStage}

AND sp.status='active'

ORDER BY

COALESCE(d.draw_order,9999),
s.full_name ASC

`;

return Response.json({

success:true,
students,
active_stage:activeStage

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
// SAVE JUDGE VOTE
// =====================================================

if(action==="saveJudgeVote"){

// REMOVE OLD VOTE FROM SAME JUDGE
await sql`

DELETE FROM judge_votes

WHERE competition_id=${body.competition_id}

AND stage_number=${body.stage_number}

AND round_number=${body.round_number}

AND student_id=${body.student_id}

AND word=${body.word}

AND judge_id=${body.judge_id}

`;

// INSERT NEW VOTE
await sql`

INSERT INTO judge_votes(

competition_id,
stage_number,
student_id,
round_number,
word,
judge_id,
vote

)

VALUES(

${body.competition_id},
${body.stage_number},
${body.student_id},
${body.round_number},
${body.word},
${body.judge_id},
${body.vote}

)

`;

return Response.json({
success:true
});

    }

// =====================================================
// GET WORD VOTES
// =====================================================

if(action==="getWordVotes"){

const votes = await sql`

SELECT *

FROM judge_votes

WHERE competition_id=${body.competition_id}

AND stage_number=${body.stage_number}

AND student_id=${body.student_id}

AND round_number=${body.round_number}

AND word=${body.word}

ORDER BY created_at ASC

`;

return Response.json({
success:true,
votes
});

}

// =====================================================
// CLEAR WORD VOTES
// =====================================================

if(action==="clearVotes"){

await sql`

DELETE FROM judge_votes

WHERE competition_id=${body.competition_id}

AND stage_number=${body.stage_number}

AND student_id=${body.student_id}

AND round_number=${body.round_number}

AND word=${body.word}

`;

return Response.json({
success:true
});

}

// =====================================================
// OPEN VOTING
// =====================================================

if(action==="openVoting"){

await sql`

UPDATE competition_state

SET

voting_open=true,
competition_status='Waiting For Judges Votes'

WHERE competition_id=${body.competition_id}

`;

return Response.json({
success:true
});

}

// =====================================================
// CLOSE VOTING
// =====================================================

if(action==="closeVoting"){

await sql`

UPDATE competition_state

SET

voting_open=false,
finalized=true

WHERE competition_id=${body.competition_id}

`;

return Response.json({
success:true
});

}

// =====================================================
// GET COMPETITION STATE
// =====================================================

if(action==="getCompetitionState"){

const state = await sql`

SELECT *

FROM competition_state

WHERE competition_id=${body.competition_id}

LIMIT 1

`;

return Response.json({
success:true,
state:state[0] || null
});

   }
// =====================================================
// ASSIGN DRAW
// =====================================================

if (action === "assignDraw") {

  try {

    // VALIDATION
    if (
      !body.student_id ||
      !body.group_id ||
      !body.draw_order ||
      !body.competition_id ||
      !body.stage_number
    ) {

      return Response.json({
        success: false,
        message: "Missing required fields"
      }, { status: 400 });

    }

    // CONVERT TO INTEGER
    const competition_id =
      parseInt(body.competition_id);

    const stage_number =
      parseInt(body.stage_number);

    const student_id =
      parseInt(body.student_id);

    const group_id =
      parseInt(body.group_id);

    const draw_order =
      parseInt(body.draw_order);

    // EXTRA VALIDATION
    if (
      isNaN(competition_id) ||
      isNaN(stage_number) ||
      isNaN(student_id) ||
      isNaN(group_id) ||
      isNaN(draw_order)
    ) {

      return Response.json({
        success: false,
        message: "Invalid numeric values"
      }, { status: 400 });

    }

    // CHECK IF DRAW EXISTS
    const existing = await sql`

      SELECT id

      FROM student_draws

      WHERE competition_id=${competition_id}

      AND stage_number=${stage_number}

      AND student_id=${student_id}

      LIMIT 1

    `;

    // =========================================
    // UPDATE EXISTING
    // =========================================

    if (existing.length > 0) {

      await sql`

        UPDATE student_draws

        SET

          group_id=${group_id},
          draw_order=${draw_order}

        WHERE competition_id=${competition_id}

        AND stage_number=${stage_number}

        AND student_id=${student_id}

      `;

    }

    // =========================================
    // INSERT NEW
    // =========================================

    else {

      await sql`

        INSERT INTO student_draws (

          competition_id,
          stage_number,
          student_id,
          group_id,
          draw_order

        )

        VALUES (

          ${competition_id},
          ${stage_number},
          ${student_id},
          ${group_id},
          ${draw_order}

        )

      `;

    }

    return Response.json({
      success: true
    });

  }

  catch (error) {

    console.log(
      "ASSIGN DRAW ERROR:",
      error
    );

    return Response.json({
      success: false,
      message: error.message
    }, { status: 500 });

  }

}

if (action === "finalizeVotes") {

  const {
    competition_id,
    stage_number,
    round_number,
    student_id,
    word,
    used_time,
    time_allowed
  } = body;

  // 1. get all votes
  const votes = await sql`
    SELECT vote
    FROM judge_votes
    WHERE competition_id=${competition_id}
      AND stage_number=${stage_number}
      AND student_id=${student_id}
      AND round_number=${round_number}
      AND word=${word}
  `;

  let correct = 0;
  let wrong = 0;
  let notspelt = 0;

  for (const v of votes) {

    if (v.vote === "correct") correct++;

    if (v.vote === "wrong") wrong++;

    if (v.vote === "notspelt") notspelt++;
  }
let final_status = "wrong";

if (correct > wrong && correct > notspelt) {
  final_status = "correct";
}
else if (notspelt > correct && notspelt > wrong) {
  final_status = "notspelt";
}

  let score = 0;

if (final_status === "correct") {

  const ratio = time_allowed / Math.max(used_time, 0.1);

  let rawScore = Math.log(ratio + 1);

  const MIN = 0.2;
  const MAX = 5;

  const normalized = rawScore / Math.log(11);

  score = MIN + (MAX - MIN) * normalized;

  score = Math.max(MIN, Math.min(MAX, score));

  score = Math.round(score * 1000) / 1000;
      }
  // SAVE RESULT
  await sql`
    INSERT INTO word_attempts(
      student_id,
      competition_id,
      stage_number,
      round_number,
      word,
      score,
      time_used,
      time_allowed,
      status
    )
    VALUES(
      ${student_id},
      ${competition_id},
      ${stage_number},
      ${round_number},
      ${word},
      ${score},
      ${used_time},
      ${time_allowed},
      ${final_status}
    )
  `;

  return Response.json({
    success:true,
    final_status,
    score
  });
  }
    // =====================================================
// GET COMPETITION REALTIME
// =====================================================

if(action==="getCompetitionRealtime"){

const stateRes = await sql`

SELECT *
FROM competition_state
WHERE competition_id=${body.competition_id}
LIMIT 1

`;

if(stateRes.length===0){

return Response.json({
success:false
});

}

const state = stateRes[0];

// ACTIVE STAGE
const stageRes = await sql`

SELECT *
FROM competition_stages
WHERE competition_id=${body.competition_id}
AND status='active'
LIMIT 1

`;

const stage = stageRes[0];

// STUDENTS
const students = await sql`

SELECT
s.*,
d.draw_order,
g.group_number

FROM students s

LEFT JOIN student_draws d
ON s.id=d.student_id

LEFT JOIN word_groups g
ON d.group_id=g.id

WHERE s.competition_id=${body.competition_id}

ORDER BY d.draw_order ASC

`;

const student =
students[state.current_student_index];

let words = [];

if(student){

const group = await sql`

SELECT
w.word

FROM words w

JOIN word_groups g
ON g.id=w.group_id

WHERE g.group_number=${student.group_number}

ORDER BY w.id ASC

`;

words = group.map(w=>w.word);

}

const wordIndex =
(
(state.current_round - 1)
*
stage.words_per_round
)
+
state.current_word_index;

const currentWord =
words[wordIndex] || "FINISHED";

const votes = await sql`

SELECT COUNT(*)::int AS total

FROM judge_votes

WHERE competition_id=${body.competition_id}
AND student_id=${student?.id || 0}
AND round_number=${state.current_round}
AND word=${currentWord}

`;

return Response.json({

success:true,

student,

student_id:student?.id || null,

round:state.current_round,

current_round:state.current_round,

word:currentWord,

current_word:currentWord,

word_index:state.current_word_index,

time_left:state.time_left,

started:state.started,

vote_count:votes[0]?.total || 0

});

  }
    // =====================================================
    // GET STUDENTS IN A COMPETITION 
    // =====================================================
if (action === "getLiveStudents") {

  const students = await sql`

    SELECT
      s.id,
      s.full_name,
      s.gender,

      sp.stage_number,

      d.group_id,
      d.draw_order,

      g.group_number

    FROM student_stage_progress sp

    JOIN students s
      ON s.id = sp.student_id

    JOIN student_draws d
      ON d.student_id = sp.student_id
      AND d.competition_id = sp.competition_id
      AND d.stage_number = sp.stage_number

    LEFT JOIN word_groups g
      ON g.id = d.group_id

    WHERE sp.competition_id = ${body.competition_id}
      AND sp.stage_number = ${body.stage_number}
      AND sp.status = 'active'

    ORDER BY
      d.draw_order ASC

  `;

  return Response.json({
    success: true,
    students
  });
}
    // ==========================================
//  Get Participant Words
// ==========================================

    if(action === "getWordsByGroup"){

const words = await sql`

SELECT
w.word

FROM words w

JOIN word_groups g
ON g.id = w.group_id

WHERE g.group_number = ${body.group_number}

AND g.competition_id = ${body.competition_id}

AND g.stage_number = ${body.stage_number}

ORDER BY w.id ASC
`;

return Response.json({
success:true,
words
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

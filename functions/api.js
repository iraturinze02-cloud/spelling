import { verifySessionToken } from "./_shared/auth.js";

import { neon } from "@neondatabase/serverless";

/**
 * Broadcast saved changes to connected competition screens.
 * Configure a Durable Object binding named REALTIME_DO in Cloudflare Pages.
 */
async function broadcastCompetition(context, competitionId, event = {}) {
  try {
    const namespace = context.env.COMPETITION_ROOM;
    if (!namespace || competitionId === undefined || competitionId === null || competitionId === "") return;

    const id = namespace.idFromName(`competition:${String(competitionId)}`);
    const room = namespace.get(id);
    await room.fetch("https://realtime.internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "competition-update",
        competition_id: String(competitionId),
        event,
        sent_at: Date.now()
      })
    });
  } catch (error) {
    // Keep the database action successful even if realtime is temporarily unavailable.
    console.error("Realtime broadcast failed:", error?.message || error);
  }
}

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
  // Login is handled only by /spellingLogin.
if (action === "login") {
  return Response.json(
    {
      success: false,
      error: "Please sign in through the login page."
    },
    { status: 400 }
  );
}

// Every /api action requires a valid signed session.
const authorization =
  context.request.headers.get("Authorization") || "";

const bearer = authorization.startsWith("Bearer ")
  ? authorization.slice(7)
  : "";

const session = await verifySessionToken(
  bearer,
  context.env.AUTH_SECRET
);

if (!session) {
  return Response.json(
    {
      success: false,
      error: "Your session is missing or has expired. Please sign in again.",
      code: "UNAUTHORIZED"
    },
    { status: 401 }
  );
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
    // LIST JUDGE ACCOUNTS
    // =====================================================
    if (action === "listJudgeAccounts") {
      const judges = await sql`
        SELECT id, full_name, username, role
        FROM users
        WHERE role = 'judge'
        ORDER BY full_name ASC
      `;

      return Response.json({
        success: true,
        judges
      });
    }

    // =====================================================
    // ADD JUDGE
    // =====================================================
    if (action === "addJudge") {
      const fullName = String(body.full_name || "").trim();
      const username = String(body.username || "").trim();
      const password = String(body.password || "");

      if (!fullName || !username || !password) {
        return Response.json({
          success: false,
          error: "Name, username, and password are required."
        }, { status: 400 });
      }

      const existing = await sql`
        SELECT id
        FROM users
        WHERE LOWER(username) = LOWER(${username})
        LIMIT 1
      `;

      if (existing.length) {
        return Response.json({
          success: false,
          error: "That username is already in use."
        }, { status: 409 });
      }

      await sql`
        INSERT INTO users (full_name, username, password, role)
        VALUES (${fullName}, ${username}, ${password}, 'judge')
      `;

      return Response.json({
        success: true,
        message: "Judge added successfully."
      }, { status: 201 });
    }

    // =====================================================
    // UPDATE JUDGE
    // =====================================================
    if (action === "updateJudge") {
      const id = Number(body.id);
      const fullName = String(body.full_name || "").trim();
      const username = String(body.username || "").trim();
      const password = String(body.password || "");

      if (!Number.isInteger(id) || id <= 0 || !fullName || !username) {
        return Response.json({
          success: false,
          error: "Valid ID, name, and username are required."
        }, { status: 400 });
      }

      const judge = await sql`
        SELECT id
        FROM users
        WHERE id = ${id}
          AND role = 'judge'
        LIMIT 1
      `;

      if (!judge.length) {
        return Response.json({
          success: false,
          error: "Judge not found."
        }, { status: 404 });
      }

      const duplicate = await sql`
        SELECT id
        FROM users
        WHERE LOWER(username) = LOWER(${username})
          AND id <> ${id}
        LIMIT 1
      `;

      if (duplicate.length) {
        return Response.json({
          success: false,
          error: "That username is already in use."
        }, { status: 409 });
      }

      if (password) {
        await sql`
          UPDATE users
          SET full_name = ${fullName},
              username = ${username},
              password = ${password}
          WHERE id = ${id}
            AND role = 'judge'
        `;
      } else {
        await sql`
          UPDATE users
          SET full_name = ${fullName},
              username = ${username}
          WHERE id = ${id}
            AND role = 'judge'
        `;
      }

      return Response.json({
        success: true,
        message: "Judge updated successfully."
      });
    }

    // =====================================================
    // DELETE JUDGE
    // =====================================================
    if (action === "deleteJudge") {
      const id = Number(body.id);

      if (!Number.isInteger(id) || id <= 0) {
        return Response.json({
          success: false,
          error: "A valid judge ID is required."
        }, { status: 400 });
      }

      const judge = await sql`
        SELECT id
        FROM users
        WHERE id = ${id}
          AND role = 'judge'
        LIMIT 1
      `;

      if (!judge.length) {
        return Response.json({
          success: false,
          error: "Judge not found."
        }, { status: 404 });
      }

      await sql`
        DELETE FROM competition_judges
        WHERE judge_id = ${id}
      `;

      await sql`
        DELETE FROM users
        WHERE id = ${id}
          AND role = 'judge'
      `;

      return Response.json({
        success: true,
        message: "Judge deleted successfully."
      });
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
    // SAVE COMPETITION JUDGES
    // Table: competition_judges
    // =====================================================
    if (action === "saveCompetitionJudges") {
      const competitionId = Number(body.competition_id);
      const selectedJudges = body.judges;

      if (!Number.isInteger(competitionId) || competitionId <= 0) {
        return Response.json({
          success: false,
          error: "A valid competition_id is required."
        }, { status: 400 });
      }

      if (!Array.isArray(selectedJudges)) {
        return Response.json({
          success: false,
          error: "judges must be an array of judge IDs."
        }, { status: 400 });
      }

      const judgeIds = [...new Set(
        selectedJudges.map(Number)
      )];

      if (judgeIds.some(
        id => !Number.isInteger(id) || id <= 0
      )) {
        return Response.json({
          success: false,
          error: "One or more judge IDs are invalid."
        }, { status: 400 });
      }

      // Confirm that the competition exists.
      const competition = await sql`
        SELECT id
        FROM competitions
        WHERE id = ${competitionId}
        LIMIT 1
      `;

      if (competition.length === 0) {
        return Response.json({
          success: false,
          error: "Competition not found."
        }, { status: 404 });
      }

      // Confirm that all selected users exist and are judges
      // or teachers, matching the existing getJudges action.
      if (judgeIds.length > 0) {
        const validJudges = await sql`
          SELECT id
          FROM users
          WHERE id = ANY(${judgeIds})
            AND role IN ('judge', 'teacher')
        `;

        if (validJudges.length !== judgeIds.length) {
          return Response.json({
            success: false,
            error: "One or more selected users are not valid judges."
          }, { status: 400 });
        }
      }

      // Replace the selected judges for this competition.
      // An empty array clears the current assignments.
      await sql`
        DELETE FROM competition_judges
        WHERE competition_id = ${competitionId}
      `;

      for (const judgeId of judgeIds) {
        await sql`
          INSERT INTO competition_judges
            (competition_id, judge_id)
          VALUES
            (${competitionId}, ${judgeId})
        `;
      }

      return Response.json({
        success: true,
        message: "Competition judges saved.",
        saved_count: judgeIds.length
      });
    }


    // =====================================================
    // SAVE COMPETITION STAGES
    // Table: competition_stages
    // =====================================================
    if (action === "saveStages") {
      const competitionId = Number(
        body.stages?.[0]?.competition_id
      );

      const stageData = body.stages;

      if (!Number.isInteger(competitionId) || competitionId <= 0) {
        return Response.json({
          success: false,
          error: "A valid competition_id is required."
        }, { status: 400 });
      }

      if (!Array.isArray(stageData) || stageData.length === 0) {
        return Response.json({
          success: false,
          error: "Provide at least one stage."
        }, { status: 400 });
      }

      // Validate the competition.
      const competition = await sql`
        SELECT id
        FROM competitions
        WHERE id = ${competitionId}
        LIMIT 1
      `;

      if (competition.length === 0) {
        return Response.json({
          success: false,
          error: "Competition not found."
        }, { status: 404 });
      }

      // Validate every stage before changing the database.
      const stageNumbers = new Set();

      for (const stage of stageData) {
        const stageCompetitionId = Number(stage.competition_id);
        const stageNumber = Number(stage.stage_number);
        const participantCount = Number(stage.participant_count);
        const qualifierCount = Number(stage.qualifier_count);

        if (
          stageCompetitionId !== competitionId ||
          !Number.isInteger(stageNumber) ||
          stageNumber < 1 ||
          stageNumbers.has(stageNumber) ||
          !Number.isInteger(participantCount) ||
          participantCount < 1 ||
          !Number.isInteger(qualifierCount) ||
          qualifierCount < 0 ||
          qualifierCount > participantCount
        ) {
          return Response.json({
            success: false,
            error:
              "Invalid stage data. Check stage numbers, participants, and qualifiers."
          }, { status: 400 });
        }

        if (
          !["top", "low", "random"].includes(
            String(stage.qualification_rule)
          )
        ) {
          return Response.json({
            success: false,
            error:
              "qualification_rule must be top, low, or random."
          }, { status: 400 });
        }

        stageNumbers.add(stageNumber);
      }

      // Save each stage. Update existing stages instead of
      // inserting duplicates; insert new stages when necessary.
      for (const stage of stageData) {
        const stageNumber = Number(stage.stage_number);
        const participantCount = Number(stage.participant_count);
        const qualifierCount = Number(stage.qualifier_count);
        const stageName =
          String(stage.stage_name || `Stage ${stageNumber}`).trim();

        const qualificationRule =
          String(stage.qualification_rule);

        const status =
          String(stage.status) === "active" ? "active" : "inactive";

        // Keep existing round settings, or use defaults for new stages.
        const existing = await sql`
          SELECT id, total_rounds, words_per_round
          FROM competition_stages
          WHERE competition_id = ${competitionId}
            AND stage_number = ${stageNumber}
          LIMIT 1
        `;

        if (existing.length > 0) {
          const current = existing[0];
          const rounds = Number(current.total_rounds) || 3;
          const wordsPerRound = Number(current.words_per_round) || 3;

          await sql`
            UPDATE competition_stages
            SET
              stage_name = ${stageName},
              participant_count = ${participantCount},
              qualification_rule = ${qualificationRule},
              qualifier_count = ${qualifierCount},
              top_qualifiers = ${qualifierCount},
              total_rounds = ${rounds},
              words_per_round = ${wordsPerRound},
              total_words = ${rounds * wordsPerRound},
              status = ${status}
            WHERE id = ${current.id}
          `;
        } else {
          const rounds = 3;
          const wordsPerRound = 3;

          await sql`
            INSERT INTO competition_stages (
              competition_id,
              stage_number,
              stage_name,
              participant_count,
              qualification_rule,
              qualifier_count,
              top_qualifiers,
              judge_count,
              total_rounds,
              words_per_round,
              total_words,
              status
            )
            VALUES (
              ${competitionId},
              ${stageNumber},
              ${stageName},
              ${participantCount},
              ${qualificationRule},
              ${qualifierCount},
              ${qualifierCount},
              0,
              ${rounds},
              ${wordsPerRound},
              ${rounds * wordsPerRound},
              ${status}
            )
          `;
        }
      }

      return Response.json({
        success: true,
        message: "Competition stages saved.",
        saved_count: stageData.length
      });
    }


    // =====================================================
    // ACTIVATE STAGE - LIMITED TO ITS OWN COMPETITION
    // =====================================================
    if (action === "activateStage") {
      const stageId = Number(body.stage_id);

      if (!Number.isInteger(stageId) || stageId <= 0) {
        return Response.json({
          success: false,
          error: "A valid stage_id is required."
        }, { status: 400 });
      }

      const selected = await sql`
        SELECT *
        FROM competition_stages
        WHERE id = ${stageId}
        LIMIT 1
      `;

      if (selected.length === 0) {
        return Response.json({
          success: false,
          error: "Stage not found."
        }, { status: 404 });
      }

      const stage = selected[0];

      // Deactivate stages only in this competition.
      await sql`
        UPDATE competition_stages
        SET status = 'inactive'
        WHERE competition_id = ${stage.competition_id}
      `;

      // Activate the selected stage.
      await sql`
        UPDATE competition_stages
        SET status = 'active'
        WHERE id = ${stageId}
      `;

      // Initialize stage 1 for students in this competition.
      // Do not automatically reactivate eliminated students
      // in later stages.
      if (Number(stage.stage_number) === 1) {
        const students = await sql`
          SELECT id
          FROM students
          WHERE competition_id = ${stage.competition_id}
        `;

        for (const student of students) {
          await sql`
            INSERT INTO student_stage_progress (
              student_id,
              competition_id,
              stage_number,
              status
            )
            VALUES (
              ${student.id},
              ${stage.competition_id},
              ${stage.stage_number},
              'active'
            )
            ON CONFLICT DO NOTHING
          `;
        }
      }

      return Response.json({
        success: true,
        message: "Stage activated successfully.",
        stage_id: stageId,
        competition_id: stage.competition_id,
        stage_number: stage.stage_number
      });
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
    // STUDENT MANAGEMENT
    // Actions: getStudents, addStudent, updateStudent, deleteStudent
    // =====================================================

    // -----------------------------------------------------
    // GET STUDENTS ASSIGNED TO A COMPETITION STAGE
    // -----------------------------------------------------
    if (action === "getStudents") {
      const competitionId = Number(body.competition_id);
      const stageNumber = Number(body.stage_number);

      if (
        !Number.isInteger(competitionId) || competitionId <= 0 ||
        !Number.isInteger(stageNumber) || stageNumber <= 0
      ) {
        return Response.json({
          success: false,
          error: "A valid competition_id and stage_number are required."
        }, { status: 400 });
      }

      const students = await sql`
        SELECT
          s.*,
          sp.stage_number,
          sp.status AS stage_status
        FROM student_stage_progress sp
        JOIN students s
          ON s.id = sp.student_id
        WHERE sp.competition_id = ${competitionId}
          AND sp.stage_number = ${stageNumber}
          AND sp.status = 'active'
        ORDER BY s.full_name ASC
      `;

      return Response.json({
        success: true,
        students
      });
    }

    // -----------------------------------------------------
    // ADD STUDENT AND ASSIGN TO SELECTED STAGE
    // -----------------------------------------------------
    if (action === "addStudent") {
      const fullName = String(body.full_name || "").trim();
      const gender = String(body.gender || "").trim();
      const className = String(body.class_name || "").trim();
      const competitionId = Number(body.competition_id);
      const stageNumber = Number(body.stage_number);

      if (!fullName || !gender || !className) {
        return Response.json({
          success: false,
          error: "Student name, gender, and class are required."
        }, { status: 400 });
      }

      if (
        !Number.isInteger(competitionId) || competitionId <= 0 ||
        !Number.isInteger(stageNumber) || stageNumber <= 0
      ) {
        return Response.json({
          success: false,
          error: "A valid competition and stage are required."
        }, { status: 400 });
      }

      // Confirm that the selected competition exists.
      const competition = await sql`
        SELECT id
        FROM competitions
        WHERE id = ${competitionId}
        LIMIT 1
      `;

      if (competition.length === 0) {
        return Response.json({
          success: false,
          error: "Competition not found."
        }, { status: 404 });
      }

      // Confirm that the selected stage belongs to this competition.
      const stage = await sql`
        SELECT id, stage_number
        FROM competition_stages
        WHERE competition_id = ${competitionId}
          AND stage_number = ${stageNumber}
        LIMIT 1
      `;

      if (stage.length === 0) {
        return Response.json({
          success: false,
          error: "The selected stage was not found in this competition."
        }, { status: 404 });
      }

      // Prevent the same name being added twice to this competition.
      const existing = await sql`
        SELECT id
        FROM students
        WHERE competition_id = ${competitionId}
          AND LOWER(TRIM(full_name)) = LOWER(${fullName})
        LIMIT 1
      `;

      if (existing.length > 0) {
        return Response.json({
          success: false,
          error: "A student with this name already exists in this competition."
        }, { status: 409 });
      }

      // Save the student.
      const inserted = await sql`
        INSERT INTO students (
          full_name,
          gender,
          class_name,
          competition_id
        )
        VALUES (
          ${fullName},
          ${gender},
          ${className},
          ${competitionId}
        )
        RETURNING *
      `;

      const student = inserted[0];

      // Assign the student to the selected stage as active.
      await sql`
        INSERT INTO student_stage_progress (
          student_id,
          competition_id,
          stage_number,
          status
        )
        VALUES (
          ${student.id},
          ${competitionId},
          ${stageNumber},
          'active'
        )
        ON CONFLICT DO NOTHING
      `;

      return Response.json({
        success: true,
        message: "Student added and assigned to the selected stage.",
        student
      }, { status: 201 });
    }

    // -----------------------------------------------------
    // UPDATE STUDENT DETAILS
    // -----------------------------------------------------
    if (action === "updateStudent") {
      const studentId = Number(body.id);
      const fullName = String(body.full_name || "").trim();
      const gender = String(body.gender || "").trim();
      const className = String(body.class_name || "").trim();

      if (!Number.isInteger(studentId) || studentId <= 0) {
        return Response.json({
          success: false,
          error: "A valid student ID is required."
        }, { status: 400 });
      }

      if (!fullName || !gender || !className) {
        return Response.json({
          success: false,
          error: "Student name, gender, and class are required."
        }, { status: 400 });
      }

      const updated = await sql`
        UPDATE students
        SET
          full_name = ${fullName},
          gender = ${gender},
          class_name = ${className}
        WHERE id = ${studentId}
        RETURNING *
      `;

      if (updated.length === 0) {
        return Response.json({
          success: false,
          error: "Student not found."
        }, { status: 404 });
      }

      return Response.json({
        success: true,
        message: "Student updated successfully.",
        student: updated[0]
      });
    }

    // -----------------------------------------------------
    // DELETE STUDENT
    // -----------------------------------------------------
    if (action === "deleteStudent") {
      const studentId = Number(body.id);

      if (!Number.isInteger(studentId) || studentId <= 0) {
        return Response.json({
          success: false,
          error: "A valid student ID is required."
        }, { status: 400 });
      }

      const found = await sql`
        SELECT id
        FROM students
        WHERE id = ${studentId}
        LIMIT 1
      `;

      if (found.length === 0) {
        return Response.json({
          success: false,
          error: "Student not found."
        }, { status: 404 });
      }

      // Remove stage assignments and draw assignments first.
      await sql`
        DELETE FROM student_stage_progress
        WHERE student_id = ${studentId}
      `;

      await sql`
        DELETE FROM student_draws
        WHERE student_id = ${studentId}
      `;

      // Preserve word-attempt and judging history.
      // If foreign keys prevent deletion, the database will
      // return an error rather than silently deleting history.
      await sql`
        DELETE FROM students
        WHERE id = ${studentId}
      `;

      return Response.json({
        success: true,
        message: "Student deleted successfully."
      });
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

await broadcastCompetition(context, body.competition_id, { action: "updateState" });

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

let resetCompetitionId = body.competition_id;
if (!resetCompetitionId) {
  const activeForReset = await sql`
    SELECT id FROM competitions
    WHERE status='active'
    ORDER BY id DESC
    LIMIT 1
  `;
  resetCompetitionId = activeForReset[0]?.id;
}
await broadcastCompetition(context, resetCompetitionId, { action: "resetState" });

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

await broadcastCompetition(context, body.competition_id, {
  action: "saveJudgeVote",
  student_id: body.student_id,
  round_number: body.round_number,
  word: body.word
});

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

await broadcastCompetition(context, body.competition_id, { action: "openVoting" });

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

await broadcastCompetition(context, body.competition_id, { action: "closeVoting" });

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

 // =====================================================
 // GET COMPETITION REALTIME
 // =====================================================
if (action === "getCompetitionRealtime") {
  try {
    if (!body.competition_id) {
      return Response.json(
        { success: false, message: "competition_id is required" },
        { status: 400 }
      );
    }

    // 1. GET SAVED COMPETITION STATE
    const stateRes = await sql`
      SELECT *
      FROM competition_state
      WHERE competition_id = ${body.competition_id}
      LIMIT 1
    `;

    if (stateRes.length === 0) {
      return Response.json({
        success: false,
        message: "Competition state not found"
      });
    }

    const state = stateRes[0];

    // 2. GET THE ACTIVE STAGE
    const stageRes = await sql`
      SELECT *
      FROM competition_stages
      WHERE competition_id = ${body.competition_id}
        AND status = 'active'
      LIMIT 1
    `;

    if (stageRes.length === 0) {
      return Response.json({
        success: false,
        message: "No active stage found"
      });
    }

    const stage = stageRes[0];
    const stageNumber = Number(stage.stage_number);

    // 3. USE THE SAME ACTIVE STUDENT LIST AS THE TEACHER
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
        AND sp.stage_number = ${stageNumber}
        AND sp.status = 'active'
      ORDER BY d.draw_order ASC
    `;

    const studentIndex =
      Math.max(0, Number(state.current_student_index) || 0);

    const student = students[studentIndex] || null;

    
    // 4. LOAD WORDS USING THE SAME GROUP LOGIC AS THE TEACHER
    let words = [];

    if (student?.group_number != null) {
      const wordsRes = await sql`
        SELECT w.word
        FROM words w
        JOIN word_groups g
          ON g.id = w.group_id
        WHERE g.group_number = ${student.group_number}
          AND g.competition_id = ${body.competition_id}
          AND g.stage_number = ${stageNumber}
        ORDER BY w.id ASC
      `;

      words = wordsRes.map(item => item.word);
    }


    // 5. CALCULATE THE CURRENT WORD
    const round = Math.max(
      1,
      Number(state.current_round) || 1
    );

    const wordPosition = Math.max(
      0,
      Number(state.current_word_index) || 0
    );

    const wordsPerRound = Math.max(
      1,
      Number(stage.words_per_round) || 3
    );

    const globalWordIndex =
      ((round - 1) * wordsPerRound) + wordPosition;

    const currentWord =
      words[globalWordIndex] || "FINISHED";

    // 6. GET VOTES FOR THE CURRENT WORD
    let voteCount = 0;
    let myVote = null;

    if (student && currentWord !== "FINISHED") {
      const votes = await sql`
        SELECT COUNT(*)::int AS total
        FROM judge_votes
        WHERE competition_id = ${body.competition_id}
          AND stage_number = ${stageNumber}
          AND student_id = ${student.id}
          AND round_number = ${round}
          AND word = ${currentWord}
      `;

      voteCount = votes[0]?.total || 0;

      // 7. GET THIS JUDGE'S VOTE, IF PROVIDED
      if (body.judge_id) {
        const ownVote = await sql`
          SELECT vote, created_at
          FROM judge_votes
          WHERE competition_id = ${body.competition_id}
            AND stage_number = ${stageNumber}
            AND student_id = ${student.id}
            AND round_number = ${round}
            AND word = ${currentWord}
            AND judge_id = ${body.judge_id}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        myVote = ownVote[0] || null;
      }
    }

    // 8. RETURN SYNCHRONIZED DATA
    return Response.json({
      success: true,
      stage_number: stageNumber,
      total_rounds: Number(stage.total_rounds) || 3,
      words_per_round: wordsPerRound,

      student,
      student_id: student?.id || null,
      student_index: studentIndex,

      round,
      current_round: round,

      word: currentWord,
      current_word: currentWord,
      word_index: globalWordIndex,
      current_word_index: wordPosition,

      time_left: Number(state.time_left) || 0,
      started: Boolean(state.started),

      vote_count: voteCount,
      my_vote: myVote
    });

  } catch (error) {
    console.error("getCompetitionRealtime error:", error);

    return Response.json(
      {
        success: false,
        message: "Could not load competition state"
      },
      { status: 500 }
    );
  }
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
    if(action === "getWordsByGroupId"){

const words = await sql`

SELECT w.word

FROM words w

JOIN word_groups g
ON g.id = w.group_id

WHERE g.id=${body.group_id}

AND g.competition_id=${body.competition_id}

AND g.stage_number=${body.stage_number}

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

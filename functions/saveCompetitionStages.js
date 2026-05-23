const sql = require("./spellingDb");

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    const stages = data.stages;

    if (!stages || stages.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "No stages provided"
        })
      };
    }

    const competitionId = stages[0].competition_id;

    // delete old stages safely
    await sql`
      DELETE FROM competition_stages
      WHERE competition_id = ${competitionId}
    `;

    // insert new stages
    for (let stage of stages) {
      const totalRounds = stage.total_rounds || 3;
      const wordsPerRound = stage.words_per_round || 3;

      await sql`
        INSERT INTO competition_stages(
          competition_id,
          stage_number,
          participant_count,
          stage_name,
          status,
          qualification_rule,
          qualifier_count,
          total_rounds,
          words_per_round,
          total_words
        )
        VALUES(
          ${stage.competition_id},
          ${stage.stage_number},
          ${stage.participant_count},
          ${stage.stage_name},
          ${stage.status},
          ${stage.qualification_rule},
          ${stage.qualifier_count},
          ${totalRounds},
          ${wordsPerRound},
          ${totalRounds * wordsPerRound}
        )
      `;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

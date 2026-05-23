const db = require("./db");

exports.handler = async (event) => {

  try {

    const class_id =
      event.queryStringParameters?.class_id;

    // =========================
    // CURRENT ACADEMIC YEAR
    // =========================
    const currentYearRes = await db.query(
      `SELECT *
       FROM academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    const currentYear =
      currentYearRes.rows[0];

    if (!currentYear) {

      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "No active academic year"
        })
      };
    }

    let result;

    // =========================
    // FILTER BY CLASS
    // =========================
    if (class_id) {

      result = await db.query(
        `SELECT *
         FROM learners
         WHERE class_id = $1
         AND academic_year_id = $2
         ORDER BY id ASC`,
        [
          class_id,
          currentYear.id
        ]
      );

    }

    // =========================
    // ALL LEARNERS
    // =========================
    else {

      result = await db.query(
        `SELECT *
         FROM learners
         WHERE academic_year_id = $1
         ORDER BY id ASC`,
        [currentYear.id]
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };

  }

  // =========================
  // ERROR
  // =========================
  catch (error) {

    console.log(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};

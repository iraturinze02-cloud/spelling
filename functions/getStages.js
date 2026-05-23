const sql = require("./spellingDb");

exports.handler = async (event) => {
  try {

    
    const competition_id = parseInt(
      event.queryStringParameters?.competition_id
    );

    if (!competition_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "competition_id required" })
      };
    }

    const stages = await sql`
      SELECT *
      FROM competition_stages
      WHERE competition_id = ${competition_id}
      ORDER BY stage_number ASC
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ stages })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

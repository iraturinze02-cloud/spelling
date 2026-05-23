const pool = require("./spellingDb");

exports.handler = async (event) => {

try {

if (!event.body) {
return {
statusCode: 400,
body: JSON.stringify({
message: "Missing request body"
})
};
}

const body = JSON.parse(event.body || "{}");

const competitionId = body.competition_id;

if (!competitionId) {
return {
statusCode: 400,
body: JSON.stringify({
message: "competition_id is required"
})
};
}

/* deactivate active competitions */
await pool.query(`
UPDATE competitions
SET status = 'inactive'
WHERE status = 'active'
`);

/* activate selected */
const result = await pool.query(`
UPDATE competitions
SET status = 'active'
WHERE id = $1
RETURNING *
`, [competitionId]);

return {
statusCode: 200,
body: JSON.stringify({
message: "Competition activated",
competition: result.rows[0]
})
};

} catch (error) {

return {
statusCode: 500,
body: JSON.stringify({
message: error.message
})
};

}

};

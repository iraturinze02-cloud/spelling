const sql = require("./spellingDb");

exports.handler = async (event) => {

try {

const competition_id = event.queryStringParameters?.competition_id;
const stage_number = event.queryStringParameters?.stage_number;

if (!competition_id || !stage_number) {
return {
statusCode: 400,
body: JSON.stringify({
success: false,
message: "competition_id and stage_number required"
})
};
}

const students = await sql`

SELECT *
FROM students
WHERE competition_id = ${competition_id}
AND stage_number = ${stage_number}
AND status = 'active'
ORDER BY full_name ASC

`;

return {
statusCode: 200,
body: JSON.stringify({
success: true,
students
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

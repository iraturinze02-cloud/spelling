const sql = require("./spellingDb");

exports.handler = async () => {

try {

const result = await sql`
SELECT *
FROM competitions
ORDER BY id DESC
`;

return {
statusCode: 200,
body: JSON.stringify({
competitions: result
})
};

} catch (error) {

console.log(error);

return {
statusCode: 500,
body: JSON.stringify({
error: error.message
})
};

}

};

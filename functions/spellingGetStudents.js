const sql = require("./spellingDb");

exports.handler = async () => {

try{

const students = await sql`

SELECT *
FROM students
ORDER BY full_name ASC

`;

return{

statusCode:200,

body:JSON.stringify({
success:true,
students
})

};

}

catch(error){

return{

statusCode:500,

body:JSON.stringify({
success:false,
error:error.message
})

};

}

};

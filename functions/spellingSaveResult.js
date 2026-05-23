const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const data=
JSON.parse(event.body);

const result=
await sql`

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

${data.student_id},
${data.competition_id || null},
${data.round_number},
${data.word},
${data.learner_answer},
${data.score},
${data.time_allowed},
${data.time_used},
${data.status}

)

RETURNING *

`;

return{

statusCode:200,

body:JSON.stringify({
success:true,
result
})

};

}

catch(error){

return{

statusCode:500,

body:JSON.stringify({
error:error.message
})

};

}

};

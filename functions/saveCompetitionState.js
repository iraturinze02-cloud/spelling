const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(event.body);

await sql(
`
UPDATE competition_state
SET
current_student_index=$1,
current_round=$2,
current_word_index=$3,
time_left=$4,
started=$5,
score=$6,
participant_done=$7,
stage_number=$8
WHERE competition_id=$9
`,
[
body.currentStudent,
body.round,
body.currentWordIndex,
body.timeLeft,
body.started,
body.score,
body.participant_done,
body.stage_number,
body.competition_id
]
);

return{
statusCode:200,
body:JSON.stringify({message:"saved"})
};

}
catch(error){

return{
statusCode:500,
body:JSON.stringify({message:error.message})
};

}

};

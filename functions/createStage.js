const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=JSON.parse(event.body);

await sql.query(
`
INSERT INTO competition_stages
(competition_id, stage_number, stage_name, participant_count,
 total_rounds, words_per_round, top_qualifiers, judge_count, status)

VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
`,
[
body.competition_id,
body.stage_number,
body.stage_name,
body.participant_count,
body.total_rounds,
body.words_per_round,
body.top_qualifiers,
body.judge_count,
body.status
]
);

return{
statusCode:200,
body:JSON.stringify({
message:"Stage created successfully"
})
};

}
catch(error){

return{
statusCode:500,
body:JSON.stringify({
message:error.message
})
};

}

};

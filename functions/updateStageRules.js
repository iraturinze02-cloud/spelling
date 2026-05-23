const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const data=
JSON.parse(
event.body
);

await sql`

UPDATE competition_stages

SET

total_rounds=
${data.total_rounds},

words_per_round=
${data.words_per_round},

total_words=
${data.total_words}

WHERE

competition_id=
${data.competition_id}

AND

stage_number=
${data.stage_number}

`;

return{

statusCode:200,

body:JSON.stringify({

success:true

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

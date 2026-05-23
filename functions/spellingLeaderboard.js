const sql=require("./spellingDb");

exports.handler=async()=>{

try{

const leaderboard=
await sql`

SELECT

s.full_name,
s.class_name,

COALESCE(
SUM(w.score),
0
)
AS total_score

FROM students s

LEFT JOIN word_attempts w

ON s.id=
w.student_id

GROUP BY
s.id,
s.full_name,
s.class_name

ORDER BY
total_score DESC

`;

return{

statusCode:200,

body:JSON.stringify({

success:true,
leaderboard

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

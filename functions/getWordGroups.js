const sql=require("./spellingDb");

exports.handler=async()=>{

try{

const groups=
await sql`

SELECT

g.id,
g.group_number,

json_agg(

w.word

)

AS words

FROM word_groups g

LEFT JOIN words w

ON g.id=w.group_id

GROUP BY

g.id

ORDER BY

g.group_number

`;

return{

statusCode:200,

body:JSON.stringify({

success:true,
groups

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

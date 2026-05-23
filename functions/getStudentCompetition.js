const sql=require("./spellingDb");

exports.handler=async()=>{

try{

const students=
await sql`

SELECT

s.id,
s.full_name,

d.draw_order,

g.group_number

FROM students s

LEFT JOIN student_draws d

ON s.id=d.student_id

LEFT JOIN word_groups g

ON d.group_id=g.id

ORDER BY d.draw_order

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

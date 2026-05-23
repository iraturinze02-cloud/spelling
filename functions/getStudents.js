import pkg from "pg";
const { Client } = pkg;

export async function handler(event) {
    try {

        const { school_name, class_name, role } = event.queryStringParameters || {};

        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();

        let query = `
            SELECT
                id,
                student_name,
                school_name,
                class_name,

                english,
                mathematics,
                kinyarwanda,
                social_studies,
                science,
                chemistry,
                physics,
                biology,
                geography,
                history,
                entrepreneurship,

                total,
                percentage,
                position

            FROM students
            WHERE 1=1
        `;

        let params = [];

        // ONLY school_admin should be restricted by school
        if (role === "school_admin") {

            if (!school_name) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        message: "school_name is required"
                    })
                };
            }

            params.push(school_name);
            query += ` AND school_name = $${params.length}`;
        }

        if (class_name) {
            params.push(class_name);
            query += ` AND class_name = $${params.length}`;
        }

        query += " ORDER BY position ASC NULLS LAST, total DESC";

        const result = await client.query(query, params);

        await client.end();

        return {
            statusCode: 200,
            body: JSON.stringify(result.rows)
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: err.message
            })
        };
    }
            }

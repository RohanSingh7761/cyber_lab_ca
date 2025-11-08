const axios = require('axios');

const HASURA_ENDPOINT = process.env.HASURA_ENDPOINT;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

async function executeQuery(query, variables = {}) {
    try {
        const response = await axios.post(
            HASURA_ENDPOINT,
            {
                query,
                variables
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                }
            }
        );

        if (response.data.errors) {
            console.error('Hasura errors:', response.data.errors);
            throw new Error(response.data.errors[0].message);
        }

        return response.data.data;
    } catch (error) {
        console.error('Hasura query failed:', error.message);
        throw error;
    }
}

module.exports = { executeQuery };

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

console.log('HASURA_ENDPOINT:', process.env.HASURA_ENDPOINT);
console.log('HASURA_ADMIN_SECRET exists:', !!process.env.HASURA_ADMIN_SECRET);

/**
 * Send a GraphQL request to Hasura
 * @param {string} query - GraphQL query or mutation
 * @param {object} variables - Variables for the GraphQL query
 * @returns {Promise} - Axios response
 */
export async function sendGraphQLRequest(query, variables = {}) {
  try {
    const response = await axios.post(
      process.env.HASURA_ENDPOINT,
      {
        query,
        variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending GraphQL request:', error.response?.data || error.message);
    throw error;
  }
}

const axios = require('axios');

/**
 * Railway Environment Variable Updater
 * 
 * This utility provides a helper function to update Railway environment variables
 * using the Railway Public API. Specifically designed to update the SPREAKER_REFRESH_TOKEN
 * but can be used for any environment variable.
 * 
 * Prerequisites:
 * - Railway API token with appropriate permissions
 * - Project ID and environment ID from Railway dashboard
 * - axios package installed (npm install axios)
 * 
 * Usage Example:
 * ```javascript
 * const { updateRailwayEnvVar } = require('./utils/railway-env-updater');
 * 
 * async function updateToken() {
 *   try {
 *     await updateRailwayEnvVar({
 *       apiToken: 'your-railway-api-token',
 *       projectId: 'your-project-id',
 *       environmentId: 'your-environment-id',
 *       variableName: 'SPREAKER_REFRESH_TOKEN',
 *       variableValue: 'new-refresh-token-value'
 *     });
 *     console.log('Environment variable updated successfully');
 *   } catch (error) {
 *     console.error('Failed to update environment variable:', error.message);
 *   }
 * }
 * ```
 */

/**
 * Updates a Railway environment variable using the Railway Public API
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.apiToken - Railway API token (required)
 * @param {string} config.projectId - Railway project ID (required)
 * @param {string} config.environmentId - Railway environment ID (required)
 * @param {string} config.variableName - Name of the environment variable to update (required)
 * @param {string} config.variableValue - New value for the environment variable (required)
 * @param {string} [config.baseUrl='https://backboard.railway.app'] - Railway API base URL (optional)
 * 
 * @returns {Promise<Object>} Promise that resolves to the API response data
 * @throws {Error} Throws error if API request fails or required parameters are missing
 */
async function updateRailwayEnvVar({
  apiToken,
  projectId,
  environmentId,
  variableName,
  variableValue,
  baseUrl = 'https://backboard.railway.app'
}) {
  // Validate required parameters
  if (!apiToken) {
    throw new Error('Railway API token is required');
  }
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!environmentId) {
    throw new Error('Environment ID is required');
  }
  if (!variableName) {
    throw new Error('Variable name is required');
  }
  if (!variableValue) {
    throw new Error('Variable value is required');
  }

  try {
    // GraphQL mutation to update environment variable
    const mutation = `
      mutation variableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input) {
          id
          name
          value
        }
      }
    `;

    const variables = {
      input: {
        projectId,
        environmentId,
        name: variableName,
        value: variableValue
      }
    };

    // Make the API request
    const response = await axios.post(
      `${baseUrl}/graphql/v2`,
      {
        query: mutation,
        variables
      },
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Check for GraphQL errors
    if (response.data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    // Return the updated variable data
    return response.data.data.variableUpsert;
    
  } catch (error) {
    // Enhanced error handling
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new Error(
        `Railway API error (${error.response.status}): ${
          error.response.data?.message || error.response.statusText
        }`
      );
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response received from Railway API. Check your network connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
}

/**
 * Convenience function specifically for updating the SPREAKER_REFRESH_TOKEN
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.apiToken - Railway API token (required)
 * @param {string} config.projectId - Railway project ID (required)
 * @param {string} config.environmentId - Railway environment ID (required)
 * @param {string} config.refreshToken - New refresh token value (required)
 * 
 * @returns {Promise<Object>} Promise that resolves to the API response data
 */
async function updateSpeakerRefreshToken({
  apiToken,
  projectId,
  environmentId,
  refreshToken
}) {
  return updateRailwayEnvVar({
    apiToken,
    projectId,
    environmentId,
    variableName: 'SPREAKER_REFRESH_TOKEN',
    variableValue: refreshToken
  });
}

/**
 * Gets Railway project and environment information
 * Useful for finding the correct IDs to use with the update functions
 * 
 * @param {string} apiToken - Railway API token
 * @returns {Promise<Object>} Promise that resolves to projects and environments data
 */
async function getRailwayProjectInfo(apiToken) {
  if (!apiToken) {
    throw new Error('Railway API token is required');
  }

  try {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              environments {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      'https://backboard.railway.app/graphql/v2',
      { query },
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data.projects.edges.map(edge => ({
      id: edge.node.id,
      name: edge.node.name,
      environments: edge.node.environments.edges.map(env => ({
        id: env.node.id,
        name: env.node.name
      }))
    }));
    
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Railway API error (${error.response.status}): ${
          error.response.data?.message || error.response.statusText
        }`
      );
    } else {
      throw new Error(`Failed to get project info: ${error.message}`);
    }
  }
}

module.exports = {
  updateRailwayEnvVar,
  updateSpeakerRefreshToken,
  getRailwayProjectInfo
};

/**
 * Additional Notes:
 * 
 * 1. API Token: Get your Railway API token from https://railway.app/account/tokens
 * 
 * 2. Project ID: Found in the Railway dashboard URL or via getRailwayProjectInfo()
 * 
 * 3. Environment ID: Usually 'production' or 'development', get exact ID via getRailwayProjectInfo()
 * 
 * 4. Rate Limiting: Railway API has rate limits, implement exponential backoff for production use
 * 
 * 5. Security: Store API tokens securely (environment variables, not in code)
 * 
 * 6. Error Handling: The functions provide detailed error messages for debugging
 * 
 * 7. Dependencies: Ensure axios is installed: npm install axios
 */

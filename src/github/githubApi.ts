import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

/**
 * GitHub API client for Copilot agent integration
 */
export class GitHubApi {
  private static instance: GitHubApi;
  private axiosInstance: AxiosInstance;
  private session: vscode.AuthenticationSession | undefined;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github+json'
        // Using default GitHub API version (latest stable)
        // API versioning with specific dates can cause compatibility issues
      }
    });

    this.setupInterceptors();
  }

  public static getInstance(): GitHubApi {
    if (!GitHubApi.instance) {
      GitHubApi.instance = new GitHubApi();
    }
    return GitHubApi.instance;
  }

  /**
   * Ensure GitHub authentication is available
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.session) {
      return;
    }

    try {
      // Request GitHub authentication with required scopes
      // 'repo' - for creating issues and PRs
      // 'write:org' - for assigning issues to bots like Copilot
      this.session = await vscode.authentication.getSession('github', ['repo', 'write:org'], { createIfNone: true });
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      throw new Error('Failed to authenticate with GitHub. Please try again.');
    }
  }

  /**
   * Setup axios interceptors for authentication
   */
  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        await this.ensureAuthenticated();
        if (this.session) {
          config.headers.Authorization = `Bearer ${this.session.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Check if GitHub authentication is available
   */
  public async isConfigured(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      return !!this.session;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sign out from GitHub
   */
  public async signOut(): Promise<void> {
    this.session = undefined;
  }

  /**
   * Get the authenticated user
   */
  public async getAuthenticatedUser(): Promise<{ login: string; name: string; email: string }> {
    try {
      const response = await this.axiosInstance.get('/user');
      return {
        login: response.data.login,
        name: response.data.name || response.data.login,
        email: response.data.email || ''
      };
    } catch (error) {
      console.error('Error fetching authenticated user:', error);
      throw new Error('Failed to fetch GitHub user. Please check your token.');
    }
  }

  /**
   * Get organizations for the authenticated user
   */
  public async getOrganizations(): Promise<Array<{ login: string; id: number; description: string }>> {
    try {
      const response = await this.axiosInstance.get('/user/orgs');
      return response.data.map((org: any) => ({
        login: org.login,
        id: org.id,
        description: org.description || ''
      }));
    } catch (error) {
      console.error('Error fetching organizations:', error);
      throw new Error('Failed to fetch GitHub organizations');
    }
  }

  /**
   * Get repositories for an organization or user
   */
  public async getRepositories(ownerLogin: string): Promise<Array<{ name: string; full_name: string; description: string }>> {
    try {
      // Try to fetch from organization first
      let response;
      try {
        response = await this.axiosInstance.get(`/orgs/${ownerLogin}/repos`, {
          params: { per_page: 100, sort: 'updated' }
        });
      } catch (orgError) {
        // If organization fetch fails, try user repos
        response = await this.axiosInstance.get(`/users/${ownerLogin}/repos`, {
          params: { per_page: 100, sort: 'updated' }
        });
      }

      return response.data.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || ''
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw new Error(`Failed to fetch repositories for ${ownerLogin}`);
    }
  }

  /**
   * Test if Copilot is available in a repository (for debugging)
   */
  public async testCopilotAvailability(owner: string, repo: string): Promise<{ available: boolean; botLogin?: string; message: string }> {
    try {
      const copilotBotId = await this.getCopilotBotId(owner, repo);

      if (copilotBotId) {
        const query = `
          query GetCopilotBotId($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
              suggestedActors {
                login
              }
            }
          }
        `;
        const response = await this.axiosInstance.post('/graphql', {
          query,
          variables: { owner, repo }
        });
        const suggestedActors = response.data.data?.repository?.suggestedActors || [];
        const copilotBot = suggestedActors.find((actor: any) =>
          actor.login?.toLowerCase().includes('copilot')
        );

        return {
          available: true,
          botLogin: copilotBot?.login,
          message: `✅ Copilot is available in ${owner}/${repo} as "${copilotBot?.login}"`
        };
      } else {
        return {
          available: false,
          message: `❌ Copilot is NOT available in ${owner}/${repo}. You need Copilot Enterprise or Copilot Pro+ subscription.`
        };
      }
    } catch (error: any) {
      return {
        available: false,
        message: `⚠️ Could not check Copilot availability: ${error.message}`
      };
    }
  }

  /**
   * Get the authenticated user's repositories
   */
  public async getUserRepositories(): Promise<Array<{ name: string; full_name: string; description: string }>> {
    try {
      const response = await this.axiosInstance.get('/user/repos', {
        params: { per_page: 100, sort: 'updated', affiliation: 'owner,collaborator' }
      });

      return response.data.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || ''
      }));
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      throw new Error('Failed to fetch your repositories');
    }
  }

  /**
   * Create a GitHub issue with the implementation plan
   */
  public async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<{ number: number; html_url: string }> {
    try {
      const response = await this.axiosInstance.post(`/repos/${owner}/${repo}/issues`, {
        title,
        body,
        labels: labels || ['copilot-agent', 'implementation-plan']
      });

      return {
        number: response.data.number,
        html_url: response.data.html_url
      };
    } catch (error: any) {
      console.error('Error creating GitHub issue:', error);
      console.error('Repository:', `${owner}/${repo}`);
      console.error('Status:', error.response?.status);
      console.error('Response data:', error.response?.data);

      if (error.response?.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or you don't have access`);
      } else if (error.response?.status === 403) {
        throw new Error('Permission denied. Please check your GitHub token has the required scopes');
      } else if (error.response?.status === 410) {
        // Check if the repository is archived
        try {
          const repoResponse = await this.axiosInstance.get(`/repos/${owner}/${repo}`);
          if (repoResponse.data.archived) {
            throw new Error(`Repository ${owner}/${repo} is archived. Cannot create issues in archived repositories. Please unarchive it or choose a different repository.`);
          }
        } catch (repoError) {
          console.error('Error checking repository status:', repoError);
        }
        throw new Error(`Repository ${owner}/${repo} may be archived or issue creation is disabled. Please check repository settings.`);
      }
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  /**
   * Try to assign using REST API with username
   */
  private async assignUsingRestApi(owner: string, repo: string, issueNumber: number, username: string): Promise<boolean> {
    try {
      console.log(`[Copilot Assignment] Trying REST API with username: ${username}`);

      await this.axiosInstance.post(
        `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
        { assignees: [username] }
      );

      console.log(`[Copilot Assignment] Successfully assigned via REST API`);
      return true;
    } catch (error: any) {
      console.error(`[Copilot Assignment] REST API failed:`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Get Copilot bot ID for a repository using GraphQL API
   * Based on: https://github.com/orgs/community/discussions/164267
   */
  private async getCopilotBotId(owner: string, repo: string): Promise<string | null> {
    try {
      // Use the exact query format from the GitHub community discussion
      const query = `
        query GetCopilotBot($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            suggestedActors(loginNames: "copilot", capabilities: [CAN_BE_ASSIGNED], first: 100) {
              nodes {
                login
                ... on Bot {
                  id
                }
              }
            }
          }
        }
      `;

      console.log('[Copilot Assignment] Querying for Copilot bot with capabilities filter...');
      const response = await this.axiosInstance.post('/graphql', {
        query,
        variables: { owner, repo }
      });

      if (response.data.errors) {
        console.error('[Copilot Assignment] GraphQL errors:', response.data.errors);
        return null;
      }

      const actors = response.data.data?.repository?.suggestedActors?.nodes || [];
      console.log('[Copilot Assignment] Found suggested actors:', actors.map((a: any) => a.login).join(', '));

      // Find the Copilot bot
      const copilotBot = actors.find((actor: any) =>
        actor.login?.toLowerCase().includes('copilot')
      );

      if (copilotBot) {
        console.log('[Copilot Assignment] ✅ Found Copilot bot:', copilotBot.login, 'ID:', copilotBot.id);
        return copilotBot.id;
      }

      console.log('[Copilot Assignment] ❌ Copilot bot not found in suggestedActors');
      return null;
    } catch (error) {
      console.error('[Copilot Assignment] Error fetching Copilot bot ID:', error);
      return null;
    }
  }

  /**
   * Assign issue to Copilot coding agent using GraphQL API
   */
  public async assignCopilotAgent(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<void> {
    try {
      console.log(`[Copilot Assignment] Starting assignment for ${owner}/${repo}#${issueNumber}`);

      // First, get the issue's node ID
      const issueResponse = await this.axiosInstance.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
      const issueNodeId = issueResponse.data.node_id;
      console.log(`[Copilot Assignment] Issue node ID: ${issueNodeId}`);

      // Get Copilot's bot ID
      console.log(`[Copilot Assignment] Fetching Copilot bot ID...`);
      const copilotBotId = await this.getCopilotBotId(owner, repo);

      if (!copilotBotId) {
        console.log(`[Copilot Assignment] GraphQL approach failed, trying REST API with common usernames...`);

        // Try REST API with common Copilot usernames
        const commonUsernames = ['copilot', 'github-copilot[bot]', 'copilot-swe-agent'];

        for (const username of commonUsernames) {
          const success = await this.assignUsingRestApi(owner, repo, issueNumber, username);
          if (success) {
            vscode.window.showInformationMessage(
              `🤖 Issue #${issueNumber} assigned to GitHub Copilot (${username})! Check GitHub for the agent's progress.`
            );
            return; // Success!
          }
        }

        // If all attempts failed
        const errorMsg = 'Could not assign to Copilot. Try manually assigning on GitHub. If that works, please tell me the exact username you see.';
        console.error(`[Copilot Assignment] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`[Copilot Assignment] Copilot bot ID found: ${copilotBotId}`);

      // Assign the issue to Copilot using the correct GraphQL mutation
      // Based on: https://github.com/orgs/community/discussions/164267
      const mutation = `
        mutation AssignIssueToCopilot($issueId: ID!, $botId: ID!) {
          replaceActorsForAssignable(
            input: {assignableId: $issueId, actorIds: [$botId]}
          ) {
            assignable {
              ... on Issue {
                id
                number
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
              }
            }
          }
        }
      `;

      console.log(`[Copilot Assignment] Executing replaceActorsForAssignable mutation...`);
      const mutationResponse = await this.axiosInstance.post('/graphql', {
        query: mutation,
        variables: {
          issueId: issueNodeId,
          botId: copilotBotId
        }
      });

      console.log(`[Copilot Assignment] Mutation response:`, JSON.stringify(mutationResponse.data, null, 2));

      if (mutationResponse.data.errors) {
        const errorMsg = `GraphQL error: ${JSON.stringify(mutationResponse.data.errors)}`;
        console.error(`[Copilot Assignment] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const assignees = mutationResponse.data.data?.replaceActorsForAssignable?.assignable?.assignees?.nodes || [];
      const assigneeLogins = assignees.map((a: any) => a.login).join(', ');

      console.log(`[Copilot Assignment] ✅ Successfully assigned! Assignees: ${assigneeLogins}`);
      vscode.window.showInformationMessage(
        `🤖 Issue #${issueNumber} assigned to GitHub Copilot coding agent (${assigneeLogins})! The agent will start working automatically.`
      );
    } catch (error: any) {
      console.error('Error assigning Copilot agent:', error);

      // Provide helpful error messages
      if (error.message?.includes('not available')) {
        vscode.window.showWarningMessage(error.message);
      } else if (error.response?.status === 404) {
        vscode.window.showWarningMessage(
          'Issue created but could not assign Copilot. The repository or issue might not exist.'
        );
      } else if (error.response?.status === 403) {
        vscode.window.showWarningMessage(
          'Issue created but assignment failed due to permissions. Make sure your GitHub token has "write:org" and "repo" scopes.'
        );
      } else {
        vscode.window.showWarningMessage(
          `Issue created successfully! Could not auto-assign to Copilot: ${error.message}. You can manually assign it on GitHub.`
        );
      }
    }
  }

  /**
   * Create issue with implementation plan and assign Copilot agent
   */
  public async createIssueWithCopilotAgent(
    owner: string,
    repo: string,
    workItemTitle: string,
    workItemId: number,
    plan: string
  ): Promise<{ number: number; html_url: string }> {
    // Format the issue title
    const issueTitle = `[Work Item #${workItemId}] ${workItemTitle}`;

    // Format the issue body with the plan
    const issueBody = `# Implementation Plan for Work Item #${workItemId}

${plan}

---
*This issue was created automatically from Azure DevOps work item #${workItemId} with GitHub Copilot agent integration.*`;

    // Create the issue
    const issue = await this.createIssue(owner, repo, issueTitle, issueBody);

    // Try to assign Copilot agent
    await this.assignCopilotAgent(owner, repo, issue.number);

    return issue;
  }
}

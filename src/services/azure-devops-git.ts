import axios from 'axios';

interface Pipeline {
  id: number;
  name: string;
  folder?: string;
}

interface Repository {
  id: string;
  name: string;
}

interface PushChanges {
  refUpdates: {
    name: string;
    oldObjectId: string;
  }[];
  commits: {
    comment: string;
    changes: {
      changeType: string;
      item: {
        path: string;
      };
      newContent: {
        content: string;
        contentType: string;
      };
    }[];
  }[];
}

export class AzureDevOpsGitService {
  private static instance: AzureDevOpsGitService;
  private baseUrl: string;
  private headers: { [key: string]: string };

  private constructor(organization: string, project: string, pat: string) {
    this.baseUrl = `https://dev.azure.com/${organization}/${project}`;
    const token = Buffer.from(`:${pat}`).toString('base64');
    this.headers = {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  public static getInstance(organization: string, project: string, pat: string): AzureDevOpsGitService {
    if (!AzureDevOpsGitService.instance) {
      AzureDevOpsGitService.instance = new AzureDevOpsGitService(organization, project, pat);
    }
    return AzureDevOpsGitService.instance;
  }

  public async listPipelines(): Promise<Pipeline[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/_apis/build/definitions?api-version=7.1-preview.7`,
        { headers: this.headers }
      );
      
      return response.data.value.map((def: any) => ({
        id: def.id,
        name: def.name,
        folder: def.path
      }));
    } catch (error: any) {
      console.error('Failed to fetch pipelines:', error.response?.data || error.message);
      throw new Error('Failed to fetch pipelines');
    }
  }

  public async getPipelineDetails(pipelineId: number): Promise<{ repositoryId: string }> {
    try {
      // Get the pipeline definition using the build definitions API
      const definitionResponse = await axios.get(
        `${this.baseUrl}/_apis/build/definitions/${pipelineId}?api-version=7.1-preview.7`,
        { headers: this.headers }
      );

      const repositoryId = definitionResponse.data?.repository?.id;
      if (!repositoryId) {
        throw new Error(`Repository ID not found for pipeline ${pipelineId}`);
      }

      return { repositoryId };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('Failed to fetch pipeline details:', errorMessage);
      throw new Error(`Failed to fetch pipeline details: ${errorMessage}`);
    }
  }

  public async getYamlContent(repositoryId: string, filePath: string): Promise<string> {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await axios.get(
        `${this.baseUrl}/_apis/git/repositories/${repositoryId}/items?path=${encodedPath}&api-version=7.1-preview.1`,
        { 
          headers: {
            ...this.headers,
            'Accept': 'text/plain'
          }
        }
      );
      
      if (!response.data) {
        return '';
      }

      // If we get metadata JSON at the start, replace it with a simple comment
      const content = response.data;
      if (typeof content === 'string' && content.trim().startsWith('{')) {
        return '# [object Object]';
      }
      
      return content;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return '';
      }
      const errorMessage = error.response?.data?.message || error.message;
      console.error('Failed to fetch YAML content:', errorMessage);
      throw new Error(`Failed to fetch YAML content: ${errorMessage}`);
    }
  }

  public async getCurrentCommitId(repositoryId: string, branch: string): Promise<string> {
    try {
      // Ensure the branch name is properly formatted
      const formattedBranch = branch.replace(/^refs\/heads\//, '');
      const filter = encodeURIComponent(`heads/${formattedBranch}`);
      
      const response = await axios.get(
        `${this.baseUrl}/_apis/git/repositories/${repositoryId}/refs?filter=${filter}&api-version=7.1-preview.1`,
        { headers: this.headers }
      );

      if (!response.data.value || response.data.value.length === 0) {
        throw new Error(`Branch '${branch}' not found in repository`);
      }

      const commitId = response.data.value[0]?.objectId;
      if (!commitId) {
        throw new Error(`No commit ID found for branch '${branch}'`);
      }

      return commitId;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('Failed to fetch current commit ID:', errorMessage);
      throw new Error(`Failed to fetch current commit ID: ${errorMessage}`);
    }
  }

  public async pushYamlUpdate(
    repositoryId: string,
    branch: string,
    filePath: string,
    content: string,
    retryCount = 0
  ): Promise<boolean> {
    try {
      // Ensure the branch name is properly formatted
      const formattedBranch = branch.replace(/^refs\/heads\//, '');
      const currentCommitId = await this.getCurrentCommitId(repositoryId, formattedBranch);
      
      const pushData = {
        refUpdates: [
          {
            name: `refs/heads/${formattedBranch}`,
            oldObjectId: currentCommitId
          }
        ],
        commits: [
          {
            comment: 'Updated pipeline with STM signing steps',
            changes: [
              {
                changeType: 'edit',
                item: {
                  path: filePath.replace(/^\//, '')  // Remove leading slash if present
                },
                newContent: {
                  content: content.trim(),  // Ensure content is trimmed
                  contentType: 'rawtext'
                }
              }
            ]
          }
        ]
      };

      // Use the Git pushes API endpoint
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/_apis/git/repositories/${repositoryId}/pushes?api-version=6.0`,
        headers: {
          ...this.headers,
          'Content-Type': 'application/json'
        },
        data: pushData
      });

      if (!response.data) {
        throw new Error('Push response is empty');
      }

      return true;
    } catch (error: any) {
      const errorResponse = error.response?.data;
      const errorMessage = errorResponse?.message || errorResponse?.Message || error.message;
      console.error('Failed to push YAML update:', errorResponse || error.message);
      
      // Implement retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.pushYamlUpdate(repositoryId, branch, filePath, content, retryCount + 1);
      }
      
      throw new Error(`Failed to push YAML update: ${errorMessage}`);
    }
  }
} 
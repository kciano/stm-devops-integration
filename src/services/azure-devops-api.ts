import axios from 'axios';

interface AzureDevOpsConfig {
  pat: string;
  organization: string;
  project: string;
}

interface VariableGroupPayload {
  name: string;
  description: string;
  type: string;
  variables: {
    [key: string]: {
      value: string;
      isSecret: boolean;
    };
  };
  variableGroupProjectReferences: Array<{
    name: string;
    projectReference: {
      id: string;
      name: string;
    };
  }>;
}

export class AzureDevOpsService {
  private static instance: AzureDevOpsService;
  private config: AzureDevOpsConfig;

  private constructor(config: AzureDevOpsConfig) {
    this.config = config;
  }

  public static getInstance(config: AzureDevOpsConfig): AzureDevOpsService {
    if (!AzureDevOpsService.instance) {
      AzureDevOpsService.instance = new AzureDevOpsService(config);
    }
    return AzureDevOpsService.instance;
  }

  private getAuthHeader() {
    const token = Buffer.from(`:${this.config.pat}`).toString('base64');
    return `Basic ${token}`;
  }

  public async validatePAT(): Promise<boolean> {
    try {
      const response = await axios.get(
        `https://dev.azure.com/${this.config.organization}/_apis/projects?api-version=7.1-preview.1`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  public async createVariableGroup(variables: {
    apiKey: string;
    certPassword: string;
    host: string;
    groupName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // First, get the project ID
      const projectResponse = await axios.get(
        `https://dev.azure.com/${this.config.organization}/_apis/projects/${this.config.project}?api-version=6.0`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Accept': 'application/json',
          },
        }
      );

      const projectId = projectResponse.data.id;

      const payload: VariableGroupPayload = {
        name: variables.groupName,
        description: "Variable group for STM signing configuration",
        type: "Vsts",
        variables: {
          API_KEY: {
            value: variables.apiKey,
            isSecret: false,
          },
          CLIENT_CERT_PASSWORD: {
            value: variables.certPassword,
            isSecret: false,
          },
          HOST: {
            value: variables.host,
            isSecret: false,
          },
        },
        variableGroupProjectReferences: [
          {
            name: variables.groupName,
            projectReference: {
              id: projectId,
              name: this.config.project
            }
          }
        ]
      };

      const response = await axios.post(
        `https://dev.azure.com/${this.config.organization}/${this.config.project}/_apis/distributedtask/variablegroups?api-version=6.0-preview.2`,
        payload,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      if (response.status === 200) {
        return { success: true };
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Failed to create variable group:', error);
      const errorMessage = error.response?.status === 409 
        ? 'A variable group with this name already exists'
        : error.response?.status === 404
        ? 'Could not find the specified project or insufficient permissions'
        : error.response?.data?.message || 'Failed to create variable group';
      return { success: false, error: errorMessage };
    }
  }

  public async uploadSecureFile(file: File, fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      await axios.post(
        `https://dev.azure.com/${this.config.organization}/${this.config.project}/_apis/distributedtask/securefiles?api-version=7.1-preview.1&name=${fileName}`,
        arrayBuffer,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Accept': 'application/json',
            'Content-Type': 'application/octet-stream',
          },
        }
      );
      return { success: true };
    } catch (error: any) {
      console.error('Failed to upload secure file:', error);
      const errorMessage = error.response?.status === 400
        ? 'Invalid file format or content'
        : 'Failed to upload certificate file';
      return { success: false, error: errorMessage };
    }
  }
} 
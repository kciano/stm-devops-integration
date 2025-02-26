'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { STMApiService } from '@/services/stm-api';
import { SigningTask, Keypair, PipelineVariables, PipelineConfig, PipelineUpdateState } from '@/types';
import { formatError } from '@/lib/utils';
import { AzureDevOpsService } from '@/services/azure-devops-api';
import { AzureDevOpsGitService } from '@/services/azure-devops-git';
import { AzureDevOpsCredentials, FileUploadState } from '@/types';
import { LoggingService } from '@/services/logging';

const SM_HOST = 'https://clientauth.one.digicert.com';

interface FileConfig {
  type: 'exe' | 'jar' | 'apk';
  path: string;
}

// Add these color constants at the top of the file
const COLORS = {
  primary: {
    blue: '#0074c8',
    green: '#82c91e',
    yellow: '#ffcc00',
    darkGray: '#333333',
    lightGray: '#f4f4f4',
    borderGray: '#d9d9d9',
    white: '#ffffff',
  },
  hover: {
    blue: '#005ea6',
    lightBlue: '#e6f4ff',
  },
  status: {
    success: {
      bg: '#82c91e',
      text: '#ffffff',
    },
    error: {
      bg: '#d9534f',
      text: '#ffffff',
    },
    warning: {
      bg: '#ffcc00',
      text: '#333333',
    },
  },
  info: {
    bg: '#fff9e6',
    text: '#333333',
    border: '#ffcc00',
  }
};

// Update the Button component styles
const buttonStyles = {
  primary: `
    bg-[#0074c8] text-white 
    hover:bg-[#005ea6] 
    focus:ring-2 focus:ring-[#0074c8] focus:ring-opacity-50
    rounded px-4 py-2 font-medium
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
  `,
  secondary: `
    bg-white text-[#0074c8] border border-[#0074c8]
    hover:bg-[#e6f4ff]
    focus:ring-2 focus:ring-[#0074c8] focus:ring-opacity-50
    rounded px-4 py-2 font-medium
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
  `,
  destructive: `
    bg-[#d9534f] text-white
    hover:bg-[#c9302c]
    focus:ring-2 focus:ring-[#d9534f] focus:ring-opacity-50
    rounded px-4 py-2 font-medium
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
  `
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [files, setFiles] = useState('**/*.exe');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [showYaml, setShowYaml] = useState(false);
  const [selectedSigningTool, setSelectedSigningTool] = useState<'smctl' | 'signtool' | 'jarsigner' | 'apksigner'>('smctl');
  
  const [keypairs, setKeypairs] = useState<Keypair[]>([]);
  const [isLoadingKeypairs, setIsLoadingKeypairs] = useState(false);
  const [variables, setVariables] = useState<PipelineVariables>({
    clientCertPassword: '',
    selectedKeypairAlias: ''
  });
  const [variableGroup, setVariableGroup] = useState('');
  const [fileType, setFileType] = useState<'exe' | 'jar' | 'apk'>('exe');
  const [fileConfigs, setFileConfigs] = useState<FileConfig[]>([{ type: 'exe', path: 'Build/app.exe' }]);
  const [signAllConfig, setSignAllConfig] = useState({
    exe: false,
    jar: false,
    war: false,
    apk: false
  });
  const [azureDevOps, setAzureDevOps] = useState<AzureDevOpsCredentials>({
    pat: '',
    organization: '',
    project: '',
  });
  const [isValidatingPAT, setIsValidatingPAT] = useState(false);
  const [patValidationResult, setPatValidationResult] = useState<string | null>(null);
  const [fileUpload, setFileUpload] = useState<FileUploadState>({
    file: null,
    isUploading: false,
    error: null,
    success: false,
    fileName: '',
  });

  // New state for pipeline configuration
  const [pipelineUpdate, setPipelineUpdate] = useState<PipelineUpdateState>({
    selectedPipeline: null,
    isLoading: false,
    error: null,
    success: false,
    yamlContent: ''
  });
  const [pipelines, setPipelines] = useState<PipelineConfig[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateApiKey = async () => {
    if (!apiKey.trim()) return;
    
    setIsValidating(true);
    setValidationResult(null);
    setKeypairs([]);
    
    try {
      const stmService = STMApiService.getInstance({
        apiKey,
        baseUrl: window.location.origin
      });
      
      const result = await stmService.validateApiKey();
      
      if (result.success && result.data) {
        setValidationResult('API key is valid');
        await fetchKeypairs();
      } else {
        setValidationResult(`Invalid API key: ${result.error}`);
        setShowYaml(false);
      }
    } catch (error) {
      setValidationResult(`Error: ${formatError(error)}`);
      setShowYaml(false);
    } finally {
      setIsValidating(false);
    }
  };

  const fetchKeypairs = async () => {
    setIsLoadingKeypairs(true);
    try {
      const stmService = STMApiService.getInstance({
        apiKey,
        baseUrl: window.location.origin
      });
      
      const result = await stmService.getKeypairs();
      
      if (result.success && result.data) {
        setKeypairs(result.data);
        if (result.data.length > 0) {
          setVariables(prev => ({
            ...prev,
            selectedKeypairAlias: result.data[0].alias
          }));
          setShowYaml(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch keypairs:', error);
    } finally {
      setIsLoadingKeypairs(false);
    }
  };

  const handleVariableChange = (key: keyof PipelineVariables, value: string) => {
    setVariables(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getSetupYaml = () => {
    return `trigger:
  branches:
    include:
      - master
  paths:
    include:
      - Build

pool:
  vmImage: 'windows-2022'

variables:
  - name: solution
    value: '**/*.csproj'
  - name: buildPlatform
    value: 'AnyCPU'
  - name: buildConfiguration
    value: 'Release'
  - group: ${variableGroup}

steps:
# Setup Tasks
- task: SSMClientToolsSetup@1

- task: SSMSigningToolsSetup@1

# Download client certificate
- task: DownloadSecureFile@1
  name: SM_CLIENT_CERT_FILE
  inputs:
      secureFile: '${fileUpload.fileName || 'your-certificate-name'}'  # Name of your certificate in Secure Files`;
  };

  const formatPath = (path: string, type: 'exe' | 'jar' | 'apk') => {
    // Convert forward slashes to backslashes and ensure no extra spaces
    const normalizedPath = path.replace(/\//g, '\\').replace(/\s+/g, '');
    if (normalizedPath.startsWith('$(')) {
      return normalizedPath;
    }
    // Use System.DefaultWorkingDirectory for JAR files, Build.SourcesDirectory for others
    return type === 'jar' 
      ? `$(System.DefaultWorkingDirectory)\\${normalizedPath}`
      : `$(Build.SourcesDirectory)\\${normalizedPath}`;
  };

  const handleSignAllChange = (type: 'exe' | 'jar' | 'apk') => {
    setSignAllConfig(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const getSigningYaml = () => {
    const keypairAlias = variables.selectedKeypairAlias;
    let signingCommands = `# Download certificate
- task: CmdLine@2
  displayName: 'Certificate download'
  inputs:
    script: 'smctl certificate download --keypair-alias=${keypairAlias} --name=KeyCert.pem --out=$(Agent.TempDirectory)'
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"\n\n`;
    
    // Handle "Sign All" configurations
    if (signAllConfig.exe) {
      signingCommands += `# Sign all EXE files
- task: CmdLine@2
  displayName: 'Sign all EXE files'
  inputs:
    script: |
      for /r "$(Build.SourcesDirectory)" %%f in (*.exe) do (
        signtool sign /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /csp "DigiCert Signing Manager KSP" /kc "${keypairAlias}" /f $(Agent.TempDirectory)\\KeyCert.pem "%%f"
      )
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"\n\n`;
    }

    if (signAllConfig.jar) {
      signingCommands += `# Sign all JAR files
- task: CmdLine@2
  displayName: 'Sign all JAR files'
  inputs:
    script: |
      for /r "$(System.DefaultWorkingDirectory)" %%f in (*.jar) do (
        jarsigner -keystore NONE -storepass NONE -storetype PKCS11 -providerClass sun.security.pkcs11.SunPKCS11 -providerArg $(SSMClientToolsSetup.PKCS11_CONFIG) -digestalg SHA-256 -signedjar "%%f" "%%f" ${keypairAlias} -tsa http://timestamp.digicert.com -tsadigestalg SHA-256
      )
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"\n\n`;
    }

    if (signAllConfig.war) {
      signingCommands += `# Sign all WAR files
- task: CmdLine@2
  displayName: 'Sign all WAR files'
  inputs:
    script: |
      for /r "$(System.DefaultWorkingDirectory)" %%f in (*.war) do (
        jarsigner -keystore NONE -storepass NONE -storetype PKCS11 -providerClass sun.security.pkcs11.SunPKCS11 -providerArg $(SSMClientToolsSetup.PKCS11_CONFIG) -digestalg SHA-256 -signedjar "%%f" "%%f" ${keypairAlias} -tsa http://timestamp.digicert.com -tsadigestalg SHA-256
      )
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"\n\n`;
    }

    if (signAllConfig.apk) {
      signingCommands += `# Sign all APK files
- task: CmdLine@2
  displayName: 'Sign all APK files'
  inputs:
    script: |
      for /r "$(Build.SourcesDirectory)" %%f in (*.apk) do (
        apksigner sign --provider-class sun.security.pkcs11.SunPKCS11 --provider-arg $(SSMClientToolsSetup.PKCS11_CONFIG) --ks NONE --ks-type PKCS11 --ks-key-alias ${keypairAlias} --in "%%f" --out "%%f" --ks-pass pass:NONE --min-sdk-version=18
      )
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"\n\n`;
    }
    
    // Add specific file configurations if they exist and aren't using "Sign All"
    fileConfigs.forEach((config, index) => {
      // Skip if "Sign All" is enabled for this file type
      if (signAllConfig[config.type]) return;

      let command = '';
      const formattedPath = formatPath(config.path, config.type);
      
      switch (config.type) {
        case 'exe':
          command = `# Sign EXE file
- task: CmdLine@2
  displayName: 'Sign ${config.path}'
  inputs:
    script: 'signtool sign /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /csp "DigiCert Signing Manager KSP" /kc "${keypairAlias}" /f $(Agent.TempDirectory)\\KeyCert.pem ${formattedPath}'
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"`;
          break;
        case 'jar':
          command = `# Sign JAR file
- task: CmdLine@2
  displayName: 'Sign ${config.path}'
  inputs:
    script: 'jarsigner -keystore NONE -storepass NONE -storetype PKCS11 -providerClass sun.security.pkcs11.SunPKCS11 -providerArg $(SSMClientToolsSetup.PKCS11_CONFIG) -digestalg SHA-256 -signedjar ${formattedPath} ${formattedPath} ${keypairAlias} -tsa http://timestamp.digicert.com -tsadigestalg SHA-256'
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"`;
          break;
        case 'apk':
          command = `# Sign APK file
- task: CmdLine@2
  displayName: 'Sign ${config.path}'
  inputs:
    script: 'apksigner sign --provider-class sun.security.pkcs11.SunPKCS11 --provider-arg $(SSMClientToolsSetup.PKCS11_CONFIG) --ks NONE --ks-type PKCS11 --ks-key-alias ${keypairAlias} --in ${formattedPath} --out ${formattedPath} --ks-pass pass:NONE --min-sdk-version=18'
  env:
    SM_HOST: "$(HOST)"
    SM_API_KEY: "$(API_KEY)"
    SM_CLIENT_CERT_PASSWORD: "$(CLIENT_CERT_PASSWORD)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_LOG_OUTPUT: "console"
    SM_LOG_LEVEL: "debug"`;
          break;
      }
      signingCommands += command + '\n\n';
    });
    
    return signingCommands;
  };

  const addFileConfig = () => {
    setFileConfigs(prev => [...prev, { type: 'exe', path: '' }]);
  };

  const removeFileConfig = (index: number) => {
    setFileConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileConfig = (index: number, field: keyof FileConfig, value: string) => {
    setFileConfigs(prev => prev.map((config, i) => 
      i === index ? { ...config, [field]: field === 'type' ? value as 'exe' | 'jar' | 'apk' : value } : config
    ));
  };

  const isConfigurationComplete = () => {
    return (
      apiKey.trim() &&
      variables.clientCertPassword.trim() &&
      variables.selectedKeypairAlias.trim()
    );
  };

  const validatePAT = async () => {
    if (!azureDevOps.pat || !azureDevOps.organization || !azureDevOps.project) {
      setPatValidationResult('Please fill in all Azure DevOps fields');
      return;
    }

    setIsValidatingPAT(true);
    setPatValidationResult(null);

    try {
      const service = AzureDevOpsService.getInstance(azureDevOps);
      const isValid = await service.validatePAT();

      if (isValid) {
        setPatValidationResult('Azure DevOps credentials are valid');
        await createVariableGroupAndUploadFile();
      } else {
        setPatValidationResult('Invalid Azure DevOps credentials');
      }
    } catch (error) {
      setPatValidationResult(`Error: ${formatError(error)}`);
    } finally {
      setIsValidatingPAT(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.name.endsWith('.pfx') || file.name.endsWith('.p12'))) {
      setFileUpload({
        file,
        isUploading: false,
        error: null,
        success: false,
        fileName: file.name,
      });
    } else {
      setFileUpload(prev => ({
        ...prev,
        error: 'Please select a valid certificate file (.pfx or .p12)',
      }));
    }
  };

  const createVariableGroupAndUploadFile = async () => {
    if (!fileUpload.file) {
      setFileUpload(prev => ({
        ...prev,
        error: 'Please select a certificate file',
      }));
      return;
    }

    if (!fileUpload.fileName.trim()) {
      setFileUpload(prev => ({
        ...prev,
        error: 'Please enter a name for the secure file',
      }));
      return;
    }

    if (!variableGroup.trim()) {
      setFileUpload(prev => ({
        ...prev,
        error: 'Please enter a variable group name',
      }));
      return;
    }

    const service = AzureDevOpsService.getInstance(azureDevOps);

    // Create variable group
    const variableGroupResult = await service.createVariableGroup({
      apiKey,
      certPassword: variables.clientCertPassword,
      host: SM_HOST,
      groupName: variableGroup,
    });

    if (!variableGroupResult.success) {
      setFileUpload(prev => ({
        ...prev,
        error: variableGroupResult.error || 'Failed to create variable group',
      }));
      return;
    }

    // Upload secure file
    setFileUpload(prev => ({ ...prev, isUploading: true }));
    const uploadResult = await service.uploadSecureFile(fileUpload.file, fileUpload.fileName);

    if (uploadResult.success) {
      setFileUpload(prev => ({
        ...prev,
        isUploading: false,
        success: true,
        error: null,
      }));
    } else {
      setFileUpload(prev => ({
        ...prev,
        isUploading: false,
        error: uploadResult.error || 'Failed to upload certificate file',
      }));
    }
  };

  const fetchPipelines = async () => {
    const logger = LoggingService.getInstance();
    setIsLoadingPipelines(true);
    setPipelines([]);
    setPipelineUpdate(prev => ({ ...prev, error: null }));

    try {
      const gitService = AzureDevOpsGitService.getInstance(
        azureDevOps.organization,
        azureDevOps.project,
        azureDevOps.pat
      );

      const pipelineList = await gitService.listPipelines();
      
      if (!pipelineList || pipelineList.length === 0) {
        setPipelineUpdate(prev => ({
          ...prev,
          error: 'No pipelines found in this project'
        }));
        return;
      }

      logger.info('Found pipelines', { count: pipelineList.length });

      const pipelinesWithDetails = await Promise.all(
        pipelineList.map(async (pipeline) => {
          try {
            const details = await gitService.getPipelineDetails(pipeline.id);
            return {
              id: pipeline.id,
              name: pipeline.name,
              repositoryId: details.repositoryId,
              filePath: 'azure-pipelines.yml',  // Set a default path
              branch: 'main'  // Set a default branch
            };
          } catch (error) {
            logger.error('Failed to fetch pipeline details', { 
              pipelineId: pipeline.id, 
              error: error instanceof Error ? error.message : String(error)
            });
            return null;
          }
        })
      );

      const validPipelines = pipelinesWithDetails.filter((p): p is PipelineConfig => p !== null);
      
      if (validPipelines.length === 0) {
        setPipelineUpdate(prev => ({
          ...prev,
          error: 'Failed to fetch details for any pipelines. Please ensure you have the correct permissions.'
        }));
        return;
      }

      setPipelines(validPipelines);
      logger.info('Successfully fetched pipeline details', { 
        total: pipelineList.length,
        valid: validPipelines.length 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch pipelines', { error: errorMessage });
      setPipelineUpdate(prev => ({
        ...prev,
        error: `Failed to fetch pipelines: ${errorMessage}`
      }));
    } finally {
      setIsLoadingPipelines(false);
    }
  };

  const updatePipelineYaml = async () => {
    const logger = LoggingService.getInstance();
    if (!pipelineUpdate.selectedPipeline) {
      setPipelineUpdate(prev => ({
        ...prev,
        error: 'Please select a pipeline first'
      }));
      return;
    }

    if (!pipelineUpdate.selectedPipeline.filePath) {
      setPipelineUpdate(prev => ({
        ...prev,
        error: 'Please enter a YAML file path'
      }));
      return;
    }

    if (!pipelineUpdate.selectedPipeline.branch) {
      setPipelineUpdate(prev => ({
        ...prev,
        error: 'Please enter a branch name'
      }));
      return;
    }

    setPipelineUpdate(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      success: false
    }));

    try {
      const gitService = AzureDevOpsGitService.getInstance(
        azureDevOps.organization,
        azureDevOps.project,
        azureDevOps.pat
      );

      // Ensure the file path starts with a forward slash if not already
      const filePath = pipelineUpdate.selectedPipeline.filePath.startsWith('/')
        ? pipelineUpdate.selectedPipeline.filePath
        : '/' + pipelineUpdate.selectedPipeline.filePath;

      // Get existing content or start with empty string
      let yamlContent = await gitService.getYamlContent(
        pipelineUpdate.selectedPipeline.repositoryId!,
        filePath
      );

      // Generate new YAML content
      const setupYaml = getSetupYaml();
      const signingYaml = getSigningYaml();
      const newYaml = `${setupYaml}\n\n${signingYaml}`;

      // Push updates with the new YAML
      await gitService.pushYamlUpdate(
        pipelineUpdate.selectedPipeline.repositoryId!,
        pipelineUpdate.selectedPipeline.branch,
        filePath,
        newYaml
      );

      setPipelineUpdate(prev => ({
        ...prev,
        success: true,
        yamlContent: newYaml
      }));

      logger.info('Pipeline YAML updated successfully', {
        pipelineId: pipelineUpdate.selectedPipeline.id,
        pipelineName: pipelineUpdate.selectedPipeline.name,
        filePath,
        branch: pipelineUpdate.selectedPipeline.branch
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update pipeline YAML', { error: errorMessage });
      setPipelineUpdate(prev => ({
        ...prev,
        error: `Failed to update pipeline: ${errorMessage}`
      }));
    } finally {
      setPipelineUpdate(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  };

  // Update the setAzureDevOps handler to reset validation state
  const handleAzureDevOpsChange = (field: keyof AzureDevOpsCredentials, value: string) => {
    setAzureDevOps(prev => ({ ...prev, [field]: value }));
    setPatValidationResult(null);  // Reset validation result when credentials change
    setIsValidatingPAT(false);     // Reset validation state
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#ffffff] font-sans">
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-[#e6f4ff] to-[#f4f9ff] border border-[#0074c8] p-6 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-[#333333] mb-4">
            Welcome to Software Trust Manager Azure DevOps Integration
          </h1>
          <div className="prose max-w-none">
            <p className="text-[#333333] mb-4">
              Streamline your binary signing process with our Azure DevOps integration. 
              Securely sign your builds and ensure software integrity with ease.
            </p>
          </div>
        </div>

        {/* Pre-requirements Notice */}
        <div className="bg-[#fff9e6] border border-[#ffcc00] p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-[#333333] mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2 text-[#ffcc00]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Before You Begin
          </h2>

          {/* Prerequisites List */}
          <div className="mb-6">
            <h3 className="text-[#333333] font-medium mb-3">Required Setup Steps:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] shadow-sm">
                <div className="flex items-center text-[#0074c8] mb-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span className="font-medium">Authentication</span>
                </div>
                <ul className="space-y-2 text-sm text-[#333333]">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-[#82c91e]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Generate DigiCert ONE API Key
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-[#82c91e]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Create Client Authentication Certificate
                  </li>
                </ul>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] shadow-sm">
                <div className="flex items-center text-[#0074c8] mb-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">Tools & Access</span>
                </div>
                <ul className="space-y-2 text-sm text-[#333333]">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-[#82c91e]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Install STM Client Tools Extension
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-[#82c91e]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Generate Azure DevOps PAT
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Documentation Link */}
          <div className="mt-4 border-t border-[#ffcc00] pt-4">
          <p className="text-[#333333] mb-3">
              For detailed implementation steps and configuration guidelines, refer to our comprehensive CI/CD integration documentation:
              </p>
              <a 
              href="https://docs.digicert.com/en/software-trust-manager/ci-cd-integrations/plugins/azure/install-client-tools-for-standard-keypair-signing-on-azure-devops.html"
                target="_blank"
                rel="noopener noreferrer"
            className="inline-flex items-center text-[#0074c8] hover:text-[#005ea6] font-medium"
              >
              <span>View CI/CD Integration Guide</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
          </div>
        </div>

        {/* Steps Container */}
        <div className="space-y-8">
          {/* Step 1: API Key */}
          <section className="bg-white border border-[#d9d9d9] rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#333333] mb-4">Step 1: API Key Validation</h2>
        <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#333333] mb-2">
                  STM API Key
                </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your STM API key"
                  className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
            />
              </div>
              <button
              onClick={validateApiKey}
              disabled={!apiKey.trim() || isValidating}
                className={buttonStyles.primary}
            >
              {isValidating ? 'Validating...' : 'Validate API Key'}
              </button>
            {validationResult && (
                <div className={`p-3 rounded-lg ${
                  validationResult.includes('valid') 
                    ? 'bg-[#82c91e] text-white'
                    : 'bg-[#d9534f] text-white'
                }`}>
                {validationResult}
          </div>
                )}
              </div>
          </section>

          {/* Step 2: Configure Variables - Only show if API key is valid */}
          {validationResult?.includes('valid') && (
            <section className="bg-white border border-[#d9d9d9] rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#333333] mb-4">Step 2: Configure Variables</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Client Certificate Password
                  </label>
                  <input
                    type="password"
                    value={variables.clientCertPassword}
                    onChange={(e) => handleVariableChange('clientCertPassword', e.target.value)}
                    placeholder="Enter client certificate password"
                    className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Select Keypair
                  </label>
                  {isLoadingKeypairs ? (
                    <p className="text-sm text-[#333333]">Loading keypairs...</p>
                  ) : keypairs.length > 0 ? (
                    <select
                      value={variables.selectedKeypairAlias}
                      onChange={(e) => handleVariableChange('selectedKeypairAlias', e.target.value)}
                      className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                    >
                      {keypairs.map((keypair) => (
                        <option key={keypair.id} value={keypair.alias}>
                          {keypair.alias} ({keypair.key_type} {keypair.key_alg}-{keypair.key_size})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-[#d9534f]">No keypairs found for this account</p>
                  )}
                </div>

                <div className="bg-[#f4f4f4] border border-[#d9d9d9] p-4 rounded-lg">
                  <h3 className="font-semibold text-[#333333] mb-3">Environment Variables</h3>
                  <ul className="space-y-2 text-sm text-[#333333]">
                    <li className="flex items-center">
                      <code className="bg-white px-2 py-1 rounded mr-2">SM_HOST</code>
                      <span>{SM_HOST}</span>
                    </li>
                    <li className="flex items-center">
                      <code className="bg-white px-2 py-1 rounded mr-2">SM_API_KEY</code>
                      <span>{apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'Not set'}</span>
                    </li>
                    <li className="flex items-center">
                      <code className="bg-white px-2 py-1 rounded mr-2">SM_CLIENT_CERT_PASSWORD</code>
                      <span>{variables.clientCertPassword ? '********' : 'Not set'}</span>
                    </li>
                    <li className="flex items-center">
                      <code className="bg-white px-2 py-1 rounded mr-2">keypair_alias</code>
                      <span>{variables.selectedKeypairAlias || 'Not selected'}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Azure DevOps Configuration - Only show if configuration is complete */}
          {isConfigurationComplete() && (
            <section className="bg-white border border-[#d9d9d9] rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#333333] mb-4">Step 3: Azure DevOps Configuration</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Variable Group Name
                  </label>
                  <input
                    type="text"
                    value={variableGroup}
                    onChange={(e) => setVariableGroup(e.target.value)}
                    placeholder="Enter variable group name (e.g., STM-CICD-Variable)"
                    className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                  />
                  <p className="text-sm text-[#333333] mt-1">
                    Variable group containing your secrets (HOST, API_KEY, CLIENT_CERT_PASSWORD)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={azureDevOps.pat}
                    onChange={(e) => handleAzureDevOpsChange('pat', e.target.value)}
                    placeholder="Enter your Azure DevOps PAT"
                    className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={azureDevOps.organization}
                    onChange={(e) => handleAzureDevOpsChange('organization', e.target.value)}
                    placeholder="Enter your Azure DevOps organization name"
                    className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={azureDevOps.project}
                    onChange={(e) => handleAzureDevOpsChange('project', e.target.value)}
                    placeholder="Enter your Azure DevOps project name"
                    className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Client Certificate
                  </label>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      onChange={handleFileChange}
                      className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={fileUpload.fileName}
                      onChange={(e) => setFileUpload(prev => ({ ...prev, fileName: e.target.value }))}
                      placeholder="Enter secure file name (e.g., my-certificate)"
                      className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                    />
                  </div>
                  {fileUpload.error && (
                    <p className="mt-2 text-sm text-[#d9534f]">{fileUpload.error}</p>
                  )}
                  {fileUpload.success && (
                    <p className="mt-2 text-sm text-[#82c91e]">Certificate uploaded successfully</p>
                  )}
                </div>

                <button
                  onClick={validatePAT}
                  disabled={isValidatingPAT || !azureDevOps.pat || !azureDevOps.organization || !azureDevOps.project}
                  className={buttonStyles.primary}
                >
                  {isValidatingPAT ? 'Validating...' : 'Validate and Configure'}
                </button>

                {patValidationResult && (
                  <div className={`p-3 rounded-lg ${
                    patValidationResult.includes('valid')
                      ? 'bg-[#82c91e] text-white'
                      : 'bg-[#d9534f] text-white'
                  }`}>
                    {patValidationResult}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 4: Configure Files to Sign - Only show if PAT validation is successful */}
          {patValidationResult?.includes('valid') && (
            <section className="bg-white border border-[#d9d9d9] rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#333333] mb-4">Step 4: Configure Files to Sign</h2>
              <div className="space-y-6">
                {/* Sign All Options */}
                <div>
                  <h3 className="text-lg font-medium text-[#333333] mb-3">Sign All Files by Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <label className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-[#d9d9d9] hover:border-[#0074c8] transition-colors">
                      <input
                        type="checkbox"
                        checked={signAllConfig.exe}
                        onChange={() => handleSignAllChange('exe')}
                        className="rounded border-[#d9d9d9] text-[#0074c8] focus:ring-[#0074c8]"
                      />
                      <span className="text-[#333333]">Sign all EXE files</span>
                    </label>
                    <label className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-[#d9d9d9] hover:border-[#0074c8] transition-colors">
                      <input
                        type="checkbox"
                        checked={signAllConfig.jar}
                        onChange={() => handleSignAllChange('jar')}
                        className="rounded border-[#d9d9d9] text-[#0074c8] focus:ring-[#0074c8]"
                      />
                      <span className="text-[#333333]">Sign all JAR files</span>
                    </label>
                    <label className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-[#d9d9d9] hover:border-[#0074c8] transition-colors">
                      <input
                        type="checkbox"
                        checked={signAllConfig.war}
                        onChange={() => handleSignAllChange('war')}
                        className="rounded border-[#d9d9d9] text-[#0074c8] focus:ring-[#0074c8]"
                      />
                      <span className="text-[#333333]">Sign all WAR files</span>
                    </label>
                    <label className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-[#d9d9d9] hover:border-[#0074c8] transition-colors">
                      <input
                        type="checkbox"
                        checked={signAllConfig.apk}
                        onChange={() => handleSignAllChange('apk')}
                        className="rounded border-[#d9d9d9] text-[#0074c8] focus:ring-[#0074c8]"
                      />
                      <span className="text-[#333333]">Sign all APK files</span>
                    </label>
                  </div>
                  <p className="text-sm text-[#333333] mt-2 bg-[#f4f4f4] p-3 rounded-lg">
                    Note: When "Sign All" is enabled for a file type, individual file configurations of that type will be ignored.
                  </p>
                </div>

                {/* Individual File Configurations */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-[#333333]">Individual File Configurations</h3>
                  {fileConfigs.map((config, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start bg-white p-4 rounded-lg border border-[#d9d9d9]">
                      <div>
                        <label className="block text-sm font-medium text-[#333333] mb-2">
                          File Type
                        </label>
                        <select
                          value={config.type}
                          onChange={(e) => updateFileConfig(index, 'type', e.target.value)}
                          className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                        >
                          <option value="exe">EXE</option>
                          <option value="jar">JAR</option>
                          <option value="apk">APK</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[#333333] mb-2">
                          File Path
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={config.path}
                            onChange={(e) => updateFileConfig(index, 'path', e.target.value)}
                            placeholder="Enter file path (e.g., Build/app.exe)"
                            className="flex-1 p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                          />
                          <button
                            onClick={() => removeFileConfig(index)}
                            className={buttonStyles.destructive}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addFileConfig}
                    className={buttonStyles.secondary}
                  >
                    Add File Configuration
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Step 5: Pipeline Configuration - Only show if PAT validation is successful */}
          {patValidationResult?.includes('valid') && (
            <section className="bg-white border border-[#d9d9d9] rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#333333] mb-4">Step 5: Pipeline Configuration</h2>
              <div className="space-y-6">
                <button
                  onClick={fetchPipelines}
                  disabled={isLoadingPipelines}
                  className={buttonStyles.primary}
                >
                  {isLoadingPipelines ? 'Loading Pipelines...' : 'Fetch Pipelines'}
                </button>

                {pipelines.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#333333] mb-2">
                        Select Pipeline
                      </label>
                      <select
                        value={pipelineUpdate.selectedPipeline?.id || ''}
                        onChange={(e) => {
                          const pipeline = pipelines.find(p => p.id === Number(e.target.value));
                          setPipelineUpdate(prev => ({
                            ...prev,
                            selectedPipeline: pipeline || null
                          }));
                        }}
                        className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                      >
                        <option value="">Select a pipeline</option>
                        {pipelines.map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {pipelineUpdate.selectedPipeline && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-[#333333] mb-2">
                            YAML File Path
                          </label>
                          <input
                            type="text"
                            value={pipelineUpdate.selectedPipeline.filePath}
                            onChange={(e) => {
                              setPipelineUpdate(prev => ({
                                ...prev,
                                selectedPipeline: prev.selectedPipeline ? {
                                  ...prev.selectedPipeline,
                                  filePath: e.target.value
                                } : null
                              }));
                            }}
                            placeholder="Enter YAML file path (e.g., azure-pipelines.yml)"
                            className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#333333] mb-2">
                            Branch Name
                          </label>
                          <input
                            type="text"
                            value={pipelineUpdate.selectedPipeline.branch}
                            onChange={(e) => {
                              setPipelineUpdate(prev => ({
                                ...prev,
                                selectedPipeline: prev.selectedPipeline ? {
                                  ...prev.selectedPipeline,
                                  branch: e.target.value
                                } : null
                              }));
                            }}
                            placeholder="Enter branch name (e.g., main)"
                            className="w-full p-2 border border-[#d9d9d9] rounded focus:ring-2 focus:ring-[#0074c8] focus:border-transparent"
                          />
                        </div>

                        <button
                          onClick={updatePipelineYaml}
                          disabled={pipelineUpdate.isLoading || !pipelineUpdate.selectedPipeline.filePath}
                          className={buttonStyles.primary}
                        >
                          {pipelineUpdate.isLoading ? 'Updating Pipeline...' : 'Update Pipeline YAML'}
                        </button>

                        {pipelineUpdate.error && (
                          <div className="p-3 rounded-lg bg-[#d9534f] text-white">
                            {pipelineUpdate.error}
                          </div>
                        )}

                        {pipelineUpdate.success && (
                          <div className="p-3 rounded-lg bg-[#82c91e] text-white">
                            Pipeline updated successfully!
                          </div>
                        )}

                        {pipelineUpdate.yamlContent && (
                          <div className="bg-[#f4f4f4] p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold text-[#333333]">Updated Pipeline YAML</h4>
                              <button
                                onClick={() => navigator.clipboard.writeText(pipelineUpdate.yamlContent)}
                                className={buttonStyles.secondary}
                              >
                                Copy YAML
                              </button>
                            </div>
                            <pre className="overflow-x-auto text-sm bg-white p-4 rounded border border-[#d9d9d9]">
                              <code>{pipelineUpdate.yamlContent}</code>
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
              </div>
      </div>
    </main>
  );
} 
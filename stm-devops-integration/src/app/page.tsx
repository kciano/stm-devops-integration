'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { STMApiService } from '@/services/stm-api';
import { SigningTask, Keypair, PipelineVariables } from '@/types';
import { formatError } from '@/lib/utils';

const SM_HOST = 'https://clientauth.one.digicert.com';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [files, setFiles] = useState('**/*.exe');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [showYaml, setShowYaml] = useState(false);
  const [selectedSigningTool, setSelectedSigningTool] = useState<'smctl' | 'signtool' | 'jarsigner' | 'apksigner'>('smctl');
  
  // New state variables
  const [keypairs, setKeypairs] = useState<Keypair[]>([]);
  const [isLoadingKeypairs, setIsLoadingKeypairs] = useState(false);
  const [variables, setVariables] = useState<PipelineVariables>({
    clientCertPassword: '',
    selectedKeypairAlias: ''
  });

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
        baseUrl: 'https://one.digicert.com'
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
        baseUrl: 'https://one.digicert.com'
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
    return `# Setup Tasks
- task: SSMClientToolsSetup@1
- task: SSMSigningToolsSetup@1

# Download client certificate
- task: DownloadSecureFile@1
  name: SM_CLIENT_CERT_FILE
  inputs:
    secureFile: client_certificate  # Upload your certificate to Secure Files in Azure DevOps

# Set environment variables
variables:
  SM_HOST: "${SM_HOST}"
  SM_API_KEY: "$(sm_api_key)"  # Add this in pipeline variables as secret
  SM_CLIENT_CERT_PASSWORD: "$(sm_client_cert_password)"  # Add this in pipeline variables as secret
  SM_TLS_SKIP_VERIFY: "false"  # Modify as needed
  SM_LOG_OUTPUT: "console"  # For debugging`;
  };

  const getSigningYaml = () => {
    let signingCommand = '';
    const keypairAlias = variables.selectedKeypairAlias;
    
    switch (selectedSigningTool) {
      case 'smctl':
        signingCommand = `# Download certificate
- task: CmdLine@2
  inputs:
    script: 'smctl certificate download --keypair-alias=${keypairAlias} --name=KeyCert.pem --out=$(Agent.TempDirectory)'
  env:
    SM_HOST: "${SM_HOST}"
    SM_API_KEY: "$(sm_api_key)"
    SM_CLIENT_CERT_PASSWORD: "$(sm_client_cert_password)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_TLS_SKIP_VERIFY: "false"

# Sign files
- task: CmdLine@2
  inputs:
    script: 'smctl sign --keypair-alias=${keypairAlias} --certificate=$(Agent.TempDirectory)\\KeyCert.pem --config-file $(SSMClientToolsSetup.PKCS11_CONFIG) --input ${files}'
  env:
    SM_HOST: "${SM_HOST}"
    SM_API_KEY: "$(sm_api_key)"
    SM_CLIENT_CERT_PASSWORD: "$(sm_client_cert_password)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_TLS_SKIP_VERIFY: "false"`;
        break;
      case 'signtool':
        signingCommand = `- task: CmdLine@2
  inputs:
    script: 'signtool sign /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /csp "DigiCert Signing Manager KSP" /kc "${keypairAlias}" /f $(Agent.TempDirectory)\\KeyCert.pem ${files}'
  env:
    SM_HOST: "${SM_HOST}"
    SM_API_KEY: "$(sm_api_key)"
    SM_CLIENT_CERT_PASSWORD: "$(sm_client_cert_password)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_TLS_SKIP_VERIFY: "false"`;
        break;
      case 'jarsigner':
        signingCommand = `- task: CmdLine@2
  inputs:
    script: 'jarsigner -keystore NONE -storepass NONE -storetype PKCS11 -providerClass sun.security.pkcs11.SunPKCS11 -providerArg $(SSMClientToolsSetup.PKCS11_CONFIG) -digestalg SHA-256 -signedjar $(System.DefaultWorkingDirectory)/signed.jar $(System.DefaultWorkingDirectory)/${files} ${keypairAlias} -tsa http://timestamp.digicert.com -tsadigestalg SHA-256'
  env:
    SM_HOST: "${SM_HOST}"
    SM_API_KEY: "$(sm_api_key)"
    SM_CLIENT_CERT_PASSWORD: "$(sm_client_cert_password)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_TLS_SKIP_VERIFY: "false"`;
        break;
      case 'apksigner':
        signingCommand = `- task: CmdLine@2
  inputs:
    script: 'apksigner sign --provider-class sun.security.pkcs11.SunPKCS11 --provider-arg $(SSMClientToolsSetup.PKCS11_CONFIG) --ks NONE --ks-type PKCS11 --ks-key-alias ${keypairAlias} --in ${files} --out signed.apk --ks-pass pass:NONE --min-sdk-version=18'
  env:
    SM_HOST: "${SM_HOST}"
    SM_API_KEY: "$(sm_api_key)"
    SM_CLIENT_CERT_PASSWORD: "$(sm_client_cert_password)"
    SM_CLIENT_CERT_FILE: "$(SM_CLIENT_CERT_FILE.secureFilePath)"
    SM_TLS_SKIP_VERIFY: "false"`;
        break;
    }
    return signingCommand;
  };

  const isConfigurationComplete = () => {
    return (
      apiKey.trim() &&
      variables.clientCertPassword.trim() &&
      variables.selectedKeypairAlias.trim()
    );
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-white">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">Prerequisites</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-blue-700">1. Install Extension</h3>
              <p className="text-sm text-blue-600">
                Install the Software Trust Manager client tools extension from Visual Studio Marketplace.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-blue-700">2. Authentication Setup</h3>
              <div className="pl-4 space-y-2">
                <h4 className="text-sm font-semibold text-blue-600">2.1 API Token</h4>
                <ol className="list-decimal list-inside text-sm text-blue-600 pl-4">
                  <li>Sign in to DigiCert ONE</li>
                  <li>Select profile icon (top-right)</li>
                  <li>Select Admin Profile</li>
                  <li>Scroll to API Tokens</li>
                  <li>Create API token</li>
                  <li>Store the token securely</li>
                </ol>
                <h4 className="text-sm font-semibold text-blue-600">2.2 Authentication Certificate</h4>
                <ol className="list-decimal list-inside text-sm text-blue-600 pl-4">
                  <li>Sign in to DigiCert ONE</li>
                  <li>Select profile icon (top-right)</li>
                  <li>Select Admin Profile</li>
                  <li>Scroll to Authentication certificates</li>
                  <li>Create authentication certificate</li>
                  <li>Download and store certificate and password</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold">STM DevOps Integration</h1>
        
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Step 1: API Key Validation</h2>
          <p className="text-sm text-gray-600">First, validate your STM API key to ensure it works correctly.</p>
          <div className="space-y-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your STM API key"
              className="w-full p-2 border rounded"
            />
            <Button 
              onClick={validateApiKey}
              disabled={!apiKey.trim() || isValidating}
              variant="default"
            >
              {isValidating ? 'Validating...' : 'Validate API Key'}
            </Button>
            {validationResult && (
              <p className={validationResult.includes('valid') ? 'text-green-600' : 'text-red-600'}>
                {validationResult}
              </p>
            )}
          </div>
        </div>

        {validationResult?.includes('valid') && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 2: Configure Variables</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Certificate Password
                </label>
                <input
                  type="password"
                  value={variables.clientCertPassword}
                  onChange={(e) => handleVariableChange('clientCertPassword', e.target.value)}
                  placeholder="Enter client certificate password"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Keypair
                </label>
                {isLoadingKeypairs ? (
                  <p className="text-sm text-gray-600">Loading keypairs...</p>
                ) : keypairs.length > 0 ? (
                  <select
                    value={variables.selectedKeypairAlias}
                    onChange={(e) => handleVariableChange('selectedKeypairAlias', e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    {keypairs.map((keypair) => (
                      <option key={keypair.id} value={keypair.alias}>
                        {keypair.alias} ({keypair.key_type} {keypair.key_alg}-{keypair.key_size})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-red-600">No keypairs found for this account</p>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                <h3 className="font-semibold text-gray-800 mb-2">Environment Variables</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
                  <li><code>SM_HOST</code>: {SM_HOST} (pre-configured)</li>
                  <li><code>SM_API_KEY</code>: {apiKey.slice(0, 4)}...{apiKey.slice(-4)} (validated)</li>
                  <li><code>SM_CLIENT_CERT_PASSWORD</code>: {variables.clientCertPassword ? '********' : 'Not set'}</li>
                  <li><code>keypair_alias</code>: {variables.selectedKeypairAlias || 'Not selected'}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {isConfigurationComplete() && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 3: Configure Pipeline</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                <h3 className="font-semibold text-yellow-800 mb-2">Azure DevOps Setup</h3>
                <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-2">
                  <li>Go to Project Settings → Service Connections</li>
                  <li>Create a new Azure Key Vault connection</li>
                  <li>Store your API key and certificate password in Key Vault</li>
                  <li>Upload your client certificate to Pipelines → Library → Secure Files</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Select Signing Tool</h3>
                <div className="flex space-x-4 mb-4">
                  {(['smctl', 'signtool', 'jarsigner', 'apksigner'] as const).map(tool => (
                    <button
                      key={tool}
                      onClick={() => setSelectedSigningTool(tool)}
                      className={`px-4 py-2 rounded ${
                        selectedSigningTool === tool
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {tool.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Patterns to Sign
                </label>
                <textarea
                  value={files}
                  onChange={(e) => setFiles(e.target.value)}
                  placeholder={`Enter file patterns to sign, example:
**/*.exe
bin/**/*.dll`}
                  className="w-full p-2 border rounded h-32 font-mono text-sm"
                />
              </div>

              {showYaml && (
                <div className="space-y-4">
                  <div className="bg-gray-100 p-4 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">Setup Configuration</h4>
                      <Button
                        onClick={() => navigator.clipboard.writeText(getSetupYaml())}
                        variant="outline"
                        className="text-sm"
                      >
                        Copy Setup YAML
                      </Button>
                    </div>
                    <pre className="overflow-x-auto text-sm">
                      <code>{getSetupYaml()}</code>
                    </pre>
                  </div>

                  <div className="bg-gray-100 p-4 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">Signing Configuration</h4>
                      <Button
                        onClick={() => navigator.clipboard.writeText(getSigningYaml())}
                        variant="outline"
                        className="text-sm"
                      >
                        Copy Signing YAML
                      </Button>
                    </div>
                    <pre className="overflow-x-auto text-sm">
                      <code>{getSigningYaml()}</code>
                    </pre>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                    <h4 className="font-semibold text-gray-800 mb-2">Required Pipeline Variables</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
                      <li><code>sm_host</code> - Your STM host environment</li>
                      <li><code>sm_api_key</code> - Your API token (mark as secret)</li>
                      <li><code>sm_client_cert_password</code> - Certificate password (mark as secret)</li>
                      <li><code>keypair_alias</code> - Your keypair alias (mark as secret)</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-4 rounded">
                    <h4 className="font-semibold text-green-800 mb-2">Testing the Integration</h4>
                    <ol className="list-decimal list-inside text-sm text-green-700 space-y-2">
                      <li>Commit and push your pipeline changes</li>
                      <li>Ensure all variables are set in pipeline settings</li>
                      <li>Verify client certificate is uploaded to Secure Files</li>
                      <li>Run the pipeline and monitor the signing task</li>
                      <li>Check logs by setting <code>SM_LOG_OUTPUT: console</code> if needed</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

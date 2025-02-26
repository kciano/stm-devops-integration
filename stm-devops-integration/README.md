# STM DevOps Integration MVP

This is a Minimal Viable Product (MVP) for integrating STM (Signing Task Manager) with Azure DevOps pipelines. The application provides a simple interface to validate STM API keys and test signing operations.

## Features

- API Key validation against STM endpoints
- File signing with configurable options
- Simple and intuitive user interface
- Error handling and logging
- Support for multiple file signing

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn package manager
- STM API key from DigiCert

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd stm-devops-integration
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter your STM API key in the provided input field
2. Click "Validate API Key" to verify your credentials
3. Once validated, enter the file paths you want to sign (one per line)
4. Click "Sign Files" to initiate the signing process
5. View the results in real-time

## Azure DevOps Integration

To integrate with Azure DevOps pipelines:

1. Add the following task to your pipeline YAML:

```yaml
- task: STMSigningTask@1
  displayName: "Sign Artifacts with STM (MVP)"
  inputs:
    apiKey: "$(STM_API_KEY)"
    files: "**/*.exe"
    options:
      timestamp: true
      hashAlgorithm: "SHA-256"
```

2. Store your STM API key as a pipeline variable named `STM_API_KEY`

## Development

The project is built with:

- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn UI Components

## Error Handling

The application includes comprehensive error handling for:
- Invalid API keys
- Network failures
- Invalid file patterns
- Signing process failures

## Security Considerations

- API keys are never stored in the browser
- All API communications are done over HTTPS
- Sensitive information is masked in logs

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

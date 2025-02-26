# STM DevOps Integration

A Next.js application for integrating DigiCert's Software Trust Manager (STM) with Azure DevOps pipelines.

## Features

- API Key validation for STM authentication
- Keypair management and selection
- Azure DevOps pipeline configuration
- Support for multiple signing tools:
  - SMCTL
  - SignTool
  - JARSigner
  - APKSigner
- Automatic YAML pipeline generation
- Secure file and variable management

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- Azure DevOps account with appropriate permissions
- DigiCert ONE account with STM access

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/stm-devops-integration.git
cd stm-devops-integration
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

The following environment variables are required:

```env
NEXT_PUBLIC_STM_HOST=https://clientauth.one.digicert.com
```

## Usage

1. Navigate to the application in your browser
2. Enter and validate your STM API key
3. Configure the signing options and variables
4. Select your target Azure DevOps pipeline
5. Generate and copy the YAML configuration
6. Update your pipeline with the generated configuration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)

## Support

For support, please contact DigiCert Support or raise an issue in this repository. 
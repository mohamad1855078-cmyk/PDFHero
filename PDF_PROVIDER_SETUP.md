# PDF Provider Setup Guide

Your application is now configured to work with external PDF processing APIs. The backend acts as a secure proxy that protects your API keys and handles CORS restrictions.

## Supported Providers

Currently supported PDF service providers:

1. **ILovePDF** (Recommended) - https://developer.ilovepdf.com/
2. **PDF.co** - https://pdf.co/
3. **CloudConvert** - https://cloudconvert.com/
4. **Mock** (Default) - For testing without API keys

## Quick Start (Mock Mode)

By default, the application runs in **mock mode** which returns the original uploaded file without processing. This is useful for testing the UI and workflow.

No configuration needed - just use the app!

## Production Setup

### Option 1: ILovePDF (Recommended)

1. Sign up at https://developer.ilovepdf.com/
2. Get your API **Public Key** from the dashboard
3. Set environment variables:
   - `PDF_PROVIDER=ilovepdf`
   - `PDF_API_KEY=your_public_key_here`

### Option 2: PDF.co

1. Sign up at https://pdf.co/
2. Get your API key from the dashboard
3. Set environment variables:
   - `PDF_PROVIDER=pdfco`
   - `PDF_API_KEY=your_api_key_here`

### Option 3: CloudConvert

1. Sign up at https://cloudconvert.com/
2. Get your API key
3. Set environment variables:
   - `PDF_PROVIDER=cloudconvert`
   - `PDF_API_KEY=your_api_key_here`

## Setting Environment Variables in Replit

You can set environment variables through:

1. **Replit Secrets Tab** (Recommended for API keys)
   - Click on "Secrets" in the left sidebar
   - Add `PDF_PROVIDER` and `PDF_API_KEY`

2. **Direct Environment Variables**
   - The agent can set them for you using the environment variable tools

## Features by Provider

| Feature | Mock | ILovePDF | PDF.co | CloudConvert |
|---------|------|----------|--------|--------------|
| Merge PDFs | ✓ | ✓ | ✓ | ✓ |
| Split PDFs | ✓ | ✓ | ✓ | ✓ |
| Compress | ✓ | ✓ | ✓ | ✓ |
| Protect | ✓ | ✓ | ✓ | ✓ |
| PDF to Word | ✓ | ✓ | ✓ | ✓ |

**Note:** Mock mode returns the original file unchanged - useful for UI testing only.

## Cost Considerations

- **ILovePDF**: Free tier available, pay-per-use
- **PDF.co**: Free tier with 100 credits/month
- **CloudConvert**: Pay per conversion

## Extending Support

To add support for a new PDF provider, edit `server/pdf-provider.ts` and implement the provider-specific methods following the existing pattern.

## Troubleshooting

- **"Provider not configured" error**: Make sure `PDF_PROVIDER` and `PDF_API_KEY` environment variables are set
- **API errors**: Check your API key and provider account status
- **Files not processing**: Verify you're not in mock mode if you expect real processing

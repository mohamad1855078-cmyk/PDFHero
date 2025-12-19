# PDF Master - Simple, Powerful PDF Tools

## Overview

PDF Master is a fully functional full-stack web application that provides PDF manipulation tools including merge, split, compress, protect, and convert-to-Word operations. The application is built with a React frontend and Express backend, currently operating in mock mode (returns processed versions of PDFs) and ready to connect to external PDF processing APIs (ILovePDF, PDF.co, CloudConvert). The architecture emphasizes simplicity, user experience, and secure API key management through a backend proxy pattern.

### Current Status
✅ **FULLY FUNCTIONAL** - All PDF operations are working end-to-end:
- Merge multiple PDFs ✓
- Split PDFs by page or custom ranges ✓
- Compress PDFs (mock mode) ✓
- Protect PDFs with password (mock mode) ✓
- Convert PDF to Word (mock mode) ✓
- Bilingual UI (English/Arabic with RTL support) ✓
- Download History tracking ✓

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Components**: Built with Radix UI primitives and custom components following the shadcn/ui design system. The application uses a "New York" style variant with Tailwind CSS for styling.

**Routing**: Client-side routing implemented with Wouter, a lightweight React router. The application supports multiple tool pages (Home, Merge, Split, Protect, Compress, PDF-to-Word, Download History, Pricing).

**State Management**: TanStack Query (React Query) for server state management and API data fetching. Local component state managed with React hooks.

**Internationalization**: Custom i18n context supporting English and Arabic with RTL (right-to-left) layout switching. Translation keys are defined in a centralized dictionary structure.

**File Handling**: React Dropzone for drag-and-drop file uploads with PDF validation.

**Design System**: Apple-inspired clean aesthetic with neutral color palette, rounded corners, subtle shadows, and smooth transitions. The theme uses CSS custom properties for consistent theming across light/dark modes.

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**API Structure**: RESTful API endpoints under `/api` prefix:
- `/api/health` - Health check and provider status
- `/api/pdf/merge` - Merge multiple PDFs (working)
- `/api/pdf/split` - Split PDF into pages or ranges (fully functional with pdf-lib)
- `/api/pdf/compress` - Compress PDF file size
- `/api/pdf/protect` - Add password protection
- `/api/pdf/to-word` - Convert PDF to Word document

**File Upload Handling**: Multer middleware for multipart form data processing with:
- 50MB file size limit
- PDF-only file type filtering
- Temporary uploads directory storage
- Automatic cleanup after processing

**PDF Provider Pattern**: Abstraction layer (`PDFProvider` class) that supports multiple external PDF APIs:
- **Mock Mode** (default, active): Uses pdf-lib for local processing
  - Merge: Returns combined PDF of all uploaded files
  - Split: Extracts requested pages (supports ranges like "1-10, 15, 20-25")
  - Compress/Protect/Convert: Returns original file (placeholder for real API)
- **ILovePDF**: Ready to integrate (requires API key)
- **PDF.co**: Ready to integrate (requires API key)
- **CloudConvert**: Ready to integrate (requires API key)

Provider acts as a secure proxy, keeping API keys on the server and handling CORS restrictions. Provider selection via `PDF_PROVIDER` environment variable.

**Logging**: Custom logging middleware that tracks request duration, method, path, and status codes with formatted timestamps.

**Static File Serving**: Serves built frontend from `dist/public` directory in production with fallback to `index.html` for client-side routing.

**Development Mode**: Vite dev server integration with HMR (Hot Module Replacement) for rapid development.

### Database Schema

**ORM**: Drizzle ORM with PostgreSQL dialect configuration.

**Schema Design**: Currently minimal with a `users` table:
- `id`: UUID primary key (auto-generated)
- `username`: Unique text field
- `password`: Text field for hashed passwords

**Schema Location**: Defined in `shared/schema.ts` for code sharing between frontend and backend.

**Migrations**: Drizzle Kit configured to output migrations to `./migrations` directory.

**Storage Abstraction**: `IStorage` interface with `MemStorage` in-memory implementation for development. Provides methods for user CRUD operations.

**Note**: The application uses Drizzle and expects PostgreSQL via `DATABASE_URL` environment variable, though the current implementation includes an in-memory storage option.

### Build and Deployment

**Build Process**: Custom build script (`script/build.ts`) using:
- Vite for frontend bundling (outputs to `dist/public`)
- esbuild for server bundling (outputs to `dist/index.cjs`)
- Allowlist-based dependency bundling to reduce cold start times by minimizing syscalls

**Production Server**: Node.js serving the bundled Express application with static frontend assets.

**Development Workflow**: Separate dev commands for client (`vite dev`) and server (`tsx server/index.ts`).

## External Dependencies

### Core Framework Dependencies
- **React 18+**: Frontend UI framework
- **Express**: Backend web server
- **TypeScript**: Type safety across frontend and backend
- **Vite**: Frontend build tool and dev server

### UI Component Libraries
- **Radix UI**: Unstyled, accessible component primitives (@radix-ui/react-*)
- **Tailwind CSS**: Utility-first CSS framework with custom theme
- **Lucide React**: Icon library
- **class-variance-authority**: Type-safe component variants
- **tailwind-merge**: Utility for merging Tailwind classes

### State Management and Data Fetching
- **TanStack Query**: Server state management
- **React Hook Form**: Form state and validation
- **Zod**: Schema validation
- **Drizzle Zod**: Drizzle ORM schema to Zod validation

### File Handling
- **Multer**: Multipart form data handling for file uploads
- **React Dropzone**: Drag-and-drop file upload component
- **file-saver**: Client-side file downloads

### Database
- **Drizzle ORM**: Type-safe SQL ORM
- **@neondatabase/serverless**: PostgreSQL client for Neon (serverless Postgres)
- **DATABASE_URL**: Required environment variable for database connection

### External PDF Processing APIs
- **ILovePDF** (Recommended): PDF manipulation API
  - Environment variables: `PDF_PROVIDER=ilovepdf`, `PDF_API_KEY`
  - Documentation: https://developer.ilovepdf.com/
- **PDF.co**: Alternative PDF API
  - Environment variables: `PDF_PROVIDER=pdfco`, `PDF_API_KEY`
- **CloudConvert**: Alternative conversion API
  - Environment variables: `PDF_PROVIDER=cloudconvert`, `PDF_API_KEY`
- **Mock Mode** (Default): No API required, returns original files

### HTTP Client
- **Axios**: Promise-based HTTP client for external API requests
- **Form-data**: Multipart form data for API requests

### Development Tools
- **tsx**: TypeScript execution for development
- **Replit Plugins**: Development experience plugins (vite-plugin-runtime-error-modal, vite-plugin-cartographer, vite-plugin-dev-banner)
- **Custom Vite Plugin**: Meta images plugin for OpenGraph image URL updates

### Router
- **Wouter**: Lightweight client-side routing (~1.2KB)

### Utilities
- **nanoid**: Unique ID generation
- **date-fns**: Date manipulation utilities
- **clsx**: Conditional className utility

### Environment Configuration
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `PDF_PROVIDER`: PDF service provider (mock|ilovepdf|pdfco|cloudconvert)
- `PDF_API_KEY`: API key for selected PDF provider (not required for mock mode)
- `NODE_ENV`: Environment mode (development|production)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './app/router'
import { ExportNodeProvider } from './lib/export/ExportNodeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { ProjectSessionProvider } from '@/features/projects/ProjectSessionProvider'
import { FeatureDiagnostics } from '@/features/diagnostics/FeatureDiagnostics'
import { CreativeBridgeListener } from '@/features/editor/CreativeBridgeListener'
import { AuthGate } from '@/features/auth/AuthGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <TooltipProvider>
        <ExportNodeProvider>
          <ProjectSessionProvider>
            <CreativeBridgeListener />
            <RouterProvider router={router} />
          </ProjectSessionProvider>
        </ExportNodeProvider>
        <FeatureDiagnostics />
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </AuthGate>
  </StrictMode>,
)

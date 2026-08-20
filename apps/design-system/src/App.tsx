import { AppShell } from './app/AppShell'
import { ExportNodeProvider } from './lib/export/ExportNodeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { ProjectSessionProvider } from '@/features/projects/ProjectSessionProvider'
import { FeatureDiagnostics } from '@/features/diagnostics/FeatureDiagnostics'
import { CreativeBridgeListener } from '@/features/editor/CreativeBridgeListener'
import { AuthGate } from '@/features/auth/AuthGate'

function App() {
  return (
    <AuthGate><TooltipProvider>
      <ExportNodeProvider>
        <ProjectSessionProvider>
          <CreativeBridgeListener />
          <AppShell />
        </ProjectSessionProvider>
      </ExportNodeProvider>
      <FeatureDiagnostics />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider></AuthGate>
  )
}

export default App

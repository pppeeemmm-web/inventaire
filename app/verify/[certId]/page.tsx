import { CoaVerifyView } from '@/components/public/CoaVerifyView'
import { verifyCoaByCertId } from '@/lib/coa-verify'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'

export default async function VerifyCoaPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params
  const outcome = await verifyCoaByCertId(certId)
  const siteTheme = await loadPublicSiteTheme()
  return (
    <div style={{ minHeight: '100dvh', background: siteTheme.backgroundCss }}>
      <CoaVerifyView outcome={outcome} />
    </div>
  )
}

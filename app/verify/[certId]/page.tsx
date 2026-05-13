import { CoaVerifyView } from '@/components/public/CoaVerifyView'
import { verifyCoaByCertId } from '@/lib/coa-verify'

export default async function VerifyCoaPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params
  const outcome = await verifyCoaByCertId(certId)
  return (
    <div style={{ minHeight: '100dvh', background: '#edeae4' }}>
      <CoaVerifyView outcome={outcome} />
    </div>
  )
}

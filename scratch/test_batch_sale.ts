
import { createSaleOrder } from '../app/atelier/sales/actions'
import { createClient } from '../lib/supabase/server'

async function runTest() {
  console.log('🚀 Starting Batch Order System Test...')
  
  const sb = await createClient()
  
  // 1. Pick 3 test artworks (Available ones if possible)
  const { data: works } = await sb.from('Oeuvres').select('OeuvreID, Prix').limit(3)
  if (!works || works.length < 3) {
    console.error('❌ Not enough works to test batching.')
    return
  }
  
  const ids = works.map(w => w.OeuvreID)
  const total = works.reduce((s, w) => s + (w.Prix || 0), 0)
  
  console.log(`📦 Selected Batch: [${ids.join(', ')}]`)
  console.log(`💰 Calculated Total: € ${total}`)
  
  // 2. Prepare Mock FormData
  const fd = new FormData()
  ids.forEach(id => fd.append('oeuvre_ids', String(id)))
  fd.append('buyer_id', '1') // Assuming contact 1 exists
  fd.append('prix_catalogue', String(total))
  fd.append('prix_final', String(total))
  fd.append('notes', 'SYSTEM BATCH TEST')
  
  console.log('⚡ Triggering Batch Sale Order...')
  const res = await createSaleOrder(fd)
  
  if ('error' in res) {
    console.error('❌ TEST FAILED:', res.error)
  } else {
    console.log('✅ TEST SUCCESSFUL!')
    console.log('📄 Order ID:', res.order.id)
    console.log('📂 PDF Path:', res.order.pdf_path)
    
    // 3. Verify Database Update
    const { data: updatedWorks } = await sb.from('Oeuvres').select('OeuvreID, statusId').in('OeuvreID', ids)
    const allSold = updatedWorks?.every(w => w.statusId === 6)
    if (allSold) {
      console.log('✅ All works correctly marked as SOLD.')
    } else {
      console.warn('⚠️ Some works were not updated correctly.')
    }
  }
}

runTest().catch(console.error)

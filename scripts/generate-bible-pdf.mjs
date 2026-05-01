import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// ── Load Env ───────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const BUCKET = env.R2_VAULT_BUCKET || 'vault';

// ── PDF Creation ───────────────────────────────────────────────────────────
async function generateBiblePdf() {
  console.log('Generating Studio Bible PDF...');
  
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: 'The Studio Bible — Atelier PEM',
      Author: 'Art Engine',
    }
  });

  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(10).fillColor('#999999').text('ATELIER PIERRE EMMANUEL MOULIN', { characterSpacing: 2 });
    doc.fontSize(10).text('SYSTEM DOCUMENTATION V1.0 — 2026', { align: 'right' });
    doc.moveDown(2);

    // Title
    doc.fontSize(40).fillColor('#1a1a1a').text('The Studio Bible', { lineGap: 10 });
    doc.fontSize(14).fillColor('#666666').text('The Comprehensive Operating Manual for the PEM Hub Infrastructure.', { lineGap: 20 });
    
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#c8a86e').lineWidth(2).stroke();
    doc.moveDown(2);

    // Section 1
    doc.fontSize(24).fillColor('#c8a86e').text('01. The Grand Architecture', { lineGap: 10 });
    doc.fontSize(11).fillColor('#1a1a1a').text('The Hub is designed as a high-density executive dashboard, redistributed into a balanced 4-column matrix for optimal space utilization.', { lineGap: 15 });
    
    const surfaces = [
      ['01. The Atelier (Internal)', 'The nerve center for inventory, sales, and logistics.'],
      ['02. Collectionneurs (Private)', 'Gated portal for VIP clients and secure selection sharing.'],
      ['03. Galeries (Partner)', 'Collaborative surface for partners and consignment management.'],
      ['04. Portfolio (Public)', 'The editorial face with the Polaroid layout system.']
    ];

    surfaces.forEach(([title, desc]) => {
      doc.fontSize(12).fillColor('#1a1a1a').text(title, { indent: 20, lineGap: 4 });
      doc.fontSize(10).fillColor('#555555').text(desc, { indent: 40, lineGap: 10 });
    });

    doc.addPage();

    // Section 2
    doc.fontSize(24).fillColor('#c8a86e').text('02. The Atelier Portal: Tabs of Power', { lineGap: 15 });
    
    const tabs = [
      ['Overview (Tableau de Bord)', 'Displays "Live Intelligence" and counts of works.'],
      ['Inventory (Inventaire)', 'The master list of every artwork. Use the Work Drawer for details.'],
      ['Constellation', 'A visual map where X = Time and Y = Technique. Use the Lasso tool.'],
      ['Production (Kanban)', 'Tracks works in progress from Idée to En cours.'],
      ['Logistics & Shipments', 'Tracks the physical location of works.'],
      ['Vault (Le Coffre)', 'Digital document storage for COAs and contracts.']
    ];

    tabs.forEach(([title, desc]) => {
      doc.fontSize(14).fillColor('#1a1a1a').text(title, { lineGap: 4 });
      doc.fontSize(11).fillColor('#555555').text(desc, { lineGap: 12 });
    });

    doc.addPage();

    // Section 3
    doc.fontSize(24).fillColor('#c8a86e').text('03. UI Standards & Aesthetics', { lineGap: 15 });
    doc.fontSize(11).fillColor('#1a1a1a').text('The interface follows a "Strict Minimalist" rule to ensure the art remains the primary focus.', { lineGap: 10 });

    doc.fontSize(12).text('Stable Header Rule:', { lineGap: 4 });
    doc.fontSize(10).fillColor('#555555').text('The wordmark and navigation must remain static. No dynamic height shifts.', { lineGap: 10 });

    doc.fontSize(12).fillColor('#1a1a1a').text('The Polaroid System:', { lineGap: 4 });
    doc.fontSize(10).fillColor('#555555').text('Works are framed with equal 24px margins. Portrait works use a stable 80/20 info ratio.', { lineGap: 10 });

    doc.addPage();

    // Section 4
    doc.fontSize(24).fillColor('#c8a86e').text('04. Data Standard', { lineGap: 15 });
    doc.fontSize(11).fillColor('#1a1a1a').text('The system is only as good as the data entered.', { lineGap: 10 });

    doc.fontSize(12).text('Typography:', { lineGap: 4 });
    doc.fontSize(10).fillColor('#555555').text('- Capitalize proper nouns: Oil on Canvas, not oil on canvas.\n- Dimensions: Use × (multiplication), not x.\n- Metric: cm only.', { lineGap: 10 });

    doc.fontSize(12).fillColor('#1a1a1a').text('Imagery:', { lineGap: 4 });
    doc.fontSize(10).fillColor('#555555').text('- Format: .avif (Primary) or .webp.\n- Resolution: Minimum 2000px on the long edge.', { lineGap: 10 });

    // Footer on last page
    doc.fontSize(8).fillColor('#aaaaaa').text('Confidential. Property of Atelier Pierre Emmanuel Moulin. Generated by Art Engine.', 50, 780, { align: 'center' });

    doc.end();
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function run() {
  try {
    const pdfBuffer = await generateBiblePdf();
    const filename = `Studio_Bible_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    console.log(`Uploading ${filename} to R2...`);
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));

    console.log('Inserting document record into Supabase...');
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase
      .from('document')
      .insert({
        name: filename,
        kind: 'autre',
        storage_path: filename,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        notes: 'Studio Bible — Complete Manual (PDF Version)',
        doc_date: new Date().toISOString().slice(0, 10)
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Success! Bible landed in the vault.');
    console.log('Document ID:', data.id);
    
    // Also save a local copy
    const localPath = path.resolve(process.cwd(), 'Atelier_Studio_Bible.pdf');
    fs.writeFileSync(localPath, pdfBuffer);
    console.log('Local copy saved as Atelier_Studio_Bible.pdf');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();

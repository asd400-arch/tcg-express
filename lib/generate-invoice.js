import PDFDocument from 'pdfkit';
import { supabaseAdmin } from './supabase-server';
import { sendTemplateEmail } from './send-email';
import { notify } from './notify';

const BUCKET = 'express-uploads';

async function ensureInvoiceBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some(b => b.id === BUCKET);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
    });
  } else {
    // Ensure PDF mime type is allowed on existing bucket
    await supabaseAdmin.storage.updateBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
    });
  }
}

export async function generateInvoice(jobId) {
  console.log(`[Invoice] Generating invoice for job ${jobId}`);

  // 0. Ensure bucket allows PDFs
  try {
    await ensureInvoiceBucket();
  } catch (bucketErr) {
    console.error('[Invoice] Bucket setup error:', bucketErr.message);
    // Continue anyway — bucket may already exist and work
  }

  // 1. Fetch job + client + driver data
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) throw new Error('Job not found');

  const [clientRes, driverRes] = await Promise.all([
    supabaseAdmin.from('express_users').select('contact_name, email, phone, company_name').eq('id', job.client_id).single(),
    job.assigned_driver_id
      ? supabaseAdmin.from('express_users').select('contact_name, email, phone, vehicle_type, vehicle_plate').eq('id', job.assigned_driver_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const client = clientRes.data;
  const driver = driverRes.data;
  const invoiceNumber = `INV-${job.job_number || jobId.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-SG', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // 2. Build PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  // Header
  doc.fontSize(22).font('Helvetica-Bold').text('TCG EXPRESS', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Delivery Receipt', 50, 76);
  doc.fillColor('#000000');

  // Invoice info (right aligned)
  doc.fontSize(10).font('Helvetica-Bold').text(invoiceNumber, 350, 50, { width: 200, align: 'right' });
  doc.font('Helvetica').text(invoiceDate, 350, 65, { width: 200, align: 'right' });
  if (job.delivered_at) {
    doc.text(`Delivered: ${new Date(job.delivered_at).toLocaleDateString('en-SG')}`, 350, 80, { width: 200, align: 'right' });
  }

  // Divider
  doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#e2e8f0').stroke();

  let y = 120;

  // Addresses
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('PICKUP', 50, y);
  y += 16;
  doc.fontSize(10).font('Helvetica').fillColor('#374151');
  doc.text(job.pickup_address || '—', 50, y, { width: 220 });
  y = doc.y + 4;
  if (job.pickup_contact) { doc.text(`Contact: ${job.pickup_contact} ${job.pickup_phone || ''}`, 50, y, { width: 220 }); y = doc.y + 4; }

  let yRight = 120;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('DELIVERY', 310, yRight);
  yRight += 16;
  doc.fontSize(10).font('Helvetica').fillColor('#374151');
  doc.text(job.delivery_address || '—', 310, yRight, { width: 220 });
  yRight = doc.y + 4;
  if (job.delivery_contact) { doc.text(`Contact: ${job.delivery_contact} ${job.delivery_phone || ''}`, 310, yRight, { width: 220 }); yRight = doc.y + 4; }

  y = Math.max(y, yRight) + 16;

  // Item Details
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
  y += 12;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('ITEM DETAILS', 50, y);
  y += 18;
  doc.fontSize(10).font('Helvetica').fillColor('#374151');

  const details = [
    ['Description', job.item_description],
    ['Category', job.item_category],
    ['Weight', job.item_weight ? `${job.item_weight} kg` : null],
    ['Dimensions', job.item_dimensions],
    ['Vehicle', job.vehicle_required],
  ].filter(([, v]) => v);

  for (const [label, value] of details) {
    doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true, width: 250 });
    doc.font('Helvetica').text(String(value));
    y = doc.y + 4;
  }

  y += 10;

  // Financial Summary
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
  y += 12;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('PAYMENT SUMMARY', 50, y);
  y += 18;
  doc.fontSize(10).font('Helvetica').fillColor('#374151');

  const financial = [
    ['Total Amount', job.final_amount ? `$${parseFloat(job.final_amount).toFixed(2)}` : '—'],
    ['Commission', job.commission_amount ? `$${parseFloat(job.commission_amount).toFixed(2)} (${job.commission_rate || 15}%)` : '—'],
    ['Driver Payout', job.driver_payout ? `$${parseFloat(job.driver_payout).toFixed(2)}` : '—'],
  ];

  for (const [label, value] of financial) {
    doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true });
    doc.font('Helvetica').text(value);
    y = doc.y + 4;
  }

  y += 10;

  // Driver Info
  if (driver) {
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('DRIVER', 50, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(`Name: ${driver.contact_name || '—'}`, 50, y); y = doc.y + 4;
    if (driver.vehicle_type) { doc.text(`Vehicle: ${driver.vehicle_type} ${driver.vehicle_plate ? `(${driver.vehicle_plate})` : ''}`, 50, y); y = doc.y + 4; }
  }

  y += 10;

  // Photos — fetch and embed
  const photoEntries = [
    ['Pickup Photo', job.pickup_photo],
    ['Delivery Photo', job.delivery_photo],
  ].filter(([, url]) => url);

  if (photoEntries.length > 0) {
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('PHOTOS', 50, y);
    y += 18;

    for (const [label, url] of photoEntries) {
      try {
        const imgRes = await fetch(url);
        if (imgRes.ok) {
          const arrBuf = await imgRes.arrayBuffer();
          const imgBuf = Buffer.from(arrBuf);
          // Calculate actual rendered size using fit box
          const maxW = 220, maxH = 200;
          let imgObj;
          try { imgObj = doc.openImage(imgBuf); } catch { continue; }
          const scale = Math.min(maxW / imgObj.width, maxH / imgObj.height, 1);
          const renderedH = Math.round(imgObj.height * scale);
          doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(label, 50, y);
          y += 14;
          if (y + renderedH + 10 > 750) { doc.addPage(); y = 50; }
          doc.image(imgBuf, 50, y, { fit: [maxW, maxH] });
          y += renderedH + 12;
        }
      } catch {
        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text(`${label}: (unavailable)`, 50, y);
        y = doc.y + 8;
      }
    }
  }

  // Signature
  if (job.customer_signature_url) {
    if (y + 140 > 750) { doc.addPage(); y = 50; }
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('CUSTOMER SIGNATURE', 50, y);
    y += 18;

    try {
      const sigRes = await fetch(job.customer_signature_url);
      if (sigRes.ok) {
        const arrBuf = await sigRes.arrayBuffer();
        const sigBuf = Buffer.from(arrBuf);
        let sigObj;
        try { sigObj = doc.openImage(sigBuf); } catch { sigObj = null; }
        if (sigObj) {
          const sigScale = Math.min(180 / sigObj.width, 80 / sigObj.height, 1);
          const sigH = Math.round(sigObj.height * sigScale);
          doc.image(sigBuf, 50, y, { fit: [180, 80] });
          y += sigH + 8;
        }
      }
    } catch {
      // Skip signature image
    }

    if (job.signer_name) {
      doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`Signed by: ${job.signer_name}`, 50, y);
      y = doc.y + 4;
    }
    if (job.signed_at) {
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Date: ${new Date(job.signed_at).toLocaleString('en-SG')}`, 50, y);
      y = doc.y + 8;
    }
  }

  // Footer
  if (y + 60 > 750) { doc.addPage(); y = 50; }
  y += 16;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
  y += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#059669').text('Received in good condition', 50, y);
  y = doc.y + 8;
  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text('TCG Express — Tech Chain Global Pte Ltd', 50, y);
  y = doc.y + 4;
  doc.text('This is a system-generated delivery receipt.', 50, y);

  doc.end();

  // 3. Collect PDF buffer
  const pdfBuffer = await new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // 4. Upload to Supabase Storage
  const storagePath = `invoices/${jobId}/${invoiceNumber}.pdf`;
  console.log(`[Invoice] Uploading PDF (${(pdfBuffer.length / 1024).toFixed(1)}KB) to ${BUCKET}/${storagePath}`);

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    console.error(`[Invoice] Upload failed: ${uploadErr.message}`, { bucket: BUCKET, path: storagePath, size: pdfBuffer.length });
    throw new Error(`Failed to upload invoice PDF: ${uploadErr.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = urlData?.publicUrl;
  console.log(`[Invoice] Public URL: ${publicUrl}`);

  // 5. Save invoice_url to job
  const { error: updateErr } = await supabaseAdmin
    .from('express_jobs')
    .update({ invoice_url: publicUrl })
    .eq('id', jobId);

  if (updateErr) {
    console.error(`[Invoice] DB update failed: ${updateErr.message}`);
  }

  // 6. Notify client
  try {
    if (job.client_id) {
      await notify(job.client_id, {
        type: 'delivery_receipt',
        category: 'delivery_status',
        title: `Delivery receipt ready - ${job.job_number}`,
        message: 'Your delivery receipt PDF is ready to download.',
        referenceId: jobId,
      });
    }
    if (client?.email) {
      await sendTemplateEmail(client.email, 'delivery_receipt', {
        jobNumber: job.job_number,
        signerName: job.signer_name || '—',
        amount: job.final_amount ? `$${parseFloat(job.final_amount).toFixed(2)}` : '—',
        downloadUrl: publicUrl,
      });
    }
  } catch (notifyErr) {
    console.error('[Invoice] Notification error (non-fatal):', notifyErr.message);
  }

  console.log(`[Invoice] Complete for job ${jobId}: ${invoiceNumber}`);
  return publicUrl;
}

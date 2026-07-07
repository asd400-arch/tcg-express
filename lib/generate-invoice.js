import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin } from './supabase-server';
import { sendTemplateEmail } from './send-email';
import { notify } from './notify';
import { getLocaleConfig, formatCurrency } from './locale/config';

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
    await supabaseAdmin.storage.updateBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
    });
  }
}

async function embedImageSafe(pdfDoc, url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    const buf = await resp.arrayBuffer();
    if (ct.includes('png')) return await pdfDoc.embedPng(buf);
    return await pdfDoc.embedJpg(buf);
  } catch {
    return null;
  }
}

export async function generateInvoice(jobId) {
  console.log(`[Invoice] Generating invoice for job ${jobId}`);

  try {
    await ensureInvoiceBucket();
  } catch (bucketErr) {
    console.error('[Invoice] Bucket setup error:', bucketErr.message);
  }

  // 1. Fetch job + client + driver
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) throw new Error('Job not found');

  const [clientRes, driverRes] = await Promise.all([
    supabaseAdmin.from('express_users').select('contact_name, email, phone, company_name, locale').eq('id', job.client_id).single(),
    job.assigned_driver_id
      ? supabaseAdmin.from('express_users').select('contact_name, email, phone, vehicle_type, vehicle_plate').eq('id', job.assigned_driver_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const client = clientRes.data;
  const driver = driverRes.data;
  const clientLocale = client?.locale || 'sg';
  const dateLocale = clientLocale === 'id' ? 'id-ID' : 'en-SG';
  const invoiceNumber = `INV-${job.job_number || jobId.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString(dateLocale, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // 2. Build PDF with pdf-lib (no filesystem font dependency)
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const LM = 50;
  const RM = 545;
  const dark   = rgb(0.118, 0.161, 0.231);
  const slate  = rgb(0.392, 0.455, 0.545);
  const muted  = rgb(0.580, 0.620, 0.670);
  const green  = rgb(0.020, 0.592, 0.412);
  const hairline = rgb(0.886, 0.910, 0.941);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 50;

  const t = (str, x, yPos, { font = regular, size = 10, color = dark } = {}) => {
    page.drawText(String(str ?? ''), { x, y: yPos, size, font, color });
  };

  const line = (yPos) => {
    page.drawLine({
      start: { x: LM, y: yPos }, end: { x: RM, y: yPos },
      thickness: 0.5, color: hairline,
    });
  };

  const maybeNewPage = (needed = 60) => {
    if (y - needed < 50) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 50;
    }
  };

  const truncAddr = (s, max = 35) => {
    if (!s) return '—';
    return s.length > max ? s.slice(0, max - 3) + '...' : s;
  };

  // ─── Header ───
  t('TCG EXPRESS', LM, y, { font: bold, size: 22, color: dark });
  t('Delivery Receipt', LM, y - 20, { size: 10, color: slate });
  t(invoiceNumber, RM - 200, y, { font: bold, size: 10 });
  t(invoiceDate, RM - 200, y - 15, { size: 9, color: slate });
  if (job.delivered_at) {
    t(`Delivered: ${new Date(job.delivered_at).toLocaleDateString(dateLocale)}`, RM - 200, y - 30, { size: 9, color: slate });
  }
  y -= 46;
  line(y);
  y -= 16;

  // ─── Addresses ───
  t('PICKUP', LM, y, { font: bold, size: 11 });
  t('DELIVERY', 310, y, { font: bold, size: 11 });
  y -= 16;
  t(truncAddr(job.pickup_address), LM, y, { size: 10 });
  t(truncAddr(job.delivery_address), 310, y, { size: 10 });
  y -= 14;
  if (job.pickup_contact) {
    t(`Contact: ${job.pickup_contact}${job.pickup_phone ? ' ' + job.pickup_phone : ''}`, LM, y, { size: 9, color: slate });
  }
  if (job.delivery_contact) {
    t(`Contact: ${job.delivery_contact}${job.delivery_phone ? ' ' + job.delivery_phone : ''}`, 310, y, { size: 9, color: slate });
  }
  y -= 20;

  // ─── Item Details ───
  maybeNewPage(80);
  line(y);
  y -= 14;
  t('ITEM DETAILS', LM, y, { font: bold, size: 11 });
  y -= 16;
  const details = [
    ['Description', job.item_description],
    ['Category',    job.item_category],
    ['Weight',      job.item_weight ? `${job.item_weight} kg` : null],
    ['Dimensions',  job.item_dimensions],
    ['Vehicle',     job.vehicle_required],
  ].filter(([, v]) => v);
  for (const [label, value] of details) {
    const labelStr = `${label}: `;
    t(labelStr, LM, y, { font: bold, size: 10 });
    t(String(value), LM + bold.widthOfTextAtSize(labelStr, 10), y, { size: 10 });
    y -= 14;
  }
  y -= 6;

  // ─── Payment Summary ───
  maybeNewPage(80);
  line(y);
  y -= 14;
  t('PAYMENT SUMMARY', LM, y, { font: bold, size: 11 });
  y -= 16;
  const financial = [
    ['Total Amount',  job.final_amount      ? formatCurrency(parseFloat(job.final_amount), clientLocale)      : '—'],
    ['Commission',    job.commission_amount  ? `${formatCurrency(parseFloat(job.commission_amount), clientLocale)} (${job.commission_rate || 15}%)` : '—'],
    ['Driver Payout', job.driver_payout     ? formatCurrency(parseFloat(job.driver_payout), clientLocale)     : '—'],
  ];
  for (const [label, value] of financial) {
    const labelStr = `${label}: `;
    t(labelStr, LM, y, { font: bold, size: 10 });
    t(value, LM + bold.widthOfTextAtSize(labelStr, 10), y, { size: 10 });
    y -= 14;
  }
  y -= 6;

  // ─── Driver ───
  if (driver) {
    maybeNewPage(60);
    line(y);
    y -= 14;
    t('DRIVER', LM, y, { font: bold, size: 11 });
    y -= 16;
    t(`Name: ${driver.contact_name || '—'}`, LM, y, { size: 10 });
    y -= 14;
    if (driver.vehicle_type) {
      t(`Vehicle: ${driver.vehicle_type}${driver.vehicle_plate ? ` (${driver.vehicle_plate})` : ''}`, LM, y, { size: 10 });
      y -= 14;
    }
    y -= 6;
  }

  // ─── Photos ───
  const photoEntries = [
    ['Pickup Photo',   job.pickup_photo],
    ['Delivery Photo', job.delivery_photo],
  ].filter(([, url]) => url);

  if (photoEntries.length > 0) {
    const SLOT_W = 242; // (495 - 10) / 2  — two columns with 10pt gap
    const GAP    = 10;
    const MAX_H  = 180;

    maybeNewPage(260); // label(14) + header(16) + caption(14) + image(180) + margins
    line(y);
    y -= 14;
    t('PHOTOS', LM, y, { font: bold, size: 11 });
    y -= 16;

    if (photoEntries.length === 1) {
      // Single photo — left-aligned
      const [label, url] = photoEntries[0];
      const img = await embedImageSafe(pdfDoc, url);
      if (img) {
        const dims = img.scaleToFit(SLOT_W, MAX_H);
        t(label, LM, y, { size: 9, color: slate });
        y -= 14;
        page.drawImage(img, { x: LM, y: y - dims.height, width: dims.width, height: dims.height });
        y -= dims.height + 12;
      } else {
        t(`${label}: (unavailable)`, LM, y, { size: 9, color: muted });
        y -= 14;
      }
    } else {
      // Two photos — side by side
      const [label0, url0] = photoEntries[0];
      const [label1, url1] = photoEntries[1];
      const [img0, img1] = await Promise.all([
        embedImageSafe(pdfDoc, url0),
        embedImageSafe(pdfDoc, url1),
      ]);
      const dims0 = img0 ? img0.scaleToFit(SLOT_W, MAX_H) : null;
      const dims1 = img1 ? img1.scaleToFit(SLOT_W, MAX_H) : null;
      const rowH  = Math.max(dims0?.height ?? 0, dims1?.height ?? 0);

      // Caption row
      t(label0, LM,               y, { size: 9, color: slate });
      t(label1, LM + SLOT_W + GAP, y, { size: 9, color: slate });
      y -= 14;

      // Image row
      if (img0 && dims0) {
        page.drawImage(img0, { x: LM, y: y - rowH, width: dims0.width, height: dims0.height });
      } else {
        t('(unavailable)', LM, y - 12, { size: 9, color: muted });
      }
      if (img1 && dims1) {
        page.drawImage(img1, { x: LM + SLOT_W + GAP, y: y - rowH, width: dims1.width, height: dims1.height });
      } else {
        t('(unavailable)', LM + SLOT_W + GAP, y - 12, { size: 9, color: muted });
      }
      y -= rowH + 12;
    }

    y -= 6;
  }

  // ─── Customer Signature ───
  if (job.customer_signature_url) {
    maybeNewPage(140);
    line(y);
    y -= 14;
    t('CUSTOMER SIGNATURE', LM, y, { font: bold, size: 11 });
    y -= 16;

    const sigImg = await embedImageSafe(pdfDoc, job.customer_signature_url);
    if (sigImg) {
      const dims = sigImg.scaleToFit(180, 80);
      if (y - dims.height < 50) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - 50;
      }
      page.drawImage(sigImg, { x: LM, y: y - dims.height, width: dims.width, height: dims.height });
      y -= dims.height + 8;
    }

    if (job.signer_name) {
      t(`Signed by: ${job.signer_name}`, LM, y, { size: 10 });
      y -= 14;
    }
    if (job.signed_at) {
      t(`Date: ${new Date(job.signed_at).toLocaleString(dateLocale)}`, LM, y, { size: 9, color: slate });
      y -= 14;
    }
    y -= 6;
  }

  // ─── Footer ───
  maybeNewPage(60);
  y -= 10;
  line(y);
  y -= 16;
  t('Received in good condition', LM, y, { font: bold, size: 10, color: green });
  y -= 14;
  t('TCG Express — Tech Chain Global Pte Ltd', LM, y, { size: 8, color: muted });
  y -= 12;
  t('This is a system-generated delivery receipt.', LM, y, { size: 8, color: muted });

  // 3. Save PDF
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

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
        amount: job.final_amount ? formatCurrency(parseFloat(job.final_amount), clientLocale) : '—',
        downloadUrl: publicUrl,
      });
    }
  } catch (notifyErr) {
    console.error('[Invoice] Notification error (non-fatal):', notifyErr.message);
  }

  console.log(`[Invoice] Complete for job ${jobId}: ${invoiceNumber}`);
  return publicUrl;
}

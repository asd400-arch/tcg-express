import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function ensureBucket(name) {
  const { data } = await supabaseAdmin.storage.getBucket(name);
  if (!data) {
    await supabaseAdmin.storage.createBucket(name, { public: true });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Get job with client info
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('*, client:client_id(contact_name, company_name, email, phone)')
      .eq('id', id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get driver info if assigned
    let driver = null;
    if (job.assigned_driver_id) {
      const { data: d } = await supabaseAdmin
        .from('express_users')
        .select('contact_name, phone, vehicle_type, vehicle_plate')
        .eq('id', job.assigned_driver_id)
        .single();
      driver = d;
    }

    // Get bid/transaction for pricing
    let finalAmount = parseFloat(job.final_amount) || 0;
    if (!finalAmount && job.assigned_bid_id) {
      const { data: bid } = await supabaseAdmin
        .from('express_bids')
        .select('amount, equipment_charges')
        .eq('id', job.assigned_bid_id)
        .single();
      if (bid) finalAmount = parseFloat(bid.amount) || 0;
    }
    if (!finalAmount) {
      finalAmount = parseFloat(job.budget_min) || parseFloat(job.budget_max) || 0;
    }

    // Parse equipment charges
    let equipmentCharges = [];
    if (job.assigned_bid_id) {
      const { data: bid } = await supabaseAdmin
        .from('express_bids')
        .select('equipment_charges')
        .eq('id', job.assigned_bid_id)
        .single();
      if (bid?.equipment_charges) {
        equipmentCharges = Array.isArray(bid.equipment_charges) ? bid.equipment_charges : [];
      }
    }

    const equipTotal = equipmentCharges.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const subtotal = finalAmount;
    const grandTotal = subtotal + equipTotal;

    // Generate PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // 50 margin each side
      const blue = '#2563eb';
      const dark = '#1e293b';
      const gray = '#64748b';
      const lightBg = '#f8fafc';

      // ─── Header ───
      doc.fontSize(24).fillColor(blue).font('Helvetica-Bold').text('TCG Express', 50, 50);
      doc.fontSize(9).fillColor(gray).font('Helvetica')
        .text('Tech Chain Global Pte Ltd', 50, 80)
        .text('Singapore', 50, 92)
        .text('www.techchainglobal.com', 50, 104);

      // Invoice title + number (right aligned)
      doc.fontSize(28).fillColor(dark).font('Helvetica-Bold').text('INVOICE', 350, 50, { width: 200, align: 'right' });
      doc.fontSize(10).fillColor(gray).font('Helvetica')
        .text(`Invoice #: ${job.job_number || 'N/A'}`, 350, 85, { width: 200, align: 'right' })
        .text(`Date: ${new Date().toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}`, 350, 99, { width: 200, align: 'right' });

      if (job.completed_at || job.updated_at) {
        const completedDate = new Date(job.completed_at || job.updated_at).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
        doc.text(`Completed: ${completedDate}`, 350, 113, { width: 200, align: 'right' });
      }

      // Divider
      doc.moveTo(50, 135).lineTo(545, 135).strokeColor('#e2e8f0').lineWidth(1).stroke();

      // ─── Bill To / Delivery Info ───
      let y = 150;
      doc.fontSize(9).fillColor(blue).font('Helvetica-Bold').text('BILL TO', 50, y);
      doc.fontSize(10).fillColor(dark).font('Helvetica-Bold').text(job.client?.company_name || job.client?.contact_name || 'Customer', 50, y + 14);
      doc.fontSize(9).fillColor(gray).font('Helvetica');
      if (job.client?.contact_name && job.client?.company_name) doc.text(job.client.contact_name, 50, y + 28);
      if (job.client?.email) doc.text(job.client.email, 50, y + 40);
      if (job.client?.phone) doc.text(job.client.phone, 50, y + 52);

      doc.fontSize(9).fillColor(blue).font('Helvetica-Bold').text('DELIVERY DETAILS', 300, y);
      doc.fontSize(9).fillColor(gray).font('Helvetica');
      doc.text(`Urgency: ${(job.urgency || 'standard').toUpperCase()}`, 300, y + 14);
      doc.text(`Vehicle: ${job.vehicle_required || 'Any'}`, 300, y + 28);
      if (job.item_weight) doc.text(`Weight: ${job.item_weight} kg`, 300, y + 42);
      if (driver) {
        doc.text(`Driver: ${driver.contact_name}`, 300, y + 56);
        doc.text(`Vehicle: ${driver.vehicle_plate || ''}`, 300, y + 68);
      }

      // ─── Addresses ───
      y = 240;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      y += 10;

      // Pickup
      doc.fontSize(9).fillColor(blue).font('Helvetica-Bold').text('PICKUP', 50, y);
      doc.fontSize(9).fillColor(dark).font('Helvetica').text(job.pickup_address || '—', 50, y + 14, { width: 220 });
      if (job.pickup_contact) doc.fontSize(8).fillColor(gray).text(`${job.pickup_contact} ${job.pickup_phone || ''}`, 50, y + 38);

      // Delivery
      doc.fontSize(9).fillColor(blue).font('Helvetica-Bold').text('DELIVERY', 300, y);
      doc.fontSize(9).fillColor(dark).font('Helvetica').text(job.delivery_address || '—', 300, y + 14, { width: 220 });
      if (job.delivery_contact) doc.fontSize(8).fillColor(gray).text(`${job.delivery_contact} ${job.delivery_phone || ''}`, 300, y + 38);

      // ─── Item Description ───
      y = 310;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      y += 10;

      // Table header
      doc.rect(50, y, pageWidth, 22).fill('#f1f5f9');
      doc.fontSize(9).fillColor(gray).font('Helvetica-Bold');
      doc.text('DESCRIPTION', 58, y + 6);
      doc.text('CATEGORY', 280, y + 6);
      doc.text('AMOUNT', 460, y + 6, { width: 80, align: 'right' });

      // Table row - delivery service
      y += 28;
      doc.fontSize(10).fillColor(dark).font('Helvetica');
      doc.text(job.item_description || 'Delivery Service', 58, y);
      doc.text(job.item_category || '—', 280, y);
      doc.font('Helvetica-Bold').text(`$${subtotal.toFixed(2)}`, 460, y, { width: 80, align: 'right' });

      // Equipment charges rows
      if (equipmentCharges.length > 0) {
        equipmentCharges.forEach((eq) => {
          y += 22;
          doc.fontSize(9).fillColor(gray).font('Helvetica');
          doc.text(`Equipment: ${eq.name}`, 58, y);
          doc.font('Helvetica-Bold').fillColor(dark).text(`$${parseFloat(eq.amount).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
        });
      }

      // ─── Totals ───
      y += 35;
      doc.moveTo(350, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      y += 10;

      doc.fontSize(10).fillColor(gray).font('Helvetica').text('Subtotal', 350, y);
      doc.font('Helvetica-Bold').fillColor(dark).text(`$${subtotal.toFixed(2)}`, 460, y, { width: 80, align: 'right' });

      if (equipTotal > 0) {
        y += 18;
        doc.fontSize(10).fillColor(gray).font('Helvetica').text('Equipment', 350, y);
        doc.font('Helvetica-Bold').fillColor(dark).text(`$${equipTotal.toFixed(2)}`, 460, y, { width: 80, align: 'right' });
      }

      y += 22;
      doc.rect(345, y - 4, 205, 26).fill(blue);
      doc.fontSize(12).fillColor('white').font('Helvetica-Bold');
      doc.text('TOTAL', 355, y + 2);
      doc.text(`$${grandTotal.toFixed(2)}`, 460, y + 2, { width: 80, align: 'right' });

      // ─── Payment Info ───
      y += 45;
      doc.fontSize(9).fillColor(blue).font('Helvetica-Bold').text('PAYMENT', 50, y);
      y += 14;
      doc.fontSize(9).fillColor(gray).font('Helvetica');
      doc.text('Payment method: Wallet / PayNow', 50, y);
      doc.text(`Status: ${job.status === 'confirmed' || job.status === 'completed' ? 'PAID' : 'PENDING'}`, 50, y + 14);

      // ─── Footer ───
      const footerY = doc.page.height - 60;
      doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
        .text('Thank you for choosing TCG Express. For questions, contact support@techchainglobal.com', 50, footerY, { width: pageWidth, align: 'center' });

      doc.end();
    });

    // Upload to Supabase Storage
    const bucket = 'express-uploads';
    await ensureBucket(bucket);
    const fileName = `invoices/${job.job_number || id}_${Date.now()}.pdf`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return NextResponse.json({ error: 'Failed to upload invoice' }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    const invoiceUrl = urlData.publicUrl;

    // Save URL to job
    await supabaseAdmin
      .from('express_jobs')
      .update({ invoice_url: invoiceUrl })
      .eq('id', id);

    return NextResponse.json({ url: invoiceUrl });
  } catch (err) {
    console.error('Invoice generation error:', err);
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}

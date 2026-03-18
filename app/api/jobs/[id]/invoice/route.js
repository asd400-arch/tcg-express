import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getLocaleConfig, formatCurrency } from '../../../../../lib/locale/config';

async function ensureBucket(name) {
  const { data } = await supabaseAdmin.storage.getBucket(name);
  if (!data) {
    await supabaseAdmin.storage.createBucket(name, { public: true });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('*, client:client_id(contact_name, company_name, email, phone, locale)')
      .eq('id', id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let driver = null;
    if (job.assigned_driver_id) {
      const { data: d } = await supabaseAdmin
        .from('express_users')
        .select('contact_name, phone, vehicle_type, vehicle_plate')
        .eq('id', job.assigned_driver_id)
        .single();
      driver = d;
    }

    const clientLocale = job.client?.locale || 'sg';
    const localeConfig = getLocaleConfig(clientLocale);
    const dateLocale = clientLocale === 'id' ? 'id-ID' : 'en-SG';

    let finalAmount = parseFloat(job.final_amount) || 0;
    if (!finalAmount && job.assigned_bid_id) {
      const { data: bid } = await supabaseAdmin
        .from('express_bids')
        .select('amount')
        .eq('id', job.assigned_bid_id)
        .single();
      if (bid) finalAmount = parseFloat(bid.amount) || 0;
    }
    if (!finalAmount) {
      finalAmount = parseFloat(job.budget_min) || parseFloat(job.budget_max) || 0;
    }

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

    // Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const blue = rgb(0.145, 0.388, 0.922);
    const dark = rgb(0.118, 0.161, 0.231);
    const gray = rgb(0.392, 0.455, 0.545);
    const lightGray = rgb(0.945, 0.953, 0.965);
    const white = rgb(1, 1, 1);
    const LM = 50;
    const RM = 545;

    let y = 792;

    const text = (str, x, yPos, { font = regular, size = 10, color = dark, align = 'left', maxWidth = 0 } = {}) => {
      const s = String(str || '');
      if (align === 'right' && maxWidth) {
        const w = font.widthOfTextAtSize(s, size);
        x = x + maxWidth - w;
      }
      page.drawText(s, { x, y: yPos, size, font, color });
    };

    const drawLine = (x1, yPos, x2) => {
      page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.5, color: rgb(0.886, 0.910, 0.941) });
    };

    const drawRect = (x, yPos, w, h, color) => {
      page.drawRectangle({ x, y: yPos, width: w, height: h, color });
    };

    // ─── Header ───
    text('TCG Express', LM, y, { font: bold, size: 22, color: blue });
    y -= 18;
    text('Tech Chain Global Pte Ltd', LM, y, { size: 9, color: gray });
    y -= 12;
    text(localeConfig.country, LM, y, { size: 9, color: gray });
    y -= 12;
    text('www.techchainglobal.com', LM, y, { size: 9, color: gray });

    // Invoice title (right)
    text('INVOICE', 350, 792, { font: bold, size: 26, color: dark, align: 'right', maxWidth: 195 });
    text('Invoice #: ' + (job.job_number || 'N/A'), 350, 772, { size: 10, color: gray, align: 'right', maxWidth: 195 });
    const today = new Date().toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' });
    text('Date: ' + today, 350, 758, { size: 10, color: gray, align: 'right', maxWidth: 195 });
    if (job.completed_at || job.updated_at) {
      const cd = new Date(job.completed_at || job.updated_at).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' });
      text('Completed: ' + cd, 350, 744, { size: 10, color: gray, align: 'right', maxWidth: 195 });
    }

    y -= 18;
    drawLine(LM, y, RM);

    // ─── Bill To / Delivery Info ───
    y -= 18;
    text('BILL TO', LM, y, { font: bold, size: 9, color: blue });
    text('DELIVERY DETAILS', 300, y, { font: bold, size: 9, color: blue });

    y -= 16;
    text(job.client?.company_name || job.client?.contact_name || 'Customer', LM, y, { font: bold, size: 10 });
    text('Urgency: ' + (job.urgency || 'standard').toUpperCase(), 300, y, { size: 9, color: gray });

    y -= 14;
    if (job.client?.contact_name && job.client?.company_name) text(job.client.contact_name, LM, y, { size: 9, color: gray });
    text('Vehicle: ' + (job.vehicle_required || 'Any'), 300, y, { size: 9, color: gray });

    y -= 14;
    if (job.client?.email) text(job.client.email, LM, y, { size: 9, color: gray });
    if (job.item_weight) text('Weight: ' + job.item_weight + ' kg', 300, y, { size: 9, color: gray });

    y -= 14;
    if (job.client?.phone) text(job.client.phone, LM, y, { size: 9, color: gray });
    if (driver) text('Driver: ' + driver.contact_name, 300, y, { size: 9, color: gray });

    if (driver?.vehicle_plate) {
      y -= 14;
      text('Plate: ' + driver.vehicle_plate, 300, y, { size: 9, color: gray });
    }

    // ─── Addresses ───
    y -= 20;
    drawLine(LM, y, RM);
    y -= 18;

    text('PICKUP', LM, y, { font: bold, size: 9, color: blue });
    text('DELIVERY', 300, y, { font: bold, size: 9, color: blue });

    y -= 14;
    const truncAddr = (addr, max = 45) => {
      if (!addr) return '-';
      return addr.length > max ? addr.substring(0, max - 3) + '...' : addr;
    };
    text(truncAddr(job.pickup_address), LM, y, { size: 9 });
    text(truncAddr(job.delivery_address), 300, y, { size: 9 });

    if (job.pickup_contact || job.delivery_contact) {
      y -= 14;
      if (job.pickup_contact) text((job.pickup_contact || '') + ' ' + (job.pickup_phone || ''), LM, y, { size: 8, color: gray });
      if (job.delivery_contact) text((job.delivery_contact || '') + ' ' + (job.delivery_phone || ''), 300, y, { size: 8, color: gray });
    }

    // ─── Table ───
    y -= 28;
    drawLine(LM, y, RM);
    y -= 4;

    drawRect(LM, y - 16, RM - LM, 20, lightGray);
    text('DESCRIPTION', LM + 8, y - 10, { font: bold, size: 9, color: gray });
    text('CATEGORY', 280, y - 10, { font: bold, size: 9, color: gray });
    text('AMOUNT', 460, y - 10, { font: bold, size: 9, color: gray, align: 'right', maxWidth: 80 });

    y -= 32;
    text(job.item_description || 'Delivery Service', LM + 8, y, { size: 10 });
    text(job.item_category || '-', 280, y, { size: 10 });
    text(formatCurrency(subtotal, clientLocale), 460, y, { font: bold, size: 10, align: 'right', maxWidth: 80 });

    equipmentCharges.forEach((eq) => {
      y -= 20;
      text('Equipment: ' + eq.name, LM + 8, y, { size: 9, color: gray });
      text(formatCurrency(parseFloat(eq.amount), clientLocale), 460, y, { font: bold, size: 9, align: 'right', maxWidth: 80 });
    });

    // ─── Totals ───
    y -= 28;
    drawLine(345, y, RM);
    y -= 16;

    text('Subtotal', 350, y, { size: 10, color: gray });
    text(formatCurrency(subtotal, clientLocale), 460, y, { font: bold, size: 10, align: 'right', maxWidth: 80 });

    if (equipTotal > 0) {
      y -= 18;
      text('Equipment', 350, y, { size: 10, color: gray });
      text(formatCurrency(equipTotal, clientLocale), 460, y, { font: bold, size: 10, align: 'right', maxWidth: 80 });
    }

    y -= 26;
    drawRect(345, y - 4, 200, 24, blue);
    text('TOTAL', 355, y + 2, { font: bold, size: 12, color: white });
    text(formatCurrency(grandTotal, clientLocale), 460, y + 2, { font: bold, size: 12, color: white, align: 'right', maxWidth: 80 });

    // ─── Payment ───
    y -= 40;
    text('PAYMENT', LM, y, { font: bold, size: 9, color: blue });
    y -= 14;
    text('Payment method: Wallet / ' + localeConfig.payment.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / '), LM, y, { size: 9, color: gray });
    y -= 14;
    const paidStatus = ['confirmed', 'completed'].includes(job.status) ? 'PAID' : 'PENDING';
    text('Status: ' + paidStatus, LM, y, { size: 9, color: gray });

    // ─── Footer ───
    drawLine(LM, 55, RM);
    text('Thank you for choosing TCG Express. For questions, contact support@techchainglobal.com', 105, 40, { size: 8, color: rgb(0.58, 0.62, 0.67) });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Upload
    const bucket = 'express-uploads';
    await ensureBucket(bucket);
    const fileName = 'invoices/' + (job.job_number || id) + '_' + Date.now() + '.pdf';

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return NextResponse.json({ error: 'Failed to upload invoice' }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    const invoiceUrl = urlData.publicUrl;

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

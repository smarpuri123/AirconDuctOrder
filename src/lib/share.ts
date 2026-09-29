import type { Dispatch, Order } from '@/types'
import { formatDate } from './calculations'
import { getOrderBalanceQty, getOrderDispatchedQty } from './calculations'

export function generateWhatsAppMessage(dispatch: Dispatch, order: Order): string {
  const totalDispatched = getOrderDispatchedQty(order)
  const balance = getOrderBalanceQty(order)

  return `Dispatch Update

Order: ${order.orderNo}
Customer: ${order.customerName}
Dispatch No: ${dispatch.dispatchNo}
Vehicle: ${dispatch.vehicle.vehicleNumber}
Quantity: ${dispatch.totalQuantity}
Area: ${dispatch.totalArea.toFixed(2)} Sq.m

Total dispatched: ${totalDispatched} / ${order.totalQuantity}
Balance: ${balance}

Dispatch Date: ${formatDate(dispatch.dispatchDate)}

— ECOVENT AIR SYSTEMS INDIA LLP`
}

export function shareWhatsApp(message: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

export function generateEmailContent(dispatch: Dispatch, order: Order): { subject: string; body: string } {
  const totalDispatched = getOrderDispatchedQty(order)
  const balance = getOrderBalanceQty(order)

  return {
    subject: `Dispatch Update – ${order.orderNo} – ${dispatch.dispatchNo}`,
    body: `Dear ${order.customerName},

Please find the dispatch details below.

Order: ${order.orderNo}
Dispatch: ${dispatch.dispatchNo}
Vehicle: ${dispatch.vehicle.vehicleNumber}
Quantity: ${dispatch.totalQuantity}
Area: ${dispatch.totalArea.toFixed(2)} Sq.m

Total Dispatched: ${totalDispatched}
Balance: ${balance}

Regards,
EcoVent Air Systems India LLP`,
  }
}

export function shareEmail(subject: string, body: string): void {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export async function generateDispatchPDF(dispatch: Dispatch, order: Order): Promise<void> {
  const { jsPDF } = await import('jspdf')
  await import('jspdf-autotable')

  const doc = new jsPDF()
  const totalDispatched = getOrderDispatchedQty(order)
  const balance = getOrderBalanceQty(order)

  doc.setFontSize(18)
  doc.setTextColor(0, 48, 135)
  doc.text('ECOVENT AIR SYSTEMS INDIA LLP', 105, 20, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(104, 113, 115)
  doc.text('Quality Ducts Is Our Business', 105, 27, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor(26, 26, 46)
  doc.text('Dispatch Note', 14, 40)

  doc.setFontSize(10)
  const details = [
    ['Dispatch No', dispatch.dispatchNo],
    ['Order No', order.orderNo],
    ['Customer', order.customerName],
    ['Vehicle', dispatch.vehicle.vehicleNumber],
    ['Driver', dispatch.vehicle.driverName],
    ['Date', formatDate(dispatch.dispatchDate)],
  ]
  let y = 48
  for (const [label, value] of details) {
    doc.setTextColor(104, 113, 115)
    doc.text(label + ':', 14, y)
    doc.setTextColor(26, 26, 46)
    doc.text(String(value), 60, y)
    y += 7
  }

  const tableData = dispatch.items.map((item) => [
    item.tagNo,
    item.description,
    item.w1,
    item.h1,
    item.w2,
    item.h2,
    item.length,
    item.quantity,
    item.area.toFixed(2),
  ])

  ;(doc as unknown as { autoTable: (opts: object) => void }).autoTable({
    startY: y + 5,
    head: [['Tag', 'Desc', 'W1', 'H1', 'W2', 'H2', 'L', 'Qty', 'Area']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 48, 135] },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(10)
  doc.text(`Current Dispatch Qty: ${dispatch.totalQuantity}`, 14, finalY)
  doc.text(`Current Dispatch Area: ${dispatch.totalArea.toFixed(2)} m²`, 14, finalY + 7)
  doc.text(`Total Order Qty: ${order.totalQuantity}`, 14, finalY + 14)
  doc.text(`Total Dispatched Qty: ${totalDispatched}`, 14, finalY + 21)
  doc.text(`Balance Qty: ${balance}`, 14, finalY + 28)

  const sigY = finalY + 45
  doc.text('Prepared By', 14, sigY)
  doc.text('Driver', 80, sigY)
  doc.text('Received By', 146, sigY)
  doc.line(14, sigY + 15, 60, sigY + 15)
  doc.line(80, sigY + 15, 126, sigY + 15)
  doc.line(146, sigY + 15, 192, sigY + 15)

  doc.save(`${dispatch.dispatchNo}.pdf`)
}

const printStyles = `
.invoice-receipt-print-target { box-sizing: border-box; width: min(100%, 520px); max-width: 100%; min-width: 0; margin: 0 auto; padding: 24px; overflow: hidden; background: #fff; color: #111; font-family: Arial, sans-serif; }
.invoice-receipt-print-target.invoice-receipt-hidden { display: none; }
.invoice-receipt-title { margin: 0 0 4px; text-align: center; font-size: 20px; font-weight: 700; }
.invoice-receipt-subtitle { margin: 0 0 18px; text-align: center; color: #555; font-size: 12px; }
.invoice-receipt-meta { display: grid; gap: 5px; padding-bottom: 12px; border-bottom: 1px dashed #999; font-size: 13px; }
.invoice-receipt-lines { width: 100%; max-width: 100%; table-layout: fixed; margin: 12px 0; border-collapse: collapse; font-size: 12px; }
.invoice-receipt-lines th, .invoice-receipt-lines td { padding: 6px 3px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
.invoice-receipt-lines th:first-child, .invoice-receipt-lines td:first-child { overflow-wrap: anywhere; }
.invoice-receipt-lines th:nth-child(2), .invoice-receipt-lines td:nth-child(2) { width: 38px; text-align: center; }
.invoice-receipt-lines th:last-child, .invoice-receipt-lines td:last-child { text-align: right; white-space: nowrap; }
.invoice-receipt-product { font-weight: 600; }
.invoice-receipt-variant { margin-top: 2px; color: #555; }
.invoice-receipt-totals { display: grid; gap: 7px; font-size: 13px; }
.invoice-receipt-total { display: flex; justify-content: space-between; gap: 12px; padding-top: 9px; border-top: 1px dashed #999; font-size: 16px; font-weight: 700; }
@media print {
    @page { margin: 10mm; }
    body * { visibility: hidden !important; }
    .invoice-receipt-print-target,
    .invoice-receipt-print-target * { visibility: visible !important; }
    .invoice-receipt-print-target {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        display: block !important;
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        color: #000 !important;
    }
}
`

const formatVND = value => `${Number(value || 0).toLocaleString('vi-VN')} ₫`

const formatDate = value => {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export default function InvoiceReceipt({ invoice, hidden = false }) {
    if (!invoice) return null

    return (
        <>
            <style>{printStyles}</style>
            <article className={`invoice-receipt-print-target${hidden ? ' invoice-receipt-hidden' : ''}`}>
                <h1 className="invoice-receipt-title">HÓA ĐƠN BÁN HÀNG</h1>
                <p className="invoice-receipt-subtitle">Cảm ơn quý khách</p>
                <div className="invoice-receipt-meta">
                    <div><strong>Mã hóa đơn:</strong> {invoice.code || '—'}</div>
                    {invoice.createdAt && <div><strong>Ngày tạo:</strong> {formatDate(invoice.createdAt)}</div>}
                    {invoice.customerName && <div><strong>Khách hàng:</strong> {invoice.customerName}</div>}
                    {invoice.customerPhone && <div><strong>Số điện thoại:</strong> {invoice.customerPhone}</div>}
                    <div><strong>PTTT:</strong> {invoice.paymentMethod || '—'}</div>
                </div>
                <table className="invoice-receipt-lines">
                    <thead>
                        <tr><th>Sản phẩm</th><th>SL</th><th>Thành tiền</th></tr>
                    </thead>
                    <tbody>
                        {(invoice.items || []).map((item, index) => (
                            <tr key={item.id ?? `${item.name}-${index}`}>
                                <td>
                                    <div className="invoice-receipt-product">{item.name}</div>
                                    {item.variant && <div className="invoice-receipt-variant">{item.variant}</div>}
                                    <div>{formatVND(item.unitPrice)} / sp</div>
                                </td>
                                <td>{item.quantity}</td>
                                <td>{formatVND(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="invoice-receipt-totals">
                    <div className="invoice-receipt-total">
                        <span>Tổng thanh toán</span><span>{formatVND(invoice.total)}</span>
                    </div>
                </div>
            </article>
        </>
    )
}

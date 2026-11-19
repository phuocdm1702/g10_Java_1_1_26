import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    App, Button, Checkbox, Empty, Input, InputNumber, Modal, Radio,
    Select, Divider, Tag
} from 'antd'
import {
    SearchOutlined, MinusOutlined, PlusOutlined, DeleteOutlined,
    DollarOutlined, CreditCardOutlined, ShoppingOutlined, CloseOutlined, PrinterOutlined
} from '@ant-design/icons'
import api from '../../api/axios'
import { fetchProducts } from '../../api/storeApi'
import { imagesFor, imgUrl, vnd } from '../../data/products'
import ProductImage from '../../components/user/ProductImage'
import PosProductCard from '../../components/admin/PosProductCard'
import InvoiceReceipt from '../../components/admin/InvoiceReceipt'

const styles = `
.pos { height: calc(100vh - 145px); min-height: 560px; display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 16px; }
.pos-left { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.pos-pending, .pos-cart, .pos-payment { background: #fff; border: 1px solid #edf0f4; border-radius: 9px; min-height: 0; }
.pos-pending { flex: 0 0 132px; padding: 12px 16px; overflow: hidden; }
.pos-pending-head, .pos-cart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pos-pending-list { display: flex; gap: 10px; overflow-x: auto; padding: 10px 2px 6px; }
.pos-pending-card { position: relative; flex: 0 0 132px; min-height: 72px; border: 1px solid #e1e4e9; border-radius: 7px; padding: 8px; text-align: left; background: #fff; cursor: pointer; }
.pos-pending-card.active { border-color: #1f2a44; box-shadow: 0 0 0 1px #1f2a44; }
.pos-pending-code { font-weight: 700; }
.pos-pending-card .ant-tag { margin: 4px 0 0; line-height: 18px; }
.pos-pending-count { color: #667085; font-size: 11px; }
.pos-pending-remove { position: absolute; top: 4px; right: 4px; }
.pos-cart { display: flex; flex-direction: column; flex: 1; }
.pos-cart-head { padding: 12px 16px; border-bottom: 1px solid #edf0f4; }
.pos-cart-toolbar { display: flex; gap: 8px; }
.pos-lines { flex: 1; overflow: auto; padding: 10px 16px; }
.pos-empty { display: grid; place-content: center; height: 100%; }
.pos-picker-tools { display: grid; grid-template-columns: minmax(230px, 1.5fr) repeat(4, minmax(120px, 1fr)) auto; gap: 8px; margin: 10px 0 14px; }
.pos-picker-grid { max-height: min(65vh, 680px); overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; padding: 2px 4px 8px 2px; }
.pos-product { height: 100%; border: 1px solid #edf0f4; border-radius: 9px; padding: 10px; background: #fff; }
.pos-product .ant-card-body { padding: 0; display: flex; flex-direction: column; height: 100%; }
.pos-thumb { aspect-ratio: 3 / 4; border-radius: 7px; background: #f5f6f8; display: grid; place-items: center; overflow: hidden; }
.pos-thumb .photo { width: 100%; height: 100%; object-fit: cover; }
.pos-name { overflow: hidden; font-weight: 700; line-height: 1.3; margin-top: 5px; color: #172033; }
.pos-colors { display: flex; align-items: center; gap: 8px; margin: 8px 0 3px; min-height: 20px; }
.pos-color { width: 16px; height: 16px; border: 1px solid #c9ced6; border-radius: 50%; padding: 0; cursor: pointer; }
.pos-color.selected { outline: 1px solid #172033; outline-offset: 2px; }
.pos-color-name { color: #667085; font-size: 12px; margin-bottom: 2px; }
.pos-brand { color: #667085; font-size: 12px; margin-bottom: 7px; }
.pos-option-label { color: #667085; font-size: 12px; margin-bottom: 3px; }
.pos-sizes { display: flex; flex-wrap: wrap; gap: 4px; min-height: 26px; }
.pos-size { border: 1px solid #dfe3ea; border-radius: 6px; background: #fff; padding: 3px 8px; font-size: 12px; cursor: pointer; }
.pos-size.selected { border-color: #1f2a44; background: #1f2a44; color: #fff; }
.pos-size:disabled { cursor: not-allowed; opacity: .48; }
.pos-price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 0 0 6px; font-weight: 600; color: #172033; }
.pos-price s { color: #98a2b3; font-size: 12px; font-weight: 400; }
.pos-add { margin-top: 1px; }
.pos-line { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 9px; align-items: center; padding: 9px 0; border-bottom: 1px solid #f1f2f4; }
.pos-line-image, .pos-line-image img, .pos-line-image .photo { width: 44px; height: 44px; }
.pos-line-image img, .pos-line-image .photo { object-fit: cover; border-radius: 6px; background: #f5f6f8; }
.pos-line-name { font-size: 13px; font-weight: 600; }
.pos-line-meta { color: #667085; font-size: 12px; margin-top: 2px; }
.pos-line-actions { display: flex; align-items: center; gap: 5px; margin-top: 6px; }
.pos-line-actions .ant-input-number { width: 58px; }
.pos-payment { display: flex; flex-direction: column; overflow: hidden; }
.pos-payment-head { padding: 14px 16px; border-bottom: 1px solid #edf0f4; font-weight: 700; }
.pos-payment-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; }
.pos-payment-footer { flex: 0 0 auto; display: grid; gap: 10px; padding: 12px 14px 14px; border-top: 1px solid #edf0f4; background: #fff; }
.pos-customer-mode { margin-bottom: 12px; }
.pos-total { padding: 12px; border: 1px solid #edf0f4; border-radius: 8px; margin: 12px 0; }
.pos-voucher { margin-bottom: 12px; }
.pos-voucher-input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.pos-voucher-state { margin-top: 6px; font-size: 12px; color: #667085; }
.pos-breakdown { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; color: #667085; }
.pos-breakdown.discount { color: #b42318; }
.pos-qr-panel { margin: 12px auto 0; text-align: center; }
.pos-qr-panel img { display: block; width: 190px; height: 190px; max-width: 100%; margin: 0 auto; object-fit: contain; background: white; }
.pos-qr-confirm { display: block; margin-top: 12px; text-align: left; }
.pos-qr-warning { margin-top: 8px; color: #ad6800; font-size: 12px; text-align: left; }
.pos-total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.pos-total-row strong { font-size: 22px; color: #1f2a44; }
.pos-customer { display: grid; grid-template-columns: 1fr; gap: 8px; }
.pos-payment-method { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
.pos-payment-method .ant-radio-button-wrapper { text-align: center; padding-inline: 8px; }
.pos-cash-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.pos-checkout { margin-top: 0; }
@media (max-width: 1050px) { .pos { grid-template-columns: minmax(0, 1fr) 310px; } .pos-picker-tools { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 800px) { .pos { height: auto; min-height: 0; grid-template-columns: 1fr; } .pos-left { min-height: 620px; } .pos-cart { min-height: 340px; } .pos-payment { overflow: visible; } .pos-payment-body { flex: initial; overflow: visible; } }
@media (max-width: 560px) { .pos-picker-tools { grid-template-columns: 1fr 1fr; } .pos-picker-tools .pos-search { grid-column: 1 / -1; } .pos-picker-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pos-pending { flex-basis: 120px; } .pos-cash-inputs { grid-template-columns: 1fr; } }
`

const normalize = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

const vietQr = {
    bankId: import.meta.env.VITE_VIETQR_BANK_ID,
    accountNumber: import.meta.env.VITE_VIETQR_ACCOUNT_NUMBER,
    accountName: import.meta.env.VITE_VIETQR_ACCOUNT_NAME,
    template: import.meta.env.VITE_VIETQR_TEMPLATE || 'compact2',
}

const createEmptyOrderPaymentState = () => ({
    customerType: 'guest',
    selectedCustomerId: null,
    customerName: '',
    customerPhone: '',
    payment: 'Tiền mặt',
    transferConfirmed: false,
    transferReference: `POS${Date.now()}`,
    received: undefined,
    note: '',
    voucherInput: '',
    appliedVoucher: '',
    voucherQuote: null,
    voucherCartKey: '',
})

export default function QuayOffline() {
    const { message } = App.useApp()
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [brand, setBrand] = useState('all')
    const [material, setMaterial] = useState('all')
    const [colorFilter, setColorFilter] = useState('all')
    const [sizeFilter, setSizeFilter] = useState('all')
    const [productPickerOpen, setProductPickerOpen] = useState(false)
    const [cart, setCart] = useState([])
    const [pendingOrders, setPendingOrders] = useState(() => {
        const paymentState = createEmptyOrderPaymentState()
        return [{ id: 1, code: 'HD001', cart: [], paymentState }]
    })
    const [activeOrderId, setActiveOrderId] = useState(1)
    const [nextOrderNumber, setNextOrderNumber] = useState(2)
    const [customerType, setCustomerType] = useState('guest')
    const [customers, setCustomers] = useState([])
    const [selectedCustomerId, setSelectedCustomerId] = useState(null)
    const [customerLoading, setCustomerLoading] = useState(false)
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [payment, setPayment] = useState('Tiền mặt')
    const [transferConfirmed, setTransferConfirmed] = useState(false)
    const [transferReference, setTransferReference] = useState(
        () => pendingOrders[0].paymentState.transferReference)
    const [received, setReceived] = useState(undefined)
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [receiptOpen, setReceiptOpen] = useState(false)
    const [receipt, setReceipt] = useState(null)
    const [voucherInput, setVoucherInput] = useState('')
    const [appliedVoucher, setAppliedVoucher] = useState('')
    const [voucherQuote, setVoucherQuote] = useState(null)
    const [voucherCartKey, setVoucherCartKey] = useState('')
    const [voucherLoading, setVoucherLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setProducts(await fetchProducts())
        } catch {
            message.error('Không tải được danh sách sản phẩm')
        } finally {
            setLoading(false)
        }
    }, [message])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (customerType !== 'registered') return undefined
        let ignore = false
        setCustomerLoading(true)
        api.get('/admin/hoa-don/tai-quay/khach-hang')
            .then(({ data }) => { if (!ignore) setCustomers(data) })
            .catch(error => {
                if (!ignore) message.error(error.response?.data?.message || 'Không tải được danh sách khách hàng')
            })
            .finally(() => { if (!ignore) setCustomerLoading(false) })
        return () => { ignore = true }
    }, [customerType, message])

    const brands = useMemo(() =>
        [...new Set(products.map(p => p.thuongHieu).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'vi')), [products])

    const materials = useMemo(() =>
        [...new Set(products.map(p => p.chatLieu).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'vi')), [products])
    const colors = useMemo(() =>
        [...new Set(products.flatMap(p => (p.bienThe ?? []).map(v => v.mau?.ten).filter(Boolean)))]
            .sort((a, b) => a.localeCompare(b, 'vi')), [products])
    const sizes = useMemo(() =>
        [...new Set(products.flatMap(p => (p.bienThe ?? []).map(v => v.size).filter(Boolean)))]
            .sort((a, b) => a.localeCompare(b, 'vi')), [products])

    const filtered = useMemo(() => products.filter(p => {
        const variants = p.bienThe ?? []
        const text = normalize(`${p.ten ?? ''} ${variants.map(v => `${v.size ?? ''} ${v.mau?.ten ?? ''}`).join(' ')}`)
        return text.includes(normalize(search.trim()))
            && (brand === 'all' || p.thuongHieu === brand)
            && (material === 'all' || p.chatLieu === material)
            && (colorFilter === 'all' || variants.some(v => v.mau?.ten === colorFilter))
            && (sizeFilter === 'all' || variants.some(v => v.size === sizeFilter))
    }), [products, search, brand, material, colorFilter, sizeFilter])

    const setActiveCart = nextCart => {
        const resolved = typeof nextCart === 'function' ? nextCart(cart) : nextCart
        setCart(resolved)
        setPendingOrders(current => current.map(order =>
            order.id === activeOrderId ? { ...order, cart: resolved } : order))
    }

    const getCurrentPaymentState = () => ({
        customerType,
        selectedCustomerId,
        customerName,
        customerPhone,
        payment,
        transferConfirmed,
        transferReference,
        received,
        note,
        voucherInput,
        appliedVoucher,
        voucherQuote,
        voucherCartKey,
    })

    const restorePaymentState = state => {
        const paymentState = state || createEmptyOrderPaymentState()
        setCustomerType(paymentState.customerType)
        setSelectedCustomerId(paymentState.selectedCustomerId)
        setCustomerName(paymentState.customerName)
        setCustomerPhone(paymentState.customerPhone)
        setPayment(paymentState.payment)
        setTransferConfirmed(paymentState.transferConfirmed)
        setTransferReference(paymentState.transferReference)
        setReceived(paymentState.received)
        setNote(paymentState.note)
        setVoucherInput(paymentState.voucherInput)
        setAppliedVoucher(paymentState.appliedVoucher)
        setVoucherQuote(paymentState.voucherQuote)
        setVoucherCartKey(paymentState.voucherCartKey)
    }

    const addPendingOrder = () => {
        const id = nextOrderNumber
        const paymentState = createEmptyOrderPaymentState()
        setPendingOrders(current => [
            ...current.map(order => order.id === activeOrderId
                ? { ...order, cart, paymentState: getCurrentPaymentState() }
                : order),
            { id, code: `HD${String(id).padStart(3, '0')}`, cart: [], paymentState },
        ])
        setNextOrderNumber(id + 1)
        setActiveOrderId(id)
        setCart([])
        restorePaymentState(paymentState)
    }

    const switchPendingOrder = order => {
        if (order.id === activeOrderId) return
        const paymentState = order.paymentState || createEmptyOrderPaymentState()
        setPendingOrders(current => current.map(currentOrder =>
            currentOrder.id === activeOrderId
                ? { ...currentOrder, cart, paymentState: getCurrentPaymentState() }
                : currentOrder))
        setActiveOrderId(order.id)
        setCart(order.cart)
        restorePaymentState(paymentState)
    }

    const closePendingOrder = orderId => {
        if (pendingOrders.length === 1) {
            const id = nextOrderNumber
            const paymentState = createEmptyOrderPaymentState()
            setPendingOrders([{
                id, code: `HD${String(id).padStart(3, '0')}`, cart: [], paymentState,
            }])
            setNextOrderNumber(id + 1)
            setActiveOrderId(id)
            setCart([])
            restorePaymentState(paymentState)
            return
        }
        const remaining = pendingOrders.filter(order => order.id !== orderId)
        setPendingOrders(remaining)
        if (orderId === activeOrderId) {
            const next = remaining[0]
            setActiveOrderId(next.id)
            setCart(next.cart)
            restorePaymentState(next.paymentState)
        }
    }

    const addVariant = (product, variant) => {
        if (!variant || Number(variant.soLuong ?? 0) <= 0) {
            message.warning('Biến thể này đã hết hàng')
            return
        }
        setActiveCart(current => {
            const found = current.find(x => x.variant.id === variant.id)
            if (found) {
                if (found.quantity >= variant.soLuong) {
                    message.warning(`Chỉ còn ${variant.soLuong} sản phẩm trong kho`)
                    return current
                }
                return current.map(x => x.variant.id === variant.id
                    ? { ...x, quantity: x.quantity + 1 } : x)
            }
            return [...current, { product, variant, quantity: 1 }]
        })
    }

    const setQuantity = (variantId, quantity) => {
        setActiveCart(current => current.map(line => {
            if (line.variant.id !== variantId) return line
            const next = Math.max(1, Math.m in(quantity || 1, line.variant.soLuong))
            return { ...line, quantity: next }
        }))
    }

    const removeLine = variantId =>
        setActiveCart(current => current.filter(line => line.variant.id !== variantId))

    const cartItems = useMemo(() => cart.map(line => ({
        idBienThe: line.variant.id,
        soLuong: line.quantity,
    })), [cart])
    const cartKey = JSON.stringify(cartItems)
    const activeVoucher = voucherCartKey === cartKey
        && appliedVoucher.toLowerCase() === voucherInput.trim().toLowerCase()
        ? appliedVoucher : ''
    const subtotal = useMemo(() => cart.reduce((sum, line) =>
        sum + Number(line.variant.giaBan || 0) * line.quantity, 0), [cart])
    const displayedSubtotal = activeVoucher
        ? Number(voucherQuote?.tienTruocGiam ?? subtotal) : subtotal
    const discount = activeVoucher ? Number(voucherQuote?.tienGiam || 0) : 0
    const total = displayedSubtotal - discount

    const applyVoucher = async () => {
        const code = voucherInput.trim()
        if (!cartItems.length) {
            message.warning('Thêm sản phẩm vào giỏ trước khi áp dụng voucher')
            return
        }
        if (!code) {
            message.warning('Nhập mã voucher')
            return
        }

        setVoucherLoading(true)
        setVoucherQuote(null)
        setAppliedVoucher('')
        setVoucherCartKey('')
        try {
            const { data } = await api.post('/admin/hoa-don/tai-quay/bao-gia', {
                items: cartItems,
                maGiamGia: code,
            })
            setVoucherQuote(data)
            setAppliedVoucher(data.maGiamGia)
            setVoucherCartKey(cartKey)
            setVoucherInput(data.maGiamGia)
            message.success(`Đã áp dụng voucher ${data.maGiamGia}`)
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể áp dụng voucher')
        } finally {
            setVoucherLoading(false)
        }
    }

    const removeVoucher = () => {
        setVoucherInput('')
        setAppliedVoucher('')
        setVoucherQuote(null)
        setVoucherCartKey('')
    }

    const changeReceived = value => setReceived(value)
    const change = payment === 'Tiền mặt' && Number(received || 0) > total
        ? Number(received) - total : 0
    const qrConfigured = Boolean(vietQr.bankId && vietQr.accountNumber && vietQr.accountName)
    const qrUrl = useMemo(() => {
        if (!qrConfigured || total <= 0) return ''
        const url = new URL(`https://img.vietqr.io/image/${vietQr.bankId}-${vietQr.accountNumber}-${vietQr.template}.png`)
        url.search = new URLSearchParams({
            amount: String(Math.round(total)),
            addInfo: transferReference,
            accountName: vietQr.accountName,
        }).toString()
        return url.toString()
    }, [qrConfigured, total, transferReference])

    const submitCheckout = async () => {
        if (!cart.length) {
            message.warning('Chưa có sản phẩm trong đơn')
            return
        }
        if (customerType === 'guest') {
            if (!customerName.trim()) {
                message.warning('Nhập tên khách vãng lai')
                return
            }
            if (!/^(0|\+84)\d{9}$/.test(customerPhone.replace(/\s+/g, ''))) {
                message.warning('Nhập số điện thoại khách vãng lai hợp lệ')
                return
            }
        } else if (!selectedCustomerId) {
            message.warning('Chọn khách hàng trong danh sách')
            return
        }
        if (payment === 'Tiền mặt' && Number(received || 0) < total) {
            message.warning('Tiền khách đưa chưa đủ tổng tiền')
            return
        }
        if (payment === 'Chuyển khoản' && !qrConfigured) {
            message.error('Chưa cấu hình tài khoản nhận tiền VietQR')
            return
        }
        if (payment === 'Chuyển khoản' && !transferConfirmed) {
            message.warning('Vui lòng xác nhận đã kiểm tra tiền chuyển khoản vào tài khoản')
            return
        }
        setSubmitting(true)
        try {
            const { data } = await api.post('/admin/hoa-don/tai-quay', {
                idKhachHang: customerType === 'registered' ? selectedCustomerId : null,
                tenKhachHang: customerType === 'guest' ? customerName.trim() : null,
                soDienThoai: customerType === 'guest' ? customerPhone.replace(/\s+/g, '') : null,
                phuongThucThanhToan: payment,
                ghiChu: [note.trim(), payment === 'Chuyển khoản' ? `Mã CK: ${transferReference}` : '']
                    .filter(Boolean).join(' | ').slice(0, 255),
                maGiamGia: activeVoucher || null,
                items: cartItems,
            })
            message.success(`Đã tạo hóa đơn ${data.maHoaDon}`)
            const selectedCustomer = customers.find(customer =>
                String(customer.id) === String(selectedCustomerId))
            setReceipt({
                code: data.maHoaDon,
                createdAt: new Date().toISOString(),
                customerName: customerType === 'guest' ? customerName.trim() : selectedCustomer?.hoVaTen,
                customerPhone: customerType === 'guest'
                    ? customerPhone.replace(/\s+/g, '')
                    : selectedCustomer?.soDienThoai,
                paymentMethod: payment,
                items: cart.map(line => ({
                    id: line.variant.id,
                    name: line.product.ten,
                    variant: `${line.variant.mau?.ten || 'Màu'} / ${line.variant.size || 'Size'}`,
                    quantity: line.quantity,
                    unitPrice: line.variant.giaBan,
                })),
                total: data.tongTien,
            })
            setReceiptOpen(true)
            const nextId = nextOrderNumber
            const paymentState = createEmptyOrderPaymentState()
            setPendingOrders(current => [
                ...current.filter(order => order.id !== activeOrderId),
                { id: nextId, code: `HD${String(nextId).padStart(3, '0')}`, cart: [], paymentState },
            ])
            setNextOrderNumber(nextId + 1)
            setActiveOrderId(nextId)
            setCart([])
            setProductPickerOpen(false)
            restorePaymentState(paymentState)
            load()
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể thanh toán')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="pos">
            <style>{styles}</style>
            <section className="pos-left">
                <section className="pos-pending">
                    <div className="pos-pending-head">
                        <strong>Hóa đơn chờ</strong>
                        <Button size="small" icon={<PlusOutlined />} onClick={addPendingOrder}>Thêm đơn</Button>
                    </div>
                    <div className="pos-pending-list">
                        {pendingOrders.map(order => {
                            const quantity = (order.id === activeOrderId ? cart : order.cart)
                                .reduce((sum, line) => sum + line.quantity, 0)
                            return (
                                <div key={order.id}
                                     className={`pos-pending-card${order.id === activeOrderId ? ' active' : ''}`}
                                     role="button" tabIndex={0}
                                     onClick={() => switchPendingOrder(order)}
                                     onKeyDown={event => event.key === 'Enter' && switchPendingOrder(order)}>
                                    <div className="pos-pending-code">{order.code}</div>
                                    <Tag color={quantity ? 'gold' : 'default'}>{quantity ? 'Chờ xử lý' : 'Chưa có SP'}</Tag>
                                    <div className="pos-pending-count">{quantity} sản phẩm</div>
                                    <Button className="pos-pending-remove" type="text" size="small"
                                            icon={<CloseOutlined />} aria-label={`Đóng ${order.code}`}
                                            onClick={event => { event.stopPropagation(); closePendingOrder(order.id) }} />
                                </div>
                            )
                        })}
                    </div>
                </section>

                <section className="pos-cart">
                    <div className="pos-cart-head">
                        <strong>Giỏ hàng</strong>
                        <div className="pos-cart-toolbar">
                            <Button size="small" icon={<ShoppingOutlined />}
                                    onClick={() => setProductPickerOpen(true)}>Thêm sản phẩm</Button>
                            {cart.length > 0 &&
                                <Button size="small" danger icon={<DeleteOutlined />}
                                        onClick={() => setActiveCart([])}>Xóa hết</Button>}
                        </div>
                    </div>
                    <div className="pos-lines">
                        {cart.length === 0
                            ? <div className="pos-empty">
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sản phẩm">
                                    <span style={{ color: '#98a2b3' }}>Chọn khách hàng và thêm sản phẩm vào giỏ</span>
                                </Empty>
                            </div>
                            : cart.map(line => (
                                <div className="pos-line" key={line.variant.id}>
                                    <div className="pos-line-image">
                                        <ProductImage
                                            src={imgUrl(line.variant.anhUrl) || imagesFor(line.product, line.variant.mau?.ma)[0]}
                                            color={line.variant.mau?.hex}
                                            alt={line.product.ten}
                                        />
                                    </div>
                                    <div>
                                        <div className="pos-line-name">{line.product.ten}</div>
                                        <div className="pos-line-meta">
                                            {line.variant.mau?.ten || 'Màu'} / {line.variant.size || 'Size'} · {vnd(line.variant.giaBan)}
                                        </div>
                                        <div className="pos-line-actions">
                                            <Button size="small" icon={<MinusOutlined />}
                                                    onClick={() => setQuantity(line.variant.id, line.quantity - 1)} />
                                            <InputNumber size="small" min={1} max={line.variant.soLuong}
                                                         value={line.quantity}
                                                         onChange={value => setQuantity(line.variant.id, value)} />
                                            <Button size="small" icon={<PlusOutlined />}
                                                    onClick={() => setQuantity(line.variant.id, line.quantity + 1)} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <strong>{vnd(line.variant.giaBan * line.quantity)}</strong>
                                        <div>
                                            <Button type="text" danger size="small" icon={<DeleteOutlined />}
                                                    onClick={() => removeLine(line.variant.id)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </section>
            </section>

            <aside className="pos-payment">
                <div className="pos-payment-head">Thông tin thanh toán</div>
                <div className="pos-payment-body">
                    <div className="pos-customer-mode">
                        <div className="pos-option-label">Khách hàng</div>
                        <Radio.Group value={customerType} onChange={event => {
                            setCustomerType(event.target.value)
                            setSelectedCustomerId(null)
                            setCustomerName('')
                            setCustomerPhone('')
                        }}>
                            <Radio.Button value="guest">Vãng lai</Radio.Button>
                            <Radio.Button value="registered">Có sẵn</Radio.Button>
                        </Radio.Group>
                    </div>
                    {customerType === 'guest' ? (
                        <div className="pos-customer">
                            <Input placeholder="Tên khách vãng lai *" value={customerName}
                                   onChange={event => setCustomerName(event.target.value)} maxLength={100} />
                            <Input placeholder="Số điện thoại *" value={customerPhone}
                                   onChange={event => setCustomerPhone(event.target.value)} maxLength={15} />
                        </div>
                    ) : (
                        <Select
                            showSearch
                            allowClear
                            style={{ width: '100%' }}
                            loading={customerLoading}
                            value={selectedCustomerId}
                            placeholder="Chọn khách hàng"
                            optionFilterProp="label"
                            onChange={setSelectedCustomerId}
                            options={customers.map(customer => ({
                                value: customer.id,
                                label: `${customer.maKhachHang} - ${customer.hoVaTen} - ${customer.soDienThoai}`,
                            }))}
                            notFoundContent={customerLoading ? 'Đang tải khách hàng...' : 'Không có khách hàng'}
                        />
                    )}

                    <Divider style={{ margin: '14px 0' }} />
                    <div className="pos-option-label">Mã ưu đãi / giảm giá</div>
                    <div className="pos-voucher-input">
                        <Input value={voucherInput} maxLength={20} placeholder="Nhập mã voucher"
                               onChange={event => setVoucherInput(event.target.value)}
                               onPressEnter={applyVoucher} />
                        <Button loading={voucherLoading} disabled={!cart.length || !voucherInput.trim()}
                                onClick={applyVoucher}>Áp dụng</Button>
                    </div>
                    {activeVoucher && (
                        <div className="pos-voucher-state">
                            Đã áp dụng <strong>{activeVoucher}</strong>
                            <Button type="link" size="small" onClick={removeVoucher}>Bỏ mã</Button>
                        </div>
                    )}
                    {appliedVoucher && !activeVoucher &&
                        <div className="pos-voucher-state">Giỏ hàng hoặc mã đã đổi; áp dụng lại voucher.</div>}

                    <div className="pos-total">
                        <div className="pos-breakdown"><span>Tổng tiền hàng</span><strong>{vnd(displayedSubtotal)}</strong></div>
                        <div className="pos-breakdown discount"><span>Giảm giá</span><strong>− {vnd(discount)}</strong></div>
                        <Divider style={{ margin: '8px 0' }} />
                        <div className="pos-total-row">
                            <strong>Khách cần trả</strong><strong>{vnd(total)}</strong>
                        </div>
                    </div>

                    <div className="pos-option-label">Hình thức thanh toán</div>
                    <Radio.Group className="pos-payment-method" value={payment} onChange={event => {
                        setPayment(event.target.value)
                        setTransferConfirmed(false)
                    }}>
                        <Radio.Button value="Tiền mặt"><DollarOutlined /> Tiền mặt</Radio.Button>
                        <Radio.Button value="Chuyển khoản"><CreditCardOutlined /> VietQR</Radio.Button>
                    </Radio.Group>
                    {payment === 'Tiền mặt' ? (
                        <div className="pos-cash-inputs">
                            <InputNumber style={{ width: '100%' }} min={0} value={received}
                                         onChange={changeReceived} placeholder="Khách thanh toán"
                                         formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                         parser={value => value.replace(/[^\d]/g, '')} />
                            <Input readOnly value={`Tiền thừa: ${vnd(change)}`} />
                        </div>
                    ) : (
                        <>
                            {qrConfigured
                                ? <div className="pos-qr-panel"><img src={qrUrl} alt="Mã QR VietQR" /></div>
                                : <div className="pos-qr-warning">Chưa cấu hình VietQR trong frontend/.env.local</div>}
                            {qrConfigured && (
                                <>
                                    <Checkbox className="pos-qr-confirm" checked={transferConfirmed}
                                              onChange={event => setTransferConfirmed(event.target.checked)}>
                                        Đã kiểm tra và nhận đủ tiền
                                    </Checkbox>
                                    <div className="pos-qr-warning">Chỉ xác nhận sau khi kiểm tra giao dịch thực nhận.</div>
                                </>
                            )}
                        </>
                    )}

                </div>
                <div className="pos-payment-footer">
                    <Input.TextArea rows={2} value={note}
                                    onChange={event => setNote(event.target.value)} maxLength={255}
                                    placeholder="Ghi chú hóa đơn..." />
                    <Button className="pos-checkout" type="primary" size="large" block
                            loading={submitting} disabled={!cart.length}
                            icon={<DollarOutlined />} onClick={submitCheckout}>
                        {payment === 'Chuyển khoản' ? 'Xác nhận đã nhận tiền' : 'Hoàn tất thanh toán'}
                    </Button>
                </div>
            </aside>

            <Modal title="Chọn sản phẩm bán" open={productPickerOpen}
                   onCancel={() => setProductPickerOpen(false)} footer={null} width={1100}>
                <div className="pos-picker-tools">
                    <Input className="pos-search" allowClear prefix={<SearchOutlined />}
                           value={search} onChange={event => setSearch(event.target.value)}
                           placeholder="Tên sản phẩm, màu sắc, kích cỡ..." />
                    <Select value={brand} onChange={setBrand} options={[
                        { value: 'all', label: 'Tất cả thương hiệu' },
                        ...brands.map(value => ({ value, label: value })),
                    ]} />
                    <Select value={material} onChange={setMaterial} options={[
                        { value: 'all', label: 'Tất cả chất liệu' },
                        ...materials.map(value => ({ value, label: value })),
                    ]} />
                    <Select value={colorFilter} onChange={setColorFilter} options={[
                        { value: 'all', label: 'Tất cả màu sắc' },
                        ...colors.map(value => ({ value, label: value })),
                    ]} />
                    <Select value={sizeFilter} onChange={setSizeFilter} options={[
                        { value: 'all', label: 'Tất cả kích cỡ' },
                        ...sizes.map(value => ({ value, label: value })),
                    ]} />
                    <Button onClick={() => {
                        setSearch('')
                        setBrand('all')
                        setMaterial('all')
                        setColorFilter('all')
                        setSizeFilter('all')
                    }}>Đặt lại</Button>
                </div>
                {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Đang tải sản phẩm...</div>
                    : filtered.length === 0 ? <Empty description="Không tìm thấy sản phẩm" />
                        : <div className="pos-picker-grid">
                            {filtered.map(product => (
                                <PosProductCard key={product.id} product={product} onAddVariant={addVariant} />
                            ))}
                        </div>}
            </Modal>
            <Modal
                title="Phiếu bán hàng"
                open={receiptOpen}
                onCancel={() => setReceiptOpen(false)}
                width={560}
                footer={[
                    <Button key="close" onClick={() => setReceiptOpen(false)}>Đóng</Button>,
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
                        In phiếu
                    </Button>,
                ]}
            >
                <InvoiceReceipt invoice={receipt} />
            </Modal>
        </div>
    )
}
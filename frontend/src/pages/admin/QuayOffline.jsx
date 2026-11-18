import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    App, Button, Checkbox, Empty, Input, InputNumber, Modal, Radio,
    Select, Space, Divider, Statistic
} from 'antd'
import {
    SearchOutlined, MinusOutlined,
    PlusOutlined, DeleteOutlined, DollarOutlined, CreditCardOutlined
} from '@ant-design/icons'
import api from '../../api/axios'
import { fetchProducts } from '../../api/storeApi'
import { imgUrl, vnd } from '../../data/products'
import ProductImage from '../../components/user/ProductImage'
import PosProductCard from '../../components/admin/PosProductCard'

const styles = `
.pos { height: calc(100vh - 128px); display: grid; grid-template-columns: minmax(0, 1.8fr) 380px; gap: 16px; }
.pos-left, .pos-cart { background: #fff; border: 1px solid #edf0f4; border-radius: 10px; min-height: 0; }
.pos-left { display: flex; flex-direction: column; padding: 18px; }
.pos-tools { display: grid; grid-template-columns: minmax(240px, 1fr) 180px; gap: 12px; margin-bottom: 16px; }
.pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; overflow: auto; padding: 0 4px 4px 0; }
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
.pos-cart { display: flex; flex-direction: column; }
.pos-cart-head { padding: 16px 18px 12px; border-bottom: 1px solid #edf0f4; }
.pos-lines { flex: 1; overflow: auto; padding: 10px 18px; }
.pos-line { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 9px; align-items: center; padding: 9px 0; border-bottom: 1px solid #f1f2f4; }
.pos-line-image, .pos-line-image img, .pos-line-image .photo { width: 44px; height: 44px; }
.pos-line-image img, .pos-line-image .photo { object-fit: cover; border-radius: 6px; background: #f5f6f8; }
.pos-line-name { font-size: 13px; font-weight: 600; }
.pos-line-meta { color: #667085; font-size: 12px; margin-top: 2px; }
.pos-line-actions { display: flex; align-items: center; gap: 5px; margin-top: 6px; }
.pos-line-actions .ant-input-number { width: 58px; }
.pos-total { border-top: 1px solid #edf0f4; padding: 14px 18px 18px; }
.pos-voucher { margin-bottom: 12px; }
.pos-voucher-input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.pos-voucher-state { margin-top: 6px; font-size: 12px; color: #667085; }
.pos-breakdown { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; color: #667085; }
.pos-breakdown.discount { color: #b42318; }
.pos-qr-panel { margin-top: 14px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fafbfc; text-align: center; }
.pos-qr-panel img { display: block; width: 220px; height: 220px; max-width: 100%; margin: 12px auto; object-fit: contain; background: white; }
.pos-qr-title { font-weight: 700; color: #172033; }
.pos-qr-detail { color: #667085; font-size: 13px; line-height: 1.6; }
.pos-qr-amount { font-size: 20px; font-weight: 700; color: #1f2a44; }
.pos-qr-note { display: inline-block; padding: 4px 8px; border-radius: 5px; background: #eef1f6; color: #1f2a44; font-weight: 600; }
.pos-qr-confirm { display: block; margin-top: 12px; text-align: left; }
.pos-qr-warning { margin-top: 8px; color: #ad6800; font-size: 12px; text-align: left; }
.pos-total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.pos-total-row strong { font-size: 22px; color: #1f2a44; }
.pos-customer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 1050px) { .pos { grid-template-columns: 1fr 330px; } }
@media (max-width: 800px) { .pos { height: auto; grid-template-columns: 1fr; } .pos-grid { max-height: 520px; } .pos-cart { min-height: 420px; } }
@media (max-width: 560px) { .pos-tools, .pos-customer { grid-template-columns: 1fr; } .pos-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`

const normalize = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

const vietQr = {
    bankId: import.meta.env.VITE_VIETQR_BANK_ID,
    accountNumber: import.meta.env.VITE_VIETQR_ACCOUNT_NUMBER,
    accountName: import.meta.env.VITE_VIETQR_ACCOUNT_NAME,
    template: import.meta.env.VITE_VIETQR_TEMPLATE || 'compact2',
}

export default function QuayOffline() {
    const { message } = App.useApp()
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [brand, setBrand] = useState('all')
    const [cart, setCart] = useState([])
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [customerType, setCustomerType] = useState('guest')
    const [customers, setCustomers] = useState([])
    const [selectedCustomerId, setSelectedCustomerId] = useState(null)
    const [customerLoading, setCustomerLoading] = useState(false)
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [payment, setPayment] = useState('Tiền mặt')
    const [transferConfirmed, setTransferConfirmed] = useState(false)
    const [transferReference, setTransferReference] = useState(() => `POS${Date.now()}`)
    const [received, setReceived] = useState(undefined)
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
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

    const filtered = useMemo(() => products.filter(p => {
        const text = normalize(`${p.ten ?? ''} ${p.bienThe?.map(v => v.size).join(' ') ?? ''}`)
        return text.includes(normalize(search.trim()))
            && (brand === 'all' || p.thuongHieu === brand)
    }), [products, search, brand])

    const addVariant = (product, variant) => {
        if (!variant || Number(variant.soLuong ?? 0) <= 0) {
            message.warning('Biến thể này đã hết hàng')
            return
        }
        setCart(current => {
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
        setCart(current => current.map(line => {
            if (line.variant.id !== variantId) return line
            const next = Math.max(1, Math.min(quantity || 1, line.variant.soLuong))
            return { ...line, quantity: next }
        }))
    }

    const removeLine = variantId =>
        setCart(current => current.filter(line => line.variant.id !== variantId))

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

    const openCheckout = () => {
        setTransferReference(`POS${Date.now()}`)
        setTransferConfirmed(false)
        setCheckoutOpen(true)
    }

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
            setCart([])
            setCustomerName('')
            setCustomerPhone('')
            setCustomerType('guest')
            setSelectedCustomerId(null)
            setReceived(undefined)
            setTransferConfirmed(false)
            setNote('')
            removeVoucher()
            setCheckoutOpen(false)
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
                <div className="pos-tools">
                    <Input allowClear size="large" prefix={<SearchOutlined />} value={search}
                           onChange={e => setSearch(e.target.value)}
                           placeholder="Tìm theo tên sản phẩm, màu, kích thước..." />
                    <Select size="large" value={brand} onChange={setBrand}
                            options={[{ value: 'all', label: 'Tất cả thương hiệu' },
                                ...brands.map(x => ({ value: x, label: x }))]} />
                </div>
                {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Đang tải sản phẩm...</div>
                    : filtered.length === 0 ? <Empty description="Không tìm thấy sản phẩm" />
                        : <div className="pos-grid">
                            {filtered.map(product => <PosProductCard
                                key={product.id}
                                product={product}
                                onAddVariant={addVariant}
                            />)}
                        </div>}
            </section>

            <aside className="pos-cart">
                <div className="pos-cart-head">
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <strong style={{ fontSize: 16 }}>Giỏ hàng ({cart.reduce((n, x) => n + x.quantity, 0)})</strong>
                        {cart.length > 0 &&
                            <Button size="small" type="text" danger icon={<DeleteOutlined />}
                                    onClick={() => setCart([])}>Xóa hết</Button>}
                    </Space>
                </div>
                <div className="pos-lines">
                    {cart.length === 0
                        ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa chọn sản phẩm" />
                        : cart.map(line => (
                            <div className="pos-line" key={line.variant.id}>
                                <div className="pos-line-image">
                                    <ProductImage
                                        src={imgUrl(line.variant.anhUrl || line.product.hinhAnh?.[0]?.url)}
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
                <div className="pos-total">
                    <div className="pos-voucher">
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
                        {appliedVoucher && !activeVoucher && (
                            <div className="pos-voucher-state">Giỏ hàng hoặc mã đã đổi; hãy áp dụng voucher lại.</div>
                        )}
                    </div>
                    <div className="pos-breakdown"><span>Tạm tính</span><span>{vnd(displayedSubtotal)}</span></div>
                    {discount > 0 && (
                        <div className="pos-breakdown discount">
                            <span>Voucher ({activeVoucher})</span><span>− {vnd(discount)}</span>
                        </div>
                    )}
                    <div className="pos-total-row"><span>Tổng thanh toán</span><strong>{vnd(total)}</strong></div>
                    <Button type="primary" size="large" block disabled={!cart.length}
                            icon={<DollarOutlined />} onClick={openCheckout}>
                        Thanh toán
                    </Button>
                </div>
            </aside>

            <Modal title="Thanh toán tại quầy" open={checkoutOpen} onCancel={() => setCheckoutOpen(false)}
                   onOk={submitCheckout} confirmLoading={submitting}
                   okText={payment === 'Chuyển khoản' ? 'Xác nhận đã nhận tiền' : 'Hoàn tất thanh toán'}
                   okButtonProps={{ disabled: payment === 'Chuyển khoản' && (!qrConfigured || !transferConfirmed) }}
                   cancelText="Hủy" width={620}>
                <Statistic title="Tổng tiền" value={total} suffix="₫"
                           formatter={value => Number(value).toLocaleString('vi-VN')} />
                <Divider />
                <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 7, color: '#667085' }}>Khách hàng</div>
                    <Radio.Group value={customerType} onChange={event => {
                        setCustomerType(event.target.value)
                        setSelectedCustomerId(null)
                        setCustomerName('')
                        setCustomerPhone('')
                    }}>
                        <Radio.Button value="guest">Khách vãng lai</Radio.Button>
                        <Radio.Button value="registered">Khách hàng có sẵn</Radio.Button>
                    </Radio.Group>
                </div>
                {customerType === 'guest' ? (
                    <div className="pos-customer">
                        <Input placeholder="Tên khách vãng lai *" value={customerName}
                               onChange={e => setCustomerName(e.target.value)} maxLength={100} />
                        <Input placeholder="Số điện thoại *" value={customerPhone}
                               onChange={e => setCustomerPhone(e.target.value)} maxLength={15} />
                    </div>
                ) : (
                    <>
                        <Select
                            showSearch
                            allowClear
                            style={{ width: '100%' }}
                            loading={customerLoading}
                            value={selectedCustomerId}
                            placeholder="Tìm theo mã, tên hoặc số điện thoại khách hàng"
                            optionFilterProp="label"
                            onChange={setSelectedCustomerId}
                            options={customers.map(customer => ({
                                value: customer.id,
                                label: `${customer.maKhachHang} - ${customer.hoVaTen} - ${customer.soDienThoai}`,
                            }))}
                            notFoundContent={customerLoading ? 'Đang tải khách hàng...' : 'Không có khách hàng'}
                        />
                        {selectedCustomerId && (() => {
                            const customer = customers.find(item => item.id === selectedCustomerId)
                            return customer ? (
                                <div style={{ marginTop: 8, color: '#667085', fontSize: 12 }}>
                                    {customer.hoVaTen} · {customer.soDienThoai}
                                    {customer.email && ` · ${customer.email}`}
                                </div>
                            ) : null
                        })()}
                    </>
                )}
                <div style={{ marginTop: 14 }}>
                    <div style={{ marginBottom: 7, color: '#667085' }}>Phương thức thanh toán</div>
                    <Radio.Group value={payment} onChange={e => {
                        setPayment(e.target.value)
                        setTransferConfirmed(false)
                    }}>
                        <Radio.Button value="Tiền mặt"><DollarOutlined /> Tiền mặt</Radio.Button>
                        <Radio.Button value="Chuyển khoản"><CreditCardOutlined /> Chuyển khoản</Radio.Button>
                    </Radio.Group>
                </div>
                {payment === 'Chuyển khoản' && (
                    <div className="pos-qr-panel">
                        {qrConfigured ? (
                            <>
                                <div className="pos-qr-title">Quét mã để chuyển khoản</div>
                                <img src={qrUrl} alt="Mã QR thanh toán VietQR" />
                                <div className="pos-qr-detail">
                                    <div>Techcombank · {vietQr.accountNumber}</div>
                                    <div>{vietQr.accountName}</div>
                                    <div className="pos-qr-amount">{vnd(Math.round(total))}</div>
                                    <div>Nội dung chuyển khoản</div>
                                    <div className="pos-qr-note">{transferReference}</div>
                                </div>
                                <Checkbox className="pos-qr-confirm" checked={transferConfirmed}
                                          onChange={event => setTransferConfirmed(event.target.checked)}>
                                    Tôi đã kiểm tra tài khoản và xác nhận đã nhận đủ tiền
                                </Checkbox>
                                <div className="pos-qr-warning">
                                    Chỉ xác nhận sau khi đã kiểm tra giao dịch thực nhận trong ứng dụng ngân hàng.
                                </div>
                            </>
                        ) : (
                            <div className="pos-qr-warning">
                                Chưa cấu hình VietQR. Kiểm tra các biến VITE_VIETQR_* trong frontend/.env.local
                            </div>
                        )}
                    </div>
                )}
                {payment === 'Tiền mặt' &&
                    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <InputNumber style={{ width: '100%' }} size="large" min={0} value={received}
                                     onChange={changeReceived} placeholder="Tiền khách đưa"
                                     formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                     parser={v => v.replace(/[^\d]/g, '')} />
                        <Input size="large" readOnly value={change ? `Tiền thừa: ${vnd(change)}` : 'Tiền thừa: 0 ₫'} />
                    </div>}
                <Input.TextArea style={{ marginTop: 14 }} rows={2} value={note}
                                onChange={e => setNote(e.target.value)} maxLength={255}
                                placeholder="Ghi chú hóa đơn..." />
            </Modal>
        </div>
    )
}
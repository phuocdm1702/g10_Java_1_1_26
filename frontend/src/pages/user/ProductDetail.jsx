import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Modal, Table, App } from 'antd'
import { CarOutlined, SwapOutlined, WalletOutlined, CheckOutlined } from '@ant-design/icons'
import { fetchProduct, searchProducts } from '../../api/storeApi'
import { colorsOf, buildProductGallery, ownImagesFor, vnd } from '../../data/products'
import { useCart } from '../../context/CartContext'
import ProductCard from '../../components/user/ProductCard'
import Shirt from '../../components/user/Shirt'
import ProductGalleryShopee, { VISIBLE_THUMBS } from '../../components/user/ProductGalleryShopee'

const SIZE_TABLE = [
    { key: 'S', size: 'S', cao: '160 đến 168 cm', nang: '52 đến 60 kg', nguc: '88 đến 92 cm' },
    { key: 'M', size: 'M', cao: '165 đến 172 cm', nang: '58 đến 66 kg', nguc: '92 đến 96 cm' },
    { key: 'L', size: 'L', cao: '170 đến 177 cm', nang: '64 đến 72 kg', nguc: '96 đến 100 cm' },
    { key: 'XL', size: 'XL', cao: '174 đến 182 cm', nang: '70 đến 80 kg', nguc: '100 đến 106 cm' },
    { key: 'XXL', size: 'XXL', cao: '178 đến 186 cm', nang: '78 đến 90 kg', nguc: '106 đến 112 cm' },
]

export default function ProductDetail() {
    const { id } = useParams()
    const [state, setState] = useState({ id: null, data: null, error: null })

    useEffect(() => {
        let ignore = false
        fetchProduct(id)
            .then(data => { if (!ignore) setState({ id, data, error: null }) })
            .catch(e => {
                if (!ignore) setState({ id, data: null, error: e.response?.status === 404 ? 'notfound' : 'error' })
            })
        return () => { ignore = true }
    }, [id])

    if (state.id !== id) return <p className="wrap muted">Đang tải sản phẩm...</p>
    if (state.error === 'notfound') {
        return (
            <div className="wrap empty">
                <p>Không tìm thấy sản phẩm này. Có thể sản phẩm đã ngừng bán.</p>
                <Link to="/san-pham" className="btn">Xem tất cả áo polo</Link>
            </div>
        )
    }
    if (state.error) return <p className="wrap">Không tải được sản phẩm. Kiểm tra backend đã chạy chưa.</p>
    return <ProductView key={state.data.id} sp={state.data} />
}

function ProductView({ sp }) {
    const { message } = App.useApp()
    const [qs] = useSearchParams()
    const colors = useMemo(() => colorsOf(sp), [sp])
    const gallery = useMemo(() => buildProductGallery(sp), [sp])

    const initialColor = useMemo(() => colors.find(c => c.ma === qs.get('mau')) ?? null, [colors, qs])
    const [mau, setMau] = useState(initialColor)
    const [size, setSize] = useState(null)
    const [qty, setQty] = useState(1)

    const [idx, setIdx] = useState(() => {
        if (initialColor) {
            const foundIdx = gallery.findIndex(g => g.maMau === initialColor.ma)
            return foundIdx >= 0 ? foundIdx : 0
        }
        return 0
    })
    const [hoverIdx, setHoverIdx] = useState(null)
    const [thumbStart, setThumbStart] = useState(0)
    const [guide, setGuide] = useState(false)
    const { add } = useCart()

    useEffect(() => { document.title = `${sp.ten} | POLO HOUSE` }, [sp.ten])

    const ensureThumbVisible = targetIdx => {
        setThumbStart(prev => {
            if (targetIdx < prev) return targetIdx
            if (targetIdx >= prev + VISIBLE_THUMBS) return Math.max(0, targetIdx - VISIBLE_THUMBS + 1)
            return prev
        })
    }

    const goImage = nextIdx => {
        if (gallery.length === 0) return
        const normalized = ((nextIdx % gallery.length) + gallery.length) % gallery.length
        setIdx(normalized)
        setHoverIdx(null)
        ensureThumbVisible(normalized)
    }

    const handleSelectColor = c => {
        if (mau?.ma === c.ma) {
            setMau(null)
            setSize(null)
            setQty(1)
            setIdx(0)
            setHoverIdx(null)
            ensureThumbVisible(0)
            return
        }
        setMau(c)
        setSize(null)
        setQty(1)
        const colorImgIdx = gallery.findIndex(g => g.maMau === c.ma)
        if (colorImgIdx >= 0) {
            setIdx(colorImgIdx)
            ensureThumbVisible(colorImgIdx)
        }
        setHoverIdx(null)
    }

    const handleHoverColor = c => {
        if (!c) {
            setHoverIdx(null)
            return
        }
        const colorImgIdx = gallery.findIndex(g => g.maMau === c.ma)
        if (colorImgIdx >= 0) setHoverIdx(colorImgIdx)
    }

    const handleSelectThumb = i => {
        setIdx(i)
        setHoverIdx(null)
        const item = gallery[i]
        if (item?.maMau) {
            const matchedColor = colors.find(c => c.ma === item.maMau)
            if (matchedColor && mau?.ma !== matchedColor.ma) {
                setMau(matchedColor)
                setSize(null)
                setQty(1)
            }
        }
    }

    const displayIdx = hoverIdx ?? idx
    const currentSlide = gallery[displayIdx] ?? gallery[0] ?? { url: null, maMau: null, tenMau: '', hex: colors[0]?.hex }

    const vs = useMemo(() => {
        if (mau) return sp.bienThe.filter(v => v.mau.ma === mau.ma)
        const bySize = new Map()
        sp.bienThe.forEach(v => {
            const prev = bySize.get(v.size)
            if (!prev || (prev.soLuong === 0 && v.soLuong > 0)) {
                bySize.set(v.size, v)
            }
        })
        return [...bySize.values()]
    }, [sp.bienThe, mau])

    const bt = mau ? vs.find(v => v.size === size) : null
    const v0 = (mau ? vs[0] : null) ?? sp.bienThe.reduce((a, b) => (b.giaBan < a.giaBan ? b : a), sp.bienThe[0])
    const sale = v0.giaGoc > v0.giaBan ? Math.round((1 - v0.giaBan / v0.giaGoc) * 100) : 0

    const handleAddToCart = () => {
        if (!mau) {
            message.warning('Vui lòng chọn Màu sắc sản phẩm')
            return
        }
        if (!bt) {
            message.warning('Vui lòng chọn Kích thước (Size)')
            return
        }
        add(bt.id, qty)
    }

    return (
        <>
            <nav className="crumb" aria-label="Đường dẫn">
                <Link to="/">Trang chủ</Link><span>/</span><Link to="/san-pham">Sản phẩm</Link><span>/</span>{sp.ten}
            </nav>

            <div className="detail">
                <ProductGalleryShopee
                    productName={sp.ten}
                    gallery={gallery}
                    defaultColorHex={colors[0]?.hex}
                    activeIndex={idx}
                    hoverIndex={hoverIdx}
                    thumbStart={thumbStart}
                    onChangeIndex={goImage}
                    onHoverIndex={setHoverIdx}
                    onChangeThumbStart={setThumbStart}
                    onSelectThumb={handleSelectThumb}
                />

                <div>
                    <h1>{sp.ten}</h1>
                    <div className="price">
                        {vnd(v0.giaBan)}
                        {sale > 0 && <><s>{vnd(v0.giaGoc)}</s><span className="off">Giảm {sale}%</span></>}
                    </div>

                    <div className="lblrow" style={{ marginTop: 26 }}>
                        <p className="lbl" style={{ margin: 0 }}>
                            Màu sắc{mau ? <>: <b>{mau.ten}</b></> : ''}
                        </p>
                        {mau && (
                            <button type="button" className="linkbtn" onClick={() => handleSelectColor(mau)}>
                                Bỏ chọn
                            </button>
                        )}
                    </div>

                    <div className="sp-color-chips">
                        {colors.map(c => {
                            const ownThumbUrl = ownImagesFor(sp, c.ma)[0]
                            const isSelected = mau?.ma === c.ma
                            return (
                                <button
                                    key={c.ma}
                                    type="button"
                                    className={`sp-color-chip ${isSelected ? 'on' : ''}`}
                                    onMouseEnter={() => handleHoverColor(c)}
                                    onMouseLeave={() => handleHoverColor(null)}
                                    onClick={() => handleSelectColor(c)}
                                >
                                    <span className="sp-chip-thumb">
                                        {ownThumbUrl ? (
                                            <img src={ownThumbUrl} alt={c.ten} />
                                        ) : (
                                            <Shirt color={c.hex} />
                                        )}
                                    </span>
                                    <span className="sp-chip-name">{c.ten}</span>
                                    {isSelected && <span className="sp-chip-check"><CheckOutlined /></span>}
                                </button>
                            )
                        })}
                    </div>

                    <div className="lblrow">
                        <p className="lbl">Kích thước {size && <b>: {size}</b>}</p>
                        <button type="button" className="linkbtn" onClick={() => setGuide(true)}>Bảng chọn size</button>
                    </div>
                    <div className="szs">
                        {vs.map(v => (
                            <button key={v.id} type="button" disabled={v.soLuong === 0}
                                    aria-label={`Size ${v.size}${v.soLuong === 0 ? ', hết hàng' : ''}`}
                                    className={`sz ${v.size === size ? 'on' : ''}`}
                                    onClick={() => {
                                        if (!mau) {
                                            const slideColor = currentSlide?.maMau
                                                ? colors.find(c => c.ma === currentSlide.maMau)
                                                : colors[0]
                                            if (slideColor) setMau(slideColor)
                                        }
                                        setSize(v.size)
                                        setQty(1)
                                    }}>
                                {v.size}
                            </button>
                        ))}
                    </div>
                    {bt && (bt.soLuong <= 5
                        ? <p className="warn">Chỉ còn {bt.soLuong} sản phẩm</p>
                        : <p className="muted">Còn {bt.soLuong} sản phẩm trong kho</p>)}

                    <div className="qty big">
                        <button type="button" aria-label="Giảm số lượng" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>{qty}
                        <button type="button" aria-label="Tăng số lượng" disabled={!bt || qty >= bt.soLuong}
                                onClick={() => setQty(Math.min(bt?.soLuong ?? 1, qty + 1))}>+</button>
                    </div>
                    <button type="button" className="btn full" disabled={Boolean(mau && size && !bt)} onClick={handleAddToCart}>
                        {!mau
                            ? 'Chọn màu sắc và kích thước để thêm vào giỏ'
                            : !size
                                ? 'Chọn kích thước để thêm vào giỏ'
                                : 'Thêm vào giỏ hàng'}
                    </button>

                    <div className="benefits">
                        <div><CarOutlined /> Miễn phí vận chuyển cho đơn từ 500.000 ₫</div>
                        <div><SwapOutlined /> Đổi trả trong 7 ngày</div>
                        <div><WalletOutlined /> Thanh toán khi nhận hàng</div>
                    </div>

                    <details open><summary>Mô tả</summary><p>{sp.moTa}</p></details>
                    <details><summary>Chất liệu và bảo quản</summary>
                        <p>{sp.chatLieu}. Giặt máy nước lạnh, không dùng chất tẩy, phơi trong bóng râm.</p>
                    </details>
                    <details><summary>Giao hàng và đổi trả</summary>
                        <p>Giao hàng toàn quốc trong 2 đến 4 ngày. Đổi trả trong 7 ngày kể từ khi nhận hàng.</p>
                    </details>
                </div>
            </div>

            <Related currentId={sp.id} />

            <Modal title="Bảng chọn size" open={guide} onCancel={() => setGuide(false)} footer={null} width={620}>
                <Table size="small" pagination={false} dataSource={SIZE_TABLE} rowKey="key"
                       columns={[
                           { title: 'Size', dataIndex: 'size', width: 70 },
                           { title: 'Chiều cao', dataIndex: 'cao' },
                           { title: 'Cân nặng', dataIndex: 'nang' },
                           { title: 'Vòng ngực', dataIndex: 'nguc' },
                       ]} />
                <p style={{ marginTop: 12, color: '#6b7480', fontSize: 13 }}>
                    Bảng chỉ mang tính tham khảo, số đo thực tế có thể lệch 1 đến 2 cm.
                </p>
            </Modal>
        </>
    )
}

function Related({ currentId }) {
    const [items, setItems] = useState([])

    useEffect(() => {
        let ignore = false
        searchProducts({ sapXep: 'ban-chay', kichThuoc: 6 })
            .then(d => { if (!ignore) setItems(d.items.filter(p => p.id !== currentId).slice(0, 4)) })
            .catch(() => {})
        return () => { ignore = true }
    }, [currentId])

    if (items.length === 0) return null
    return (
        <section className="wrap">
            <div className="bar"><h2>Có thể bạn cũng thích</h2></div>
            <div className="grid">{items.map(p => <ProductCard key={p.id} sp={p} />)}</div>
        </section>
    )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { colorsOf, imagesFor, vnd } from '../../data/products'
import ProductImage from './ProductImage'

export default function ProductCard({ sp }) {
    const colors = colorsOf(sp)
    // Mặc định null để hiển thị Ảnh chung của sản phẩm; khi bấm/chọn màu mới hiển thị ảnh riêng của màu đó
    const [mau, setMau] = useState(null)
    const [hover, setHover] = useState(false)

    const v = sp.bienThe.reduce((a, b) => (b.giaBan < a.giaBan ? b : a), sp.bienThe[0])
    const sale = v.giaGoc > v.giaBan ? Math.round((1 - v.giaBan / v.giaGoc) * 100) : 0
    const soldOut = sp.bienThe.every(x => x.soLuong === 0)

    const imgs = imagesFor(sp, mau?.ma ?? null)
    const src = hover && imgs[1] ? imgs[1] : imgs[0]   // rê chuột thì hiện ảnh thứ hai
    const fallbackColor = mau?.hex ?? colors[0]?.hex ?? '#1f2a44'
    const to = mau ? `/san-pham/${sp.id}?mau=${mau.ma}` : `/san-pham/${sp.id}`

    return (
        <div className="card">
            <Link to={to} className="img" aria-label={sp.ten}
                  onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
                <ProductImage src={src} color={fallbackColor} alt={sp.ten} />
                {soldOut ? <span className="tag dark">Hết hàng</span> : sale > 0 && <span className="tag">-{sale}%</span>}
            </Link>
            <div className="sws">
                {colors.map(c => (
                    <span key={c.ma} title={c.ten} role="button" tabIndex={0} aria-label={`Màu ${c.ten}`}
                          className={`sw ${mau?.ma === c.ma ? 'on' : ''}`} style={{ background: c.hex }}
                          onClick={() => setMau(prev => (prev?.ma === c.ma ? null : c))}
                          onKeyDown={e => e.key === 'Enter' && setMau(prev => (prev?.ma === c.ma ? null : c))} />
                ))}
            </div>
            {sp.chatLieu && <span className="mat">{sp.chatLieu}</span>}
            <Link to={to} className="name">{sp.ten}</Link>
            <div className="price">
                {vnd(v.giaBan)}
                {sale > 0 && <><s>{vnd(v.giaGoc)}</s></>}
            </div>
        </div>
    )
}

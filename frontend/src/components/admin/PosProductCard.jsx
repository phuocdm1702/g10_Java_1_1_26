import { useState } from 'react'
import { Button, Card, Tag } from 'antd'
import { ShoppingCartOutlined } from '@ant-design/icons'
import { imagesFor, imgUrl, vnd } from '../../data/products'
import ProductImage from '../user/ProductImage'

export default function PosProductCard({ product, onAddVariant }) {
    const variants = product.bienThe ?? []
    const colors = [...new Map(variants.filter(variant => variant.mau)
        .map(variant => [variant.mau.ma, variant.mau])).values()]
    const [selectedColor, setSelectedColor] = useState(colors[0]?.ma)
    const [selectedSize, setSelectedSize] = useState(null)
    const color = colors.find(item => item.ma === selectedColor) ?? colors[0]
    const colorVariants = variants.filter(variant => variant.mau?.ma === color?.ma)
    const selectedVariant = colorVariants.find(variant => variant.size === selectedSize)
    const priceVariant = selectedVariant ?? colorVariants.reduce((lowest, variant) =>
        !lowest || Number(variant.giaBan) < Number(lowest.giaBan) ? variant : lowest, null)
    const images = color ? imagesFor(product, color.ma) : []
    const photo = images[0] || imgUrl(colorVariants.find(variant => variant.anhUrl)?.anhUrl)

    return (
        <Card size="small" className="pos-product" hoverable>
            <div className="pos-thumb">
                {photo
                    ? <ProductImage src={photo} color={color?.hex} alt={product.ten} />
                    : <ShoppingCartOutlined style={{ fontSize: 34, color: '#b0b7c3' }} />}
            </div>
            <div className="pos-colors" aria-label="Chọn màu">
                {colors.map(item => (
                    <button key={item.ma} type="button" className={`pos-color${item.ma === color?.ma ? ' selected' : ''}`}
                            style={{ backgroundColor: item.hex || '#ddd' }}
                            aria-label={`Màu ${item.ten}`} aria-pressed={item.ma === color?.ma}
                            title={item.ten}
                            onClick={() => { setSelectedColor(item.ma); setSelectedSize(null) }} />
                ))}
            </div>
            {/* <div className="pos-color-name">{color?.ten || 'Chưa có màu'}</div>
            {product.chatLieu && <div className="pos-brand">{product.chatLieu}</div>} */}
            <div className="pos-name" title={product.ten}>{product.ten}</div>
            <div className="pos-price">
                {priceVariant ? vnd(priceVariant.giaBan) : 'Liên hệ'}
                {priceVariant?.giaGoc > priceVariant?.giaBan && <s>{vnd(priceVariant.giaGoc)}</s>}
            </div>
            <div className="pos-option-label">Chọn kích thước</div>
            <div className="pos-sizes">
                {colorVariants.map(variant => {
                    const outOfStock = Number(variant.soLuong ?? 0) <= 0
                    return (
                        <button key={variant.id} type="button"
                                className={`pos-size${variant.size === selectedSize ? ' selected' : ''}`}
                                disabled={outOfStock}
                                aria-pressed={variant.size === selectedSize}
                                title={outOfStock ? 'Hết hàng' : `Còn ${variant.soLuong}`}
                                onClick={() => setSelectedSize(variant.size)}>
                            {variant.size}{outOfStock && <Tag color="default">Hết</Tag>}
                        </button>
                    )
                })}
            </div>
            <Button className="pos-add" type="primary" block disabled={!selectedVariant}
                    icon={<ShoppingCartOutlined />}
                    onClick={() => onAddVariant(product, selectedVariant)}>
                Thêm vào giỏ hàng
            </Button>
        </Card>
    )
}

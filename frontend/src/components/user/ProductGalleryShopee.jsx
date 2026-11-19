import { useEffect, useState } from 'react'
import { Modal } from 'antd'
import { LeftOutlined, RightOutlined, ExpandOutlined } from '@ant-design/icons'
import ProductImage from './ProductImage'
import Shirt from './Shirt'

export const VISIBLE_THUMBS = 5

/**
 * Component tái sử dụng: Album ảnh sản phẩm kiểu Shopee (Ảnh chính + Dải 5 ảnh con có nút Next/Prev + Modal Preview 2 cột độc lập).
 */
export default function ProductGalleryShopee({
    productName,
    gallery = [],
    defaultColorHex = '#1f2a44',
    activeIndex = 0,
    hoverIndex = null,
    thumbStart = 0,
    onChangeIndex,
    onHoverIndex,
    onChangeThumbStart,
    onSelectThumb,
}) {
    // State riêng biệt cho Modal Preview (Lightbox) để khi chuyển ảnh trong Preview KHÔNG làm đổi ảnh gốc phía sau
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIdx, setLightboxIdx] = useState(0)

    const displayIdx = hoverIndex ?? activeIndex
    const currentSlide = gallery[displayIdx] ?? gallery[0] ?? { url: null, maMau: null, tenMau: '', hex: defaultColorHex }
    const lightboxSlide = gallery[lightboxIdx] ?? gallery[0] ?? currentSlide

    const canPrevThumb = thumbStart > 0
    const canNextThumb = thumbStart + VISIBLE_THUMBS < gallery.length
    const visibleThumbs = gallery.slice(thumbStart, thumbStart + VISIBLE_THUMBS)

    const goLightboxImage = nextIdx => {
        if (gallery.length === 0) return
        const normalized = ((nextIdx % gallery.length) + gallery.length) % gallery.length
        setLightboxIdx(normalized)
    }

    const openLightbox = startIdx => {
        setLightboxIdx(startIdx)
        setLightboxOpen(true)
    }

    useEffect(() => {
        if (!lightboxOpen) return
        const onKey = e => {
            if (e.key === 'ArrowLeft') goLightboxImage(lightboxIdx - 1)
            if (e.key === 'ArrowRight') goLightboxImage(lightboxIdx + 1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightboxOpen, lightboxIdx, gallery.length])

    return (
        <>
            <div className="sp-gallery">
                <div className="pic sp-main-pic" onClick={() => openLightbox(displayIdx)} style={{ cursor: 'zoom-in' }}>
                    <ProductImage src={currentSlide?.url} color={currentSlide?.hex ?? defaultColorHex} alt={productName} />

                    {gallery.length > 1 && (
                        <>
                            <button type="button" className="sp-nav-btn prev" aria-label="Ảnh trước"
                                    onClick={e => { e.stopPropagation(); onChangeIndex(activeIndex - 1) }}>
                                <LeftOutlined />
                            </button>
                            <button type="button" className="sp-nav-btn next" aria-label="Ảnh tiếp theo"
                                    onClick={e => { e.stopPropagation(); onChangeIndex(activeIndex + 1) }}>
                                <RightOutlined />
                            </button>
                        </>
                    )}

                    <div className="sp-pic-meta">
                        {currentSlide?.maMau ? (
                            <span className="sp-pic-badge">
                                <i className="sp-dot-mini" style={{ background: currentSlide.hex }} />
                                {currentSlide.tenMau}
                            </span>
                        ) : <span />}
                        <span className="sp-pic-count">
                            {displayIdx + 1} / {gallery.length}
                            <ExpandOutlined style={{ marginLeft: 6 }} />
                        </span>
                    </div>
                </div>

                {gallery.length > 1 && (
                    <div className="sp-thumb-bar">
                        {gallery.length > VISIBLE_THUMBS && (
                            <button type="button" className="sp-thumb-arrow left" disabled={!canPrevThumb}
                                    aria-label="Trượt ảnh con sang trái"
                                    onClick={() => onChangeThumbStart(Math.max(0, thumbStart - 1))}>
                                <LeftOutlined />
                            </button>
                        )}

                        <div className="sp-thumbs-track">
                            {visibleThumbs.map((g, localIdx) => {
                                const realIdx = thumbStart + localIdx
                                const active = realIdx === displayIdx
                                return (
                                    <div key={`${g.maMau ?? 'chung'}-${g.url ?? 'svg'}-${realIdx}`}
                                         className={`sp-tn-item ${active ? 'on' : ''}`}
                                         title={g.maMau ? `Màu ${g.tenMau}${g.isSample ? ' (Mẫu áo)' : ''}` : 'Ảnh chung'}
                                         onMouseEnter={() => onHoverIndex(realIdx)}
                                         onMouseLeave={() => onHoverIndex(null)}
                                         onClick={() => onSelectThumb(realIdx)}>
                                        <ProductImage src={g.url} color={g.hex} alt={g.tenMau} />
                                        {g.maMau && (
                                            <span className="sp-tn-color-tag" style={{ background: g.hex }}
                                                  title={`Màu ${g.tenMau}`} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {gallery.length > VISIBLE_THUMBS && (
                            <button type="button" className="sp-thumb-arrow right" disabled={!canNextThumb}
                                    aria-label="Trượt ảnh con sang phải"
                                    onClick={() => onChangeThumbStart(Math.min(gallery.length - VISIBLE_THUMBS, thumbStart + 1))}>
                                <RightOutlined />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Preview 2 cột chuẩn giao diện Shopee (độc lập 100% với ảnh gốc phía sau) */}
            <Modal
                open={lightboxOpen}
                onCancel={() => setLightboxOpen(false)}
                footer={null}
                title={null}
                width="min(94vw, 920px)"
                centered
                styles={{
                    content: { padding: 16, borderRadius: 4 },
                    body: { padding: 0 },
                }}
            >
                <div className="sp-shopee-modal">
                    <div className="sp-shopee-stage">
                        {lightboxSlide?.url ? (
                            <img src={lightboxSlide.url} alt={productName} className="sp-shopee-main-img" />
                        ) : (
                            <div className="sp-shopee-svg-wrap">
                                <Shirt color={lightboxSlide?.hex ?? defaultColorHex} />
                            </div>
                        )}

                        {gallery.length > 1 && (
                            <>
                                <button type="button" className="sp-shopee-arrow prev" aria-label="Ảnh trước"
                                        onClick={() => goLightboxImage(lightboxIdx - 1)}>
                                    <LeftOutlined />
                                </button>
                                <button type="button" className="sp-shopee-arrow next" aria-label="Ảnh tiếp theo"
                                        onClick={() => goLightboxImage(lightboxIdx + 1)}>
                                    <RightOutlined />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="sp-shopee-side">
                        <div className="sp-shopee-title">{productName}</div>
                        <div className="sp-shopee-sub">
                            {lightboxSlide?.maMau ? (
                                <>
                                    <i className="sp-dot-mini" style={{ background: lightboxSlide.hex, borderColor: '#d0d5dd' }} />
                                    <span>{lightboxSlide.tenMau}</span>
                                </>
                            ) : <span>Hình ảnh sản phẩm</span>}
                            <span> · {lightboxIdx + 1}/{gallery.length}</span>
                        </div>

                        <div className="sp-shopee-grid">
                            {gallery.map((g, i) => (
                                <div key={`sp-grid-${i}`}
                                     className={`sp-shopee-cell ${i === lightboxIdx ? 'on' : ''}`}
                                     title={g.maMau ? `Màu ${g.tenMau}` : 'Ảnh chung'}
                                     onClick={() => goLightboxImage(i)}>
                                    <ProductImage src={g.url} color={g.hex} alt={g.tenMau} />
                                    {g.maMau && (
                                        <span className="sp-tn-color-tag" style={{ background: g.hex }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    )
}

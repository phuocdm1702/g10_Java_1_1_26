import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Slider, Radio, Row, Col, Space, Button, Divider, App } from 'antd'
import {
    RotateLeftOutlined, RotateRightOutlined,
    SwapOutlined, ReloadOutlined, AimOutlined,
} from '@ant-design/icons'

export const ASPECT_OPTIONS = [
    { label: '3:4 (Chuẩn 900×1200)', value: '3:4', w: 900, h: 1200 },
    { label: '4:5 (Dọc 960×1200)', value: '4:5', w: 960, h: 1200 },
    { label: '1:1 (Vuông 1000×1000)', value: '1:1', w: 1000, h: 1000 },
]

const DEFAULT_CROP_META = {
    aspect: '3:4',
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    flipH: false,
    fitMode: 'cover',
}

export default function ImageCropAlignModal({ target, onCancel, onApply }) {
    const { message } = App.useApp()
    const canvasRef = useRef(null)
    const imgRef = useRef(null)
    const dragRef = useRef(null)

    const [loaded, setLoaded] = useState(false)
    const [aspect, setAspect] = useState(DEFAULT_CROP_META.aspect)
    const [zoom, setZoom] = useState(DEFAULT_CROP_META.zoom)
    const [panX, setPanX] = useState(DEFAULT_CROP_META.panX)
    const [panY, setPanY] = useState(DEFAULT_CROP_META.panY)
    const [rotation, setRotation] = useState(DEFAULT_CROP_META.rotation)
    const [flipH, setFlipH] = useState(DEFAULT_CROP_META.flipH)
    const [fitMode, setFitMode] = useState(DEFAULT_CROP_META.fitMode)

    useEffect(() => {
        if (!target?.src) {
            setLoaded(false)
            return
        }
        const meta = target.initialMeta ?? DEFAULT_CROP_META
        setAspect(meta.aspect ?? DEFAULT_CROP_META.aspect)
        setZoom(meta.zoom ?? DEFAULT_CROP_META.zoom)
        setPanX(meta.panX ?? DEFAULT_CROP_META.panX)
        setPanY(meta.panY ?? DEFAULT_CROP_META.panY)
        setRotation(meta.rotation ?? DEFAULT_CROP_META.rotation)
        setFlipH(meta.flipH ?? DEFAULT_CROP_META.flipH)
        setFitMode(meta.fitMode ?? DEFAULT_CROP_META.fitMode)
        setLoaded(false)

        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            imgRef.current = img
            setLoaded(true)
        }
        img.onerror = () => {
            message.error('Không tải được ảnh để căn chỉnh')
        }
        img.src = target.src
    }, [target, message])

    const currentAspectObj = ASPECT_OPTIONS.find(a => a.value === aspect) ?? ASPECT_OPTIONS[0]

    const renderToCanvas = useCallback((canvas, outW, outH, showGrid) => {
        const ctx = canvas.getContext('2d')
        const img = imgRef.current
        if (!ctx || !img) return

        canvas.width = outW
        canvas.height = outH

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, outW, outH)

        const isRotated90 = Math.abs(rotation % 180) === 90
        const srcW = isRotated90 ? img.naturalHeight : img.naturalWidth
        const srcH = isRotated90 ? img.naturalWidth : img.naturalHeight
        if (!srcW || !srcH) return

        const baseScale = fitMode === 'contain'
            ? Math.min(outW / srcW, outH / srcH)
            : Math.max(outW / srcW, outH / srcH)

        const finalScale = baseScale * zoom
        const drawW = srcW * finalScale
        const drawH = srcH * finalScale

        const maxShiftX = Math.max(Math.abs(drawW - outW) / 2, outW * 0.35)
        const maxShiftY = Math.max(Math.abs(drawH - outH) / 2, outH * 0.35)

        const offsetX = -(panX / 100) * maxShiftX
        const offsetY = -(panY / 100) * maxShiftY

        ctx.save()
        ctx.translate(outW / 2 + offsetX, outH / 2 + offsetY)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.scale(flipH ? -finalScale : finalScale, finalScale)
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
        ctx.restore()

        if (showGrid) {
            ctx.save()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
            ctx.lineWidth = 1
            for (let i = 1; i <= 2; i++) {
                const x = (outW / 3) * i
                const y = (outH / 3) * i
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, outH); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(outW, y); ctx.stroke()
            }
            ctx.setLineDash([4, 4])
            ctx.strokeStyle = 'rgba(29, 42, 75, 0.45)'
            ctx.beginPath(); ctx.moveTo(outW / 2, 0); ctx.lineTo(outW / 2, outH); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(0, outH / 2); ctx.lineTo(outW, outH / 2); ctx.stroke()
            ctx.restore()
        }
    }, [zoom, panX, panY, rotation, flipH, fitMode])

    useEffect(() => {
        if (!loaded || !canvasRef.current) return
        const previewH = 400
        const previewW = Math.round((previewH * currentAspectObj.w) / currentAspectObj.h)
        renderToCanvas(canvasRef.current, previewW, previewH, true)
    }, [loaded, currentAspectObj, renderToCanvas])

    const onMouseDown = e => {
        e.preventDefault()
        dragRef.current = { startX: e.clientX, startY: e.clientY, initPanX: panX, initPanY: panY }
    }

    const onMouseMove = e => {
        if (!dragRef.current) return
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        const sensitivity = 0.65 / Math.max(1, zoom * 0.6)
        const nextX = Math.max(-100, Math.min(100, Math.round(dragRef.current.initPanX - dx * sensitivity)))
        const nextY = Math.max(-100, Math.min(100, Math.round(dragRef.current.initPanY - dy * sensitivity)))
        setPanX(nextX)
        setPanY(nextY)
    }

    const onMouseUp = () => {
        dragRef.current = null
    }

    const onWheel = e => {
        e.preventDefault()
        const delta = e.deltaY < 0 ? 0.12 : -0.12
        setZoom(z => Number(Math.max(0.5, Math.min(4, z + delta)).toFixed(2)))
    }

    const resetAll = () => {
        setZoom(DEFAULT_CROP_META.zoom)
        setPanX(DEFAULT_CROP_META.panX)
        setPanY(DEFAULT_CROP_META.panY)
        setRotation(DEFAULT_CROP_META.rotation)
        setFlipH(DEFAULT_CROP_META.flipH)
        setFitMode(DEFAULT_CROP_META.fitMode)
    }

    const handleConfirm = () => {
        if (!loaded || !imgRef.current) return
        const exportCanvas = document.createElement('canvas')
        renderToCanvas(exportCanvas, currentAspectObj.w, currentAspectObj.h, false)

        exportCanvas.toBlob(blob => {
            if (!blob) {
                message.error('Không thể xử lý ảnh')
                return
            }
            const fileName = `cropped-${Date.now()}.jpg`
            const croppedFile = new File([blob], fileName, { type: 'image/jpeg' })
            const croppedUrl = URL.createObjectURL(croppedFile)
            onApply(croppedFile, croppedUrl, {
                aspect, zoom, panX, panY, rotation, flipH, fitMode,
            })
        }, 'image/jpeg', 0.92)
    }

    return (
        <Modal
            open={Boolean(target)}
            onCancel={onCancel}
            onOk={handleConfirm}
            okText="Áp dụng"
            cancelText="Hủy"
            width={860}
            centered
            title="Căn chỉnh & cắt ảnh"
        >
            <Row gutter={24} align="middle">
                <Col xs={24} md={12} style={{ textAlign: 'center' }}>
                    <div
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onWheel={onWheel}
                        style={{
                            display: 'inline-grid',
                            placeItems: 'center',
                            background: '#f0f2f5',
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid #d9d9d9',
                            cursor: 'grab',
                            userSelect: 'none',
                        }}
                    >
                        <canvas ref={canvasRef} style={{ borderRadius: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.12)', maxWidth: '100%' }} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#667085' }}>
                        Kéo trực tiếp trên ảnh để căn vị trí, cuộn chuột để thu phóng.
                    </div>
                </Col>

                <Col xs={24} md={12}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Tỉ lệ khung hình</div>
                            <Radio.Group value={aspect} onChange={e => setAspect(e.target.value)} buttonStyle="solid" size="small">
                                {ASPECT_OPTIONS.map(opt => (
                                    <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
                                ))}
                            </Radio.Group>
                            <div style={{ marginTop: 8 }}>
                                <Radio.Group value={fitMode} onChange={e => setFitMode(e.target.value)} size="small">
                                    <Radio value="cover">Lấp đầy khung</Radio>
                                    <Radio value="contain">Vừa toàn bộ ảnh</Radio>
                                </Radio.Group>
                            </div>
                        </div>

                        <Divider style={{ margin: '4px 0' }} />

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600 }}>Thu phóng: {Math.round(zoom * 100)}%</span>
                                <Space size={4}>
                                    {[1, 1.5, 2, 3].map(z => (
                                        <Button key={z} size="small" type={zoom === z ? 'primary' : 'default'}
                                                onClick={() => setZoom(z)}>{z}x</Button>
                                    ))}
                                </Space>
                            </div>
                            <Slider min={0.5} max={4} step={0.05} value={zoom} onChange={setZoom} />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>Căn ngang: {panX}%</span>
                                <Space size={4}>
                                    <Button size="small" onClick={() => setPanX(-100)}>Trái</Button>
                                    <Button size="small" icon={<AimOutlined />} onClick={() => setPanX(0)}>Giữa</Button>
                                    <Button size="small" onClick={() => setPanX(100)}>Phải</Button>
                                </Space>
                            </div>
                            <Slider min={-100} max={100} step={1} value={panX} onChange={setPanX} />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>Căn dọc: {panY}%</span>
                                <Space size={4}>
                                    <Button size="small" onClick={() => setPanY(-100)}>Trên</Button>
                                    <Button size="small" icon={<AimOutlined />} onClick={() => setPanY(0)}>Giữa</Button>
                                    <Button size="small" onClick={() => setPanY(100)}>Dưới</Button>
                                </Space>
                            </div>
                            <Slider min={-100} max={100} step={1} value={panY} onChange={setPanY} />
                        </div>

                        <Divider style={{ margin: '4px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <Space size={6}>
                                <Button size="small" icon={<RotateLeftOutlined />}
                                        onClick={() => setRotation(r => (r - 90) % 360)}>Xoay -90°</Button>
                                <Button size="small" icon={<RotateRightOutlined />}
                                        onClick={() => setRotation(r => (r + 90) % 360)}>Xoay +90°</Button>
                                <Button size="small" icon={<SwapOutlined />} type={flipH ? 'primary' : 'default'}
                                        onClick={() => setFlipH(f => !f)}>Lật ngang</Button>
                            </Space>
                            <Button size="small" icon={<ReloadOutlined />} onClick={resetAll}>Đặt lại</Button>
                        </div>
                    </Space>
                </Col>
            </Row>
        </Modal>
    )
}

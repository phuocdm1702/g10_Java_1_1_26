import { useCallback, useEffect, useState } from 'react'
import { Card, Tabs, Upload, Button, Image, Space, Tag, Typography, App, Alert, Switch, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined, StarOutlined, UndoOutlined, ScissorOutlined } from '@ant-design/icons'
import api from '../../api/axios'
import { imgUrl } from '../../data/products'
import ImageCropAlignModal from './ImageCropAlignModal'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5
const MAX_PER_GROUP = 8

const dot = hex => ({
    width: 14, height: 14, borderRadius: '50%', background: hex ?? '#ccc',
    border: '1px solid #d9d9d9', display: 'inline-block',
})

export const groupKeyOf = idMau => (idMau == null ? 'chung' : String(idMau))

function AdminImageCard({ item, isPrimary, onSelectPrimary, onOpenCrop, onRevertCrop, onDelete }) {
    const borderStyle = item.cropped
        ? '2px solid #1677ff'
        : item.isNew
            ? '2px dashed #faad14'
            : '1px solid #f0f0f0'

    return (
        <div style={{ width: 156 }}>
            <div style={{
                position: 'relative',
                border: borderStyle,
                borderRadius: 6,
                overflow: 'hidden',
                background: '#fafafa',
            }}>
                <Image src={item.src} width={152} height={200} style={{ objectFit: 'cover' }} />

                {(item.cropped || item.isNew) && (
                    <Tag color={item.cropped ? 'blue' : 'gold'}
                         style={{ position: 'absolute', top: 6, left: 6, margin: 0, fontSize: 11 }}>
                        {item.cropped ? 'Đã căn chỉnh' : 'Ảnh mới'}
                    </Tag>
                )}

                <div style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 6,
                    right: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 4,
                }}>
                    {item.cropped ? (
                        <Tooltip title="Khôi phục ảnh gốc">
                            <Button
                                size="small"
                                icon={<UndoOutlined />}
                                style={{ fontSize: 11.5, paddingInline: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                                onClick={onRevertCrop}
                            >
                                Về gốc
                            </Button>
                        </Tooltip>
                    ) : <span />}

                    <Tooltip title="Căn chỉnh & cắt ảnh">
                        <Button
                            size="small"
                            type="primary"
                            icon={<ScissorOutlined />}
                            style={{ fontSize: 11.5, paddingInline: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
                            onClick={onOpenCrop}
                        >
                            Căn / Crop
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {isPrimary ? (
                    <Tag color="green" style={{ margin: 0 }}>Ảnh chính</Tag>
                ) : (
                    <Button size="small" icon={<StarOutlined />} onClick={onSelectPrimary}>
                        Chọn chính
                    </Button>
                )}
                <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={onDelete}
                />
            </div>
        </div>
    )
}

export default function AnhSanPham({
    idAo,
    colors,
    pendingFiles: externalPendingFiles,
    setPendingFiles: setExternalPendingFiles,
    pendingDeletes: externalPendingDeletes,
    setPendingDeletes: setExternalPendingDeletes,
    pendingPrimaries: externalPendingPrimaries,
    setPendingPrimaries: setExternalPendingPrimaries,
    pendingCrops: externalPendingCrops,
    setPendingCrops: setExternalPendingCrops,
}) {
    const { message } = App.useApp()
    const [list, setList] = useState([])
    const [internalPendingFiles, setInternalPendingFiles] = useState([])
    const [internalPendingDeletes, setInternalPendingDeletes] = useState([])
    const [internalPendingPrimaries, setInternalPendingPrimaries] = useState({})
    const [internalPendingCrops, setInternalPendingCrops] = useState({})
    const [autoOpenCrop, setAutoOpenCrop] = useState(true)
    const [cropTarget, setCropTarget] = useState(null)

    const pendingFiles = externalPendingFiles ?? internalPendingFiles
    const setPendingFiles = setExternalPendingFiles ?? setInternalPendingFiles
    const pendingDeletes = externalPendingDeletes ?? internalPendingDeletes
    const setPendingDeletes = setExternalPendingDeletes ?? setInternalPendingDeletes
    const pendingPrimaries = externalPendingPrimaries ?? internalPendingPrimaries
    const setPendingPrimaries = setExternalPendingPrimaries ?? setInternalPendingPrimaries
    const pendingCrops = externalPendingCrops ?? internalPendingCrops
    const setPendingCrops = setExternalPendingCrops ?? setInternalPendingCrops

    const load = useCallback(async () => {
        if (!idAo) {
            setList([])
            return
        }
        try {
            const res = await api.get(`/admin/san-pham/${idAo}/anh`)
            setList(res.data)
        } catch {
            message.error('Không tải được danh sách hình ảnh')
        }
    }, [idAo, message])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        return () => {
            pendingFiles.forEach(p => {
                if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
                if (p.originalUrl && p.originalUrl !== p.previewUrl) URL.revokeObjectURL(p.originalUrl)
            })
            Object.values(pendingCrops).forEach(c => {
                if (c?.previewUrl) URL.revokeObjectURL(c.previewUrl)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSelectFile = (file, idMau) => {
        if (!TYPES.includes(file.type)) {
            message.error('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP')
            return Upload.LIST_IGNORE
        }
        if (file.size / 1024 / 1024 > MAX_MB) {
            message.error(`Dung lượng ảnh không được vượt quá ${MAX_MB}MB`)
            return Upload.LIST_IGNORE
        }

        const targetMau = idMau ?? null
        const activeSavedCount = list.filter(a => (a.idMau ?? null) === targetMau && !pendingDeletes.includes(a.id)).length
        const pendingCount = pendingFiles.filter(p => (p.idMau ?? null) === targetMau).length
        if (activeSavedCount + pendingCount >= MAX_PER_GROUP) {
            message.warning(`Mỗi nhóm màu tối đa ${MAX_PER_GROUP} ảnh`)
            return Upload.LIST_IGNORE
        }

        const previewUrl = URL.createObjectURL(file)
        const item = {
            uid: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            originalFile: file,
            previewUrl,
            originalUrl: previewUrl,
            idMau: targetMau,
            cropMeta: null,
        }
        setPendingFiles(prev => [...prev, item])

        if (autoOpenCrop) {
            setCropTarget({
                mode: 'pending',
                uid: item.uid,
                idMau: targetMau,
                src: item.originalUrl,
                initialMeta: null,
            })
        }
        return false
    }

    const removePendingFile = (uid, idMau) => {
        const gKey = groupKeyOf(idMau)
        setPendingFiles(prev => {
            const found = prev.find(p => p.uid === uid)
            if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl)
            if (found?.originalUrl && found.originalUrl !== found.previewUrl) URL.revokeObjectURL(found.originalUrl)
            return prev.filter(p => p.uid !== uid)
        })
        if (pendingPrimaries[gKey] === uid) {
            setPendingPrimaries(prev => {
                const next = { ...prev }
                delete next[gKey]
                return next
            })
        }
    }

    const markDeleteSaved = (id, idMau) => {
        const gKey = groupKeyOf(idMau)
        setPendingDeletes(prev => (prev.includes(id) ? prev : [...prev, id]))
        if (pendingPrimaries[gKey] === `saved-${id}`) {
            setPendingPrimaries(prev => {
                const next = { ...prev }
                delete next[gKey]
                return next
            })
        }
    }

    const markPrimary = (idMau, itemKey) => {
        const gKey = groupKeyOf(idMau)
        setPendingPrimaries(prev => ({ ...prev, [gKey]: itemKey }))
    }

    const openCropForItem = (item, targetMau) => {
        if (item.isNew) {
            const found = pendingFiles.find(p => p.uid === item.uid)
            if (!found) return
            setCropTarget({
                mode: 'pending',
                uid: found.uid,
                idMau: targetMau,
                src: found.originalUrl || found.previewUrl,
                initialMeta: found.cropMeta,
            })
        } else {
            const existingCrop = pendingCrops[item.id]
            setCropTarget({
                mode: 'saved',
                savedId: item.id,
                idMau: targetMau,
                src: item.originalSrc,
                initialMeta: existingCrop?.cropMeta ?? null,
            })
        }
    }

    // Thao tác trực quan ngay trên thẻ ảnh nên không bắn toast gây nhiễu
    const revertCropForItem = item => {
        if (item.isNew) {
            setPendingFiles(prev => prev.map(p => {
                if (p.uid !== item.uid) return p
                if (p.previewUrl && p.previewUrl !== p.originalUrl) {
                    URL.revokeObjectURL(p.previewUrl)
                }
                return {
                    ...p,
                    file: p.originalFile,
                    previewUrl: p.originalUrl,
                    cropMeta: null,
                }
            }))
        } else {
            setPendingCrops(prev => {
                const existing = prev[item.id]
                if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
                const next = { ...prev }
                delete next[item.id]
                return next
            })
        }
    }

    const handleApplyCrop = (croppedFile, croppedPreviewUrl, meta) => {
        if (!cropTarget) return
        if (cropTarget.mode === 'pending') {
            setPendingFiles(prev => prev.map(p => {
                if (p.uid !== cropTarget.uid) return p
                if (p.previewUrl && p.previewUrl !== p.originalUrl) {
                    URL.revokeObjectURL(p.previewUrl)
                }
                return {
                    ...p,
                    file: croppedFile,
                    previewUrl: croppedPreviewUrl,
                    cropMeta: meta,
                }
            }))
        } else if (cropTarget.mode === 'saved') {
            setPendingCrops(prev => {
                const old = prev[cropTarget.savedId]
                if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl)
                return {
                    ...prev,
                    [cropTarget.savedId]: {
                        file: croppedFile,
                        previewUrl: croppedPreviewUrl,
                        originalUrl: cropTarget.src,
                        idMau: cropTarget.idMau,
                        cropMeta: meta,
                    },
                }
            })
        }
        setCropTarget(null)
    }

    const panel = idMau => {
        const targetMau = idMau ?? null
        const gKey = groupKeyOf(targetMau)

        const activeSaved = list
            .filter(a => (a.idMau ?? null) === targetMau && !pendingDeletes.includes(a.id))
            .map(a => {
                const edited = pendingCrops[a.id]
                const origSrc = imgUrl(a.url)
                return {
                    itemKey: `saved-${a.id}`,
                    isNew: false,
                    id: a.id,
                    src: edited ? edited.previewUrl : origSrc,
                    originalSrc: origSrc,
                    cropped: Boolean(edited),
                }
            })

        const previews = pendingFiles
            .filter(p => (p.idMau ?? null) === targetMau)
            .map(p => ({
                itemKey: p.uid,
                isNew: true,
                uid: p.uid,
                src: p.previewUrl,
                originalSrc: p.originalUrl,
                cropped: Boolean(p.cropMeta),
            }))

        const combined = [...activeSaved, ...previews]
        const chosenPrimaryKey = pendingPrimaries[gKey]

        const ordered = chosenPrimaryKey && combined.some(x => x.itemKey === chosenPrimaryKey)
            ? [
                combined.find(x => x.itemKey === chosenPrimaryKey),
                ...combined.filter(x => x.itemKey !== chosenPrimaryKey),
            ]
            : combined

        return (
            <Space wrap size={16} align="start">
                {ordered.map((item, i) => (
                    <AdminImageCard
                        key={item.itemKey}
                        item={item}
                        isPrimary={i === 0}
                        onSelectPrimary={() => markPrimary(targetMau, item.itemKey)}
                        onOpenCrop={() => openCropForItem(item, targetMau)}
                        onRevertCrop={() => revertCropForItem(item)}
                        onDelete={() => item.isNew
                            ? removePendingFile(item.uid, targetMau)
                            : markDeleteSaved(item.id, targetMau)}
                    />
                ))}

                {ordered.length < MAX_PER_GROUP && (
                    <Upload multiple showUploadList={false} accept={TYPES.join(',')}
                            beforeUpload={file => handleSelectFile(file, targetMau)}>
                        <div style={{ width: 156, height: 200, border: '1px dashed #d9d9d9', borderRadius: 8,
                            display: 'grid', placeItems: 'center', cursor: 'pointer', textAlign: 'center', padding: 8 }}>
                            <div>
                                <PlusOutlined style={{ fontSize: 18 }} />
                                <div style={{ marginTop: 6, fontSize: 12.5 }}>Tải ảnh lên</div>
                            </div>
                        </div>
                    </Upload>
                )}
            </Space>
        )
    }

    const items = [
        { key: 'chung', label: 'Ảnh chung', children: panel(null) },
        ...colors.map(c => ({
            key: String(c.id),
            label: <Space size={6}><span style={dot(c.maHex)} />{c.tenMau}</Space>,
            children: panel(c.id),
        })),
    ]

    return (
        <Card
            title="Hình ảnh theo màu"
            extra={
                <Space size={8}>
                    <span style={{ fontSize: 12.5, color: '#667085' }}>Tự động cắt ảnh khi chọn:</span>
                    <Switch size="small" checked={autoOpenCrop} onChange={setAutoOpenCrop} />
                </Space>
            }
        >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Ảnh đầu tiên của mỗi màu là ảnh chính. Hỗ trợ JPG, PNG, WEBP (tối đa {MAX_MB}MB, tối đa {MAX_PER_GROUP} ảnh/màu, tỉ lệ chuẩn 3:4).
            </Typography.Paragraph>

            {pendingDeletes.length > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 14 }}
                    message={`Đã chọn xóa ${pendingDeletes.length} ảnh. Nhấn "Lưu sản phẩm" để hoàn tất.`}
                    action={
                        <Button size="small" icon={<UndoOutlined />} onClick={() => setPendingDeletes([])}>
                            Hoàn tác
                        </Button>
                    }
                />
            )}

            <Tabs items={items} />

            <ImageCropAlignModal
                target={cropTarget}
                onCancel={() => setCropTarget(null)}
                onApply={handleApplyCrop}
            />
        </Card>
    )
}

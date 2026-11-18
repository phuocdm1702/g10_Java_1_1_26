import { useCallback, useEffect, useState } from 'react'
import { Card, Tabs, Upload, Button, Image, Space, Tag, Typography, App, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, StarOutlined, UndoOutlined } from '@ant-design/icons'
import api from '../../api/axios'
import { imgUrl } from '../../data/products'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5
const MAX_PER_GROUP = 8

const dot = hex => ({
    width: 14, height: 14, borderRadius: '50%', background: hex ?? '#ccc',
    border: '1px solid #d9d9d9', display: 'inline-block',
})

export const groupKeyOf = idMau => (idMau == null ? 'chung' : String(idMau))

export default function AnhSanPham({
    idAo,
    colors,
    pendingFiles: externalPendingFiles,
    setPendingFiles: setExternalPendingFiles,
    pendingDeletes: externalPendingDeletes,
    setPendingDeletes: setExternalPendingDeletes,
    pendingPrimaries: externalPendingPrimaries,
    setPendingPrimaries: setExternalPendingPrimaries,
}) {
    const { message } = App.useApp()
    const [list, setList] = useState([])
    const [internalPendingFiles, setInternalPendingFiles] = useState([])
    const [internalPendingDeletes, setInternalPendingDeletes] = useState([])
    const [internalPendingPrimaries, setInternalPendingPrimaries] = useState({})

    const pendingFiles = externalPendingFiles ?? internalPendingFiles
    const setPendingFiles = setExternalPendingFiles ?? setInternalPendingFiles
    const pendingDeletes = externalPendingDeletes ?? internalPendingDeletes
    const setPendingDeletes = setExternalPendingDeletes ?? setInternalPendingDeletes
    const pendingPrimaries = externalPendingPrimaries ?? internalPendingPrimaries
    const setPendingPrimaries = setExternalPendingPrimaries ?? setInternalPendingPrimaries

    const load = useCallback(async () => {
        if (!idAo) {
            setList([])
            return
        }
        try {
            const res = await api.get(`/admin/san-pham/${idAo}/anh`)
            setList(res.data)
        } catch {
            message.error('Không tải được danh sách ảnh')
        }
    }, [idAo, message])

    useEffect(() => { load() }, [load])

    // Giải phóng bộ nhớ blob URL khi rời trang mà không lưu
    useEffect(() => {
        return () => {
            pendingFiles.forEach(p => {
                if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSelectFile = (file, idMau) => {
        if (!TYPES.includes(file.type)) {
            message.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP')
            return Upload.LIST_IGNORE
        }
        if (file.size / 1024 / 1024 > MAX_MB) {
            message.error(`Ảnh vượt quá ${MAX_MB}MB`)
            return Upload.LIST_IGNORE
        }

        const targetMau = idMau ?? null
        const activeSavedCount = list.filter(a => (a.idMau ?? null) === targetMau && !pendingDeletes.includes(a.id)).length
        const pendingCount = pendingFiles.filter(p => (p.idMau ?? null) === targetMau).length
        if (activeSavedCount + pendingCount >= MAX_PER_GROUP) {
            message.warning(`Mỗi màu tối đa ${MAX_PER_GROUP} ảnh`)
            return Upload.LIST_IGNORE
        }

        const previewUrl = URL.createObjectURL(file)
        const item = {
            uid: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            previewUrl,
            idMau: targetMau,
        }
        setPendingFiles(prev => [...prev, item])
        return false // Chỉ thêm vào danh sách tạm trên FE, chờ bấm "Lưu sản phẩm" mới đẩy lên Cloud
    }

    // Xóa tạm ảnh vừa chọn từ máy (chưa từng lên Cloud)
    const removePendingFile = (uid, idMau) => {
        const gKey = groupKeyOf(idMau)
        setPendingFiles(prev => {
            const found = prev.find(p => p.uid === uid)
            if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl)
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

    // Đánh dấu xóa tạm ảnh đã có trên Cloud (chỉ xóa thật khi bấm "Lưu sản phẩm")
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

    // Hoàn tác các ảnh đã đánh dấu xóa tạm
    const undoAllDeletes = () => {
        setPendingDeletes([])
    }

    // Chọn ảnh chính tạm trên FE (áp dụng cho cả ảnh cũ lẫn ảnh mới xem trước)
    const markPrimary = (idMau, itemKey) => {
        const gKey = groupKeyOf(idMau)
        setPendingPrimaries(prev => ({ ...prev, [gKey]: itemKey }))
    }

    const panel = idMau => {
        const targetMau = idMau ?? null
        const gKey = groupKeyOf(targetMau)

        // Gộp ảnh đã lưu (chưa bị đánh dấu xóa) và ảnh mới chọn trên FE thành 1 danh sách hiển thị
        const activeSaved = list
            .filter(a => (a.idMau ?? null) === targetMau && !pendingDeletes.includes(a.id))
            .map(a => ({
                itemKey: `saved-${a.id}`,
                isNew: false,
                id: a.id,
                src: imgUrl(a.url),
            }))

        const previews = pendingFiles
            .filter(p => (p.idMau ?? null) === targetMau)
            .map(p => ({
                itemKey: p.uid,
                isNew: true,
                uid: p.uid,
                src: p.previewUrl,
            }))

        const combined = [...activeSaved, ...previews]
        const chosenPrimaryKey = pendingPrimaries[gKey]

        // Nếu người dùng đã bấm "Chọn chính" tạm trên FE, đưa ảnh đó lên đầu danh sách hiển thị
        const ordered = chosenPrimaryKey && combined.some(x => x.itemKey === chosenPrimaryKey)
            ? [
                combined.find(x => x.itemKey === chosenPrimaryKey),
                ...combined.filter(x => x.itemKey !== chosenPrimaryKey),
            ]
            : combined

        return (
            <Space wrap size={16} align="start">
                {ordered.map((item, i) => (
                    <div key={item.itemKey} style={{ width: 140 }}>
                        <div style={{
                            position: 'relative',
                            border: item.isNew ? '2px dashed #faad14' : '1px solid #f0f0f0',
                            borderRadius: 6,
                            overflow: 'hidden',
                        }}>
                            <Image
                                src={item.src}
                                width={item.isNew ? 136 : 138}
                                height={176}
                                style={{ objectFit: 'cover' }}
                            />
                            {item.isNew && (
                                <Tag color="gold" style={{ position: 'absolute', top: 6, left: 6, margin: 0, fontSize: 11 }}>
                                    Mới (Tạm)
                                </Tag>
                            )}
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {i === 0 ? (
                                <Tag color="green" style={{ margin: 0 }}>Ảnh chính</Tag>
                            ) : (
                                <Button size="small" icon={<StarOutlined />} onClick={() => markPrimary(targetMau, item.itemKey)}>
                                    Chọn chính
                                </Button>
                            )}
                            <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                title="Xóa tạm (Chỉ xóa thật khi bấm Lưu sản phẩm)"
                                onClick={() => item.isNew
                                    ? removePendingFile(item.uid, targetMau)
                                    : markDeleteSaved(item.id, targetMau)}
                            />
                        </div>
                    </div>
                ))}

                {ordered.length < MAX_PER_GROUP && (
                    <Upload multiple showUploadList={false} accept={TYPES.join(',')}
                            beforeUpload={file => handleSelectFile(file, targetMau)}>
                        <div style={{ width: 140, height: 180, border: '1px dashed #d9d9d9', borderRadius: 8,
                            display: 'grid', placeItems: 'center', cursor: 'pointer', textAlign: 'center' }}>
                            <div><PlusOutlined /><div style={{ marginTop: 6 }}>Chọn ảnh xem trước</div></div>
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
        <Card title="Hình ảnh theo màu">
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Mọi thao tác <b>thêm ảnh xem trước</b>, <b>đổi ảnh chính</b> hoặc <b>xóa ảnh</b> ở đây đều là <b>tạm thời trên giao diện</b>.
                Chỉ khi bạn bấm nút <b>"Lưu sản phẩm"</b> ở cuối trang thì hệ thống mới cập nhật chính thức lên Cloudinary và Database (nếu bấm Hủy/Quay lại thì ảnh cũ vẫn giữ nguyên).
                <br />
                JPG, PNG hoặc WEBP, tối đa {MAX_MB}MB, mỗi màu tối đa {MAX_PER_GROUP} ảnh.
            </Typography.Paragraph>

            {pendingDeletes.length > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 14 }}
                    message={`Đang đánh dấu xóa tạm ${pendingDeletes.length} ảnh (sẽ xóa vĩnh viễn khi bấm "Lưu sản phẩm").`}
                    action={
                        <Button size="small" icon={<UndoOutlined />} onClick={undoAllDeletes}>
                            Hoàn tác xóa
                        </Button>
                    }
                />
            )}

            <Tabs items={items} />
        </Card>
    )
}

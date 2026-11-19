import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Table, InputNumber, Space, Switch, Row, Col, Spin, App } from 'antd'
import AnhSanPham from '../../components/admin/AnhSanPham'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import api from '../../api/axios'

const keyOf = (idMau, idKichThuoc) => `${idMau}-${idKichThuoc}`

const money = {
    min: 0,
    style: { width: '100%' },
    formatter: v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    parser: v => v.replace(/\./g, ''),
}

const dot = hex => ({
    width: 18, height: 18, borderRadius: '50%', background: hex ?? '#ccc',
    border: '1px solid #d9d9d9', display: 'inline-block',
})

export default function SanPhamForm() {
    const { message } = App.useApp()
    const { id } = useParams()
    const isEdit = Boolean(id)
    const navigate = useNavigate()
    const [form] = Form.useForm()

    const [dm, setDm] = useState({ mauSac: [], kichThuoc: [], chatLieu: [] })
    const [colorIds, setColorIds] = useState([])
    const [sizeIds, setSizeIds] = useState([])
    const [variants, setVariants] = useState({})   // key "idMau-idKichThuoc" -> biến thể
    const [bulk, setBulk] = useState({ giaBanBanDau: null, giaBan: null, soLuong: null })

    // Trạng thái ảnh tạm trên FE (chỉ áp dụng thật lên Cloud/DB khi bấm "Lưu sản phẩm")
    const [pendingFiles, setPendingFiles] = useState([])
    const [pendingDeletes, setPendingDeletes] = useState([])
    const [pendingPrimaries, setPendingPrimaries] = useState({})
    const [pendingCrops, setPendingCrops] = useState({})

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const init = async () => {
            setLoading(true)
            try {
                const dmRes = await api.get('/admin/danh-muc')
                setDm(dmRes.data)
                if (isEdit) {
                    const { data: sp } = await api.get(`/admin/san-pham/${id}`)
                    form.setFieldsValue({
                        maAo: sp.maAo, tenAo: sp.tenAo, moTa: sp.moTa,
                        idChatLieu: sp.idChatLieu, trangThai: sp.trangThai,
                    })
                    setColorIds([...new Set(sp.bienThe.map(v => v.idMau))])
                    setSizeIds([...new Set(sp.bienThe.map(v => v.idKichThuoc))])
                    setVariants(Object.fromEntries(sp.bienThe.map(v => [keyOf(v.idMau, v.idKichThuoc), v])))
                }
            } catch {
                message.error('Không tải được dữ liệu. Kiểm tra backend đã chạy chưa.')
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [id, isEdit, form, message])

    // Chọn màu / size -> sinh lại bảng biến thể, giữ nguyên dòng đã nhập
    const rebuild = (cIds, sIds) => {
        setVariants(prev => {
            const base = Object.values(prev)[0]
            const next = {}
            cIds.forEach(m => sIds.forEach(k => {
                const key = keyOf(m, k)
                next[key] = prev[key] ?? {
                    idMau: m, idKichThuoc: k,
                    giaBanBanDau: base?.giaBanBanDau ?? bulk.giaBanBanDau ?? 0,
                    giaBan: base?.giaBan ?? bulk.giaBan ?? 0,
                    soLuong: bulk.soLuong ?? 0,
                    trangThai: true,
                }
            }))
            return next
        })
    }
    const onColors = ids => { setColorIds(ids); rebuild(ids, sizeIds) }
    const onSizes = ids => { setSizeIds(ids); rebuild(colorIds, ids) }

    const setVar = (v, patch) => setVariants(prev => {
        const key = keyOf(v.idMau, v.idKichThuoc)
        return { ...prev, [key]: { ...prev[key], ...patch } }
    })

    const applyBulk = () => setVariants(prev => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, {
            ...v,
            ...(bulk.giaBanBanDau != null && { giaBanBanDau: bulk.giaBanBanDau }),
            ...(bulk.giaBan != null && { giaBan: bulk.giaBan }),
            ...(bulk.soLuong != null && { soLuong: bulk.soLuong }),
        }])))

    const rows = useMemo(() => Object.values(variants).sort((a, b) =>
        dm.mauSac.findIndex(x => x.id === a.idMau) - dm.mauSac.findIndex(x => x.id === b.idMau) ||
        dm.kichThuoc.findIndex(x => x.id === a.idKichThuoc) - dm.kichThuoc.findIndex(x => x.id === b.idKichThuoc)
    ), [variants, dm])

    const submit = async () => {
        const values = await form.validateFields()
        if (rows.length === 0) return message.warning('Chọn ít nhất 1 màu và 1 kích thước')
        const bad = rows.find(v => v.giaBan == null || v.giaBanBanDau == null || v.soLuong == null || v.giaBan > v.giaBanBanDau)
        if (bad) return message.error('Kiểm tra lại giá: giá bán phải có giá trị và không lớn hơn giá niêm yết')

        const body = {
            ...values,
            bienThe: rows.map(v => ({
                idMau: v.idMau, idKichThuoc: v.idKichThuoc,
                giaBanBanDau: v.giaBanBanDau, giaBan: v.giaBan,
                soLuong: v.soLuong, trangThai: v.trangThai ?? true,
            })),
        }
        setSaving(true)
        try {
            let targetId = id
            if (isEdit) {
                await api.put(`/admin/san-pham/${id}`, body)
            } else {
                const { data } = await api.post('/admin/san-pham', body)
                targetId = data.id
            }

            // 1. Xóa thật các ảnh đã bấm nút Thùng rác
            let imageError = null
            for (const delId of pendingDeletes) {
                try {
                    await api.delete(`/admin/anh/${delId}`)
                } catch (err) {
                    imageError = err.response?.data?.message ?? 'Không thể xóa một số hình ảnh'
                }
            }
            setPendingDeletes([])

            // 2. Xử lý các ảnh cũ đã được Căn chỉnh / Crop tại chỗ (tải bản đã crop lên và thay thế ảnh cũ)
            const replacedSavedIdMap = {}
            for (const [savedIdStr, cropInfo] of Object.entries(pendingCrops)) {
                const oldId = Number(savedIdStr)
                if (pendingDeletes.includes(oldId)) continue
                const fd = new FormData()
                fd.append('file', cropInfo.file)
                if (cropInfo.idMau != null) fd.append('idMau', cropInfo.idMau)
                try {
                    const res = await api.post(`/admin/san-pham/${targetId}/anh`, fd)
                    if (res.data?.id) replacedSavedIdMap[oldId] = res.data.id
                    await api.delete(`/admin/anh/${oldId}`)
                    if (cropInfo.previewUrl) URL.revokeObjectURL(cropInfo.previewUrl)
                } catch (err) {
                    imageError = err.response?.data?.message ?? 'Không thể cập nhật ảnh đã căn chỉnh'
                }
            }
            setPendingCrops({})

            // 3. Đẩy các ảnh mới chọn trên FE lên Cloudinary
            const uploadedIdByUid = {}
            if (pendingFiles.length > 0 && targetId) {
                const failed = []
                for (const item of pendingFiles) {
                    const fd = new FormData()
                    fd.append('file', item.file)
                    if (item.idMau != null) fd.append('idMau', item.idMau)
                    try {
                        const res = await api.post(`/admin/san-pham/${targetId}/anh`, fd)
                        if (res.data?.id) uploadedIdByUid[item.uid] = res.data.id
                        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
                        if (item.originalUrl && item.originalUrl !== item.previewUrl) URL.revokeObjectURL(item.originalUrl)
                    } catch (err) {
                        failed.push(item)
                        imageError = err.response?.data?.message ?? 'Tải ảnh lên thất bại'
                    }
                }
                setPendingFiles(failed)
                if (failed.length > 0) {
                    if (imageError) message.error(imageError)
                    if (!isEdit) navigate(`/admin/san-pham/${targetId}`)
                    return
                }
            }

            // 4. Áp dụng ảnh chính nếu người dùng có đổi ảnh chính tạm trên FE
            for (const chosenKey of Object.values(pendingPrimaries)) {
                let realAnhId = null
                if (chosenKey.startsWith('saved-')) {
                    const parsed = Number(chosenKey.slice('saved-'.length))
                    if (!pendingDeletes.includes(parsed)) {
                        realAnhId = replacedSavedIdMap[parsed] ?? parsed
                    }
                } else if (uploadedIdByUid[chosenKey]) {
                    realAnhId = uploadedIdByUid[chosenKey]
                }
                if (realAnhId) {
                    try {
                        await api.put(`/admin/anh/${realAnhId}/chinh`)
                    } catch {
                        // Bỏ qua nếu không đặt được ảnh chính
                    }
                }
            }
            setPendingPrimaries({})

            if (imageError) {
                message.warning(imageError)
            } else {
                message.success(isEdit ? 'Đã lưu thay đổi sản phẩm' : 'Đã thêm sản phẩm mới')
            }
            navigate('/admin/san-pham')
        } catch (e) {
            message.error(e.response?.data?.message ?? 'Có lỗi xảy ra')
        } finally {
            setSaving(false)
        }
    }

    const colorOf = idMau => dm.mauSac.find(x => x.id === idMau)

    const columns = [
        {
            title: 'Màu', width: 170,
            render: (_, v) => <Space><span style={dot(colorOf(v.idMau)?.maHex)} />{colorOf(v.idMau)?.tenMau}</Space>,
        },
        { title: 'Size', width: 80, render: (_, v) => dm.kichThuoc.find(x => x.id === v.idKichThuoc)?.tenKichThuoc },
        {
            title: 'Giá niêm yết', width: 170,
            render: (_, v) => <InputNumber {...money} value={v.giaBanBanDau} addonAfter="₫"
                                           onChange={x => setVar(v, { giaBanBanDau: x })} />,
        },
        {
            title: 'Giá bán', width: 170,
            render: (_, v) => <InputNumber {...money} value={v.giaBan} addonAfter="₫"
                                           status={v.giaBan > v.giaBanBanDau ? 'error' : undefined}
                                           onChange={x => setVar(v, { giaBan: x })} />,
        },
        {
            title: 'Tồn kho', width: 120,
            render: (_, v) => <InputNumber min={0} precision={0} style={{ width: '100%' }} value={v.soLuong}
                                           onChange={x => setVar(v, { soLuong: x })} />,
        },
        {
            title: 'Đang bán', width: 90,
            render: (_, v) => <Switch checked={v.trangThai ?? true} onChange={c => setVar(v, { trangThai: c })} />,
        },
    ]

    return (
        <Spin spinning={loading}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card
                    title={isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
                    extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/san-pham')}>Quay lại</Button>}>
                    <Form form={form} layout="vertical" initialValues={{ trangThai: true }}>
                        <Row gutter={16}>
                            <Col xs={24} md={8}>
                                <Form.Item name="maAo" label="Mã sản phẩm" rules={[{ required: true, message: 'Nhập mã sản phẩm' }]}>
                                    <Input placeholder="VD: AO06" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={16}>
                                <Form.Item name="tenAo" label="Tên sản phẩm" rules={[{ required: true, message: 'Nhập tên sản phẩm' }]}>
                                    <Input placeholder="VD: Áo polo cotton piqué classic" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="idChatLieu" label="Chất liệu">
                                    <Select allowClear placeholder="Chọn chất liệu"
                                            options={dm.chatLieu.map(c => ({ value: c.id, label: c.tenChatLieu }))} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="trangThai" label="Trạng thái">
                                    <Select options={[{ value: true, label: 'Đang bán' }, { value: false, label: 'Ngừng bán' }]} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="moTa" label="Mô tả">
                                    <Input.TextArea rows={3} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                <Card title="Biến thể (màu × kích thước)">
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <div style={{ marginBottom: 6 }}>Màu sắc</div>
                            <Select mode="multiple" style={{ width: '100%' }} placeholder="Chọn một hoặc nhiều màu"
                                    value={colorIds} onChange={onColors}
                                    options={dm.mauSac.map(m => ({
                                        value: m.id,
                                        label: <Space><span style={dot(m.maHex)} />{m.tenMau}</Space>,
                                    }))} />
                        </Col>
                        <Col xs={24} md={12}>
                            <div style={{ marginBottom: 6 }}>Kích thước</div>
                            <Select mode="multiple" style={{ width: '100%' }} placeholder="Chọn một hoặc nhiều size"
                                    value={sizeIds} onChange={onSizes}
                                    options={dm.kichThuoc.map(k => ({ value: k.id, label: k.tenKichThuoc }))} />
                        </Col>
                    </Row>

                    <Space wrap style={{ margin: '16px 0' }}>
                        <span>Áp dụng cho tất cả:</span>
                        <InputNumber {...money} placeholder="Giá niêm yết" style={{ width: 160 }}
                                     value={bulk.giaBanBanDau} onChange={x => setBulk(b => ({ ...b, giaBanBanDau: x }))} />
                        <InputNumber {...money} placeholder="Giá bán" style={{ width: 160 }}
                                     value={bulk.giaBan} onChange={x => setBulk(b => ({ ...b, giaBan: x }))} />
                        <InputNumber min={0} precision={0} placeholder="Tồn kho" style={{ width: 120 }}
                                     value={bulk.soLuong} onChange={x => setBulk(b => ({ ...b, soLuong: x }))} />
                        <Button onClick={applyBulk} disabled={rows.length === 0}>Áp dụng</Button>
                    </Space>

                    <Table size="small" pagination={false} dataSource={rows} columns={columns}
                           rowKey={v => keyOf(v.idMau, v.idKichThuoc)} scroll={{ x: 800 }}
                           locale={{ emptyText: 'Chọn màu và kích thước để tạo biến thể' }} />
                </Card>

                <AnhSanPham
                    idAo={isEdit ? id : null}
                    colors={colorIds.map(colorOf).filter(Boolean)}
                    pendingFiles={pendingFiles}
                    setPendingFiles={setPendingFiles}
                    pendingDeletes={pendingDeletes}
                    setPendingDeletes={setPendingDeletes}
                    pendingPrimaries={pendingPrimaries}
                    setPendingPrimaries={setPendingPrimaries}
                    pendingCrops={pendingCrops}
                    setPendingCrops={setPendingCrops}
                />

                <div style={{ textAlign: 'right' }}>
                    <Space>
                        <Button onClick={() => navigate('/admin/san-pham')}>Hủy</Button>
                        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>Lưu sản phẩm</Button>
                    </Space>
                </div>
            </Space>
        </Spin>
    )
}
